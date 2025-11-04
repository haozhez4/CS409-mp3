// Load required packages
var mongoose = require('mongoose');

// Define our user schema
var UserSchema = new mongoose.Schema({
    name: { type: String, required: [true, "User name is required"] },
    email: {
      type: String,
      required: [true, "User email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email is invalid"]
    },
    pendingTasks: { type: [String], default: [] }, // Task _id 字符串数组
    dateCreated: { type: Date, default: () => new Date() }
  },
  { versionKey: false }
);

// Export the Mongoose model
UserSchema.index({ email: 1 }, { unique: true });
module.exports = mongoose.model('User', UserSchema);
