const nodemailer = require("nodemailer");

const sendOtp = async (email, otp) => {
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
    html: `<h2>Your OTP is: ${otp}</h2>`
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendOtp;