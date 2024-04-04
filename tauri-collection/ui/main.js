/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let greetInput;
let greetMsgJs;
let greetMsgRs;
let importTable;
let importTableContents;

function initVariables() {
  greetInput = document.querySelector("#greet-input");
  greetMsgJs = document.querySelector("#greet-msg-js");
  greetMsgRs = document.querySelector("#greet-msg-rs");
  importTable = document.querySelector("#import-table");
  importTableContents = document.querySelector("#import-table-contents table");
}

function initEventFunctions() {
  document
    .querySelector("#greet-button")
    .addEventListener("click", () => greet());
  document
    .querySelector("#long-callback-button")
    .addEventListener("click", () => longResponse());
  document
    .querySelector("#table-button")
    .addEventListener("click", () => replaceTableContents());
}

/* Status */

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Simple manipulation */

function greet() {
  setTimeout(function() {greetRs(); }, 0);
  setTimeout(function() {greetJs(); }, 0);
}

function greetJs() {
  greetMsgJs.textContent =  "Sei gegrüßt, " + greetInput.value + "!";
}

/* IPC */

async function greetRs() {
  greetMsgRs.textContent = await invoke("greet", { name: greetInput.value });
}

/* Repetitive */

async function longResponse() {
  let el = document.querySelector("#long-duration-callback");
  if (el) {

    el.classList.add("selected");
    await invoke("long_callback");
    el.classList.remove("selected");


    window.setTimeout(function() {

    }, 600);
  }
}

/* Import-Table-Contents */

async function replaceTableContents() {
  let num_rows = importTableContents.rows.length;

  if (num_rows > 0) {
    InformStatus("Replace number of rows: " + (num_rows - 1));
  } else {
    InformStatus("Insert table rows");
  }
  
  for (let i = 1; i < num_rows; i++) {
    importTableContents.deleteRow(1);
  }

  let items = await invoke("present_array",{}); // [[1,2],[3,4],[5,6]];
  items.forEach(function(item) {

    let row = importTableContents.insertRow(-1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    
    cell1.innerHTML = item[0];
    cell2.innerHTML = item[1];
  }
  );
}

/* Mother */

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
});
