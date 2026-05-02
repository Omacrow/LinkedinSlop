// ── State ──────────────────────────────────────────────────────────
let userSkills = [];
let currentStyle = "bento";
let uploadedImage = null;
let swiperInstance = null;
let loadedTemplates = {};   // { styleName: { css, swatchColor, fonts, ... } }

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

// Built-in styles (CSS defined in index.html, always available)
const BUILTIN_STYLES = [
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
window.addEventListener("DOMContentLoaded", async () => {
  // Render built-in styles immediately
  renderStylePicker(BUILTIN_STYLES);
  updateTopicPlaceholder();

  document.getElementById("primaryColor").addEventListener("input", (e) => {
    document.getElementById("slideSwiper").style.setProperty("--slide-primary", e.target.value);
  });
  document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
  document.getElementById("skillInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addSkill(); }
  });

  // Load templates in background — updates style picker with extra styles + green dots
  loadTemplates();
});

// ── Template loading ───────────────────────────────────────────────
async function loadTemplates() {
  const statusEl = document.getElementById("templateLoadStatus");
  try {
    statusEl.textContent = "loading styles...";
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    loadedTemplates = await res.json();

    const count = Object.keys(loadedTemplates).length;
    if (count === 0) { statusEl.textContent = ""; return; }

    // Inject each template CSS into its own <style> tag
    for (const [id, t] of Object.entries(loadedTemplates)) {
      if (t.css) injectCss("template-styles-" + id, t.css);
    }

    // Build combined style list: built-ins + all skills (cached or not)
    const builtinIds = new Set(BUILTIN_STYLES.map(s => s.id));
    const extraStyles = Object.entries(loadedTemplates)
      .filter(([id]) => !builtinIds.has(id))
      .map(([id, t]) => ({
        id,
        label: t.label || capitalize(id),
        swatch: t.swatchColor || "#888888",
        cached: t.cached === true || !!t.css,
      }));

    const cachedCount = extraStyles.filter(s => s.cached).length;
    const allStyles = [...BUILTIN_STYLES, ...extraStyles];
    renderStylePicker(allStyles);
    statusEl.textContent = `${cachedCount} cached · ${extraStyles.length - cachedCount} on-demand`;
  } catch {
    statusEl.textContent = "";
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Style picker ───────────────────────────────────────────────────
function renderStylePicker(styles) {
  document.getElementById("stylePicker").innerHTML = styles.map(s => {
    const isBuiltin = BUILTIN_STYLES.some(b => b.id === s.id);
    const isCached = isBuiltin || s.cached || (loadedTemplates[s.id] && loadedTemplates[s.id].css);
    const dotClass = isCached ? " cached" : " on-demand";
    const tooltip = isCached
      ? "CSS cached — only content generated"
      : "First use: CSS generated from typeui.sh SKILL.md, then cached";
    return `<button class="style-btn${s.id === currentStyle ? " active" : ""}${dotClass}"
      data-style="${s.id}"
      onclick="setStyle('${s.id}')"
      title="${tooltip}">
      <span class="style-swatch" style="background:${s.swatch}"></span>${s.label}
    </button>`;
  }).join("");
}

function setStyle(id) {
  currentStyle = id;
  document.querySelectorAll(".style-btn").forEach(b => b.classList.toggle("active", b.dataset.style === id));
}

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

// ── Image upload ───────────────────────────────────────────────────
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadedImage = ev.target.result;
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

// ── Standard generate ──────────────────────────────────────────────
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

    // First-use: inject freshly generated CSS + cache it locally so re-renders work
    if (data.designCss) {
      injectCss("template-styles-" + currentStyle, data.designCss);
      if (Array.isArray(data.fonts) && data.fonts.length) loadTemplateFonts(currentStyle, data.fonts);
      // Also store in loadedTemplates so subsequent renders don't need a reload
      loadedTemplates[currentStyle] = { css: data.designCss, fonts: data.fonts || [] };
    } else {
      injectTemplateCSS(currentStyle);
    }

    renderSlides(data, accentColor, currentStyle);
    showOutput(data, data.templateUsed);
    updateTopicPlaceholder();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
}

// ── Original design generate ───────────────────────────────────────
async function generateOriginal() {
  const provider = document.getElementById("provider").value;
  const words = document.getElementById("designWords").value.trim();
  const topic = document.getElementById("topic").value.trim();
  const accentColor = document.getElementById("primaryColor").value;
  const btn = document.getElementById("originalBtn");
  const errEl = document.getElementById("error");

  if (!words) {
    errEl.textContent = "Enter 3 design words first (e.g. 'dark luxury minimal').";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Designing...";
  errEl.textContent = "";

  try {
    const res = await fetch(`/api/generate-original?provider=${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words, topic, skills: userSkills }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

    // Inject the one-off design CSS into the page for this session
    if (data.designCss) {
      let customStyle = document.getElementById("custom-design-style");
      if (!customStyle) {
        customStyle = document.createElement("style");
        customStyle.id = "custom-design-style";
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = data.designCss;
    }

    // Load any requested Google Fonts
    if (Array.isArray(data.fonts) && data.fonts.length > 0) {
      const fontQuery = data.fonts.map(f => f.replace(/ /g, "+")).join("&family=");
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
      document.head.appendChild(link);
    }

    renderSlides(data, accentColor, "custom");
    showOutput(data, false);
    updateTopicPlaceholder();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Design & Generate";
  }
}

// ── Template CSS injection ─────────────────────────────────────────
function injectCss(id, css) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function loadTemplateFonts(styleName, fonts) {
  if (!fonts || fonts.length === 0) return;
  const fontQuery = fonts.map(f => f.replace(/ /g, "+")).join("&family=");
  if (!document.querySelector(`link[data-font="${styleName}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.font = styleName;
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
    document.head.appendChild(link);
  }
}

function injectTemplateCSS(styleName) {
  const tmpl = loadedTemplates[styleName];
  if (!tmpl || !tmpl.css) return;
  injectCss("template-styles-" + styleName, tmpl.css);
  loadTemplateFonts(styleName, tmpl.fonts);
}

// ── Show output ────────────────────────────────────────────────────
function showOutput(data, templateUsed) {
  document.getElementById("caption").textContent = data.caption;
  document.getElementById("tags").textContent = data.hashtags.join(" ");
  document.getElementById("outputArea").style.display = "block";

  const badge = document.getElementById("tokenBadge");
  badge.textContent = templateUsed ? "cached style" : "style generated + cached";
  badge.style.display = "inline";
}

// ── Slide rendering ────────────────────────────────────────────────
function renderSlides(data, accentColor, styleId) {
  const wrapper = document.getElementById("slides");
  wrapper.innerHTML = "";

  const styleClass = `style-${styleId}`;
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

  document.getElementById("slideSwiper").style.setProperty("--slide-primary", accentColor);
  document.getElementById("carouselArea").style.display = "block";

  requestAnimationFrame(() => {
    initSwiper();
    initEditor();
  });
}

// ── Slide Editor ───────────────────────────────────────────────────

const QUICK_FONTS = [
  "Inter", "Poppins", "Montserrat", "Raleway", "Oswald",
  "Playfair Display", "Bebas Neue", "Space Grotesk", "DM Sans",
  "Outfit", "Syne", "Merriweather", "Fraunces", "Nunito",
  "Lato", "Roboto", "Righteous", "Comfortaa", "Bitter", "JetBrains Mono",
];

function initEditor() {
  // Make all text elements directly editable
  document.querySelectorAll(
    ".slide .hook, .slide .text, .slide .brand, .slide .insight-text, .slide .code-label"
  ).forEach(el => {
    el.contentEditable = "true";
    el.spellcheck = false;
  });

  // Render font quick-picks
  document.getElementById("fontChips").innerHTML = QUICK_FONTS.map(f =>
    `<button class="font-chip" style="font-family:'${f}',sans-serif" onclick="applyFont('${f}')">${f}</button>`
  ).join("");

  // Populate datalist
  document.getElementById("fontList").innerHTML = QUICK_FONTS.map(f =>
    `<option value="${f}">`
  ).join("");

  // Sync sliders to current rendered values
  const hook = document.querySelector(".slide .hook");
  if (hook) {
    const sz = Math.round(parseFloat(getComputedStyle(hook).fontSize)) || 80;
    document.getElementById("hookSizeSlider").value = sz;
    document.getElementById("hookSizeVal").textContent = sz + "px";
  }
  const body = document.querySelector(".slide .text");
  if (body) {
    const sz = Math.round(parseFloat(getComputedStyle(body).fontSize)) || 50;
    document.getElementById("bodySizeSlider").value = sz;
    document.getElementById("bodySizeVal").textContent = sz + "px";
  }

  // Reset color pickers to their default state
  document.getElementById("bgColorPicker").value = "#ffffff";
  document.getElementById("hookColorPicker").value = "#111827";
  document.getElementById("bodyColorPicker").value = "#111827";
  document.getElementById("darkBgColorPicker").value = "#111827";
  document.getElementById("brandColorPicker").value = "#80A1C1";
  document.getElementById("stepColorPicker").value = "#FAD4C0";

  document.getElementById("slideEditor").style.display = "block";
}

// Font loading via Google Fonts CSS API (no API key required)
function loadGoogleFont(fontName) {
  const id = `gfont-${fontName.replace(/ /g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap`;
  document.head.appendChild(link);
}

function applySelectedFont() {
  const name = document.getElementById("fontInput").value.trim();
  if (name) applyFont(name);
}

function applyFont(name) {
  loadGoogleFont(name);
  document.querySelectorAll(".slide .hook, .slide .text").forEach(el => {
    el.style.fontFamily = `"${name}", sans-serif`;
  });
  document.querySelectorAll(".font-chip").forEach(btn =>
    btn.classList.toggle("active", btn.textContent === name)
  );
  document.getElementById("fontInput").value = name;
}

function updateHookSize(val) {
  document.querySelectorAll(".slide .hook").forEach(el => el.style.fontSize = val + "px");
  document.getElementById("hookSizeVal").textContent = val + "px";
}

function updateBodySize(val) {
  document.querySelectorAll(".slide .text").forEach(el => el.style.fontSize = val + "px");
  document.getElementById("bodySizeVal").textContent = val + "px";
}

function updateHookColor(color) {
  document.querySelectorAll(".slide .hook").forEach(el => el.style.color = color);
}

function updateBodyColor(color) {
  document.querySelectorAll(".slide .text").forEach(el => el.style.color = color);
}

function updateBgColor(color) {
  document.querySelectorAll(".slide:not(.slide-code):not(.slide-insight)").forEach(el => {
    el.style.background = color;
  });
}

function updateDarkBgColor(color) {
  document.querySelectorAll(".slide-code, .slide-insight").forEach(el => {
    el.style.background = color;
  });
}

function updateBrandColor(color) {
  document.querySelectorAll(".slide .brand").forEach(el => el.style.color = color);
}

function updateStepColor(color) {
  document.querySelectorAll(".slide .step").forEach(el => el.style.color = color);
}

function resetEditorColors() {
  document.querySelectorAll(".slide").forEach(el => {
    el.style.background = "";
    el.style.backgroundColor = "";
  });
  [".slide .hook", ".slide .text", ".slide .brand", ".slide .step"].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.style.color = "");
  });
  document.getElementById("bgColorPicker").value = "#ffffff";
  document.getElementById("hookColorPicker").value = "#111827";
  document.getElementById("bodyColorPicker").value = "#111827";
  document.getElementById("darkBgColorPicker").value = "#111827";
  document.getElementById("brandColorPicker").value = "#80A1C1";
  document.getElementById("stepColorPicker").value = "#FAD4C0";
}

// ── Swiper ─────────────────────────────────────────────────────────
function initSwiper() {
  if (swiperInstance) { swiperInstance.destroy(true, true); swiperInstance = null; }

  const total = document.querySelectorAll(".swiper-slide").length;
  updateSlideCounter(1, total);

  swiperInstance = new Swiper("#slideSwiper", {
    slidesPerView: "auto",
    centeredSlides: true,
    spaceBetween: 32,
    speed: 380,
    pagination: { el: ".swiper-pagination", clickable: true },
    navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
    keyboard: { enabled: true },
    on: {
      slideChange() { updateSlideCounter(this.activeIndex + 1, this.slides.length); },
    },
  });
}

function updateSlideCounter(current, total) {
  document.getElementById("slideCounter").textContent = `${current} / ${total}`;
}

// ── Capture (off-screen clone avoids Swiper overflow clipping) ─────
async function captureSlide(slideEl) {
  const accentColor = document.getElementById("slideSwiper").style.getPropertyValue("--slide-primary") || "#FAD4C0";
  const clone = slideEl.cloneNode(true);
  // Set positioning individually — cssText would overwrite editor inline styles (bg/color)
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  clone.style.left = "0";
  clone.style.transform = "none";
  clone.style.zIndex = "-1";
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
