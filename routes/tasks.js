const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Task = require("../models/task");
const User = require("../models/user");

async function addToPending(userIdStr, taskIdStr) {
  if (!userIdStr || !mongoose.Types.ObjectId.isValid(userIdStr)) return;
  await User.updateOne(
    { _id: userIdStr },
    { $addToSet: { pendingTasks: taskIdStr } }
  );
}

async function removeFromPending(userIdStr, taskIdStr) {
  if (!userIdStr || !mongoose.Types.ObjectId.isValid(userIdStr)) return;
  await User.updateOne(
    { _id: userIdStr },
    { $pull: { pendingTasks: taskIdStr } }
  );
}


// GET /api/tasks
router.get("/", async (req, res, next) => {
  try {
    const q = Task.find();

    // where
    if (req.query.where) q.find(JSON.parse(req.query.where));

    // sort
    if (req.query.sort) q.sort(JSON.parse(req.query.sort));

    // select
    if (req.query.select) q.select(JSON.parse(req.query.select));

    // skip / limit
    if (req.query.skip) q.skip(parseInt(req.query.skip));
    if (req.query.limit) q.limit(parseInt(req.query.limit));

    // count
    if (req.query.count === "true") {
      const count = await q.countDocuments();
      return res.status(200).json({ message: "OK", data: count });
    }

    const tasks = await q.exec();
    res.status(200).json({ message: "OK", data: tasks });
  } catch (e) {
    next(e);
  }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res, next) => {
  try {
    const q = Task.findById(req.params.id);
    if (req.query.select) q.select(JSON.parse(req.query.select));

    const task = await q.exec();
    if (!task) {
      return res.status(404).json({ message: "Task not found", data: {} });
    }

    res.status(200).json({ message: "OK", data: task });
  } catch (e) {
    next(e);
  }
});

// POST /api/tasks
router.post("/", async (req, res, next) => {
  try {
    const {
      name,
      description = "",
      deadline,
      completed = false,
      assignedUser = "",
      assignedUserName = "unassigned",
    } = req.body || {};

    if (!name || !deadline) {
      return res
        .status(400)
        .json({ message: "Task must include name and deadline", data: {} });
    }

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
        user.pendingTasks.push(task._id.toString());
        await user.save();
      } else if (!user) {
        task.assignedUser = "";
        task.assignedUserName = "unassigned";
      }
    } else {
      task.assignedUser = "";
      task.assignedUserName = "unassigned";
    }

    await task.save();
    res.status(201).json({ message: "Created", data: task });
  } catch (e) {
    console.error("Error in POST /api/tasks:", e);
    res.status(500).json({ message: "Server Error", data: e.message });
  }
});

// PUT /api/tasks/:id
router.put("/:id", async (req, res, next) => {
  try {
    const {
      name,
      description = "",
      deadline,
      completed,
      assignedUser,
      assignedUserName,
    } = req.body || {};

    if (!name || !deadline) {
      return res
        .status(400)
        .json({ message: "Task must include name and deadline", data: {} });
    }

    const existingTask = await Task.findById(req.params.id);
    if (!existingTask)
      return res.status(404).json({ message: "Task not found", data: {} });

    if (
      existingTask.assignedUser &&
      existingTask.assignedUser !== assignedUser
    ) {
      await removeFromPending(existingTask.assignedUser, existingTask._id);
    }

    existingTask.name = name;
    existingTask.description = description;
    existingTask.deadline = deadline;
    existingTask.completed = completed;
    existingTask.assignedUser = assignedUser || "";
    existingTask.assignedUserName = assignedUserName || "unassigned";

    await existingTask.save();


    if (
      assignedUser &&
      mongoose.Types.ObjectId.isValid(assignedUser) &&
      !completed
    ) {
      await addToPending(assignedUser, existingTask._id.toString());
    }

    res.status(200).json({ message: "Updated", data: existingTask });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task)
      return res.status(404).json({ message: "Task not found", data: {} });

    if (task.assignedUser) {
      await removeFromPending(task.assignedUser, task._id.toString());
    }

    res.status(200).json({ message: "Deleted", data: task });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
