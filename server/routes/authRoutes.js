const express = require("express");
const router = express.Router();

const {
  sendEmailOtp,
  verifyEmailOtp
} = require("../controllers/authController");

router.post("/send-otp", sendEmailOtp);
router.post("/verify-otp", verifyEmailOtp);

module.exports = router;