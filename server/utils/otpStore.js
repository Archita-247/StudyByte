import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "..", "data", "otp-store.json");
const COLLECTION = "otp_challenges";

let firestoreDbPromise;

function getOtpSecret() {
  return process.env.OTP_HASH_SECRET || process.env.GROQ_API_KEY || "studybyte-dev-otp-secret";
}

export function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(email, otp) {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");
}

export function getOtpDocumentId(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function getOtpExpiry() {
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 5);
  return Date.now() + ttlMinutes * 60 * 1000;
}

export function isExpired(record) {
  return !record || Date.now() > record.expiresAt;
}

async function getFirestoreDb() {
  if (!firestoreDbPromise) {
    firestoreDbPromise = (async () => {
      const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (!getApps().length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          initializeApp({
            credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
          });
        } else {
          initializeApp({
            credential: applicationDefault()
          });
        }
      }

      return getFirestore();
    })();
  }

  return firestoreDbPromise;
}

function shouldUseFirestore() {
  return process.env.OTP_STORE === "firestore";
}

async function readFileStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeFileStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function saveOtpChallenge(record) {
  const id = getOtpDocumentId(record.email);

  if (shouldUseFirestore()) {
    const db = await getFirestoreDb();
    await db.collection(COLLECTION).doc(id).set(record);
    return;
  }

  const store = await readFileStore();
  store[id] = record;
  await writeFileStore(store);
}

export async function getOtpChallenge(email) {
  const id = getOtpDocumentId(email);

  if (shouldUseFirestore()) {
    const db = await getFirestoreDb();
    const snapshot = await db.collection(COLLECTION).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  const store = await readFileStore();
  return store[id] || null;
}

export async function deleteOtpChallenge(email) {
  const id = getOtpDocumentId(email);

  if (shouldUseFirestore()) {
    const db = await getFirestoreDb();
    await db.collection(COLLECTION).doc(id).delete();
    return;
  }

  const store = await readFileStore();
  delete store[id];
  await writeFileStore(store);
}

export async function incrementOtpAttempts(email, attempts) {
  const record = await getOtpChallenge(email);
  if (!record) return;

  await saveOtpChallenge({
    ...record,
    attempts,
    updatedAt: Date.now()
  });
}

export async function cleanupExpiredOtpChallenges() {
  if (shouldUseFirestore()) {
    const db = await getFirestoreDb();
    const expired = await db.collection(COLLECTION).where("expiresAt", "<=", Date.now()).limit(100).get();
    const batch = db.batch();

    expired.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return;
  }

  const store = await readFileStore();
  let changed = false;

  for (const [id, record] of Object.entries(store)) {
    if (isExpired(record)) {
      delete store[id];
      changed = true;
    }
  }

  if (changed) {
    await writeFileStore(store);
  }
}
