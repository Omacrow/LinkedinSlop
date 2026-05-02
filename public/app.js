// ── State ──────────────────────────────────────────────────────────
let userSkills = [];
let currentStyle = "bento";
let uploadedImage = null;
let swiperInstance = null;

// ── Topic data ─────────────────────────────────────────────────────
const TOPIC_TEMPLATES = [
  "{skill} tips that changed how I work",
  "What nobody tells you about {skill}",
  "My {skill} process, step by step",
  "The {skill} framework I rely on every day",
  "{skill} mistakes I made so you don't have to",
  "How I got dramatically better at {skill}",
  "5 {skill} techniques worth mastering",
  "{skill} lessons from years of real experience",
  "The truth about {skill} in 2025",
  "How {skill} completely changed my workflow",
  "{skill}: what they never teach you",
  "Advanced {skill} moves that actually work",
  "Why {skill} matters more than people think",
  "The {skill} mindset shift that changed everything",
  "From average to great at {skill}",
  "{skill} fundamentals worth revisiting",
  "How I think about {skill} differently now",
  "The one {skill} habit that 10x'd my results",
  "Building a career around {skill}",
  "What 3 years of {skill} taught me",
];

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

// ── Style definitions ──────────────────────────────────────────────
const STYLES = [
  { id: "bento",         label: "Bento",      swatch: "#FAD4C0" },
  { id: "clean",         label: "Clean",      swatch: "#F3F4F6" },
  { id: "paper",         label: "Paper",      swatch: "#F7F3EB" },
  { id: "neumorphism",   label: "Neumorphic", swatch: "#E8ECF1" },
  { id: "glassmorphism", label: "Glass",      swatch: "#764ba2" },
  { id: "neobrutalism",  label: "Brutalist",  swatch: "#111827" },
  { id: "bold",          label: "Bold",       swatch: "#0A0A0A" },
  { id: "premium",       label: "Premium",    swatch: "#C9A227" },
  { id: "artistic",      label: "Artistic",   swatch: "#FF6B6B" },
  { id: "cafe",          label: "Cafe",       swatch: "#2C1810" },
];

// ── Init ───────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  renderStylePicker();
  updateTopicPlaceholder();

  document.getElementById("primaryColor").addEventListener("input", (e) => {
    document.getElementById("slideSwiper").style.setProperty("--slide-primary", e.target.value);
  });

  document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
  document.getElementById("skillInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addSkill(); }
  });
});

// ── Skills ─────────────────────────────────────────────────────────
function addSkill() {
  const input = document.getElementById("skillInput");
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(",").map(s => s.trim()).filter(Boolean).forEach(s => {
    if (!userSkills.includes(s)) userSkills.push(s);
  });
  input.value = "";
  renderSkills();
  updateTopicPlaceholder();
}

function removeSkill(skill) {
  userSkills = userSkills.filter(s => s !== skill);
  renderSkills();
  updateTopicPlaceholder();
}

function renderSkills() {
  document.getElementById("skillChips").innerHTML = userSkills
    .map(s => `<span class="chip">${escHtml(s)}<button class="chip-remove" onclick="removeSkill(${JSON.stringify(s)})">×</button></span>`)
    .join("");
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Topics ─────────────────────────────────────────────────────────
function randomTopic() {
  if (userSkills.length > 0) {
    const skill = userSkills[Math.floor(Math.random() * userSkills.length)];
    return TOPIC_TEMPLATES[Math.floor(Math.random() * TOPIC_TEMPLATES.length)].replace("{skill}", skill);
  }
  return DEFAULT_TOPICS[Math.floor(Math.random() * DEFAULT_TOPICS.length)];
}

function updateTopicPlaceholder() {
  document.getElementById("topic").placeholder = `e.g. ${randomTopic()}`;
}

function randomizeTopic() {
  const input = document.getElementById("topic");
  input.value = randomTopic();
  input.focus();
}

// ── Style picker ───────────────────────────────────────────────────
function renderStylePicker() {
  document.getElementById("stylePicker").innerHTML = STYLES.map(s => `
    <button class="style-btn${s.id === currentStyle ? " active" : ""}" data-style="${s.id}" onclick="setStyle('${s.id}')">
      <span class="style-swatch" style="background:${s.swatch}"></span>${s.label}
    </button>`).join("");
}

function setStyle(id) {
  currentStyle = id;
  document.querySelectorAll(".style-btn").forEach(b => b.classList.toggle("active", b.dataset.style === id));
}

// ── Image upload ───────────────────────────────────────────────────
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadedImage = ev.target.result;
    // Use background-image on a div — avoids broken <img> states
    const preview = document.getElementById("imagePreviewContent");
    preview.style.backgroundImage = `url("${uploadedImage.replace(/"/g, '\\"')}")`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
    document.getElementById("imagePreviewWrap").hidden = false;
    document.getElementById("imageLabel").classList.add("has-image");
    document.getElementById("imageLabelText").textContent = "✓ Image";
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  uploadedImage = null;
  document.getElementById("imageUpload").value = "";
  document.getElementById("imagePreviewContent").style.backgroundImage = "";
  document.getElementById("imagePreviewWrap").hidden = true;
  document.getElementById("imageLabel").classList.remove("has-image");
  document.getElementById("imageLabelText").textContent = "+ Image";
}

// ── Generate ───────────────────────────────────────────────────────
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
      body: JSON.stringify({ topic, skills: userSkills, style: currentStyle }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

    renderSlides(data, accentColor);

    document.getElementById("caption").textContent = data.caption;
    document.getElementById("tags").textContent = data.hashtags.join(" ");
    document.getElementById("outputArea").style.display = "block";
    updateTopicPlaceholder();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
}

// ── Slide rendering ────────────────────────────────────────────────
function renderSlides(data, accentColor) {
  const wrapper = document.getElementById("slides");
  wrapper.innerHTML = "";

  const styleClass = `style-${currentStyle}`;
  const brand = document.getElementById("brandName").value.trim() || "LinkedIn AI";

  const addSwiperSlide = (el) => {
    const ss = document.createElement("div");
    ss.className = "swiper-slide";
    ss.appendChild(el);
    wrapper.appendChild(ss);
  };

  // Text slides
  data.slides.forEach((text, i) => {
    const div = document.createElement("div");
    div.className = `slide ${styleClass}`;

    if (i === 0 && uploadedImage) {
      const bg = document.createElement("div");
      bg.className = "slide-img-bg";
      bg.style.backgroundImage = `url("${uploadedImage.replace(/"/g, '\\"')}")`;
      div.appendChild(bg);
      div.classList.add("has-image");
    }

    if (i === 0) {
      const hook = document.createElement("div");
      hook.className = "hook";
      hook.textContent = text;
      div.appendChild(hook);
    } else {
      const step = document.createElement("div");
      step.className = "step";
      step.textContent = String(i).padStart(2, "0");
      const content = document.createElement("div");
      content.className = "text";
      content.textContent = text;
      div.appendChild(step);
      div.appendChild(content);
    }

    const brandEl = document.createElement("div");
    brandEl.className = "brand";
    brandEl.textContent = brand;
    div.appendChild(brandEl);

    addSwiperSlide(div);
  });

  // Code slide
  if (data.code) {
    const codeSlide = document.createElement("div");
    codeSlide.className = `slide slide-code ${styleClass}`;
    const label = document.createElement("div");
    label.className = "code-label";
    label.textContent = data.language || "code";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = data.code;
    pre.appendChild(code);
    const brandEl = document.createElement("div");
    brandEl.className = "brand";
    brandEl.textContent = brand;
    codeSlide.appendChild(label);
    codeSlide.appendChild(pre);
    codeSlide.appendChild(brandEl);
    addSwiperSlide(codeSlide);
  }

  // Key insight slide
  if (data.key_insight) {
    const insightSlide = document.createElement("div");
    insightSlide.className = `slide slide-insight ${styleClass}`;
    const label = document.createElement("div");
    label.className = "insight-label";
    label.textContent = "key insight";
    const quote = document.createElement("p");
    quote.className = "insight-text";
    quote.textContent = data.key_insight;
    const brandEl = document.createElement("div");
    brandEl.className = "brand";
    brandEl.textContent = brand;
    insightSlide.appendChild(label);
    insightSlide.appendChild(quote);
    insightSlide.appendChild(brandEl);
    addSwiperSlide(insightSlide);
  }

  // Set accent color on the swiper container
  document.getElementById("slideSwiper").style.setProperty("--slide-primary", accentColor);

  // Show carousel
  document.getElementById("carouselArea").style.display = "block";

  // Init Swiper after DOM update
  requestAnimationFrame(() => initSwiper());
}

// ── Swiper ─────────────────────────────────────────────────────────
function initSwiper() {
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }

  const total = document.querySelectorAll(".swiper-slide").length;
  updateSlideCounter(1, total);

  swiperInstance = new Swiper("#slideSwiper", {
    slidesPerView: "auto",
    centeredSlides: true,
    spaceBetween: 32,
    speed: 380,
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    keyboard: { enabled: true },
    on: {
      slideChange() {
        updateSlideCounter(this.activeIndex + 1, this.slides.length);
      },
    },
  });
}

function updateSlideCounter(current, total) {
  document.getElementById("slideCounter").textContent = `${current} / ${total}`;
}

// ── Capture helper (clones slide off-screen to avoid Swiper clipping) ──
async function captureSlide(slideEl) {
  const accentColor = document.getElementById("slideSwiper").style.getPropertyValue("--slide-primary") || "#FAD4C0";

  const clone = slideEl.cloneNode(true);
  clone.style.cssText = "position:fixed;top:-9999px;left:0;transform:none;z-index:-1;";
  clone.style.setProperty("--slide-primary", accentColor);
  document.body.appendChild(clone);

  const canvas = await html2canvas(clone, { scale: 2, useCORS: true, allowTaint: true });
  document.body.removeChild(clone);
  return canvas;
}

// ── Copy ───────────────────────────────────────────────────────────
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

// ── Download ───────────────────────────────────────────────────────
async function downloadSlides() {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) { alert("Generate slides first."); return; }

  for (let i = 0; i < slides.length; i++) {
    const canvas = await captureSlide(slides[i]);
    const link = document.createElement("a");
    link.download = `slide-${i + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }
}

async function downloadPDF() {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) { alert("Generate slides first."); return; }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [1080, 1080] });

  for (let i = 0; i < slides.length; i++) {
    const canvas = await captureSlide(slides[i]);
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([1080, 1080]);
    pdf.addImage(img, "JPEG", 0, 0, 1080, 1080);
  }

  pdf.save("carousel.pdf");
}
