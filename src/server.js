const path = require("node:path");
const { createApp } = require("./app");

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "tasks.db");

const app = createApp({ dbPath });

app.listen(port, () => {
  console.log(`Task API listening on http://localhost:${port}`);
});
