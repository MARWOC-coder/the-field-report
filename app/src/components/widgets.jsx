// Shared info widgets: used in desktop page rails and stacked on mobile.
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { weekBounds, fmtDate } from '../lib/dates';
import { fmtPoints } from '../lib/ranks';
import Avatar from './Avatar';

const BellIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </svg>
);

export function useWeekBoard() {
  const { start, end } = weekBounds();
  return useQuery({
    queryKey: ['leaderboard', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_start: start, p_end: end });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

// Top 5 this week + your own position if you're outside it.
export function MiniBoard() {
  const { session } = useAuth();
  const { data } = useWeekBoard();
  if (!data?.length) return null;

  const meId = session.user.id;
  const top = data.slice(0, 5);
  const myIdx = data.findIndex((r) => r.user_id === meId);
  const showMe = myIdx >= 5;

  const row = (r, i) => (
    <div key={r.user_id} className={`mini-row ${r.user_id === meId ? 'me' : ''}`}>
      <span className="mini-place">{i + 1}</span>
      <Avatar name={r.callsign} size={26} />
      <span className="mini-name">{r.callsign}</span>
      <span className="mini-pts">{fmtPoints(r.points)}</span>
    </div>
  );

  return (
    <section className="panel">
      <div className="panel-title">This Week <span className="tag">Top 5</span></div>
      {top.map(row)}
      {showMe && (
        <>
          <div className="mini-gap">···</div>
          {row(data[myIdx], myIdx)}
        </>
      )}
      <Link to="/board" className="mini-link">Full leaderboard →</Link>
    </section>
  );
}

// Community totals this week — the "everyone is grinding" signal.
export function UnitPulse() {
  const { data } = useWeekBoard();
  if (!data?.length) return null;

  const active = data.filter((r) => Number(r.points) > 0).length;
  const totalPts = data.reduce((s, r) => s + Number(r.points), 0);
  const missionDays = data.reduce((s, r) => s + Number(r.mission_days), 0);

  return (
    <section className="panel">
      <div className="panel-title">Unit Pulse <span className="tag">This Week</span></div>
      <div className="pulse-grid">
        <div>
          <div className="pulse-v">{active}<small>/{data.length}</small></div>
          <div className="pulse-l">Marines Active</div>
        </div>
        <div>
          <div className="pulse-v">{fmtPoints(totalPts)}</div>
          <div className="pulse-l">Unit Points</div>
        </div>
        <div>
          <div className="pulse-v">{missionDays}</div>
          <div className="pulse-l">Mission Days</div>
        </div>
      </div>
    </section>
  );
}

export function MostImproved() {
  const lastWeek = weekBounds(-1);
  const cur = useWeekBoard();
  const prev = useQuery({
    queryKey: ['leaderboard', lastWeek.start, lastWeek.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        p_start: lastWeek.start, p_end: lastWeek.end,
      });
      if (error) throw error;
      return data;
    },
  });

  if (cur.isLoading || prev.isLoading) return null;
  const prevMap = Object.fromEntries((prev.data ?? []).map((r) => [r.user_id, Number(r.points)]));
  const movers = (cur.data ?? [])
    .map((r) => ({ ...r, delta: Number(r.points) - (prevMap[r.user_id] ?? 0) }))
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  if (!movers.length) return null;

  return (
    <section className="panel">
      <div className="panel-title">Most Improved <span className="tag">vs Last Week</span></div>
      {movers.map((r) => (
        <div key={r.user_id} className="feed-line">
          <span className="bell" style={{ color: 'var(--ok)' }}>▲</span>
          <span className="t"><strong>{r.callsign}</strong> is up {fmtPoints(r.delta)} pts on last week</span>
        </div>
      ))}
    </section>
  );
}

export function WinsFeed({ limit = 10 }) {
  const { data } = useQuery({
    queryKey: ['recent-wins'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recent_wins', { p_limit: limit });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
  if (!data?.length) return null;
  return (
    <section className="panel">
      <div className="panel-title">Recent Wins <span className="tag">Make One Less</span></div>
      {data.map((w, i) => (
        <div key={i} className="feed-line">
          <span className="bell">{BellIcon}</span>
          <span className="t">
            <strong>{w.callsign}</strong> — {w.kpi_label}
            {Number(w.quantity) > 1 ? ` ×${Number(w.quantity)}` : ''} (+{fmtPoints(w.points)} pts)
          </span>
          <span className="d">{fmtDate(w.entry_date)}</span>
        </div>
      ))}
    </section>
  );
}
