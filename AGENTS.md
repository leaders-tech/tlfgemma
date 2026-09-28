# Template PWA Agent Notes

- The main user of this template is a school student who does not understand the technology deeply yet.
- Keep the template small and easy to read.
- Prefer the simplest working design over clever abstractions.
- Prefer explicit functions, explicit SQL, and explicit routes.
- Do not add heavy frameworks or hidden magic.
- Keep the current simplified web model unless the user asks for an architecture change:
  - production is same-origin behind nginx or Traefik;
  - dev-only CORS is for localhost splits;
  - browser API calls stay POST-based for this template.
- Keep production routing path-based for this template:
  - JSON endpoints live under `/api/...`;
  - websocket stays at `/ws`;
  - reverse proxy should send `/api` and `/ws` to backend and everything else to frontend.
- Keep all user-facing text in simple English.
- When adding backend DB code, place SQL only under `backend/db`.
- When adding frontend pages, keep routing and auth flow direct and beginner-friendly.
- Cover new behavior densely with tests: backend unit tests, frontend unit tests, and Playwright e2e tests where the
  feature crosses the browser boundary.
- Before calling any task done, run the full test suite (`make test`) and make sure every test passes.
  If a test breaks, fix it — do not skip or delete it.
- For auth, routing, cookies, WebSockets, startup, and other browser-sensitive flows, do not stop at tests. Also verify
  the real running app in a live browser session.
- After frontend, auth, routing, cookie, or WebSocket changes, verify the result in a live browser session, not only
  with tests.
- During that live check, look for browser console errors, failed network requests, cookie problems, and broken
  redirects before calling the task done.
- When local dev servers are already running, prefer checking the real dev app first and use tests as a second line of
  verification.
- Every source file should start with a short plain-English header comment or docstring that explains what the file
  does.
- That file header should also say when the file should be edited, and whether it can be copied as a starting point for
  adding a new table, endpoint, page, test, or similar feature.
- Use module docstrings for Python files.
- Use short top-of-file comments for TS, TSX, JS, CJS, CSS, HTML, env examples, TOML, and the Makefile when the file
  format allows comments.
- If the file format does not support comments cleanly, skip the header instead of breaking the file.
- Keep every file header short. Answer only: what this file does, when to edit it, and when to copy it.
- When a student adds a new feature, prefer the pattern: route -> db/helper file -> page/component -> unit tests ->
  e2e test if the browser flow changed.
- Extend an existing file only when the new code belongs to the same small feature block. Start a sibling file when the
  new code would make the old file feel crowded or mixed.
- Add Python packages with `uv add` for runtime deps and `uv add --dev` for dev-only deps.
- Add frontend packages with `npm install` for runtime deps and `npm install -D` for dev-only deps.
- Do not edit dependency lists by hand unless there is a strong reason and it is explained.
- Student-facing configuration belongs only in the root `.env` and `.docker.env` files.
- Do not add new user-tuned ports, URLs, secrets, modes, or project names to `Makefile`, compose files, Playwright configs, or Dockerfiles.
- Hidden agent-only configuration belongs in the root `.agent.env` file.
- When normal human local ports are busy, prefer the hidden agent runtime instead of changing the student-facing commands.
- Hidden agent runtime commands:
  - `make aback`, `make aback-once`, `make afront`, `make aopen`, `make astop`, `make aclean`
  - `make abrowser SCRIPT=path/to/scenario.mjs`
  - `make alogin USER=user PASS=user`
  - `make apost API_PATH=/api/... BODY='{}'`
  - `make ahealth`, `make asql SQL='select ...'`, `make adb-path`
- `aback` and `aback-once` must always recreate the hidden agent DB from the normal local DB before startup.
- Hidden agent runtime files live under `.agent/`.
- Keep `.docker.env` as the Docker config filename for this repo. Do not rename it to `.env.docker` unless the user explicitly asks.
- Keep the base `docker-compose.yml` platform-safe for `tlfpaas`:
  - no `ports:`
  - no local-only `build.args`
  - no Compose `user:`
  - no external networks or volumes
  - route-target services use `tlfpaas.route`
- Keep local Docker-only browser behavior in `docker-compose.local.yml`, not in the base compose file.
- Keep `frontend` on exposed port `8080`, `backend` on exposed port `8081`, backend APIs under `/api/...`, and WebSocket
  under `/ws` unless the routing model is intentionally changed everywhere.
- Keep runtime Docker images non-root by using `USER` in the final Dockerfile stage, not by adding Compose `user:`.
- Treat `COOKIE_SECRET` in `.docker.env.example` as a local placeholder only; real production secrets belong in the
  tlfpaas Secrets UI and require `Redeploy now`.
- Before changing Docker artefacts, read `docs/tlfpaas-autodeploy.md`.
- Keep LAN dev mode intentionally simple: prefer the explicit macOS Wi-Fi `en0` helper over generic network auto-detection.
- Keep LAN ports separate from the default localhost ports unless the user asks otherwise.
- Do not expand LAN mode into a multi-interface discovery system unless the user asks for broader network support.
