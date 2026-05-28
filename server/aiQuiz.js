import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const router = express.Router();
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function getFileExtension(filename = "") {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function getYouTubeContext(youtube) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtube)}&format=json`);
    const data = await response.json();
    return `YouTube video title: ${data.title}\nCreate questions about the concepts likely covered by this video.`;
  } catch {
    return `YouTube video link: ${youtube}\nCreate questions about the topic represented by this video.`;
  }
}

async function getFileContext(file) {
  const extension = getFileExtension(file.originalname);

  if (file.mimetype === "application/pdf" || extension === ".pdf") {
    return await extractPdfText(file.buffer);
  }

  if (file.mimetype === "text/plain" || extension === ".txt") {
    return file.buffer.toString();
  }

  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    return await extractDocxText(file.buffer);
  }

  return "";
}

function getQuestionTypeInstruction(questionType = "mcq") {
  const typeMap = {
    mcq: "Create only multiple choice questions.",
    true_false: "Create only True/False questions.",
    fill_blank: "Create only fill-in-the-blank questions. Put a clear blank in each question using ____.",
    match: "Create only match-the-following questions.",
    mixed: "Create a useful mix of MCQ, True/False, Fill in the Blank, and Match the Following questions."
  };

  return typeMap[questionType] || typeMap.mcq;
}

function buildQuizPrompt({ topic, level, count, context, questionType }) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `
Generate exactly ${count} fresh quiz questions.
Topic: ${topic || "Use the provided content"}
Difficulty: ${level}
Question type: ${questionType}
Freshness seed: ${nonce}

Requirements:
- Create a different set of questions on every request, even for the same topic.
- Avoid repeating obvious first-page textbook questions.
- ${getQuestionTypeInstruction(questionType)}
- For MCQ, use four options and make the answer match one option exactly.
- For True/False, use options ["True", "False"] and make answer exactly "True" or "False".
- For Fill in the Blank, use no options and make answer a short exact phrase.
- For Match the Following, include leftItems, rightItems, and answer as an object mapping each left item to the correct right item.
- Add a short explanation for each correct answer.

${context ? `Source content:\n${context.slice(0, 12000)}` : ""}

Return ONLY JSON:
[
  {
    "type": "mcq | true_false | fill_blank | match",
    "question": "Question here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "leftItems": ["Term 1", "Term 2"],
    "rightItems": ["Meaning A", "Meaning B"],
    "answer": "Option A or exact fill answer or {\"Term 1\":\"Meaning A\"}",
    "explanation": "Brief explanation of why the answer is correct."
  }
]
`;
}

async function callGroq({ apiKey, model, messages, temperature = 0.75 }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("GROQ API ERROR:", data);
    const message = data?.error?.message || "AI request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data?.choices?.[0]?.message?.content?.trim();
}

function parseQuestions(text) {
  if (!text || text.length < 10) {
    throw new Error("AI returned empty response");
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) {
      throw new Error("AI returned invalid JSON");
    }

    return JSON.parse(text.substring(start, end + 1));
  }
}

function cleanQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Invalid question format");
  }

  return questions.map(q => {
    const type = ["mcq", "true_false", "fill_blank", "match"].includes(q.type) ? q.type : "mcq";
    const matchAnswer = q.answer && typeof q.answer === "object" && !Array.isArray(q.answer) ? q.answer : {};
    const leftItems = Array.isArray(q.leftItems) && q.leftItems.length
      ? q.leftItems
      : Object.keys(matchAnswer);
    const rightItems = Array.isArray(q.rightItems) && q.rightItems.length
      ? q.rightItems
      : Object.values(matchAnswer);

    return {
      type,
      question: q.question || "Question missing",
      options: type === "true_false"
        ? ["True", "False"]
        : Array.isArray(q.options) ? q.options : [],
      leftItems,
      rightItems,
      answer: q.answer || "",
      explanation: q.explanation || "No explanation provided."
    };
  });
}

router.post("/quiz", upload.single("file"), async (req, res) => {
  const { topic = "", level = "Beginner", youtube = "", questionType = "mcq" } = req.body;
  const count = parseInt(req.body.count, 10) || 5;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured" });
  }

  try {
    let model = GROQ_MODEL;
    let messages;
    let context = "";

    if (youtube.trim()) {
      context = await getYouTubeContext(youtube.trim());
    }

    if (req.file?.mimetype?.startsWith("image/")) {
      model = GROQ_VISION_MODEL;
      const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      messages = [
        {
          role: "system",
          content: "You are a strict JSON API. Return ONLY a valid JSON array. No markdown."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildQuizPrompt({ topic, level, count, questionType, context: "Use the uploaded image as the source content." })
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl }
            }
          ]
        }
      ];
    } else {
      if (req.file) {
        context = await getFileContext(req.file);
      }

      if (!topic.trim() && !context.trim()) {
        return res.status(400).json({ error: "Topic, file, image, or YouTube link is required" });
      }

      messages = [
        {
          role: "system",
          content: "You are a strict JSON API. Return ONLY a valid JSON array. No explanation outside JSON, no markdown."
        },
        {
          role: "user",
          content: buildQuizPrompt({ topic, level, count, questionType, context })
        }
      ];
    }

    const text = await callGroq({
      apiKey: groqApiKey,
      model,
      messages
    });

    const questions = cleanQuestions(parseQuestions(text));
    return res.json({ questions });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

export default router;
