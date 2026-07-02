// Chevron-inspired rank insignia (not exact USMC reproductions).
export default function Chevron({ rank, size = 22 }) {
  const { chevrons, rockers, star } = rank;
  const w = 24;
  const h = 24;
  const els = [];
  // chevrons stack downward from the top
  for (let i = 0; i < chevrons; i++) {
    const y = 4 + i * 4.5;
    els.push(
      <path
        key={`c${i}`}
        d={`M3 ${y + 5} L12 ${y} L21 ${y + 5}`}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2.4"
      />,
    );
  }
  // rockers curve upward from the bottom
  for (let i = 0; i < rockers; i++) {
    const y = 23 - i * 3.6;
    els.push(
      <path
        key={`r${i}`}
        d={`M3 ${y - 4} Q12 ${y} 21 ${y - 4}`}
        fill="none"
        stroke="var(--khaki)"
        strokeWidth="2"
      />,
    );
  }
  if (star) {
    els.push(
      <circle key="s" cx="12" cy="13.5" r="2.2" fill="var(--footprint)" />,
    );
  }
  if (els.length === 0) {
    els.push(
      <line key="e1" x1="8" y1="14" x2="16" y2="14" stroke="var(--line-hi)" strokeWidth="2" />,
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={size} aria-label={rank.title}>
      {els}
    </svg>
  );
}
