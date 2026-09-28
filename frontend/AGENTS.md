# Frontend Agent Notes

- This frontend is for students, so keep flows obvious and easy to inspect in a browser.
- Keep components small and readable — one file, one job.
- Use plain React state and small hooks. Do not add state managers (no Redux, Zustand, Jotai, etc.).
- Do not add a UI component library (no MUI, Ant Design, etc.). Tailwind CSS is already here.
- Keep all user-facing text in simple English.
- Keep browser API calls POST-based in this template — that is a deliberate teaching choice.
- Student-facing frontend config belongs in the root `.env` and `.docker.env` files, not in frontend-only env files.
- Keep frontend JSON calls on `/api/...` and keep websocket on `/ws` so same-origin production routing stays simple.
- Keep the production Docker build same-origin for tlfpaas: `VITE_BACKEND_URL` is the only current frontend build-time
  env var and should remain `/api` for production.
- If you add another public frontend build-time env var, use a `VITE_*` key and document it in `.docker.env.example`.
- Keep `frontend/Dockerfile` serving nginx on `8080` and keep the final runtime stage non-root with `USER nginx`.
- Hidden frontend agent commands:
  - `make afront`, `make aopen`, `make astop`
  - `make abrowser SCRIPT=path/to/scenario.mjs`
- Hidden frontend browser checks should prefer the agent frontend on `.agent.env` ports instead of the student-facing local ports when both may be active.

## File layout

- Pages live in `src/pages/`. Each page file should have a matching `.test.tsx` next to it.
- Reusable UI pieces used by more than one page go in `src/features/<feature>/` or `src/shared/`.
- TypeScript types shared across files belong in `src/shared/types.ts` — add new types there.
- Register a new page route in `src/app/App.tsx` whenever you add a new page file.

## How to call the backend

- Import `postJson` from `src/shared/api.ts` and call it with the route path and a plain object.
- Never write a raw `fetch` for backend routes — `postJson` handles cookie auth and error wrapping.
- If the server is not running or returns an error, `postJson` throws an `ApiError`.
  Catch it and show `error.message` to the user so they know what went wrong.

## How to use authentication

- Call `useAuth()` from `src/app/auth.tsx` to read the current logged-in user and the logout function.
- A protected page should redirect to `/login` when `useAuth().user` is `null`.
- Do not call `/api/auth/me` yourself — `AuthProvider` in `App.tsx` loads the session on startup automatically.

## Real-time updates (WebSocket)

- WebSocket connection logic lives in `src/shared/socket.ts`.
- The socket connects after login and disconnects on logout — do not manage the connection manually.
- To react to live server events, add a `useEffect` listener in the component that needs live data.
- Check the browser console for WebSocket errors after any auth or routing change.

## Tests — always keep them green

- Unit tests use Vitest + React Testing Library.
  Run: `cd frontend && npm test`
- End-to-end tests use Playwright and live in `frontend/tests/e2e/`.
  Run: `cd frontend && npm run test:e2e`
- Every new page needs at least one unit test.
- Every new user flow (login, save a note, etc.) needs an e2e test.
- **Always run `npm test` before calling a task done. Fix broken tests before moving on.**
- Do not delete a test just to make the suite pass — update it to match the new correct behavior.

## Normal growth pattern for a new feature

1. Add or update the TypeScript type in `src/shared/types.ts` if the data shape changed.
2. Add the API call inside the page or feature component.
3. Add or update the React component or page.
4. Add or copy a unit test (`.test.tsx` right next to the component file).
5. Open the feature in a live browser and check that it looks and works correctly.
6. Check the browser console for errors and the network tab for failed requests.
7. Add or update a Playwright e2e test if the change involves a full user flow.

## Other rules

- Copy an existing page file when you add another page with a similar shape.
- Copy an existing feature panel or test when you add another small feature block.
- Extend an existing file only when the new code still belongs to the same page, feature, or helper.
- Do not use deep relative imports like `../../../shared/...`. Keep files close to where they are used.
- Add runtime packages with `npm install <name>` and dev-only packages with `npm install -D <name>`.
- Start each file with a short comment block (2–4 lines): what this file does, when to edit it, and whether it can be copied as a starting point for a similar file.
