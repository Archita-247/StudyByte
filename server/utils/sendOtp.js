import nodemailer from "nodemailer";

const sendOtp = async (email, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be configured");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "StudyByte OTP Verification",
    html: `
      <h2>StudyByte verification code</h2>
      <p>Your OTP is:</p>
      <h1 style="letter-spacing:4px;">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  };

  await transporter.sendMail(mailOptions);
};

export default sendOtp;
