# Vook frontend

Vook is a standalone React application. It does not require the legacy backend to run.

## Start in demo mode

```bash
npm install
npm run dev
```

`VITE_DATA_MODE` defaults to `mock`. The login screen provides one-click accounts for every supported role. Demo mutations persist in IndexedDB and can be restored with **Reset data**.

The demo is a connected SaaS simulation rather than isolated fixtures: plan drafts publish immutable versions, companies pin a version, entitlements control navigation and permissions, scoped roles filter records, approvals advance through actors, and billing/onboarding/audit records survive reloads.

## Connect a backend

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://api.example.com/api/v2
VITE_REALTIME_URL=https://api.example.com
```

No page should change when switching data sources. See [the OpenAPI contract](docs/openapi-v2.yaml), [backend handoff](docs/backend-handoff.md), and [realtime contract](docs/realtime-v2.md).

## Quality commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run generate:api
npm run verify:api
```

The production output is `dist/`. Deployment automation intentionally does not live in this repository.
