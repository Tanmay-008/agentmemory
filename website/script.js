// agentmemory — interactive behavior for the Lamborghini-inspired landing.
// Vanilla JS, no deps. Respects prefers-reduced-motion where it matters.

const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Scroll progress rail ----------
const rail = document.querySelector(".scroll-progress span");
const heroRail = document.getElementById("rail");
function updateProgress() {
  const h = document.documentElement;
  const scrolled = h.scrollTop;
  const max = h.scrollHeight - h.clientHeight;
  const pct = max <= 0 ? 0 : Math.min(1, scrolled / max);
  if (rail) rail.style.width = `${pct * 100}%`;
  if (heroRail) heroRail.style.width = `${pct * 100}%`;
}
updateProgress();
addEventListener("scroll", updateProgress, { passive: true });

// ---------- Reveal on intersect ----------
const revealTargets = document.querySelectorAll(
  ".section__head, .prim-card, .stat, .compare__row, .agents__tile, .copybox, .terminal"
);
for (const el of revealTargets) el.classList.add("reveal");

const revealIO = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealIO.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
revealTargets.forEach((el) => revealIO.observe(el));

// ---------- Animated counters ----------
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const duration = 1400;
  const isFloat = !Number.isInteger(target);
  const startAt = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - startAt) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = target * eased;
    el.textContent = isFloat ? `${v.toFixed(1)}${suffix}` : `${Math.round(v)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
    else
      el.textContent = isFloat ? `${target.toFixed(1)}${suffix}` : `${target}${suffix}`;
  }
  requestAnimationFrame(tick);
}

const statIO = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const num = entry.target.querySelector(".stat__num");
      if (num && !num.dataset.done) {
        num.dataset.done = "1";
        countUp(num);
      }
      statIO.unobserve(entry.target);
    }
  },
  { threshold: 0.5 }
);
document.querySelectorAll("[data-stat]").forEach((el) => statIO.observe(el));

// ---------- Hero memory graph ----------
const canvas = document.getElementById("memgraph");
const ctx = canvas?.getContext("2d");
let graphRunning = !REDUCE_MOTION;
let nodes = [];
let edges = [];
let pulse = 0;

function sizeCanvas() {
  if (!canvas) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seedGraph() {
  if (!canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const count = Math.min(52, Math.floor((w * h) / 22000));
  nodes = new Array(count).fill(0).map(() => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    r: 1.2 + Math.random() * 2.2,
    hot: Math.random() < 0.25,
  }));
  edges = [];
}

function drawGraph() {
  if (!ctx || !canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // Step nodes
  for (const n of nodes) {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > w) n.vx *= -1;
    if (n.y < 0 || n.y > h) n.vy *= -1;
  }

  // Draw edges for nodes within range (live recomputation, O(n^2))
  const maxDist = 160;
  ctx.lineWidth = 1;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > maxDist) continue;
      const alpha = (1 - d / maxDist) * 0.35;
      const hot = a.hot && b.hot;
      ctx.strokeStyle = hot
        ? `rgba(255, 192, 0, ${alpha.toFixed(3)})`
        : `rgba(255, 255, 255, ${(alpha * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const n of nodes) {
    const r = n.r + (n.hot ? Math.sin(pulse + n.x) * 0.8 : 0);
    ctx.fillStyle = n.hot ? "#FFC000" : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(n.x, n.y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
    if (n.hot) {
      ctx.fillStyle = "rgba(255, 192, 0, 0.12)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  pulse += 0.04;
}

function tickGraph() {
  if (!graphRunning) return;
  drawGraph();
  requestAnimationFrame(tickGraph);
}

if (canvas) {
  sizeCanvas();
  seedGraph();
  drawGraph();
  if (graphRunning) requestAnimationFrame(tickGraph);
  addEventListener("resize", () => {
    sizeCanvas();
    seedGraph();
    drawGraph();
  });
}

const pauseBtn = document.getElementById("graph-toggle");
const pauseIcon = document.getElementById("pause-icon");
pauseBtn?.addEventListener("click", () => {
  graphRunning = !graphRunning;
  if (graphRunning) requestAnimationFrame(tickGraph);
  if (pauseIcon) {
    pauseIcon.innerHTML = graphRunning
      ? '<rect x="17" y="16" width="4" height="16" fill="#fff"/><rect x="27" y="16" width="4" height="16" fill="#fff"/>'
      : '<polygon points="18,14 34,24 18,34" fill="#fff"/>';
  }
  pauseBtn.setAttribute(
    "aria-label",
    graphRunning ? "Pause animation" : "Resume animation"
  );
});

// ---------- Terminal typewriter ----------
const TERM_SCRIPT = [
  { t: "prompt", text: "$ " },
  { t: "typed", text: "npx @agentmemory/agentmemory\n" },
  { t: "plain", text: "[agentmemory] iii-engine ready on :3111\n" },
  { t: "plain", text: "[agentmemory] 44 MCP tools registered\n" },
  { t: "plain", text: "[agentmemory] 12 autohooks armed\n\n" },
  { t: "prompt", text: "$ " },
  { t: "typed", text: "memory.recall({ query: \"where did we land the retry logic?\" })\n" },
  { t: "comment", text: "// triple-stream retrieval: BM25 + vector + graph\n" },
  { t: "ok", text: "✓ 3 memories · p50 18ms · reranked on device\n\n" },
  { t: "plain", text: "→ " },
  { t: "val", text: "src/retry.ts:47 · exponentialBackoff(max=5, jitter=true)\n" },
  { t: "plain", text: "→ " },
  { t: "val", text: "commit 8f2e14c · \"resolve conflict + honor x-amz headers\"\n" },
  { t: "plain", text: "→ " },
  { t: "val", text: "session 2026-04-16 · \"bug: race when Retry-After is empty\"\n\n" },
  { t: "prompt", text: "$ " },
  { t: "typed", text: "memory.consolidate({ project: 'pay-api' })\n" },
  { t: "ok", text: "✓ 18 raw observations → 4 semantic memories · audit row emitted\n" },
];

const term = document.getElementById("term");
const termStatus = document.getElementById("term-status");
const replayBtn = document.getElementById("term-replay");

function classFor(type) {
  switch (type) {
    case "prompt":
      return "t-prompt";
    case "comment":
      return "t-comment";
    case "ok":
      return "t-ok";
    case "val":
      return "t-val";
    default:
      return "";
  }
}

async function playTerminal() {
  if (!term) return;
  term.innerHTML = "";
  const caret = document.createElement("span");
  caret.className = "t-caret";
  term.appendChild(caret);
  if (termStatus) termStatus.textContent = "RUNNING";
  for (const seg of TERM_SCRIPT) {
    const span = document.createElement("span");
    span.className = classFor(seg.t);
    term.insertBefore(span, caret);
    if (seg.t === "typed") {
      for (const ch of seg.text) {
        span.textContent += ch;
        await sleep(REDUCE_MOTION ? 0 : 16 + Math.random() * 34);
      }
      await sleep(REDUCE_MOTION ? 0 : 260);
    } else {
      span.textContent = seg.text;
      await sleep(REDUCE_MOTION ? 0 : 160);
    }
  }
  if (termStatus) termStatus.textContent = "DONE";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const termIO = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!term.dataset.played) {
        term.dataset.played = "1";
        playTerminal();
      }
      termIO.unobserve(entry.target);
    }
  },
  { threshold: 0.4 }
);
if (term) termIO.observe(term.closest(".terminal"));

replayBtn?.addEventListener("click", () => playTerminal());

// ---------- Tilt effect on primitive cards ----------
const tiltCards = document.querySelectorAll("[data-tilt]");
tiltCards.forEach((card) => {
  if (REDUCE_MOTION) return;
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-4px) rotateX(${(-py * 4).toFixed(
      2
    )}deg) rotateY(${(px * 4).toFixed(2)}deg)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});

// ---------- Copy install boxes ----------
document.querySelectorAll(".copybox").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const cmd = btn.dataset.copy || "";
    try {
      await navigator.clipboard.writeText(cmd);
      const hint = btn.querySelector(".copybox__hint");
      const original = hint.textContent;
      hint.textContent = "COPIED";
      btn.classList.add("is-copied");
      setTimeout(() => {
        hint.textContent = original;
        btn.classList.remove("is-copied");
      }, 1600);
    } catch {
      btn.querySelector(".copybox__hint").textContent = "CLIPBOARD BLOCKED";
    }
  });
});
