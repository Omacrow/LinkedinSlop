/**
 * generate-templates.js
 *
 * Generates CSS slide templates for all skills in .agents/skills/
 * using each skill's SKILL.md as the design source of truth.
 *
 * Run: node scripts/generate-templates.js
 * Skip already-cached:  node scripts/generate-templates.js
 * Force regenerate all: node scripts/generate-templates.js --force
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const raw = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {}

const TEMPLATES_DIR  = path.join(__dirname, "..", "templates");
const AGENTS_DIR     = path.join(__dirname, "..", ".agents", "skills");
const FORCE          = process.argv.includes("--force");
const DELAY_MS       = 12000; // 12s between requests — stays under 10k output tokens/min
const SKIP_SLUGS     = new Set(["design-system"]); // not real styles

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function templateExists(slug) {
  return !FORCE && fs.existsSync(path.join(TEMPLATES_DIR, `${slug}.json`));
}

function saveTemplate(slug, label, css, swatchColor, darkBase, fonts) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TEMPLATES_DIR, `${slug}.json`),
    JSON.stringify({ name: slug, label, swatchColor, darkBase, fonts, css, generatedAt: new Date().toISOString() }, null, 2)
  );
}

function buildPrompt(slug, skillMd) {
  // Only send the meaningful part of SKILL.md (trim workflow boilerplate)
  const spec = skillMd.split("## Guideline Authoring Workflow")[0].trim();

  return `Generate CSS for a LinkedIn carousel slide style based on this design system specification.

DESIGN SYSTEM (from typeui.sh):
${spec}

SLIDE HTML (1080×1080px square):
<div class="slide style-${slug}">
  <div class="hook">HEADLINE</div>   <!-- base: 80px weight 900 -->
  <div class="text">BODY COPY</div>  <!-- base: 50px weight 500 -->
  <div class="step">02</div>         <!-- ghost number top-right, 160px, low opacity -->
  <div class="brand">Brand</div>     <!-- bottom-left, 18px -->
</div>
<!-- Dark variants: .slide-code.style-${slug}  and  .slide-insight.style-${slug} -->

CSS RULES:
- MUST use var(--slide-primary) for every accent/glow/highlight — never hardcode it
- Use the design system's surface color for the main slide background
- Use the design system's fonts (they load via Google Fonts — no @font-face needed)
- Override only what differs from the base slide; include ::before/::after if used
- Make .slide-code and .slide-insight clearly dark and visually distinct
- .slide-insight .insight-text should be readable (large, high contrast)

Return ONLY valid JSON (no markdown fences):
{
  "css": ".style-${slug} { ... } .style-${slug} .hook { ... } .style-${slug} .text { ... } .style-${slug} .step { ... } .style-${slug} .brand { ... } .style-${slug}::before { ... } .slide-code.style-${slug} { ... } .slide-insight.style-${slug} { ... } .slide-insight.style-${slug} .insight-text { ... }",
  "swatchColor": "#rrggbb",
  "darkBase": false,
  "fonts": ["Font Name or empty array"]
}`;
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
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
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

async function run() {
  if (!process.env.CLAUDE_API_KEY) {
    console.error("CLAUDE_API_KEY not set in .env");
    process.exit(1);
  }

  // Discover all skills
  let slugs;
  try {
    slugs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
  } catch {
    console.error(`No skills found at ${AGENTS_DIR}. Run: node scripts/pull-skills.js`);
    process.exit(1);
  }

  const pending = slugs.filter(s => !SKIP_SLUGS.has(s) && !templateExists(s));

  console.log(`\n  LinkedIn Carousel — Template Generator (SKILL.md edition)`);
  console.log(`  Skills found:     ${slugs.length}`);
  console.log(`  Already cached:   ${slugs.length - pending.length}`);
  console.log(`  To generate:      ${pending.length}`);
  if (FORCE) console.log(`  Mode: FORCE (regenerating all)`);
  console.log();

  if (pending.length === 0) {
    console.log("  All templates already cached!\n");
    return;
  }

  let ok = 0;
  const failed = [];

  for (let i = 0; i < pending.length; i++) {
    const slug = pending[i];
    const skillMdPath = path.join(AGENTS_DIR, slug, "SKILL.md");
    let skillMd;
    try {
      skillMd = fs.readFileSync(skillMdPath, "utf8");
    } catch {
      console.log(`  ✗ ${slug}: no SKILL.md`);
      failed.push(slug);
      continue;
    }

    try {
      const result = await callClaude(buildPrompt(slug, skillMd));
      if (!result.css) throw new Error("No CSS in response");

      const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
      const label = nameMatch ? capitalize(nameMatch[1].trim()) : capitalize(slug);

      saveTemplate(slug, label, result.css, result.swatchColor || "#888888", result.darkBase || false, result.fonts || []);
      console.log(`  ✓ ${slug} (${i + 1}/${pending.length})`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${slug}: ${err.message}`);
      failed.push(slug);
    }

    // Throttle — 10k output tokens/min limit, each request uses ~1000-1500 tokens
    if (i < pending.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n  Done. ${ok} generated, ${failed.length} failed.`);
  if (failed.length) console.log(`  Failed: ${failed.join(", ")}`);
  console.log(`  Templates saved to: ${TEMPLATES_DIR}\n`);
}

run().catch(console.error);
