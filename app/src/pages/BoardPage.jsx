import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { periodBounds, weekBounds, fmtDate } from '../lib/dates';
import { rankForPoints, fmtPoints } from '../lib/ranks';
import Chevron from '../components/Chevron';

const PERIODS = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['all', 'All Time'],
];

function useLeaderboard(start, end) {
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

function Place({ i }) {
  return <span className={`place p${i + 1}`}>{i < 3 ? ['1ST', '2ND', '3RD'][i] : `#${i + 1}`}</span>;
}

function IndividualBoard({ period }) {
  const { session } = useAuth();
  const { start, end } = periodBounds(period);
  const { data, isLoading } = useLeaderboard(start, end);

  if (isLoading) return <div className="loading-page"><span className="spin" /></div>;
  if (!data?.length) return <div className="empty-note">No Marines on the board yet.</div>;

  return data.map((row, i) => {
    const rank = rankForPoints(Number(row.career_points));
    const me = row.user_id === session.user.id;
    return (
      <div key={row.user_id} className={`board-row ${me ? 'me' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
        <Place i={i} />
        <Chevron rank={rank} size={22} />
        <div className="who">
          <div className="callsign">{row.callsign}{me ? ' (you)' : ''}</div>
          <div className="sub">{rank.abbr}{row.fire_team_name ? ` · ${row.fire_team_name}` : ''} · {row.mission_days}d on mission</div>
        </div>
        <div className="pts">{fmtPoints(row.points)}<span className="unit">PTS</span></div>
      </div>
    );
  });
}

function TeamBoard({ period }) {
  const { start, end } = periodBounds(period);
  const { data, isLoading } = useQuery({
    queryKey: ['team-board', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_leaderboard', { p_start: start, p_end: end });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="loading-page"><span className="spin" /></div>;
  if (!data?.length) return <div className="empty-note">No fire teams formed yet. HQ assigns teams from the admin panel.</div>;

  return data.map((t, i) => (
    <div key={t.team_id} className="board-row" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <Place i={i} />
      <div className="who">
        <div className="callsign">
          {t.team_name}
          {t.all_hands && <span className="allhands">ALL HANDS +15%</span>}
        </div>
        <div className="sub">{t.member_count} Marines · {fmtPoints(t.total_points)} total</div>
      </div>
      <div className="pts">{fmtPoints(t.score)}<span className="unit">AVG PTS</span></div>
    </div>
  ));
}

function MostImproved() {
  const thisWeek = weekBounds(0);
  const lastWeek = weekBounds(-1);
  const cur = useLeaderboard(thisWeek.start, thisWeek.end);
  const prev = useLeaderboard(lastWeek.start, lastWeek.end);

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
      <div className="panel-title">Most Improved <span className="tag">VS LAST WEEK</span></div>
      {movers.map((r) => (
        <div key={r.user_id} className="feed-line">
          <span className="bell">▲</span>
          <span className="t"><strong>{r.callsign}</strong> is up {fmtPoints(r.delta)} pts on last week</span>
        </div>
      ))}
    </section>
  );
}

function RecentWins() {
  const { data } = useQuery({
    queryKey: ['recent-wins'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recent_wins', { p_limit: 10 });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
  if (!data?.length) return null;
  return (
    <section className="panel">
      <div className="panel-title">Recent Wins <span className="tag">MAKE ONE LESS</span></div>
      {data.map((w, i) => (
        <div key={i} className="feed-line">
          <span className="bell">🔔</span>
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

export default function BoardPage() {
  const [view, setView] = useState('marines');
  const [period, setPeriod] = useState('week');

  return (
    <div>
      <header className="page-head">
        <div className="kicker">UNIT STANDINGS</div>
        <h1>LEADER<span className="accent">BOARD</span></h1>
      </header>

      <div className="seg seg-gold">
        <button className={view === 'marines' ? 'on' : ''} onClick={() => setView('marines')}>Marines</button>
        <button className={view === 'teams' ? 'on' : ''} onClick={() => setView('teams')}>Fire Teams</button>
      </div>
      <div className="seg">
        {PERIODS.map(([key, label]) => (
          <button key={key} className={period === key ? 'on' : ''} onClick={() => setPeriod(key)}>{label}</button>
        ))}
      </div>

      {view === 'marines' ? <IndividualBoard period={period} /> : <TeamBoard period={period} />}

      <MostImproved />
      <RecentWins />
    </div>
  );
}
