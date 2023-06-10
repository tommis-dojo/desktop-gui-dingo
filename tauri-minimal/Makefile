TAURI_APP_EXISTS_FILE := src-tauri/Cargo.toml

.PHONY: run
run: $(TAURI_APP_EXISTS_FILE)
	cargo tauri dev

# Create tauri framework using tauri cli
$(TAURI_APP_EXISTS_FILE): has-tauri-cli
	# interactive would be:
	# cargo tauri init
	#
	# we will use non-interactive:
	cargo tauri init\
		--app-name tauri-minimal\
		--window-title "Minimal Tauri Program"\
		--dist-dir "../ui"\
		--dev-path "../ui"\
		--before-dev-command ""\
		--before-build-command ""

	# built using tauri cli
	#
	# A slightly nicer version is available as well:
	# cargo create-tauri-app


.PHONY: has-tauri-cli
has-tauri-cli:
	cargo --list | grep tauri || cargo install tauri-cli

.PHONY: clean
clean:
	rm -rf src-tauri