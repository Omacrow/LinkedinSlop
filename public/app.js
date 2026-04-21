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

function randomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("topic").placeholder = `e.g. ${randomTopic()}`;

  // Live-update slide accent color as the picker changes
  document.getElementById("primaryColor").addEventListener("input", (e) => {
    document.getElementById("slides").style.setProperty("--slide-primary", e.target.value);
  });
});

function randomizeTopic() {
  const input = document.getElementById("topic");
  input.value = randomTopic();
  input.focus();
}

async function generate() {
  const provider = document.getElementById("provider").value;
  const topic = document.getElementById("topic").value.trim();
  const accentColor = document.getElementById("primaryColor").value;

  const btn = document.getElementById("generateBtn");
  const errEl = document.getElementById("error");

  btn.disabled = true;
  btn.textContent = "Generating...";
  errEl.textContent = "";

  try {
    const res = await fetch(`/api/generate?provider=${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    const container = document.getElementById("slides");
    container.innerHTML = "";

    // Content slides
    data.slides.forEach((text, i) => {
      const div = document.createElement("div");
      div.className = "slide";

      if (i === 0) {
        const hook = document.createElement("div");
        hook.className = "hook";
        hook.textContent = text;
        div.appendChild(hook);
      } else {
        const step = document.createElement("div");
        step.className = "step";
        step.textContent = `0${i}`;

        const content = document.createElement("div");
        content.className = "text";
        content.textContent = text;

        div.appendChild(step);
        div.appendChild(content);
      }

      const brand = document.createElement("div");
      brand.className = "brand";
      brand.textContent = "Umer.dev";
      div.appendChild(brand);

      container.appendChild(div);
    });

    // Code slide
    if (data.code) {
      const codeSlide = document.createElement("div");
      codeSlide.className = "slide slide-code";

      const label = document.createElement("div");
      label.className = "code-label";
      label.textContent = data.language || "code";

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = data.code;
      pre.appendChild(code);

      const brand = document.createElement("div");
      brand.className = "brand";
      brand.textContent = "Umer.dev";

      codeSlide.appendChild(label);
      codeSlide.appendChild(pre);
      codeSlide.appendChild(brand);
      container.appendChild(codeSlide);
    }

    // Apply chosen accent color to all slides
    container.style.setProperty("--slide-primary", accentColor);

    document.getElementById("caption").textContent = data.caption;
    document.getElementById("tags").textContent = data.hashtags.join(" ");

    // Rotate placeholder to next random topic
    document.getElementById("topic").placeholder = `e.g. ${randomTopic()}`;
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
}

async function copy(id) {
  const text = document.getElementById(id).textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.getElementById(id);
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
  }
}

async function downloadSlides() {
  const slides = document.querySelectorAll(".slide");
  if (slides.length === 0) {
    alert("Generate slides first.");
    return;
  }

  for (let i = 0; i < slides.length; i++) {
    const canvas = await html2canvas(slides[i], { scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = `slide-${i + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }
}
