# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Keep route-level pages focused on rendering and use the shared API client for relative `/api` requests. Each capability page will expose loading, empty, and error states accessibly.
- Logic tier decision: Keep request validation and capability behavior in the Express service layer, with routes responsible for HTTP status codes and response shapes. Do not add authentication.
- Data tier decision: Use Mongoose models for required fields and relationships. Seed stable demo records with upserts, without deleting unrelated application data; keep seed runs idempotent.
- Activity tracking approach: Validate the request shape, ID format, and existence of both referenced records before creating an activity. Store the submitted user, team, type, and minutes with computed points and an occurrence date; reject invalid input with a deliberate 4xx.
- Team management approach: Require a non-empty team name, preserve the submitted name and mascot, and store member references as user IDs.
- Leaderboard approach: Sum activity points by team, sort totals highest-first, and return each team name, total, and 1-based rank.
- Workout suggestions approach: Find the user by email and use their fitness goal and recent activity to prioritize matching workouts. Include a reason for the first suggestion and return a deliberate 4xx when the user does not exist.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend` — failures indicate missing model constraints/relationships or seed data that is incomplete, destructive, or not idempotent.
- API command: `npm run test:api --prefix octofit-tracker/backend` — failures indicate incorrect endpoint validation, status codes, response shapes, persistence, leaderboard ordering, or personalized workout suggestions.
- Frontend command: `npm test --prefix octofit-tracker/frontend` — failures indicate missing API integration, route-specific content, accessible loading/empty/error states, or workout-user selection.
- Backend build command: `npm run build --prefix octofit-tracker/backend` — failures indicate TypeScript errors in backend models, services, routes, or scripts.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend` — failures indicate TypeScript or Vite build errors in the presentation tier.
