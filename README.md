# GitHub Pusher — Classroom Tool

A tiny tool for teaching students how content gets pushed to GitHub, without
ever handing them a real GitHub token.

## How it works

- Each student gets their own **access code** — managed from your existing
  **admin panel** (the same one used for TTS license keys), in a new
  "Student Codes" section. Codes live in Firestore, not a local file.
- They open the web page, paste in a file path + content (usually something
  Claude generated for them), and hit **Push to GitHub**.
- The server — using **your** GitHub token, stored only in `.env` — pushes
  that file to **one specific repo that's hard-locked in `server.js`**. No
  request, no matter what a student types, can ever target a different repo.
- Every push (successful or failed) is logged with the student's name, so you
  always know who pushed what.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:
   - `GITHUB_TOKEN` — a **fine-grained** personal access token, scoped to
     **only** your practice repo, with **Contents: Read and write** permission.
     (GitHub → Settings → Developer settings → Personal access tokens →
     Fine-grained tokens.)
   - `REPO_OWNER` / `REPO_NAME` — your practice repo (create a fresh, empty
     one just for this — never point this at a real production repo).
   - `ADMIN_PASSWORD` — your own password for viewing the push log.
   - Firebase credentials: either leave `FIREBASE_SERVICE_ACCOUNT_KEY` blank
     and place the same service account key you use for your TTS app at
     `secrets/serviceAccountKey.json`, or paste the full JSON into
     `FIREBASE_SERVICE_ACCOUNT_KEY` (for hosts without file uploads).

3. Manage students from your admin panel — the same one used for TTS license
   keys now has a **"Student Codes"** section. Generate a code + name there;
   to revoke a student, mark their code inactive (or delete it) — no
   redeploy needed, takes effect immediately.

4. Run locally:
   ```
   npm start
   ```
   Open http://localhost:3000

## Viewing the push log

Visit: `https://your-deployed-url/api/logs?password=YOUR_ADMIN_PASSWORD`

Shows every push attempt: student name, file path, time, success/failure.

## Deploying (e.g. on Render)

1. Push this project to its own small GitHub repo (**not** the practice repo
   students push to — this is the *tool's* code, keep it separate).
2. On Render: New → Web Service → connect this repo.
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Add the same environment variables from `.env` in Render's dashboard.
4. Share the deployed URL + each student's individual code.

## Safety notes

- The GitHub token only needs access to the one practice repo — never use a
  token with access to real/production repos for this tool.
- Student codes are simple strings, not high-security secrets — this is a
  teaching tool for a locked-down practice repo, not a production auth system.
- Consider rotating the GitHub token and clearing `codes.json` between class
  terms.
