# LinkedIn AISlop Generator

Generate LinkedIn carousel posts using Claude AI or HuggingFace. Pick a topic, choose an accent color, download the slides as PNG.

## Features

- **AI-powered** — Claude (recommended) or HuggingFace Mistral as a free fallback
- **Random topics** — 18 dev topics across React, Node, Express, TypeScript, Python, Django, MongoDB
- **Code snippet slide** — every carousel includes a practical code example
- **Accent color picker** — live preview before you download
- **One-click download** — all slides exported as 1080×1080 PNG
- **Bento design system** — Inter + JetBrains Mono, warm cream palette

## Stack

- Vercel Serverless Functions (Node.js / ESM)
- Vanilla JS frontend — no framework, no build step
- html2canvas for PNG export
- Anthropic Claude API + HuggingFace Inference API

## Local Dev

```bash
git clone https://github.com/Omacrow/LinkedinSlop.git
cd LinkedinSlop
npm install
cp .env.example .env   # add your keys
npm run dev            # http://localhost:3000
```

## Environment Variables

Create a `.env` file in the project root:

```env
CLAUDE_API_KEY=sk-ant-...
HF_API_KEY=hf_...
```

**Getting keys:**

| Key | Where |
|---|---|
| `CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `HF_API_KEY` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → New token (Read) |

> HuggingFace is fully free — create an account, generate a Read token, done.


1. Type a topic — or hit **↻** for a random one
2. Pick an accent color for your slides
3. Choose Claude or HuggingFace
4. Click **Generate**
5. Click **Download All** — 6 PNGs land in your downloads folder
