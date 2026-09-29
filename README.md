# Portal.FrontEnd

Angular 20 client for the Portal Customer Support CRM. The API lives in the sibling
[`Portal.API`](../Portal.API) folder; its README covers the whole system, the architecture
and the spec for each module.

## Prerequisites

* Node.js 22+ and npm 10+
* The API running on `http://localhost:5120` (see `../Portal.API/README.md`)

## Run

```bash
npm install
npm start            # http://localhost:4200
```

Sign in with the seeded administrator: **admin@portal.local / Admin@12345** (development only).

| Command | What it does |
|---|---|
| `npm start` | Dev server with live reload, API at `http://localhost:5120/api` |
| `npm run build` | Production build to `dist/` (API expected at `/api` on the same host) |
| `npm run test:ci` | Unit tests once in headless Chrome |
| `npm test` | Unit tests in watch mode |

The API URL is set in `src/environments/environment*.ts`.

## Structure

```
src/
  styles/                 Design system: _tokens.scss (the only place colors/fonts/sizes live),
                          _base.scss, _components.scss (buttons, forms, tables, badges, cards)
  app/
    core/                 App-wide singletons
      auth/               AuthService (session + permissions as signals), guards, permission keys
      http/               authInterceptor (bearer token), errorInterceptor (ProblemDetails → ApiError + toast)
    shared/
      ui/                 Reusable components: modal, confirm dialog, toast, toggle switch,
                          pagination, sort header, page header, form field, empty state, spinner, icon
      directives/         *appHasPermission
      utils/              Form error mapping, password policy, formatting
    layout/               Shell (sidebar + top bar) and the navigation config
    features/             One folder per module: auth, home, users, roles, account, errors
```

## UI conventions (keep every page consistent)

* **Never hard-code a color, font size, spacing or radius.** Use the CSS variables from
  `src/styles/_tokens.scss` (`var(--color-primary)`, `var(--fs-sm)`, `var(--space-4)`, …).
* Build pages from the shared classes and components: `.page`, `<app-page-header>`, `.card`,
  `.toolbar`, `.table`, `.btn-*`, `.badge-*`, `<app-form-field>`, `<app-modal>`, `<app-pagination>`.
* One font family (Noto Sans / Noto Sans Arabic) and one type scale (12–28px).
* Every mutation gives feedback with a toast; destructive actions go through `ConfirmService`;
  lists show loading and empty states.
* Use logical CSS properties (`margin-inline-start`, `inset-inline-end`) so the layout is RTL-ready.

## Permissions in the UI

* Routes declare `data: { permissions: [...] }` and use `permissionGuard`.
* Menu entries in `layout/navigation.ts` declare the permissions that reveal them.
* Buttons use `*appHasPermission="P.Users.Create"` (any of several keys may be passed).
* The server is always the real gate; the UI only hides what the user cannot do. When the API
  answers 403, the profile is refreshed so the UI catches up with permission changes.
* The role permissions screen is entirely data-driven: new permissions from new backend modules
  appear with toggles automatically.
