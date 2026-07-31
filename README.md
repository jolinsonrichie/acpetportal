# Work portal — UI

React + Vite. All data is mocked in `src/data.js`; no backend yet.

```bash
npm install
npm run dev
```

## Trying it out

The login screen accepts three demo addresses:

- `anjali@example.org` — employee
- `meera@example.org` — vertical lead (gets the extra Team tab)
- `deepak@example.org` — director (budget visible)

There's also a "View as" bar pinned to the bottom for switching between them
without signing out. **Delete that block from `src/App.jsx` before deploying.**

## Structure

```
src/
  data.js               mock data + selectors, shaped like the real schema
  App.jsx               role-based routing
  components/ui.jsx     avatars, pills, tabs, metrics, empty states
  components/Team.jsx   work item card, person card grid / table toggle
  screens/Login.jsx
  screens/EmployeeHome.jsx
  screens/DirectorHome.jsx
```

## Wiring up Supabase later

Every component imports from `src/data.js` and nothing else touches data. To go
live, replace each exported selector with a Supabase query of the same shape —
component code should not need to change. The visibility helpers at the bottom
of that file (`visibleUsers`, `visibleItems`, `canSeeBudget`) mirror the
intended RLS policies; once RLS is live they become redundant, because the
database will already be filtering.

Do not keep them as the security boundary. They are here so the mock behaves
realistically, nothing more.
