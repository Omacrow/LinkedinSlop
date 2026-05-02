/**
 * pull-skills.js
 *
 * Downloads all design skill SKILL.md files from the typeui.sh registry
 * into .agents/skills/{slug}/SKILL.md
 *
 * Run: node scripts/pull-skills.js
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", ".agents", "skills");
const INDEX_URL = "https://raw.githubusercontent.com/bergside/awesome-design-skills/main/skills/index.json";
const RAW_BASE = "https://raw.githubusercontent.com/bergside/awesome-design-skills/main";
const BATCH = 8;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function run() {
  console.log("\n  Fetching skill index...");
  const index = await fetchText(INDEX_URL).then(JSON.parse);
  const skills = Object.values(index);
  console.log(`  Found ${skills.length} skills\n`);

  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  const pending = skills.filter(s => {
    const dest = path.join(SKILLS_DIR, s.slug, "SKILL.md");
    return !fs.existsSync(dest);
  });

  if (pending.length === 0) {
    console.log("  All skills already downloaded.\n");
    return;
  }

  console.log(`  Downloading ${pending.length} skill(s)...\n`);

  let ok = 0, fail = [];

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.all(batch.map(async (s) => {
      try {
        const md = await fetchText(`${RAW_BASE}/${s.skillPath}`);
        const dir = path.join(SKILLS_DIR, s.slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "SKILL.md"), md);
        console.log(`  ✓ ${s.slug}`);
        ok++;
      } catch (err) {
        console.log(`  ✗ ${s.slug}: ${err.message}`);
        fail.push(s.slug);
      }
    }));
  }

  console.log(`\n  Done. ${ok} downloaded, ${fail.length} failed.`);
  if (fail.length) console.log(`  Failed: ${fail.join(", ")}`);
  console.log(`  Saved to: ${SKILLS_DIR}\n`);
}

run().catch(console.error);
