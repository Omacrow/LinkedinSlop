/**
 * POST /api/generate-original
 *
 * Accepts 3 design words + topic + skills.
 * Claude expands the words into a full slide CSS design, then generates content.
 * One API call. CSS is NOT saved (it's a unique one-off design).
 */
import fetch from "node-fetch";

const DEV_KEYWORDS = /\b(code|coding|software|engineer|programming|developer|dev|javascript|typescript|python|react|node|vue|angular|java|rust|go|php|ruby|django|flask|express|next|aws|docker|kubernetes|linux|git|sql|nosql|mongodb|api|backend|frontend|fullstack|web|mobile|ml|machine learning|data science)\b/i;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const provider = req.query.provider || "claude";
    const words = (req.body?.words || "").trim();
    const topic = (req.body?.topic || "").trim();
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.filter(Boolean) : [];

    if (!words) throw new Error("Provide 3 design words (e.g. 'dark luxury minimal').");

    const isDevContent = skills.length === 0 || skills.some(s => DEV_KEYWORDS.test(s));
    const skillsContext = skills.length > 0
      ? `The audience has expertise in: ${skills.join(", ")}.`
      : "The audience consists of software developers.";
    const topicLine = topic
      ? `Topic: "${topic}"`
      : "Choose an interesting topic relevant to the audience's skills.";

    const prompt = buildPrompt(words, topicLine, skillsContext, isDevContent);

    let result;
    if (provider === "hf") {
      result = await callHuggingFace(prompt);
    } else {
      result = await callClaude(prompt);
    }

    // Validate
    if (!Array.isArray(result.slides) || result.slides.length === 0) {
      throw new Error("Invalid response: slides array missing.");
    }
    if (typeof result.designCss !== "string") result.designCss = "";
    if (typeof result.caption !== "string") result.caption = "";
    if (!Array.isArray(result.hashtags)) result.hashtags = [];
    if (typeof result.swatchColor !== "string") result.swatchColor = "#888888";
    if (typeof result.fonts !== "object") result.fonts = [];

    if (isDevContent) {
      if (typeof result.code !== "string") result.code = "";
      if (typeof result.language !== "string") result.language = "javascript";
      delete result.key_insight;
    } else {
      if (typeof result.key_insight !== "string") result.key_insight = "";
      result.code = "";
      result.language = "";
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Prompt ─────────────────────────────────────────────────────────

function buildPrompt(words, topicLine, skillsContext, isDevContent) {
  const contentFields = isDevContent
    ? `"code": "// practical snippet 5-10 lines",\n  "language": "javascript",`
    : `"key_insight": "one quotable, memorable takeaway (20-35 words)",`;

  return `You are a UI designer AND content writer. Do two things in one response:

1. Design a unique LinkedIn slide style inspired by: "${words}"
2. Write carousel content about the topic

${topicLine}
${skillsContext}

CSS context — the slide HTML is:
  <div class="slide style-custom">
    <div class="hook">BIG HEADLINE</div>
    <div class="text">BODY COPY</div>
    <div class="step">02</div>            <!-- ghost number, decorative -->
    <div class="brand">Brand</div>        <!-- footer -->
  </div>
  <div class="slide slide-code style-custom">...</div>   <!-- dark code variant -->
  <div class="slide slide-insight style-custom">...</div> <!-- dark insight variant -->

CSS rules:
- Use var(--slide-primary) for accent/highlight colors
- Include rules for .style-custom container, .hook, .text, .step, .brand, ::before/::after
- Include .slide-code.style-custom and .slide-insight.style-custom dark variants
- Make it feel genuinely like "${words}" — be creative and specific

Return ONLY valid JSON (no markdown):
{
  "designCss": ".style-custom { background: ...; } .style-custom .hook { ... } .slide-code.style-custom { ... } .slide-insight.style-custom { ... }",
  "swatchColor": "#rrggbb",
  "fonts": [],
  "darkBase": false,
  "slides": ["hook max 15 words", "tip 1 (1-2 sentences)", "tip 2", "tip 3", "call to action"],
  ${contentFields}
  "caption": "LinkedIn caption 2-3 sentences",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4"]
}`;
}

// ── API callers ────────────────────────────────────────────────────

async function callClaude(prompt) {
  if (!process.env.CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY not set.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude error ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON.");
  return JSON.parse(match[0]);
}

async function callHuggingFace(prompt) {
  if (!process.env.HF_API_KEY) throw new Error("HF_API_KEY not set.");
  const options = {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistralai/Mistral-7B-Instruct-v0.3",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1800,
    }),
  };
  let response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);
  if (response.status === 503) {
    await new Promise(r => setTimeout(r, 6000));
    response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);
  }
  if (!response.ok) throw new Error(`HuggingFace error: ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("HuggingFace did not return valid JSON.");
  return JSON.parse(match[0]);
}
