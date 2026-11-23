import { useCallback, useEffect, useState } from 'react';
import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { registrationsApi, type RegistrationRow, type RegistrationStage } from '../../api/registrations';
import { extractError } from '../../utils/errorUtils';

const stageMeta: Record<RegistrationStage, { label: string; color: string; bg: string }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', color: '#a16207', bg: '#fef9c3' },
  CHECKOUT_PENDING: { label: 'Online checkout pending', color: '#475569', bg: '#f1f5f9' },
  TRIAL: { label: 'On trial', color: '#1d4ed8', bg: '#dbeafe' },
  ACTIVE: { label: 'Active', color: '#15803d', bg: '#dcfce7' },
  PAID: { label: 'Paid', color: '#15803d', bg: '#dcfce7' },
  FAILED: { label: 'Failed', color: '#b91c1c', bg: '#fee2e2' },
};
const th: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.3px' };
const btn = (primary: boolean): React.CSSProperties => ({ border: primary ? 0 : '1px solid #0d7470', borderRadius: 6, padding: '6px 10px', background: primary ? '#0d7470' : 'white', color: primary ? 'white' : '#0d7470', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 6 });

export default function RegistrationsPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await registrationsApi.list();
      setRows(data.registrations); setTrialDays(data.defaultTrialDays);
    } catch (reason) { setError(extractError(reason, 'Could not load registrations')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, task: () => Promise<unknown>, failure: string) => {
    setBusy(id);
    try { await task(); await load(); } catch (reason) { setError(extractError(reason, failure)); } finally { setBusy(''); }
  };
  const startTrial = (row: RegistrationRow) => {
    const input = window.prompt(`Start a free trial for ${row.companyName}?\nTrial length in days:`, String(trialDays || 14));
    if (input === null) return;
    const days = Number(input);
    if (!Number.isInteger(days) || days < 1 || days > 365) { setError('Enter trial days between 1 and 365.'); return; }
    void run(row.id, () => registrationsApi.startTrial(row.id, days), 'Could not start the trial');
  };
  const markPaid = (row: RegistrationRow) => {
    const reference = window.prompt(`Confirm payment received from ${row.companyName}${row.amount ? ` (₹${row.amount.toLocaleString('en-IN')})` : ''}.\nPayment reference (UTR / transaction ID):`);
    if (reference === null) return;
    void run(row.id, () => registrationsApi.markPaid(row.id, { reference: reference.trim() || undefined }), 'Could not activate this registration');
  };

  const shown = rows.filter((row) => filter === 'ALL' || row.stage === filter);
  const waiting = rows.filter((row) => row.stage === 'AWAITING_PAYMENT').length;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d4a47', margin: 0 }}>Registrations</h1>
      <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Companies that signed up. Start a free trial ({trialDays} days by default, change it in System settings) or confirm their payment to activate the plan. {waiting > 0 && <strong>{waiting} waiting for you.</strong>}</p>
    </div>
    {error && <div role="alert" style={{ padding: '11px 13px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{error}</div>}
    <div style={{ display: 'flex', gap: 9, padding: 12, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <select aria-label="Filter registrations" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ padding: '9px 11px', border: '1px solid #dbe5e4', borderRadius: 8, fontSize: 12, width: 210 }}>
        <option value="ALL">All registrations</option>
        {(Object.keys(stageMeta) as RegistrationStage[]).map((key) => <option key={key} value={key}>{stageMeta[key].label}</option>)}
      </select>
    </div>
    <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead><tr>{['Company', 'Admin', 'Plan', 'Amount', 'Status', 'Registered', 'Action'].map((heading) => <th key={heading} style={th}>{heading}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={7} style={{ padding: 0 }}><TableSkeleton rows={5} cols={6} label="Loading registrations" /></td></tr>
            : shown.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 45, color: '#64748b', fontSize: 13 }}>No registrations yet.</td></tr>
            : shown.map((row) => {
              const meta = stageMeta[row.stage] ?? stageMeta.PAID;
              const manualWaiting = row.stage === 'AWAITING_PAYMENT';
              return <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 650, color: '#0f172a' }}>{row.companyName}</td>
                <td style={{ padding: 14, fontSize: 12, color: '#475569' }}>{row.adminName}<span style={{ display: 'block', color: '#94a3b8', fontSize: 10 }}>{row.adminEmail}{row.adminMobile ? ` · ${row.adminMobile}` : ''}</span></td>
                <td style={{ padding: 14, fontSize: 12, color: '#475569' }}>{row.plan}<span style={{ display: 'block', color: '#94a3b8', fontSize: 10 }}>{row.billingCycle}</span></td>
                <td style={{ padding: 14, fontSize: 13, fontWeight: 700 }}>{row.amount == null ? '—' : `₹${row.amount.toLocaleString('en-IN')}`}</td>
                <td style={{ padding: 14 }}><span style={{ padding: '4px 8px', borderRadius: 99, color: meta.color, background: meta.bg, fontSize: 10, fontWeight: 750 }}>{meta.label}</span>{row.stage === 'TRIAL' && row.trialEndsAt && <span style={{ display: 'block', color: '#94a3b8', fontSize: 10, marginTop: 3 }}>until {new Date(row.trialEndsAt).toLocaleDateString('en-IN')}</span>}</td>
                <td style={{ padding: 14, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                <td style={{ padding: 14, whiteSpace: 'nowrap' }}>
                  {manualWaiting && <button disabled={busy === row.id} style={btn(false)} onClick={() => startTrial(row)}>Start trial</button>}
                  {(manualWaiting || (row.stage === 'TRIAL' && row.paymentStatus === 'PENDING')) && <button disabled={busy === row.id} style={btn(true)} onClick={() => markPaid(row)}>{busy === row.id ? 'Working…' : 'Mark paid & activate'}</button>}
                </td>
              </tr>;
            })}
        </tbody>
      </ResponsiveTable>
    </div>
  </div>;
}
