# Tauri collection

Initially cloned from [tauri-js-ipc-to-app](../tauri-js-ipc-to-app/).

Demonstrating:

* ipc to rust: send value, receive result
* long duration ipc call: will wait for more than a second before answering, without blocking caller or callee
* call returns array which is turned into a table