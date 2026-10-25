/** 公共 UI：站点头部/底部、格式化、表格构建 */
import { initI18n } from "./i18n.js";
import { isHighSchoolRecord, gradeAtDate } from "./store.js";

const NAV = [
  { href: "index.html", label: "概況" },
  { href: "rankings.html", label: "時点ランキング" },
  { href: "best.html", label: "自己ベスト" },
  { href: "players.html", label: "部員" },
  { href: "ekiden-interval.html", label: "三大駅伝" },
  { href: "records.html", label: "記録一覧" },
  { href: "about.html", label: "このサイトについて" },
];

export function mountLayout(active) {
  initI18n();
  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `<div class="inner">
      <a class="brand" href="index.html">
        <span class="mark">青</span>
        <span>青山学院大学 陸上競技部<span class="sub">&nbsp;データベース</span></span>
      </a>
      <nav class="main-nav">
        ${NAV.map((n) => `<a href="${n.href}" class="${n.href === active ? "active" : ""}">${n.label}</a>`).join("")}
      </nav>
    </div>`;
  }
  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `<div class="inner">
      <span>個人運営の非公式ファンサイトです。記録は公開情報をもとに作成しています。
        <a href="about.html">このサイトについて</a></span>
      <span>最終更新：<span data-generated-at>—</span></span>
    </div>`;
  }
}

export function setGeneratedAt(text) {
  document.querySelectorAll("[data-generated-at]").forEach((el) => { el.textContent = fmtDateTime(text); });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/**
 * 通用表格渲染：columns = [{key,label,cls,render(row,i),sortKey}]
 * 传 onSort 后，带 sortKey 的列头可点击排序；sortState = {key, dir}
 */
export function renderTable(container, columns, rows, { empty = "无数据", onSort = null, sortState = null } = {}) {
  container.textContent = "";
  if (!rows.length) {
    container.append(el("div", { class: "empty", text: empty }));
    return;
  }
  const headCells = columns.map((c) => {
    const th = el("th", { class: c.cls || "" });
    if (c.sortKey && onSort) {
      const active = sortState && sortState.key === c.sortKey;
      th.classList.add("sortable");
      if (active) th.classList.add("sorted");
      // 未排序时也显示上下标（浅色），排序后换成深色实心箭头
      const glyph = active ? (sortState.dir > 0 ? "▲" : "▼") : "⇅";
      th.innerHTML = esc(c.label) + `<span class="sort-ind">${glyph}</span>`;
      th.title = active
        ? (sortState.dir > 0 ? "クリックで降順" : "クリックで昇順")
        : "クリックで並べ替え";
      th.addEventListener("click", () => onSort(c.sortKey));
    } else {
      th.textContent = c.label;
    }
    return th;
  });
  const thead = el("thead", {}, [el("tr", {}, headCells)]);
  const tbody = el("tbody", {}, rows.map((row, i) =>
    el("tr", { class: [typeof row.__cls === "string" ? row.__cls : "", i < 3 ? "r" + (i + 1) : ""].filter(Boolean).join(" ") },
      columns.map((c) => {
        const cell = el("td", { class: c.cls || "" });
        const v = c.render ? c.render(row, i) : row[c.key];
        if (v instanceof Node) cell.append(v); else if (v != null) cell.innerHTML = String(v);
        return cell;
      }))));
  const table = el("table", { class: "data" }, [thead, tbody]);
  container.append(el("div", { class: "table-wrap" }, [table]));
}

export function avatarHTML(student, size = "") {
  const cls = "avatar" + (size ? " " + size : "");
  if (student && student.avatar) {
    return `<span class="${cls}"><img src="${esc(student.avatar)}" alt="${esc(student.name)}" loading="lazy"></span>`;
  }
  const initial = student && student.name ? student.name.slice(0, 1) : "?";
  return `<span class="${cls}">${esc(initial)}</span>`;
}

export function studentLink(s, text) {
  return `<a href="player.html?id=${s.id}">${esc(text ?? s.name)}</a>`;
}

/**
 * 日付。第2引数を省略したときは「月だけ分かっている記録」（＝その月の1日を仮の日付に
 * している自己ベスト）だけ日を省く。大会に紐づく記録は実日付なので必ず出す。
 */
export function fmtDate(d, withDay = null) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  const show = withDay == null ? !!(day && day !== "01") : withDay;
  return `${y}/${m}${show && day ? "/" + day : ""}`;
}

export function fmtDateFull(d) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  return `${y}年${Number(m)}月${Number(day || 1)}日`;
}

/**
 * 「樹立日」单元格：
 * 高校時代的成绩不写编造的年终日期，直接显示「高校」（有真实比赛日期时放在 title 里）。
 * 其余的后面带上「当时的年级」——学年度基准，2024 入学的话 2026 年度就是 3年。
 */
export function fmtDateCell(record, student) {
  if (isHighSchoolRecord(record, student)) {
    const real = record.competitionName === "高校時代" || record.remark === "高校時代"
      ? null : record.date;
    return `<span class="badge" title="${real ? esc(real) : "高校時代"}">高校</span>`;
  }
  const g = gradeAtDate(student, record.date);
  const day = String(record.date || "").slice(8, 10);
  // 大会の記録は「6月1日」のような実日付なので、日を省かない
  const exact = record.competitionId != null || (!!day && day !== "01");
  return fmtDate(record.date, exact)
    + (g ? `<span class="grade-note">（${g}年）</span>` : "");
}

export function gradeLabel(g) {
  if (g === 0) return "高校";
  if (!g) return "—";
  return ["", "1年", "2年", "3年", "4年", "5年", "6年"][g] || g + "年";
}

/**
 * 備考バッジ。PB / SB / 区間賞 / 区間新 …は意味が違うので、1つずつ別バッジ・別色で出す。
 *   PB   = 自己ベスト更新（赤）
 *   SB   = シーズンベスト（青）
 *   区間賞 = その区間の1位（緑）
 *   区間新・大会新 = 記録更新（金）
 *   DNF / DNS = 未完走（グレー）
 */
const REMARK_STYLES = [
  [/DNF|DNS|棄権|欠場|不出場|未出走/, "dim"],
  [/^PB$|自己ベスト|ベスト更新/i, "pb"],
  [/^SB$|シーズンベスト/i, "sb"],
  [/区間新|区間記録|大会新|優勝/, "gold"],
  [/区間賞/, "green"],
];
export function remarkBadge(remark) {
  if (!remark) return "";
  const flags = String(remark).split(/[\s,、／/]+/).filter(Boolean);
  if (!flags.length) return "";
  const out = [];
  const rest = [];
  for (const f of flags) {
    const hit = REMARK_STYLES.find(([re]) => re.test(f));
    if (hit) out.push(`<span class="badge ${hit[1]}">${esc(f)}</span>`);
    else rest.push(f);
  }
  // 意味の分かる印だけ個別に。残り（「チーム総合 1位 1:00:35」など）はそのまま1つに
  if (rest.length) out.push(`<span class="badge">${esc(rest.join(" "))}</span>`);
  return out.join(" ");
}

export function medalClass(rank) {
  return rank === 1 ? "rank gold" : rank === 2 ? "rank silver" : rank === 3 ? "rank bronze" : "rank";
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

export function escapeHTML(s) { return esc(s); }

/**
 * 给搜索框挂上候选词（浏览器原生 datalist）：
 * 输入一个字就会弹出可选条目，点一下直接填入。
 */
export function attachSuggestions(input, values, { limit = 800 } = {}) {
  if (!input) return;
  const id = (input.id || "input") + "-suggest";
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = id;
    input.after(dl);
    input.setAttribute("list", id);
    input.setAttribute("autocomplete", "off");
  }
  const uniq = [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
  dl.innerHTML = uniq.slice(0, limit).map((v) => `<option value="${esc(v)}"></option>`).join("");
}
