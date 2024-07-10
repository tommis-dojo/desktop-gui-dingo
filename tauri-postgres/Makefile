TAURI_CONFIG := src-tauri/tauri.conf.json
APP_SOURCES := ui/index.html
APP_NAME := tauri-js-ipc-to-app

.PHONY: help
help: # this help
	@echo "Targets:"
	@sed -n "/^[a-zA-Z\-]*:.*#.*/ s/^\([a-zA-Z\-]*\):.*#\(.*\$\)/  \1\:\t\2/p " Makefile

# Run this target to create a standalone binary application that we can start
.PHONY: run-release
run-release: $(APP_SOURCES) $(TAURI_CONFIG) has-tauri-cli # Create and run application in release mode (standalone application)
	# We will build the application, but not create any os specific bundle (deb, dmg, msi, ...).
	cargo tauri build -b none
	src-tauri/target/release/$(APP_NAME)

# Use this target to start app in dev mode - any changes to input files will lead to auto reload
.PHONY: run-dev
run-dev: $(APP_SOURCES) $(TAURI_CONFIG) has-tauri-cli # Create and run application in dev mode (external resource, auto reload)
	cargo tauri dev

.PHONY: has-tauri-cli
has-tauri-cli:
	cargo --list | grep tauri || cargo install tauri-cli

.PHONY: clean
clean: # remove any automatically created files
	rm -rf src-tauri/target

.PHONY: html-validate
html-validate:  # validate html file
	@which html-validate || echo "Need helper html-validate (e.g. 'npm install -h html-validate')"
	html-validate ui/index.html
