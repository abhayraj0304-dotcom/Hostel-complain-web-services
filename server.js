/**
 * server.js — Hostel Complaint Tracker Backend
 * ─────────────────────────────────────────────
 * Stack : Node.js + Express + MongoDB Atlas (Mongoose)
 *
 * Install dependencies:
 *   npm install express mongoose bcryptjs cors dotenv
 *
 * Create a .env file with:
 *   MONGO_URI=mongodb+srv://abhayraj0304_db_user:Abhay%40123@cluster0.8ixqhqe.mongodb.net/hostelDB?retryWrites=true&w=majority&appName=Cluster0
 *   PORT=3000
 *
 * Run:
 *   node server.js
 */

require("dotenv").config();

/* ─── DNS FIX (Force Google DNS + IPv4) ─── */
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express  = require("express");
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const cors     = require("cors");
const path     = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── MIDDLEWARE ─── */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));   // ✅ Serve static files (index.html, CSS, JS)

/* ─── DB CONNECTION ─── */
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hostelDB";

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4
})
  .then(() => console.log("✅  MongoDB connected →", MONGO_URI))
  .catch(err => {
    console.error("❌  MongoDB error:", err.message);
    process.exit(1);
  });

/* ══════════════════════════════════════════
   SCHEMAS & MODELS
══════════════════════════════════════════ */

/* ── Student Schema ── */
const studentSchema = new mongoose.Schema({
  studentId : { type: String, required: true, unique: true, trim: true, uppercase: true },
  fullName  : { type: String, required: true, trim: true },
  roomNo    : { type: String, required: true, trim: true },
  username  : { type: String, required: true, unique: true, trim: true, lowercase: true },
  password  : { type: String, required: true },
  role      : { type: String, default: "student" },
  createdAt : { type: Date, default: Date.now }
});

/* ── Complaint Schema ── */
const complaintSchema = new mongoose.Schema({
  complaintId : { type: String, required: true, unique: true },
  name        : String,
  room        : String,
  category    : String,
  priority    : String,
  title       : String,
  description : String,
  status      : { type: String, default: "Pending" },
  submittedBy : String,
  date        : { type: Date, default: Date.now }
});

const Student   = mongoose.model("Student",   studentSchema);
const Complaint = mongoose.model("Complaint", complaintSchema);

/* ══════════════════════════════════════════
   STUDENT ROUTES
══════════════════════════════════════════ */

/* ── Register ── */
app.post("/api/students/register", async (req, res) => {
  try {
    const { studentId, fullName, roomNo, username, password } = req.body;

    if (!studentId || !fullName || !roomNo || !username || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await Student.findOne({ $or: [{ username }, { studentId }] });
    if (existingUser) {
      const field = existingUser.username === username ? "Username" : "Student ID";
      return res.status(409).json({ message: `${field} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const student = new Student({
      studentId,
      fullName,
      roomNo,
      username,
      password: hashedPassword
    });

    await student.save();

    res.status(201).json({
      message   : "Student registered successfully.",
      studentId : student.studentId,
      fullName  : student.fullName,
      roomNo    : student.roomNo
    });

  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error during registration." });
  }
});

/* ── Login ── */
app.post("/api/students/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const student = await Student.findOne({ username: username.toLowerCase() });
    if (!student) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    res.json({
      message   : "Login successful.",
      studentId : student.studentId,
      fullName  : student.fullName,
      roomNo    : student.roomNo,
      role      : student.role
    });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error during login." });
  }
});

/* ── Get all students (admin use) ── */
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find({}, "-password");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Error fetching students." });
  }
});

/* ══════════════════════════════════════════
   COMPLAINT ROUTES
══════════════════════════════════════════ */

/* ── Submit complaint ── */
app.post("/api/complaints", async (req, res) => {
  try {
    const { id, name, room, category, priority, title, description, status, submittedBy } = req.body;

    const complaint = new Complaint({
      complaintId : id || "C" + Date.now(),
      name, room, category, priority, title, description,
      status      : status || "Pending",
      submittedBy : submittedBy || "unknown"
    });

    await complaint.save();
    res.status(201).json({ message: "Complaint saved.", complaint });

  } catch (err) {
    console.error("Complaint error:", err.message);
    res.status(500).json({ message: "Error saving complaint." });
  }
});

/* ── Get all complaints ── */
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ date: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: "Error fetching complaints." });
  }
});

/* ── Update complaint status ── */
app.patch("/api/complaints/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.id },
      { status },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    res.json({ message: "Status updated.", complaint });
  } catch (err) {
    res.status(500).json({ message: "Error updating complaint." });
  }
});

/* ── Delete complaint ── */
app.delete("/api/complaints/:id", async (req, res) => {
  try {
    await Complaint.findOneAndDelete({ complaintId: req.params.id });
    res.json({ message: "Complaint deleted." });
  } catch (err) {
    res.status(500).json({ message: "Error deleting complaint." });
  }
});

/* ─── ROOT ROUTE — Serve index.html ─── */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));  // ✅ Frontend serve hoga
});

/* ─── START ─── */
app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));