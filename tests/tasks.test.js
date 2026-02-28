const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const { createApp } = require("../src/app");

const testDataDir = path.join(__dirname, "tmp");

function createTestDbPath() {
  fs.mkdirSync(testDataDir, { recursive: true });
  return path.join(
    testDataDir,
    `tasks-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
}

describe("Task API", () => {
  let app;
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = createTestDbPath();
    app = createApp({ dbPath });
    db = app.locals.db;
  });

  afterEach(() => {
    if (db) {
      db.close();
    }

    [dbPath, `${dbPath}-shm`, `${dbPath}-wal`].forEach((file) => {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  test("GET /tasks returns 200 with default pagination payload", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      items: [],
    });
  });

  test("GET /tasks returns 400 for invalid page/limit", async () => {
    const invalidRequests = [
      "/tasks?page=0",
      "/tasks?page=-1",
      "/tasks?page=abc",
      "/tasks?limit=0",
      "/tasks?limit=101",
      "/tasks?limit=abc",
    ];

    for (const url of invalidRequests) {
      const res = await request(app).get(url);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    }
  });

  test("GET /tasks returns 400 for invalid status", async () => {
    const res = await request(app).get("/tasks?status=   ");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /tasks returns 400 for unknown status value", async () => {
    const res = await request(app).get("/tasks?status=banana");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /tasks returns correct slice for page and limit", async () => {
    for (let i = 1; i <= 5; i += 1) {
      await request(app).post("/tasks").send({ title: `Task ${i}` });
    }

    const res = await request(app).get("/tasks?page=2&limit=2");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ title: "Task 3" });
    expect(res.body.items[1]).toMatchObject({ title: "Task 4" });
  });

  test("GET /tasks filters by status and returns filtered total", async () => {
    const open1 = await request(app).post("/tasks").send({ title: "Open 1" });
    const open2 = await request(app).post("/tasks").send({ title: "Open 2" });
    const done1 = await request(app).post("/tasks").send({ title: "Done 1" });
    const done2 = await request(app).post("/tasks").send({ title: "Done 2" });

    await request(app).patch(`/tasks/${done1.body.id}`).send({ status: "done" });
    await request(app).patch(`/tasks/${done2.body.id}`).send({ status: "done" });

    const res = await request(app).get("/tasks?status=done");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((item) => item.status === "done")).toBe(true);
    expect(res.body.items[0].id).toBe(done1.body.id);
    expect(res.body.items[1].id).toBe(done2.body.id);

    await request(app).patch(`/tasks/${open1.body.id}`).send({ status: "open" });
    await request(app).patch(`/tasks/${open2.body.id}`).send({ status: "open" });
  });

  test("POST /tasks returns 201 with created task", async () => {
    const res = await request(app).post("/tasks").send({ title: "Write tests" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: "Write tests", status: "open" });
    expect(typeof res.body.created_at).toBe("string");
  });

  test("POST /tasks returns 400 when title is missing", async () => {
    const res = await request(app).post("/tasks").send({});
    expect(res.status).toBe(400);
  });

  test("GET /tasks/:id returns 200 for existing task", async () => {
    const created = await request(app).post("/tasks").send({ title: "Read docs" });
    const res = await request(app).get(`/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Read docs", status: "open" });
  });

  test("GET /tasks/:id returns 404 when not found", async () => {
    const res = await request(app).get("/tasks/99999");
    expect(res.status).toBe(404);
  });

  test("PATCH /tasks/:id updates title or status and returns 200", async () => {
    const created = await request(app).post("/tasks").send({ title: "Initial title" });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ title: "Updated title", status: "done" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Updated title", status: "done" });
  });

  test("PATCH /tasks/:id returns 400 for invalid payload", async () => {
    const created = await request(app).post("/tasks").send({ title: "Initial title" });
    const res = await request(app).patch(`/tasks/${created.body.id}`).send({});
    expect(res.status).toBe(400);
  });

  test("PATCH /tasks/:id rejects invalid status value", async () => {
    const created = await request(app).post("/tasks").send({ title: "Initial title" });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ status: "banana" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("DELETE /tasks/:id returns 204 and removes task", async () => {
    const created = await request(app).post("/tasks").send({ title: "Delete me" });

    const del = await request(app).delete(`/tasks/${created.body.id}`);
    expect(del.status).toBe(204);

    const getAfterDelete = await request(app).get(`/tasks/${created.body.id}`);
    expect(getAfterDelete.status).toBe(404);
  });
});
