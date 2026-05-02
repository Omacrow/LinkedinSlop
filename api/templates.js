import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const AGENTS_DIR = path.join(__dirname, "..", ".agents", "skills");

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Extract swatch color and label from a SKILL.md file
function parseSkillMd(slug, md) {
  // Label from frontmatter: "name: bento"
  const nameMatch = md.match(/^name:\s*(.+)$/m);
  const label = nameMatch ? capitalize(nameMatch[1].trim()) : capitalize(slug);

  // Primary color from Style Foundations: "Tokens: primary=#FAD4C0"
  const colorMatch = md.match(/primary=([#][0-9a-fA-F]{3,6})/);
  const swatchColor = colorMatch ? colorMatch[1] : "#888888";

  // Dark base — surface color is dark if starts with #0 or #1
  const surfaceMatch = md.match(/surface=([#][0-9a-fA-F]{3,6})/);
  const surface = surfaceMatch ? surfaceMatch[1] : "#ffffff";
  const darkBase = surface.toLowerCase() < "#555555";

  return { label, swatchColor, darkBase };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const result = {};

  // 1. Load cached templates (have real CSS)
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const slug = file.replace(".json", "");
      try {
        result[slug] = { ...JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf8")), cached: true };
      } catch {}
    }
  } catch {}

  // 2. Add skills available via SKILL.md but not yet cached
  try {
    const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const slug of dirs) {
      if (result[slug]) continue; // already cached
      try {
        const md = fs.readFileSync(path.join(AGENTS_DIR, slug, "SKILL.md"), "utf8");
        const { label, swatchColor, darkBase } = parseSkillMd(slug, md);
        result[slug] = { name: slug, label, swatchColor, darkBase, fonts: [], css: null, cached: false };
      } catch {}
    }
  } catch {}

  res.status(200).json(result);
}
