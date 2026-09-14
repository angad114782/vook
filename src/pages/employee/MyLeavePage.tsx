import { useState } from 'react';
import { type MyLeave, type LeaveBalance } from '../../api/employee';
import { Loader2, Plus, X } from 'lucide-react';
import { extractError } from '../../utils/errorUtils';
import { useMyLeaves } from '../../hooks/queries/useEmployeeQueries';
import { useApplyLeave } from '../../hooks/mutations/useEmployeeMutations';

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Pending:  { bg: '#fef9c3', color: '#854d0e' },
  Approved: { bg: '#dcfce7', color: '#15803d' },
  Rejected: { bg: '#fef2f2', color: '#b91c1c' },
};

const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Optional'];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyLeavePage() {
  const [showApply, setShowApply] = useState(false);
  const [form, setForm]           = useState({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
  const [formError, setFormError] = useState('');

  const { data: leaveData, isLoading: loading } = useMyLeaves();
  const applyLeave = useApplyLeave();

  const leaves  = ((leaveData as { leaves?: MyLeave[] } | undefined)?.leaves   ?? []) as MyLeave[];
  const balance = ((leaveData as { balance?: LeaveBalance[] } | undefined)?.balance ?? []) as LeaveBalance[];

  const handleApply = () => {
    if (!form.startDate || !form.endDate || !form.reason) { setFormError('All fields are required'); return; }
    if (form.endDate < form.startDate) { setFormError('End date must be after start date'); return; }
    setFormError('');
    applyLeave.mutate(form, {
      onSuccess: () => {
        setShowApply(false);
        setForm({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
      },
      onError: (err) => setFormError(extractError(err, 'Failed to submit leave request')),
    });
  };

  const balanceColors = ['#0d7470', '#2563eb', '#ea580c', '#8b5cf6'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>My Leaves</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>View your leave balance and apply for new leaves</p>
        </div>
        <button onClick={() => setShowApply(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {balance.map((b, idx) => (
          <div key={b.type} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{b.type}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '8px 0' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: balanceColors[idx] ?? '#0d7470' }}>{b.remaining}</span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>/ {b.total}</span>
            </div>
            <div style={{ height: '5px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(b.remaining / b.total) * 100}%`, height: '100%', backgroundColor: balanceColors[idx] ?? '#0d7470', borderRadius: '3px' }} />
            </div>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '5px' }}>{b.used} used</p>
          </div>
        ))}
      </div>

      {/* Leave history */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Leave History</h3>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Leave Type', 'From', 'To', 'Days', 'Reason', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => {
                  const sm = STATUS_META[l.status] ?? STATUS_META['Pending']!;
                  return (
                    <tr key={l.id} style={{ borderBottom: i < leaves.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{l.leaveType} Leave</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(l.startDate)}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(l.endDate)}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{l.days}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b', maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason ?? '—'}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{l.status}</span></td>
                    </tr>
                  );
                })}
                {leaves.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No leave history found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApply && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '440px', maxWidth: '94vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Apply for Leave</h3>
              <button onClick={() => { setShowApply(false); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {formError && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>{formError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Leave Type</label>
                <select value={form.leaveType} onChange={(e) => setForm((p) => ({ ...p, leaveType: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', backgroundColor: 'white', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>From Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>To Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Reason</label>
                <textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} rows={3} placeholder="Briefly explain the reason for leave..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setShowApply(false); setFormError(''); }} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => handleApply()} disabled={applyLeave.isPending} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: applyLeave.isPending ? '#5fa8a5' : '#0d7470', color: 'white', fontSize: '13px', fontWeight: 600, cursor: applyLeave.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {applyLeave.isPending ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
