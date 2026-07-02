// Segmented control with a sliding active pill.
export default function Seg({ options, value, onChange, gold = false, small = false }) {
  const idx = Math.max(0, options.findIndex(([k]) => k === value));
  const n = options.length;
  return (
    <div
      className={`seg ${gold ? 'seg-gold' : ''} ${small ? 'seg-sm' : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      role="tablist"
    >
      <div
        className="seg-pill"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          className={value === key ? 'on' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
