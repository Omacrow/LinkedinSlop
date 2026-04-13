import fetch from "node-fetch";

const TOPICS = [
  "React hooks that changed how I code",
  "Node.js performance tricks every dev should know",
  "Express middleware patterns explained",
  "TypeScript generics in plain English",
  "Python async/await in practice",
  "Django REST framework quick start",
  "MongoDB aggregation pipeline basics",
  "Why TypeScript beats plain JavaScript",
  "React state management in 2025",
  "Node.js streams explained simply",
  "Building REST APIs with Express",
  "TypeScript utility types you should use",
  "React performance optimization techniques",
  "Python decorators explained with examples",
  "Django ORM tips that save you hours",
  "MERN stack deployment step by step",
  "TypeScript interfaces vs types",
  "Express error handling done right",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const provider = req.query.provider || "claude";
    const rawTopic = req.body?.topic?.trim();
    const topic = rawTopic || TOPICS[Math.floor(Math.random() * TOPICS.length)];

    const prompt = `Create a LinkedIn carousel post about "${topic}" for developers.

Return ONLY valid JSON — no markdown fences, no explanation, just the raw JSON object:
{
  "slides": ["slide1 text", "slide2 text", "slide3 text", "slide4 text", "slide5 text"],
  "code": "// short practical code snippet\\nconst example = () => {};",
  "language": "javascript",
  "caption": "engaging post caption",
  "hashtags": ["#React", "#Developer", "#WebDev"]
}

Rules:
- Slide 1: punchy hook (max 15 words, make them stop scrolling)
- Slides 2-4: one concrete actionable tip per slide (1-2 sentences)
- Slide 5: strong call to action
- code: real, practical snippet directly related to the topic (5-10 lines)
- language: correct language name (javascript, typescript, python, jsx, etc.)
- hashtags: 4-6 relevant tags
- No emojis anywhere`;

    let result;

    if (provider === "hf") {
      if (!process.env.HF_API_KEY) {
        throw new Error("HF_API_KEY is not set. Add it to your .env file.");
      }

      const hfOptions = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistralai/Mistral-7B-Instruct-v0.3",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 900
        })
      };

      let response = await fetch(
        "https://api-inference.huggingface.co/v1/chat/completions",
        hfOptions
      );

      // Cold start — model loading, retry once after 6s
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 6000));
        response = await fetch(
          "https://api-inference.huggingface.co/v1/chat/completions",
          hfOptions
        );
      }

      if (response.status === 401) {
        throw new Error("Invalid HuggingFace API key. Check HF_API_KEY in your .env file.");
      }
      if (response.status === 403) {
        throw new Error("HuggingFace: model access denied. Accept the model terms at huggingface.co/mistralai/Mistral-7B-Instruct-v0.3");
      }
      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(`HuggingFace: ${data.error}`);

      const text = data.choices?.[0]?.message?.content || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("HuggingFace did not return valid JSON. Try Claude instead.");

      result = JSON.parse(match[0]);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} — ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Claude did not return valid JSON. Try again.");

      result = JSON.parse(match[0]);
    }

    if (!Array.isArray(result.slides) || result.slides.length === 0)
      throw new Error("Invalid response: slides array missing.");

    if (typeof result.caption !== "string") result.caption = "";
    if (!Array.isArray(result.hashtags)) result.hashtags = [];
    if (typeof result.code !== "string") result.code = "";
    if (typeof result.language !== "string") result.language = "javascript";

    result.topic = topic;

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
