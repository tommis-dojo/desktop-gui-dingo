/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let dbTable;
let breadcrumbs;

function initVariables() {
  dbTable = document.querySelector("#db-table table");
  breadcrumbs = document.querySelector("#breadcrumbs");
}

function onEnterDbRequest(event) {
  if (event.keyCode === 13) {
    // Prevent the default action
    event.preventDefault();
    
    dbRequestFromDbPath();
  }
}

function initEventFunctions() {
  document
    .querySelector("#databasePath button.request")
    .addEventListener("click", () => dbRequestFromDbPath());
  
  document
    .querySelector("#databasePath .connection_string")
    .addEventListener('keydown', onEnterDbRequest);

  document
    .querySelector("#databasePath .database")
    .addEventListener('keydown', onEnterDbRequest);

  document
    .querySelector("#databasePath .table")
    .addEventListener('keydown', onEnterDbRequest);
}

/* Status */

function db_path_shell() {
  return {
    "connection_string": null,
    "database": null,
    "table": null
  };
}

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


function createDbQuery(connection_string, database, table) {

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

  return {
    "connection": {
      "Stateless":connection_string
    },
    "query": query
  }
}

function createDbQueryFromPath(path) {
  return createDbQuery(
    path["connection_string"],
    path["database"],
    path["table"])
}


// Add an element to the breadcrumbs including link
function addBreadcrumbIfGiven(path, altLinkText, pathElements) {
  let subPath = db_path_shell();
  pathElements.forEach(key => { subPath[key] = path[key];});

  let key = pathElements[pathElements.length - 1];
  let lastPathElement = path[key];

  if (lastPathElement !== null) {
    addTextLiTo(breadcrumbs, "breadcrumb_separator", ">", null);

    // Choose Text for link
    let linkText;
    if (altLinkText !== null) {
      linkText = altLinkText;
    } else {
      linkText = lastPathElement;
    }

    let statelessQuery = createDbQueryFromPath(subPath);
    addTextLiTo(breadcrumbs, "link", linkText, () => dbRequest(statelessQuery));
  }
}

function updateBreadcrumbs(path) {
  // Breadcrumbs show everything but the main information
  breadcrumbs.innerHTML = '';

  addBreadcrumbIfGiven(path, "home", ["connection_string"]);
  addBreadcrumbIfGiven(path, null, ["connection_string","database"]);
  addBreadcrumbIfGiven(path, null, ["connection_string","database","table"]);
}

function get_task(stateless_query) {
  let q = stateless_query["query"];
  return Object.keys(q)[0];
}

function toBreadcrumbItems(stateless_query) {
  let q = stateless_query["query"];
  let database = null;
  let table = null;

  let task = get_task(stateless_query);  // "GetDatabases", "GetTables", "GetTableContents"
  let task_info = q[task];
  switch (task) {
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
  return {
    "connection_string": stateless_query["connection"]["Stateless"],
    "database": database,
    "table": table
  }
}

function updateDatabasepath(query) {
  let breadcrumb_items = toBreadcrumbItems(query);

  document.querySelector("#databasePath .connection_string").value = breadcrumb_items["connection_string"];
  document.querySelector("#databasePath .database").value = breadcrumb_items["database"];
  document.querySelector("#databasePath .table").value = breadcrumb_items["table"];
}

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Import-Table-Contents */

function replaceTableContents(rows) {
  console.log("replaceTableContents(), num rows = " + rows.length);

  if (rows) {
    // Clear old table contents
    let num_rows = dbTable.rows.length;

    for (let i = 0; i < num_rows; i++) {
      dbTable.deleteRow(-1);
    }

    // Insert new table contents
    // Assume no headers at first
    var is_header = false;
    rows.forEach(function(row) {
      let tr = dbTable.insertRow();

      row.forEach(function(cellData) {
        let cellText = cellData["Text"];
        if (is_header) {
          // header
          let th = tr.appendChild(document.createElement("th"));
          th.textContent = cellText;
        } else {
          // regular row
          var cell = tr.insertCell();
          cell.innerHTML = cellText;
        }
      });
      is_header = false;
    });
  }
}

async function dbRequest(dbQuery) {
  InformStatus("Note dbRequest: " + JSON.stringify(dbQuery))
  invoke("db_query",{ query: dbQuery})
    .then((message) => {
      // InformStatus("Note message: " + JSON.stringify(message))
      replaceTableContents(message);
      let path = toBreadcrumbItems(dbQuery);
      updateBreadcrumbs(path);  // just copy the query verbatim as current path
    })
    .catch((error) => InformStatus("Error: " + error));
}

function valueFromPath(selectors) {
  console.log("valueFromPath(" + selectors + ")")
  let element = document.querySelector(selectors);
  if (!element) {
    return null;
  }
  
  let value = element.value;
  if (value == "") {
    return null;
  }

  return value;
}

/**
 * 
 */
async function dbRequestFromDbPath() {
  let dbPath = {};
  dbPath["connection_string"] = valueFromPath("#databasePath .connection_string");
  dbPath["database"] = valueFromPath("#databasePath .database");
  dbPath["table"] = valueFromPath("#databasePath .table");

  let query = createDbQueryFromPath(dbPath);
  await dbRequest(query);
}


/* Mother */

async function initialQuery(){
  let query = await invoke("suggest_query", {});
  await dbRequest(query);
  updateDatabasepath(query);
}

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
  initialQuery();
});
