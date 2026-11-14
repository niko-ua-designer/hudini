// Hudini: окно, иконка в трее и автозапуск поверх сервера оверлея (server/server.js).
// Сервер собран Bun в один файл и лежит рядом с программой (hudini-server, sidecar).
// Связь: сервер пишет в stdout «READY <порт>», «UPDATE <состояние> <версия>», «RESTART», «FAIL …»; программа пишет в его stdin «VISIBLE 0/1», «APPLY».
// Две роли: «стример» (сервер оверлея с окном управления) и «модератор» (сервер без портов, только обновления;
// окно показывает экран сессий из пакета приложения). Роль выбирает первый экран (web/app/start.html).
// Программа закрылась или упала → stdin сервера закрывается → сервер выключается сам.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU32, Ordering};
use std::collections::{HashMap, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::window::Color;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, RunEvent, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";
const MINIMIZED_ARG: &str = "--minimized";
#[cfg(windows)]
const SERVER_BIN: &str = "hudini-server.exe";
#[cfg(not(windows))]
const SERVER_BIN: &str = "hudini-server";
#[cfg(windows)]
const LOADING_URL: &str = "https://tauri.localhost/app/index.html";
#[cfg(not(windows))]
const LOADING_URL: &str = "tauri://localhost/app/index.html";
#[cfg(windows)]
const START_URL: &str = "https://tauri.localhost/app/start.html";
#[cfg(not(windows))]
const START_URL: &str = "tauri://localhost/app/start.html";
const ROLE_STREAMER: &str = "streamer";
const ROLE_MOD: &str = "mod";

// ---------- тексты меню и уведомлений: язык системы ----------
struct Texts {
    open: &'static str,
    copy_obs: &'static str,
    switch_role: &'static str,
    autostart: &'static str,
    quit: &'static str,
    starting: &'static str,
    in_tray: &'static str,
    copied: &'static str,
    no_link: &'static str,
    not_ready: &'static str,
    crashed: &'static str,
    port_busy: &'static str,
    no_server: &'static str,
    saved: &'static str,
}

static RU: Texts = Texts {
    open: "Открыть Hudini",
    copy_obs: "Копировать ссылку для OBS",
    switch_role: "Сменить роль",
    autostart: "Запускать вместе с системой",
    quit: "Выйти",
    starting: "Запускаю сервер оверлея…",
    in_tray: "Hudini продолжает работать в трее. Выйти можно через меню иконки.",
    copied: "Ссылка для OBS скопирована: вставь её в источник «Браузер».",
    no_link: "Ссылки для OBS ещё нет: вставь в программу ссылку от модератора.",
    not_ready: "Сервер ещё запускается, попробуй через пару секунд.",
    crashed: "Сервер оверлея остановился. Перезапускаю…",
    port_busy: "Порт {port} занят: наверное, запущена старая версия Hudini Host (чёрное окно). Закрой её, программа подключится сама.",
    no_server: "Не нашёл файл сервера рядом с программой:",
    saved: "Файл сохранён в «Загрузки»",
};
static UK: Texts = Texts {
    open: "Відкрити Hudini",
    copy_obs: "Копіювати посилання для OBS",
    switch_role: "Змінити роль",
    autostart: "Запускати разом із системою",
    quit: "Вийти",
    starting: "Запускаю сервер оверлею…",
    in_tray: "Hudini продовжує працювати в треї. Вийти можна через меню іконки.",
    copied: "Посилання для OBS скопійовано: встав його в джерело «Браузер».",
    no_link: "Посилання для OBS ще немає: встав у програму посилання від модератора.",
    not_ready: "Сервер ще запускається, спробуй за кілька секунд.",
    crashed: "Сервер оверлею зупинився. Перезапускаю…",
    port_busy: "Порт {port} зайнятий: мабуть, запущена стара версія Hudini Host (чорне вікно). Закрий її, програма підключиться сама.",
    no_server: "Не знайшов файл сервера поруч із програмою:",
    saved: "Файл збережено в «Завантаження»",
};
static DE: Texts = Texts {
    open: "Hudini öffnen",
    copy_obs: "OBS-Link kopieren",
    switch_role: "Rolle wechseln",
    autostart: "Mit dem System starten",
    quit: "Beenden",
    starting: "Overlay-Server wird gestartet…",
    in_tray: "Hudini läuft im Infobereich weiter. Beenden über das Menü des Symbols.",
    copied: "OBS-Link kopiert: füge ihn in die Quelle „Browser“ ein.",
    no_link: "Noch kein OBS-Link: füge zuerst den Link vom Moderator im Programm ein.",
    not_ready: "Der Server startet noch, versuch es in ein paar Sekunden.",
    crashed: "Der Overlay-Server wurde beendet. Starte neu…",
    port_busy: "Port {port} ist belegt: vermutlich läuft noch die alte Version von Hudini Host (schwarzes Fenster). Schließ sie, das Programm verbindet sich dann selbst.",
    no_server: "Server-Datei neben dem Programm nicht gefunden:",
    saved: "Datei in „Downloads“ gespeichert",
};
static EN: Texts = Texts {
    open: "Open Hudini",
    copy_obs: "Copy OBS link",
    switch_role: "Switch role",
    autostart: "Start with system",
    quit: "Quit",
    starting: "Starting the overlay server…",
    in_tray: "Hudini keeps running in the tray. Quit from the tray icon menu.",
    copied: "OBS link copied: paste it into a Browser source.",
    no_link: "No OBS link yet: paste the link from your moderator into the app first.",
    not_ready: "The server is still starting, try again in a few seconds.",
    crashed: "The overlay server stopped. Restarting…",
    port_busy: "Port {port} is busy: probably the old Hudini Host (black window) is still running. Close it and the app will connect by itself.",
    no_server: "Server file not found next to the app:",
    saved: "File saved to Downloads",
};

fn texts() -> &'static Texts {
    let loc = sys_locale::get_locale().unwrap_or_default().to_lowercase();
    match loc.get(..2).unwrap_or("") {
        "ru" => &RU,
        "uk" => &UK,
        "de" => &DE,
        _ => &EN,
    }
}

// ---------- состояние ----------
struct Paths {
    exe: PathBuf,
    data: PathBuf,
}

// Случайный префикс служебных строк сервера (READY/RESTART/FAIL): строки журнала не могут ими притвориться
fn new_token() -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let mut out = String::new();
    for i in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(i ^ std::process::id() as u64);
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

#[derive(Default)]
struct Server {
    token: Mutex<String>,
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    port: AtomicU16,
    quitting: AtomicBool,
    crashes: AtomicU32,
    // что показать на странице загрузки, когда она откроется: (текст, ошибка)
    pending: Mutex<(String, bool)>,
    // поколение сервера: меняется при смене роли, чтобы читатель остановленного сервера ничего не трогал
    gen: AtomicU32,
    // роль запущенного сервера: "streamer", "mod" или пусто
    role: Mutex<String>,
    // последнее «UPDATE <состояние> <версия>» от сервера
    update: Mutex<Option<(String, String)>>,
    // баннер о прошлом падении на странице управления уже показан в этом запуске
    crash_shown: AtomicBool,
    // запуск и остановка сервера по очереди: перезапуск после падения, смена роли и «Сменить роль» не должны
    // запустить два сервера сразу (лишний остался бы без хозяина)
    spawning: Mutex<()>,
}

// ---------- журналы и краши (data/logs) ----------
// app-ГГГГ-ММ-ДД.log (время UTC): роль, ретранслятор, ошибки страниц. crash-*.log только для настоящих падений:
// паника программы или неожиданная смерть сервера. Обычное закрытие, выход из трея, обновление и выключение ПК крашем не считаются.
static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();
const LOG_KEEP_DAYS: u64 = 7;
const CRASH_KEEP: usize = 10;

fn civil(secs: u64) -> (i64, u32, u32, u32, u32, u32) {
    let days = (secs / 86400) as i64;
    let rem = secs % 86400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    (y, m, d, (rem / 3600) as u32, ((rem % 3600) / 60) as u32, (rem % 60) as u32)
}

// ("2026-11-12", "2026-11-12T15:04:05Z", "20261112-150405")
fn stamp() -> (String, String, String) {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let (y, mo, d, h, mi, s) = civil(secs);
    (format!("{y:04}-{mo:02}-{d:02}"), format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z"), format!("{y:04}{mo:02}{d:02}-{h:02}{mi:02}{s:02}"))
}

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &text[..end])
}

fn applog_file() -> Option<PathBuf> {
    Some(LOG_DIR.get()?.join(format!("app-{}.log", stamp().0)))
}

fn applog(text: &str) {
    let Some(path) = applog_file() else { return };
    let (_, iso, _) = stamp();
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{iso} {}", clip(text, 4000).replace('\n', "\n  "));
    }
}

fn write_crash(kind: &str, text: &str) {
    let Some(dir) = LOG_DIR.get() else { return };
    let (_, iso, file) = stamp();
    let body = format!("Hudini {} crash\n{iso}\n{}/{}\n{kind}\n\n{}\n", env!("CARGO_PKG_VERSION"), std::env::consts::OS, std::env::consts::ARCH, clip(text, 16_000));
    let _ = fs::write(dir.join(format!("crash-{file}.log")), body);
    applog(&format!("CRASH {kind}"));
}

// Файлы crash-* от старых к новым. По времени изменения, а не по имени: у программы имена crash-20261112-150405.log,
// у сервера crash-2026-11-12T15-04-05-123Z.log, по алфавиту они перемешиваются.
fn crash_files(dir: &Path) -> Vec<String> {
    let Ok(rd) = fs::read_dir(dir) else { return Vec::new() };
    let mut files: Vec<(std::time::SystemTime, String)> = rd
        .flatten()
        .map(|e| (e.metadata().and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH), e.file_name().to_string_lossy().to_string()))
        .filter(|(_, n)| n.starts_with("crash-"))
        .collect();
    files.sort();
    files.into_iter().map(|(_, n)| n).collect()
}

// Старые журналы убираем: app-*.log старше недели, crash-* — оставляем 10 последних
fn prune_logs(dir: &Path) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    let limit = Duration::from_secs(LOG_KEEP_DAYS * 86400);
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        let age = e.metadata().and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok());
        if name.starts_with("app-") && name.ends_with(".log") && age.is_some_and(|a| a > limit) {
            let _ = fs::remove_file(e.path());
        }
    }
    let crashes = crash_files(dir);
    for name in crashes.iter().take(crashes.len().saturating_sub(CRASH_KEEP)) {
        let _ = fs::remove_file(dir.join(name));
    }
}

// Последний ещё не скрытый краш: (имя файла, текст). Скрытые («Скрыть» на баннере) переименованы в *.seen.log
fn unseen_crash() -> Option<(String, String)> {
    let dir = LOG_DIR.get()?;
    let name = crash_files(dir).into_iter().rev().find(|n| n.ends_with(".log") && !n.ends_with(".seen.log"))?;
    let text = fs::read_to_string(dir.join(&name)).ok()?;
    Some((name, text))
}

// Выбор роли, который помнит программа (data/app.json): role пусто, если «запоминать» выключено
#[derive(Default, Clone)]
struct AppCfg {
    role: String,
    remember: bool,
}

fn load_cfg(data: &Path) -> AppCfg {
    let v: serde_json::Value = fs::read_to_string(data.join("app.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    let remember = v.get("remember").and_then(|x| x.as_bool()).unwrap_or(false);
    let role = v.get("role").and_then(|x| x.as_str()).filter(|r| *r == ROLE_STREAMER || *r == ROLE_MOD).unwrap_or("").to_string();
    AppCfg { role: if remember { role } else { String::new() }, remember }
}

fn save_cfg(data: &Path, cfg: &AppCfg) {
    let _ = write_atomic(&data.join("app.json"), serde_json::json!({ "role": cfg.role, "remember": cfg.remember }).to_string().as_bytes());
}

// Файл целиком или никак: пишем рядом, сбрасываем на диск и переименовываем (обрыв посередине или отключение
// питания не оставят половину файла или пустой файл)
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)
}

struct TrayItems {
    autostart: CheckMenuItem<Wry>,
}

fn say(app: &AppHandle, line: &str) {
    let server = app.state::<Server>();
    let mut stdin = server.stdin.lock().unwrap();
    if let Some(s) = stdin.as_mut() {
        if writeln!(s, "{line}").and_then(|_| s.flush()).is_err() {
            *stdin = None;
        }
    }
}

// Окно и его страницу берём по отдельности (get_window / get_webview): как только в окне появился дочерний webview
// браузера, get_webview_window(MAIN) возвращает None, потому что в окне больше не один webview
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_window(MAIN) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    say(app, "VISIBLE 1");
}

fn hide_main(app: &AppHandle) {
    if let Some(w) = app.get_window(MAIN) {
        let _ = w.hide();
    }
    say(app, "VISIBLE 0");
}

// Галочка «Запускать вместе с системой» в меню трея = то, что реально записано в системе
fn sync_autostart(app: &AppHandle) {
    if let Some(items) = app.try_state::<TrayItems>() {
        let on = app.autolaunch().is_enabled().unwrap_or(false);
        let _ = items.autostart.set_checked(on);
    }
}

fn notify(app: &AppHandle, body: &str) {
    let _ = app.notification().builder().title("Hudini").body(body).show();
}

// ---------- страница загрузки ----------
fn set_loading(app: &AppHandle, text: &str, error: bool) {
    let server = app.state::<Server>();
    *server.pending.lock().unwrap() = (text.to_string(), error);
    let Some(w) = app.get_webview(MAIN) else { return };
    let on_loading_page = w.url().map(|u| is_loading_page(&u)).unwrap_or(false);
    if on_loading_page {
        let js = format!("window.hudiniState&&hudiniState({},{})", serde_json::to_string(text).unwrap_or_default(), error);
        let _ = w.eval(&js);
    } else if let Ok(url) = Url::parse(LOADING_URL) {
        let _ = w.navigate(url); // текст подставит on_page_load
    }
}

// Страницы из пакета приложения (экран роли и сессий, страница загрузки, позже пульт)
fn is_app_url(u: &Url) -> bool {
    u.scheme() == "tauri" || u.host_str() == Some("tauri.localhost")
}

fn is_loading_page(u: &Url) -> bool {
    is_app_url(u) && u.path() == "/app/index.html"
}

// Пульт модератора из пакета приложения: только он открывает вкладки браузера и ретранслятор
fn is_panel_page(u: &Url) -> bool {
    is_app_url(u) && u.path() == "/panel/moderator.html"
}

fn on_panel(app: &AppHandle) -> bool {
    app.get_webview(MAIN).and_then(|w| w.url().ok()).is_some_and(|u| is_panel_page(&u))
}

// Только наш сервер: http://localhost:<порт сервера>/ (другие программы на localhost в окно не пускаем)
fn is_server_url(u: &Url, port: u16) -> bool {
    port != 0 && u.scheme() == "http" && matches!(u.host_str(), Some("localhost") | Some("127.0.0.1")) && u.port() == Some(port)
}

// Наружу открываем только https-ссылки (никаких file:, javascript:, smb: и прочих схем)
fn open_external(app: &AppHandle, url: &Url) {
    if url.scheme() == "https" {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

// ---------- сервер (sidecar) ----------
fn spawn_server(app: &AppHandle, role: &str) -> Result<(), String> {
    let paths = app.state::<Paths>();
    let bin = paths.exe.parent().map(|d| d.join(SERVER_BIN)).unwrap_or_else(|| PathBuf::from(SERVER_BIN));
    if !bin.exists() {
        return Err(format!("{} {}", texts().no_server, bin.display()));
    }
    let mut cmd = Command::new(&bin);
    cmd.current_dir(&paths.data)
        .env("OVERLAY_APP", "1")
        .env("OVERLAY_NO_OPEN", "1")
        .env("OVERLAY_HOST_DIR", &paths.data)
        .env("OVERLAY_APP_EXE", &paths.exe)
        .env("OVERLAY_APP_PID", std::process::id().to_string())
        .env("OVERLAY_ROLE", role)
        .env("OVERLAY_APP_TOKEN", {
            let t = new_token();
            *app.state::<Server>().token.lock().unwrap() = t.clone();
            t
        })
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn().map_err(|e| format!("{}: {e}", bin.display()))?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take();
    let server = app.state::<Server>();
    let gen = server.gen.load(Ordering::SeqCst);
    *server.stdin.lock().unwrap() = child.stdin.take();
    *server.child.lock().unwrap() = Some(child);
    *server.role.lock().unwrap() = role.to_string();
    // окно спрятано (автозапуск) → сервер знает об этом и после обновления запустит программу тоже в трее
    let hidden = app.get_window(MAIN).and_then(|w| w.is_visible().ok()).map(|v| !v).unwrap_or(false);
    say(app, if hidden { "VISIBLE 0" } else { "VISIBLE 1" });
    if let Some(err) = stderr {
        // stderr только вычитываем, чтобы сервер не встал на полном канале
        thread::spawn(move || {
            let mut sink = [0u8; 4096];
            let mut r = err;
            while matches!(r.read(&mut sink), Ok(n) if n > 0) {}
        });
    }
    let app = app.clone();
    let role = role.to_string();
    thread::spawn(move || read_server(app, stdout, gen, role));
    Ok(())
}

fn read_server(app: AppHandle, out: ChildStdout, gen: u32, role: String) {
    let mut restart = false;
    let mut ready = false;
    let mut fail = String::new();
    let token = format!("{} ", app.state::<Server>().token.lock().unwrap());
    // последние строки журнала сервера: попадают в краш-отчёт, если сервер умер сам
    let mut tail: VecDeque<String> = VecDeque::new();
    // stdout читаем до конца: если перестать, сервер заблокируется на записи в журнал
    for chunk in BufReader::new(out).split(b'\n') {
        let Ok(bytes) = chunk else { break };
        let line = String::from_utf8_lossy(&bytes);
        let Some(line) = line.trim().strip_prefix(token.as_str()) else {
            if tail.len() >= 40 {
                tail.pop_front();
            }
            tail.push_back(clip(line.trim(), 300));
            continue;
        };
        if let Some(p) = line.strip_prefix("READY ") {
            if let (false, Ok(port)) = (ready, p.trim().parse::<u16>()) {
                ready = true; // порт сервера задаётся один раз за запуск
                on_ready(&app, port, &role);
            }
        } else if let Some(u) = line.strip_prefix("UPDATE ") {
            let mut it = u.split_whitespace();
            let state = it.next().unwrap_or("").to_string();
            let ver = it.next().filter(|v| *v != "-").unwrap_or("").to_string();
            *app.state::<Server>().update.lock().unwrap() = Some((state.clone(), ver.clone()));
            let _ = app.emit("hudini-update", serde_json::json!({ "state": state, "ver": ver }));
        } else if line == "RESTART" {
            restart = true;
        } else if let Some(f) = line.strip_prefix("FAIL ") {
            fail = f.to_string();
        }
    }
    let server = app.state::<Server>();
    if server.gen.load(Ordering::SeqCst) != gen {
        return; // роль сменили: этот сервер остановили мы, новый уже запущен
    }
    let child = server.child.lock().unwrap().take();
    let mut exit = None;
    if let Some(mut c) = child {
        exit = c.wait().ok();
    }
    *server.stdin.lock().unwrap() = None;
    server.port.store(0, Ordering::SeqCst);
    if !restart && !fail.starts_with("port ") {
        // Сервер умер сам. Выключение ПК и закрытие программы могут убить его раньше, чем мы это заметим:
        // даём секунду и сверяемся, не выходим ли мы сами.
        thread::sleep(Duration::from_millis(1500));
        if !server.quitting.load(Ordering::SeqCst) && server.gen.load(Ordering::SeqCst) == gen {
            let lines: Vec<String> = tail.into_iter().collect();
            write_crash(&format!("server exited unexpectedly (role {role}): {}", exit.map(|s| s.to_string()).unwrap_or_else(|| "unknown".into())), &lines.join("\n"));
        }
    }
    if restart {
        // новая версия уже распакована и запущена: она дождётся, пока эта копия закроется
        server.quitting.store(true, Ordering::SeqCst);
        app.exit(0);
        return;
    }
    if server.quitting.load(Ordering::SeqCst) {
        return;
    }
    let t = texts();
    let busy = fail.starts_with("port ");
    let n = server.crashes.fetch_add(1, Ordering::SeqCst) + 1;
    if role == ROLE_MOD {
        // у модератора сервер только проверяет обновления: перезапускаем тихо, экран сессий не трогаем
        if n > 5 {
            return;
        }
        thread::sleep(Duration::from_secs(2 * n as u64));
        let _turn = server.spawning.lock().unwrap_or_else(|e| e.into_inner());
        if !server.quitting.load(Ordering::SeqCst) && server.gen.load(Ordering::SeqCst) == gen {
            let _ = spawn_server(&app, ROLE_MOD);
        }
        return;
    }
    if busy {
        let port = fail.split_whitespace().nth(1).unwrap_or("7777");
        set_loading(&app, &t.port_busy.replace("{port}", port), true);
    } else if n > 5 {
        set_loading(&app, t.crashed, true);
        return; // пять падений подряд: не крутимся бесконечно
    } else {
        set_loading(&app, t.crashed, false);
    }
    let wait = if busy { Duration::from_secs(3) } else { Duration::from_secs(2 * n as u64) };
    thread::sleep(wait);
    let _turn = server.spawning.lock().unwrap_or_else(|e| e.into_inner());
    if server.quitting.load(Ordering::SeqCst) || server.gen.load(Ordering::SeqCst) != gen {
        return;
    }
    if let Err(e) = spawn_server(&app, ROLE_STREAMER) {
        set_loading(&app, &e, true);
    }
}

fn on_ready(app: &AppHandle, port: u16, role: &str) {
    let server = app.state::<Server>();
    server.port.store(port, Ordering::SeqCst);
    server.crashes.store(0, Ordering::SeqCst);
    if role != ROLE_STREAMER {
        return; // роль модератора: порта нет, окно остаётся на экране сессий
    }
    if let (Some(w), Ok(url)) = (app.get_webview(MAIN), Url::parse(&format!("http://127.0.0.1:{port}/auth?t={}", server.token.lock().unwrap()))) {
        // одноразовый вход: сервер выдаёт окну cookie hudini_admin и перенаправляет на страницу управления
        let _ = w.navigate(url);
    }
}

// Закрыть stdin → сервер снимает объявление для пульта и выходит сам; если не вышел за 2 с, убиваем
fn stop_server(app: &AppHandle) {
    app.state::<Server>().quitting.store(true, Ordering::SeqCst);
    stop_child(app);
}

fn stop_child(app: &AppHandle) {
    let server = app.state::<Server>();
    server.stdin.lock().unwrap().take();
    *server.role.lock().unwrap() = String::new();
    let child = server.child.lock().unwrap().take();
    if let Some(mut c) = child {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(2) {
            match c.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => thread::sleep(Duration::from_millis(50)),
                Err(_) => break,
            }
        }
        let _ = c.kill();
        let _ = c.wait();
    }
}

// Смена роли: останавливаем текущий сервер и запускаем сервер новой роли (вызывать под Server::spawning)
fn switch_role(app: &AppHandle, role: &str) -> Result<(), String> {
    applog(&format!("role: {role}"));
    let server = app.state::<Server>();
    server.gen.fetch_add(1, Ordering::SeqCst);
    stop_child(app);
    server.port.store(0, Ordering::SeqCst);
    server.crashes.store(0, Ordering::SeqCst);
    if role == ROLE_STREAMER {
        set_loading(app, texts().starting, false);
    }
    let r = spawn_server(app, role);
    if let (Err(e), ROLE_STREAMER) = (&r, role) {
        set_loading(app, e, true);
    }
    r
}

// Назад к экрану роли: сервер останавливаем, окно возвращаем на первый экран (настройка «запоминать» не меняется)
fn to_start_page(app: &AppHandle) {
    applog("role: back to the start screen");
    let server = app.state::<Server>();
    {
        let _turn = server.spawning.lock().unwrap_or_else(|e| e.into_inner());
        server.gen.fetch_add(1, Ordering::SeqCst);
        stop_child(app);
        server.port.store(0, Ordering::SeqCst);
    }
    if let (Some(w), Ok(url)) = (app.get_webview(MAIN), Url::parse(START_URL)) {
        let _ = w.navigate(url);
    }
    show_main(app);
}

fn quit(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        stop_server(&app);
        app.exit(0);
    });
}

// ---------- ссылка для OBS из /api/status ----------
fn fetch_status(port: u16, token: &str) -> Result<serde_json::Value, String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).map_err(|e| e.to_string())?;
    let _ = s.set_read_timeout(Some(Duration::from_secs(3)));
    // Host 127.0.0.1:<порт>: сервер отвечает только своему адресу (защита от DNS-rebinding)
    write!(s, "GET /api/status HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nX-Hudini-Token: {token}\r\nConnection: close\r\n\r\n").map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    s.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&buf);
    let (head, body) = text.split_once("\r\n\r\n").ok_or("bad response")?;
    if !head.starts_with("HTTP/1.1 200") && !head.starts_with("HTTP/1.0 200") {
        return Err(head.lines().next().unwrap_or("").to_string());
    }
    serde_json::from_str(body).map_err(|e| e.to_string())
}

fn copy_obs_link(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let t = texts();
        let port = app.state::<Server>().port.load(Ordering::SeqCst);
        if port == 0 {
            return notify(&app, t.not_ready);
        }
        let token = app.state::<Server>().token.lock().unwrap().clone();
        let link = fetch_status(port, &token).ok().and_then(|s| s.get("obsLink").and_then(|v| v.as_str()).map(String::from)).unwrap_or_default();
        if link.is_empty() {
            notify(&app, t.no_link);
            show_main(&app);
        } else if app.clipboard().write_text(link).is_ok() {
            notify(&app, t.copied);
        }
    });
}

// ---------- папка data ----------
fn writable(dir: &Path) -> bool {
    if fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".write-test");
    let ok = fs::write(&probe, b"").is_ok();
    let _ = fs::remove_file(&probe);
    ok
}

// Портативно: data рядом с программой (на macOS рядом с .app, не внутри него).
// Если туда писать нельзя (macOS запустил .app из карантина, папка только для чтения) — папка данных приложения.
fn data_dir(app: &AppHandle, exe: &Path) -> PathBuf {
    #[allow(unused_mut)]
    let mut base = exe.parent().map(Path::to_path_buf).unwrap_or_default();
    #[cfg(target_os = "macos")]
    if let Some(bundle) = exe.ancestors().find(|p| p.extension().is_some_and(|e| e == "app")) {
        if let Some(parent) = bundle.parent() {
            base = parent.to_path_buf();
        }
    }
    let portable = base.join("data");
    let translocated = portable.to_string_lossy().contains("/AppTranslocation/");
    if !translocated && writable(&portable) {
        return portable;
    }
    app.path().app_data_dir().ok().map(|d| d.join("data")).filter(|d| writable(d)).unwrap_or(portable)
}

// ---------- после обновления: ждём, пока старая копия закроется ----------
#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    let r = unsafe { libc::kill(pid as libc::pid_t, 0) };
    r == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(unix)]
fn wait_for_exit(pid: u32, timeout: Duration) {
    let start = Instant::now();
    while process_alive(pid) && start.elapsed() < timeout {
        thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(windows)]
fn wait_for_exit(pid: u32, timeout: Duration) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE};
    unsafe {
        let h = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
        if h.is_null() {
            return;
        }
        WaitForSingleObject(h, timeout.as_millis().min(u32::MAX as u128) as u32);
        CloseHandle(h);
    }
}

// ---------- команды для страниц из пакета приложения (capabilities/default.json) ----------
#[tauri::command]
fn app_state(app: AppHandle) -> serde_json::Value {
    let cfg = app.state::<Mutex<AppCfg>>().lock().unwrap().clone();
    let server = app.state::<Server>();
    let running = server.role.lock().unwrap().clone();
    let update = server.update.lock().unwrap().clone().map(|(s, v)| serde_json::json!({ "state": s, "ver": v }));
    let crash = unseen_crash().map(|(name, text)| serde_json::json!({ "name": name, "text": text }));
    serde_json::json!({ "role": cfg.role, "remember": cfg.remember, "running": running, "version": env!("CARGO_PKG_VERSION"), "update": update, "crash": crash })
}

// Ошибки страниц (window.onerror, unhandledrejection) попадают в журнал приложения. Страница, которая сыплет
// ошибками в цикле, не должна раздуть журнал: не больше PAGE_LOG_PER_MIN строк в минуту (о лишних одна строка
// в следующую минуту) и ничего, если журнал за день уже больше APP_LOG_MAX.
const PAGE_LOG_PER_MIN: u32 = 30;
const APP_LOG_MAX: u64 = 5 * 1024 * 1024;

struct PageLog {
    since: Instant,
    lines: u32,
    dropped: u32,
}

static PAGE_LOG: Mutex<Option<PageLog>> = Mutex::new(None);

#[tauri::command]
fn app_log(text: String) {
    let dropped = {
        let mut g = PAGE_LOG.lock().unwrap_or_else(|e| e.into_inner());
        let st = g.get_or_insert(PageLog { since: Instant::now(), lines: 0, dropped: 0 });
        let mut dropped = 0;
        if st.since.elapsed() >= Duration::from_secs(60) {
            dropped = st.dropped;
            *st = PageLog { since: Instant::now(), lines: 0, dropped: 0 };
        }
        if st.lines >= PAGE_LOG_PER_MIN {
            st.dropped += 1;
            return;
        }
        st.lines += 1;
        dropped
    };
    if applog_file().and_then(|p| fs::metadata(p).ok()).is_some_and(|m| m.len() > APP_LOG_MAX) {
        return;
    }
    if dropped > 0 {
        applog(&format!("page: … {dropped} more line(s) dropped"));
    }
    applog(&format!("page: {}", clip(&text, 2000)));
}

// «Открыть папку с журналами»
#[tauri::command]
fn open_logs(app: AppHandle) -> Result<(), String> {
    let dir = LOG_DIR.get().ok_or("no logs folder")?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

// «Открыть папку с данными»: там store.json со всем, что пульт хранит (ключи комнат, сцены, настройки)
#[tauri::command]
fn open_data(app: AppHandle) -> Result<(), String> {
    let dir = app.state::<Paths>().data.clone();
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

// ---------- браузер справа: дочерние webview в окне пульта ----------
// Нужен настоящий браузер (вход в Twitch, кнопки модератора в popout-чате), поэтому не iframe: Twitch и многие сайты
// запрещают встраивание. Webview лежит поверх страницы пульта в прямоугольнике, который присылает пульт (browser_place,
// физические пиксели). Права приложения (capabilities) выданы только webview «main», дочерние их не получают.
struct Browser {
    rect: Mutex<(i32, i32, u32, u32)>,
    active: Mutex<Option<String>>,
    shown: AtomicBool,
    // создание и закрытие вкладок по очереди: пульт при загрузке может прислать два browser_open подряд,
    // и второй не должен пытаться создать webview с тем же именем
    turn: tauri::async_runtime::Mutex<()>,
    // по каждой вкладке (имя webview): последний адрес, который просил открыть пульт, и последний загруженный
    // (его пульт запоминает как адрес вкладки и потом присылает обратно)
    requested: Mutex<HashMap<String, Url>>,
    loaded: Mutex<HashMap<String, Url>>,
}

impl Default for Browser {
    fn default() -> Self {
        Browser { rect: Mutex::new((0, 0, 320, 480)), active: Mutex::new(None), shown: AtomicBool::new(true), turn: tauri::async_runtime::Mutex::new(()), requested: Mutex::new(HashMap::new()), loaded: Mutex::new(HashMap::new()) }
    }
}

fn browser_label(id: &str) -> Result<String, String> {
    if (1..=12).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()) {
        Ok(format!("web-{id}"))
    } else {
        Err("bad tab id".into())
    }
}

// Адрес этого компьютера или локальной сети: петля, 0.0.0.0/8, частные сети (10/8, 172.16/12, 192.168/16),
// link-local (169.254/16, fe80::/10), fc00::/7 и 100.64/10 (CGNAT, через него Tailscale видит Hudini Host стримера).
// IPv6 вида ::ffff:a.b.c.d и ::a.b.c.d проверяем как IPv4 внутри.
fn is_local_ip(ip: std::net::IpAddr) -> bool {
    use std::net::IpAddr;
    let v4 = match ip {
        IpAddr::V4(v4) => v4,
        IpAddr::V6(v6) => {
            let s = v6.segments();
            if v6.is_loopback() || v6.is_unspecified() || (s[0] & 0xfe00) == 0xfc00 || (s[0] & 0xffc0) == 0xfe80 {
                return true;
            }
            match v6.to_ipv4() {
                Some(v4) => v4,
                None => return false,
            }
        }
    };
    let o = v4.octets();
    v4.is_loopback() || v4.is_private() || v4.is_link_local() || v4.is_broadcast() || o[0] == 0 || (o[0] == 100 && (o[1] & 0xc0) == 64)
}

// Только http(s) и только чужие сайты: страницы самого Hudini (сервер на 127.0.0.1) и адреса локальной сети
// во встроенный браузер не пускаем
fn browser_url(raw: &str) -> Result<Url, String> {
    let u = Url::parse(raw).map_err(|e| e.to_string())?;
    if !matches!(u.scheme(), "http" | "https") {
        return Err("only http(s) addresses".into());
    }
    let host = u.host_str().ok_or("no host")?.to_ascii_lowercase();
    // «localhost.» и «a.localhost.» — те же адреса, что без точки в конце
    let host = host.trim_end_matches('.');
    let ip = host.trim_start_matches('[').trim_end_matches(']').parse::<std::net::IpAddr>().ok();
    if host.is_empty() || host == "localhost" || host.ends_with(".localhost") || ip.is_some_and(is_local_ip) {
        return Err("local addresses are not allowed".into());
    }
    Ok(u)
}

// Показываем только активную вкладку и только когда ничто в пульте (меню, справка) не должно быть поверх неё
fn browser_sync(app: &AppHandle) {
    let b = app.state::<Browser>();
    let active = b.active.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let shown = b.shown.load(Ordering::SeqCst);
    for (label, wv) in app.webviews() {
        if !label.starts_with("web-") {
            continue;
        }
        if shown && active.as_deref() == Some(label.as_str()) {
            let _ = wv.show();
        } else {
            let _ = wv.hide();
        }
    }
}

// async обязательно: синхронные команды идут в главном потоке, и создание webview из них на Windows (WebView2) виснет.
// Остальные browser_* только двигают, прячут, закрывают уже созданные webview или выполняют в них js: это не создание,
// поэтому они остаются синхронными (browser_close асинхронная только ради очереди с browser_open).
#[tauri::command]
async fn browser_open(app: AppHandle, id: String, url: String) -> Result<(), String> {
    // На Linux (webkit2gtk) дочерние webview кладутся в gtk::Box и не слушаются set_position/set_size: колонка делила бы
    // окно пополам. Ошибка → пульт остаётся на своём iframe.
    if cfg!(target_os = "linux") {
        return Err("embedded browser is not supported on Linux".into());
    }
    let label = browser_label(&id)?;
    let url = browser_url(&url)?;
    let b = app.state::<Browser>();
    let _turn = b.turn.lock().await;
    // окно уже ушло с пульта (просьба пришла, пока он закрывался): вкладку не создаём, иначе она осталась бы поверх нового экрана
    if !on_panel(&app) {
        return Err("the panel is not open".into());
    }
    *b.active.lock().unwrap_or_else(|e| e.into_inner()) = Some(label.clone());
    if let Some(wv) = app.get_webview(&label) {
        // Пульт присылает сохранённый адрес вкладки при каждом переключении. Переходим, только если он просит новый
        // адрес: не прошлую просьбу, не последнюю загруженную страницу и не то, что открыто сейчас. Иначе переключение
        // вкладок перезагружало бы страницу, по которой ходили внутри (вход в Twitch, адреса одностраничных сайтов).
        let current = wv.url().ok();
        let changed = {
            let was_loaded = b.loaded.lock().unwrap_or_else(|e| e.into_inner()).get(&label) == Some(&url);
            let mut req = b.requested.lock().unwrap_or_else(|e| e.into_inner());
            let same = req.get(&label) == Some(&url) || was_loaded || current.as_ref() == Some(&url);
            req.insert(label.clone(), url.clone());
            !same
        };
        if changed {
            wv.navigate(url).map_err(|e| e.to_string())?;
        }
        browser_sync(&app);
        return Ok(());
    }
    let window = app.get_window(MAIN).ok_or("no window")?;
    let (x, y, w, h) = *b.rect.lock().unwrap_or_else(|e| e.into_inner());
    let popup = app.clone();
    let loaded = app.clone();
    let popup_label = label.clone();
    let loaded_label = label.clone();
    let tab = id.clone();
    let builder = WebviewBuilder::new(label.clone(), WebviewUrl::External(url.clone()))
        .on_navigation(|u| browser_url(u.as_str()).is_ok() || u.as_str() == "about:blank")
        // чужие сайты во вкладке браузера не скачивают файлы
        .on_download(|_, _| false)
        // ссылки «в новом окне» открываем в этой же вкладке
        .on_new_window(move |u, _features| {
            if let (Ok(u), Some(wv)) = (browser_url(u.as_str()), popup.get_webview(&popup_label)) {
                let _ = wv.navigate(u);
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |_wv, payload| {
            if let PageLoadEvent::Finished = payload.event() {
                loaded.state::<Browser>().loaded.lock().unwrap_or_else(|e| e.into_inner()).insert(loaded_label.clone(), payload.url().clone());
                let _ = loaded.emit("hudini-browser", serde_json::json!({ "id": tab, "url": payload.url().as_str() }));
            }
        });
    window.add_child(builder, PhysicalPosition::new(x, y), PhysicalSize::new(w, h)).map_err(|e| e.to_string())?;
    b.requested.lock().unwrap_or_else(|e| e.into_inner()).insert(label, url);
    browser_sync(&app);
    Ok(())
}

// Прямоугольник под браузер (физические пиксели окна): пульт присылает его при каждом изменении раскладки
#[tauri::command]
fn browser_place(app: AppHandle, x: i32, y: i32, w: u32, h: u32) {
    let (w, h) = (w.clamp(1, 16384), h.clamp(1, 16384));
    *app.state::<Browser>().rect.lock().unwrap_or_else(|e| e.into_inner()) = (x, y, w, h);
    for (label, wv) in app.webviews() {
        if label.starts_with("web-") {
            let _ = wv.set_position(PhysicalPosition::new(x, y));
            let _ = wv.set_size(PhysicalSize::new(w, h));
        }
    }
}

// Спрятать браузер, пока поверх него открыто меню или справка пульта (нативный webview всегда выше страницы)
#[tauri::command]
fn browser_visible(app: AppHandle, visible: bool) {
    app.state::<Browser>().shown.store(visible, Ordering::SeqCst);
    browser_sync(&app);
}

#[tauri::command]
async fn browser_close(app: AppHandle, id: String) -> Result<(), String> {
    let label = browser_label(&id)?;
    let b = app.state::<Browser>();
    let _turn = b.turn.lock().await;
    {
        let mut active = b.active.lock().unwrap_or_else(|e| e.into_inner());
        if active.as_deref() == Some(label.as_str()) {
            *active = None;
        }
    }
    b.requested.lock().unwrap_or_else(|e| e.into_inner()).remove(&label);
    b.loaded.lock().unwrap_or_else(|e| e.into_inner()).remove(&label);
    if let Some(wv) = app.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Окно ушло с пульта («← Сессии», «Сменить роль», страница загрузки): вкладки браузера остались бы поверх нового экрана,
// а ретранслятор держал бы соединение со стримером. Закрываем и то, и другое.
async fn leave_panel(app: AppHandle) {
    let b = app.state::<Browser>();
    let _turn = b.turn.lock().await;
    *b.active.lock().unwrap_or_else(|e| e.into_inner()) = None;
    b.shown.store(true, Ordering::SeqCst);
    b.requested.lock().unwrap_or_else(|e| e.into_inner()).clear();
    b.loaded.lock().unwrap_or_else(|e| e.into_inner()).clear();
    let mut tabs = 0;
    for (label, wv) in app.webviews() {
        if label.starts_with("web-") {
            let _ = wv.close();
            tabs += 1;
        }
    }
    let relay = app.state::<RelayState>().0.lock().unwrap().take();
    if tabs > 0 || relay.is_some() {
        applog(&format!("left the panel: closed {tabs} browser tab(s){}", if relay.is_some() { " and the relay" } else { "" }));
    }
    if let Some((_, t)) = relay {
        t.abort(); // ретранслятор закрывается при выбросе
    }
}

#[tauri::command]
fn browser_nav(app: AppHandle, id: String, op: String) -> Result<(), String> {
    let label = browser_label(&id)?;
    let wv = app.get_webview(&label).ok_or("no such tab")?;
    let js = match op.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        _ => return Err("bad operation".into()),
    };
    wv.eval(js).map_err(|e| e.to_string())
}

// «Скрыть» баннер о прошлом падении: файл остаётся, но помечается как просмотренный
#[tauri::command]
fn crash_dismiss(name: String) {
    let Some(dir) = LOG_DIR.get() else { return };
    if name.starts_with("crash-") && name.ends_with(".log") && !name.ends_with(".seen.log") && !name.contains(['/', '\\']) {
        let seen = format!("{}.seen.log", name.strip_suffix(".log").unwrap_or(&name));
        let _ = fs::rename(dir.join(&name), dir.join(seen));
    }
}

#[tauri::command]
async fn start_role(app: AppHandle, role: String, remember: bool) -> Result<(), String> {
    if role != ROLE_STREAMER && role != ROLE_MOD {
        return Err("unknown role".into());
    }
    {
        let paths = app.state::<Paths>();
        let cfg_state = app.state::<Mutex<AppCfg>>();
        let mut cfg = cfg_state.lock().unwrap();
        cfg.remember = remember;
        cfg.role = if remember { role.clone() } else { String::new() };
        save_cfg(&paths.data, &cfg);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let server = app.state::<Server>();
        let _turn = server.spawning.lock().unwrap_or_else(|e| e.into_inner());
        let alive = server.child.lock().unwrap().is_some() && *server.role.lock().unwrap() == role;
        if alive {
            return Ok(());
        }
        switch_role(&app, &role)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_remember(app: AppHandle, remember: bool) {
    let paths = app.state::<Paths>();
    let running = app.state::<Server>().role.lock().unwrap().clone();
    let cfg_state = app.state::<Mutex<AppCfg>>();
    let mut cfg = cfg_state.lock().unwrap();
    cfg.remember = remember;
    cfg.role = if remember { running } else { String::new() };
    save_cfg(&paths.data, &cfg);
}

#[tauri::command]
fn apply_update(app: AppHandle) {
    say(&app, "APPLY");
}

// ---------- ретранслятор модератора (app/relay) ----------
// Пульт ходит на 127.0.0.1:<порт>, ретранслятор по каждому соединению открывает TLS к серверу стримера
// и сверяет сертификат с отпечатком из кода. Статус уходит в окно событием relay_status.
#[derive(Default)]
struct RelayState(Mutex<Option<(hudini_relay::Relay, tauri::async_runtime::JoinHandle<()>)>>);

// Адреса стримера в журнал не пишем: вместо адреса сеть и номер в коде («tailscale#1»), порт остаётся.
// Длинные адреса заменяем первыми, чтобы 10.0.0.1 не съел часть 10.0.0.12.
fn mask_hosts(text: &str, hosts: &[(String, String)]) -> String {
    let mut out = text.to_string();
    for (host, tag) in hosts {
        out = out.replace(host.as_str(), tag);
    }
    out
}

#[tauri::command]
async fn relay_open(app: AppHandle, addrs: Vec<hudini_relay::Addr>, fp: String) -> Result<u16, String> {
    let count = addrs.len();
    let mut hosts: Vec<(String, String)> = addrs.iter().enumerate().map(|(i, a)| (a.h.clone(), format!("{}#{}", if a.net.is_empty() { "addr" } else { a.net.as_str() }, i + 1))).collect();
    hosts.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    let relay = hudini_relay::Relay::open(addrs, &fp).await.map_err(|e| e.to_string())?;
    let port = relay.port();
    applog(&format!("relay: opened on 127.0.0.1:{port}, {count} address(es)"));
    let mut rx = relay.subscribe();
    let handle = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        let _ = handle.emit("relay_status", rx.borrow().clone());
        let mut last = String::new();
        while rx.changed().await.is_ok() {
            let status = rx.borrow_and_update().clone();
            // в журнал только смены состояния и адреса, без задержки раз в 2 секунды
            let key = format!("{} {} {} {}", status.state, status.addr, status.net, status.last_error);
            if key != last {
                let line = format!("relay: {} via {} {} (reconnects {}){}", status.state, status.addr, status.net, status.reconnects, if status.last_error.is_empty() { String::new() } else { format!(": {}", status.last_error) });
                applog(&mask_hosts(&line, &hosts));
                last = key;
            }
            let _ = handle.emit("relay_status", status);
        }
    });
    if !on_panel(&app) {
        task.abort(); // пульт закрыли, пока ретранслятор открывался
        return Err("the panel is not open".into());
    }
    let old = app.state::<RelayState>().0.lock().unwrap().replace((relay, task));
    if let Some((_, t)) = old {
        t.abort(); // прежний ретранслятор закрывается при выбросе
    }
    Ok(port)
}

#[tauri::command]
fn relay_close(app: AppHandle) {
    if let Some((_, t)) = app.state::<RelayState>().0.lock().unwrap().take() {
        t.abort();
    }
}

#[tauri::command]
fn relay_status(app: AppHandle) -> Option<hudini_relay::Status> {
    app.state::<RelayState>().0.lock().unwrap().as_ref().map(|(r, _)| r.status())
}

// Хранилище страниц приложения: один файл data/store.json (ключ → значение, как localStorage)
const STORE_MAX: usize = 32 * 1024 * 1024;

#[tauri::command]
fn store_load(app: AppHandle) -> Result<serde_json::Value, String> {
    let data = app.state::<Paths>().data.clone();
    let path = data.join("store.json");
    // файл есть, но не читается (антивирус, блокировка): пустой ответ заставил бы страницу затереть его при первой записи,
    // поэтому после нескольких попыток возвращаем ошибку; нет файла вовсе — это чистый старт
    let mut tries = 0;
    let bytes = loop {
        match fs::read(&path) {
            Ok(b) => break b,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(serde_json::json!({})),
            Err(e) => {
                tries += 1;
                if tries >= 5 {
                    applog(&format!("store.json: cannot read: {e}"));
                    return Err(format!("cannot read store.json: {e}"));
                }
                std::thread::sleep(Duration::from_millis(150));
            }
        }
    };
    match serde_json::from_slice::<serde_json::Value>(&bytes) {
        Ok(v) if v.is_object() => Ok(v),
        _ => {
            // файл испорчен: откладываем его в сторону, иначе следующее сохранение затёрло бы его,
            // а из отложенной копии ключи комнат ещё можно достать вручную
            let aside = data.join(format!("store.corrupt-{}.json", stamp().2));
            let moved = fs::rename(&path, &aside).is_ok();
            applog(&format!("store.json is damaged ({} bytes): {}", bytes.len(), if moved { format!("moved aside as {}", aside.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()) } else { "could not move it aside".to_string() }));
            Ok(serde_json::json!({}))
        }
    }
}

#[tauri::command]
fn store_save(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    if !data.is_object() {
        return Err("store must be an object".into());
    }
    let text = data.to_string();
    if text.len() > STORE_MAX {
        return Err("store is too large".into());
    }
    write_atomic(&app.state::<Paths>().data.join("store.json"), text.as_bytes()).map_err(|e| e.to_string())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(pid) = args.iter().position(|a| a == "--wait-pid").and_then(|i| args.get(i + 1)).and_then(|s| s.parse::<u32>().ok()) {
        if pid != std::process::id() {
            wait_for_exit(pid, Duration::from_secs(20));
        }
    }
    let start_hidden = args.iter().any(|a| a == MINIMIZED_ARG);

    tauri::Builder::default()
        // второй запуск: показываем уже открытую программу (если это не автозапуск)
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if !argv.iter().any(|a| a == MINIMIZED_ARG) {
                show_main(app);
            }
        }))
        // автозапуск: окно спрятано в трей; на macOS через LaunchAgent (~/Library/LaunchAgents)
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![MINIMIZED_ARG])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Server::default())
        .manage(RelayState::default())
        .manage(Browser::default())
        .invoke_handler(tauri::generate_handler![app_state, start_role, set_remember, apply_update, store_load, store_save, relay_open, relay_close, relay_status, app_log, open_logs, open_data, crash_dismiss, browser_open, browser_place, browser_visible, browser_close, browser_nav])
        .setup(move |app| {
            let handle = app.handle().clone();
            let exe = std::env::current_exe()?;
            let data = data_dir(&handle, &exe);
            app.manage(Paths { exe, data: data.clone() });
            let logs = data.join("logs");
            let _ = fs::create_dir_all(&logs);
            prune_logs(&logs);
            let _ = LOG_DIR.set(logs);
            let default_hook = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |info| {
                write_crash("panic", &format!("{info}\n{}", std::backtrace::Backtrace::force_capture()));
                default_hook(info);
            }));
            applog(&format!("start {} ({})", env!("CARGO_PKG_VERSION"), std::env::consts::OS));
            let cfg = load_cfg(&data);
            // запомненная роль стримера: сразу запускаем сервер, экран роли не показываем
            let auto_streamer = cfg.remember && cfg.role == ROLE_STREAMER;
            app.manage(Mutex::new(cfg));
            let t = texts();

            // ---- окно ----
            let nav = handle.clone();
            let popup = handle.clone();
            let dl = handle.clone();
            let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App((if auto_streamer { "app/index.html" } else { "app/start.html" }).into()))
                // https://tauri.localhost вместо http: плеер и чат Twitch встраиваются только в страницы с https
                .use_https_scheme(true)
                .disable_drag_drop_handler() // нужно, чтобы код модератора можно было перетащить в окно (HTML5 drag-and-drop)
                .title("Hudini")
                .inner_size(980.0, 760.0)
                .min_inner_size(720.0, 520.0)
                .center()
                .visible(!start_hidden)
                .background_color(Color(0x0f, 0x11, 0x15, 0xff))
                // в окне только страницы приложения и страница управления; остальные ссылки — в обычном браузере
                .on_navigation(move |url| {
                    let port = nav.state::<Server>().port.load(Ordering::SeqCst);
                    // ссылка «Сменить роль» на странице управления: сервер останавливаем, окно возвращаем на первый экран
                    if is_server_url(url, port) && url.path() == "/__role" {
                        let app = nav.clone();
                        thread::spawn(move || to_start_page(&app));
                        return false;
                    }
                    if is_app_url(url) || is_server_url(url, port) || url.as_str() == "about:blank" {
                        return true;
                    }
                    open_external(&nav, url);
                    false
                })
                .on_new_window(move |url, _features| {
                    open_external(&popup, &url);
                    NewWindowResponse::Deny
                })
                // «Скачать файл вручную» (файл для CS2) → в папку «Загрузки»
                .on_download(move |_webview, event| {
                    match event {
                        DownloadEvent::Requested { url, destination } => {
                            // скачивать можно только с нашего сервера (файл для CS2)
                            let port = dl.state::<Server>().port.load(Ordering::SeqCst);
                            if !is_server_url(&url, port) {
                                return false;
                            }
                            if let Ok(dir) = dl.path().download_dir() {
                                let name = destination
                                    .file_name()
                                    .map(|n| n.to_os_string())
                                    .or_else(|| url.path_segments().and_then(|mut s| s.next_back()).map(Into::into))
                                    .unwrap_or_else(|| "gamestate_integration_streamoverlay.cfg".into());
                                *destination = dir.join(name);
                            }
                        }
                        DownloadEvent::Finished { success: true, .. } => notify(&dl, texts().saved),
                        _ => {}
                    }
                    true
                })
                .on_page_load(|w, payload| {
                    // любая страница, кроме пульта: закрываем вкладки браузера и ретранслятор (в отдельной задаче:
                    // обработчик идёт в главном потоке, а закрытие ждёт очереди browser_open)
                    if payload.event() == PageLoadEvent::Started && !is_panel_page(payload.url()) {
                        tauri::async_runtime::spawn(leave_panel(w.app_handle().clone()));
                    }
                    // страница управления сервера: показываем баннер о прошлом падении (один раз за запуск)
                    if payload.event() == PageLoadEvent::Finished {
                        let app = w.app_handle();
                        let port = app.state::<Server>().port.load(Ordering::SeqCst);
                        if is_server_url(payload.url(), port) && !app.state::<Server>().crash_shown.swap(true, Ordering::SeqCst) {
                            if let Some((name, text)) = unseen_crash() {
                                let js = format!("window.hudiniCrash&&hudiniCrash({},{})", serde_json::to_string(&name).unwrap_or_default(), serde_json::to_string(&text).unwrap_or_default());
                                let _ = w.eval(&js);
                            }
                        }
                    }
                    if payload.event() == PageLoadEvent::Finished && is_loading_page(payload.url()) {
                        let app = w.app_handle();
                        let (text, error) = app.state::<Server>().pending.lock().unwrap().clone();
                        let js = format!("window.hudiniState&&hudiniState({},{})", serde_json::to_string(&text).unwrap_or_default(), error);
                        let _ = w.eval(&js);
                    }
                })
                .build()?;

            // крестик прячет окно в трей; первый раз объясняем уведомлением
            let wh = handle.clone();
            let hint_file = data.join(".tray-hint-shown");
            window.on_window_event(move |event| match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    hide_main(&wh);
                    if !hint_file.exists() {
                        let _ = fs::write(&hint_file, b"1");
                        notify(&wh, texts().in_tray);
                    }
                }
                WindowEvent::Focused(_) => sync_autostart(&wh),
                _ => {}
            });

            // ---- трей ----
            let open = MenuItem::with_id(app, "open", t.open, true, None::<&str>)?;
            let copy = MenuItem::with_id(app, "copy_obs", t.copy_obs, true, None::<&str>)?;
            let switch = MenuItem::with_id(app, "switch_role", t.switch_role, true, None::<&str>)?;
            let auto_on = handle.autolaunch().is_enabled().unwrap_or(false);
            let auto = CheckMenuItem::with_id(app, "autostart", t.autostart, true, auto_on, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", t.quit, true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &copy, &switch, &sep1, &auto, &sep2, &quit_item])?;
            app.manage(TrayItems { autostart: auto });

            TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(include_bytes!("../icons/64x64.png"))?)
                .tooltip("Hudini")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().0.as_str() {
                    "open" => show_main(app),
                    "copy_obs" => copy_obs_link(app),
                    "switch_role" => {
                        let app = app.clone();
                        thread::spawn(move || to_start_page(&app));
                    }
                    "autostart" => {
                        let al = app.autolaunch();
                        let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
                        sync_autostart(app);
                    }
                    "quit" => quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                        show_main(tray.app_handle());
                    }
                    TrayIconEvent::Click { .. } | TrayIconEvent::Enter { .. } => sync_autostart(tray.app_handle()),
                    _ => {}
                })
                .build(app)?;

            // ---- сервер ----
            if auto_streamer {
                set_loading(&handle, t.starting, false);
                if let Err(e) = spawn_server(&handle, ROLE_STREAMER) {
                    set_loading(&handle, &e, true);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Hudini")
        .run(|app, event| match event {
            // окно только прячется, поэтому сама программа без окон не выходит — только через «Выйти»
            RunEvent::ExitRequested { api, code: None, .. } => {
                if !app.state::<Server>().quitting.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
            // выход, о котором попросили мы сами (меню трея, обновление, система): сервер, который умрёт при этом, крашем не считается
            RunEvent::ExitRequested { code: Some(_), .. } => app.state::<Server>().quitting.store(true, Ordering::SeqCst),
            RunEvent::Exit => {
                applog("exit");
                stop_server(app)
            }
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main(app),
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::browser_url;

    #[test]
    fn browser_url_refuses_local_addresses() {
        for bad in [
            "http://127.0.0.1:7777/", "http://2130706433/", "http://0x7f.1/", "http://127.1/", "http://0/", "http://0.0.0.0/", "http://127.0.0.1./",
            "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::127.0.0.1]/", "http://[0:0:0:0:0:ffff:7f00:1]/",
            "http://localhost/", "http://LOCALHOST/", "http://localhost./", "http://a.localhost./", "http://tauri.localhost/app/start.html", "https://tauri.localhost/app/start.html",
            "http://10.1.2.3/", "http://172.16.0.1/", "http://172.31.255.255/", "http://192.168.1.1/", "http://169.254.169.254/", "http://100.64.0.1/",
            "http://100.127.255.255/", "http://[fe80::1]/", "http://[fd00::1]/", "http://[fc00::1]/", "http://[::ffff:192.168.0.1]/",
            "file:///C:/Windows/", "javascript:alert(1)",
        ] {
            assert!(browser_url(bad).is_err(), "{bad} must be refused");
        }
        for good in ["https://www.twitch.tv/popout/x/chat?popout=", "http://example.com/", "https://172.32.0.1/", "https://100.128.0.1/", "https://8.8.8.8/", "https://[2001:db8::1]/"] {
            assert!(browser_url(good).is_ok(), "{good} must pass");
        }
    }
}
