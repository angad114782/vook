import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Plus, ScanFace } from 'lucide-react';
import { toast } from 'sonner';
import { companyDeviceApi, searchPeople, type Biometric, type CompanyDevice, type DeviceAccess, type PersonOption } from '../../api/attendanceDevices';
import { isMockMode, runtimeConfig } from '../../config/runtime';
import api from '../../api/axios';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { extractError } from '../../utils/errorUtils';

const label: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' };
const hint: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: '#64748b' };
const BIO: Record<Biometric, string> = { FACE: 'Face', FINGERPRINT: 'Fingerprint' };
const ago = (iso: string | null) => { if (!iso) return 'No punches yet'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

const ACCESS_TEXT: Record<DeviceAccess, { title: string; help: string }> = {
  ALL: { title: 'Everyone in the company', help: 'Any employee can punch here. Good for a head office or a shared entrance.' },
  BRANCH: { title: 'Only this place’s staff', help: 'Only employees who belong to the branch above. Others are told to use their own branch.' },
  SELECTED: { title: 'Only chosen people', help: 'Only the people you pick. Good for a restricted area.' },
};

function PeoplePicker({ chosen, names, onChange }: { chosen: string[]; names: Record<string, string>; onChange: (ids: string[], names: Record<string, string>) => void }) {
  const [text, setText] = useState('');
  const found = useQuery({ queryKey: ['device-people', text], queryFn: () => searchPeople(text), enabled: text.trim().length >= 2 });
  const add = (p: PersonOption) => onChange(chosen.includes(p.id) ? chosen : [...chosen, p.id], { ...names, [p.id]: `${p.name} (${p.employeeId})` });
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input className="admin-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a name or employee code to find people" aria-label="Find people" />
      {found.data && text.trim().length >= 2 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{found.data.filter((p) => !chosen.includes(p.id)).map((p) => <button type="button" key={p.id} className="admin-button admin-button--secondary" onClick={() => add(p)}>+ {p.name} ({p.employeeId})</button>)}{!found.data.length && <span style={hint}>No one found.</span>}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chosen.map((id) => <span key={id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: '#dff3f1', color: '#0d4a47', fontSize: 12 }}>{names[id] ?? 'Person'}<button type="button" onClick={() => onChange(chosen.filter((x) => x !== id), names)} aria-label="Remove person" style={{ border: 0, background: 'none', cursor: 'pointer', color: '#0d4a47' }}>×</button></span>)}{!chosen.length && <span style={hint}>Nobody chosen yet.</span>}</div>
    </div>
  );
}

const STATE_TEXT: Record<CompanyDevice['connectionState'], { label: string; why: string }> = {
  OK: { label: '', why: '' },
  PAUSED: { label: 'Paused by Vook', why: 'Vook switched this provider off for now. Your machine keeps its settings and will work again when it is switched on.' },
  NO_ACCESS: { label: 'Not available to you', why: 'This provider is no longer offered to your company, so the machine cannot send attendance. Ask Vook if this is unexpected.' },
  REMOVED: { label: 'Provider removed', why: 'Vook removed this provider. Ask Vook which one to use instead, then add the machine again.' },
};

/** The company's way to reach the platform team: a normal support ticket, so nothing is lost in a phone call. */
function AskVook({ subject, preset, buttonLabel }: { subject: string; preset: string; buttonLabel: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(preset);
  const send = useMutation({
    mutationFn: () => api.post('/support', { category: 'Technical Issue', subject, description: text.trim(), priority: 'MEDIUM' }),
    onSuccess: () => { toast.success('Sent to Vook support. You can follow it under Support.'); setOpen(false); },
    onError: (e) => toast.error(extractError(e, 'We could not send this. Please try again.')),
  });
  if (!open) return <button type="button" className="admin-button admin-button--secondary" onClick={() => setOpen(true)}>{buttonLabel}</button>;
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: 'white' }}>
      <strong style={{ fontSize: 13 }}>{subject}</strong>
      <textarea className="admin-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to Vook support" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="admin-button admin-button--secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="admin-button" disabled={send.isPending || text.trim().length < 3} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : 'Send to Vook'}</button>
      </div>
    </div>
  );
}

function SetupGuide({ companyCode, devices }: { companyCode: string | null; devices: CompanyDevice[] }) {
  const endpoint = `${runtimeConfig.apiBaseUrl.replace(/\/$/, '')}/attendance-events/ingest`;
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast.success('Copied'), () => toast.error('Could not copy'));
  return (
    <details className="admin-card" style={{ padding: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>How to set up a machine (for you or your installer)</summary>
      <ol style={{ margin: '12px 0 0', paddingLeft: 20, display: 'grid', gap: 8, fontSize: 13, color: '#374151' }}>
        <li>Choose the brand under <strong>Add a device</strong>, then type the machine’s serial number, model number and the place name where it is fixed.</li>
        <li>Ask Vook for the <strong>API key and API token</strong> of that brand. They are secret, so we send them only to you (button below).</li>
        <li>On the machine or its software, set the address below, the key and the token, then check that its serial number matches what you typed.</li>
        <li>Punch once on the machine. It appears under <strong>Recent punches</strong> and turns <strong>Working</strong>.</li>
      </ol>
      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        {[['Send punches to', endpoint], ...(companyCode ? [['Your company code', companyCode]] : []), ...devices.slice(0, 3).map((d) => [`Serial: ${d.name}`, d.serial])].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <small style={{ ...hint, width: 170, flexShrink: 0 }}>{k}</small>
            <code style={{ flex: 1, minWidth: 0, padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, overflowWrap: 'anywhere' }}>{v}</code>
            <button type="button" className="admin-button admin-button--secondary" onClick={() => copy(v!)} aria-label={`Copy ${k}`}>Copy</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 8, justifyItems: 'start' }}>
        <AskVook subject="Need the API key and token for my attendance machines" preset="Please share the API key and API token for our attendance device provider. Company code: " buttonLabel="Ask Vook for the key and token" />
        <AskVook subject="Please add a new attendance device brand" preset="Our machine brand is not in the list. Brand and model: " buttonLabel="My brand is not in the list" />
      </div>
    </details>
  );
}

function Tile({ title, value, note }: { title: string; value: string | number; note?: string }) {
  return <div className="admin-card" style={{ padding: 16 }}><small style={hint}>{title}</small><div style={{ fontSize: 26, fontWeight: 700, color: '#0d4a47' }}>{value}</div>{note && <small style={hint}>{note}</small>}</div>;
}

function DeviceRecent({ device }: { device: CompanyDevice }) {
  const q = useQuery({ queryKey: ['attendance-device-events', device.id], queryFn: () => companyDeviceApi.events(device.id) });
  if (q.isLoading) return <TableSkeleton rows={3} cols={3} label="Loading punches" />;
  if (!q.data?.length) return <p className="notice-muted">No punches received from this device yet. Punch once on the machine to test it.</p>;
  return <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>{q.data.map((e) => <li key={e.id} style={{ fontSize: 13 }}>{new Date(e.occurredAt).toLocaleString()} · {e.employee ? `${e.employee.name} (${e.employee.employeeId})` : 'Unknown'} · {e.type === 'CHECK_IN' ? 'In' : 'Out'} · {BIO[e.modality]}</li>)}</ul>;
}

export default function AttendanceDevicesPage() {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['company-devices'], queryFn: companyDeviceApi.list, enabled: !isMockMode });
  const data = q.data;
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const blank = { connectionId: '', serial: '', modelNo: '', name: '', branchId: '', biometrics: [] as Biometric[], access: 'ALL' as DeviceAccess, employeeIds: [] as string[] };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<CompanyDevice | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const conn = data?.connections.find((c) => c.id === f.connectionId);
  const refresh = () => client.invalidateQueries({ queryKey: ['company-devices'] });
  const add = useMutation({
    mutationFn: () => editing
      ? companyDeviceApi.update(editing.id, { name: f.name, modelNo: f.modelNo, branchId: f.branchId || null, biometrics: f.biometrics, access: f.access, employeeIds: f.employeeIds })
      : companyDeviceApi.add({ connectionId: f.connectionId, serial: f.serial, modelNo: f.modelNo, name: f.name, branchId: f.branchId || null, biometrics: f.biometrics.length ? f.biometrics : conn?.biometrics ?? [], access: f.access, employeeIds: f.employeeIds }),
    onSuccess: () => { toast.success(editing ? 'Device updated.' : 'Device added. Ask someone to punch on it to test.'); setAdding(false); setEditing(null); setF(blank); void refresh(); },
    onError: (e) => toast.error(extractError(e, 'We could not add this device.')),
  });
  const update = useMutation({ mutationFn: ({ d, status }: { d: CompanyDevice; status: 'ACTIVE' | 'DISABLED' }) => companyDeviceApi.update(d.id, { status }), onSuccess: () => void refresh(), onError: (e) => toast.error(extractError(e, 'That did not work.')) });
  const remove = useMutation({ mutationFn: (d: CompanyDevice) => companyDeviceApi.remove(d.id), onSuccess: () => { toast.success('Device removed.'); void refresh(); }, onError: (e) => toast.error(extractError(e, 'That did not work.')) });

  if (isMockMode) return <div className="admin-card" style={{ padding: 24 }}><h2>Attendance devices</h2><p className="notice-muted">Devices need the live server. Switch the app to API mode to register machines.</p></div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header><h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0d4a47', margin: 0 }}>Attendance devices</h1><p style={hint}>Register every face or fingerprint machine you own, in any branch. Punches from all of them flow into one attendance sheet: the first punch of the day is check-in, the last is check-out.</p></header>
      {q.isLoading ? <TableSkeleton rows={4} cols={4} label="Loading devices" /> : data && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <Tile title="Devices" value={data.summary.limit ? `${data.summary.total} / ${data.summary.limit}` : data.summary.total} note={data.summary.limit ? 'Plan limit' : 'No limit on your plan'} />
          <Tile title="Working today" value={data.summary.seenToday} note="Sent a punch in 24 hours" />
          <Tile title="Punches today" value={data.summary.punchesToday} />
        </div>
        {data.needsAttention > 0 && (
          <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#7c2d12', fontSize: 13 }}>
            <strong>{data.needsAttention} {data.needsAttention === 1 ? 'machine needs' : 'machines need'} attention.</strong> Vook changed something about its provider. See the red labels below; nothing was deleted.
          </div>
        )}
        {adding ? (
          <form className="admin-card" style={{ padding: 16, display: 'grid', gap: 14 }} onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <strong>{editing ? `Edit “${editing.name}”` : 'Add a device'}</strong>
            {!data.connections.length ? <div style={{ display: 'grid', gap: 10 }}><p className="notice-muted" style={{ margin: 0 }}>Vook has not offered a device brand to your company yet.</p><AskVook subject="Please enable an attendance device brand for our company" preset="We want to connect our face / fingerprint machines. Brand and model: " buttonLabel="Ask Vook to enable a brand" /></div> : <>
              {!editing && <label style={label}>Device brand
                <select className="admin-input" required value={f.connectionId} onChange={(e) => setF({ ...f, connectionId: e.target.value, biometrics: data.connections.find((c) => c.id === e.target.value)?.biometrics ?? [] })}>
                  <option value="">Choose…</option>{data.connections.map((c) => <option key={c.id} value={c.id}>{c.displayName} · {c.biometrics.map((b) => BIO[b]).join(' + ')}</option>)}
                </select>
              </label>}
              {!editing && <label style={label}>Serial number <span style={hint}>Printed on the back of the machine or shown in its settings.</span><input className="admin-input" required value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} placeholder="e.g. SN-1001" /></label>}
              <label style={label}>Model number <span style={hint}>Printed on the machine, for example “F18” or “SpeedFace-V5L”. Optional.</span><input className="admin-input" value={f.modelNo} onChange={(e) => setF({ ...f, modelNo: e.target.value })} placeholder="e.g. SpeedFace-V5L" /></label>
              <label style={label}>Place name <span style={hint}>Where this machine is fixed, for example “Main gate, ground floor”.</span><input className="admin-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Main gate" /></label>
              <label style={label}>Branch <span style={hint}>Optional. Choose it if you want only this branch’s staff to use the machine.</span>
                <select className="admin-input" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">Not set</option>{data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </label>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                <legend style={{ ...label, marginBottom: 6 }}>Who can punch on this machine?</legend>
                {(Object.keys(ACCESS_TEXT) as DeviceAccess[]).map((a) => (
                  <label key={a} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: `1.5px solid ${f.access === a ? '#0d7470' : '#e2e8f0'}`, background: f.access === a ? '#f0fdfa' : 'white', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="radio" name="device-access" checked={f.access === a} onChange={() => setF({ ...f, access: a })} style={{ accentColor: '#0d7470', marginTop: 3 }} />
                    <span><strong style={{ fontSize: 13 }}>{ACCESS_TEXT[a].title}</strong><span style={{ ...hint, display: 'block' }}>{ACCESS_TEXT[a].help}</span></span>
                  </label>
                ))}
                {f.access === 'BRANCH' && !f.branchId && <span style={{ ...hint, color: '#b45309' }}>Choose the branch above, so we know which branch’s staff can use it.</span>}
                {f.access === 'SELECTED' && <PeoplePicker chosen={f.employeeIds} names={names} onChange={(ids, n) => { setF({ ...f, employeeIds: ids }); setNames(n); }} />}
              </fieldset>
              {conn && conn.biometrics.length > 1 && <fieldset style={{ border: 0, padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}><legend style={label as React.CSSProperties}>This machine reads</legend>
                {conn.biometrics.map((b) => <label key={b} style={{ display: 'inline-flex', gap: 6, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}><input type="checkbox" style={{ accentColor: '#0d7470' }} checked={f.biometrics.includes(b)} onChange={() => setF({ ...f, biometrics: f.biometrics.includes(b) ? f.biometrics.filter((x) => x !== b) : [...f.biometrics, b] })} />{BIO[b]}</label>)}</fieldset>}
            </>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button type="button" className="admin-button admin-button--secondary" onClick={() => { setAdding(false); setEditing(null); setF(blank); }}>Cancel</button><button className="admin-button" disabled={add.isPending || (!editing && !f.connectionId)}>{add.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add device'}</button></div>
          </form>
        ) : <button className="admin-button" style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}><Plus size={14} aria-hidden /> Add a device</button>}

        <SetupGuide companyCode={data.companyCode} devices={data.devices} />
        <div className="admin-card" style={{ padding: 0 }}>
          {data.devices.length === 0 && <p className="notice-muted" style={{ padding: 16 }}>No devices yet. Press “Add a device” and enter the serial number of your first machine.</p>}
          {data.devices.map((d) => (
            <div key={d.id} style={{ padding: 14, borderBottom: '1px solid #eef2f2', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="provider-icon">{d.biometrics.length === 1 && d.biometrics[0] === 'FACE' ? <ScanFace size={16} /> : <Fingerprint size={16} />}</div>
                <div style={{ flex: 1, minWidth: 200 }}><strong>{d.name}</strong><div style={hint}>Serial {d.serial}{d.modelNo ? ` · Model ${d.modelNo}` : ''} · {d.branchName ?? 'No branch'} · {d.biometrics.map((b) => BIO[b]).join(' + ')} · {d.providerName ?? d.connectionName}</div><div style={hint}>{d.access === 'BRANCH' ? `Only ${d.branchName ?? 'this branch'} staff` : d.access === 'SELECTED' ? `Only ${d.employeeCount} chosen ${d.employeeCount === 1 ? 'person' : 'people'}` : 'Everyone in the company'} · Last punch: {ago(d.lastEventAt)} · {d.punchesToday} today</div></div>
                <span className={`admin-status ${d.connectionState !== 'OK' ? 'danger' : d.status !== 'ACTIVE' ? 'neutral' : d.working ? 'success' : 'warning'}`} title={STATE_TEXT[d.connectionState].why}>{d.connectionState !== 'OK' ? STATE_TEXT[d.connectionState].label : d.status !== 'ACTIVE' ? 'Off' : d.working ? 'Working' : 'No punches in 24 h'}</span>
                <button className="admin-button admin-button--secondary" onClick={() => { setEditing(d); setNames(data.peopleNames ?? {}); setF({ connectionId: d.connectionId, serial: d.serial, modelNo: d.modelNo ?? '', name: d.name, branchId: d.branchId ?? '', biometrics: d.biometrics, access: d.access ?? 'ALL', employeeIds: d.employeeIds ?? [] }); setAdding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button className="admin-button admin-button--secondary" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Hide punches' : 'Recent punches'}</button>
                <button className="admin-button admin-button--secondary" disabled={update.isPending} onClick={() => update.mutate({ d, status: d.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}>{d.status === 'ACTIVE' ? 'Turn off' : 'Turn on'}</button>
                <button className="admin-button admin-button--danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove “${d.name}”? Its past punches stay in attendance.`)) remove.mutate(d); }}>Remove</button>
              </div>
              {d.connectionState !== 'OK' && <p style={{ ...hint, color: '#9a3412', margin: 0 }}>{STATE_TEXT[d.connectionState].why}</p>}
              {open === d.id && <DeviceRecent device={d} />}
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
