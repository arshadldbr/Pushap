const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { getDb } = require("./lib/firebaseAdmin");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// --- Hard-locked target repo. Students can NEVER push anywhere else,
// no matter what they submit — this is not read from client input. ---
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!REPO_OWNER || !REPO_NAME || !GITHUB_TOKEN) {
  console.error("Missing REPO_OWNER, REPO_NAME, or GITHUB_TOKEN in environment.");
}

// --- Student access codes now live in Firestore (collection: "studentCodes"),
// managed from the same admin panel as the TTS license keys. Document ID is
// the code itself; fields: { studentName, active }.
async function lookupCode(code) {
  if (!code) return null;
  const db = getDb();
  const doc = await db.collection("studentCodes").doc(code.trim()).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.active === false) return null;
  return data.studentName || "Unknown Student";
}

// --- Simple append-only log so the teacher can see who pushed what ---
const LOG_PATH = path.join(__dirname, "push-log.json");
function appendLog(entry) {
  let logs = [];
  try {
    logs = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  } catch {
    logs = [];
  }
  logs.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

// Blocks obviously dangerous paths (escaping the repo, hidden git internals)
function isSafePath(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  if (filePath.includes("..")) return false;
  if (filePath.startsWith("/")) return false;
  if (filePath.startsWith(".git/")) return false;
  return true;
}

app.post("/api/push", async (req, res) => {
  const { code, filePath, content, commitMessage } = req.body || {};

  let studentName;
  try {
    studentName = await lookupCode(code);
  } catch (err) {
    console.error("Firestore lookup error:", err);
    return res.status(500).json({ success: false, error: "Could not verify code right now. Please try again." });
  }

  if (!studentName) {
    return res.status(403).json({ success: false, error: "Invalid or inactive access code." });
  }

  if (!isSafePath(filePath)) {
    return res.status(400).json({ success: false, error: "Invalid file path." });
  }

  if (typeof content !== "string" || !content) {
    return res.status(400).json({ success: false, error: "File content is required." });
  }

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "github-pusher-tool",
  };

  try {
    // Check if the file already exists (need its sha to update rather than create)
    let sha;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      const existingData = await existing.json();
      sha = existingData.sha;
    }

    const body = {
      message: commitMessage || `Update ${filePath} via GitHub Pusher (${studentName})`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      ...(sha ? { sha } : {}),
    };

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      appendLog({
        time: new Date().toISOString(),
        student: studentName,
        code,
        filePath,
        success: false,
        error: data.message || "Unknown GitHub API error",
      });
      return res.status(response.status).json({ success: false, error: data.message || "GitHub push failed." });
    }

    appendLog({
      time: new Date().toISOString(),
      student: studentName,
      code,
      filePath,
      success: true,
      commitUrl: data.commit && data.commit.html_url,
    });

    return res.json({
      success: true,
      commitUrl: data.commit && data.commit.html_url,
    });
  } catch (err) {
    appendLog({
      time: new Date().toISOString(),
      student: studentName,
      code,
      filePath,
      success: false,
      error: err.message,
    });
    return res.status(500).json({ success: false, error: "Server error while pushing to GitHub." });
  }
});

// Simple admin log viewer, protected by a separate admin password (not a student code)
app.get("/api/logs", (req, res) => {
  const adminPassword = req.query.password;
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Invalid admin password." });
  }
  let logs = [];
  try {
    logs = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  } catch {
    logs = [];
  }
  res.json({ repo: `${REPO_OWNER}/${REPO_NAME}`, logs });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GitHub Pusher tool listening on http://0.0.0.0:${PORT}`);
  console.log(`Locked to repo: ${REPO_OWNER}/${REPO_NAME}`);
});
