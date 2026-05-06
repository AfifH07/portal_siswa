---
description: Portal Siswa Baron coding rules and constraints
---

# Portal Siswa Baron — Coding Rules

## Token Efficiency (CRITICAL)
- NEVER read entire files — use grep_search to find specific functions
- NEVER do investigation/preview unless explicitly asked
- Go DIRECTLY to the specific function/section needed
- Only read the minimum code necessary to complete the task
- NEVER inject codebase context automatically

## Tech Stack
- Backend: Django 4.2 + DRF + SimpleJWT
- Frontend: Vanilla JS ES6+ + Baron Emerald Theme
- Database: SQLite (dev), PostgreSQL (prod)
- Deployment: PythonAnywhere (via GitHub)

## Critical Constraints (NEVER violate)
- user.name or user.username — NEVER use get_full_name()
- Student PK = nisn (CharField) — NEVER use auto-increment id
- apiFetch path WITHOUT /api/ prefix
- ALWAYS parse JSON: const data = await response.json()
- Use baron-emerald.css — NEVER use main.css
- Use FormData for file uploads — NEVER JSON
- NEVER change URLs, only change labels/text
- Script dependencies order must stay the same

## File Structure
- Backend: backend_django/apps/
- Frontend HTML: frontend/views/
- Frontend JS: frontend/public/js/
- Frontend CSS: frontend/public/css/baron-emerald.css

## UI Reference
- Main template: frontend/views/users.html
- Wizard template: frontend/views/attendance.html
- Always follow Baron Emerald Theme styling

## Editing Rules
- Show before/after snippets for EVERY change
- NEVER delete existing code unless explicitly asked
- NEVER modify unrelated functions/files
- Make the MINIMUM changes necessary