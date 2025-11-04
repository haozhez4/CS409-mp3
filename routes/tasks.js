const express = require("express");
const Task = require("../models/task");
const User = require("../models/user");
const { parseCommonQueryParams, parseJSONParam } = require("../query");

const router = express.Router();

async function addToPending(userIdStr, taskIdStr) {
  if (!userIdStr) return;
  await User.updateOne({ _id: userIdStr }, { $addToSet: { pendingTasks: taskIdStr } });
}
async function removeFromPending(userIdStr, taskIdStr) {
  if (!userIdStr) return;
  await User.updateOne({ _id: userIdStr }, { $pull: { pendingTasks: taskIdStr } });
}

// GET /api/tasks
router.get("/", async (req, res, next) => {
  try {
    const { where, sort, select, skip, limit, count } = parseCommonQueryParams(req, { defaultLimit: 100 });
    const q = Task.find(where);
    if (sort) q.sort(sort);
    if (select) q.select(select);
    if (skip !== undefined) q.skip(skip);
    if (!count && limit !== undefined) q.limit(limit);
    if (count) return res.status(200).json({ message: "OK", data: await Task.countDocuments(where) });
    res.status(200).json({ message: "OK", data: await q.lean() });
  } catch (e) { next(e); }
});

// POST /api/tasks
router.post("/", async (req, res, next) => {
  try {
    const { name, description = "", deadline, completed = false, assignedUser = "", assignedUserName = "unassigned" } = req.body || {};
    if (!name || !deadline) { const e = new Error("Task must include name and deadline"); e.statusCode = 400; e.expose = true; throw e; }

    const task = await Task.create({
      name, description, deadline, completed,
      assignedUser, assignedUserName: assignedUser ? assignedUserName : "unassigned"
    });

    if (assignedUser && !completed) await addToPending(assignedUser, task._id.toString());
    res.status(201).json({ message: "Created", data: task.toObject() });
  } catch (e) { next(e); }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res, next) => {
  try {
    const select = parseJSONParam(req.query.select, undefined);
    const q = Task.findById(req.params.id);
    if (select) q.select(select);
    const doc = await q.lean();
    if (!doc) return res.status(404).json({ message: "Task not found", data: null });
    res.status(200).json({ message: "OK", data: doc });
  } catch (e) { next(e); }
});

// PUT /api/tasks/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { name, description = "", deadline, completed = false, assignedUser = "", assignedUserName = "unassigned" } = req.body || {};
    if (!name || !deadline) { const e = new Error("Task must include name and deadline"); e.statusCode = 400; e.expose = true; throw e; }

    const t = await Task.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Task not found", data: null });

    const prevAssigned = t.assignedUser;
    const prevCompleted = t.completed;

    t.name = name; t.description = description; t.deadline = deadline; t.completed = completed;
    t.assignedUser = assignedUser;
    t.assignedUserName = assignedUser ? assignedUserName : "unassigned";
    const saved = await t.save();

    const taskId = saved._id.toString();
    if (prevAssigned && prevAssigned !== assignedUser) await removeFromPending(prevAssigned, taskId);
    if (assignedUser && assignedUser !== prevAssigned && !completed) await addToPending(assignedUser, taskId);
    if (!prevCompleted && completed && assignedUser) await removeFromPending(assignedUser, taskId);
    if (prevCompleted && !completed && assignedUser) await addToPending(assignedUser, taskId);

    res.status(200).json({ message: "OK", data: saved.toObject() });
  } catch (e) { next(e); }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id).lean();
    if (!task) return res.status(404).json({ message: "Task not found", data: null });
    if (task.assignedUser && !task.completed) await removeFromPending(task.assignedUser, task._id.toString());
    res.status(200).json({ message: "Deleted", data: task });
  } catch (e) { next(e); }
});

module.exports = router;
