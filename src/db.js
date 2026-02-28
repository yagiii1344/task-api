const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function createDatabase(dbPath) {
  const resolvedPath = dbPath || path.join(process.cwd(), "data", "tasks.db");
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

module.exports = { createDatabase };
