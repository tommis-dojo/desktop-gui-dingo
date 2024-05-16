// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// See https://rfdonnelly.github.io/posts/tauri-async-rust-process/

use tauri::State;
use tokio::sync::mpsc;
use tokio::sync::Mutex;

use tokio::select;
use tokio_postgres;
use tokio_util::sync::CancellationToken;
use whoami;

#[derive(Debug)]
enum DatabaseQuery {
    GetDatabases = 1,
    GetTables = 2,
}

struct TauriToDb {
    inner: Mutex<mpsc::Sender<DatabaseQuery>>,
}
struct DbToTauri {
    inner: Mutex<mpsc::Receiver<Vec</*tokio_postgres::Row*/ String>>>,
}

#[tauri::command]
async fn present_array(
    to_db: State<'_, TauriToDb>,
    from_db: State<'_, DbToTauri>,
) -> Result<Vec<Vec<String>>, String> {
    println!("Called: present_array");
    {
        let sender = to_db.inner.lock().await;
        match sender.send(DatabaseQuery::GetDatabases).await {
            Ok(_) => {
                println!("present_array: sent to -> to_db");
            }
            Err(_) => {
                println!("present_array: error sending to -> to_db");
                return Err(String::from("Error send db query"));
            }
        }
    }
    {
        println!("present_array: waiting to receive <- from_db");
        let mut receiver = from_db.inner.lock().await;
        println!("present_array: receiver lock acquired");

        println!("present_array: waiting to receive something");
        if let Some(we) = receiver.recv().await {
            println!("present_array: received {} rows", we.len());
            let table = we
                .into_iter()
                .map(|s| vec![s, String::from("dummy")])
                .collect();
            return Ok(table);
        } else {
            println!("present_array: error while receiving");

            Err(String::from("Error receive db query"))
        }
    }
}

async fn query_databases() -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
    let connection_str: String = format!("host=localhost user={}", whoami::username());
    let (client, connection) =
        tokio_postgres::connect(&connection_str, tokio_postgres::NoTls).await?;

    let token = CancellationToken::new();
    let cloned_token = token.clone();

    let db_connector_handle = tokio::spawn(async move {
        select! {
            _ = cloned_token.cancelled() => {}
            _ = connection => {}
        }
    });
    let q: &str = "SELECT datname FROM pg_database;"; // "SELECT $1::TEXT", &[&"hello world"]
    let rows = client.query(q, &[]).await?;
    token.cancel();
    db_connector_handle.await?;
    println!("number of databases found: {}", rows.len());

    let vec: Vec<String> = rows.iter().map(|row| row.get(0)).collect();
    Ok(vec)
}

#[derive(Debug)]
struct WhateverError {}

async fn db_task(
    _s: String,
    mut channel_tauri_to_db_rx: mpsc::Receiver<DatabaseQuery>,
    channel_db_to_tauri_tx: mpsc::Sender<Vec<String>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("Starting db task");
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    println!("Finish db task");

    println!("db task : waiting for message on receiver");
    while let Some(message) = channel_tauri_to_db_rx.recv().await {
        println!("Received message: {:?}", message);

        match message {
            DatabaseQuery::GetDatabases => match query_databases().await {
                Ok(database_names) => {
                    if let Err(_) = channel_db_to_tauri_tx.send(database_names).await {
                        return Ok(());
                    }
                }
                Err(_) => {}
            },
            DatabaseQuery::GetTables => {}
        }
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send>> {
    // query_databases().await?;

    // Channels for communication between db task and tauri task
    let (channel_db_to_tauri_tx, channel_db_to_tauri_rx) = mpsc::channel::<Vec<String>>(1);
    let (channel_tauri_to_db_tx, channel_tauri_to_db_rx) = mpsc::channel::<DatabaseQuery>(1);

    let s = String::from("teststring");

    tokio::spawn(db_task(s, channel_tauri_to_db_rx, channel_db_to_tauri_tx));

    println!("Spawned channel receiver");

    tauri::async_runtime::set(tokio::runtime::Handle::current());

    let res = tauri::Builder::default()
        .manage(TauriToDb {
            inner: Mutex::new(channel_tauri_to_db_tx),
        })
        .manage(DbToTauri {
            inner: Mutex::new(channel_db_to_tauri_rx),
        })
        .invoke_handler(tauri::generate_handler![present_array])
        .run(tauri::generate_context!());

    match res {
        Ok(_) => Ok(()),
        Err(_) => Ok((/* I simply do not know how to create an error here */)),
    }
}
