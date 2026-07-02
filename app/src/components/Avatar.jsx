// Initials avatar with a stable per-callsign hue.
function hueFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function Avatar({ name = '?', size = 38 }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  const hue = hueFor(name.toLowerCase());
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 32% 26%), hsl(${hue} 40% 16%))`,
        border: `1px solid hsl(${hue} 30% 38% / .55)`,
      }}
    >
      {initials}
    </div>
  );
}
