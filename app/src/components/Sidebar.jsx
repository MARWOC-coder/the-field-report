// Desktop-only navigation rail (mobile uses the bottom NavBar).
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { localToday } from '../lib/dates';
import { rankForPoints } from '../lib/ranks';
import Avatar from './Avatar';

const icons = {
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h9a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8z" />
      <path d="M9 4v4H5M9.5 13h6M9.5 16.5h6" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="4" width="6" height="16" rx="1" />
      <rect x="2" y="10" width="6" height="10" rx="1" />
      <rect x="16" y="8" width="6" height="12" rx="1" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2 20c0-3.3 2.7-6 6-6M22 20c0-3.3-2.7-6-6-6M10 20c0-2 .9-4 2-4s2 2 2 4" />
    </svg>
  ),
  me: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </svg>
  ),
};

function Item({ to, label, icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => `side-item ${isActive ? 'on' : ''}`}>
      {icons[icon]}
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const today = localToday();

  const { data: stats } = useQuery({
    queryKey: ['my-stats', today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_stats', { p_today: today });
      if (error) throw error;
      return data?.[0];
    },
  });

  const rank = rankForPoints(Number(stats?.career_points ?? 0));

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <img src="./assets/marwoc-logo.webp" alt="MARWOC" />
        <div>
          <div className="side-title">The Field <span>Report</span></div>
          <div className="side-sub">MARWOC KPI COMMAND</div>
        </div>
      </div>

      <nav className="side-nav">
        <Item to="/" label="Daily Log" icon="log" />
        <Item to="/board" label="Leaderboard" icon="board" />
        <Item to="/team" label="Fire Team" icon="team" />
        <Item to="/me" label="Service Record" icon="me" />
        {profile?.role === 'admin' && <Item to="/admin" label="HQ Admin" icon="admin" />}
      </nav>

      <div className="side-user">
        <Avatar name={profile?.callsign ?? '?'} size={38} />
        <div className="side-user-info">
          <div className="side-callsign">{profile?.callsign}</div>
          <div className="side-rank">{rank.abbr.toUpperCase()} · {stats?.current_streak ?? 0}D STREAK</div>
        </div>
        <button className="side-out" onClick={signOut} title="Sign out" aria-label="Sign out">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
