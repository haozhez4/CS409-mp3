const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Task = require("../models/task");
const User = require("../models/user");

// helper
async function addToPending(userIdStr, taskIdStr) {
  if (mongoose.Types.ObjectId.isValid(userIdStr))
    await User.updateOne({ _id: userIdStr }, { $addToSet: { pendingTasks: taskIdStr } });
}

async function removeFromPending(userIdStr, taskIdStr) {
  if (mongoose.Types.ObjectId.isValid(userIdStr))
    await User.updateOne({ _id: userIdStr }, { $pull: { pendingTasks: taskIdStr } });
}

// GET /api/tasks
router.get("/", async (req, res) => {
  try {
    const q = Task.find();

    if (req.query.where) q.find(JSON.parse(req.query.where));
    if (req.query.sort) q.sort(JSON.parse(req.query.sort));
    if (req.query.select) q.select(JSON.parse(req.query.select));
    if (req.query.skip) q.skip(parseInt(req.query.skip));
    if (req.query.limit) q.limit(parseInt(req.query.limit));

    if (req.query.count === "true") {
      const count = await q.countDocuments();
      return res.status(200).json({ message: "OK", data: count });
    }

    const tasks = await q.exec();
    res.status(200).json({ message: "OK", data: tasks });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid task ID format", data: {} });

  try {
    const q = Task.findById(id);
    if (req.query.select) q.select(JSON.parse(req.query.select));
    const task = await q.exec();

    if (!task) return res.status(404).json({ message: "Task not found", data: {} });
    res.status(200).json({ message: "OK", data: task });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// POST /api/tasks
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description = "",
      deadline,
      completed = false,
      assignedUser = "",
      assignedUserName = "unassigned",
    } = req.body || {};

    if (!name || !deadline)
      return res.status(400).json({ message: "Task must include name and deadline", data: {} });

    const task = new Task({
      name,
      description,
      deadline,
      completed,
      assignedUser,
      assignedUserName: assignedUser ? assignedUserName : "unassigned",
    });

    if (assignedUser && mongoose.Types.ObjectId.isValid(assignedUser)) {
      const user = await User.findById(assignedUser);
      if (user && !completed) {
        await addToPending(assignedUser, task._id.toString());
      } else {
        task.assignedUser = "";
        task.assignedUserName = "unassigned";
      }
    }

    await task.save();
    res.status(201).json({ message: "Created", data: task });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// PUT /api/tasks/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid task ID format", data: {} });

  try {
    const {
      name,
      description = "",
      deadline,
      completed,
      assignedUser = "",
      assignedUserName = "unassigned",
    } = req.body || {};

    if (!name || !deadline)
      return res.status(400).json({ message: "Task must include name and deadline", data: {} });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found", data: {} });

    if (task.assignedUser && task.assignedUser !== assignedUser)
      await removeFromPending(task.assignedUser, task._id);

    Object.assign(task, { name, description, deadline, completed, assignedUser, assignedUserName });
    await task.save();

    if (assignedUser && mongoose.Types.ObjectId.isValid(assignedUser) && !completed)
      await addToPending(assignedUser, task._id.toString());

    res.status(200).json({ message: "Updated", data: task });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid task ID format", data: {} });

  try {
    const task = await Task.findByIdAndDelete(id);
    if (!task) return res.status(404).json({ message: "Task not found", data: {} });

    if (task.assignedUser) await removeFromPending(task.assignedUser, task._id.toString());
    res.status(200).json({ message: "Deleted", data: task });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

module.exports = router;
