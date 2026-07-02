// Last-7-days mission strip: filled = mission complete (>= threshold pts),
// hollow = logged something, dim = nothing. Today pulses.
import { toYmd } from '../lib/dates';

const THRESHOLD = 25;

export default function DayDots({ byDate }) {
  const cells = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ymd = toYmd(d);
    const pts = byDate[ymd] ?? 0;
    cells.push({
      ymd,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      state: pts >= THRESHOLD ? 'hit' : pts > 0 ? 'part' : 'miss',
      today: i === 0,
    });
  }
  return (
    <div className="day-dots">
      {cells.map((c) => (
        <div key={c.ymd} className={`dot-cell ${c.today ? 'today' : ''}`}>
          <span className={`dot ${c.state}`} />
          <span className="dot-lbl">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
