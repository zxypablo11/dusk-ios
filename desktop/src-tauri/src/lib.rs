mod discord;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxyRequest {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyResponse {
    status: u16,
    headers: HashMap<String, String>,
    body_base64: String,
}

#[tauri::command]
async fn proxy_fetch(req: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut builder = client.request(method, &req.url);
    for (k, v) in &req.headers {
        // Hop-by-hop / forbidden browser headers are fine from Rust.
        if k.eq_ignore_ascii_case("host") || k.eq_ignore_ascii_case("content-length") {
            continue;
        }
        builder = builder.header(k, v);
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let mut headers = HashMap::new();
    for (k, v) in response.headers().iter() {
        let name = k.as_str();
        if name.eq_ignore_ascii_case("content-encoding")
            || name.eq_ignore_ascii_case("transfer-encoding")
            || name.eq_ignore_ascii_case("content-length")
            || name.eq_ignore_ascii_case("connection")
            || name.eq_ignore_ascii_case("set-cookie")
        {
            continue;
        }
        if let Ok(val) = v.to_str() {
            headers.insert(name.to_string(), val.to_string());
        }
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(ProxyResponse {
        status,
        headers,
        body_base64: B64.encode(bytes),
    })
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)
        .ok_or_else(|| "missing window".to_string())?
        .minimize()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(app: AppHandle) -> Result<(), String> {
    let win = main_window(&app).ok_or_else(|| "missing window".to_string())?;
    if win.is_maximized().unwrap_or(false) {
        win.unmaximize().map_err(|e| e.to_string())
    } else {
        win.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)
        .ok_or_else(|| "missing window".to_string())?
        .close()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_text_file_dialog(
    app: AppHandle,
    default_name: String,
    contents: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Text", &["txt", "json", "m3u", "m3u8"])
        .blocking_save_file();
    let Some(file) = path else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn discord_presence_update(track: discord::TrackPresence) -> Result<(), String> {
    discord::set_presence(track)
}

#[tauri::command]
fn discord_presence_clear() -> Result<(), String> {
    discord::clear_presence()
}

#[tauri::command]
fn read_dir_size(path: String) -> Result<u64, String> {
    fn walk(p: &std::path::Path) -> std::io::Result<u64> {
        let mut total = 0u64;
        if p.is_file() {
            return Ok(p.metadata()?.len());
        }
        if p.is_dir() {
            for entry in std::fs::read_dir(p)? {
                let entry = entry?;
                total = total.saturating_add(walk(&entry.path())?);
            }
        }
        Ok(total)
    }
    walk(std::path::Path::new(&path)).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            proxy_fetch,
            minimize_window,
            maximize_window,
            close_window,
            app_version,
            get_data_dir,
            open_external,
            write_text_file,
            save_text_file_dialog,
            read_dir_size,
            discord_presence_update,
            discord_presence_clear
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dusk desktop");
}
