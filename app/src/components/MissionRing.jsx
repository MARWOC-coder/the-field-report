// Circular progress ring — the Log page hero. Fills as today's points
// approach the Mission Complete threshold, then locks gold.
export default function MissionRing({ points, goal, size = 148 }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? points / goal : 0);
  const done = pct >= 1;

  return (
    <div className={`mission-ring ${done ? 'done' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--ring-track)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={done ? 'var(--gold)' : 'var(--ring-fill)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-center">
        <div className="ring-points">{Math.round(points * 10) / 10}</div>
        <div className="ring-label">{done ? 'MISSION ✓' : `OF ${goal} PTS`}</div>
      </div>
    </div>
  );
}
