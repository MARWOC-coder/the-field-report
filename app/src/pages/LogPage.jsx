import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { localToday, fmtDate } from '../lib/dates';
import { fmtPoints } from '../lib/ranks';
import MissionRing from '../components/MissionRing';
import KpiIcon from '../components/KpiIcon';
import { MiniBoard, UnitPulse, WinsFeed } from '../components/widgets';

const MISSION_THRESHOLD = 25;

const FlameIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c1.2 3-3.8 4.6-3.8 9a5.8 5.8 0 0 0 11.6 0c0-2.6-1.4-4.3-2.8-5.6-.2 1.2-.7 2-1.7 2.6C15.5 6.6 14.5 4.4 12 3z" />
  </svg>
);
const StarIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
);

function TallyRow({ def, value, onDelta, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const parsed = parseInt(draft, 10);
    setEditing(false);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed !== value) onSet(parsed);
  };

  return (
    <div className={`tally-row ${value > 0 ? 'active' : ''}`}>
      <div className="kpi-ic"><KpiIcon kpiKey={def.key} /></div>
      <div className="tally-info">
        <div className="tally-label">{def.label}</div>
        <div className="tally-pts">{fmtPoints(def.points_per_unit)} PTS / {(def.unit_label || 'rep').toUpperCase()}</div>
      </div>
      <div className="tally-controls">
        {editing ? (
          <span className="tally-value">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min="0"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          </span>
        ) : (
          <button className={`tally-value ${value > 0 ? 'nonzero' : ''}`} onClick={() => setEditing(true)} aria-label={`Edit ${def.label}`}>
            {value}
          </button>
        )}
        <button className="tally-btn minus" onClick={() => onDelta(-1)} disabled={value <= 0} aria-label={`Decrease ${def.label}`}>−</button>
        <button className="tally-btn plus" onClick={() => onDelta(1)} aria-label={`Increase ${def.label}`}>+</button>
      </div>
    </div>
  );
}

function WinRow({ def, entry, onSave }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(entry?.quantity ?? 0);
  const [note, setNote] = useState(entry?.note ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQty(entry?.quantity ?? 0);
    setNote(entry?.note ?? '');
  }, [entry?.quantity, entry?.note]);

  async function save() {
    setErr(''); setBusy(true);
    const res = await onSave(def, Number(qty), note);
    setBusy(false);
    if (res?.error) setErr(res.error);
    else setOpen(false);
  }

  return (
    <div className="win-row">
      <div className="win-head">
        <div className="kpi-ic" style={entry?.quantity > 0 ? { color: 'var(--gold-bright)' } : undefined}>
          <KpiIcon kpiKey={def.key} />
        </div>
        <div className="tally-info">
          <div className="tally-label">{def.label}</div>
          <div className="tally-pts">{fmtPoints(def.points_per_unit)} PTS — HQ VERIFIED</div>
        </div>
        <div className="row-gap">
          {entry && entry.quantity > 0 && <span className={`status-chip ${entry.status}`}>{entry.status} · {Number(entry.quantity)}</span>}
          <button className="btn btn-sm" onClick={() => setOpen(!open)}>{entry && entry.quantity > 0 ? 'Edit' : 'Log'}</button>
        </div>
      </div>
      {open && (
        <div className="win-note">
          {err && <div className="form-error">{err}</div>}
          <div className="row-gap" style={{ marginBottom: 10 }}>
            <button className="tally-btn minus" onClick={() => setQty(Math.max(0, Number(qty) - 1))}>−</button>
            <span className="tally-value nonzero" style={{ minWidth: 40, textAlign: 'center' }}>{qty}</span>
            <button className="tally-btn plus" onClick={() => setQty(Number(qty) + 1)}>+</button>
            <span className="mono small muted">TODAY</span>
          </div>
          <textarea
            placeholder="Required: address, terms, assignment fee…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="row-gap mt8">
            <button className="btn btn-gold btn-sm" onClick={save} disabled={busy}>
              {busy ? <span className="spin" /> : 'Submit to HQ'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LogPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const today = localToday();
  const uid = session.user.id;

  const { data: defs } = useQuery({
    queryKey: ['kpi-defs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_definitions').select('*')
        .eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: entries } = useQuery({
    queryKey: ['entries-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries').select('*')
        .eq('user_id', uid).eq('entry_date', today);
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['my-stats', today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_stats', { p_today: today });
      if (error) throw error;
      return data?.[0];
    },
  });

  const [local, setLocal] = useState({});
  const saveTimers = useRef({});

  useEffect(() => {
    if (!entries) return;
    setLocal((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        if (!(e.kpi_id in next)) next[e.kpi_id] = Number(e.quantity);
      }
      return next;
    });
  }, [entries]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['entries-today'] });
    qc.invalidateQueries({ queryKey: ['my-stats'] });
    qc.invalidateQueries({ queryKey: ['leaderboard'] });
  }

  async function upsert(def, quantity, note) {
    const { error } = await supabase.from('kpi_entries').upsert(
      {
        user_id: uid,
        kpi_id: def.id,
        entry_date: today,
        quantity,
        ...(note !== undefined ? { note } : {}),
      },
      { onConflict: 'user_id,kpi_id,entry_date' },
    );
    if (error) return { error: error.message };
    invalidate();
    return {};
  }

  function scheduleSave(def, quantity) {
    clearTimeout(saveTimers.current[def.id]);
    saveTimers.current[def.id] = setTimeout(() => upsert(def, quantity), 500);
  }

  function tap(def, delta) {
    setLocal((prev) => {
      const cur = prev[def.id] ?? 0;
      let next = Math.max(0, cur + delta);
      if (def.daily_cap != null) next = Math.min(next, def.daily_cap);
      scheduleSave(def, next);
      return { ...prev, [def.id]: next };
    });
  }

  function setDirect(def, value) {
    let v = Math.max(0, value);
    if (def.daily_cap != null) v = Math.min(v, def.daily_cap);
    setLocal((prev) => ({ ...prev, [def.id]: v }));
    upsert(def, v);
  }

  if (!defs || !entries) {
    return (
      <div>
        <div className="skeleton" style={{ height: 180, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 380 }} />
      </div>
    );
  }

  const activityDefs = defs.filter((d) => !d.requires_approval);
  const outcomeDefs = defs.filter((d) => d.requires_approval);
  const entryByKpi = Object.fromEntries(entries.map((e) => [e.kpi_id, e]));

  const todayPoints = defs.reduce((sum, d) => {
    const e = entryByKpi[d.id];
    if (d.requires_approval) {
      return sum + (e && e.status !== 'rejected' ? Number(e.quantity) * Number(e.points_each) : 0);
    }
    return sum + (local[d.id] ?? 0) * Number(d.points_per_unit);
  }, 0);

  return (
    <div>
      <header className="page-head">
        <div className="kicker">{fmtDate(today)} · Daily Report</div>
        <h1>The Field <span className="accent">Report</span></h1>
      </header>

      <div className="page-grid">
        <div className="page-main">
          <section className="panel log-hero">
            <MissionRing points={todayPoints} goal={MISSION_THRESHOLD} />
            <div className="hero-side">
              <div className="hero-stat">
                <span className="ic">{FlameIcon}</span>
                <div>
                  <div className="v">{stats?.current_streak ?? '—'}</div>
                  <div className="l">Day Streak</div>
                </div>
              </div>
              <div className="hero-stat">
                <span className="ic">{StarIcon}</span>
                <div>
                  <div className="v">{stats ? fmtPoints(stats.career_points) : '—'}</div>
                  <div className="l">Career Points</div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">Daily Activity <span className="tag">Auto-Confirmed</span></div>
            {activityDefs.map((d) => (
              <TallyRow
                key={d.id}
                def={d}
                value={local[d.id] ?? 0}
                onDelta={(delta) => tap(d, delta)}
                onSet={(v) => setDirect(d, v)}
              />
            ))}
            <p className="tally-hint">TAP A NUMBER TO TYPE IT · SAVES AUTOMATICALLY</p>
          </section>

          <section className="panel">
            <div className="panel-title">Ring the Bell <span className="tag">HQ Approval</span></div>
            {outcomeDefs.map((d) => (
              <WinRow
                key={d.id}
                def={d}
                entry={entryByKpi[d.id]}
                onSave={(def, qty, note) => upsert(def, qty, note)}
              />
            ))}
          </section>
        </div>

        <aside className="page-rail">
          <MiniBoard />
          <UnitPulse />
          <WinsFeed limit={8} />
        </aside>
      </div>
    </div>
  );
}
