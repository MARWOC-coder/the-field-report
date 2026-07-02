import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/dates';
import { fmtPoints } from '../lib/ranks';

const TABS = [
  ['approvals', 'Approvals'],
  ['kpis', 'KPIs'],
  ['teams', 'Teams'],
  ['members', 'Members'],
  ['settings', 'Settings'],
];

function useAdminData() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['leaderboard'] });
    qc.invalidateQueries({ queryKey: ['team-board'] });
    qc.invalidateQueries({ queryKey: ['recent-wins'] });
    qc.invalidateQueries({ queryKey: ['kpi-defs'] });
  };
  return { invalidateAll };
}

/* ---------------- Approvals ---------------- */

function Approvals() {
  const { invalidateAll } = useAdminData();
  const [err, setErr] = useState('');

  const { data: pendingMembers } = useQuery({
    queryKey: ['admin', 'pending-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('status', 'pending').order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: pendingEntries } = useQuery({
    queryKey: ['admin', 'pending-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('*, kpi_definitions(label), profiles!kpi_entries_user_id_fkey(callsign)')
        .eq('status', 'pending')
        .order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  async function decideMember(id, status) {
    setErr('');
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) setErr(error.message);
    invalidateAll();
  }

  async function decideEntry(id, status) {
    setErr('');
    const { error } = await supabase.from('kpi_entries').update({ status }).eq('id', id);
    if (error) setErr(error.message);
    invalidateAll();
  }

  return (
    <>
      {err && <div className="form-error">{err}</div>}
      <section className="panel">
        <div className="panel-title">Access Requests <span className="tag">{pendingMembers?.length ?? 0} WAITING</span></div>
        {!pendingMembers?.length && <div className="empty-note">No pending access requests.</div>}
        {pendingMembers?.map((m) => (
          <div key={m.id} className="admin-row">
            <div className="grow">
              <div className="name">{m.callsign}</div>
              <div className="meta">{m.full_name || 'no name given'} · requested {fmtDate(m.created_at.slice(0, 10))}</div>
            </div>
            <button className="btn btn-ok btn-sm" onClick={() => decideMember(m.id, 'active')}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => decideMember(m.id, 'inactive')}>Reject</button>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-title">Claimed Wins <span className="tag">{pendingEntries?.length ?? 0} TO VERIFY</span></div>
        {!pendingEntries?.length && <div className="empty-note">No wins waiting on verification.</div>}
        {pendingEntries?.map((e) => (
          <div key={e.id} className="admin-row">
            <div className="grow">
              <div className="name">
                {e.profiles?.callsign} — {e.kpi_definitions?.label}
                {Number(e.quantity) > 1 ? ` ×${Number(e.quantity)}` : ''}
              </div>
              <div className="meta">
                {fmtDate(e.entry_date)} · worth {fmtPoints(Number(e.quantity) * Number(e.points_each))} pts
              </div>
            </div>
            <button className="btn btn-ok btn-sm" onClick={() => decideEntry(e.id, 'approved')}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => decideEntry(e.id, 'rejected')}>Reject</button>
            {e.note && <div className="admin-note">{e.note}</div>}
          </div>
        ))}
      </section>
    </>
  );
}

/* ---------------- KPI catalog ---------------- */

function KpiEditor({ def, onSaved }) {
  const [form, setForm] = useState({
    label: def.label,
    points_per_unit: def.points_per_unit,
    daily_cap: def.daily_cap ?? '',
    is_active: def.is_active,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true); setErr('');
    const { error } = await supabase.from('kpi_definitions').update({
      label: form.label,
      points_per_unit: Number(form.points_per_unit),
      daily_cap: form.daily_cap === '' ? null : Number(form.daily_cap),
      is_active: form.is_active,
    }).eq('id', def.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div className="admin-row">
      <div className="grow">
        <div className="name">{def.label} <span className="meta mono">({def.key} · {def.category})</span></div>
        <div className="kpi-edit-grid">
          <label className="field"><span>Label</span>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          <label className="field"><span>Pts / unit</span>
            <input type="number" step="0.1" min="0" value={form.points_per_unit}
              onChange={(e) => setForm({ ...form, points_per_unit: e.target.value })} />
          </label>
          <label className="field"><span>Daily cap</span>
            <input type="number" min="1" placeholder="none" value={form.daily_cap}
              onChange={(e) => setForm({ ...form, daily_cap: e.target.value })} />
          </label>
        </div>
        {err && <div className="form-error mt8">{err}</div>}
        <div className="row-gap mt8">
          <button className="btn btn-sm btn-gold" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : 'Save'}</button>
          <button
            className={`btn btn-sm ${form.is_active ? 'btn-danger' : 'btn-ok'}`}
            onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
          >
            {form.is_active ? 'Will stay active' : 'Will deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpis() {
  const { invalidateAll } = useAdminData();
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState({
    key: '', label: '', unit_label: '', points_per_unit: 1,
    category: 'activity', requires_approval: false, daily_cap: '',
  });

  const { data: defs } = useQuery({
    queryKey: ['admin', 'kpi-defs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_definitions').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  async function addKpi() {
    setErr('');
    const { error } = await supabase.from('kpi_definitions').insert({
      key: draft.key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: draft.label.trim(),
      unit_label: draft.unit_label.trim(),
      points_per_unit: Number(draft.points_per_unit),
      category: draft.category,
      requires_approval: draft.requires_approval,
      daily_cap: draft.daily_cap === '' ? null : Number(draft.daily_cap),
      sort_order: ((defs?.length ?? 0) + 1) * 10 + 100,
    });
    if (error) { setErr(error.message); return; }
    setAdding(false);
    setDraft({ key: '', label: '', unit_label: '', points_per_unit: 1, category: 'activity', requires_approval: false, daily_cap: '' });
    invalidateAll();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        KPI Catalog
        <button className="btn btn-sm" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ New KPI'}</button>
      </div>
      <p className="mono small muted" style={{ marginBottom: 10 }}>
        Point changes apply to new entries only — history keeps the points it earned.
      </p>
      {adding && (
        <div className="admin-row">
          <div className="grow">
            {err && <div className="form-error">{err}</div>}
            <div className="kpi-edit-grid">
              <label className="field"><span>Key</span><input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="rvm_drops" /></label>
              <label className="field"><span>Label</span><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="RVM Drops" /></label>
              <label className="field"><span>Unit</span><input value={draft.unit_label} onChange={(e) => setDraft({ ...draft, unit_label: e.target.value })} placeholder="drops" /></label>
              <label className="field"><span>Pts / unit</span><input type="number" step="0.1" min="0" value={draft.points_per_unit} onChange={(e) => setDraft({ ...draft, points_per_unit: e.target.value })} /></label>
              <label className="field"><span>Daily cap</span><input type="number" min="1" placeholder="none" value={draft.daily_cap} onChange={(e) => setDraft({ ...draft, daily_cap: e.target.value })} /></label>
              <label className="field"><span>Type</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value, requires_approval: e.target.value === 'outcome' })}
                >
                  <option value="activity">activity (auto)</option>
                  <option value="outcome">outcome (HQ approval)</option>
                </select>
              </label>
            </div>
            <button className="btn btn-gold btn-sm mt8" onClick={addKpi} disabled={!draft.key || !draft.label}>Create KPI</button>
          </div>
        </div>
      )}
      {defs?.map((d) => <KpiEditor key={d.id} def={d} onSaved={invalidateAll} />)}
    </section>
  );
}

/* ---------------- Teams ---------------- */

function Teams() {
  const { invalidateAll } = useAdminData();
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [err, setErr] = useState('');

  const { data: teams } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fire_teams').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
  const { data: members } = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('callsign');
      if (error) throw error;
      return data;
    },
  });

  async function createTeam() {
    setErr('');
    const { error } = await supabase.from('fire_teams').insert({ name: name.trim(), motto: motto.trim() || null });
    if (error) { setErr(error.message); return; }
    setName(''); setMotto('');
    invalidateAll();
  }

  async function deleteTeam(id) {
    setErr('');
    const { error } = await supabase.from('fire_teams').delete().eq('id', id);
    if (error) setErr(error.message);
    invalidateAll();
  }

  return (
    <section className="panel">
      <div className="panel-title">Fire Teams</div>
      {err && <div className="form-error">{err}</div>}
      <div className="kpi-edit-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label className="field"><span>Team name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fire Team Anvil" /></label>
        <label className="field"><span>Motto (optional)</span><input value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="First in, last out" /></label>
      </div>
      <button className="btn btn-gold btn-sm" onClick={createTeam} disabled={!name.trim()}>Create Team</button>

      <div className="mt12">
        {teams?.map((t) => {
          const roster = (members ?? []).filter((m) => m.fire_team_id === t.id);
          return (
            <div key={t.id} className="admin-row">
              <div className="grow">
                <div className="name">{t.name}</div>
                <div className="meta">{roster.length} Marines{t.motto ? ` · “${t.motto}”` : ''}</div>
                <div className="meta">{roster.map((m) => m.callsign).join(', ') || 'no one assigned yet'}</div>
              </div>
              {roster.length === 0 && (
                <button className="btn btn-danger btn-sm" onClick={() => deleteTeam(t.id)}>Delete</button>
              )}
            </div>
          );
        })}
        {!teams?.length && <div className="empty-note">No fire teams yet. Create one above, then assign Marines in the Members tab.</div>}
      </div>
    </section>
  );
}

/* ---------------- Members ---------------- */

function Members() {
  const { invalidateAll } = useAdminData();
  const [err, setErr] = useState('');

  const { data: members } = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('callsign');
      if (error) throw error;
      return data;
    },
  });
  const { data: teams } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fire_teams').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  async function patch(id, fields) {
    setErr('');
    const { error } = await supabase.from('profiles').update(fields).eq('id', id);
    if (error) setErr(error.message);
    invalidateAll();
  }

  return (
    <section className="panel">
      <div className="panel-title">Members <span className="tag">{members?.length ?? 0} TOTAL</span></div>
      {err && <div className="form-error">{err}</div>}
      {members?.map((m) => (
        <div key={m.id} className="admin-row">
          <div className="grow">
            <div className="name">{m.callsign}</div>
            <div className="meta">{m.full_name || '—'}</div>
          </div>
          <select value={m.status} onChange={(e) => patch(m.id, { status: e.target.value })}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="inactive">inactive</option>
          </select>
          <select value={m.role} onChange={(e) => patch(m.id, { role: e.target.value })}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <select
            value={m.fire_team_id ?? ''}
            onChange={(e) => patch(m.id, { fire_team_id: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">no team</option>
            {teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      ))}
    </section>
  );
}

/* ---------------- Settings ---------------- */

function Settings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.key, r.value]));
    },
  });

  const invite = draft ?? settings?.invite_code ?? '';

  async function save() {
    setMsg('');
    const { error } = await supabase.from('settings')
      .update({ value: invite }).eq('key', 'invite_code');
    setMsg(error ? error.message : 'Saved.');
    qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
  }

  return (
    <section className="panel">
      <div className="panel-title">Settings</div>
      <label className="field">
        <span>Invite code — new sign-ups with this code skip the approval queue</span>
        <input value={invite} onChange={(e) => setDraft(e.target.value)} placeholder="Blank = everyone waits for approval" />
      </label>
      {msg && <div className={msg === 'Saved.' ? 'form-ok' : 'form-error'}>{msg}</div>}
      <button className="btn btn-gold btn-sm" onClick={save}>Save Settings</button>
      <p className="mono small muted mt12">
        Share the code in the community to let verified Marines self-activate.
        Rotate it if it leaks. Without a code, every request lands in Approvals.
      </p>
    </section>
  );
}

/* ---------------- Page ---------------- */

export default function AdminPage() {
  const [tab, setTab] = useState('approvals');
  return (
    <div>
      <header className="page-head">
        <div className="kicker">COMMAND POST</div>
        <h1>HQ <span className="accent">ADMIN</span></h1>
      </header>
      <div className="seg">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'approvals' && <Approvals />}
      {tab === 'kpis' && <Kpis />}
      {tab === 'teams' && <Teams />}
      {tab === 'members' && <Members />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}
