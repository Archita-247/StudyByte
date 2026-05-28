import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import aiQuiz from "./aiQuiz.js";
import aiSummary from "./aiSummary.js";
import authRoutes from "./routes/authRoutes.js";


dotenv.config();


const app = express();

// ✅ CORS (fixes your error)
app.use(cors());

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//✅summary
app.use("/api", aiSummary);
// ✅ Routes
app.use("/api", aiQuiz);
app.use("/api/auth", authRoutes);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
