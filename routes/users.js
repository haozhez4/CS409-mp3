const express = require("express");
const User = require("../models/user");
const Task = require("../models/task");
const { parseCommonQueryParams, parseJSONParam } = require("../query");

const router = express.Router();

// GET /api/users
router.get("/", async (req, res, next) => {
  try {
    const { where, sort, select, skip, limit, count } = parseCommonQueryParams(req, { defaultLimit: undefined });
    const q = User.find(where);
    if (sort) q.sort(sort);
    if (select) q.select(select);
    if (skip !== undefined) q.skip(skip);
    if (!count && limit !== undefined) q.limit(limit);
    if (count) return res.status(200).json({ message: "OK", data: await User.countDocuments(where) });
    res.status(200).json({ message: "OK", data: await q.lean() });
  } catch (e) { next(e); }
});

// POST /api/users
router.post("/", async (req, res, next) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) { const e = new Error("User must include name and email"); e.statusCode = 400; e.expose = true; throw e; }
    const user = await User.create({ name, email, pendingTasks });

    if (pendingTasks?.length) {
      await Task.updateMany(
        { _id: { $in: pendingTasks } },
        { $set: { assignedUser: user._id.toString(), assignedUserName: user.name } }
      );
    }
    res.status(201).json({ message: "Created", data: user.toObject() });
  } catch (e) {
    if (e.code === 11000) { e.statusCode = 400; e.expose = true; e.message = "A user with this email already exists"; }
    next(e);
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res, next) => {
  try {
    const select = parseJSONParam(req.query.select, undefined);
    const q = User.findById(req.params.id);
    if (select) q.select(select);
    const doc = await q.lean();
    if (!doc) return res.status(404).json({ message: "User not found", data: null });
    res.status(200).json({ message: "OK", data: doc });
  } catch (e) { next(e); }
});

// PUT /api/users/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) { const e = new Error("User must include name and email"); e.statusCode = 400; e.expose = true; throw e; }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found", data: null });

    user.name = name; user.email = email; user.pendingTasks = Array.isArray(pendingTasks) ? pendingTasks : [];
    await user.save();

    await Task.updateMany(
      { assignedUser: user._id.toString(), _id: { $nin: user.pendingTasks } },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );
    if (user.pendingTasks.length) {
      await Task.updateMany(
        { _id: { $in: user.pendingTasks } },
        { $set: { assignedUser: user._id.toString(), assignedUserName: user.name } }
      );
    }
    res.status(200).json({ message: "OK", data: user.toObject() });
  } catch (e) {
    if (e.code === 11000) { e.statusCode = 400; e.expose = true; e.message = "A user with this email already exists"; }
    next(e);
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).lean();
    if (!user) return res.status(404).json({ message: "User not found", data: null });
    await Task.updateMany(
      { assignedUser: user._id.toString(), completed: false },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );
    res.status(200).json({ message: "Deleted", data: user });
  } catch (e) { next(e); }
});

module.exports = router;
