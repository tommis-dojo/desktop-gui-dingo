// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Moin {}! Gruß von Rust!", name)
}

use tokio::time::{sleep, Duration};

#[tauri::command]
async fn long_callback() -> () {
    sleep(Duration::from_millis(600)).await;
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, long_callback])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
