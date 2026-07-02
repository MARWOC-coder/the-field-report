// 14-day points bar chart. Single series (gold on dark), thin rounded bars,
// no per-bar labels — the max day is direct-labeled; native tooltips per bar.
import { toYmd, fmtDate } from '../lib/dates';

export default function Sparkline({ byDate, days = 14, height = 72 }) {
  const seq = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ymd = toYmd(d);
    seq.push({ ymd, v: byDate[ymd] ?? 0 });
  }
  const max = Math.max(...seq.map((s) => s.v), 1);
  const W = 100;
  const barW = W / days - 1.6;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Points per day, last ${days} days`}
    >
      {seq.map((s, i) => {
        const h = s.v > 0 ? Math.max(3, (s.v / max) * (height - 10)) : 2;
        const x = i * (W / days) + 0.8;
        const isMax = s.v === max && s.v > 0;
        return (
          <rect
            key={s.ymd}
            x={x}
            y={height - h}
            width={barW}
            height={h}
            rx="1.6"
            fill={s.v > 0 ? (isMax ? 'var(--gold)' : 'var(--gold-dim)') : 'var(--ring-track)'}
          >
            <title>{`${fmtDate(s.ymd)}: ${Math.round(s.v)} pts`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
