/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let dbTable;
let breadcrumbs;
let globalConnectionString;
let customSqlQuery;
let customDatabase;

/* Hints for Debugging */

/*
const { invoke } = window.__TAURI__.tauri;
let query = await invoke("suggest_query", {});
invoke("db_query",{ query: query})
.then((message) => {console.log("Message:" + JSON.stringify(message))})
.catch((error) => {console.log("Error:" + JSON.stringify(error))});
*/

/* Query Types */

// Query: backend request to database as defined by rust backend
//        Examples: GetDatabases, GetTables, CustomQuery
//
//        For instance:
//        
//        {
//          CustomQuery: {
//            database: database, 
//            sql_query: sqlQuery
//          }
//        }
//
//        or
//
//        "GetDatabases"
//
//        or
//
//        { "GetTables" : "mydatabase" }
//
// Path: [Database], [Path]
//        Query can be created from this
//
// Connection: determines which database to connect to
//        Currently is simply a string,
//        contains (host, port, user, password)
//
//       {
//         Stateless: connection_string
//       }
//
// FullQuery: Query + Connection
//
//       {
//         "connection": <some connection>,
//         "query": <query>
//       }
//
// Definitive: db.rs

function getConnectionStringFromFullQuery(stateless_query) {
  return stateless_query["connection"]["Stateless"];
}

/* Common */

function useConnectionString(connection_string) {
  globalConnectionString = connection_string;
}

function getGlobalConnectionString() {
  return globalConnectionString;
}

function onEnterRun(event, f) {
  if (event.keyCode === 13) {
    // Prevent the default action
    event.preventDefault();

    f();
  }
}

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* DB Query (including custom query) */

function initVariablesDbQuery() {
  dbTable = document.querySelector("#db-table table");
  breadcrumbs = document.querySelector("#breadcrumbs");
  customSqlQuery = document.querySelector(".custom-sql .sql-query");
  customDatabase = document.querySelector(".custom-sql .database");
}

function createCustomQuery(database, sqlQuery)
{
  return {
    CustomQuery: {
      database: database, 
      sql_query: sqlQuery
    }
  }
}

function createQueryFromPathElements(database, table) {
  /*
    Possible values for "query":

    "query": "GetDatabases"
    "query": {"GetTables":"mydatabase"}
    "query": {"GetTableContents":{
        "database": "mydatabase"
        "table": "mytable"
      }}
  */

  let query;

  if (table !== null) {
    query = {
      "GetTableContents":{
        "database": database,
        "table": table
      }
    }
  } else if (database !== null) {
    query = {"GetTables": database}
  } else {
    query = "GetDatabases";
  }

  return query;
}

function createFullQuery(connection_string, query) {
  return {
    "connection": {
      "Stateless": getGlobalConnectionString()
    },
    "query": query
  }
}

function initEventsForCustomQuery() {
  customSqlQuery.addEventListener("keyup", (event) => {
    onEnterRun(event, runCustomQuery);
  });
  customSqlQuery.addEventListener("input", () => {
    customSqlQuery.size = customSqlQuery.value.length;
  });
  customDatabase.addEventListener("keyup", (event) => {
    onEnterRun(event, runCustomQuery);
  });
}

/* connection configuration and test */

async function initEventsForConnectionConfig() {
  let suggested_query = await invoke("suggest_query", {});
  let connection_string = suggested_query["connection"]["Stateless"];
  
  let elem_con_string = document.querySelector(".connection-string");
  let elem_con_test = document.querySelector(".connection-test")
  let elem_con_test_result = document.querySelector(".connection-result");
  let elem_con_select = document.querySelector(".connection-select");
  let elem_con_select_confirm = document.querySelector(".connection-select-confirm");

  const mark_okay = "&check; (okay)";
  const mark_fail = "&cross; (fail)";

  let resetConcheck = () => {
    elem_con_test_result.innerHTML = "";
    elem_con_select_confirm.innerHTML = "";
  };

  let run_concheck = () => {
    resetConcheck();
    invoke("test_connection_string",
      { "connectionString": elem_con_string.value }
    )
    .then((bool_result) => {
      if (bool_result) {
        elem_con_test_result.innerHTML = mark_okay;
      } else {
        elem_con_test_result.innerHTML = mark_fail;
      }
    })
    .catch((error) => {
      elem_con_test_result.innerHTML = "error running test";
    });
  };

  elem_con_string.value = connection_string;

  // Pressing enter will run connection check
  elem_con_string.addEventListener("keyup", (event) => {
    onEnterRun(event, run_concheck);
  });

  // Change to input will result in resetting 
  elem_con_string.addEventListener("input", () => {
    resetConcheck();
  })
  
  // Click on "check" will run connection check
  elem_con_test.addEventListener("click", () => {
    run_concheck();
  });

  // Click on "select" will use connection string for other requests
  //
  // See also: initialQuery()
  //
  // Please note and regret the inconsistent use of where
  // the connection string is stored (inside query / global
  // string).
  //
  elem_con_select.addEventListener("click", () => {
    elem_con_select_confirm.innerHTML = "";

    useConnectionString(elem_con_string.value);
    
    dbFullRequest(createFullQuery(elem_con_string.value, createQueryFromPathElements(null, null)))
      .then((message) => { elem_con_select_confirm.innerHTML = mark_okay; selectComponent("db"); })
      .catch((error) => { elem_con_select_confirm.innerHTML = mark_fail })
    ;
  });
}

/* Bag things together */

function initVariables() {
  initVariablesDbQuery();
}

async function initEventFunctions() {
  await initEventsForConnectionConfig();
  await initEventsForCustomQuery();
}

/* Breadcrumbs */

function addTextLiTo(parent, className, textContent, linkFunction) {
  let li = document.createElement('li');
    
  li.appendChild(document.createTextNode(textContent));

  if (linkFunction !== null) {
    li.addEventListener("click", linkFunction);
  }

  if (className !== null) {
    li.className = className;
  }
  
  parent.appendChild(li);  
}

// Add an element to the breadcrumbs including link
function addBreadcrumbIfGiven(altLinkText, database, table) {

  let lastPathElement;
  if (table) {
    lastPathElement = table;
  } else if (database) {
    lastPathElement = database;
  } else {
    lastPathElement = "(placeholder)";
  }

  if (lastPathElement !== null) {
    addTextLiTo(breadcrumbs, "breadcrumb_separator", ">", null);

    // Choose Text for link
    let linkText;
    if (altLinkText !== null) {
      linkText = altLinkText;
    } else {
      linkText = lastPathElement;
    }

    addTextLiTo(breadcrumbs, "link", linkText, () => dbRequestFromPathElements(database, table));
  }
}

function updateBreadcrumbs(pathElements) {
  // Breadcrumbs show everything but the main information
  breadcrumbs.innerHTML = '';

  let database = pathElements["database"];
  let table = pathElements["table"];

  addBreadcrumbIfGiven("home", null, null);
  if (database) {
    addBreadcrumbIfGiven(null, database, null);
  }
  if (table) {
    addBreadcrumbIfGiven(null, database, table);
  }
}

function getTaskFromQuery(fullQuery) {
  let q = fullQuery["query"];
  return Object.keys(q)[0];
}

function toPathItems(fullQuery) {
  let q = fullQuery["query"];
  let database = null;
  let table = null;

  let task = getTaskFromQuery(fullQuery);  // "CustomQuery", "GetDatabases", "GetTables", "GetTableContents"
  let task_info = q[task];
  switch (task) {
    case "CustomQuery":
      database = task_info["database"];
      break;
    case "GetDatabases":
      break;
    case "GetTables":
      database = task_info;
      break;
    case "GetTableContents":
      database = task_info["database"];
      table = task_info["table"];
      break;
    default:
  }
  let pathItems = {
    "database": database,
    "table": table
  }

  return pathItems;
}

/* Import-Table-Contents */

function determineCellFunctionality(cellData, fullQuery) {
  let cellType = Object.keys(cellData)[0];
  let cellText = cellData[cellType];
  let cellClass = cellText;
  let cellFunction = null;
  
  let pathItems = toPathItems(fullQuery);
  let lastDatabase = pathItems["database"];

  switch (cellType) {
    case "Text": {
      cellFunction = null;
    } break;
    case "Database": {
      cellClass += " link";
      let database = cellText;
      cellFunction = () => { dbRequestFromPathElements(database, null); }
    } break;
    case "Table": {
      cellClass += " link";
      let database = lastDatabase;
      let table = cellText;
      cellFunction = () => { dbRequestFromPathElements(database, table); }
    } break;
  }
  
  return {
    "text": cellText,
    "cellClass": cellClass,
    "cellFunction": cellFunction
  }
}

function amendCell(domCell, text, cls, f) {
  domCell.innerHTML = text;
  if (cls !== null) {
    domCell.className = cls;
  }
  if (f !== null) {
    domCell.addEventListener("click", f);
  }
}

function insertCellData(domCell, cellInfo) {
  amendCell(domCell, cellInfo["text"], cellInfo["cellClass"], cellInfo["cellFunction"]);
}

function replaceTableContents(table, lastQuery) {
  console.log("replaceTableContents(), num rows = " + table.fields.length);

  if (table) {
    // Clear old table contents
    let num_rows = dbTable.rows.length;

    for (let i = 0; i < num_rows; i++) {
      dbTable.deleteRow(-1);
    }

    // Insert table header
    let tr = dbTable.insertRow();
    table.columns.forEach((column_name) => {
      let th = tr.appendChild(document.createElement("th"));
      amendCell(th, column_name, null, null);
    })

    // Insert table contents
    table.fields.forEach(function(row) {
      let tr = dbTable.insertRow();

      row.forEach(function(cellData) {
        let cellInfo = determineCellFunctionality(cellData, lastQuery);
          // regular row
          var cell = tr.insertCell();
          insertCellData(cell, cellInfo);
      });
    });
  }
}

/** Will run a query to the database and process results (including DOM manipulation)
 * 
 * @param fullQuery containing connection and specific query
 */
async function dbFullRequest(fullQuery) {
  InformStatus("Running query: " + JSON.stringify(fullQuery));
  invoke("db_query",{ query: fullQuery})
    .then((queryResult) => {
      let tableResult = queryResult.table;
      if (tableResult.hasOwnProperty("Ok")) {
        customSqlQuery.value = queryResult.sql_query.replace(/\s+/g,' ');
        customSqlQuery.size = customSqlQuery.value.length;
        if (queryResult.database !== null) {
          customDatabase.value = queryResult.database;
        }

        InformStatus("Read " + tableResult.Ok.fields.length + " rows");
        replaceTableContents(tableResult.Ok, fullQuery);
        updateBreadcrumbs(toPathItems(fullQuery));  // just copy the query verbatim as current path
      } else {

        let err = "Error: No successful query-results for query '" + queryResult.sql_query + "'";
        if (queryResult.database !== null) {
          err += " on database '" + queryResult.database + "'";
        }
        InformStatus(err);
      }
    })
    .catch((error) => { 
      InformStatus("Error: Call to db_query returned an error: " + JSON.stringify(error))
    });
}

// Callback function that initiates a full request for a given database and table
//
async function dbRequestFromPathElements(database, table) {
  await dbFullRequest(createFullQuery(getGlobalConnectionString(), createQueryFromPathElements(database, table)));
}


async function runCustomQuery() {
  await dbFullRequest(
    createFullQuery(
      getGlobalConnectionString(),
      createCustomQuery(
        customDatabase.value, 
        customSqlQuery.value)
    )
  );
}

/* Navigation */

let unselectComponents = () => {
  document.querySelectorAll(".component").forEach(
    (node) => node.classList.add("hidden"));
  document.querySelectorAll(".nav").forEach(
    (node) => node.classList.remove("nav-selected"));
}

let selectComponent = (componentName) => {
  unselectComponents();

  let component = document.querySelector(".component." + componentName);
  component.classList.remove("hidden");

  let nav = document.querySelector(".nav." + componentName);
  nav.classList.add("nav-selected");
}

let initComponentNavigation = (componentName) => {
  document.querySelector(".nav." + componentName).
    addEventListener("click", () => {selectComponent(componentName)});
}

let initNavigation = () => {
  unselectComponents();
  // Das folgende könnte ohne Umstände automatisch gehen
  initComponentNavigation("db");
  initComponentNavigation("connectors")
  initComponentNavigation("about")
}

/* Mother */

async function initialQuery(){
  selectComponent("db");
  // Could split into "suggest_query" and "suggest_connection_string"
  let fullQuery = await invoke("suggest_query", {});
  useConnectionString(getConnectionStringFromFullQuery(fullQuery));
  await dbFullRequest(fullQuery);
}

window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initVariables();
  initEventFunctions();
  initialQuery();
});
