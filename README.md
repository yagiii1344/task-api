# Task API

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)

A minimal Task API built with Express and SQLite. It provides CRUD operations for tasks with pagination and optional status filtering.

## Tech Stack

- Node.js
- Express
- SQLite (`better-sqlite3`)
- Jest
- Supertest

## Setup

```bash
npm install
```

## Run (Dev)

```bash
npm run dev
```

## Test

```bash
npm test
```

## Environment Variables

- `PORT`: Server port (default: `3000`)
- `DB_PATH`: SQLite database file path (default: `./data/tasks.db`)

## API Endpoints

- `GET /tasks?page=1&limit=20&status=open`
- `GET /tasks/:id`
- `POST /tasks`
  ```json
  { "title": "My task" }
  ```
- `PATCH /tasks/:id`
  ```json
  { "title": "Updated task", "status": "open|in-progress|done" }
  ```
- `DELETE /tasks/:id`

### Example Response: `GET /tasks`

```json
{
  "page": 1,
  "limit": 20,
  "total": 2,
  "items": [
    {
      "id": 1,
      "title": "Write docs",
      "status": "open",
      "created_at": "2026-02-28 12:00:00"
    },
    {
      "id": 2,
      "title": "Ship API",
      "status": "done",
      "created_at": "2026-02-28 12:05:00"
    }
  ]
}
```
