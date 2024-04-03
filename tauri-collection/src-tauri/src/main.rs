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

#[tauri::command]
async fn present_array() -> Vec<Vec<String>> {
    let mut v: Vec<Vec<String>> = Vec::new();

    for n in 1..10 {
        let left = n.to_string();
        let right = (-n).to_string();
        let item = vec![left, right];
        v.push(item);
    }
    v
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            long_callback,
            present_array
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
