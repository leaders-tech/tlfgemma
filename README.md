# TLF-Gemma

A small competition workspace built with React, aiohttp and SQLite. Everyone signs in through TLF Auth. Each user has one private chat; `teacher` and `admin` can read all users' histories. Only `admin` can clear all messages and reset every quota.

## Local development

```sh
make setup
make back
# In another terminal:
make front
```

Set these values in the root `.env`:

```dotenv
X_CLIENT_ID=tlfgemma
X_SECRET=your-client-secret
X_OIDC_ISSUER=https://auth.leaders.tech
OPENROUTER_API_KEY=your-openrouter-key
```

The local auth service can also be used with `X_OIDC_ISSUER=http://localhost:8000`. Use the exact issuer returned by discovery, even when its discovery URL was opened through `127.0.0.1`.

Register each frontend origin plus `/api/auth/oidc/callback` in the auth service. Normal development defaults to `http://localhost:5101/api/auth/oidc/callback`. The hidden agent runtime uses `http://127.0.0.1:5102/api/auth/oidc/callback`. Use `make aback`, `make afront`, and `make aopen` for that runtime; its settings are in `.agent.env` and its DB is copied from the normal DB before every backend start. `make alogin` opens the browser for OIDC sign-in; there is no password login or dev bypass.

## Deploy on deploy.leaders.tech

Use the base `docker-compose.yml`. Set production environment values:

```dotenv
APP_MODE=prod
APP_DEBUG_LOGS=0
DB_PATH=/data/tlfgemma.sqlite3
FRONTEND_ORIGIN=https://tlfgemma.tlfedu.tech
X_OIDC_ISSUER=https://auth.leaders.tech
X_CLIENT_ID=tlfgemma
VITE_BACKEND_URL=/api
```

Set `X_SECRET`, `OPENROUTER_API_KEY` and `COOKIE_SECRET` in the Secrets UI and click **Redeploy now**. The client ID and secret use `X_` names because the deployment platform reserves the plain names. Never put real secrets in example files or frontend variables. `COOKIE_SECRET` is retained for template compatibility; sessions use random 48-byte tokens whose SHA-256 hashes are stored in SQLite, not signed browser claims.

Set `FRONTEND_ORIGIN` and `X_OIDC_ISSUER` in deployment settings too. Updating the repository's `.docker.env.example` does not replace values already saved by the deployment platform. A missing or HTTP URL in production stops the backend and can appear as a proxy `502`; correct the named setting and redeploy. Do not switch production to `APP_MODE=dev` to bypass this check.

Registered production callback:

```text
https://tlfgemma.tlfedu.tech/api/auth/oidc/callback
```

OIDC uses discovery, the confidential client code flow and scopes `openid email profile`. ID tokens are validated against the issuer's JWKS. Userinfo supplies the email and roles. A session lasts 12 hours; signing in again refreshes identity and roles. Sign-out revokes the local session, not the central TLF session.

Route `/api` and `/ws` to backend `8081`; everything else to frontend `8080`. Keep one backend process/replica: active generations and socket connections live in memory, while history, quota reservations and sessions are durable SQLite data. `/data` uses the `sqlite_data` volume. Back up that volume regularly. The new `tlfgemma.sqlite3` does not import or overwrite the template's old database.

For local Docker, copy `.docker.env.example` to `.docker.env`, set `APP_MODE=dev` and `FRONTEND_ORIGIN=http://localhost:5105`, register that callback and supply real credentials. Run `make back-docker`, `make front-docker`. The local gateway is only in `docker-compose.local.yml`.

## Competition rules

- Exactly `google/gemma-4-31b-it`; one current user message, no history or hidden system message, no tools, reasoning disabled.
- Input and visible output: at most 1,000 Unicode code points. An emoji can contain several code points. Input overflow stays editable but cannot be sent. The server caps output before saving or streaming it.
- 60 accepted requests in a rolling 60 minutes, including teacher/admin test chats. One active generation per user. Failed/interrupted requests with no answer refund their slot; partial answers still count.
- The server reserves quota atomically. A UUID request ID prevents duplicate model calls after a network retry. Browser disconnects do not cancel answers. A restart marks unfinished answers interrupted and preserves saved partial text.
- Markdown, code and KaTeX are rendered safely; raw HTML and images are disabled. Only unfinished triple-backtick and block-math delimiters get a small display-only repair. **Copy raw** copies the original answer, including truncation.
- Histories have 50-item pages and cannot be edited. Admin reset cancels active requests, deletes all history and resets all quotas while keeping users and sessions.

## API

All browser JSON calls are POST and return `{ok: true, data: ...}` or `{ok: false, error: {code, message}}`.

| Endpoint | Purpose |
| --- | --- |
| `/api/auth/login` | Return OIDC authorization URL and bind state to the browser. |
| GET `/api/auth/oidc/callback` | Validate code, state, nonce and identity; create session and redirect home. |
| `/api/auth/me`, `/api/auth/logout` | Read or revoke the current session. |
| `/api/chat/send` | Accept `{text, request_id}` and return the exchange plus quota. |
| `/api/chat/history` | Read `{user_id?, before?}`; cross-user reads require teacher/admin. |
| `/api/chat/quota` | Return remaining count, server time and next slot time. |
| `/api/review/users` | Search `{search?, after?}`; teacher/admin only. |
| `/api/admin/clear` | Admin-only reset with `{confirm: "CLEAR ALL HISTORY"}`. |

`/ws` authenticates with the session cookie and validates Origin. `chat.updated` contains the full saved exchange, monotonically increasing version and quota; `history.cleared` invalidates history. Reconnect reloads the latest persisted messages. No OIDC tokens or model API key reach the browser.

## Checks

```sh
make test
cd frontend && npm run build
# Optional, when Docker is running:
make test-e2e-docker
```

`make test` runs backend, frontend unit and Playwright tests. Tests use isolated databases and local test-only OIDC/OpenRouter servers, with real signed JWTs and streaming HTTP responses. They never call the paid model or require your auth password. Test-service entrypoints are never used by the production app.
