/**
 * Content copied from default javacsript created create-tauti-app
 */

let greetInputEl;
let greetMsgEl;

function greet() {
  greetMsgEl.textContent =  "Sei gegrüßt, " + greetInputEl.value + "!";
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document
    .querySelector("#greet-button")
    .addEventListener("click", () => greet());
});
