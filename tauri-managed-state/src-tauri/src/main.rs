// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::State;
use std::sync::Mutex;

struct Counter {
    count: Mutex<i32>,
}

#[tauri::command]
fn greet(name: &str, state: State<Counter>) -> String {
    let mut counter = state.count.lock().unwrap();
    *counter += 1;

    format!("Moin {}! Gruß von Rust! Number of greetings: {}", name, *counter)
}

#[tauri::command]
fn count(state: State<Counter>) -> i32 {
    let counter = state.count.lock().unwrap();
    *counter
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tauri::async_runtime::set(tokio::runtime::Handle::current());

    let res = tauri::Builder::default()
    .manage(Counter { count: Mutex::new(0) })
    .invoke_handler(tauri::generate_handler![
        greet,
        count
    ]).run(tauri::generate_context!());
    res?;

    Ok(())
}
