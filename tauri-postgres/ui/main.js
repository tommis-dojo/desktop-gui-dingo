/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let dbTable;

function initVariables() {
  dbTable = document.querySelector("#db-table table");
}

function initEventFunctions() {
  document
    .querySelector("#databasePath button.request")
    .addEventListener("click", () => dbRequestFromDbPath());
}

/* Status */

function updateDatabasePath(path) {
  document.querySelector("#databasePath .connection_string").value = path["connection_string"];
  document.querySelector("#databasePath .database").value = path["database"];
  document.querySelector("#databasePath .table").value = path["table"];
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
        if (is_header) {
          // header
          let th = tr.appendChild(document.createElement("th"));
          th.textContent = cellData;
        } else {
          // regular row
          var cell = tr.insertCell();
          cell.innerHTML = cellData;
        }
      });
      is_header = false;
    });
  }
}

async function dbRequest(params) {
  // Hint: just replace query
  invoke("db_query",params)
    .then((message) => {
      replaceTableContents(message);
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

async function dbRequestFromDbPath() {
  let params = {};
  params["connection_string"] = valueFromPath("#databasePath .connection_string");
  params["database"] = valueFromPath("#databasePath .database");
  params["table"] = valueFromPath("#databasePath .table");
  await dbRequest({ query: params});
}

/* Mother */

async function initialBreadcrumbs() {
  let r = await invoke("suggest_path", {});
  let datapasePath = r[1];
  InformStatus(JSON.stringify(datapasePath));
  updateDatabasePath(datapasePath);
}

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
  initialBreadcrumbs();
});
