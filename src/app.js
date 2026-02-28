const express = require("express");
const { createDatabase } = require("./db");

const ALLOWED_STATUSES = new Set(["open", "in-progress", "done"]);

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function parseIntegerQuery(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function createApp(options = {}) {
  const app = express();
  const db = createDatabase(options.dbPath);

  const countTasks = db.prepare("SELECT COUNT(*) AS total FROM tasks");
  const countTasksByStatus = db.prepare("SELECT COUNT(*) AS total FROM tasks WHERE status = ?");
  const selectTasksPage = db.prepare(
    "SELECT id, title, status, created_at FROM tasks ORDER BY id ASC LIMIT ? OFFSET ?"
  );
  const selectTasksPageByStatus = db.prepare(
    "SELECT id, title, status, created_at FROM tasks WHERE status = ? ORDER BY id ASC LIMIT ? OFFSET ?"
  );
  const selectTaskById = db.prepare(
    "SELECT id, title, status, created_at FROM tasks WHERE id = ?"
  );
  const insertTask = db.prepare("INSERT INTO tasks (title) VALUES (?)");
  const updateTask = db.prepare(
    "UPDATE tasks SET title = COALESCE(?, title), status = COALESCE(?, status) WHERE id = ?"
  );
  const deleteTask = db.prepare("DELETE FROM tasks WHERE id = ?");

  app.use(express.json());
  app.locals.db = db;

  app.get("/tasks", (req, res) => {
    const page = parseIntegerQuery(req.query.page, 1);
    const limit = parseIntegerQuery(req.query.limit, 20);
    const hasStatus = req.query.status !== undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    if (page === null || page < 1) {
      return res.status(400).json({ error: "page must be an integer >= 1" });
    }

    if (limit === null || limit < 1 || limit > 100) {
      return res.status(400).json({ error: "limit must be an integer between 1 and 100" });
    }

    if (hasStatus && !status) {
      return res.status(400).json({ error: "status must be a non-empty string" });
    }
    if (hasStatus && !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be one of: open, in-progress, done" });
    }

    const offset = (page - 1) * limit;
    const total = hasStatus ? countTasksByStatus.get(status).total : countTasks.get().total;
    const items = hasStatus
      ? selectTasksPageByStatus.all(status, limit, offset)
      : selectTasksPage.all(limit, offset);

    res.status(200).json({ page, limit, total, items });
  });

  app.get("/tasks/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!isValidId(id)) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = selectTaskById.get(id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(200).json(task);
  });

  app.post("/tasks", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const result = insertTask.run(title);
    const task = selectTaskById.get(result.lastInsertRowid);
    return res.status(201).json(task);
  });

  app.patch("/tasks/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!isValidId(id)) {
      return res.status(404).json({ error: "Task not found" });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body ?? {}, "title");
    const hasStatus = Object.prototype.hasOwnProperty.call(req.body ?? {}, "status");
    if (!hasTitle && !hasStatus) {
      return res.status(400).json({ error: "title or status is required" });
    }

    const title = hasTitle && typeof req.body.title === "string" ? req.body.title.trim() : null;
    const status = hasStatus && typeof req.body.status === "string" ? req.body.status.trim() : null;

    if ((hasTitle && !title) || (hasStatus && !status)) {
      return res.status(400).json({ error: "title/status must be non-empty strings" });
    }
    if (hasStatus && !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be one of: open, in-progress, done" });
    }

    const result = updateTask.run(title, status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = selectTaskById.get(id);
    return res.status(200).json(task);
  });

  app.delete("/tasks/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!isValidId(id)) {
      return res.status(404).json({ error: "Task not found" });
    }

    const result = deleteTask.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(204).send();
  });

  return app;
}

module.exports = { createApp };
