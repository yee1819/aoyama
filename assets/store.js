/**
 * 数据层：加载静态 JSON，提供「时点查询」等派生计算。
 * 全部在浏览器端完成，服务端零计算。
 */

const DATA_DIR = "data/";
// 分片目录：文件名带内容 hash，历史部分可以被浏览器永久缓存
const STATIC_DIR = "data/static/";

export const ITEM_LABELS = {
  fifteen_1500m: "1500m",
  three_3000m: "3000m",
  five_5000m: "5000m",
  ten_10000m: "10000m",
  half_marathon: "ハーフマラソン",
  marathon: "マラソン",
  three_3000sc: "3000mSC",
  eight_800m: "800m",
  one_mile: "1マイル",
  two_mile: "2マイル",
  ten_mile: "10マイル",
  cross_country: "クロスカントリー",
  five_km: "ロード5km",
  ten_km: "ロード10km",
  twenty_km: "ロード20km",
  eight_km: "8km",
  fifteen_km: "15km",
  twenty_three_five_km: "23.5km",
  thirty_km: "30km",
};

/** 项目按距离排序，用于下拉框顺序 */
export const ITEM_ORDER = [
  "eight_800m", "fifteen_1500m", "one_mile", "three_3000m", "three_3000sc",
  "five_5000m", "five_km", "ten_10000m", "ten_km", "fifteen_km",
  "twenty_km", "twenty_three_five_km", "half_marathon", "thirty_km", "marathon", "two_mile", "eight_km",
  "ten_mile", "cross_country",
];

export const STATUS_LABELS = { player: "選手", withdraw: "退部", staff: "スタッフ" };
export const POSITION_LABELS = { main: "主将", sub_main: "副主将", leader: "寮長", none: "" };

/** "13:45.67" / "1:02:33" / "28:45" -> 秒 */
export function parseScore(raw) {
  if (raw == null) return null;
  const s = String(raw).trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[:：]+$/, ""); // 原始数据里偶尔带多余的冒号（"1:08:04:"）
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] != null ? Number(m[3]) : null;
  const frac = m[4] != null ? Number("0." + m[4]) : 0;
  // 三段 = h:mm:ss；两段 = mm:ss
  return (c != null ? a * 3600 + b * 60 + c : a * 60 + b) + frac;
}

/** 秒 -> "13:45.67" / "1:02:33.4" */
export function formatScore(sec, withFraction = true) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const rest = sec - h * 3600;
  const m = Math.floor(rest / 60);
  const s = rest - m * 60;
  const ss = Math.floor(s);
  const cs = Math.round((s - ss) * 100);
  // withFraction のときは .00 も省略しない（元が 28:11.00 なら 28:11.00 と出す）
  const frac = withFraction ? "." + String(cs).padStart(2, "0") : "";
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? h + ":" : "") + mm + ":" + String(ss).padStart(2, "0") + frac;
}

/**
 * 記録1件の表示用テキスト。
 * 元の書き方（"28:11.00" / "1:02:33"）に合わせて小数の有無を決めるので、
 * "28:11.00" が "28:11" に化けたりしない。
 */
export function scoreText(rec) {
  if (!rec) return "—";
  const raw = rec.score;
  if (raw == null) return rec.seconds == null ? "—" : formatScore(rec.seconds, false);
  const hasFraction = /\.\d{1,3}\s*$/.test(String(raw));
  return formatScore(rec.seconds, hasFraction);
}

/** 秒差 -> "+12.34" */
export function formatDiff(sec) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  return (sec > 0 ? "+" : sec < 0 ? "−" : "±") + Math.abs(sec).toFixed(2);
}

export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[年月]/g, "-").replace(/日/g, "").replace(/[./]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!m) return null;
  const y = m[1], mo = m[2].padStart(2, "0"), d = (m[3] || "1").padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function toYear(dateStr) {
  return dateStr ? Number(String(dateStr).slice(0, 4)) : null;
}

/** 日本学年度：4月〜翌年3月。2022-03-15 -> 2021 */
export function academicYear(dateStr) {
  if (!dateStr) return null;
  const y = Number(String(dateStr).slice(0, 4));
  const m = Number(String(dateStr).slice(5, 7));
  if (!y || !m) return null;
  return m >= 4 ? y : y - 1;
}

/** 今天的学年度（2026-10-05 → 2026，即 2026年度 = 2026/4/1〜2027/3/31） */
export function currentAcademicYear(now = new Date()) {
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 4 ? y : y - 1;
}

/**
 * 某选手在某个日期是几年级（1~4）。
 * 学年度基准：2024 入学的话，2026 年度（4/1〜翌3/31）＝ 3年。
 * 范围外（入学前 / 4年を超えた後）は null。
 */
export function gradeAtDate(student, date) {
  const y = academicYear(date);
  const en = toYear(student && student.enrollmentYear);
  if (!y || !en) return null;
  const g = y - en + 1;
  return g >= 1 && g <= 4 ? g : null;
}

/** 某个学年度的起止日期 */
export function seasonRange(ay) {
  return { from: `${ay}-04-01`, to: `${ay + 1}-03-31`, label: `${ay}年度`, year: ay };
}

/** 本赛季（4/1〜翌年3/31） */
export function currentSeason(now = new Date()) {
  return seasonRange(currentAcademicYear(now));
}

const yearOf = toYear;

/** 成绩包含口径 */
export const INCLUDE_MODES = {
  all: "全部成績",
  enrolled: "在学中のみ",
  pb: "自己ベスト",
};

/** 这条记录算不算「在学中跑出的」（高校时代的成绩不算） */
function isEnrolledRecord(r, student) {
  if (!student) return true;
  if (r.remark === "高校時代" || r.competitionName === "高校時代") return false;
  const en = yearOf(student.enrollmentYear);
  if (!en || !r.date) return true;
  return r.date >= `${en}-04-01`;
}

/**
 * 这条记录是不是「高校時代」的成绩。
 * 判据（任一成立）：
 *   1. 导入时打的标记 remark / competition_name = "高校時代"（没有确切日期的年度最好成绩）
 *   2. 日期早于入学（入学年 4/1 之前）—— 有确切比赛日期的那些
 */
export function isHighSchoolRecord(r, student) {
  if (!r) return false;
  if (r.remark === "高校時代" || r.competitionName === "高校時代") return true;
  if (!student) return false;
  const en = yearOf(student.enrollmentYear);
  if (!en || !r.date) return false;
  return r.date < `${en}-04-01`;
}

/** 每个项目只留最好的一条 */
function onlyPersonalBests(list) {
  const best = new Map();
  for (const r of list) {
    if (r.isFinished === false || r.seconds == null) continue;
    const cur = best.get(r.item);
    if (!cur || r.seconds < cur.seconds) best.set(r.item, r);
  }
  return [...best.values()];
}

async function getJSON(path, { cache = "default" } = {}) {
  const res = await fetch(path, { cache });
  if (!res.ok) throw new Error(`加载 ${path} 失败 (${res.status})`);
  return res.json();
}

export class Store {
  constructor(raw) {
    this.meta = raw.meta || {};
    this.students = raw.students || [];
    this.schools = raw.schools || [];
    this.staff = raw.staff || [];
    this.competitions = raw.competitions || [];
    this.records = raw.records || [];
    this.ekidenItems = raw.ekidenItems || [];
    this.ekidenRounds = raw.ekidenRounds || [];
    this.ekidenRecords = raw.ekidenRecords || [];
    this.teams = raw.teams || [];

    this.studentById = new Map(this.students.map((s) => [s.id, s]));
    this.schoolById = new Map(this.schools.map((s) => [s.id, s]));
    this.competitionById = new Map(this.competitions.map((c) => [c.id, c]));
    this.ekidenRoundById = new Map(this.ekidenRounds.map((r) => [r.id, r]));
    this.ekidenItemById = new Map(this.ekidenItems.map((i) => [i.id, i]));
    this.teamById = new Map(this.teams.map((t) => [t.id, t]));

    this.recordsByStudent = groupBy(this.records, (r) => r.studentId);
    this.ekidenRecordsByStudent = groupBy(this.ekidenRecords, (r) => r.studentId);
    this.ekidenRecordsByRound = groupBy(this.ekidenRecords, (r) => r.ekidenRoundId);
    this.recordsByCompetition = groupBy(this.records, (r) => r.competitionId);
    for (const list of this.recordsByStudent.values()) sortByDate(list);
    for (const list of this.ekidenRecordsByStudent.values()) {
      list.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.interval - b.interval);
    }
    for (const list of this.ekidenRecordsByRound.values()) {
      list.sort((a, b) => a.interval - b.interval || (a.teamRank ?? 999) - (b.teamRank ?? 999));
    }
    this.competitionsSorted = [...this.competitions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    this.ekidenRoundsSorted = [...this.ekidenRounds].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    this.rosterSpan = computeSpan(this.students);
  }

  get generatedAt() { return this.meta.generatedAt || null; }

  student(id) { return this.studentById.get(Number(id)) || null; }

  schoolName(id) {
    const s = this.schoolById.get(id);
    return s ? s.name : null;
  }

  /** 種目名（item = null は「距離種目ではないレース」＝種目なし） */
  itemLabel(key) {
    if (key == null) return "種目なし";
    return ITEM_LABELS[key] || key;
  }

  /** team id → 队名（没有就返回 null） */
  teamName(id) {
    const t = this.teamById.get(id);
    return t ? t.name : null;
  }

  /** 按「成绩包含」口径取某选手的记录 */
  recordsOf(studentId, { include = "all" } = {}) {
    const s = this.student(studentId);
    let list = this.recordsByStudent.get(Number(studentId)) || [];
    if (include === "enrolled") list = list.filter((r) => isEnrolledRecord(r, s));
    else if (include === "pb") list = onlyPersonalBests(list);
    return list;
  }

  /**
   * 逐学年的最好成绩：item -> { 0: 高校, 1: 1年, 2: 2年, 3: 3年, 4: 4年 }
   * 0 表示入学前（高校時代）。
   */
  yearBests(studentId, { include = "all" } = {}) {
    const s = this.student(studentId);
    const en = yearOf(s && s.enrollmentYear);
    const out = new Map();
    for (const r of this.recordsOf(studentId, { include })) {
      if (r.isFinished === false || r.seconds == null) continue;
      let grade = 0;
      if (isEnrolledRecord(r, s)) {
        const ay = academicYear(r.date);
        if (ay && en) {
          grade = ay - en + 1;
          if (grade < 1 || grade > 4) continue; // 5年目以降は表示対象外
        } else grade = 1;
      }
      const row = out.get(r.item) || {};
      if (!row[grade] || r.seconds < row[grade].seconds) row[grade] = r;
      out.set(r.item, row);
    }
    return out;
  }

  /** 某性别的选手（sex: "男" | "女"） */
  studentsBySex(sex) {
    return this.students.filter((s) => (s.sex || "男") === sex);
  }

  /** 某个选手在某项目、某日期之前的最好成绩 */
  pbAsOf(studentId, item, asOf, { include = "all" } = {}) {
    const list = this.recordsOf(studentId, { include });
    let best = null;
    for (const r of list) {
      if (r.item !== item || r.isFinished === false || r.seconds == null) continue;
      if (asOf && (!r.date || r.date > asOf)) continue;
      if (!best || r.seconds < best.seconds) best = r;
    }
    return best;
  }

  /** 某选手 PB 演进（仅记录每次刷新的时刻） */
  pbHistory(studentId, item, asOf, { include = "all" } = {}) {
    const list = this.recordsOf(studentId, { include })
      .filter((r) => r.item === item && r.isFinished !== false && r.seconds != null)
      .filter((r) => !asOf || (r.date && r.date <= asOf))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.seconds - b.seconds);
    const out = [];
    let best = Infinity;
    let lastDate = null;
    for (const r of list) {
      if (r.seconds < best) {
        best = r.seconds;
        lastDate = r.date;
        out.push(r);
      } else if (r.date === lastDate && out.length && r.seconds === out[out.length - 1].seconds) {
        /* 同一天同成绩，忽略 */
      }
    }
    return out;
  }

  /**
   * 该选手「退部」（不再是选手）的日期。
   *   1. 明确知道的大二大三退部・转经理 → student.leftDate
   *   2. 正常毕业的 → 卒業年（这里是毕业年度的 4/1，＝毕业年度起就不在籍）
   *   3. 还在读、又没有 leftDate 的 → null（＝现在仍在籍，将来的数据照常计算）
   */
  leaveDate(student) {
    if (!student) return null;
    if (student.leftDate) return String(student.leftDate);
    const gr = yearOf(student.graduationYear);
    if (gr) return `${gr}-04-01`;
    const en = yearOf(student.enrollmentYear);
    return en ? `${en + 4}-04-01` : null;
  }

  /**
   * 该选手在 date 这个时点还在不在部里。
   * 入学（入学年 4/1）以前不算；退部日当天起不算。
   * includeWithdraw/ignoreLeaving = true 时只按入学〜毕业判断，退部・转经理的人也算「在籍部員」。
   */
  isMemberAt(student, date, { ignoreLeaving = false } = {}) {
    if (!student || !date) return false;
    const en = yearOf(student.enrollmentYear);
    if (!en) return false;
    if (String(date) < `${en}-04-01`) return false;
    if (ignoreLeaving) {
      const gr = yearOf(student.graduationYear) || en + 4;
      return String(date) < `${gr}-04-01`;
    }
    const left = this.leaveDate(student);
    return left ? String(date) < left : true;
  }

  /**
   * 该选手在 date 时点是不是「在籍选手」。
   * 退部・转经理的人虽然现在状态不是 player，但在退部日之前仍然是选手，
   * 所以「2025年10月时点的排名」里他们照样会出现。
   */
  isPlayerAt(student, date) {
    if (!this.isMemberAt(student, date)) return false;
    if ((student.status || "player") === "player") return true;
    return !!student.leftDate && String(date) < String(student.leftDate);
  }

  /** 某时点在籍的部员 */
  rosterAsOf(date, { includeWithdraw = false, sex = null } = {}) {
    const list = sex ? this.studentsBySex(sex) : this.students;
    if (!academicYear(date)) return list.slice();
    // includeWithdraw = true 时只看「在籍期间」，退部・转经理的人也算进来
    return list.filter((s) => (includeWithdraw
      ? this.isMemberAt(s, date, { ignoreLeaving: true })
      : this.isPlayerAt(s, date)));
  }

  /** 该选手在 date 时的学年（1~4，超出范围返回 null） */
  gradeAt(student, date) {
    return gradeAtDate(student, date);
  }

  /**
   * 「这条记录当时是几年级」。
   * 学年度基准（4/1〜翌3/31）：2024 入学的话，2026 年度就是 3年。
   * 高校時代の記録は 0（＝高校）を返す。
   */
  gradeOfRecord(record, student) {
    if (!record) return null;
    if (isHighSchoolRecord(record, student)) return 0;
    return this.gradeAt(student, record.date);
  }

  /**
   * 时点排名：某日期、某项目的队内 PB 排行。
   * @returns {Array<{student, seconds, record, grade, rank, rankAtPb, pbDate, isNew}>}
   */
  rankingAsOf(date, item, { scope = "active", asOf = null, limit = null, include = "all", sex = null } = {}) {
    const ref = asOf || date;
    const pool = scope === "all"
      ? (sex ? this.studentsBySex(sex) : this.students)
      : this.rosterAsOf(date, { sex, includeWithdraw: scope === "member" });
    const rows = [];
    for (const s of pool) {
      const rec = this.pbAsOf(s.id, item, ref, { include });
      if (!rec) continue;
      rows.push({
        student: s,
        seconds: rec.seconds,
        record: rec,
        pbDate: rec.date,
        grade: this.gradeAt(s, date),
      });
    }
    rows.sort((a, b) => a.seconds - b.seconds || (a.pbDate || "").localeCompare(b.pbDate || ""));
    rows.forEach((r, i) => { r.rank = i + 1; });

    // 每个成绩创造当日的队内顺位（用于展示「刷新时第几位 → 现在第几位」）
    if (rows.length && rows.length <= 400) {
      const cache = new Map();
      for (const r of rows) {
        const key = r.pbDate;
        if (!cache.has(key)) {
          const snap = new Map();
          for (const s of pool) {
            const rec = this.pbAsOf(s.id, item, key, { include });
            if (rec) snap.set(s.id, rec.seconds);
          }
          const ordered = [...snap.entries()].sort((a, b) => a[1] - b[1]);
          const ranks = new Map();
          ordered.forEach(([sid], i) => ranks.set(sid, i + 1));
          cache.set(key, ranks);
        }
        r.rankAtPb = cache.get(key).get(r.student.id) ?? null;
      }
    }
    return limit ? rows.slice(0, limit) : rows;
  }

  /** 某个项目的历代 / 现役纪录榜（不限制日期） */
  allTimeRanking(item, { scope = "all", limit = null } = {}) {
    return this.rankingAsOf("9999-12-31", item, { scope, limit });
  }

  /** 某选手在某日期、某项目下的队内顺位（无成绩返回 null） */
  rankOf(studentId, item, date, scope = "active", include = "all", sex = null) {
    const pool = scope === "all"
      ? (sex ? this.studentsBySex(sex) : this.students)
      : this.rosterAsOf(date, { sex, includeWithdraw: scope === "member" });
    const target = this.pbAsOf(studentId, item, date, { include });
    if (!target) return null;
    let rank = 1;
    for (const s of pool) {
      if (s.id === Number(studentId)) continue;
      const rec = this.pbAsOf(s.id, item, date, { include });
      if (rec && (rec.seconds < target.seconds ||
          (rec.seconds === target.seconds && (rec.date || "") < (target.date || "")))) rank++;
    }
    return rank;
  }

  /** 该选手参加过的所有比赛记录（按日期倒序） */
  history(studentId, { include = "all" } = {}) {
    return this.recordsOf(studentId, { include })
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  ekidenHistory(studentId) {
    return (this.ekidenRecordsByStudent.get(Number(studentId)) || []).slice().reverse();
  }

  /** 选手所有项目的 PB 一览 */
  personalBests(studentId, asOf = null, { include = "all" } = {}) {
    const list = this.recordsOf(studentId, { include });
    const map = new Map();
    for (const r of list) {
      if (r.isFinished === false || r.seconds == null) continue;
      if (asOf && (!r.date || r.date > asOf)) continue;
      const cur = map.get(r.item);
      if (!cur || r.seconds < cur.seconds) map.set(r.item, r);
    }
    return ITEM_ORDER.filter((k) => map.has(k)).map((k) => ({
      item: k, label: this.itemLabel(k), record: map.get(k), seconds: map.get(k).seconds,
    }));
  }

  /** 距离 / 数值递增的「PB 里程碑」时间轴（跨项目，按时间） */
  timeline(studentId) {
    return this.recordsOf(studentId)
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function sortByDate(list) {
  list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function computeSpan(students) {
  const years = students.map((s) => yearOf(s.enrollmentYear)).filter(Boolean);
  if (!years.length) return { min: null, max: null };
  return { min: Math.min(...years), max: Math.max(...years) + 4 };
}

/**
 * 读取数据。
 * 优先用 tools/split-data.mjs 生成的分片：
 *   index.json（每次都取，很小） + master/history/current（历史部分永久缓存）
 * 分片不存在时退回整份文件，保证任何时候都能跑。
 */
async function loadRaw() {
  try {
    const index = await getJSON(STATIC_DIR + "index.json", { cache: "no-store" });
    if (index && index.master) {
      const [master, history, current] = await Promise.all([
        getJSON(STATIC_DIR + index.master),
        getJSON(STATIC_DIR + index.history),
        getJSON(STATIC_DIR + index.current),
      ]);
      return {
        meta: { ...(master.meta || {}), generatedAt: index.generatedAt, version: index.version, counts: index.counts },
        students: arr(master.students), schools: arr(master.schools), staff: arr(master.staff),
        teams: arr(master.teams), competitions: arr(master.competitions),
        ekidenItems: arr(master.ekidenItems), ekidenRounds: arr(master.ekidenRounds),
        records: [...arr(history.records), ...arr(current.records)],
        ekidenRecords: [...arr(history.ekidenRecords), ...arr(current.ekidenRecords)],
      };
    }
  } catch { /* 还没生成分片，走下面的整份读取 */ }

  const names = ["meta", "students", "schools", "staff", "competitions", "records",
                 "ekiden-items", "ekiden-rounds", "ekiden-records", "teams"];
  const [meta, students, schools, staff, competitions, records, ekidenItems, ekidenRounds, ekidenRecords, teams] =
    await Promise.all(names.map((n) => getJSON(DATA_DIR + n + ".json", { cache: "no-cache" }).catch(() => ({}))));
  return {
    meta, students: arr(students), schools: arr(schools), staff: arr(staff),
    competitions: arr(competitions), records: arr(records),
    ekidenItems: arr(ekidenItems), ekidenRounds: arr(ekidenRounds),
    ekidenRecords: arr(ekidenRecords), teams: arr(teams),
  };
}

let _store = null;
export async function loadStore() {
  if (_store) return _store;
  _store = new Store(await loadRaw());
  // 防止把演示数据误当成真实数据：明确提示
  if (_store.meta && _store.meta.source === "demo") {
    const bar = document.createElement("div");
    bar.className = "demo-banner";
    bar.textContent = "現在はデモデータを表示しています（実在の選手・記録ではありません）。node tools/sync.mjs で実データに差し替えられます。";
    (document.querySelector("main") || document.body).prepend(bar);
  }
  return _store;
}

function arr(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  return [];
}
