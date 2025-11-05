const express = require("express");
const User = require("../models/user");
const Task = require("../models/task");
const mongoose = require("mongoose");

const router = express.Router();

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const query = User.find();

    if (req.query.where) query.find(JSON.parse(req.query.where));
    if (req.query.sort) query.sort(JSON.parse(req.query.sort));
    if (req.query.select) query.select(JSON.parse(req.query.select));
    if (req.query.skip) query.skip(parseInt(req.query.skip));
    if (req.query.limit) query.limit(parseInt(req.query.limit));

    if (req.query.count === "true") {
      const count = await query.countDocuments();
      return res.status(200).json({ message: "OK", data: count });
    }

    const users = await query.exec();
    res.status(200).json({ message: "OK", data: users });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ message: "User must include name and email", data: {} });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "A user with this email already exists", data: {} });
    }

    const user = await User.create({ name, email, pendingTasks });
    if (pendingTasks.length > 0) {
      await Task.updateMany(
        { _id: { $in: pendingTasks } },
        { $set: { assignedUser: user._id.toString(), assignedUserName: user.name } }
      );
    }

    res.status(201).json({ message: "Created", data: user });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid user ID format", data: {} });

  try {
    const q = User.findById(id);
    if (req.query.select) q.select(JSON.parse(req.query.select));

    const user = await q.exec();
    if (!user) return res.status(404).json({ message: "User not found", data: {} });

    res.status(200).json({ message: "OK", data: user });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid user ID format", data: {} });

  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email)
      return res.status(400).json({ message: "User must include name and email", data: {} });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found", data: {} });

    user.name = name;
    user.email = email;
    user.pendingTasks = Array.isArray(pendingTasks) ? pendingTasks : [];
    await user.save();

    // maintain two-way reference
    await Task.updateMany(
      { assignedUser: user._id.toString(), _id: { $nin: user.pendingTasks } },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );
    await Task.updateMany(
      { _id: { $in: user.pendingTasks } },
      { $set: { assignedUser: user._id.toString(), assignedUserName: user.name } }
    );

    res.status(200).json({ message: "Updated", data: user });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid user ID format", data: {} });

  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found", data: {} });

    await Task.updateMany(
      { assignedUser: user._id.toString() },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );

    res.status(200).json({ message: "Deleted", data: user });
  } catch (e) {
    res.status(500).json({ message: "Server error", data: e.message });
  }
});

module.exports = router;
