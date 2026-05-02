import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const AGENTS_DIR = path.join(__dirname, "..", ".agents", "skills");

// These styles have CSS hardcoded in index.html — never generate CSS for them
const BUILTIN_STYLES = new Set([
  "bento", "clean", "paper", "neumorphism", "glassmorphism",
  "neobrutalism", "bold", "premium", "artistic", "cafe",
]);

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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── File helpers ───────────────────────────────────────────────────

function getTemplate(styleName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, `${styleName}.json`), "utf8"));
  } catch {
    return null;
  }
}

function saveTemplate(styleName, label, css, swatchColor, darkBase, fonts) {
  try {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(TEMPLATES_DIR, `${styleName}.json`),
      JSON.stringify({ name: styleName, label, swatchColor, darkBase, fonts, css, generatedAt: new Date().toISOString() }, null, 2)
    );
  } catch { /* non-fatal */ }
}

function getSkillMd(styleName) {
  try {
    const raw = fs.readFileSync(path.join(AGENTS_DIR, styleName, "SKILL.md"), "utf8");
    // Trim to the relevant part (up to the workflow section which isn't needed for CSS)
    return raw.split("## Guideline Authoring Workflow")[0].trim();
  } catch {
    return null;
  }
}

// ── Prompts ────────────────────────────────────────────────────────

function buildContentOnlyPrompt(topic, skillsContext, isDevContent) {
  const contentField = isDevContent
    ? `"code": "// practical 5-10 line snippet",\n  "language": "javascript",`
    : `"key_insight": "one quotable memorable takeaway (20-35 words)",`;

  return `Generate LinkedIn carousel text about "${topic}".
${skillsContext}

Return ONLY valid JSON:
{
  "slides": ["hook max 15 words", "tip 1 (1-2 sentences)", "tip 2", "tip 3", "call to action"],
  ${contentField}
  "caption": "LinkedIn caption 2-3 sentences",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4"]
}

Rules: hook max 15 words; tips specific and concrete; CTA invites engagement; 4-6 hashtags; no emojis.`;
}

/**
 * First-use prompt: uses typeui.sh SKILL.md as the design source of truth.
 * Generates CSS + slide content in one call, then we cache the CSS template.
 */
function buildFirstUsePrompt(style, skillMd, topic, skillsContext, isDevContent) {
  const contentField = isDevContent
    ? `"code": "// practical 5-10 line snippet",\n  "language": "javascript",`
    : `"key_insight": "one quotable memorable takeaway (20-35 words)",`;

  return `Generate CSS for a LinkedIn carousel slide style using this design system, then generate slide content.

DESIGN SYSTEM (typeui.sh):
${skillMd}

SLIDE HTML (1080×1080px square):
<div class="slide style-${style}">
  <div class="hook">HEADLINE</div>   <!-- base: 80px weight 900 -->
  <div class="text">BODY COPY</div>  <!-- base: 50px weight 500 -->
  <div class="step">02</div>         <!-- ghost number top-right, 160px, low opacity -->
  <div class="brand">Brand</div>     <!-- bottom-left, 18px -->
</div>
<!-- Dark variants: .slide-code.style-${style}  and  .slide-insight.style-${style} -->

CSS RULES:
- MUST use var(--slide-primary) for every accent/glow/highlight color — never hardcode it
- Use the design system surface color for the main background
- Use the design system fonts from Style Foundations (they are loaded via Google Fonts)
- Override only what differs from the base slide; include ::before/::after if used
- Make .slide-code and .slide-insight clearly dark and distinct

TOPIC: "${topic}"
${skillsContext}

Return ONLY valid JSON (no markdown fences):
{
  "css": ".style-${style} { ... } .style-${style} .hook { ... } .style-${style} .text { ... } .style-${style} .step { ... } .style-${style} .brand { ... } .style-${style}::before { ... } .slide-code.style-${style} { ... } .slide-insight.style-${style} { ... } .slide-insight.style-${style} .insight-text { ... }",
  "swatchColor": "#rrggbb",
  "darkBase": false,
  "fonts": ["Font Name"],
  "slides": ["hook max 15 words", "tip 1", "tip 2", "tip 3", "call to action"],
  ${contentField}
  "caption": "LinkedIn caption 2-3 sentences",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3"]
}`;
}

function buildDevPrompt(topic, skillsContext) {
  return `Create a LinkedIn carousel post about "${topic}".
${skillsContext}

Return ONLY valid JSON:
{
  "slides": ["hook text", "tip 1", "tip 2", "tip 3", "call to action"],
  "code": "// short practical code snippet\\nconst example = () => {};",
  "language": "javascript",
  "caption": "engaging LinkedIn caption",
  "hashtags": ["#React", "#Developer", "#WebDev"]
}

Rules: slide 1 hook max 15 words; slides 2-4 one concrete tip each; slide 5 CTA; code 5-10 lines; 4-6 hashtags; no emojis.`;
}

function buildGeneralPrompt(topic, skillsContext, skills) {
  const hashtagBase = skills.slice(0, 2).map(s => `#${s.replace(/\s+/g, "")}`).join(", ");
  return `Create a LinkedIn carousel post about "${topic}".
${skillsContext}

Return ONLY valid JSON:
{
  "slides": ["hook text", "insight 1", "insight 2", "insight 3", "call to action"],
  "key_insight": "one powerful memorable takeaway (20-35 words)",
  "caption": "engaging LinkedIn caption (2-3 sentences)",
  "hashtags": ["#ProfessionalGrowth", "${hashtagBase || "#CareerTips"}", "#LinkedIn"]
}

Rules: hook max 15 words; 3 specific actionable insights; CTA asks a question; 4-6 hashtags; no emojis; confident professional tone.`;
}

// ── API callers ────────────────────────────────────────────────────

async function callClaude(prompt, maxTokens = 1024) {
  if (!process.env.CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not set.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error ${response.status}: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON. Try again.");
  return JSON.parse(match[0]);
}

async function callHuggingFace(prompt) {
  if (!process.env.HF_API_KEY) throw new Error("HF_API_KEY is not set.");
  const options = {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistralai/Mistral-7B-Instruct-v0.3",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
    }),
  };

  let response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);
  if (response.status === 503) {
    await new Promise(r => setTimeout(r, 6000));
    response = await fetch("https://api-inference.huggingface.co/v1/chat/completions", options);
  }
  if (response.status === 401) throw new Error("Invalid HuggingFace API key.");
  if (response.status === 403) throw new Error("HuggingFace model access denied.");
  if (!response.ok) throw new Error(`HuggingFace API error: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(`HuggingFace: ${data.error}`);
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("HuggingFace did not return valid JSON. Try Claude.");
  return JSON.parse(match[0]);
}

// ── Main handler ───────────────────────────────────────────────────

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
    const style = req.body?.style || "bento";

    const topic = rawTopic || (() => {
      if (skills.length > 0) {
        const skill = skills[Math.floor(Math.random() * skills.length)];
        return TOPIC_TEMPLATES[Math.floor(Math.random() * TOPIC_TEMPLATES.length)].replace("{skill}", skill);
      }
      return DEFAULT_TOPICS[Math.floor(Math.random() * DEFAULT_TOPICS.length)];
    })();

    const isDevContent = skills.length === 0 || skills.some(s => DEV_KEYWORDS.test(s));
    const skillsContext = skills.length > 0
      ? `The audience has expertise in: ${skills.join(", ")}.`
      : "The audience consists of software developers.";

    // ── Determine generation strategy ──
    const isBuiltin = BUILTIN_STYLES.has(style);
    const existingTemplate = isBuiltin ? null : getTemplate(style);
    const useContentOnly = isBuiltin || existingTemplate !== null;

    let prompt, maxTokens;
    let freshCss = null;

    if (useContentOnly) {
      // CSS already exists (builtin or cached) — content only
      prompt = buildContentOnlyPrompt(topic, skillsContext, isDevContent);
      maxTokens = 1024;
    } else {
      // First use of this style — generate CSS from SKILL.md + content in one call
      const skillMd = getSkillMd(style);
      if (skillMd) {
        prompt = buildFirstUsePrompt(style, skillMd, topic, skillsContext, isDevContent);
        maxTokens = 3500;
      } else {
        // No SKILL.md — fall back to content-only with existing prompts
        prompt = isDevContent
          ? buildDevPrompt(topic, skillsContext)
          : buildGeneralPrompt(topic, skillsContext, skills);
        maxTokens = 1024;
      }
    }

    let result;
    if (provider === "hf") {
      result = await callHuggingFace(prompt);
    } else {
      result = await callClaude(prompt, maxTokens);
    }

    // ── Save CSS template if we just generated it ──
    if (!useContentOnly && result.css) {
      saveTemplate(
        style,
        capitalize(style),
        result.css,
        result.swatchColor || "#888888",
        result.darkBase || false,
        result.fonts || []
      );
      freshCss = result.css;
    }

    // ── Normalise response ──
    if (!Array.isArray(result.slides) || result.slides.length === 0) {
      if (result.hook && Array.isArray(result.tips)) {
        result.slides = [result.hook, ...result.tips, result.cta || ""].filter(Boolean);
        delete result.hook; delete result.tips; delete result.cta;
      } else if (result.hook) {
        result.slides = [result.hook, result.cta || ""].filter(Boolean);
        delete result.hook; delete result.cta;
      } else {
        throw new Error("Invalid response: slides array missing.");
      }
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

    // Strip CSS generation fields from response body
    delete result.css;
    delete result.swatchColor;
    delete result.darkBase;

    result.topic = topic;
    result.templateUsed = useContentOnly;
    result.designCss = freshCss;  // null if content-only, CSS string if first-use
    result.fonts = result.fonts || [];

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
