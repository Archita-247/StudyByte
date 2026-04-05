const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/authRoutes");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors()); // allow frontend to connect
app.use(express.json()); // parse JSON body

/* =========================
   ROUTES
========================= */

// Main route (health check)
app.get("/", (req, res) => {
  res.send("StudyByte Backend Running 🚀");
});

// Test route (for debugging after deploy)
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API working perfectly ✅"
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

/* =========================
   ERROR HANDLING (OPTIONAL BUT GOOD)
========================= */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong on server"
  });
});

/* =========================
   PORT (REQUIRED FOR RENDER)
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});