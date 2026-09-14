import { useState } from 'react';
import { toast } from 'sonner';
import { type Approval } from '../../api/hr';
import { type Expense } from '../../api/finance';
import { Check, X, Loader2 } from 'lucide-react';
import { extractError } from '../../utils/errorUtils';
import { useApprovals } from '../../hooks/queries/useHrQueries';
import { useFinanceExpenses } from '../../hooks/queries/useFinanceQueries';
import { useUpdateApproval } from '../../hooks/mutations/useHrMutations';
import { useFinanceUpdateExpense } from '../../hooks/mutations/useFinanceMutations';

type StatusTab = 'pending' | 'approved' | 'rejected';
type SubTab = 'leave' | 'expense' | 'correction';

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  Pending:  { bg: '#fff7ed', color: '#d97706', label: 'Pending' },
  Approved: { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' },
  Rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function EmpAvatar({ name }: { name: string }) {
  const ini = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0d7470', flexShrink: 0 }}>{ini}</div>
  );
}

export default function CAApprovalsPage() {
  const [tab, setTab] = useState<StatusTab>('pending');
  const [sub, setSub] = useState<SubTab>('leave');

  const { data: leavesData,      isLoading: leavesLoading      } = useApprovals({ type: 'Leave', limit: '50' });
  const { data: correctionsData, isLoading: correctionsLoading } = useApprovals({ type: 'Attendance Corrections', limit: '50' });
  const { data: expensesData,    isLoading: expensesLoading    } = useFinanceExpenses({ limit: '50' });

  const updateApproval = useUpdateApproval();
  const updateExpense  = useFinanceUpdateExpense();

  const leaves      = leavesData?.approvals      ?? [];
  const corrections = correctionsData?.approvals ?? [];
  const expenses    = expensesData?.expenses      ?? [];

  const loading = leavesLoading || correctionsLoading || expensesLoading;

  const statusMatch = (s: string) => {
    if (tab === 'pending')  return s === 'Pending';
    if (tab === 'approved') return s === 'Approved';
    return s === 'Rejected';
  };

  const filteredLeaves      = leaves.filter((r) => statusMatch(r.status));
  const filteredCorrections = corrections.filter((r) => statusMatch(r.status));
  const filteredExpenses    = expenses.filter((e) => statusMatch(e.status));

  const allPending  = leaves.filter((r) => r.status === 'Pending').length
                    + corrections.filter((r) => r.status === 'Pending').length
                    + expenses.filter((e) => e.status === 'Pending').length;
  const allApproved = leaves.filter((r) => r.status === 'Approved').length
                    + corrections.filter((r) => r.status === 'Approved').length
                    + expenses.filter((e) => e.status === 'Approved').length;
  const allRejected = leaves.filter((r) => r.status === 'Rejected').length
                    + corrections.filter((r) => r.status === 'Rejected').length
                    + expenses.filter((e) => e.status === 'Rejected').length;
  const allTotal    = leaves.length + corrections.length + expenses.length;

  const handleApprovalAction = (id: string, newStatus: 'Approved' | 'Rejected') => {
    updateApproval.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => { toast.success(`${newStatus} successfully`); },
        onError: (err) => { toast.error(extractError(err, 'Failed to update approval')); },
      },
    );
  };

  const handleExpenseAction = (id: string, newStatus: 'Approved' | 'Rejected') => {
    updateExpense.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => { toast.success(`Expense ${newStatus.toLowerCase()}`); },
        onError: (err) => { toast.error(extractError(err, 'Failed to update expense')); },
      },
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', gap: '10px', color: '#64748b' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px' }}>Loading approvals...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Approvals</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Review and manage leave, expense, and attendance correction requests.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Requests',    value: allTotal,    color: '#0d7470' },
          { label: 'Pending Review',    value: allPending,  color: '#d97706' },
          { label: 'Approved',          value: allApproved, color: '#16a34a' },
          { label: 'Rejected',          value: allRejected, color: '#dc2626' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
            <p style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {(['pending', 'approved', 'rejected'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? 'white' : 'transparent', color: tab === t ? '#0d4a47' : '#64748b', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0' }}>
        {([
          { key: 'leave',      label: `Leave Requests (${filteredLeaves.length})` },
          { key: 'expense',    label: `Expense Claims (${filteredExpenses.length})` },
          { key: 'correction', label: `Attendance Corrections (${filteredCorrections.length})` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSub(key)} style={{ padding: '8px 12px', border: 'none', borderBottom: sub === key ? '2px solid #0d7470' : '2px solid transparent', backgroundColor: 'transparent', color: sub === key ? '#0d4a47' : '#64748b', fontSize: '12px', fontWeight: sub === key ? 700 : 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: '-1px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Leave */}
        {sub === 'leave' && filteredLeaves.length === 0 && (
          <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No {tab} leave requests.</p>
        )}
        {sub === 'leave' && filteredLeaves.map((r: Approval) => {
          const sc = STATUS_PILL[r.status] ?? STATUS_PILL.Pending!;
          return (
            <div key={r.id} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                <EmpAvatar name={r.employee.user.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{r.employee.user.name}</p>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{r.employee.employeeId}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#374151', marginTop: '3px' }}>{r.type}</p>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>"{r.details}"</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Applied: {fmtDate(r.createdAt)}</p>
                </div>
              </div>
              {r.status === 'Pending' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleApprovalAction(r.id, 'Approved')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0d7470', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><Check size={11} /> Approve</button>
                  <button onClick={() => handleApprovalAction(r.id, 'Rejected')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: 'white', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><X size={11} /> Reject</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Expenses */}
        {sub === 'expense' && filteredExpenses.length === 0 && (
          <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No {tab} expense requests.</p>
        )}
        {sub === 'expense' && filteredExpenses.map((e: Expense) => {
          const sc = STATUS_PILL[e.status] ?? STATUS_PILL.Pending!;
          return (
            <div key={e.id} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                <EmpAvatar name={e.employee.user.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{e.employee.user.name}</p>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{e.employee.employeeId}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: '#eff6ff', color: '#2563eb' }}>{e.category}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#0d7470', fontWeight: 700, marginTop: '3px' }}>₹{e.amount.toLocaleString('en-IN')}</p>
                  {e.description && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', fontStyle: 'italic' }}>"{e.description}"</p>}
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Applied: {fmtDate(e.createdAt)}</p>
                </div>
              </div>
              {e.status === 'Pending' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleExpenseAction(e.id, 'Approved')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0d7470', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><Check size={11} /> Approve</button>
                  <button onClick={() => handleExpenseAction(e.id, 'Rejected')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: 'white', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><X size={11} /> Reject</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Corrections */}
        {sub === 'correction' && filteredCorrections.length === 0 && (
          <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No {tab} correction requests.</p>
        )}
        {sub === 'correction' && filteredCorrections.map((r: Approval) => {
          const sc = STATUS_PILL[r.status] ?? STATUS_PILL.Pending!;
          return (
            <div key={r.id} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                <EmpAvatar name={r.employee.user.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{r.employee.user.name}</p>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{r.employee.employeeId}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#374151', marginTop: '3px' }}>{r.type}</p>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>"{r.details}"</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Applied: {fmtDate(r.createdAt)}</p>
                </div>
              </div>
              {r.status === 'Pending' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleApprovalAction(r.id, 'Approved')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0d7470', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><Check size={11} /> Approve</button>
                  <button onClick={() => handleApprovalAction(r.id, 'Rejected')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: 'white', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><X size={11} /> Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
