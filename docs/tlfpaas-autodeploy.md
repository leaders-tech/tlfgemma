# tlfpaas Autodeploy Contract

This document is for agents and template authors who edit this project. It
explains the Docker shape that must stay compatible with tlfpaas autodeploy.

This file is not a general Docker tutorial. It documents the exact contract used
by this template.

## Current Deployment Shape

`templatePWA` is a same-origin app with two public services:

- `frontend` serves the built React app through nginx on port `8080`;
- `backend` serves JSON APIs and WebSocket on port `8081`;
- Caddy/tlfpaas routes `/api*` and `/ws*` to `backend`;
- Caddy/tlfpaas routes everything else to `frontend`;
- SQLite data lives under `/data` in the backend container;
- `/data` is backed by the `sqlite_data` named volume.

The base `docker-compose.yml` is the production/tlfpaas-safe file. Local-only
browser gateway behavior lives in `docker-compose.local.yml`.

## Files And Ownership

| File | Purpose |
|---|---|
| `docker-compose.yml` | Platform-safe service shape for tlfpaas and same-origin production. |
| `docker-compose.local.yml` | Local Docker-only gateway and frontend build args. Not used by tlfpaas. |
| `.docker.env.example` | Student-facing Docker config template. Non-secret values only. |
| `.docker.env` | Local copy ignored by git. Do not commit real secrets. |
| `frontend/Dockerfile` | Production frontend image. Final stage must run as non-root `nginx`. |
| `backend/Dockerfile` | Production backend image. Final stage must run as non-root `app`. |

## Base Compose Rules

Keep `docker-compose.yml` deploy-safe:

- use `expose`, not `ports`;
- keep route-target labels as `tlfpaas.route: "frontend"` and `tlfpaas.route: "backend"`;
- do not add raw `build.args`;
- do not add Compose `user`;
- do not add external networks or external volumes;
- do not add `privileged`, `network_mode`, `cap_add`, `devices`, `extra_hosts`, `secrets`, or `configs`;
- do not add `caddy.*` labels;
- do not add custom `tlfpaas.*` labels except `tlfpaas.route`.

tlfpaas owns runtime security settings, resource limits, Caddy labels, runtime
env file injection, logging limits, and platform metadata labels.

## Routing Contract

The current public routing contract is:

```yaml
services:
  backend:
    expose:
      - "8081"
    labels:
      tlfpaas.route: "backend"

  frontend:
    expose:
      - "8080"
    labels:
      tlfpaas.route: "frontend"
```

Traffic flow:

```text
/api* -> backend:8081
/ws*  -> backend:8081
/*    -> frontend:8080
```

Do not move browser API routes away from `/api/...` or WebSocket away from
`/ws` unless you also update the routing model, tests, docs, and nginx/local
gateway behavior.

## Dockerfile Contract

Both final runtime images must run as non-root users.

Frontend:

- keep nginx listening on `8080`;
- keep `USER nginx` in the final stage;
- keep `VITE_BACKEND_URL` as the only current frontend build-time variable;
- keep `VITE_BACKEND_URL=/api` for tlfpaas and same-origin production.

Backend:

- listen on `0.0.0.0`;
- keep Docker `APP_PORT=8081`;
- keep `USER app` in the final stage;
- write persistent SQLite data under `/data`;
- write temporary files only to `/tmp` or `/data`.

Do not solve non-root runtime requirements by adding Compose `user`. tlfpaas
rejects that field. Set `USER` in the Dockerfile final stage instead.

## `.docker.env` Contract

`.docker.env` and `.docker.env.example` are student-facing local Docker config
files. They may contain local placeholder values.

Current important values:

```env
APP_MODE=dev
DB_PATH=/data/app.sqlite3
FRONTEND_ORIGIN=http://localhost:5105
VITE_BACKEND_URL=/api
```

`COOKIE_SECRET=local-docker-secret` is only a local placeholder. In tlfpaas
production, configure `COOKIE_SECRET` in the student Secrets UI and click
`Redeploy now`.

If adding frontend build-time config, use only public client-visible prefixes:

```text
VITE_
NEXT_PUBLIC_
NUXT_PUBLIC_
PUBLIC_
```

Never put API tokens, passwords, private keys, or real cookie secrets in
`.docker.env.example`.

## Adding Redis

If the template grows a Redis-backed feature, keep Redis private:

```yaml
services:
  redis:
    image: redis:7.4-alpine
    volumes:
      - redis_data:/data

  backend:
    depends_on:
      - redis
    environment:
      REDIS_URL: redis://redis:6379/0

volumes:
  redis_data:
```

Do not add `tlfpaas.route` to Redis. Do not publish Redis with `ports`.

## Adding NATS Or A Worker

If the template grows a queue or background worker, keep internal services
private:

```yaml
services:
  nats:
    image: nats:2.10-alpine
    command: ["-js"]
    volumes:
      - nats_data:/data

  worker:
    build:
      context: .
      dockerfile: backend/Dockerfile
    depends_on:
      - nats
    environment:
      NATS_URL: nats://nats:4222

  backend:
    depends_on:
      - nats
    environment:
      NATS_URL: nats://nats:4222

volumes:
  nats_data:
```

Do not add a route label to `nats` or `worker`. Only the existing `frontend` and
`backend` route targets should be public.

## Do Not Change Casually

These values are part of the deployment contract:

- frontend port: `8080`;
- backend port: `8081`;
- frontend API base path: `VITE_BACKEND_URL=/api`;
- backend API route prefix: `/api/...`;
- backend WebSocket path: `/ws`;
- backend data path: `/data/app.sqlite3`;
- named volume: `sqlite_data:/data`;
- route labels: `tlfpaas.route: "frontend"` and `tlfpaas.route: "backend"`;
- final Dockerfile users: `USER nginx` and `USER app`.

Changing any of these requires updating Compose, Dockerfiles, local Docker
gateway, tests, README, and this document together.

## Pre-merge Checklist

Before changing Docker-related files, confirm:

- `docker-compose.yml` still has no `ports`;
- `docker-compose.yml` still has no Compose `user`;
- public services use exactly one `expose` port;
- private services have no `tlfpaas.route`;
- final Dockerfile stages set non-root `USER`;
- `.docker.env.example` contains no real secrets;
- local Docker-only behavior remains in `docker-compose.local.yml`;
- tlfpaas production behavior remains in `docker-compose.yml`.

Useful checks:

```bash
docker compose --env-file .docker.env -f docker-compose.yml config --quiet
docker compose --env-file .docker.env -f docker-compose.yml -f docker-compose.local.yml config --quiet
```
