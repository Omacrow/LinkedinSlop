import fetch from "node-fetch";

const DEFAULT_TOPICS = [
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

const TOPIC_TEMPLATES = [
  "{skill} tips that changed how I work",
  "What nobody tells you about {skill}",
  "My {skill} process, step by step",
  "The {skill} framework I rely on daily",
  "{skill} mistakes I made so you don't have to",
  "5 {skill} techniques worth mastering",
  "{skill} lessons from years of experience",
  "The truth about {skill} in 2025",
  "Advanced {skill} moves that actually work",
  "How {skill} changed my workflow",
];

const DEV_KEYWORDS = /\b(code|coding|software|engineer|engineering|programming|developer|dev|javascript|js|typescript|ts|python|react|node|vue|angular|svelte|java|c\+\+|c#|rust|go|golang|php|ruby|rails|django|flask|fastapi|express|next|nuxt|aws|gcp|azure|devops|docker|kubernetes|linux|unix|git|database|sql|nosql|mongodb|postgresql|mysql|redis|api|backend|frontend|fullstack|web|mobile|ios|android|flutter|machine learning|ml|ai|data science|data engineering|cloud)\b/i;

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTopicFromSkills(skills) {
  const skill = randomFromArray(skills);
  const template = randomFromArray(TOPIC_TEMPLATES);
  return template.replace("{skill}", skill);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const provider = req.query.provider || "claude";
    const rawTopic = req.body?.topic?.trim();
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.filter(Boolean) : [];

    // Determine topic: user input > skills-based random > default random
    const topic = rawTopic
      || (skills.length > 0 ? randomTopicFromSkills(skills) : randomFromArray(DEFAULT_TOPICS));

    // Detect if dev content (no skills = default to dev; skills checked against keywords)
    const isDevContent = skills.length === 0 || skills.some(s => DEV_KEYWORDS.test(s));

    const skillsContext = skills.length > 0
      ? `The audience has expertise in: ${skills.join(", ")}.`
      : "The audience consists of software developers.";

    const prompt = isDevContent
      ? buildDevPrompt(topic, skillsContext)
      : buildGeneralPrompt(topic, skillsContext, skills);

    let result;

    if (provider === "hf") {
      result = await callHuggingFace(prompt);
    } else {
      result = await callClaude(prompt);
    }

    // Validate and normalise
    if (!Array.isArray(result.slides) || result.slides.length === 0) {
      throw new Error("Invalid response: slides array missing.");
    }

    if (typeof result.caption !== "string") result.caption = "";
    if (!Array.isArray(result.hashtags)) result.hashtags = [];

    if (isDevContent) {
      if (typeof result.code !== "string") result.code = "";
      if (typeof result.language !== "string") result.language = "javascript";
      delete result.key_insight;
    } else {
      if (typeof result.key_insight !== "string") result.key_insight = "";
      result.code = "";
      result.language = "";
    }

    result.topic = topic;

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Prompts ────────────────────────────────────────────────────────

function buildDevPrompt(topic, skillsContext) {
  return `Create a LinkedIn carousel post about "${topic}".
${skillsContext}

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "slides": ["hook text", "tip 1", "tip 2", "tip 3", "call to action"],
  "code": "// practical code snippet\\nconst example = () => {};",
  "language": "javascript",
  "caption": "engaging LinkedIn caption",
  "hashtags": ["#React", "#Developer", "#WebDev"]
}

Rules:
- Slide 1: punchy hook (max 15 words, make them stop scrolling)
- Slides 2-4: one concrete actionable tip per slide (1-2 sentences)
- Slide 5: strong call to action
- code: real, practical snippet related to the topic (5-10 lines)
- language: correct language name (javascript, typescript, python, jsx, etc.)
- hashtags: 4-6 relevant tags
- No emojis anywhere`;
}

function buildGeneralPrompt(topic, skillsContext, skills) {
  const hashtagBase = skills.slice(0, 2).map(s => `#${s.replace(/\s+/g, "")}`).join(", ");
  return `Create a LinkedIn carousel post about "${topic}".
${skillsContext}

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "slides": ["hook text", "insight 1", "insight 2", "insight 3", "call to action"],
  "key_insight": "one powerful, memorable takeaway from the post (20-35 words)",
  "caption": "engaging LinkedIn caption (2-3 sentences)",
  "hashtags": ["#ProfessionalGrowth", "${hashtagBase || "#CareerTips"}", "#LinkedIn"]
}

Rules:
- Slide 1: punchy hook (max 15 words, make them stop scrolling)
- Slides 2-4: one concrete, specific insight or tip per slide (1-2 sentences each)
- Slide 5: strong call to action (ask a question or invite engagement)
- key_insight: one quotable, memorable sentence that distills the core message
- hashtags: 4-6 relevant professional tags
- No emojis anywhere
- Tone: confident and professional, not generic`;
}

// ── API callers ────────────────────────────────────────────────────

async function callClaude(prompt) {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error("CLAUDE_API_KEY is not set. Add it to your .env file.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON. Try again.");
  return JSON.parse(match[0]);
}

async function callHuggingFace(prompt) {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY is not set. Add it to your .env file.");
  }

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistralai/Mistral-7B-Instruct-v0.3",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
    }),
  };

  let response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);

  // Cold start — model loading, retry once after 6s
  if (response.status === 503) {
    await new Promise(r => setTimeout(r, 6000));
    response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);
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
  return JSON.parse(match[0]);
}
