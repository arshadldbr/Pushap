const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let initialized = false;

function initFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const rawEnvKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const localKeyPath = path.join(process.cwd(), "secrets", "serviceAccountKey.json");

  let serviceAccount;

  if (rawEnvKey && rawEnvKey.trim()) {
    try {
      serviceAccount = JSON.parse(rawEnvKey);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Paste the full service account JSON as a single line."
      );
    }
  } else if (fs.existsSync(localKeyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf-8"));
  } else {
    throw new Error(
      "No Firebase service account credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY (env var) or place the key at secrets/serviceAccountKey.json."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
}

function getDb() {
  initFirebaseAdmin();
  return admin.firestore();
}

module.exports = { getDb, admin };
