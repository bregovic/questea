// Logika opakování úkolů. Pravidlo na Tasku:
//   recurrenceType: "DAILY" | "WEEKLY" | "MONTHLY" (null = neopakuje se)
//   recurrenceDay:  MONTHLY = den v měsíci (1–31, -1 = poslední)
//   recurrenceDays: WEEKLY = dny v týdnu CSV (0=Ne … 6=So), např. "3,5"
//   recurrenceTime: čas "HH:mm" (volitelné)

export type RecurrenceRule = {
  type: string | null;
  day?: number | null;
  days?: number[] | null;
  time?: string | null;
};

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function applyTime(d: Date, time?: string | null): Date {
  if (!time) return d;
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return d;
  const r = new Date(d);
  r.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return r;
}

export function parseDays(csv?: string | null): number[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6);
}

/** Další výskyt striktně PO datu `from` podle pravidla (respektuje čas). */
export function nextOccurrence(from: Date, rule: RecurrenceRule): Date {
  const base = new Date(from);
  const { type, day, days, time } = rule;

  if (type === "WEEKLY" && days && days.length) {
    for (let add = 0; add <= 7; add++) {
      const cand = applyTime(addDays(base, add), time);
      if (days.includes(cand.getDay()) && cand.getTime() > base.getTime()) return cand;
    }
    return applyTime(addDays(base, 7), time);
  }

  if (type === "WEEKLY") {
    const target = (((day ?? base.getDay()) % 7) + 7) % 7;
    for (let add = 0; add <= 7; add++) {
      const cand = applyTime(addDays(base, add), time);
      if (cand.getDay() === target && cand.getTime() > base.getTime()) return cand;
    }
    return applyTime(addDays(base, 7), time);
  }

  if (type === "DAILY") {
    for (let add = 0; add <= 1; add++) {
      const cand = applyTime(addDays(base, add), time);
      if (cand.getTime() > base.getTime()) return cand;
    }
    return applyTime(addDays(base, 1), time);
  }

  if (type === "MONTHLY") {
    let y = base.getFullYear();
    let m = base.getMonth();
    const dim = (yy: number, mm: number) =>
      day === -1 ? lastDayOfMonth(yy, mm) : Math.min(day ?? 1, lastDayOfMonth(yy, mm));
    for (let i = 0; i <= 1; i++) {
      const cand = applyTime(new Date(y, m, dim(y, m)), time);
      if (cand.getTime() > base.getTime()) return cand;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return applyTime(new Date(y, m, dim(y, m)), time);
  }

  return applyTime(addDays(base, 1), time);
}

const WD_SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export function recurrenceLabel(rule: RecurrenceRule): string {
  const { type, day, days, time } = rule;
  if (!type) return "Neopakovat";
  const t = time ? ` v ${time}` : "";
  if (type === "DAILY") return `Denně${t}`;
  if (type === "WEEKLY") {
    if (days && days.length) {
      const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Po…Ne
      return `Týdně ${sorted.map((d) => WD_SHORT[d]).join(", ")}${t}`;
    }
    return `Týdně ${WD_SHORT[(((day ?? 1) % 7) + 7) % 7]}${t}`;
  }
  if (type === "MONTHLY") return `Měsíčně ${day === -1 ? "poslední den" : `${day}.`}${t}`;
  return "Neopakovat";
}
