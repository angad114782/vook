import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CreatableSelect from '../../components/ui/CreatableSelect';
import { ChevronDown, Copy, Eye, EyeOff, Fingerprint, Globe2, Plus, ScanFace, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { deviceApi, type Biometric, type ConnectionInput, type ConnectionMode, type DeviceConnection, type DeviceProvider, type ProviderInput } from '../../api/attendanceDevices';
import { runtimeConfig } from '../../config/runtime';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { extractError } from '../../utils/errorUtils';
import { statusLabel } from '../../utils/friendly';

const MODE_LABEL: Record<ConnectionMode, string> = { CLOUD_API: 'Vendor’s cloud server', LOCAL_BRIDGE: 'Software at your office', DEVICE_PUSH: 'Device sends punches to Vook', MOBILE: 'Employee’s phone (GPS)' };
const MODE_HELP: Record<ConnectionMode, string> = {
  CLOUD_API: 'Vook talks to the vendor’s web server using your API key and token.',
  LOCAL_BRIDGE: 'A small program at the office connects the devices to Vook.',
  DEVICE_PUSH: 'The device itself sends every punch to Vook using the API key and token below.',
  MOBILE: 'No device. People punch from their phone inside the branch area.',
};
const BIO_LABEL: Record<Biometric, string> = { FACE: 'Face', FINGERPRINT: 'Fingerprint' };
const needsCredentials = (mode: ConnectionMode) => mode !== 'MOBILE';
const random = (prefix: string, bytes: number) => `${prefix}${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}`;

const field: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' };
const help: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: '#64748b', lineHeight: 1.5 };

function Chips({ biometrics, mode }: { biometrics: Biometric[]; mode?: ConnectionMode }) {
  if (!biometrics.length) return <span style={{ ...help, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Globe2 size={12} aria-hidden /> {mode === 'MOBILE' ? 'Phone GPS' : 'No biometrics'}</span>;
  return <>{biometrics.map((b) => <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#dff3f1', color: '#0d4a47', fontSize: 11, fontWeight: 600 }}>{b === 'FACE' ? <ScanFace size={12} aria-hidden /> : <Fingerprint size={12} aria-hidden />}{BIO_LABEL[b]}</span>)}</>;
}

function BiometricPicker({ allowed, value, onChange }: { allowed: Biometric[]; value: Biometric[]; onChange: (v: Biometric[]) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
      <legend style={{ ...field, marginBottom: 6 }}>What does this device read?</legend>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['FACE', 'FINGERPRINT'] as Biometric[]).map((b) => {
          const ok = allowed.includes(b);
          const on = value.includes(b);
          return (
            <label key={b} title={ok ? '' : 'This provider cannot read this'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${on ? '#0d7470' : '#e2e8f0'}`, background: on ? '#f0fdfa' : ok ? 'white' : '#f8fafc', color: ok ? '#0f172a' : '#94a3b8', cursor: ok ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" disabled={!ok} checked={on} onChange={() => onChange(on ? value.filter((x) => x !== b) : [...value, b])} style={{ accentColor: '#0d7470' }} />
              {b === 'FACE' ? <ScanFace size={15} aria-hidden /> : <Fingerprint size={15} aria-hidden />} {BIO_LABEL[b]}
            </label>
          );
        })}
      </div>
      <span style={help}>Tick both if the device reads face and fingerprint.</span>
    </fieldset>
  );
}

function SecretInput({ label, value, onChange, placeholder, generate, saved }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; generate: () => string; saved: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <label style={field}>{label} <span style={{ color: '#dc2626' }}>*</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="admin-input" type={shown ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder={saved ? 'Saved — leave empty to keep it' : placeholder} style={{ paddingRight: 38 }} />
          <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? `Hide ${label}` : `Show ${label}`} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}>{shown ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
        <button type="button" className="admin-button admin-button--secondary" onClick={() => { onChange(generate()); setShown(true); }} title="Make a strong random one">
          <Wand2 size={14} aria-hidden /> Generate
        </button>
      </div>
    </label>
  );
}

function ConnectionForm({ providers, existing, onDone }: { providers: DeviceProvider[]; existing: DeviceConnection | null; onDone: () => void }) {
  const client = useQueryClient();
  const [providerKey, setProviderKey] = useState(existing?.providerKey ?? providers.find((p) => p.mode !== 'MOBILE')?.key ?? providers[0]?.key ?? '');
  const provider = providers.find((p) => p.key === providerKey);
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [biometrics, setBiometrics] = useState<Biometric[]>(existing?.biometrics ?? provider?.biometrics ?? []);
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>(Object.fromEntries(Object.entries(existing?.publicConfig ?? {}).map(([k, v]) => [k, String(v)])));
  const [apiKey, setApiKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [serials, setSerials] = useState((existing?.deviceSerials ?? []).join(', '));
  const [created, setCreated] = useState<{ key: string; token: string; mode: ConnectionMode } | null>(null);
  const secure = provider ? needsCredentials(provider.mode) : true;

  const save = useMutation({
    mutationFn: () => {
      const input: ConnectionInput = {
        providerKey, displayName: displayName.trim() || provider?.name || 'Attendance device', biometrics, publicConfig,
        secrets: { ...(apiKey ? { apiKey } : {}), ...(apiToken ? { apiToken } : {}) },
        deviceSerials: serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
      };
      return deviceApi.saveConnection(existing?.id ?? null, input);
    },
    onSuccess: () => {
      toast.success(existing ? 'Device connection updated. Test it again before turning it on.' : 'Device connection saved. Test it, then turn it on.');
      void client.invalidateQueries({ queryKey: ['attendance-devices'] });
      if (!existing && provider?.mode === 'DEVICE_PUSH') setCreated({ key: apiKey, token: apiToken, mode: provider.mode }); else onDone();
    },
    onError: (error) => toast.error(extractError(error, 'We could not save this connection. Please check the details.')),
  });

  const endpoint = `${runtimeConfig.apiBaseUrl.replace(/\/$/, '')}/attendance-events/ingest`;
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'));

  if (created) {
    return (
      <div style={{ padding: 16, border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, display: 'grid', gap: 10 }}>
        <strong style={{ color: '#0d4a47' }}>Connection saved. Give these to the device or its installer</strong>
        <span style={help}>The key and token are stored encrypted, so Vook cannot show them again. Copy them now.</span>
        {[['Send punches to', endpoint], ['API key (header X-API-Key)', created.key], ['API token (header Authorization: Bearer …)', created.token]].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}><small style={help}>{label}</small><code style={{ display: 'block', padding: '8px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, overflowWrap: 'anywhere' }}>{value}</code></div>
            <button type="button" className="admin-button admin-button--secondary" onClick={() => copy(value!)} aria-label={`Copy ${label}`}><Copy size={14} /></button>
          </div>
        ))}
        <button type="button" className="admin-button" onClick={onDone}>I have saved them</button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: 'grid', gap: 16, padding: 16, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
      <strong style={{ fontSize: 14 }}>{existing ? `Edit “${existing.displayName}”` : 'New device connection'}</strong>
      <label style={field}>Device provider
        <select className="admin-input" value={providerKey} disabled={Boolean(existing)} onChange={(e) => { const p = providers.find((x) => x.key === e.target.value); setProviderKey(e.target.value); setBiometrics(p?.biometrics ?? []); setPublicConfig({}); }}>
          {providers.map((p) => <option key={p.key} value={p.key}>{p.name} · {MODE_LABEL[p.mode]}</option>)}
        </select>
        {provider && <span style={help}>{provider.description} {MODE_HELP[provider.mode]}</span>}
      </label>
      <label style={field}>Connection name
        <input className="admin-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={provider?.name ?? 'e.g. Pune main gate'} />
      </label>
      {provider && provider.biometrics.length > 0 && <BiometricPicker allowed={provider.biometrics} value={biometrics} onChange={setBiometrics} />}
      {provider?.fields.map((f) => (
        <label key={f.key} style={field}>{f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}
          <input className="admin-input" value={publicConfig[f.key] ?? ''} onChange={(e) => setPublicConfig((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} />
        </label>
      ))}
      {secure && (
        <div style={{ display: 'grid', gap: 12, padding: 14, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <strong style={{ fontSize: 13 }}>API credentials</strong>
          <span style={help}>Required for every device. {provider?.mode === 'DEVICE_PUSH' ? 'Pick them yourself (or press Generate) and give the same pair to the device.' : 'Copy them from the vendor’s dashboard.'} They are stored encrypted and never shown again.</span>
          <SecretInput label="API key" value={apiKey} onChange={setApiKey} placeholder="At least 8 characters" generate={() => random('vk_', 12)} saved={Boolean(existing?.secretConfigured)} />
          <SecretInput label="API token" value={apiToken} onChange={setApiToken} placeholder="At least 16 characters" generate={() => random('vt_', 24)} saved={Boolean(existing?.secretConfigured)} />
        </div>
      )}
      <label style={field}>Device serial numbers <span style={help}>Optional. Only these devices will be accepted. Separate with commas.</span>
        <input className="admin-input" value={serials} onChange={(e) => setSerials(e.target.value)} placeholder="SN-1001, SN-1002" />
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="admin-button admin-button--secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="admin-button" disabled={save.isPending || !provider}>{save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Save connection'}</button>
      </div>
    </form>
  );
}

function ProviderForm({ existing, onDone }: { existing: DeviceProvider | null; onDone: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(existing?.name ?? '');
  const [key, setKey] = useState(existing?.key ?? '');
  const [mode, setMode] = useState<ConnectionMode>(existing?.mode ?? 'DEVICE_PUSH');
  const [biometrics, setBiometrics] = useState<Biometric[]>(existing?.biometrics ?? ['FACE', 'FINGERPRINT']);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [fields, setFields] = useState<Array<{ key: string; label: string; required: boolean }>>((existing?.fields ?? []).map(({ key: k, label, required }) => ({ key: k, label, required })));
  const autoKey = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const save = useMutation({
    mutationFn: () => {
      const input: ProviderInput = { key: key || autoKey(name), name: name.trim(), mode, biometrics: mode === 'MOBILE' ? [] : biometrics, description: description.trim(), fields: fields.filter((f) => f.label.trim()).map((f) => ({ ...f, key: f.key || f.label.replace(/[^a-zA-Z0-9]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase()) })) };
      return existing ? deviceApi.updateProvider(existing.key, input) : deviceApi.addProvider(input);
    },
    onSuccess: () => { toast.success(existing ? 'Provider updated.' : 'Provider added. You can now create connections for it.'); void client.invalidateQueries({ queryKey: ['attendance-devices'] }); onDone(); },
    onError: (error) => toast.error(extractError(error, 'We could not save this provider.')),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: 'grid', gap: 14, padding: 16, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
      <strong style={{ fontSize: 14 }}>{existing ? `Edit provider “${existing.name}”` : 'Add a device provider'}</strong>
      <label style={field}>Provider name <span style={{ color: '#dc2626' }}>*</span>
        <input className="admin-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme FacePro" />
      </label>
      {!existing && <label style={field}>Short code <span style={help}>Letters, numbers and underscores. Filled in for you; change it if you like.</span>
        <input className="admin-input" value={key || autoKey(name)} onChange={(e) => setKey(autoKey(e.target.value))} placeholder="ACME_FACEPRO" />
      </label>}
      <label style={field}>How does it connect?
        <select className="admin-input" value={mode} disabled={Boolean(existing)} onChange={(e) => setMode(e.target.value as ConnectionMode)}>
          {(Object.keys(MODE_LABEL) as ConnectionMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select>
        <span style={help}>{MODE_HELP[mode]}</span>
      </label>
      {mode !== 'MOBILE' && <BiometricPicker allowed={['FACE', 'FINGERPRINT']} value={biometrics} onChange={setBiometrics} />}
      <label style={field}>Short description <span style={help}>Optional. Helps your team pick the right provider.</span>
        <input className="admin-input" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Extra settings this vendor needs <span style={help}>(API key and API token are always included)</span></strong>
        {fields.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="admin-input" aria-label={`Setting ${i + 1} name`} value={f.label} onChange={(e) => setFields((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. Server address" />
            <label style={{ display: 'flex', gap: 6, fontSize: 12, whiteSpace: 'nowrap', alignItems: 'center' }}><input type="checkbox" checked={f.required} onChange={(e) => setFields((all) => all.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} style={{ accentColor: '#0d7470' }} /> Required</label>
            <button type="button" className="admin-button admin-button--secondary" onClick={() => setFields((all) => all.filter((_, j) => j !== i))} aria-label={`Remove setting ${i + 1}`}>Remove</button>
          </div>
        ))}
        <button type="button" className="admin-button admin-button--secondary" style={{ justifySelf: 'start' }} onClick={() => setFields((all) => [...all, { key: '', label: '', required: false }])}><Plus size={14} aria-hidden /> Add a setting</button>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="admin-button admin-button--secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="admin-button" disabled={save.isPending || !name.trim()}>{save.isPending ? 'Saving…' : existing ? 'Save provider' : 'Add provider'}</button>
      </div>
    </form>
  );
}

const NEW_PREFIX = 'new:';

/**
 * The one way to add a device brand. Pick a provider from the list (built in or added before) or type a new name,
 * then give the API key and token. Anything unusual (a server address, office software) appears only when it is needed.
 */
function SimpleSetup({ providers, onDone }: { providers: DeviceProvider[]; onDone: () => void }) {
  const client = useQueryClient();
  const [pick, setPick] = useState('');
  const existing = providers.find((p) => p.key === pick);
  const isNew = pick.startsWith(NEW_PREFIX);
  const name = isNew ? pick.slice(NEW_PREFIX.length) : existing?.name ?? '';
  const [biometrics, setBiometrics] = useState<Biometric[]>(['FACE', 'FINGERPRINT']);
  const [mode, setMode] = useState<ConnectionMode>('DEVICE_PUSH');
  const [extra, setExtra] = useState<Array<{ label: string; required: boolean }>>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [created, setCreated] = useState<{ key: string; token: string; name: string; push: boolean } | null>(null);

  const chosenMode = existing?.mode ?? mode;
  const allowed: Biometric[] = existing ? existing.biometrics : ['FACE', 'FINGERPRINT'];
  const reads = existing ? (biometrics.filter((b) => existing.biometrics.includes(b)).length ? biometrics.filter((b) => existing.biometrics.includes(b)) : existing.biometrics) : biometrics;
  const fields = existing ? existing.fields.filter((f) => !f.secret) : extra.filter((f) => f.label.trim()).map((f) => ({ key: f.label, label: f.label, required: f.required, placeholder: '' }));
  const ready = Boolean(pick) && apiKey.length >= 8 && apiToken.length >= 16 && (chosenMode === 'MOBILE' || reads.length > 0) && fields.every((f) => !f.required || (values[f.key] ?? '').trim());

  const save = useMutation({
    mutationFn: () => deviceApi.quickSetup(existing
      ? { providerKey: existing.key, biometrics: reads, publicConfig: values, secrets: { apiKey, apiToken } }
      : { name: name.trim(), biometrics: reads, mode, fields: extra.filter((f) => f.label.trim()), publicConfig: values, secrets: { apiKey, apiToken } }),
    onSuccess: () => { toast.success('Done. Every company can now add its devices of this type.'); void client.invalidateQueries({ queryKey: ['attendance-devices'] }); setCreated({ key: apiKey, token: apiToken, name, push: chosenMode === 'DEVICE_PUSH' }); },
    onError: (error) => toast.error(extractError(error, 'We could not save this. Please check the details.')),
  });
  const endpoint = `${runtimeConfig.apiBaseUrl.replace(/\/$/, '')}/attendance-events/ingest`;
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'));

  if (created) {
    const rows = created.push ? [['Send punches to', endpoint], ['API key (header X-API-Key)', created.key], ['API token (header Authorization: Bearer …)', created.token]] : [['API key', created.key], ['API token', created.token]];
    return (
      <div style={{ padding: 16, border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, display: 'grid', gap: 10 }}>
        <strong style={{ color: '#0d4a47' }}>{created.name} is ready for all companies</strong>
        <span style={help}>{created.push ? 'Give these to the device installer.' : 'Keep these safe.'} The key and token are stored securely and cannot be shown again, so copy them now.</span>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}><small style={help}>{label}</small><code style={{ display: 'block', padding: '8px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, overflowWrap: 'anywhere' }}>{value}</code></div>
            <button type="button" className="admin-button admin-button--secondary" onClick={() => copy(value!)} aria-label={`Copy ${label}`}><Copy size={14} /></button>
          </div>
        ))}
        <button type="button" className="admin-button" onClick={onDone}>I have saved them</button>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }} style={{ display: 'grid', gap: 16, padding: 16, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
      <div><strong style={{ fontSize: 14 }}>Add a device provider</strong><p style={{ ...help, margin: '4px 0 0' }}>Choose a provider, or add a new one. After this, every company can link its own machines of this brand by serial number.</p></div>
      <div style={field}>
        <label htmlFor="provider-pick">Provider name <span style={{ color: '#dc2626' }}>*</span></label>
        <CreatableSelect id="provider-pick" value={pick} onChange={(v) => { setPick(v); setValues({}); const p = providers.find((x) => x.key === v); if (p) setBiometrics(p.biometrics); }}
          options={[...(isNew ? [{ value: pick, label: name }] : []), ...providers.map((p) => ({ value: p.key, label: `${p.name} · ${p.biometrics.length === 2 ? 'Face + Fingerprint' : p.biometrics.length ? BIO_LABEL[p.biometrics[0]!] : 'Phone GPS'}` }))]}
          onCreate={async (n) => ({ value: `${NEW_PREFIX}${n.trim()}`, label: n.trim() })} canDelete={(v) => !v.startsWith(NEW_PREFIX)} onDelete={async (v) => { await deviceApi.removeProvider(v); await client.invalidateQueries({ queryKey: ['attendance-devices'] }); }} entityLabel="provider" placeholder="Choose a provider or add a new one" />
        <span style={help}>{existing ? existing.description || 'This provider already exists. You are adding its API key and token.' : isNew ? 'A new provider. It will be saved with the details below.' : 'The list shows providers that come with Vook and ones added before.'}</span>
      </div>
      {pick && chosenMode !== 'MOBILE' && (!existing || existing.biometrics.length > 1) && <BiometricPicker allowed={allowed} value={reads} onChange={setBiometrics} />}
      {fields.map((f) => (
        <label key={f.key} style={field}>{f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}
          <input className="admin-input" value={values[f.key] ?? ''} onChange={(e) => setValues((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} />
        </label>
      ))}
      {pick && <>
        <SecretInput label="API key" value={apiKey} onChange={setApiKey} placeholder="At least 8 characters" generate={() => random('vk_', 12)} saved={false} />
        <SecretInput label="API token" value={apiToken} onChange={setApiToken} placeholder="At least 16 characters" generate={() => random('vt_', 24)} saved={false} />
      </>}
      {isNew && (
        <details>
          <summary style={{ ...help, cursor: 'pointer' }}>This brand works differently? (optional)</summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <label style={field}>How does it send punches?
              <select className="admin-input" value={mode} onChange={(e) => setMode(e.target.value as ConnectionMode)}>
                {(Object.keys(MODE_LABEL) as ConnectionMode[]).filter((m) => m !== 'MOBILE').map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
              </select>
              <span style={help}>{MODE_HELP[mode]}</span>
            </label>
            {extra.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="admin-input" aria-label={`Extra setting ${i + 1}`} value={f.label} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. Server address" />
                <label style={{ display: 'flex', gap: 6, fontSize: 12, whiteSpace: 'nowrap', alignItems: 'center' }}><input type="checkbox" checked={f.required} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} style={{ accentColor: '#0d7470' }} /> Required</label>
                <button type="button" className="admin-button admin-button--secondary" onClick={() => setExtra((all) => all.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <button type="button" className="admin-button admin-button--secondary" style={{ justifySelf: 'start' }} onClick={() => setExtra((all) => [...all, { label: '', required: false }])}><Plus size={14} aria-hidden /> Add a setting this brand needs</button>
          </div>
        </details>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="admin-button admin-button--secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="admin-button" disabled={save.isPending || !ready}>{save.isPending ? 'Saving…' : 'Save and turn on'}</button>
      </div>
    </form>
  );
}

function AccessPanel({ connection, companies, onClose }: { connection: DeviceConnection; companies: Array<{ id: string; name: string; companyCode?: string }>; onClose: () => void }) {
  const client = useQueryClient();
  const [mode, setMode] = useState<'ALL' | 'SELECTED'>(connection.availability?.mode ?? 'ALL');
  const [chosen, setChosen] = useState<string[]>(connection.availability?.companyIds ?? []);
  const [text, setText] = useState('');
  const shown = companies.filter((c) => !text.trim() || `${c.name} ${c.companyCode ?? ''}`.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 60);
  const usage = connection.usage ?? [];
  const save = useMutation({
    mutationFn: () => deviceApi.setAvailability(connection.id, { mode, companyIds: mode === 'SELECTED' ? chosen : [] }),
    onSuccess: () => { toast.success(mode === 'ALL' ? 'Every company can use this provider.' : `Only ${chosen.length} chosen ${chosen.length === 1 ? 'company' : 'companies'} can use it. Affected companies were told.`); void client.invalidateQueries({ queryKey: ['attendance-devices'] }); onClose(); },
    onError: (error) => toast.error(extractError(error, 'We could not save this.')),
  });
  const ago = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'No punches yet');
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 14, padding: 14, margin: '4px 0 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Who can use “{connection.displayName}”?</strong>
        {(['ALL', 'SELECTED'] as const).map((m) => (
          <label key={m} style={{ display: 'flex', gap: 10, padding: '9px 12px', border: `1.5px solid ${mode === m ? '#0d7470' : '#e2e8f0'}`, background: mode === m ? '#f0fdfa' : 'white', borderRadius: 8, cursor: 'pointer' }}>
            <input type="radio" name={`avail-${connection.id}`} checked={mode === m} onChange={() => setMode(m)} style={{ accentColor: '#0d7470', marginTop: 3 }} />
            <span><strong style={{ fontSize: 13 }}>{m === 'ALL' ? 'All companies' : 'Only chosen companies'}</strong><span style={{ ...help, display: 'block' }}>{m === 'ALL' ? 'Every company on Vook can link its own machines of this brand.' : 'Only the companies you tick can see it and link machines. Others will not see it at all.'}</span></span>
          </label>
        ))}
        {mode === 'SELECTED' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <input className="admin-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search companies" aria-label="Search companies" />
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 2, padding: 4, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {shown.map((c) => <label key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: '#0d7470' }} checked={chosen.includes(c.id)} onChange={() => setChosen(chosen.includes(c.id) ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])} />{c.name}{c.companyCode && <span style={help}>{c.companyCode}</span>}</label>)}
              {!shown.length && <span style={{ ...help, padding: 8 }}>No company matches.</span>}
            </div>
            <span style={help}>{chosen.length} chosen. A company that already has machines and loses access is told, and its machines stop.</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="admin-button admin-button--secondary" onClick={onClose}>Close</button>
          <button type="button" className="admin-button" disabled={save.isPending || (mode === 'SELECTED' && !chosen.length)} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>Companies using it now</strong>
        {usage.length === 0 && <span style={help}>No company has linked a machine yet.</span>}
        {usage.map((u) => (
          <div key={u.companyId} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid #eef2f2', flexWrap: 'wrap' }}>
            <span>{u.companyName}</span>
            <span style={help}>{u.devices} {u.devices === 1 ? 'machine' : 'machines'} · {u.active} on · last punch: {ago(u.lastEventAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = { ACTIVE: 'success', ERROR: 'danger', TESTED: 'warning' };
const STATUS_TEXT: Record<string, string> = { DRAFT: 'Needs a test', TESTED: 'Ready to turn on', ACTIVE: 'On', ERROR: 'Test failed', DISABLED: 'Off' };

export default function AttendanceDevicesCard() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['attendance-devices'], queryFn: deviceApi.list });
  const providers = query.data?.providers ?? [];
  const connections = query.data?.connections ?? [];
  const [accessFor, setAccessFor] = useState<string | null>(null);
  const [form, setForm] = useState<{ kind: 'simple' } | { kind: 'connection'; existing: DeviceConnection | null } | { kind: 'provider'; existing: DeviceProvider | null } | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: ['attendance-devices'] });
  const providerName = useMemo(() => new Map(providers.map((p) => [p.key, p.name])), [providers]);

  const act = useMutation({
    mutationFn: ({ c, kind }: { c: DeviceConnection; kind: 'test' | 'activate' | 'disable' }) => deviceApi.act(c.id, kind),
    onSuccess: (_r, v) => { toast.success(v.kind === 'test' ? 'Test passed. You can turn it on now.' : v.kind === 'activate' ? 'Device connection is on.' : 'Device connection is off.'); void refresh(); },
    onError: (error) => { toast.error(extractError(error, 'That did not work. Please try again.')); void refresh(); },
  });
  const removeConnection = useMutation({ mutationFn: (c: DeviceConnection) => deviceApi.removeConnection(c.id), onSuccess: () => { toast.success('Connection removed.'); void refresh(); }, onError: (e) => toast.error(extractError(e, 'Could not remove it.')) });
  const removeProvider = useMutation({ mutationFn: (p: DeviceProvider) => deviceApi.removeProvider(p.key), onSuccess: () => { toast.success('Provider removed.'); void refresh(); }, onError: (e) => toast.error(extractError(e, 'Could not remove it.')) });

  return (
    <section className="admin-card attendance-connection-builder" aria-labelledby="attendance-devices-title">
      <header className="attendance-device-header">
        <div className="provider-icon"><Fingerprint size={18} /></div>
        <div><h2 id="attendance-devices-title">Attendance devices</h2><p>Add a device brand once with its API key and token. Every company can then link its own machines by serial number.</p></div>
        <span className="attendance-global-badge"><Globe2 size={13} /> Global</span>
      </header>

      {query.isLoading ? <TableSkeleton rows={3} cols={4} label="Loading devices" /> : (
        <>
          {form?.kind === 'simple' ? <SimpleSetup providers={providers} onDone={() => setForm(null)} /> : form?.kind === 'connection' ? <ConnectionForm key={form.existing?.id ?? 'new'} providers={providers} existing={form.existing} onDone={() => setForm(null)} /> : form?.kind === 'provider' ? <ProviderForm key={form.existing?.key ?? 'new'} existing={form.existing} onDone={() => setForm(null)} /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div><button type="button" className="admin-button" onClick={() => setForm({ kind: 'simple' })}><Plus size={14} aria-hidden /> Add a device provider</button></div>
            </div>
          )}

          <div className="attendance-connection-grid attendance-connection-grid--list" style={{ marginTop: 16 }}>
            {connections.map((c) => (
              <article className="attendance-device-row" key={c.id}>
                <div className="provider-icon">{c.biometrics.includes('FACE') && !c.biometrics.includes('FINGERPRINT') ? <ScanFace size={16} /> : <Fingerprint size={16} />}</div>
                <span style={{ minWidth: 0 }}>
                  <strong>{c.displayName}</strong>
                  <small>{providerName.get(c.providerKey) ?? c.providerKey} · {MODE_LABEL[c.connectionMode]}{c.deviceCount ? ` · ${c.deviceCount} device${c.deviceCount === 1 ? '' : 's'} in ${c.companyCount} compan${c.companyCount === 1 ? 'y' : 'ies'}` : ' · no devices linked yet'}{c.apiKeyHint ? ` · key ${c.apiKeyHint}` : ''}</small>
                  <span style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}><Chips biometrics={c.biometrics} mode={c.connectionMode} /></span>
                  {c.status === 'ERROR' && <small style={{ color: '#b91c1c' }}>The last test failed. Check the address, key and token.</small>}
                  {needsCredentials(c.connectionMode) && !c.secretConfigured && <small style={{ color: '#b45309' }}>API key and token are missing. Edit and add them.</small>}
                </span>
                <span className={`admin-status ${STATUS_TONE[c.status] ?? 'neutral'}`}>{STATUS_TEXT[c.status] ?? statusLabel(c.status)}</span>
                <div className="attendance-device-row__actions">
                  <button className="admin-button admin-button--secondary" onClick={() => setAccessFor(accessFor === c.id ? null : c.id)}>{c.availability?.mode === 'SELECTED' ? `${c.availability.companyIds.length} companies` : 'All companies'} ▾</button>
                  <button className="admin-button admin-button--secondary" onClick={() => setForm({ kind: 'connection', existing: c })}>Edit</button>
                  <button className="admin-button admin-button--secondary" disabled={act.isPending || (needsCredentials(c.connectionMode) && !c.secretConfigured)} onClick={() => act.mutate({ c, kind: 'test' })}>Test</button>
                  {c.status === 'ACTIVE'
                    ? <button className="admin-button admin-button--secondary" disabled={act.isPending} onClick={() => act.mutate({ c, kind: 'disable' })}>Turn off</button>
                    : <button className="admin-button" disabled={act.isPending || c.status !== 'TESTED'} onClick={() => act.mutate({ c, kind: 'activate' })}>Turn on</button>}
                  <button className="admin-button admin-button--danger" disabled={removeConnection.isPending} onClick={() => { if (window.confirm(`Remove “${c.displayName}”? Devices using it will stop sending punches.`)) removeConnection.mutate(c); }}>Remove</button>
                </div>
                {accessFor === c.id && <AccessPanel connection={c} companies={query.data?.companies ?? []} onClose={() => setAccessFor(null)} />}
              </article>
            ))}
            {!connections.length && <p className="notice-muted">No device is connected yet. Press “Add device connection” to start. Each one needs an API key and token.</p>}
          </div>

          <details className="attendance-device-saved" style={{ marginTop: 16 }}>
            <summary>Supported providers <span>{providers.length}</span><ChevronDown size={15} /></summary>
            <div className="attendance-connection-grid">
              {providers.map((p) => (
                <article className="attendance-device-row" key={p.key}>
                  <div className="provider-icon"><Fingerprint size={16} /></div>
                  <span style={{ minWidth: 0 }}><strong>{p.name}</strong><small>{MODE_LABEL[p.mode]} · {p.builtIn ? 'Comes with Vook' : 'Added by you'}</small><span style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}><Chips biometrics={p.biometrics} mode={p.mode} /></span></span>
                  <span />
                  <div className="attendance-device-row__actions">
                    {!p.builtIn && <>
                      <button className="admin-button admin-button--secondary" onClick={() => setForm({ kind: 'provider', existing: p })}>Edit</button>
                      <button className="admin-button admin-button--danger" disabled={removeProvider.isPending} onClick={() => { if (window.confirm(`Remove provider “${p.name}”?`)) removeProvider.mutate(p); }}>Remove</button>
                    </>}
                  </div>
                </article>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
