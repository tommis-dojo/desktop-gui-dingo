// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// See https://rfdonnelly.github.io/posts/tauri-async-rust-process/

use tokio::sync::mpsc;

mod db;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send>> {
    // Channels for communication between db task and tauri task

    // To the outside, I just want a db task that accepts messages via channel.
    // It will communicate back via channel.

    // The frontend function call will send a message on a channel,
    // and use the result.

    let (channel_to_tauri_tx, channel_to_tauri_rx) =
        mpsc::channel::<db::types::DatabaseQueryResult>(1);
    let (channel_to_db_tx, channel_to_db_rx) = mpsc::channel::<db::types::FullQuery>(1);

    tokio::spawn(db::db_task(channel_to_db_rx, channel_to_tauri_tx));

    tauri::async_runtime::set(tokio::runtime::Handle::current());
    let res = tauri::Builder::default()
        .manage(db::types::StateHalfpipeToDb::from(channel_to_db_tx))
        .manage(db::types::StateHalfpipeToTauri::from(channel_to_tauri_rx))
        .invoke_handler(tauri::generate_handler![
            db::commands::db_query,
            db::commands::suggest_query,
            db::commands::test_connection_string
        ])
        .run(tauri::generate_context!());

    match res {
        Ok(_) => Ok(()),
        Err(_) => Ok((/* I simply do not know how to create an error here */)),
    }
}
