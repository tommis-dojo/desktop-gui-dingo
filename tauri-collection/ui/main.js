/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let greetInput;
let greetMsgJs;
let greetMsgRs;
let importTable;
let importTableContents;

function init_vars() {
  greetInput = document.querySelector("#greet-input");
  greetMsgJs = document.querySelector("#greet-msg-js");
  greetMsgRs = document.querySelector("#greet-msg-rs");
  importTable = document.querySelector("#import-table");
  importTableContents = document.querySelector("#import-table-contents table");
}

function init_event_functions() {
  document
    .querySelector("#greet-button")
    .addEventListener("click", () => greet());
  document
    .querySelector("#long-callback-button")
    .addEventListener("click", () => long_response());
}

/* Status */

function status_message(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Simple manipulation */

function greet() {
  setTimeout(function() {greet_rs(); }, 0);
  setTimeout(function() {greet_js(); }, 0);
}

function greet_js() {
  greetMsgJs.textContent =  "Sei gegrüßt, " + greetInput.value + "!";
}

/* IPC */

async function greet_rs() {
  greetMsgRs.textContent = await invoke("greet", { name: greetInput.value });
}

/* Repetitive */

async function long_response() {
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

async function import_table_contents() {
  let items = [[1,2],[3,4],[5,6]];
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
  init_vars();
  init_event_functions();
  import_table_contents();
});
