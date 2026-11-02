# Tasxity

MERN task manager. `frontend/` (React + Vite) and `backend/` (Express + MongoDB).

## Run
1. Start MongoDB locally (or set `MONGO_URI` in `backend/.env` to an Atlas URI).
2. Backend: `cd backend && npm run dev` → http://localhost:5001
3. Frontend: `cd frontend && npm run dev` → http://localhost:5173

## Routes
- `/` landing page → `/signup` or `/login` → `/dashboard` (protected)
- API: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `GET|POST /api/tasks`, `PUT /api/tasks/:id`, `PUT /api/tasks/reorder`, `DELETE /api/tasks/:id`, `GET|POST /api/projects`, `PUT|DELETE /api/projects/:id`
- Projects are owned by the authenticated user. Project updates support archiving with `{ "archived": true }`; project list includes active and archived projects.
- Tasks can be filtered by project with `GET /api/tasks?projectId=<id>` and created/updated with a `projectId`. Project deletion also removes that project's tasks.
- Tasks support status, priority, description, due date, subtasks, completion timestamp, and persisted Kanban order. Kanban order is per-user and per-status.
- Phase 5 APIs: `GET /api/tasks/summary?timezone=<IANA zone>`, `GET /api/tasks/my-day?date=YYYY-MM-DD&timezone=<IANA zone>`, and `PUT /api/auth/preferences`. Date-only `plannedDate` and `focusDate` are separate from task due dates.
- Phase 6 recurring tasks use a bounded recurrence (`recurrence.endDate` or `recurrence.occurrenceLimit`) and generate the next occurrence when a task is completed. Recurrences are generated on demand; no always-running worker is required.
- Task reminders are persistent in MongoDB. `GET /api/reminders` returns due notifications and upcoming reminders; `PATCH /api/reminders/:id` supports dismiss and snooze actions. Reminders are delivered while an authenticated Tasxity client is open; delivery is not guaranteed while the browser is closed.
- Focus sessions use `POST /api/focus`, `GET /api/focus/active`, and `POST /api/focus/:id/action` (`pause`, `resume`, `finish`, or `cancel`). `GET /api/focus/summary?timezone=<IANA zone>` returns session analytics. Productivity preferences extend `PUT /api/auth/preferences`.
- The dashboard provides Command Palette (`Cmd/Ctrl+K`), global shortcuts (`N`, `/`, `G` then `O|M|C`, `Escape`), keyboard-shortcut help, and Focus Mode. Browser notification permission is requested only when enabled in Preferences.
- Smart Paste supports numbered, bulleted, checkbox, Markdown heading, and plain-text task lines. Review and select entries before creating up to 100 tasks with `POST /api/tasks/bulk`; the authenticated endpoint validates project ownership and uses an `Idempotency-Key` header to prevent duplicate submissions. Task lists and Kanban support selection and plain, Markdown checklist, or detailed clipboard formats. `GET /api/tasks/project-export?projectId=<id>&offset=<n>&limit=200` returns bounded pages for copying a complete project task list. Paste Tasks is available from the dashboard, My Tasks, and project views (`Cmd/Ctrl+Shift+V` outside text fields).
