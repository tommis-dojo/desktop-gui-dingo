/// Interface to database
///
/// Think also: interface to file system.
/// Interface to rabbitmq.
///
/// => Traits
///
/// Common things separate.
use std::fmt;

use tokio::select;
use tokio_util::sync::CancellationToken;

use tauri::State;

/// Several things:
///
/// * connection (a reference)
/// * info_query (none -> database, database -> tables)
/// * data_query (database, table, filter)
/// * custom_query (SELECT statement)
///
/// Connection is used to route the query to the correct handler
/// Query-ID is used to route the answer to the correct user
/// Both are ignored for now
///

pub mod types {
    use serde::{Deserialize, Serialize};
    use tokio::sync::mpsc;
    use tokio::sync::Mutex;

    /*
    #[derive(Debug, Deserialize, Serialize)]
    enum DatabaseQuery {
        GetDatabases,
        GetTables(String),
    }
    */

    #[derive(Debug, Deserialize, Serialize)]
    pub struct LocationInfo {
        pub location_info: String,
    }

    #[derive(Debug, Deserialize, Serialize)]
    pub struct DatabasePath {
        pub connection_string: Option<String>,
        pub database: Option<String>,
        pub table: Option<String>,
    }

    pub type StringTable = Vec<Vec<String>>;

    pub struct StateHalfpipeToDb {
        pub inner: Mutex<mpsc::Sender<DatabasePath>>,
    }

    impl StateHalfpipeToDb {
        pub fn from(sender_to_db: mpsc::Sender<DatabasePath>) -> StateHalfpipeToDb {
            StateHalfpipeToDb {
                inner: Mutex::new(sender_to_db),
            }
        }
    }

    pub struct StateHalfpipeToTauri {
        pub inner: Mutex<mpsc::Receiver<StringTable>>,
    }

    impl StateHalfpipeToTauri {
        pub fn from(receiver_from_db: mpsc::Receiver<StringTable>) -> StateHalfpipeToTauri {
            StateHalfpipeToTauri {
                inner: Mutex::new(receiver_from_db),
            }
        }
    }

    pub type PathReceiver = mpsc::Receiver<DatabasePath>;
    pub type StringTableSender = mpsc::Sender<StringTable>;
}

fn suggest_connection_str() -> Option<String> {
    Some(format!("host=localhost user={}", whoami::username()))
}

pub mod commands {
    use super::*;

    /// Return a path and a name for the location to be used as "home"
    ///
    #[tauri::command]
    pub async fn suggest_path() -> (types::LocationInfo, types::DatabasePath) {
        let username = whoami::username();
        let hostname = gethostname::gethostname();
        let hostname = match hostname.to_str() {
            Some(s) => s,
            None => "<unknown host>",
        };

        (
            types::LocationInfo {
                location_info: format!("{}@{}", username, hostname),
            },
            types::DatabasePath {
                connection_string: suggest_connection_str(),
                database: None,
                table: None,
            },
        )
    }

    #[tauri::command]
    pub async fn db_query(
        query: types::DatabasePath, // DatabaseQuery,
        // query_sub: String,
        to_db: State<'_, types::StateHalfpipeToDb>,
        from_db: State<'_, types::StateHalfpipeToTauri>,
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
}

fn get_connection_string(db_path: &types::DatabasePath) -> Option<String> {
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

/// Extract string from given column of row
fn get_field_from_row(row: &tokio_postgres::Row, index: usize) -> &str {
    let s: Result<&str, tokio_postgres::Error> = row.try_get(index);
    match s {
        Ok(s_) => s_,
        Err(_) => "?",
    }
}

/// Print debug output of rows
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

/// Convert row to vector of str
fn row_to_str(row: &tokio_postgres::Row) -> Vec<&str> {
    (0..row.len())
        .into_iter()
        .map(|index| get_field_from_row(row, index))
        .collect()
}

/// Shorthand to convert vector of str slices to strings
///
/// Surely there is a more idiomatic way to do this?
///
fn vec_str_to_strings(strings: Vec<&str>) -> Vec<String> {
    strings.into_iter().map(|s| String::from(s)).collect()
}

/// Connect to database and run single query
///
async fn run_query(
    connection_str: String,
    query: String,
) -> Result<types::StringTable, Box<dyn std::error::Error + Send + Sync>> {
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

/// Standalone task that handles database requests and returns responses
///
pub async fn db_task(
    mut channel_to_db_rx: types::PathReceiver,
    channel_to_tauri_tx: types::StringTableSender,
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
