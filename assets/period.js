/** 图表用的「期間」选择控件（全期間 / 直近N年 / 期間指定） */

export const PERIOD_OPTIONS = [
  ["all", "全期間"],
  ["1y", "直近1年"],
  ["2y", "直近2年"],
  ["3y", "直近3年"],
  ["5y", "直近5年"],
  ["custom", "期間指定"],
];

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** @returns {[string|null, string|null]} 闭区间 [起, 止] */
export function periodBounds({ mode, from, to } = {}) {
  if (!mode || mode === "all") return [null, null];
  if (mode === "custom") return [from || null, to || null];
  const years = Number(String(mode).replace("y", ""));
  if (!Number.isFinite(years)) return [null, null];
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  const p = (n) => String(n).padStart(2, "0");
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, todayISO()];
}

/**
 * 按期间裁剪点集。为了让阶梯／折线从正确的水平开始，
 * 会把区间起点之前的最后一个点也带上。
 */
export function filterPoints(points, range) {
  const [lo, hi] = periodBounds(range);
  if (!lo && !hi) return points;
  const sorted = points.slice().sort((a, b) => String(a.x).localeCompare(String(b.x)));
  const out = [];
  let baseline = null;
  for (const p of sorted) {
    const x = String(p.x);
    if (lo && x < lo) { baseline = p; continue; }
    if (hi && x > hi) break;
    if (!out.length && baseline) out.push({ ...baseline, baseline: true });
    out.push(p);
  }
  // 区间内没有更新，但之前有成绩 → 保留最后一点（表示这个水平一直保持到现在）
  if (!out.length && baseline) out.push(baseline);
  return out;
}

/**
 * 在 host 元素里渲染控件。
 * @param host 容器
 * @param onChange 变化回调，收到 {mode, from, to}
 * @param defaultMode 初始模式
 */
export function mountPeriod(host, onChange, { defaultMode = "all" } = {}) {
  host.classList.add("period-ctl");
  host.innerHTML = `
    <select class="pd-mode" title="表示期間">${PERIOD_OPTIONS.map(([v, l]) =>
      `<option value="${v}"${v === defaultMode ? " selected" : ""}>${l}</option>`).join("")}</select>
    <input type="date" class="pd-from" hidden>
    <span class="pd-sep" hidden>–</span>
    <input type="date" class="pd-to" hidden>`;
  const mode = host.querySelector(".pd-mode");
  const from = host.querySelector(".pd-from");
  const to = host.querySelector(".pd-to");
  const sep = host.querySelector(".pd-sep");
  const state = () => ({ mode: mode.value, from: from.value, to: to.value });
  const sync = () => {
    const custom = mode.value === "custom";
    for (const el of [from, to, sep]) el.hidden = !custom;
  };
  mode.addEventListener("change", () => { sync(); onChange(state()); });
  from.addEventListener("change", () => onChange(state()));
  to.addEventListener("change", () => onChange(state()));
  sync();
  return state();
}
