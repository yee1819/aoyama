import { scoreText } from "./store.js";

export const PB_GRADES = ["高校", "1年", "2年", "3年", "4年"];

const ITEMS_BY_SEX = {
  "男": ["five_5000m", "ten_10000m", "half_marathon"],
  "女": ["fifteen_1500m", "three_3000m", "five_5000m", "ten_10000m", "half_marathon"],
};

export function pbItemsForSex(sex) {
  return ITEMS_BY_SEX[sex] || ITEMS_BY_SEX["男"];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

export function pbMatrixRows(store, student) {
  const yearBests = store.yearBests(student.id, { include: "all" });
  return pbItemsForSex(student.sex || "男").map((item) => {
    const cells = yearBests.get(item) || {};
    const best = Object.values(cells).reduce(
      (current, record) => (!current || record.seconds < current.seconds ? record : current),
      null,
    );
    return {
      item,
      label: item === "half_marathon" ? "ハーフ" : store.itemLabel(item),
      cells,
      best,
    };
  });
}

export function pbMatrixHtml(store, student) {
  const rows = pbMatrixRows(store, student);
  const cellHtml = (record, best) => {
    if (!record) return `<span class="pb-matrix-empty">—</span>`;
    const timeClass = `time${record.id === best?.id ? " pb-cell" : ""}`;
    const value = `<span class="${timeClass}">${scoreText(record)}</span>`;
    if (!record.competitionId) return value;
    return `<a href="race.html?type=competition&id=${record.competitionId}"
      title="${escapeHtml(record.competitionName || "大会詳細へ")}">${value}</a>`;
  };
  return `<div class="table-wrap pb-matrix-wrap">
    <table class="data compact pb-matrix">
      <thead><tr><th>種目</th>${PB_GRADES.map((grade) => `<th class="num">${grade}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <th scope="row">${escapeHtml(row.label)}</th>
        ${PB_GRADES.map((_, grade) => `<td class="num">${cellHtml(row.cells[grade], row.best)}</td>`).join("")}
      </tr>`).join("")}</tbody>
    </table>
  </div>`;
}
