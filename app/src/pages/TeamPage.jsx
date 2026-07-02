import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { weekBounds } from '../lib/dates';
import { rankForPoints, fmtPoints } from '../lib/ranks';
import Chevron from '../components/Chevron';

export default function TeamPage() {
  const { session, profile } = useAuth();
  const { start, end } = weekBounds();

  const { data: board } = useQuery({
    queryKey: ['leaderboard', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_start: start, p_end: end });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const { data: teams } = useQuery({
    queryKey: ['team-board', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_leaderboard', { p_start: start, p_end: end });
      if (error) throw error;
      return data;
    },
  });

  if (!profile || !board) return <div className="loading-page"><span className="spin" /></div>;

  if (!profile.fire_team_id) {
    return (
      <div>
        <header className="page-head">
          <div className="kicker">FIRE TEAM</div>
          <h1>UN<span className="accent">ASSIGNED</span></h1>
        </header>
        <div className="empty-note">
          You haven't been assigned to a fire team yet.
          <br />HQ assigns teams from the admin panel — ping leadership.
        </div>
      </div>
    );
  }

  const myTeam = (teams ?? []).find((t) => t.team_id === profile.fire_team_id);
  const roster = board
    .filter((r) => r.fire_team_id === profile.fire_team_id)
    .sort((a, b) => Number(b.points) - Number(a.points));
  const standing = (teams ?? []).findIndex((t) => t.team_id === profile.fire_team_id);

  return (
    <div>
      <header className="page-head">
        <div className="kicker">FIRE TEAM · THIS WEEK</div>
        <h1>{(myTeam?.team_name ?? 'FIRE TEAM').toUpperCase()}</h1>
        {myTeam?.motto && <div className="mono small muted">“{myTeam.motto}”</div>}
      </header>

      <div className="day-strip">
        <div className="day-cell">
          <div className="num">{standing >= 0 ? `#${standing + 1}` : '—'}</div>
          <div className="lbl">Standing</div>
        </div>
        <div className="day-cell">
          <div className={`num ${myTeam?.all_hands ? 'ok' : ''}`}>{myTeam ? fmtPoints(myTeam.score) : '0'}</div>
          <div className="lbl">Team score</div>
        </div>
        <div className="day-cell">
          <div className="num">{myTeam?.all_hands ? 'YES' : 'NO'}</div>
          <div className="lbl">All hands</div>
        </div>
      </div>
      <p className="mono small muted" style={{ margin: '0 2px 14px' }}>
        Team score = average pts per Marine. All Hands (+15%) needs every Marine at 3+ mission days this week.
      </p>

      <section className="panel">
        <div className="panel-title">Roster · This Week</div>
        {roster.map((r) => {
          const rank = rankForPoints(Number(r.career_points));
          const me = r.user_id === session.user.id;
          return (
            <div key={r.user_id} className={`board-row ${me ? 'me' : ''}`} style={{ border: 'none', clipPath: 'none', marginBottom: 0, paddingLeft: 2, paddingRight: 2, background: 'transparent', borderBottom: '1px dashed var(--line)' }}>
              <Chevron rank={rank} size={22} />
              <div className="who">
                <div className="callsign">{r.callsign}{me ? ' (you)' : ''}</div>
                <div className="sub">{rank.abbr} · {r.mission_days}d on mission</div>
              </div>
              <div className="pts">{fmtPoints(r.points)}<span className="unit">PTS</span></div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
