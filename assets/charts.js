// 极简 SVG 折线图（零依赖）。
// 支持：时间轴 x、step（阶梯，用于 PB 推移）、y 轴反转（用于顺位）、悬停提示、图例开关。
// 按容器实际像素宽度渲染，所以窄栏里的字号也不会被压缩变形。

const PALETTE = ["#0f7a52", "#2563a8", "#b8912b", "#b4442f", "#7b4fa8", "#0d8a8a", "#8d6e3a", "#c2185b"];

const toMs = (x) => (typeof x === "number" ? x : Date.parse(String(x) + "T00:00:00Z"));

/** category 模式：把 x 当成「学年」「年度」这类等距的类别 */
function buildCategories(series, opts) {
  if (Array.isArray(opts.categories) && opts.categories.length) return opts.categories.map(String);
  const out = [];
  for (const s of series) {
    for (const p of s.points) {
      const v = String(p.x);
      if (!out.includes(v)) out.push(v);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
}

export function lineChart(container, opts = {}) {
  container.__chartOpts = opts;
  if (!container.__hidden) container.__hidden = new Set();

  const draw = () => paint(container, opts, container.__hidden);
  draw();

  // 容器宽度变化时重绘（只关心宽度，避免和自身高度变化互相触发）
  if (!container.__ro && typeof ResizeObserver !== "undefined") {
    container.__ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (Math.abs(w - (container.__lastWidth || 0)) < 8) return;
      if (container.__chartOpts) paint(container, container.__chartOpts, container.__hidden);
    });
    container.__ro.observe(container);
  }
}

function paint(container, opts, hidden) {
  const series = (opts.series || []).filter((s) => s.points && s.points.length);
  container.textContent = "";
  container.classList.add("chart");
  container.__lastWidth = container.clientWidth;

  if (!series.length) {
    const div = document.createElement("div");
    div.className = "chart-empty";
    div.textContent = opts.emptyText || "没有可绘制的数据";
    container.append(div);
    return;
  }

  const cats = opts.xMode === "category" ? buildCategories(series, opts) : null;
  const xIndex = (x) => { const i = cats.indexOf(String(x)); return i < 0 ? 0 : i; };
  const xv = (x) => (cats ? xIndex(x) : toMs(x));

  const W = Math.max(320, Math.round(container.clientWidth || 720));
  const H = opts.height || (W < 480 ? 240 : 300);
  const PAD = { t: 16, r: 16, b: 34, l: 52 };

  const flat = series.flatMap((s) => s.points);
  let xMin, xMax;
  if (cats) {
    xMin = 0;
    xMax = Math.max(1, cats.length - 1);
  } else {
    xMin = Math.min(...flat.map((p) => toMs(p.x)));
    xMax = Math.max(...flat.map((p) => toMs(p.x)));
    const MIN_SPAN = 864e5 * 300; // 数据点过少时铺开约 10 个月，避免刻度挤在一起
    if (xMax - xMin < MIN_SPAN) {
      const c = (xMin + xMax) / 2;
      xMin = c - MIN_SPAN / 2;
      xMax = c + MIN_SPAN / 2;
    }
  }
  // x 轴范围可以由调用方指定（例：その選手の在学期間をまるごと見せる）
  if (cats) {
    if (opts.categories && opts.categories.length) { /* そのまま */ }
  } else {
    if (opts.xMin != null) xMin = toMs(opts.xMin);
    if (opts.xMax != null) xMax = toMs(opts.xMax);
    if (!(xMax > xMin)) xMax = xMin + 864e5;
  }
  let yMin = Math.min(...flat.map((p) => p.y));
  let yMax = Math.max(...flat.map((p) => p.y));
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.12;
  yMin -= yPad; yMax += yPad;
  if (opts.yMin != null) yMin = opts.yMin;
  if (opts.yMax != null) yMax = opts.yMax;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const sx = cats
    ? (x) => PAD.l + (cats.length === 1 ? innerW / 2 : (xIndex(x) / (cats.length - 1)) * innerW)
    : (x) => PAD.l + ((toMs(x) - xMin) / (xMax - xMin)) * innerW;
  const sy = (y) => {
    const t = (y - yMin) / (yMax - yMin);
    return PAD.t + (opts.invertY ? t : 1 - t) * innerH;
  };

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("role", "img");

  const add = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };

  // y 轴网格 + 刻度
  for (const t of niceTicks(yMin, yMax, 5)) {
    const y = sy(t);
    add("line", { class: "grid-line", x1: PAD.l, x2: W - PAD.r, y1: y, y2: y });
    add("text", { class: "axis-text", x: PAD.l - 8, y: y + 3, "text-anchor": "end" })
      .textContent = opts.formatY ? opts.formatY(t) : fmtTick(t);
  }
  // x 轴刻度
  if (cats) {
    // 类别太多时隔一个画一个，避免文字重叠
    const every = cats.length > (W < 560 ? 6 : 11) ? 2 : 1;
    cats.forEach((c, i) => {
      if (i % every) return;
      add("text", { class: "axis-text", x: sx(c), y: H - PAD.b + 16, "text-anchor": "middle" })
        .textContent = opts.formatX ? opts.formatX(c) : c;
    });
  } else {
    const tickCount = W < 480 ? 3 : W < 700 ? 4 : 5;
    for (const t of dateTicks(xMin, xMax, tickCount)) {
      add("text", { class: "axis-text", x: sx(t), y: H - PAD.b + 16, "text-anchor": "middle" })
        .textContent = fmtMonth(t);
    }
  }
  add("line", { class: "grid-line", x1: PAD.l, x2: W - PAD.r, y1: H - PAD.b, y2: H - PAD.b });

  // 数据线
  const layers = new Map();
  series.forEach((s, i) => {
    s.color = s.color || PALETTE[i % PALETTE.length];
    const g = add("g", { "data-series": i });
    layers.set(s.name, g);
    if (hidden.has(s.name)) g.style.display = "none";
    const pts = s.points.slice().sort((a, b) => xv(a.x) - xv(b.x));
    let d = "";
    pts.forEach((p, j) => {
      const x = sx(p.x), y = sy(p.y);
      if (j === 0) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      else if (opts.step) d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
      else d += `L${x.toFixed(1)},${y.toFixed(1)}`;
    });
    add("path", { class: "series-line", d, stroke: s.color, "stroke-dasharray": s.dashed ? "5 4" : "none" }, g);
    if (pts.length === 1) {
      add("circle", { cx: sx(pts[0].x), cy: sy(pts[0].y), r: 3.5, fill: s.color }, g);
    }
    const last = pts[pts.length - 1];
    add("circle", { cx: sx(last.x), cy: sy(last.y), r: 3.5, fill: s.color, stroke: "#fff", "stroke-width": 1.5 }, g);
    s._pts = pts;
  });

  // 悬停层
  const hoverLine = add("line", { class: "hover-line", y1: PAD.t, y2: H - PAD.b, x1: -999, x2: -999 });
  const dots = series.map((s, i) =>
    add("circle", { r: 4, fill: s.color, stroke: "#fff", "stroke-width": 1.5, opacity: 0, "data-dot": i }));

  const tip = document.createElement("div");
  tip.className = "tip";
  tip.style.display = "none";

  const overlay = add("rect", { x: PAD.l, y: PAD.t, width: innerW, height: innerH, fill: "transparent" });

  const onMove = (ev) => {
    const rect = svg.getBoundingClientRect();
    const ratio = rect.width ? W / rect.width : 1;
    const mx = (ev.clientX - rect.left) * ratio;
    let best = null;
    for (const s of series) {
      if (hidden.has(s.name)) continue;
      for (const p of s._pts) {
        const dx = Math.abs(sx(p.x) - mx);
        if (!best || dx < best.dx) best = { dx, p, s };
      }
    }
    if (!best) return;
    const px = sx(best.p.x), py = sy(best.p.y);
    hoverLine.setAttribute("x1", px); hoverLine.setAttribute("x2", px);
    series.forEach((s, i) => {
      const dot = dots[i];
      if (hidden.has(s.name)) { dot.setAttribute("opacity", 0); return; }
      const p = s._pts.reduce((a, b) =>
        (Math.abs(xv(b.x) - xv(best.p.x)) < Math.abs(xv(a.x) - xv(best.p.x)) ? b : a));
      dot.setAttribute("cx", sx(p.x)); dot.setAttribute("cy", sy(p.y));
      dot.setAttribute("opacity", 1);
    });
    tip.innerHTML = opts.tooltip ? opts.tooltip(best.p, best.s, series, hidden)
      : `<div>${fmtDate(best.p.x)}</div><div><b>${fmtTick(best.p.y)}</b></div>`;
    tip.style.display = "";
    const scale = rect.width ? rect.width / W : 1;
    tip.style.left = Math.min(Math.max(px * scale, 80), rect.width - 80) + "px";
    tip.style.top = (py * scale) + "px";
  };
  const onLeave = () => {
    tip.style.display = "none";
    hoverLine.setAttribute("x1", -999); hoverLine.setAttribute("x2", -999);
    dots.forEach((d) => d.setAttribute("opacity", 0));
  };
  overlay.addEventListener("pointermove", onMove);
  overlay.addEventListener("pointerleave", onLeave);

  container.append(svg, tip);

  // 图例（可点击隐藏/显示）
  if (series.length > 1 || opts.legend !== false) {
    const legend = document.createElement("div");
    legend.className = "legend" + (opts.maxLegend && series.length > opts.maxLegend ? " scroll" : "");
    for (const s of series) {
      const item = document.createElement("span");
      item.className = "item" + (hidden.has(s.name) ? " off" : "");
      item.innerHTML = `<span class="swatch" style="background:${s.color}"></span>${escapeHTML(s.name)}`;
      item.addEventListener("click", () => {
        if (hidden.has(s.name)) hidden.delete(s.name); else hidden.add(s.name);
        paint(container, opts, hidden);
      });
      legend.append(item);
    }
    container.append(legend);
  }
}

function niceTicks(min, max, count) {
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * step);
  const chosen = candidates.find((c) => span / c <= count * 1.6) || candidates[candidates.length - 1];
  const out = [];
  for (let v = Math.ceil(min / chosen) * chosen; v <= max + 1e-9; v += chosen) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
}

function dateTicks(minMs, maxMs, count) {
  const out = [];
  for (let i = 0; i <= count; i++) out.push(minMs + ((maxMs - minMs) * i) / count);
  return out;
}

function fmtTick(v) {
  if (Math.abs(v) >= 3600) {
    const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  if (Math.abs(v) >= 60) {
    const m = Math.floor(v / 60), s = Math.round(v % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return String(Math.round(v));
}

function fmtMonth(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
}

function fmtDate(x) {
  const d = new Date(toMs(x));
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export { PALETTE };
