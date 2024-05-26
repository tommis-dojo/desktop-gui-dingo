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
    .querySelector("#db-request")
    .addEventListener("click", () => dbRequest());
}

/* Status */

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Import-Table-Contents */

function replaceTableContents(items) {
  console.log("replaceTableContents(), num items = " + items.length);

  if (items) {
    // Clear old table contents
    let num_rows = dbTable.rows.length;

    for (let i = 0; i < num_rows; i++) {
      dbTable.deleteRow(-1);
    }

    // Insert new table contents
    // Assume first line is header
    var is_header = true;
    items.forEach(function(item) {
      let row = dbTable.insertRow();

      item.forEach(function(cellData) {
        if (is_header) {
          // header
          let th = row.appendChild(document.createElement("th"));
          th.textContent = cellData;
        } else {
          // regular row
          var cell = row.insertCell();
          cell.innerHTML = cellData;
        }
      });
      is_header = false;
    });
  }
}

async function dbRequest() {
  invoke("db_query", { queryMain: "GetDatabases"})
    .then((message) => {
      replaceTableContents(message)})
    .catch((error) => InformStatus("Error: " + error));
}

/* Mother */

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
});
