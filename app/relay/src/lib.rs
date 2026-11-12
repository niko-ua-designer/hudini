//! Ретранслятор Hudini для модератора.
//!
//! Пульт (mqtt.js, загрузка файлов) ходит на `127.0.0.1:<порт ретранслятора>` обычным TCP, а ретранслятор
//! по каждому соединению открывает TLS к серверу стримера и гоняет байты в обе стороны. Сертификат сервера
//! самоподписанный, поэтому он проверяется только по отпечатку (SHA-256 всего сертификата), который модератор
//! получил в коде: имя, срок и цепочка не важны, чужой сертификат не пройдёт.
//!
//! Адреса из кода пробуются параллельно, побеждает первый, у кого прошёл TLS с нужным отпечатком. Раз в 2 секунды
//! по тёплому соединению идёт `GET /ping`: так считается задержка и замечаются обрывы. При обрыве повторные попытки
//! идут по всему списку с нарастающей паузой.

use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{CertificateError, ClientConfig, DigitallySignedStruct, SignatureScheme};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::{copy_bidirectional, AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{watch, Semaphore};
use tokio::task::{JoinHandle, JoinSet};
use tokio::time::{sleep, timeout};
use tokio_rustls::client::TlsStream;
use tokio_rustls::TlsConnector;

/// Адрес сервера стримера из кода для модератора
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Addr {
    pub h: String,
    pub port: u16,
    pub net: String,
}

/// Что показывать модератору: событие `relay_status`
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Status {
    /// "connecting", "online", "offline" или "badcert" (сервер ответил, но отпечаток не тот)
    pub state: String,
    pub addr: String,
    pub net: String,
    pub rtt_ms: Option<u32>,
    /// когда состояние сменилось, мс от начала эпохи
    pub since: u64,
    pub reconnects: u32,
    pub last_error: String,
}

#[derive(Clone, Debug)]
pub struct Options {
    pub ping_every: Duration,
    pub connect_timeout: Duration,
    pub max_backoff: Duration,
    pub max_clients: usize,
}

impl Default for Options {
    fn default() -> Self {
        Options { ping_every: Duration::from_secs(2), connect_timeout: Duration::from_secs(4), max_backoff: Duration::from_secs(15), max_clients: 128 }
    }
}

#[derive(Debug)]
enum DialError {
    /// сервер найден, но его сертификат не тот, что в коде
    Fingerprint,
    Unreachable(String),
}

// ---------- проверка сертификата по отпечатку ----------
#[derive(Debug)]
struct PinVerifier {
    fp: [u8; 32],
    provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for PinVerifier {
    fn verify_server_cert(&self, end_entity: &CertificateDer<'_>, _intermediates: &[CertificateDer<'_>], _name: &ServerName<'_>, _ocsp: &[u8], _now: UnixTime) -> Result<ServerCertVerified, rustls::Error> {
        if Sha256::digest(end_entity.as_ref()).as_slice() == self.fp {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure))
        }
    }
    fn verify_tls12_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }
    fn verify_tls13_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.provider.signature_verification_algorithms.supported_schemes()
    }
}

fn parse_fp(hex: &str) -> Option<[u8; 32]> {
    if hex.len() != 64 || !hex.is_ascii() {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

fn is_fingerprint_error(e: &io::Error) -> bool {
    e.get_ref().and_then(|x| x.downcast_ref::<rustls::Error>()).is_some_and(|x| matches!(x, rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure)))
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ---------- общее состояние ----------
struct Inner {
    addrs: Vec<Addr>,
    connector: TlsConnector,
    opts: Options,
    /// индекс адреса, который работал в последний раз: его пробуем первым
    best: AtomicUsize,
    online_count: Mutex<u32>,
    status: Mutex<Status>,
    tx: watch::Sender<Status>,
}

const NO_BEST: usize = usize::MAX;

impl Inner {
    fn publish(&self, f: impl FnOnce(&mut Status)) {
        let mut s = self.status.lock().unwrap();
        let before = s.clone();
        f(&mut s);
        if *s != before {
            self.tx.send_replace(s.clone());
        }
    }

    fn set_state(&self, s: &mut Status, state: &str) {
        if s.state != state {
            s.state = state.to_string();
            s.since = now_ms();
        }
    }

    fn mark_online(&self, i: usize) {
        let a = &self.addrs[i];
        let was_online = self.status.lock().unwrap().state == "online";
        if !was_online {
            *self.online_count.lock().unwrap() += 1;
        }
        let reconnects = self.online_count.lock().unwrap().saturating_sub(1);
        self.best.store(i, Ordering::SeqCst);
        self.publish(|s| {
            self.set_state(s, "online");
            s.addr = format!("{}:{}", a.h, a.port);
            s.net = a.net.clone();
            s.reconnects = reconnects;
            s.last_error.clear();
        });
    }

    fn mark_failed(&self, e: &DialError) {
        self.best.store(NO_BEST, Ordering::SeqCst);
        self.publish(|s| {
            let (state, msg) = match e {
                DialError::Fingerprint => ("badcert", "fingerprint mismatch".to_string()),
                DialError::Unreachable(m) => ("offline", m.clone()),
            };
            self.set_state(s, state);
            s.rtt_ms = None;
            s.last_error = msg;
        });
    }

    async fn dial_one(&self, i: usize) -> Result<TlsStream<TcpStream>, DialError> {
        let a = &self.addrs[i];
        let tcp = match timeout(self.opts.connect_timeout, TcpStream::connect((a.h.as_str(), a.port))).await {
            Ok(Ok(t)) => t,
            Ok(Err(e)) => return Err(DialError::Unreachable(format!("{}:{}: {}", a.h, a.port, e))),
            Err(_) => return Err(DialError::Unreachable(format!("{}:{}: timeout", a.h, a.port))),
        };
        let _ = tcp.set_nodelay(true);
        let name = ServerName::try_from("hudini").expect("static name");
        match timeout(self.opts.connect_timeout, self.connector.connect(name, tcp)).await {
            Ok(Ok(t)) => Ok(t),
            Ok(Err(e)) if is_fingerprint_error(&e) => Err(DialError::Fingerprint),
            Ok(Err(e)) => Err(DialError::Unreachable(format!("{}:{}: {}", a.h, a.port, e))),
            Err(_) => Err(DialError::Unreachable(format!("{}:{}: TLS timeout", a.h, a.port))),
        }
    }

    /// Сначала адрес, который работал, иначе все адреса разом: побеждает первый с верным отпечатком
    async fn dial_any(self: &Arc<Self>) -> Result<(TlsStream<TcpStream>, usize), DialError> {
        let best = self.best.load(Ordering::SeqCst);
        if best != NO_BEST {
            if let Ok(t) = self.dial_one(best).await {
                self.mark_online(best);
                return Ok((t, best));
            }
        }
        let mut set = JoinSet::new();
        for i in 0..self.addrs.len() {
            let me = self.clone();
            set.spawn(async move { (i, me.dial_one(i).await) });
        }
        let mut finger = false;
        let mut last = String::from("no addresses");
        while let Some(done) = set.join_next().await {
            match done {
                Ok((i, Ok(t))) => {
                    set.abort_all();
                    self.mark_online(i);
                    return Ok((t, i));
                }
                Ok((_, Err(DialError::Fingerprint))) => finger = true,
                Ok((_, Err(DialError::Unreachable(m)))) => last = m,
                Err(_) => {}
            }
        }
        let e = if finger { DialError::Fingerprint } else { DialError::Unreachable(last) };
        self.mark_failed(&e);
        Err(e)
    }
}

// ---------- ping по тёплому соединению ----------
/// Ответ на ping прочитан целиком? Сервер (Node) отвечает с Transfer-Encoding: chunked, прокси и тесты могут слать Content-Length.
fn response_complete(buf: &[u8]) -> bool {
    let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") else { return false };
    let head = String::from_utf8_lossy(&buf[..end]).to_ascii_lowercase();
    let body = &buf[end + 4..];
    if head.contains("transfer-encoding: chunked") {
        return body.ends_with(b"0\r\n\r\n");
    }
    match head.lines().find_map(|l| l.strip_prefix("content-length:")).and_then(|v| v.trim().parse::<usize>().ok()) {
        Some(n) => body.len() >= n,
        None => false,
    }
}

async fn ping(conn: &mut TlsStream<TcpStream>, limit: Duration) -> io::Result<Duration> {
    let t0 = Instant::now();
    let work = async {
        conn.write_all(b"GET /ping HTTP/1.1\r\nHost: hudini\r\n\r\n").await?;
        let mut buf = Vec::with_capacity(512);
        let mut chunk = [0u8; 512];
        while !response_complete(&buf) {
            let n = conn.read(&mut chunk).await?;
            if n == 0 || buf.len() > 8192 {
                return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "ping closed"));
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        if !buf.starts_with(b"HTTP/1.1 200") && !buf.starts_with(b"HTTP/1.0 200") {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "ping answered not 200"));
        }
        Ok(())
    };
    match timeout(limit, work).await {
        Ok(r) => r.map(|_| t0.elapsed()),
        Err(_) => Err(io::Error::new(io::ErrorKind::TimedOut, "ping timeout")),
    }
}

async fn monitor(inner: Arc<Inner>) {
    let mut conn: Option<TlsStream<TcpStream>> = None;
    let mut fails = 0u32;
    let mut backoff = Duration::from_secs(1);
    loop {
        if conn.is_none() {
            match inner.dial_any().await {
                Ok((c, _)) => {
                    conn = Some(c);
                    backoff = Duration::from_secs(1);
                }
                Err(_) => {
                    sleep(backoff).await;
                    backoff = (backoff * 2).min(inner.opts.max_backoff);
                    continue;
                }
            }
        }
        let res = ping(conn.as_mut().expect("connected"), Duration::from_secs(3)).await;
        match res {
            Ok(d) => {
                fails = 0;
                let ms = d.as_millis().min(u32::MAX as u128) as u32;
                inner.publish(|s| s.rtt_ms = Some(ms));
            }
            Err(e) => {
                conn = None;
                fails += 1;
                // одно неудачное сообщение может быть случайностью (сервер закрыл тихое соединение): сразу переподключаемся
                if fails >= 2 {
                    inner.mark_failed(&DialError::Unreachable(e.to_string()));
                    fails = 0;
                    sleep(backoff).await;
                    backoff = (backoff * 2).min(inner.opts.max_backoff);
                }
                continue;
            }
        }
        sleep(inner.opts.ping_every).await;
    }
}

async fn serve(inner: Arc<Inner>, listener: TcpListener, stop: watch::Receiver<bool>) {
    let limit = Arc::new(Semaphore::new(inner.opts.max_clients));
    loop {
        let Ok((local, _)) = listener.accept().await else { return };
        let Ok(permit) = limit.clone().try_acquire_owned() else { continue };
        let inner = inner.clone();
        let mut stop = stop.clone();
        tokio::spawn(async move {
            let _permit = permit;
            let _ = local.set_nodelay(true);
            let mut local = local;
            let work = async {
                if let Ok((mut up, _)) = inner.dial_any().await {
                    let _ = copy_bidirectional(&mut local, &mut up).await;
                }
            };
            tokio::select! { _ = work => {}, _ = stop.changed() => {} }
        });
    }
}

/// Открытый ретранслятор. Закрывается при `close()` или когда значение выброшено.
pub struct Relay {
    port: u16,
    rx: watch::Receiver<Status>,
    stop: watch::Sender<bool>,
    tasks: Vec<JoinHandle<()>>,
}

impl Relay {
    /// `fp`: отпечаток из кода для модератора (hex SHA-256 сертификата сервера)
    pub async fn open(addrs: Vec<Addr>, fp: &str) -> io::Result<Relay> {
        Self::open_with(addrs, fp, Options::default()).await
    }

    pub async fn open_with(addrs: Vec<Addr>, fp: &str, opts: Options) -> io::Result<Relay> {
        let bad = |m: &str| io::Error::new(io::ErrorKind::InvalidInput, m.to_string());
        let fp = parse_fp(fp).ok_or_else(|| bad("fingerprint must be 64 hex digits"))?;
        if addrs.is_empty() || addrs.len() > 16 {
            return Err(bad("1 to 16 addresses expected"));
        }
        if addrs.iter().any(|a| a.h.is_empty() || a.h.len() > 255 || a.h.contains(char::is_whitespace) || a.port == 0) {
            return Err(bad("bad address"));
        }
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let config = ClientConfig::builder_with_provider(provider.clone())
            .with_safe_default_protocol_versions()
            .map_err(|e| bad(&e.to_string()))?
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(PinVerifier { fp, provider }))
            .with_no_client_auth();
        let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
        let port = listener.local_addr()?.port();
        let first = Status { state: "connecting".into(), addr: String::new(), net: String::new(), rtt_ms: None, since: now_ms(), reconnects: 0, last_error: String::new() };
        let (tx, rx) = watch::channel(first.clone());
        let inner = Arc::new(Inner { addrs, connector: TlsConnector::from(Arc::new(config)), opts, best: AtomicUsize::new(NO_BEST), online_count: Mutex::new(0), status: Mutex::new(first), tx });
        let (stop, stop_rx) = watch::channel(false);
        let tasks = vec![tokio::spawn(serve(inner.clone(), listener, stop_rx)), tokio::spawn(monitor(inner))];
        Ok(Relay { port, rx, stop, tasks })
    }

    /// Порт на 127.0.0.1, куда идёт пульт
    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn status(&self) -> Status {
        self.rx.borrow().clone()
    }

    /// Каналом можно ждать изменений статуса (`changed().await`)
    pub fn subscribe(&self) -> watch::Receiver<Status> {
        self.rx.clone()
    }

    pub fn close(self) {}
}

impl Drop for Relay {
    fn drop(&mut self) {
        let _ = self.stop.send(true);
        for t in &self.tasks {
            t.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::response_complete;

    #[test]
    fn response_end_detection() {
        // как отвечает Node: chunked
        assert!(response_complete(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\npong\r\n0\r\n\r\n"));
        assert!(!response_complete(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\npong\r\n"));
        // Content-Length (любой регистр)
        assert!(response_complete(b"HTTP/1.1 200 OK\r\ncontent-length: 4\r\n\r\npong"));
        assert!(response_complete(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\npong"));
        assert!(!response_complete(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\npon"));
        // неполные заголовки и ответ без длины
        assert!(!response_complete(b"HTTP/1.1 200 OK\r\nContent-Len"));
        assert!(!response_complete(b"HTTP/1.1 200 OK\r\n\r\npong"));
    }
}
