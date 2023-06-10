TAURI_CONFIG := src-tauri/tauri.conf.json
APP_SOURCES := ui/index.html

.PHONY: help
help: # this help
	@echo "Targets:"
	@sed -n "/^[a-zA-Z\-]*:.*#.*/ s/^\([a-zA-Z\-]*\):.*#\(.*\$\)/  \1\:\t\2/p " Makefile

# Run this target to create a standalone binary application that we can start
.PHONY: run-build
run-build: $(APP_SOURCES) $(TAURI_CONFIG) # Create and run application in release mode (standalone application)
	grep tauri-minimal-id $(TAURI_CONFIG) || sed -i '' "s/com\.tauri\.dev/tauri-minimal/" $(TAURI_CONFIG)
	# We will build the application, but not create any os specific bundle (deb, dmg, msi, ...).
	cargo tauri build -b none
	src-tauri/target/release/tauri-minimal

# Use this target to start app in dev mode - any changes to input files will lead to auto reload
.PHONY: run-dev
run-dev: $(TAURI_APP_EXISTS_FILE) # Create and run application in dev mode (external resource, auto reload)
	cargo tauri dev

# Create tauri framework using tauri cli
$(TAURI_CONFIG): has-tauri-cli
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
clean: # remove any automatically created files
	rm -rf src-tauri