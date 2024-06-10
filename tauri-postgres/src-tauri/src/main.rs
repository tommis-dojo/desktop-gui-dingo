// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// See https://rfdonnelly.github.io/posts/tauri-async-rust-process/

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::mpsc;
use tokio::sync::Mutex;

use gethostname;
use tokio::select;
use tokio_postgres;
use tokio_util::sync::CancellationToken;
use whoami;

/*
#[derive(Debug, Deserialize, Serialize)]
enum DatabaseQuery {
    GetDatabases,
    GetTables(String),
}
*/

struct TauriToDb {
    inner: Mutex<mpsc::Sender<DatabasePath>>,
}
struct DbToTauri {
    inner: Mutex<mpsc::Receiver<Vec<Vec<String>>>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct LocationInfo {
    location_info: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct DatabasePath {
    connection_string: Option<String>,
    database: Option<String>,
    table: Option<String>,
}

fn suggest_connection_str() -> Option<String> {
    Some(format!("host=localhost user={}", whoami::username()))
}

/// Return a path and a name for the location to be used as "home"
///
#[tauri::command]
async fn suggest_path() -> (LocationInfo, DatabasePath) {
    let username = whoami::username();
    let hostname = gethostname::gethostname();
    let hostname = match hostname.to_str() {
        Some(s) => s,
        None => "<unknown host>",
    };

    (
        LocationInfo {
            location_info: format!("{}@{}", username, hostname),
        },
        DatabasePath {
            connection_string: suggest_connection_str(),
            database: None,
            table: None,
        },
    )
}

#[tauri::command]
async fn db_query(
    query: DatabasePath, // DatabaseQuery,
    // query_sub: String,
    to_db: State<'_, TauriToDb>,
    from_db: State<'_, DbToTauri>,
) -> Result<Vec<Vec<String>>, String> {
    println!("Called: db_query");
    {
        let sender = to_db.inner.lock().await;

        match sender.send(query).await {
            Ok(_) => {}
            Err(_) => {
                return Err(String::from("Error send db query to db task"));
            }
        }
    }
    {
        let mut receiver = from_db.inner.lock().await;
        if let Some(table) = receiver.recv().await {
            println!("db_query: received {} rows", table.len());
            return Ok(table);
        } else {
            Err(String::from(
                "db_query: Error receiving response to db query",
            ))
        }
    }
}

fn get_connection_string(db_path: &DatabasePath) -> Option<String> {
    match &db_path.connection_string {
        None => None,
        Some(connection_str) => {
            let connection_orig = String::from(connection_str);
            let connection_mod = match &db_path.database {
                Some(dbname) => format!("{} dbname={}", connection_orig, dbname),
                None => String::from(connection_orig),
            };
            Some(connection_mod)
        }
    }
}

fn get_field_from_row(row: &tokio_postgres::Row, index: usize) -> &str {
    let s: Result<&str, tokio_postgres::Error> = row.try_get(index);
    match s {
        Ok(s_) => s_,
        Err(_) => "?",
    }
}

fn debug_rows(rows: &Vec<tokio_postgres::Row>) {
    println!("number of rows in result: {}", rows.len());

    for row in rows.iter() {
        print!("# {}: ", row.len());
        for i in 0..row.len() {
            print!(" {}", get_field_from_row(row, i));
        }
        println!("");
    }
}

fn row_to_str(row: &tokio_postgres::Row) -> Vec<&str> {
    (0..row.len())
        .into_iter()
        .map(|index| get_field_from_row(row, index))
        .collect()
}

fn vec_str_to_strings(strings: Vec<&str>) -> Vec<String> {
    strings.into_iter().map(|s| String::from(s)).collect()
}

async fn run_query(
    connection_str: String,
    query: String,
) -> Result<Vec<Vec<String>>, Box<dyn std::error::Error + Send + Sync>> {
    println!("Connection-String: \"{}\"", connection_str);
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
    println!("Query: \"{}\"", query);
    let rows = client.query(&query, &[]).await?;
    token.cancel();
    db_connector_handle.await?;

    debug_rows(&rows);

    let vecs: Vec<Vec<String>> = rows
        .into_iter()
        .map(|row| vec_str_to_strings(row_to_str(&row)))
        .collect();
    Ok(vecs)
}

use std::fmt;
use std::usize;

struct WhateverError {}

impl fmt::Debug for WhateverError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{{ file: {}, line: {} }}", file!(), line!()) // programmer-facing output
    }
}

impl fmt::Display for WhateverError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "An Error Occurred, Please Try Again!") // user-facing output
    }
}

impl std::error::Error for WhateverError {
    fn description(&self) -> &str {
        "WhateverError Platzhalter Beschreibung"
    }
}

async fn db_task(
    mut channel_to_db_rx: mpsc::Receiver<DatabasePath>,
    channel_to_tauri_tx: mpsc::Sender<Vec<Vec<String>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    while let Some(db_path) = channel_to_db_rx.recv().await {
        println!("Received db_path: {:?}", db_path);

        // We receive a path.
        // Depending on that, we decide upon an action, for instance query
        // available databases or tables belonging to a database.

        // For now, we will trust the path given.

        let err = WhateverError {};
        let connection_str = get_connection_string(&db_path).ok_or(err)?;

        // If no database is given, query databases
        // If database is given, query tables in database
        //
        // Note at this point the desired database is already contained inside
        // the connection_str.
        let query = String::from(match db_path.database {
            Some(_) => {
                match db_path.table {
                    Some(table) =>
                    /* Query Table Contents */
                    {
                        format!("SELECT * FROM {};", table)
                    }
                    None =>
                    /* Query Tables */
                    {
                        String::from(
                            "SELECT table_name 
                    FROM information_schema.tables
                    WHERE table_schema = 'public';",
                        )
                    }
                }
            }
            None =>
            /* Query Databases */
            {
                String::from("SELECT datname FROM pg_database;")
            }
        });

        let rows = run_query(connection_str, query).await;
        match rows {
            Ok(rows) => {
                if let Err(_) = channel_to_tauri_tx.send(rows).await {
                    return Ok(());
                }
            }
            Err(_) => {}
        }
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send>> {
    // Channels for communication between db task and tauri task

    // To the outside, I just want a db task that accepts messages via channel.
    // It will communicate back via channel.

    // The frontend function call will send a message on a channel,
    // and use the result.

    let (channel_to_tauri_tx, channel_to_tauri_rx) = mpsc::channel::<Vec<Vec<String>>>(1);
    let (channel_to_db_tx, channel_to_db_rx) = mpsc::channel::<DatabasePath>(1);

    tokio::spawn(db_task(channel_to_db_rx, channel_to_tauri_tx));

    tauri::async_runtime::set(tokio::runtime::Handle::current());
    let res = tauri::Builder::default()
        .manage(TauriToDb {
            inner: Mutex::new(channel_to_db_tx),
        })
        .manage(DbToTauri {
            inner: Mutex::new(channel_to_tauri_rx),
        })
        .invoke_handler(tauri::generate_handler![db_query, suggest_path])
        .run(tauri::generate_context!());

    match res {
        Ok(_) => Ok(()),
        Err(_) => Ok((/* I simply do not know how to create an error here */)),
    }
}
