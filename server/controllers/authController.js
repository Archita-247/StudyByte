const sendOtp = require("../utils/sendOtp");

// 🔥 Global OTP store (persists during runtime)
global.otpStore = global.otpStore || {};

// ==========================
// 🔥 SEND EMAIL OTP
// ==========================
exports.sendEmailOtp = async (req, res) => {
  let { email } = req.body;

  if (!email) {
    return res.json({ success: false, error: "Email required" });
  }

  // Normalize email
  email = email.trim().toLowerCase();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP
  global.otpStore[email] = otp;

  console.log("✅ OTP Stored:", global.otpStore);

  try {
    await sendOtp(email, otp);

    return res.json({
      success: true,
      message: "OTP sent"
    });

  } catch (err) {
    console.error("Email Error:", err);

    return res.json({
      success: false,
      error: "Failed to send OTP"
    });
  }
};

// ==========================
// 🔥 VERIFY EMAIL OTP
// ==========================
exports.verifyEmailOtp = (req, res) => {
  let { email, otp } = req.body;

  if (!email || !otp) {
    return res.json({ success: false, error: "Email and OTP required" });
  }

  // Normalize email
  email = email.trim().toLowerCase();

  console.log("📦 Stored OTPs:", global.otpStore);
  console.log("🔍 Checking:", email, otp);

  // Check if OTP exists
  if (!global.otpStore[email]) {
    return res.json({ success: false, error: "No OTP found" });
  }

  // Match OTP
  if (global.otpStore[email] === otp.toString()) {
    delete global.otpStore[email];

    return res.json({
      success: true,
      message: "OTP verified"
    });
  }

  return res.json({
    success: false,
    error: "Invalid OTP"
  });
};