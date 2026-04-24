import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: (multer as any).memoryStorage ? (multer as any).memoryStorage() : (multer as any).default?.memoryStorage?.() || (multer as any).memoryStore?.(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// MongoDB Connection
// NOTE: "localhost" will not work if you are testing this application from the AI Studio hosted preview environment.
// To use a database from the preview, please provide a MongoDB Atlas (cloud) connection string in the MONGODB_URI environment variable via the Settings menu.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kanban";

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

// Define Schemas based on firebase-blueprint.json
const UserProfileSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  displayName: String,
  email: { type: String, required: true },
  photoURL: String,
  updatedAt: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: String, required: true },
  collaborators: [String],
  collaboratorEmails: [String],
  memberRoles: { type: Map, of: String },
  themeColor: String,
  themeBackground: String,
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  dueDate: Date,
  projectId: { type: String, required: true },
  creatorId: { type: String, required: true },
  assigneeId: String,
  parentId: String,
  dependencies: [String],
  order: { type: Number, default: 0 },
  recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
  isArchived: { type: Boolean, default: false },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  subtasks: [{
    id: String,
    title: String,
    completed: Boolean
  }],
  tags: [String],
  attachments: [{
    id: String,
    name: String,
    url: String,
    type: String,
    size: Number,
    createdAt: { type: Date, default: Date.now }
  }]
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ["mention", "assigned", "updated"], required: true },
  message: { type: String, required: true },
  projectId: { type: String, required: true },
  taskId: String,
  authorId: { type: String, required: true },
  authorName: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const ActivityLogSchema = new mongoose.Schema({
  projectId: { type: String, required: true },
  taskId: String,
  userId: { type: String, required: true },
  userName: String,
  userPhoto: String,
  action: { type: String, required: true },
  details: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  text: { type: String, required: true },
  authorId: { type: String, required: true },
  authorName: String,
  authorPhoto: String,
  createdAt: { type: Date, default: Date.now }
});

const UserProfile = mongoose.model("UserProfile", UserProfileSchema);
const Project = mongoose.model("Project", ProjectSchema);
const Task = mongoose.model("Task", TaskSchema);
const Notification = mongoose.model("Notification", NotificationSchema);
const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);
const Comment = mongoose.model("Comment", CommentSchema);

const PresenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  userName: String,
  userPhoto: String,
  projectId: { type: String, required: true },
  taskId: String,
  lastActive: { type: Date, default: Date.now }
});

const Presence = mongoose.model("Presence", PresenceSchema);

// API Routes
app.get("/api/users/search", async (req, res) => {
  const { email, uids } = req.query;
  if (email) {
    const user = await UserProfile.findOne({ email: (email as string).toLowerCase().trim() });
    return res.json(user);
  }
  if (uids) {
    const ids = (uids as string).split(",");
    const users = await UserProfile.find({ uid: { $in: ids } });
    return res.json(users);
  }
  res.json(null);
});

app.get("/api/users/:uid", async (req, res) => {
  const user = await UserProfile.findOne({ uid: req.params.uid });
  res.json(user);
});

app.post("/api/users", async (req, res) => {
  const user = await UserProfile.findOneAndUpdate({ uid: req.body.uid }, req.body, { upsert: true, new: true });
  
  // Link projects where user was invited by email
  if (user.email) {
    await Project.updateMany(
      { collaboratorEmails: user.email.toLowerCase().trim() },
      { $addToSet: { collaborators: user.uid } }
    );
  }

  res.json(user);
});

app.get("/api/projects", async (req, res) => {
  const { userId } = req.query;
  const projects = await Project.find({
    $or: [{ ownerId: userId as string }, { collaborators: userId as string }]
  } as any);
  res.json(projects);
});

app.get("/api/projects/:id", async (req, res) => {
  const project = await Project.findById(req.params.id);
  res.json(project);
});

app.post("/api/projects", async (req, res) => {
  const project = new Project(req.body);
  await project.save();
  res.json(project);
});

app.patch("/api/projects/:id", async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(project);
});

app.get("/api/tasks", async (req, res) => {
  const { projectId } = req.query;
  const tasks = await Task.find({ projectId: projectId as string } as any);
  res.json(tasks);
});

app.get("/api/tasks/:id", async (req, res) => {
  const task = await Task.findById(req.params.id);
  res.json(task);
});

app.post("/api/tasks", async (req, res) => {
  const task = new Task(req.body);
  await task.save();
  res.json(task);
});

app.patch("/api/tasks/:id", async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(task);
});

app.delete("/api/tasks/:id", async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post("/api/tasks/:id/attachments", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;
    
    const attachment = {
      id: new mongoose.Types.ObjectId().toString(),
      name: req.file.originalname,
      url: dataUri,
      type: req.file.mimetype,
      size: req.file.size,
      createdAt: new Date()
    };
    
    await Task.findByIdAndUpdate(req.params.id, {
      $push: { attachments: attachment }
    });
    
    res.json(attachment);
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/tasks/:taskId/comments", async (req, res) => {
  const comments = await Comment.find({ taskId: req.params.taskId }).sort({ createdAt: -1 });
  res.json(comments);
});

app.post("/api/tasks/:taskId/comments", async (req, res) => {
  const comment = new Comment({ ...req.body, taskId: req.params.taskId });
  await comment.save();
  res.json(comment);
});

app.get("/api/activities", async (req, res) => {
  const { projectId } = req.query;
  const logs = await ActivityLog.find({ projectId: projectId as string } as any).sort({ createdAt: -1 }).limit(50);
  res.json(logs);
});

app.post("/api/activities", async (req, res) => {
  const log = new ActivityLog(req.body);
  await log.save();
  res.json(log);
});

app.get("/api/presence", async (req, res) => {
  const { projectId } = req.query;
  const presence = await Presence.find({ projectId: projectId as string } as any);
  res.json(presence);
});

app.post("/api/presence", async (req, res) => {
  const presence = await Presence.findOneAndUpdate(
    { userId: req.body.userId },
    { ...req.body, lastActive: new Date() },
    { upsert: true, new: true }
  );
  res.json(presence);
});

app.delete("/api/presence/:userId", async (req, res) => {
  await Presence.findOneAndDelete({ userId: req.params.userId });
  res.json({ success: true });
});

app.get("/api/notifications", async (req, res) => {
  const { userId } = req.query;
  const notifications = await Notification.find({ userId: userId as string } as any).sort({ createdAt: -1 });
  res.json(notifications);
});

app.patch("/api/notifications/:id", async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(notification);
});

async function startServer() {
  await connectDB();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
