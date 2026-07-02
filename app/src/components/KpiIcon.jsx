// Icon squares for KPI rows, keyed by kpi_definitions.key with a fallback.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICONS = {
  dials: <g {...P}><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></g>,
  conversations: <g {...P}><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /><path d="M8.5 12h.01M12.5 12h.01M16.5 12h.01" strokeWidth="2.6" /></g>,
  doors: <g {...P}><rect x="5" y="3" width="14" height="18" rx="1.5" /><circle cx="15.2" cy="12" r="1" fill="currentColor" stroke="none" /></g>,
  d4d: <g {...P}><path d="M3 15l2-6a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 9l2 6" /><rect x="3" y="15" width="18" height="4.5" rx="1.5" /><circle cx="7.5" cy="17.2" r=".9" fill="currentColor" stroke="none" /><circle cx="16.5" cy="17.2" r=".9" fill="currentColor" stroke="none" /></g>,
  mail: <g {...P}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></g>,
  followups: <g {...P}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4.5l3 1.8" /></g>,
  leads: <g {...P}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></g>,
  appts_set: <g {...P}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></g>,
  appts_held: <g {...P}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4" /><path d="M8.5 14.5l2.5 2.5 4.5-4.5" /></g>,
  offers: <g {...P}><path d="M12 3v18M8 7.5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" /></g>,
  contracts: <g {...P}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 13h5M10 16.5h5" /></g>,
  deals: <g {...P}><path d="M12 4c1 2.5 4 3 4 6.5a4 4 0 0 1-8 0C8 7 11 6.5 12 4z" transform="translate(0 1.5)" /><path d="M6 20h12" /></g>,
  _default: <g {...P}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></g>,
};

export default function KpiIcon({ kpiKey, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {ICONS[kpiKey] ?? ICONS._default}
    </svg>
  );
}
