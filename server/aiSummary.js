import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const router = express.Router();
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function getSummaryModeInstruction(mode = "study") {
  const modes = {
    study: "Create premium study notes with headings, bullets, key ideas, and a short recap.",
    exam: "Create exam-prep notes with likely exam points, formulas/facts to remember, and quick revision bullets.",
    flashcards: "Create flashcards in Q: / A: format, then add a short review checklist.",
    simplify: "Explain the content in simple language with examples, short sections, and plain wording."
  };

  return modes[mode] || modes.study;
}

function getSummaryLengthInstruction(length = "medium") {
  const lengths = {
    short: "Keep it concise: about 120-180 words unless flashcards are requested.",
    medium: "Use a balanced length: about 250-450 words unless the source is very small.",
    detailed: "Make it detailed and well structured with deeper coverage and more examples."
  };

  return lengths[length] || lengths.medium;
}

async function generateGroqSummary(inputText, options = {}) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");
      return null;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a premium study assistant that creates polished, structured, high-signal study material."
          },
          {
            role: "user",
            content: `
Summarize the following content in a premium study format.

Mode:
${getSummaryModeInstruction(options.summaryMode)}

Length:
${getSummaryLengthInstruction(options.summaryLength)}

Requirements:
- Use clear headings.
- Use bullets where useful.
- Highlight key terms and important ideas.
- Add a "Quick Revision" section at the end unless the selected mode is flashcards.
- Do not add markdown tables.

Content:
${inputText}
            `
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API ERROR:", data);
      return null;
    }

    const output = data.choices?.[0]?.message?.content;

    if (!output || output.trim() === "") {
      console.error("Empty AI response");
      return null;
    }

    return output;
  } catch (err) {
    console.error("AI ERROR:", err);
    return null;
  }
}

async function generateImageSummary(file) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");
      return null;
    }

    const imageDataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read the image and create a clear study summary. Include important visible text, key ideas, and bullet points."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq vision API ERROR:", data);
      return null;
    }

    const output = data.choices?.[0]?.message?.content;
    return output && output.trim() ? output : null;
  } catch (err) {
    console.error("IMAGE AI ERROR:", err);
    return null;
  }
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

function getFileExtension(filename = "") {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

router.post("/summary", upload.single("file"), async (req, res) => {
  try {
    let inputText = "";
    const { text, youtube, summaryMode = "study", summaryLength = "medium" } = req.body;

    if (text && text.trim()) {
      inputText = text.trim();
    }

    if (req.file) {
      if (!req.file.buffer) {
        return res.status(400).json({ error: "Invalid file upload" });
      }

      const file = req.file;
      const extension = getFileExtension(file.originalname);

      if (file.mimetype.startsWith("image/")) {
        const summary = await generateImageSummary(file);

        if (!summary) {
          return res.status(500).json({
            error: "AI failed to generate image summary"
          });
        }

        return res.json({ summary });
      }

      if (file.mimetype === "application/pdf" || extension === ".pdf") {
        inputText = await extractPdfText(file.buffer);
      } else if (file.mimetype === "text/plain") {
        inputText = file.buffer.toString();
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        extension === ".docx"
      ) {
        inputText = await extractDocxText(file.buffer);
      } else {
        return res.status(400).json({
          error: "Only PDF, TXT, DOCX, and image files supported"
        });
      }
    }

    if (youtube && youtube.trim()) {
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${youtube}&format=json`
        );

        const ytData = await response.json();

        inputText = `
Video Title: ${ytData.title}

Explain this topic clearly with key points.
        `;
      } catch (err) {
        console.error("YouTube error:", err);

        inputText = `
Summarize the topic of this video:
${youtube}
        `;
      }
    }

    if (!inputText || inputText.trim() === "") {
      return res.status(400).json({ error: "No input provided" });
    }

    const summary = await generateGroqSummary(inputText, {
      summaryMode,
      summaryLength
    });

    if (!summary) {
      return res.status(500).json({
        error: "AI failed to generate summary"
      });
    }

    res.json({ summary });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
