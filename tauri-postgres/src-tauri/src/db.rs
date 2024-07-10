/// Interface to database
///
/// Think also: interface to file system.
/// Interface to rabbitmq.
///
/// => Traits
///
/// Common things separate.
use tauri::State;
use tokio::select;
use tokio_postgres::types::Type;
use tokio_util::sync::CancellationToken;
use types::{BasicTextField, BasicTextTable, TypedField};

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

/** Thoughts on being stateful:
 *
 * keep selected things in mind (connection, database, table) - not rest
 *
 * Regarding position in breadcrumbs
 *
 * 1. specify desired position -> communicate that to backend
 * 2. afterwards, from position decide next default action  -> run query
 *
 * Example structure:
 *
 *       pub enum StatefulQuery {
 *           Connect(String),
 *           GetDatabases,
 *           SelectDatabase(String),
 *           GetTables,
 *           SetTable(String),
 *           GetTableContents,
 *       }
 *
 * pub enum DatabaseQuery {
 *          ConsecutiveQuery(StatefulQuery),
 *          OneShot(DatabasePath)
 * }
 *
 */

pub mod types {
    use serde::{Deserialize, Serialize};
    use std::fmt;
    use tokio::sync::mpsc;
    use tokio::sync::Mutex;

    pub type SomeDatabase = String;
    pub type SomeTable = String;

    #[derive(Debug, Deserialize, Serialize)]
    pub enum Connection {
        Stateless(String),
    }

    #[derive(Debug, Deserialize, Serialize, Clone)]
    pub struct DatabaseTable {
        pub database: Option<SomeDatabase>,
        pub table: SomeTable,
    }

    #[derive(Debug, Deserialize, Serialize)]
    pub enum Query {
        GetDatabases,
        GetTables(Option<SomeDatabase>),
        GetTableContents(DatabaseTable),
    }

    impl Query {
        pub fn get_mentioned_database(&self) -> Option<SomeDatabase> {
            match self {
                Self::GetDatabases => None,
                Self::GetTables(opt_db) => opt_db.clone(),
                Self::GetTableContents(db_table) => db_table.database.clone(),
            }
        }

        pub fn get_query_string(&self) -> String {
            match self {
                Self::GetDatabases => String::from("SELECT datname FROM pg_database;"),
                Self::GetTables(_) => String::from(
                    "SELECT table_name 
            FROM information_schema.tables
            WHERE table_schema = 'public';",
                ),
                Self::GetTableContents(db_and_table) => {
                    format!("SELECT * FROM {};", &db_and_table.table)
                }
            }
        }
    }

    #[derive(Debug, Deserialize, Serialize)]
    pub struct StatelessQuery {
        pub connection: Connection,
        pub query: Query,
    }

    #[derive(Debug, Deserialize, Serialize)]
    pub struct BasicTextField {
        pub text: String,
        pub column_index: usize,
    }
    pub struct BasicTextTable {
        pub columns: Vec<String>,
        pub fields: Vec<Vec<BasicTextField>>,
    }

    #[derive(Debug, Deserialize, Serialize)]
    pub enum TypedField {
        Text(String),
        Database(String),
        Table(String),
    }
    #[derive(Debug, Deserialize, Serialize)]
    pub struct TypedTable {
        pub columns: Vec<String>,
        pub fields: Vec<Vec<TypedField>>,
    }
    pub type TypedTableResult = Result<TypedTable, ()>;

    pub struct StateHalfpipeToDb {
        pub inner: Mutex<mpsc::Sender<StatelessQuery>>,
    }

    impl StateHalfpipeToDb {
        pub fn from(sender_to_db: mpsc::Sender<StatelessQuery>) -> StateHalfpipeToDb {
            StateHalfpipeToDb {
                inner: Mutex::new(sender_to_db),
            }
        }
    }

    pub struct StateHalfpipeToTauri {
        pub inner: Mutex<mpsc::Receiver<TypedTableResult>>,
    }

    impl StateHalfpipeToTauri {
        pub fn from(receiver_from_db: mpsc::Receiver<TypedTableResult>) -> StateHalfpipeToTauri {
            StateHalfpipeToTauri {
                inner: Mutex::new(receiver_from_db),
            }
        }
    }

    pub type DatabaseQueryReceiver = mpsc::Receiver<StatelessQuery>;
    pub type StringTableSender = mpsc::Sender<TypedTableResult>;

    #[derive(Deserialize, Serialize, Clone)]
    pub struct WhateverError {}

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
}

fn suggest_connection_str() -> String {
    format!("host=localhost user={}", whoami::username())
}

pub mod commands {

    use types::TypedTableResult;

    use super::*;

    #[tauri::command]
    pub async fn test_connection_string(connection_string: String) -> bool {
        run_check_connection(connection_string).await
    } 

    /// Return a path and a name for the location to be used as "home"
    ///
    #[tauri::command]
    pub async fn suggest_query() -> types::StatelessQuery {
        types::StatelessQuery {
            connection: types::Connection::Stateless(suggest_connection_str()),
            query: types::Query::GetDatabases, // Available:
                                               //
                                               // types::Query::GetDatabases
                                               // types::Query::GetTables(
                                               //     Some(String::from("myuser")))
                                               // types::Query::GetTableContents(
                                               //     types::DatabaseTable{
                                               //         database: Some(String::from("myuser")),
                                               //         table: String::from("sometable")})
        }
    }

    #[tauri::command]
    pub async fn db_query(
        query: types::StatelessQuery,
        to_db: State<'_, types::StateHalfpipeToDb>,
        from_db: State<'_, types::StateHalfpipeToTauri>,
    ) -> TypedTableResult {
        println!("Called: db_query");
        {
            let sender = to_db.inner.lock().await;

            match sender.send(query).await {
                Ok(_) => {}
                Err(_) => {
                    /* Error send db query to db task */
                    println!("Could not send query to task");
                    return Err(());
                }
            }
        }
        {
            let mut receiver = from_db.inner.lock().await;
            if let Some(table_result) = receiver.recv().await {
                println!("Sending to frontend: {:?}", table_result);
                table_result
            } else {
                println!("Did not receive an answer from db task");

                /* db_query: did not receive an answer from db task */
                Err(())
            }
        }
    }
}

fn get_resulting_connection_string(connection_string: &str, database: &Option<String>) -> String {
    match database {
        Some(dbname) => format!("{} dbname={}", connection_string, dbname),
        None => String::from(connection_string),
    }
}

fn try_get_field_as_string(row: &tokio_postgres::Row, index: usize) -> Result<String, ()> {
    let field_type: &Type = row.columns()[index].type_();
    match field_type {
        &Type::BOOL => match row.try_get::<usize, bool>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::INT2 => match row.try_get::<usize, i16>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::INT4 => match row.try_get::<usize, i32>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::INT8 => match row.try_get::<usize, i64>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::FLOAT4 => match row.try_get::<usize, f32>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::FLOAT8 => match row.try_get::<usize, f64>(index) {
            Ok(val) => Ok(format!("{}", val)),
            Err(_) => Err(()),
        },
        &Type::VARCHAR | &Type::NAME => match row.try_get::<usize, String>(index) {
            Ok(val) => Ok(val),
            Err(_) => Err(()),
        },
        some_type => {
            print!("Could not convert column of type: {:?}", some_type);
            Err(())
        }
    }
}

/// Extract string from given column of row
fn get_field_from_row(row: &tokio_postgres::Row, index: usize) -> String {
    let res = try_get_field_as_string(row, index);
    match res {
        Ok(s) => s,
        Err(_) => String::from("?"),
    }
}

/// Print debug output of rows
fn debug_rows(column_names: &Vec<String>, rows: &Vec<tokio_postgres::Row>) {
    println!("Column names: {:?}", column_names);

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
fn row_to_strings(row: &tokio_postgres::Row) -> Vec<String> {
    (0..row.len())
        .into_iter()
        .map(|index| get_field_from_row(row, index))
        .collect()
}

fn row_to_basic_fields(row: &tokio_postgres::Row) -> Vec<BasicTextField> {
    let strings = row_to_strings(row);
    strings
        .into_iter()
        .enumerate()
        .map(|(column_index, s)| BasicTextField {
            text: s,
            column_index: column_index,
        })
        .collect()
}

fn get_column_name(row: &tokio_postgres::Row, column_index: usize) -> String {
    String::from(row.columns()[column_index].name())
}

fn row_to_column_names(row: &tokio_postgres::Row) -> Vec<String> {
    (0..row.len())
        .map(|column_index| get_column_name(&row, column_index))
        .collect()
}

/// Connect to database and run single query
///
async fn run_standalone_query(
    connection_str: String,
    query: String,
) -> Result<types::BasicTextTable, Box<dyn std::error::Error + Send + Sync>> {
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

    let column_names = if rows.len() > 0 {
        row_to_column_names(&rows[0])
    } else {
        Vec::new()
    };
    debug_rows(&column_names, &rows);

    let fields: Vec<Vec<BasicTextField>> = rows
        .into_iter()
        .map(|row| row_to_basic_fields(&row))
        .collect();

    let basic_table = BasicTextTable {
        columns: column_names,
        fields: fields,
    };
    Ok(basic_table)
}

async fn run_check_connection(connection_str: String) -> bool {
    let q = String::from("SELECT 147 as a;");
    if let Ok(table) = run_standalone_query(connection_str, q).await {
        let size_okay = (&table).fields.len() == 1 && (&table).fields[0].len() == 1;
        if !size_okay {
            false
        } else {
            let item = &table.fields[0][0];
            item.text == String::from("147")
        }
    } else {
        false
    }
}

/// Convert single text field to a typed field
///
/// This requires some context knowledge
///
fn convert_to_typed_cell(text_cell: types::BasicTextField, query: &types::Query) -> TypedField {
    let s = text_cell.text;
    match query {
        types::Query::GetDatabases => TypedField::Database(s),
        types::Query::GetTables(_) => TypedField::Table(s),
        types::Query::GetTableContents(_) => TypedField::Text(s),
    }
}

/// Convert table so that elements from text to typed elements.
///
/// Originally all cells in the table are just text entries.
/// Depending on context (query), they can be specified as being databases or tables.
///
fn convert_rows(table: types::BasicTextTable, query: &types::Query) -> types::TypedTable {
    let fields = table
        .fields
        .into_iter()
        .map(|row| {
            row.into_iter()
                .map(|text_cell: BasicTextField| convert_to_typed_cell(text_cell, query))
                .collect()
        })
        .collect();
    types::TypedTable {
        columns: table.columns,
        fields: fields,
    }
}

/// Standalone task that handles database requests and returns responses
///
pub async fn db_task(
    mut channel_to_db_rx: types::DatabaseQueryReceiver,
    channel_to_tauri_tx: types::StringTableSender,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    while let Some(db_query) = channel_to_db_rx.recv().await {
        println!("Received db query: {:?}", db_query);

        let connection_raw = match &db_query.connection {
            types::Connection::Stateless(s) => s.as_str(),
        };
        let database: Option<String> = db_query.query.get_mentioned_database();
        let connection_str = get_resulting_connection_string(connection_raw, &database);
        let query_string = db_query.query.get_query_string();

        let table_data = run_standalone_query(connection_str, query_string).await;
        match table_data {
            Ok(rows) => {
                let converted_table = convert_rows(rows, &db_query.query);
                if let Err(_) = channel_to_tauri_tx.send(Ok(converted_table)).await {
                    println!("Could not return results to caller. Exit sb task.");

                    return Ok(());
                }
                println!("Returned results to caller okay");
            }
            Err(_) => {
                println!("Error executing query - no results");
                if let Err(_) = channel_to_tauri_tx.send(Err(())).await {
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}
