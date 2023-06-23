# Small example GUI programs using a number of technologies

## Tauri (rust application wrapper to embedded browser)

See: [tauri.app](https://tauri.app/)

### [Minimal tauri app created using tauri cli](tauri-basic-html-js/)

Following the instructions from tauris [getting started using html, css, and js](https://tauri.app/v1/guides/getting-started/setup/html-css-js/).

* we provide a simple webpage (html, js and css)
* tauri provides the embedded browser (acting as a desktop gui application)
* webpage is standalone, no calls outside to application

Minimal functionality:

* Have a input and display element
* Changing the input element modifies the output element
* logic is done entirely in javascript (as noted, no calls application)

Creating and calling the app to use the existing assets in `ui`:

```
make help       # show make targets
make run-dev    # for dev (reload page if any asset changes)
make run-build  # for creating and running standalone binary
```

### [Tauri app calling function inside rust host](tauri-js-ipc-to-app/)

This modifies the minimal example only slightly to call a function on the rust side, and receive its result.

Same functionality as above.

Usage as above.

### [Tauri collection](tauri-collection/)

Testbed for various tinkerings. Free for play!
See explicite [README.md](tauri-collection/) of that bag of experiments.


