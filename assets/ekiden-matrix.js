/**
 * 「三大駅伝（箱根・全日本・出雲）にどの学年でどの区間を走ったか」を
 * 学年 × 大会 のマトリクスにする共通処理。出場者ページと選手ページで使う。
 */
import { academicYear, scoreText } from "./store.js";
import { esc } from "./ui.js";

export const MAJOR_RELAYS = [
  { key: "出雲", match: /出雲.*駅伝/ },
  { key: "全日本", match: /全日本大学駅伝/ },
  { key: "箱根", match: /箱根駅伝/ },
];

/** その記録のときの学年。留年して5年目もあり得るので 1〜6 を許容する */
export function gradeOfStudent(record, student) {
  const en = Number(student && student.enrollmentYear);
  const ay = academicYear(record.date);
  if (!en || !ay) return null;
  const g = ay - en + 1;
  return g >= 1 && g <= 6 ? g : null;
}

/** 三大駅伝の記録だけ集める */
export function majorRecords(store, studentId) {
  const itemIds = new Map();
  for (const r of MAJOR_RELAYS) {
    const item = store.ekidenItems.find((i) => r.match.test(i.name));
    if (item) itemIds.set(item.id, r.key);
  }
  const student = store.student(studentId);
  if (!student) return [];
  const out = [];
  for (const rec of store.ekidenRecordsByStudent.get(Number(studentId)) || []) {
    const round = store.ekidenRoundById.get(rec.ekidenRoundId);
    if (!round) continue;
    const relay = itemIds.get(round.ekidenItemId);
    if (!relay) continue;
    const grade = gradeOfStudent(rec, student);
    if (!grade) continue;
    out.push({ rec, round, relay, grade });
  }
  return out.sort((a, b) => a.grade - b.grade || a.relay.localeCompare(b.relay, "ja"));
}

/** 1マス分 */
function cellHtml(entry) {
  if (!entry) return `<td class="ek-cell empty"></td>`;
  const { rec } = entry;
  const rank = rec.rank ?? null;
  const rankCls = rank === 1 ? " r1" : rank === 2 ? " r2" : rank === 3 ? " r3" : "";
  const isRecord = /区間新/.test(rec.remark || "");
  const pos = `${rec.interval}区${rank ? `${rank}位` : ""}`;
  return `<td class="ek-cell${rankCls}${isRecord ? " rec" : ""}">`
    + `<span class="ek-pos">${esc(pos)}</span>`
    + `<span class="ek-time">${esc(scoreText(rec))}</span></td>`;
}

/**
 * マトリクスの HTML。三大駅伝の出場がなければ null。
 * 区間1〜3位に色、区間新記録は赤字。
 */
export function ekidenMatrixHtml(store, studentId) {
  const list = majorRecords(store, studentId);
  if (!list.length) return null;
  const cells = new Map();
  for (const x of list) cells.set(`${x.grade}|${x.relay}`, x);
  const maxGrade = Math.max(4, ...list.map((x) => x.grade));
  const grades = [];
  for (let g = 1; g <= maxGrade; g++) grades.push(g);
  return `<table class="ek-matrix">
    <thead><tr><th></th>${MAJOR_RELAYS.map((r) => `<th>${r.key}</th>`).join("")}</tr></thead>
    <tbody>${grades.map((g) => `<tr><th>${g}年</th>`
      + MAJOR_RELAYS.map((r) => cellHtml(cells.get(`${g}|${r.key}`))).join("")
      + `</tr>`).join("")}</tbody>
  </table>`;
}
