// Logika opakování úkolů. Pravidlo je uložené na Tasku:
//   recurrenceType: "DAILY" | "WEEKLY" | "MONTHLY" (null = neopakuje se)
//   recurrenceDay:  WEEKLY = den v týdnu (0=Ne … 6=So); MONTHLY = den v měsíci (1–31, -1 = poslední)

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Další výskyt striktně PO datu `from` podle pravidla. */
export function nextOccurrence(
  from: Date,
  type: string | null,
  day: number | null,
): Date {
  const d = new Date(from);

  if (type === "DAILY") {
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (type === "WEEKLY") {
    const target = (((day ?? d.getDay()) % 7) + 7) % 7;
    let add = (target - d.getDay() + 7) % 7;
    if (add === 0) add = 7; // stejný den → až za týden
    d.setDate(d.getDate() + add);
    return d;
  }

  if (type === "MONTHLY") {
    let y = d.getFullYear();
    let m = d.getMonth();
    const dayInMonth = (yy: number, mm: number) =>
      day === -1 ? lastDayOfMonth(yy, mm) : Math.min(day ?? 1, lastDayOfMonth(yy, mm));

    let targetDay = dayInMonth(y, m);
    if (targetDay <= d.getDate()) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      targetDay = dayInMonth(y, m);
    }
    const res = new Date(d);
    res.setFullYear(y, m, targetDay);
    return res;
  }

  // fallback
  d.setDate(d.getDate() + 1);
  return d;
}

const WEEKDAYS_AKUZATIV = [
  "neděli", "pondělí", "úterý", "středu", "čtvrtek", "pátek", "sobotu",
];

export function recurrenceLabel(type: string | null, day: number | null): string {
  if (!type) return "Neopakovat";
  if (type === "DAILY") return "Denně";
  if (type === "WEEKLY") return `Týdně v ${WEEKDAYS_AKUZATIV[(((day ?? 1) % 7) + 7) % 7]}`;
  if (type === "MONTHLY") return day === -1 ? "Měsíčně poslední den" : `Měsíčně ${day}.`;
  return "Neopakovat";
}
