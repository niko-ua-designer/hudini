// Hudini Host: окно, иконка в трее и автозапуск поверх сервера оверлея (host/server.js).
// Сервер собран Bun в один файл и лежит рядом с программой (hudini-server, sidecar).
// Связь: сервер пишет в stdout «READY <порт>», «RESTART», «FAIL …»; программа пишет в его stdin «VISIBLE 0/1».
// Программа закрылась или упала → stdin сервера закрывается → сервер выключается сам.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU32, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::window::Color;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";
const MODERATOR_URL: &str = "https://niko-ua-designer.github.io/hudini/moderator.html";
const MINIMIZED_ARG: &str = "--minimized";
#[cfg(windows)]
const SERVER_BIN: &str = "hudini-server.exe";
#[cfg(not(windows))]
const SERVER_BIN: &str = "hudini-server";
#[cfg(windows)]
const LOADING_URL: &str = "http://tauri.localhost/index.html";
#[cfg(not(windows))]
const LOADING_URL: &str = "tauri://localhost/index.html";

// ---------- тексты меню и уведомлений: язык системы ----------
struct Texts {
    open: &'static str,
    copy_obs: &'static str,
    moderator: &'static str,
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
    open: "Открыть Hudini Host",
    copy_obs: "Копировать ссылку для OBS",
    moderator: "Открыть пульт модератора",
    autostart: "Запускать вместе с системой",
    quit: "Выйти",
    starting: "Запускаю сервер оверлея…",
    in_tray: "Hudini Host продолжает работать в трее. Выйти можно через меню иконки.",
    copied: "Ссылка для OBS скопирована: вставь её в источник «Браузер».",
    no_link: "Ссылки для OBS ещё нет: вставь в программу ссылку от модератора.",
    not_ready: "Сервер ещё запускается, попробуй через пару секунд.",
    crashed: "Сервер оверлея остановился. Перезапускаю…",
    port_busy: "Порт {port} занят: наверное, запущена старая версия Hudini Host (чёрное окно). Закрой её, программа подключится сама.",
    no_server: "Не нашёл файл сервера рядом с программой:",
    saved: "Файл сохранён в «Загрузки»",
};
static UK: Texts = Texts {
    open: "Відкрити Hudini Host",
    copy_obs: "Копіювати посилання для OBS",
    moderator: "Відкрити пульт модератора",
    autostart: "Запускати разом із системою",
    quit: "Вийти",
    starting: "Запускаю сервер оверлею…",
    in_tray: "Hudini Host продовжує працювати в треї. Вийти можна через меню іконки.",
    copied: "Посилання для OBS скопійовано: встав його в джерело «Браузер».",
    no_link: "Посилання для OBS ще немає: встав у програму посилання від модератора.",
    not_ready: "Сервер ще запускається, спробуй за кілька секунд.",
    crashed: "Сервер оверлею зупинився. Перезапускаю…",
    port_busy: "Порт {port} зайнятий: мабуть, запущена стара версія Hudini Host (чорне вікно). Закрий її, програма підключиться сама.",
    no_server: "Не знайшов файл сервера поруч із програмою:",
    saved: "Файл збережено в «Завантаження»",
};
static DE: Texts = Texts {
    open: "Hudini Host öffnen",
    copy_obs: "OBS-Link kopieren",
    moderator: "Moderatoren-Panel öffnen",
    autostart: "Mit dem System starten",
    quit: "Beenden",
    starting: "Overlay-Server wird gestartet…",
    in_tray: "Hudini Host läuft im Infobereich weiter. Beenden über das Menü des Symbols.",
    copied: "OBS-Link kopiert: füge ihn in die Quelle „Browser“ ein.",
    no_link: "Noch kein OBS-Link: füge zuerst den Link vom Moderator im Programm ein.",
    not_ready: "Der Server startet noch, versuch es in ein paar Sekunden.",
    crashed: "Der Overlay-Server wurde beendet. Starte neu…",
    port_busy: "Port {port} ist belegt: vermutlich läuft noch die alte Version von Hudini Host (schwarzes Fenster). Schließ sie, das Programm verbindet sich dann selbst.",
    no_server: "Server-Datei neben dem Programm nicht gefunden:",
    saved: "Datei in „Downloads“ gespeichert",
};
static EN: Texts = Texts {
    open: "Open Hudini Host",
    copy_obs: "Copy OBS link",
    moderator: "Open moderator panel",
    autostart: "Start with system",
    quit: "Quit",
    starting: "Starting the overlay server…",
    in_tray: "Hudini Host keeps running in the tray. Quit from the tray icon menu.",
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

#[derive(Default)]
struct Server {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    port: AtomicU16,
    quitting: AtomicBool,
    crashes: AtomicU32,
    // что показать на странице загрузки, когда она откроется: (текст, ошибка)
    pending: Mutex<(String, bool)>,
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

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    say(app, "VISIBLE 1");
}

fn hide_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
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
    let _ = app.notification().builder().title("Hudini Host").body(body).show();
}

// ---------- страница загрузки ----------
fn set_loading(app: &AppHandle, text: &str, error: bool) {
    let server = app.state::<Server>();
    *server.pending.lock().unwrap() = (text.to_string(), error);
    let Some(w) = app.get_webview_window(MAIN) else { return };
    let on_loading_page = w.url().map(|u| is_loading_url(&u)).unwrap_or(false);
    if on_loading_page {
        let js = format!("window.hudiniState&&hudiniState({},{})", serde_json::to_string(text).unwrap_or_default(), error);
        let _ = w.eval(&js);
    } else if let Ok(url) = Url::parse(LOADING_URL) {
        let _ = w.navigate(url); // текст подставит on_page_load
    }
}

fn is_loading_url(u: &Url) -> bool {
    u.scheme() == "tauri" || u.host_str() == Some("tauri.localhost")
}

fn is_server_url(u: &Url) -> bool {
    u.scheme() == "http" && matches!(u.host_str(), Some("localhost") | Some("127.0.0.1"))
}

// ---------- сервер (sidecar) ----------
fn spawn_server(app: &AppHandle) -> Result<(), String> {
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
    *server.stdin.lock().unwrap() = child.stdin.take();
    *server.child.lock().unwrap() = Some(child);
    // окно спрятано (автозапуск) → сервер знает об этом и после обновления запустит программу тоже в трее
    let hidden = app.get_webview_window(MAIN).and_then(|w| w.is_visible().ok()).map(|v| !v).unwrap_or(false);
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
    thread::spawn(move || read_server(app, stdout));
    Ok(())
}

fn read_server(app: AppHandle, out: ChildStdout) {
    let mut restart = false;
    let mut fail = String::new();
    // stdout читаем до конца: если перестать, сервер заблокируется на записи в журнал
    for chunk in BufReader::new(out).split(b'\n') {
        let Ok(bytes) = chunk else { break };
        let line = String::from_utf8_lossy(&bytes);
        let line = line.trim();
        if let Some(p) = line.strip_prefix("READY ") {
            if let Ok(port) = p.trim().parse::<u16>() {
                on_ready(&app, port);
            }
        } else if line == "RESTART" {
            restart = true;
        } else if let Some(f) = line.strip_prefix("FAIL ") {
            fail = f.to_string();
        }
    }
    let server = app.state::<Server>();
    let child = server.child.lock().unwrap().take();
    if let Some(mut c) = child {
        let _ = c.wait();
    }
    *server.stdin.lock().unwrap() = None;
    server.port.store(0, Ordering::SeqCst);
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
    if server.quitting.load(Ordering::SeqCst) {
        return;
    }
    if let Err(e) = spawn_server(&app) {
        set_loading(&app, &e, true);
    }
}

fn on_ready(app: &AppHandle, port: u16) {
    let server = app.state::<Server>();
    server.port.store(port, Ordering::SeqCst);
    server.crashes.store(0, Ordering::SeqCst);
    if let (Some(w), Ok(url)) = (app.get_webview_window(MAIN), Url::parse(&format!("http://localhost:{port}/"))) {
        let _ = w.navigate(url);
    }
}

// Закрыть stdin → сервер снимает объявление для пульта и выходит сам; если не вышел за 2 с, убиваем
fn stop_server(app: &AppHandle) {
    let server = app.state::<Server>();
    server.quitting.store(true, Ordering::SeqCst);
    server.stdin.lock().unwrap().take();
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

fn quit(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        stop_server(&app);
        app.exit(0);
    });
}

// ---------- ссылка для OBS из /api/status ----------
fn fetch_status(port: u16) -> Result<serde_json::Value, String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).map_err(|e| e.to_string())?;
    let _ = s.set_read_timeout(Some(Duration::from_secs(3)));
    // Host 127.0.0.1:<порт>: сервер отвечает только своему адресу (защита от DNS-rebinding)
    write!(s, "GET /api/status HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").map_err(|e| e.to_string())?;
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
        let link = fetch_status(port).ok().and_then(|s| s.get("obsLink").and_then(|v| v.as_str()).map(String::from)).unwrap_or_default();
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
        .setup(move |app| {
            let handle = app.handle().clone();
            let exe = std::env::current_exe()?;
            let data = data_dir(&handle, &exe);
            app.manage(Paths { exe, data: data.clone() });
            let t = texts();

            // ---- окно ----
            let nav = handle.clone();
            let popup = handle.clone();
            let dl = handle.clone();
            let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
                .title("Hudini Host")
                .inner_size(980.0, 760.0)
                .min_inner_size(720.0, 520.0)
                .center()
                .visible(!start_hidden)
                .background_color(Color(0x0f, 0x11, 0x15, 0xff))
                // в окне только страница загрузки и страница управления; остальные ссылки — в обычном браузере
                .on_navigation(move |url| {
                    if is_loading_url(url) || is_server_url(url) || matches!(url.scheme(), "about" | "data" | "blob") {
                        return true;
                    }
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = nav.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .on_new_window(move |url, _features| {
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = popup.opener().open_url(url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                // «Скачать файл вручную» (файл для CS2) → в папку «Загрузки»
                .on_download(move |_webview, event| {
                    match event {
                        DownloadEvent::Requested { url, destination } => {
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
                    if payload.event() == PageLoadEvent::Finished && is_loading_url(payload.url()) {
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
            let panel = MenuItem::with_id(app, "moderator", t.moderator, true, None::<&str>)?;
            let auto_on = handle.autolaunch().is_enabled().unwrap_or(false);
            let auto = CheckMenuItem::with_id(app, "autostart", t.autostart, true, auto_on, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", t.quit, true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &copy, &panel, &sep1, &auto, &sep2, &quit_item])?;
            app.manage(TrayItems { autostart: auto });

            TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(include_bytes!("../icons/64x64.png"))?)
                .tooltip("Hudini Host")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().0.as_str() {
                    "open" => show_main(app),
                    "copy_obs" => copy_obs_link(app),
                    "moderator" => {
                        let _ = app.opener().open_url(MODERATOR_URL, None::<&str>);
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
            set_loading(&handle, t.starting, false);
            if let Err(e) = spawn_server(&handle) {
                set_loading(&handle, &e, true);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Hudini Host")
        .run(|app, event| match event {
            // окно только прячется, поэтому сама программа без окон не выходит — только через «Выйти»
            RunEvent::ExitRequested { api, code: None, .. } => {
                if !app.state::<Server>().quitting.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
            RunEvent::Exit => stop_server(app),
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main(app),
            _ => {}
        });
}
