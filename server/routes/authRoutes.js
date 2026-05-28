import express from "express";
import { sendEmailOtp, verifyEmailOtp } from "../controllers/authController.js";

const router = express.Router();

router.post("/send-otp", sendEmailOtp);
router.post("/verify-otp", verifyEmailOtp);

export default router;
