/**
 * Content adapted from default javascript created create-tauti-app
 */

const { invoke } = window.__TAURI__.tauri

let greetInput;
let greetMsgRs;
let counter;

function initVariables() {
  greetInput = document.querySelector("#greet-input");
  greetMsgRs = document.querySelector("#greet-msg-rs");
  counter = document.querySelector("#count");
}

function initEventFunctions() {
  document
    .querySelector("#greet-button")
    .addEventListener("click", () => greet());
}

/* Status */

function InformStatus(message) {
  let s = document.querySelector("#statusbar");
  s.textContent = message;
}

/* Simple manipulation */

async function greet() {
  greetMsgRs.textContent = await invoke("greet", { name: greetInput.value });
  counter.textContent = await invoke("count", {});
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

/* Mother */

window.addEventListener("DOMContentLoaded", () => {
  initVariables();
  initEventFunctions();
});
