import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { localToday, fmtDate } from '../lib/dates';
import { rankForPoints, nextRank, fmtPoints } from '../lib/ranks';
import Chevron from '../components/Chevron';

export default function MePage() {
  const { session, profile, signOut } = useAuth();
  const today = localToday();
  const uid = session.user.id;

  const { data: stats } = useQuery({
    queryKey: ['my-stats', today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_stats', { p_today: today });
      if (error) throw error;
      return data?.[0];
    },
  });

  const { data: history } = useQuery({
    queryKey: ['my-history'],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sinceYmd = since.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('entry_date, quantity, points_each, status, kpi_definitions(label)')
        .eq('user_id', uid)
        .gte('entry_date', sinceYmd)
        .gt('quantity', 0)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!stats || !profile) return <div className="loading-page"><span className="spin" /></div>;

  const career = Number(stats.career_points);
  const rank = rankForPoints(career);
  const next = nextRank(career);
  const pct = next
    ? Math.min(100, Math.round(((career - rank.points) / (next.points - rank.points)) * 100))
    : 100;

  const byDate = {};
  for (const e of history ?? []) {
    (byDate[e.entry_date] ??= []).push(e);
  }

  return (
    <div>
      <header className="page-head">
        <div className="kicker">SERVICE RECORD</div>
        <h1>{profile.callsign.toUpperCase()}</h1>
      </header>

      <section className="panel rank-hero">
        <Chevron rank={rank} size={56} />
        <div className="rk-grade">{rank.grade}</div>
        <div className="rk-title">{rank.title.toUpperCase()}</div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="progress-lbl">
          <span>{fmtPoints(career)} career pts</span>
          <span>{next ? `${fmtPoints(next.points - career)} to ${next.abbr}` : 'MAX RANK — OOH-RAH'}</span>
        </div>
      </section>

      <div className="stat-grid">
        <div className="day-cell">
          <div className="num ok">{stats.current_streak}</div>
          <div className="lbl">Current streak</div>
        </div>
        <div className="day-cell">
          <div className="num">{stats.best_streak}</div>
          <div className="lbl">Best streak</div>
        </div>
      </div>
      <p className="mono small muted" style={{ margin: '8px 2px 14px' }}>
        Streaks are weekend-forgiving. Log 25+ pts on weekdays to keep yours alive.
      </p>

      <section className="panel">
        <div className="panel-title">Last 14 Days</div>
        {Object.keys(byDate).length === 0 && <div className="empty-note">Nothing logged yet. Get after it.</div>}
        {Object.entries(byDate).map(([date, rows]) => (
          <div key={date} className="history-day">
            <div className="history-date">{fmtDate(date)}</div>
            {rows.map((e, i) => (
              <div key={i} className="history-line">
                <span>
                  {e.kpi_definitions.label}
                  {e.status !== 'approved' && <span className={`status-chip ${e.status}`} style={{ marginLeft: 6 }}>{e.status}</span>}
                </span>
                <span className="q">{Number(e.quantity)} · {fmtPoints(Number(e.quantity) * Number(e.points_each))} pts</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <button className="btn btn-ghost btn-block" onClick={signOut}>Sign Out</button>
    </div>
  );
}
