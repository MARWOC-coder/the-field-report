import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { periodBounds, weekBounds, fmtDate } from '../lib/dates';
import { rankForPoints, fmtPoints } from '../lib/ranks';
import Avatar from '../components/Avatar';
import Seg from '../components/Seg';

const PERIODS = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['all', 'All Time'],
];
const VIEWS = [
  ['marines', 'Marines'],
  ['teams', 'Fire Teams'],
];

const BellIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </svg>
);

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

function Podium({ top, meId }) {
  const slots = [
    { row: top[1], cls: 'p2', place: '2', size: 52 },
    { row: top[0], cls: 'p1', place: '1', size: 66 },
    { row: top[2], cls: 'p3', place: '3', size: 52 },
  ];
  return (
    <div className="podium">
      {slots.map(({ row, cls, place, size }) => (
        <div key={place} className={`podium-slot ${cls}`}>
          <Avatar name={row.callsign} size={size} />
          <div className="podium-name">{row.callsign}{row.user_id === meId ? ' ★' : ''}</div>
          <div className="podium-pts">
            {fmtPoints(row.points)} <small>PTS</small>
          </div>
          <div className="podium-base">{place}</div>
        </div>
      ))}
    </div>
  );
}

function Row({ row, place, meId }) {
  const rank = rankForPoints(Number(row.career_points));
  const me = row.user_id === meId;
  return (
    <div className={`board-row ${me ? 'me' : ''}`} style={{ animationDelay: `${Math.min(place, 12) * 35}ms` }}>
      <span className="place">{place + 1}</span>
      <Avatar name={row.callsign} size={36} />
      <div className="who">
        <div className="callsign">{row.callsign}{me && <span className="you"> · you</span>}</div>
        <div className="sub">{rank.abbr}{row.fire_team_name ? ` · ${row.fire_team_name}` : ''} · {row.mission_days}D ON MISSION</div>
      </div>
      <div className="pts">{fmtPoints(row.points)}<span className="unit">PTS</span></div>
    </div>
  );
}

function IndividualBoard({ period }) {
  const { session } = useAuth();
  const { start, end } = periodBounds(period);
  const { data, isLoading } = useLeaderboard(start, end);

  if (isLoading) {
    return (
      <div>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 62, marginBottom: 9 }} />)}
      </div>
    );
  }
  if (!data?.length) return <div className="empty-note">No Marines on the board yet.</div>;

  const meId = session.user.id;
  const showPodium = data.length >= 3 && Number(data[0].points) > 0;
  const rest = showPodium ? data.slice(3) : data;

  return (
    <>
      {showPodium && <Podium top={data.slice(0, 3)} meId={meId} />}
      {rest.map((row, i) => (
        <Row key={row.user_id} row={row} place={showPodium ? i + 3 : i} meId={meId} />
      ))}
    </>
  );
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

  if (isLoading) {
    return (
      <div>
        {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 62, marginBottom: 9 }} />)}
      </div>
    );
  }
  if (!data?.length) return <div className="empty-note">No fire teams formed yet.<br />HQ assigns teams from the admin panel.</div>;

  return data.map((t, i) => (
    <div key={t.team_id} className="board-row" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <span className="place">{i + 1}</span>
      <div className="who">
        <div className="callsign">
          {t.team_name}
          {t.all_hands && <span className="allhands">ALL HANDS +15%</span>}
        </div>
        <div className="sub">{t.member_count} MARINES · {fmtPoints(t.total_points)} TOTAL</div>
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

export default function BoardPage() {
  const [view, setView] = useState('marines');
  const [period, setPeriod] = useState('week');

  return (
    <div>
      <header className="page-head">
        <div className="kicker">Unit Standings</div>
        <h1>Leader<span className="accent">board</span></h1>
      </header>

      <Seg options={VIEWS} value={view} onChange={setView} gold />
      <Seg options={PERIODS} value={period} onChange={setPeriod} />

      {view === 'marines' ? <IndividualBoard period={period} /> : <TeamBoard period={period} />}

      <MostImproved />
      <RecentWins />
    </div>
  );
}
