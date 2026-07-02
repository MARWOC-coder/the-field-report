import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { localToday, fmtDate } from '../lib/dates';
import { rankForPoints, nextRank, fmtPoints } from '../lib/ranks';
import Chevron from '../components/Chevron';
import DayDots from '../components/DayDots';
import Sparkline from '../components/Sparkline';

const FlameIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c1.2 3-3.8 4.6-3.8 9a5.8 5.8 0 0 0 11.6 0c0-2.6-1.4-4.3-2.8-5.6-.2 1.2-.7 2-1.7 2.6C15.5 6.6 14.5 4.4 12 3z" />
  </svg>
);
const TrophyIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 5H4.5a3.5 3.5 0 0 0 3.6 4M16 5h3.5a3.5 3.5 0 0 1-3.6 4M12 13v4M8.5 20h7M10 17h4" />
  </svg>
);

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

  if (!stats || !profile) {
    return (
      <div>
        <div className="skeleton" style={{ height: 220, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const career = Number(stats.career_points);
  const rank = rankForPoints(career);
  const next = nextRank(career);
  const pct = next
    ? Math.min(100, Math.round(((career - rank.points) / (next.points - rank.points)) * 100))
    : 100;

  const byDate = {};
  const ptsByDate = {};
  for (const e of history ?? []) {
    (byDate[e.entry_date] ??= []).push(e);
    if (e.status !== 'rejected') {
      ptsByDate[e.entry_date] = (ptsByDate[e.entry_date] ?? 0) + Number(e.quantity) * Number(e.points_each);
    }
  }

  return (
    <div>
      <header className="page-head">
        <div className="kicker">Service Record</div>
        <h1>{profile.callsign}</h1>
      </header>

      <section className="panel rank-hero">
        <Chevron rank={rank} size={60} />
        <div className="rk-grade">{rank.grade}</div>
        <div className="rk-title">{rank.title}</div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="progress-lbl">
          <span>{fmtPoints(career)} CAREER PTS</span>
          <span>{next ? `${fmtPoints(next.points - career)} TO ${next.abbr.toUpperCase()}` : 'MAX RANK — OOH-RAH'}</span>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-tile">
          <span className="ic">{FlameIcon}</span>
          <div>
            <div className="v">{stats.current_streak}</div>
            <div className="l">Current Streak</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="ic">{TrophyIcon}</span>
          <div>
            <div className="v">{stats.best_streak}</div>
            <div className="l">Best Streak</div>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title">This Week <span className="tag">25+ PTS = MISSION</span></div>
        <DayDots byDate={ptsByDate} />
      </section>

      <section className="panel">
        <div className="panel-title">Last 14 Days</div>
        <Sparkline byDate={ptsByDate} />
      </section>

      <section className="panel">
        <div className="panel-title">Entry Log</div>
        {Object.keys(byDate).length === 0 && <div className="empty-note">Nothing logged yet. Get after it.</div>}
        {Object.entries(byDate).map(([date, rows]) => (
          <div key={date} className="history-day">
            <div className="history-date">{fmtDate(date)}</div>
            {rows.map((e, i) => (
              <div key={i} className="history-line">
                <span>
                  {e.kpi_definitions.label}
                  {e.status !== 'approved' && <span className={`status-chip ${e.status}`} style={{ marginLeft: 8 }}>{e.status}</span>}
                </span>
                <span className="q">{Number(e.quantity)} · {fmtPoints(Number(e.quantity) * Number(e.points_each))} PTS</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <button className="btn btn-ghost btn-block" onClick={signOut}>Sign Out</button>
    </div>
  );
}
