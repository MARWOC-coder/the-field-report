import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { weekBounds } from '../lib/dates';
import { rankForPoints, fmtPoints } from '../lib/ranks';
import Avatar from '../components/Avatar';

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

  if (!profile || !board) {
    return (
      <div>
        <div className="skeleton" style={{ height: 120, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  if (!profile.fire_team_id) {
    return (
      <div>
        <header className="page-head">
          <div className="kicker">Fire Team</div>
          <h1>Un<span className="accent">assigned</span></h1>
        </header>
        <div className="panel">
          <div className="empty-note">
            You haven't been assigned to a fire team yet.
            <br />HQ assigns teams from the admin panel — ping leadership.
          </div>
        </div>
      </div>
    );
  }

  const myTeam = (teams ?? []).find((t) => t.team_id === profile.fire_team_id);
  const roster = board
    .filter((r) => r.fire_team_id === profile.fire_team_id)
    .sort((a, b) => Number(b.points) - Number(a.points));
  const standing = (teams ?? []).findIndex((t) => t.team_id === profile.fire_team_id);
  const maxPts = Math.max(...roster.map((r) => Number(r.points)), 1);

  return (
    <div>
      <header className="page-head">
        <div className="kicker">Fire Team · This Week</div>
        <h1>{myTeam?.team_name ?? 'Fire Team'}</h1>
        {myTeam?.motto && <div className="headsub">“{myTeam.motto}”</div>}
      </header>

      <div className="stat-grid cols-3">
        <div className="stat-tile">
          <div>
            <div className="v">{standing >= 0 ? `#${standing + 1}` : '—'}</div>
            <div className="l">Standing</div>
          </div>
        </div>
        <div className="stat-tile">
          <div>
            <div className="v" style={myTeam?.all_hands ? { color: 'var(--ok)' } : undefined}>
              {myTeam ? fmtPoints(myTeam.score) : '0'}
            </div>
            <div className="l">Team Score</div>
          </div>
        </div>
        <div className="stat-tile">
          <div>
            <div className="v" style={{ color: myTeam?.all_hands ? 'var(--ok)' : 'var(--muted)' }}>
              {myTeam?.all_hands ? 'YES' : 'NO'}
            </div>
            <div className="l">All Hands</div>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title">Roster · This Week</div>
        {roster.map((r) => {
          const rank = rankForPoints(Number(r.career_points));
          const me = r.user_id === session.user.id;
          return (
            <div key={r.user_id} className="roster-row">
              <Avatar name={r.callsign} size={38} />
              <div className="who">
                <div className="callsign">
                  {r.callsign}{me && <span className="you" style={{ color: 'var(--gold)' }}> · you</span>}
                </div>
                <div className="sub mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {rank.abbr.toUpperCase()} · {r.mission_days}D ON MISSION
                </div>
                <div className="roster-bar"><div style={{ width: `${(Number(r.points) / maxPts) * 100}%` }} /></div>
              </div>
              <div className="pts" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20 }}>
                {fmtPoints(r.points)}
              </div>
            </div>
          );
        })}
      </section>

      <p className="mono small muted" style={{ margin: '0 4px', lineHeight: 1.7 }}>
        TEAM SCORE = AVG PTS PER MARINE. ALL HANDS (+15%) NEEDS EVERY MARINE AT 3+ MISSION DAYS THIS WEEK.
      </p>
    </div>
  );
}
