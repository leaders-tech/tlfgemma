# This file gives short root commands for local development, formatting, and tests.
# Edit this file when students need another common repo command from the project root.
# Copy an existing target pattern here when you add another simple root command.
.DEFAULT_GOAL := help

ifneq (,$(wildcard .agent.env))
include .agent.env
endif

ifneq (,$(wildcard .env))
include .env
endif

DOCKER_COMPOSE := ./scripts/docker-compose.sh --env-file .docker.env -f docker-compose.yml -f docker-compose.local.yml
LOCAL_BACKEND_URL := http://$(APP_PUBLIC_HOST):$(APP_PORT)
LOCAL_FRONTEND_URL := http://$(FRONTEND_PUBLIC_HOST):$(FRONTEND_PORT)
WIFI_IP := $(shell if [ -n "$(WIFI_INTERFACE)" ]; then ipconfig getifaddr "$(WIFI_INTERFACE)" 2>/dev/null; fi)
LAN_FRONTEND_URL := http://$(WIFI_IP):$(LAN_FRONTEND_PORT)
LAN_BACKEND_URL := http://$(WIFI_IP):$(LAN_BACKEND_PORT)
AGENT_BACKEND_URL := http://$(AGENT_BACKEND_HOST):$(AGENT_BACKEND_PORT)
AGENT_FRONTEND_URL := http://$(AGENT_FRONTEND_HOST):$(AGENT_FRONTEND_PORT)
AGENT_RUNTIME_DIR_ABS := $(shell python3 -c 'from pathlib import Path; print(Path("$(AGENT_RUNTIME_DIR)").resolve())')
AGENT_COOKIE_JAR := $(AGENT_RUNTIME_DIR_ABS)/cookies.txt
AGENT_BACKEND_PID := $(AGENT_RUNTIME_DIR_ABS)/backend.pid
AGENT_FRONTEND_PID := $(AGENT_RUNTIME_DIR_ABS)/frontend.pid
ALOGIN_USER := $(if $(filter command line,$(origin USER)),$(USER),user)
ALOGIN_PASS := $(if $(filter command line,$(origin PASS)),$(PASS),user)
APOST_BODY := $(if $(filter command line,$(origin BODY)),$(BODY),{})
PY_RUNTIME_DEPS := $(shell python3 -c 'import re, tomllib, pathlib; data = tomllib.loads(pathlib.Path("pyproject.toml").read_text()); print(" ".join(re.match(r"[A-Za-z0-9._-]+", dep).group(0) for dep in data["project"]["dependencies"]))')
PY_DEV_DEPS := $(shell python3 -c 'import re, tomllib, pathlib; data = tomllib.loads(pathlib.Path("pyproject.toml").read_text()); print(" ".join(re.match(r"[A-Za-z0-9._-]+", dep).group(0) for dep in data["dependency-groups"]["dev"]))')
CHECK_LOCAL_ENV = @test -f .env || (echo "Local config file .env was not found. Run make setup first."; exit 1)
CHECK_DOCKER_ENV = @test -f .docker.env || (echo "Docker config file .docker.env was not found. Run make setup first."; exit 1)
CHECK_AGENT_ENV = @test -f .agent.env || (echo "Agent config file .agent.env was not found. Run make setup first."; exit 1)
CHECK_WIFI_IP = @test -n "$(WIFI_IP)" || (echo "Wi-Fi IP was not found on $(WIFI_INTERFACE). Connect to Wi-Fi or use normal make back / make front."; exit 1)

.PHONY: help setup back back-once front open back-lan front-lan open-lan back-docker front-docker open-docker stop-docker clean-docker format test test-e2e-docker deps-update-safe deps-update-latest aback aback-once afront aopen astop aclean abrowser alogin apost ahealth asql adb-path

help:
	@printf "Available commands:\n"
	@printf "  make setup   Install deps and create local env files\n"
	@printf "  make back    Run the backend server with auto-reload\n"
	@printf "  make back-once Run the backend server without auto-reload\n"
	@printf "  make front   Run the frontend dev server\n"
	@printf "  make open    Open the frontend in a browser\n"
	@printf "  make back-lan Run the backend for testing on the same Wi-Fi\n"
	@printf "  make front-lan Run the frontend for testing on the same Wi-Fi\n"
	@printf "  make open-lan Open the Wi-Fi frontend URL in a browser\n"
	@printf "  make back-docker Start the backend container for local Docker testing\n"
	@printf "  make front-docker Start the frontend container for local Docker testing\n"
	@printf "  make open-docker Open the Docker frontend in a browser\n"
	@printf "  make stop-docker Stop the local Docker test containers\n"
	@printf "  make clean-docker Stop the local Docker test containers and delete their images and data\n"
	@printf "  make deps-update-safe Update backend and frontend deps in the safe supported way\n"
	@printf "  make deps-update-latest Update backend deps to the newest available versions\n"
	@printf "  make format  Format backend and frontend code\n"
	@printf "  make test    Run backend, frontend unit, and e2e tests\n"
	@printf "  make test-e2e-docker Run e2e tests against Docker containers\n"

setup:
	uv sync --all-groups
	cd frontend && npm install && npx playwright install
	test -f .env || cp .env.example .env
	test -f .agent.env || cp .agent.env.example .agent.env
	test -f .docker.env || cp .docker.env.example .docker.env

back:
	$(CHECK_LOCAL_ENV)
	uv run python -m backend.dev

back-once:
	$(CHECK_LOCAL_ENV)
	uv run python -m backend.main

front:
	$(CHECK_LOCAL_ENV)
	cd frontend && VITE_BACKEND_URL=/api VITE_DEV_PROXY_TARGET=$(LOCAL_BACKEND_URL) npm run dev -- --host $(FRONTEND_BIND_HOST) --port $(FRONTEND_PORT)

open:
	$(CHECK_LOCAL_ENV)
	open $(LOCAL_FRONTEND_URL)

back-lan:
	$(CHECK_LOCAL_ENV)
	$(CHECK_WIFI_IP)
	APP_HOST=0.0.0.0 APP_PORT=$(LAN_BACKEND_PORT) FRONTEND_ORIGIN=$(LAN_FRONTEND_URL) uv run python -m backend.dev

front-lan:
	$(CHECK_LOCAL_ENV)
	$(CHECK_WIFI_IP)
	cd frontend && VITE_BACKEND_URL=/api VITE_DEV_PROXY_TARGET=$(LAN_BACKEND_URL) npm run dev -- --host 0.0.0.0 --port $(LAN_FRONTEND_PORT)

open-lan:
	$(CHECK_LOCAL_ENV)
	$(CHECK_WIFI_IP)
	@echo "Open $(LAN_FRONTEND_URL)"
	open $(LAN_FRONTEND_URL)

aback:
	$(CHECK_LOCAL_ENV)
	$(CHECK_AGENT_ENV)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	./scripts/kill_port.sh "$(AGENT_BACKEND_PORT)"
	uv run python ./scripts/agent_db_snapshot.py
	echo $$$$ > "$(AGENT_BACKEND_PID)"; \
	exec env APP_MODE=$(APP_MODE) APP_DEBUG_LOGS=$(APP_DEBUG_LOGS) APP_HOST=$(AGENT_BACKEND_HOST) APP_PORT=$(AGENT_BACKEND_PORT) DB_PATH=$(AGENT_DB_PATH) COOKIE_SECRET=$(AGENT_COOKIE_SECRET) FRONTEND_ORIGIN=$(AGENT_FRONTEND_URL) uv run python -m backend.dev

aback-once:
	$(CHECK_LOCAL_ENV)
	$(CHECK_AGENT_ENV)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	./scripts/kill_port.sh "$(AGENT_BACKEND_PORT)"
	uv run python ./scripts/agent_db_snapshot.py
	echo $$$$ > "$(AGENT_BACKEND_PID)"; \
	exec env APP_MODE=$(APP_MODE) APP_DEBUG_LOGS=$(APP_DEBUG_LOGS) APP_HOST=$(AGENT_BACKEND_HOST) APP_PORT=$(AGENT_BACKEND_PORT) DB_PATH=$(AGENT_DB_PATH) COOKIE_SECRET=$(AGENT_COOKIE_SECRET) FRONTEND_ORIGIN=$(AGENT_FRONTEND_URL) uv run python -m backend.main

afront:
	$(CHECK_AGENT_ENV)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	./scripts/kill_port.sh "$(AGENT_FRONTEND_PORT)"
	cd frontend && echo $$$$ > "$(AGENT_FRONTEND_PID)" && exec env VITE_BACKEND_URL=/api VITE_DEV_PROXY_TARGET=$(AGENT_BACKEND_URL) npm run dev -- --host $(AGENT_FRONTEND_HOST) --port $(AGENT_FRONTEND_PORT)

aopen:
	$(CHECK_AGENT_ENV)
	open $(AGENT_FRONTEND_URL)

astop:
	$(CHECK_AGENT_ENV)
	@if [ -f "$(AGENT_BACKEND_PID)" ]; then kill "$$(cat "$(AGENT_BACKEND_PID)")" 2>/dev/null || true; rm -f "$(AGENT_BACKEND_PID)"; fi
	@if [ -f "$(AGENT_FRONTEND_PID)" ]; then kill "$$(cat "$(AGENT_FRONTEND_PID)")" 2>/dev/null || true; rm -f "$(AGENT_FRONTEND_PID)"; fi
	./scripts/kill_port.sh "$(AGENT_BACKEND_PORT)"
	./scripts/kill_port.sh "$(AGENT_FRONTEND_PORT)"

aclean:
	$(CHECK_AGENT_ENV)
	$(MAKE) --no-print-directory astop
	rm -rf "$(AGENT_RUNTIME_DIR_ABS)"

abrowser:
	$(CHECK_AGENT_ENV)
	@test -n "$(SCRIPT)" || (echo "Missing SCRIPT=path/to/scenario.mjs for make abrowser."; exit 1)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	cd frontend && node ./scripts/agent_browser_runner.mjs "$(SCRIPT)"

alogin:
	$(CHECK_AGENT_ENV)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	BODY="$$(python3 -c 'import json, sys; print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))' "$(ALOGIN_USER)" "$(ALOGIN_PASS)")"; \
	curl -sS -c "$(AGENT_COOKIE_JAR)" -b "$(AGENT_COOKIE_JAR)" -H "Origin: $(AGENT_FRONTEND_URL)" -H "Content-Type: application/json" -X POST "$(AGENT_BACKEND_URL)/api/auth/login" --data "$$BODY"

apost:
	$(CHECK_AGENT_ENV)
	@test -n "$(API_PATH)" || (echo "Missing API_PATH=/api/... for make apost."; exit 1)
	mkdir -p "$(AGENT_RUNTIME_DIR_ABS)"
	curl -sS -c "$(AGENT_COOKIE_JAR)" -b "$(AGENT_COOKIE_JAR)" -H "Origin: $(AGENT_FRONTEND_URL)" -H "Content-Type: application/json" -X POST "$(AGENT_BACKEND_URL)$(API_PATH)" --data '$(APOST_BODY)'

ahealth:
	$(CHECK_AGENT_ENV)
	curl -fsS "$(AGENT_BACKEND_URL)/api/health"

asql:
	$(CHECK_AGENT_ENV)
	@test -n "$(SQL)" || (echo "Missing SQL='select ...' for make asql."; exit 1)
	uv run python ./scripts/agent_sql.py "$(SQL)"

adb-path:
	$(CHECK_AGENT_ENV)
	python3 -c 'from pathlib import Path; print(Path("$(AGENT_DB_PATH)").resolve())'

back-docker:
	$(CHECK_DOCKER_ENV)
	$(DOCKER_COMPOSE) up -d --build backend

front-docker:
	$(CHECK_DOCKER_ENV)
	$(DOCKER_COMPOSE) up -d --build frontend gateway

open-docker:
	$(CHECK_DOCKER_ENV)
	/bin/sh -c 'set -a; . ./.docker.env; set +a; exec open "$$FRONTEND_ORIGIN"'

stop-docker:
	$(CHECK_DOCKER_ENV)
	$(DOCKER_COMPOSE) down --remove-orphans

clean-docker:
	$(CHECK_DOCKER_ENV)
	$(DOCKER_COMPOSE) down -v --remove-orphans --rmi local

deps-update-safe:
	uv add --bounds major $(PY_RUNTIME_DEPS)
	uv add --dev --bounds major $(PY_DEV_DEPS)
	cd frontend && npm update

deps-update-latest:
	uv add --bounds lower $(PY_RUNTIME_DEPS)
	uv add --dev --bounds lower $(PY_DEV_DEPS)
	cd frontend && npm update

format:
	uv run ruff format .
	cd frontend && npm run format

test:
	$(CHECK_LOCAL_ENV)
	uv run pytest
	cd frontend && npm run test
	cd frontend && npm run test:e2e

test-e2e-docker:
	$(CHECK_DOCKER_ENV)
	cd frontend && npm run test:e2e:docker
