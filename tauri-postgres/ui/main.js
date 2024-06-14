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

function initEventFunctions() {
  document
    .querySelector("#databasePath button.request")
    .addEventListener("click", () => dbRequestFromDbPath());
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
      linkText = lastPathElement
    }

    addTextLiTo(breadcrumbs, "link", linkText, () => dbRequest(subPath));
  }
}

function updateBreadcrumbs(path) {
  // Breadcrumbs show everything but the main information
  breadcrumbs.innerHTML = '';

  addBreadcrumbIfGiven(path, "home", ["connection_string"]);
  addBreadcrumbIfGiven(path, null, ["connection_string","database"]);
  addBreadcrumbIfGiven(path, null, ["connection_string","database","table"]);
}

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

async function dbRequest(dbPath) {
  InformStatus("Note dbRequest: " + JSON.stringify(dbPath))
  invoke("db_query",{ query: dbPath})
    .then((message) => {
      replaceTableContents(message);
      updateBreadcrumbs(dbPath);  // just copy the query verbatim as current path
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
  await dbRequest(dbPath);
}


/* Mother */

async function initialBreadcrumbs() {
  let r = await invoke("suggest_path", {});
  let dbPath = r[1];
  updateDatabasePath(dbPath);
  updateBreadcrumbs(dbPath);
}

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
  initialBreadcrumbs();
});
