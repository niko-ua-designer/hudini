// Ретранслятор против настоящего TLS-сервера (самоподписанный сертификат, как у Hudini): отпечаток, параллельные адреса,
// задержка, обрыв и возврат сервера.
use std::sync::Arc;
use std::time::Duration;

use hudini_relay::{Addr, Options, Relay};
use rustls::pki_types::{PrivateKeyDer, PrivatePkcs8KeyDer};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;
use tokio::time::{sleep, timeout};
use tokio_rustls::TlsAcceptor;

struct Cert {
    acceptor: TlsAcceptor,
    fp: String,
}

fn make_cert() -> Cert {
    let ck = rcgen::generate_simple_self_signed(vec!["hudini".to_string()]).unwrap();
    let der = ck.cert.der().clone();
    let fp: String = Sha256::digest(der.as_ref()).iter().map(|b| format!("{b:02x}")).collect();
    let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(ck.key_pair.serialize_der()));
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let cfg = rustls::ServerConfig::builder_with_provider(provider).with_safe_default_protocol_versions().unwrap().with_no_client_auth().with_single_cert(vec![der], key).unwrap();
    Cert { acceptor: TlsAcceptor::from(Arc::new(cfg)), fp }
}

// Сервер: на «GET /ping» отвечает pong так же, как Node (chunked), всё остальное возвращает обратно (эхо). Drop закрывает и слушатель, и все соединения.
struct Server {
    stop: tokio::sync::watch::Sender<bool>,
    handle: JoinHandle<()>,
}

impl Server {
    async fn kill(self) {
        let _ = self.stop.send(true);
        self.handle.abort();
        let _ = self.handle.await;
        sleep(Duration::from_millis(50)).await;
    }
}

async fn serve(cert: &Cert, listener: TcpListener) -> Server {
    let acc = cert.acceptor.clone();
    let (stop, stop_rx) = tokio::sync::watch::channel(false);
    let handle = tokio::spawn(async move {
        loop {
            let Ok((tcp, _)) = listener.accept().await else { return };
            let acc = acc.clone();
            let mut stop = stop_rx.clone();
            tokio::spawn(async move {
                let work = async {
                    let Ok(mut tls) = acc.accept(tcp).await else { return };
                    let mut buf = [0u8; 1024];
                    while let Ok(n) = tls.read(&mut buf).await {
                        if n == 0 {
                            return;
                        }
                        let reply: &[u8] = if buf[..n].starts_with(b"GET /ping") { b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\npong\r\n0\r\n\r\n" } else { &buf[..n] };
                        if tls.write_all(reply).await.is_err() {
                            return;
                        }
                    }
                };
                tokio::select! { _ = work => {}, _ = stop.changed() => {} }
            });
        }
    });
    Server { stop, handle }
}

fn addr(port: u16, net: &str) -> Addr {
    Addr { h: "127.0.0.1".into(), port, net: net.into() }
}

fn fast() -> Options {
    Options { ping_every: Duration::from_millis(80), connect_timeout: Duration::from_millis(800), max_backoff: Duration::from_millis(300), max_clients: 8 }
}

async fn echo(relay: &Relay, msg: &[u8]) -> std::io::Result<Vec<u8>> {
    let mut c = TcpStream::connect(("127.0.0.1", relay.port())).await?;
    c.write_all(msg).await?;
    let mut got = vec![0u8; msg.len()];
    timeout(Duration::from_secs(3), c.read_exact(&mut got)).await.map_err(|_| std::io::ErrorKind::TimedOut)??;
    Ok(got)
}

async fn until(relay: &Relay, what: &str, f: impl Fn(&hudini_relay::Status) -> bool) {
    for _ in 0..100 {
        if f(&relay.status()) {
            return;
        }
        sleep(Duration::from_millis(50)).await;
    }
    panic!("{what}: {:?}", relay.status());
}

#[tokio::test]
async fn right_fingerprint_passes_bytes_and_measures_rtt() {
    let cert = make_cert();
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    let _srv = serve(&cert, l).await;
    let relay = Relay::open_with(vec![addr(port, "tailscale")], &cert.fp, fast()).await.unwrap();
    assert_eq!(echo(&relay, b"hello hudini").await.unwrap(), b"hello hudini");
    until(&relay, "online with rtt", |s| s.state == "online" && s.rtt_ms.is_some()).await;
    let s = relay.status();
    assert_eq!(s.net, "tailscale");
    assert_eq!(s.addr, format!("127.0.0.1:{port}"));
    assert_eq!(s.reconnects, 0);
    assert!(s.rtt_ms.unwrap() < 500);
}

#[tokio::test]
async fn wrong_fingerprint_is_rejected() {
    let cert = make_cert();
    let other = make_cert();
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    let _srv = serve(&cert, l).await;
    let relay = Relay::open_with(vec![addr(port, "inet")], &other.fp, fast()).await.unwrap();
    assert!(echo(&relay, b"secret").await.is_err(), "bytes must not pass");
    until(&relay, "badcert", |s| s.state == "badcert").await;
    assert_eq!(relay.status().rtt_ms, None);
}

#[tokio::test]
async fn parallel_addresses_pick_the_working_one() {
    let cert = make_cert();
    let dead = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let dead_port = dead.local_addr().unwrap().port();
    drop(dead); // порт закрыт: отказ в соединении
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    let _srv = serve(&cert, l).await;
    let relay = Relay::open_with(vec![addr(dead_port, "lan"), addr(port, "porthole")], &cert.fp, fast()).await.unwrap();
    assert_eq!(echo(&relay, b"ping").await.unwrap(), b"ping");
    until(&relay, "porthole online", |s| s.state == "online" && s.net == "porthole").await;
}

#[tokio::test]
async fn reconnects_after_the_server_comes_back() {
    let cert = make_cert();
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    let srv = serve(&cert, l).await;
    let relay = Relay::open_with(vec![addr(port, "radmin")], &cert.fp, fast()).await.unwrap();
    until(&relay, "online", |s| s.state == "online").await;
    srv.kill().await; // сервер пропал: слушатель и все соединения закрыты
    until(&relay, "offline", |s| s.state == "offline").await;
    assert!(!relay.status().last_error.is_empty());
    let l = loop {
        if let Ok(l) = TcpListener::bind(("127.0.0.1", port)).await {
            break l;
        }
        sleep(Duration::from_millis(50)).await;
    };
    let _srv = serve(&cert, l).await;
    until(&relay, "online again", |s| s.state == "online").await;
    assert_eq!(relay.status().reconnects, 1);
    assert_eq!(echo(&relay, b"again").await.unwrap(), b"again");
}

#[tokio::test]
async fn bad_input_is_refused() {
    let cert = make_cert();
    assert!(Relay::open(vec![], &cert.fp).await.is_err());
    assert!(Relay::open(vec![addr(1, "lan")], "nothex").await.is_err());
    assert!(Relay::open(vec![Addr { h: "a b".into(), port: 1, net: "lan".into() }], &cert.fp).await.is_err());
    assert!(Relay::open(vec![addr(0, "lan")], &cert.fp).await.is_err());
}
