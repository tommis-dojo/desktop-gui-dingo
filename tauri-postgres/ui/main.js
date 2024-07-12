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

function onEnterRun(event, f) {
  if (event.keyCode === 13) {
    // Prevent the default action
    event.preventDefault();
    
    f();
  }
}

async function initEventFunctions() {

  /* connection */
  let suggested_query = await invoke("suggest_query", {});
  let connection_string = suggested_query["connection"]["Stateless"];
  
  let elem_con_string = document.querySelector(".connection-string");
  let elem_con_test = document.querySelector(".connection-test")
  let elem_con_test_result = document.querySelector(".connection-result");
  let elem_con_select = document.querySelector(".connection-select");
  let elem_con_select_confirm = document.querySelector(".connection-select-confirm");

  const mark_okay = "&check; (okay)";
  const mark_fail = "&cross; (fail)";

  let reset_concheck = () => {
    elem_con_test_result.innerHTML = "";
    elem_con_select_confirm.innerHTML = "";
  };

  let run_concheck = () => {
    reset_concheck();
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
    reset_concheck();
  })
  
  // Click on "check" will run connection check
  elem_con_test.addEventListener("click", () => {
    run_concheck();
  });

  elem_con_select.addEventListener("click", () => {
    elem_con_select_confirm.innerHTML = "";
    dbRequest(createDbQuery(elem_con_string.value, null, null))
      .then((message) => { elem_con_select_confirm.innerHTML = mark_okay; selectComponent("db"); })
      .catch((error) => { elem_con_select_confirm.innerHTML = mark_fail })
    ;
    
  });
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

function toPathItems(stateless_query) {
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


function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Import-Table-Contents */

function determineCellFunctionality(cellData, lastQuery) {
  let cellType = Object.keys(cellData)[0];
  let cellText = cellData[cellType];
  let cellClass = cellText;
  let cellFunction = null;
  
  let pathItems = toPathItems(lastQuery);
  let lastConnectionString = pathItems["connection_string"];
  let lastDatabase = pathItems["database"];

  switch (cellType) {
    case "Text": {
      cellFunction = null;
    } break;
    case "Database": {
      cellClass += " link";
      let database = cellText;
      let query = createDbQuery(lastConnectionString, database, null);
      cellFunction = () => { dbRequest(query); }
    } break;
    case "Table": {
      cellClass += " link";
      let database = lastDatabase;
      let table = cellText;
      let query = createDbQuery(lastConnectionString, database, table);
      cellFunction = () => { dbRequest(query); }
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

async function dbRequest(dbQuery) {
  invoke("db_query",{ query: dbQuery})
    .then((table) => {
      InformStatus("Read " + table.fields.length + " rows");
      replaceTableContents(table, dbQuery);
      let path = toPathItems(dbQuery);
      updateBreadcrumbs(path);  // just copy the query verbatim as current path
    })
    .catch((error) => { InformStatus("Call to db_query returned an error: " + JSON.stringify(error))});
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



/* Example */

/*

const { invoke } = window.__TAURI__.tauri;
let query = await invoke("suggest_query", {});
invoke("db_query",{ query: query})
.then((message) => {console.log("Message:" + JSON.stringify(message))})
.catch((error) => {console.log("Error:" + JSON.stringify(error))});
*/

/* Mother */


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

async function initialQuery(){
  selectComponent("db");
  let query = await invoke("suggest_query", {});
  await dbRequest(query);
}

window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initVariables();
  initEventFunctions();
  initialQuery();
});
