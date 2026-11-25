// Команды приложения для страниц из пакета (экран роли, пульт). Страница управления с сервера (http://127.0.0.1)
// получает по capabilities/remote.json только автозапуск, поэтому этих команд вызвать не может.
const COMMANDS: &[&str] = &["app_state", "start_role", "set_remember", "set_lang", "apply_update", "store_load", "store_save", "relay_open", "relay_close", "relay_status", "app_log", "open_logs", "open_data", "crash_dismiss", "browser_open", "browser_place", "browser_visible", "browser_close", "browser_nav", "panel_key", "media_support"];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)))
        .expect("failed to run tauri-build");
}
