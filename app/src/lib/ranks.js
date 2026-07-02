// USMC enlisted ladder driven by career (all-time approved) points.
// Thresholds calibrated against the KPI point economy — see design spec §4.2.

export const RANKS = [
  { grade: 'E-1', title: 'Private', abbr: 'Pvt', points: 0, chevrons: 0, rockers: 0, star: false },
  { grade: 'E-2', title: 'Private First Class', abbr: 'PFC', points: 500, chevrons: 1, rockers: 0, star: false },
  { grade: 'E-3', title: 'Lance Corporal', abbr: 'LCpl', points: 2000, chevrons: 1, rockers: 1, star: false },
  { grade: 'E-4', title: 'Corporal', abbr: 'Cpl', points: 6000, chevrons: 2, rockers: 1, star: false },
  { grade: 'E-5', title: 'Sergeant', abbr: 'Sgt', points: 15000, chevrons: 3, rockers: 1, star: false },
  { grade: 'E-6', title: 'Staff Sergeant', abbr: 'SSgt', points: 35000, chevrons: 3, rockers: 2, star: false },
  { grade: 'E-7', title: 'Gunnery Sergeant', abbr: 'GySgt', points: 75000, chevrons: 3, rockers: 3, star: false },
  { grade: 'E-8', title: 'Master Sergeant', abbr: 'MSgt', points: 150000, chevrons: 3, rockers: 3, star: false },
  { grade: 'E-9', title: 'Sergeant Major', abbr: 'SgtMaj', points: 300000, chevrons: 3, rockers: 3, star: true },
];

export function rankForPoints(points) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.points) rank = r;
  }
  return rank;
}

export function nextRank(points) {
  for (const r of RANKS) {
    if (points < r.points) return r;
  }
  return null; // maxed out
}

export function fmtPoints(n) {
  const v = Math.round(Number(n) * 10) / 10;
  return v.toLocaleString();
}
