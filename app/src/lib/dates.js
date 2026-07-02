// All dates are the member's local calendar dates, formatted YYYY-MM-DD.

export function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localToday() {
  return toYmd(new Date());
}

// Monday-start week containing today
export function weekBounds(offsetWeeks = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetWeeks * 7);
  const dow = (now.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const start = new Date(now);
  start.setDate(now.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toYmd(start), end: toYmd(end) };
}

export function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toYmd(start), end: toYmd(end) };
}

export function periodBounds(period) {
  const today = localToday();
  if (period === 'today') return { start: today, end: today };
  if (period === 'week') return weekBounds();
  if (period === 'month') return monthBounds();
  return { start: '2020-01-01', end: today }; // all time
}

export function fmtDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
