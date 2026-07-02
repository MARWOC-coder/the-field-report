import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { localToday, fmtDate } from '../lib/dates';
import { fmtPoints } from '../lib/ranks';

const MISSION_THRESHOLD = 25;

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
    <div className="tally-row">
      <div className="tally-info">
        <div className="tally-label">{def.label}</div>
        <div className="tally-pts">{fmtPoints(def.points_per_unit)} pts / {def.unit_label || 'rep'}</div>
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
        <button className="tally-btn" onClick={() => onDelta(-1)} disabled={value <= 0} aria-label={`Decrease ${def.label}`}>−</button>
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
        <div className="tally-info">
          <div className="tally-label">{def.label}</div>
          <div className="tally-pts">{fmtPoints(def.points_per_unit)} pts — needs HQ approval</div>
        </div>
        <div className="row-gap">
          {entry && entry.quantity > 0 && <span className={`status-chip ${entry.status}`}>{entry.status} · {entry.quantity}</span>}
          <button className="btn btn-sm" onClick={() => setOpen(!open)}>{entry && entry.quantity > 0 ? 'Edit' : 'Log'}</button>
        </div>
      </div>
      {open && (
        <div className="win-note">
          {err && <div className="form-error">{err}</div>}
          <div className="row-gap" style={{ marginBottom: 8 }}>
            <button className="tally-btn" onClick={() => setQty(Math.max(0, Number(qty) - 1))}>−</button>
            <span className="tally-value nonzero" style={{ minWidth: 40, textAlign: 'center' }}>{qty}</span>
            <button className="tally-btn plus" onClick={() => setQty(Number(qty) + 1)}>+</button>
            <span className="mono small muted">today</span>
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

  // local quantities for snappy taps; keyed by kpi_id
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
    return <div className="loading-page"><span className="spin" /></div>;
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
  const missionDone = todayPoints >= MISSION_THRESHOLD;

  return (
    <div>
      <header className="page-head">
        <div className="kicker">{fmtDate(today)} · DAILY REPORT</div>
        <h1>THE FIELD <span className="accent">REPORT</span></h1>
      </header>

      <div className="day-strip">
        <div className="day-cell">
          <div className={`num ${missionDone ? 'ok' : ''}`}>{fmtPoints(todayPoints)}</div>
          <div className="lbl">Points today</div>
        </div>
        <div className="day-cell">
          <div className="num">{stats?.current_streak ?? '—'}</div>
          <div className="lbl">Day streak</div>
        </div>
        <div className="day-cell">
          <div className="num">{stats ? fmtPoints(stats.career_points) : '—'}</div>
          <div className="lbl">Career pts</div>
        </div>
      </div>

      <div className={`mission-banner ${missionDone ? 'done' : ''}`}>
        {missionDone
          ? '✓ MISSION COMPLETE — STREAK SECURED'
          : `LOG ${fmtPoints(Math.max(0, MISSION_THRESHOLD - todayPoints))} MORE PTS TO SECURE TODAY'S STREAK`}
      </div>

      <section className="panel">
        <div className="panel-title">Daily Activity <span className="tag">AUTO-CONFIRMED</span></div>
        {activityDefs.map((d) => (
          <TallyRow
            key={d.id}
            def={d}
            value={local[d.id] ?? 0}
            onDelta={(delta) => tap(d, delta)}
            onSet={(v) => setDirect(d, v)}
          />
        ))}
        <p className="mono small muted mt8" style={{ textAlign: 'center' }}>
          Tap a number to type it directly. Saves automatically.
        </p>
      </section>

      <section className="panel">
        <div className="panel-title">Ring the Bell <span className="tag">HQ APPROVAL</span></div>
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
  );
}
