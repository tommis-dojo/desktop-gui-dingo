/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let greetInput;
let greetMsgJs;
let greetMsgRs;

function init_vars() {
  greetInput = document.querySelector("#greet-input");
  greetMsgJs = document.querySelector("#greet-msg-js");
  greetMsgRs = document.querySelector("#greet-msg-rs");
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

/* Mother */

window.addEventListener("DOMContentLoaded", () => {
  init_vars();
  init_event_functions();
});
