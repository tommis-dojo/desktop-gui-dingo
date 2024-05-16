/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let importTable;
let importTableContents;

function initVariables() {
  importTable = document.querySelector("#modify-table");
  importTableContents = document.querySelector("#import-table-contents table");
}

function initEventFunctions() {
  document
    .querySelector("#table-button")
    .addEventListener("click", () => replaceTableContents());
}

/* Status */

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Import-Table-Contents */

function process_items(items) {
  if (items) {
    // Clear old table contents
    let num_rows = importTableContents.rows.length;

    if (num_rows > 0) {
      InformStatus("Replace number of rows: " + (num_rows - 1));
    } else {
      InformStatus("Insert table rows");
    }

    for (let i = 1; i < num_rows; i++) {
      importTableContents.deleteRow(1);
    }

    console.log("read items");
    // InformStatus("Items: " + items.join(' | '));
    InformStatus("Items (json): BEGIN " + JSON.stringify(items) + " END");

    // Insert new table contents
    items.forEach(function(item) {
      let row = importTableContents.insertRow(-1);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      
      cell1.innerHTML = item[0];
      cell2.innerHTML = item[1];
    });
  }
}

async function replaceTableContents() {
  invoke("present_array")
    .then((message) => {
      process_items(message)})
    .catch((error) => InformStatus("Error: " + error));
}

/* Mother */

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
});
