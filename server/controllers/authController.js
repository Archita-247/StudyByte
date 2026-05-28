import crypto from "crypto";
import sendOtp from "../utils/sendOtp.js";
import {
  cleanupExpiredOtpChallenges,
  deleteOtpChallenge,
  generateOtp,
  getOtpChallenge,
  getOtpExpiry,
  hashOtp,
  incrementOtpAttempts,
  isExpired,
  normalizeEmail,
  saveOtpChallenge
} from "../utils/otpStore.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMaxVerifyAttempts() {
  return Number(process.env.OTP_MAX_ATTEMPTS || 5);
}

function getResendCooldownMs() {
  return Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60) * 1000;
}

function safeHashEquals(a, b) {
  const first = Buffer.from(a, "hex");
  const second = Buffer.from(b, "hex");

  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

export async function sendEmailOtp(req, res) {
  const email = normalizeEmail(req.body.email);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }

  try {
    await cleanupExpiredOtpChallenges();

    const existing = await getOtpChallenge(email);
    if (existing && !isExpired(existing) && Date.now() - existing.createdAt < getResendCooldownMs()) {
      return res.status(429).json({
        success: false,
        error: "Please wait before requesting another OTP"
      });
    }

    const otp = generateOtp();
    const now = Date.now();

    await saveOtpChallenge({
      email,
      otpHash: hashOtp(email, otp),
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: getOtpExpiry()
    });

    await sendOtp(email, otp);

    return res.json({
      success: true,
      message: "OTP sent"
    });
  } catch (err) {
    console.error("Email OTP send error:", err);
    await deleteOtpChallenge(email);

    return res.status(500).json({
      success: false,
      error: "Failed to send OTP"
    });
  }
}

export async function verifyEmailOtp(req, res) {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();

  if (!email || !isValidEmail(email) || !otp) {
    return res.status(400).json({ success: false, error: "Valid email and OTP required" });
  }

  try {
    const challenge = await getOtpChallenge(email);

    if (!challenge) {
      return res.status(404).json({ success: false, error: "No OTP found" });
    }

    if (isExpired(challenge)) {
      await deleteOtpChallenge(email);
      return res.status(410).json({ success: false, error: "OTP expired" });
    }

    if (challenge.attempts >= getMaxVerifyAttempts()) {
      await deleteOtpChallenge(email);
      return res.status(429).json({ success: false, error: "Too many invalid attempts" });
    }

    if (!safeHashEquals(hashOtp(email, otp), challenge.otpHash)) {
      await incrementOtpAttempts(email, challenge.attempts + 1);
      return res.status(401).json({ success: false, error: "Invalid OTP" });
    }

    await deleteOtpChallenge(email);

    return res.json({
      success: true,
      message: "OTP verified"
    });
  } catch (err) {
    console.error("Email OTP verify error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to verify OTP"
    });
  }
}
