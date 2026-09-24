import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type LeaveRequest } from '../../api/hr';
import { Search, CheckCircle2, XCircle, Clock, CalendarDays, Loader2, Plus, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { extractError } from '../../utils/errorUtils';
import { useLeaves } from '../../hooks/queries/useHrQueries';
import { useUpdateLeave } from '../../hooks/mutations/useHrMutations';
import LegacyDrawer from '../../components/ui/LegacyDrawer';
import { useAccess } from '../../hooks/queries/useAccess';
import { useApplyLeave } from '../../hooks/mutations/useEmployeeMutations';
import { useMyLeaves } from '../../hooks/queries/useEmployeeQueries';
import { useAuthStore } from '../../store/authStore';
import { ErrorState, LoadingState } from '../../components/ui/ProductPrimitives';

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Pending:  { bg: '#fef9c3', color: '#854d0e' },
  Approved: { bg: '#dcfce7', color: '#15803d' },
  Rejected: { bg: '#fee2e2', color: '#b91c1c' },
};

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Annual Leave', 'Maternity Leave', 'Emergency Leave'];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
  { bg: '#f0f9ff', color: '#0ea5e9' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'H').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const displayStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

function DetailModal({ leave, onClose, onAction, canApprove, canReject }: { leave: LeaveRequest; onClose: () => void; onAction: (id: string, status: string) => void; canApprove: boolean; canReject: boolean }) {
  const status = displayStatus(leave.status);
  const sm = STATUS_META[status] ?? STATUS_META['Pending']!;
  const av = getAv(leave.employee.user.name);
  return (
    <LegacyDrawer open onClose={onClose} direction="right" className="legacy-detail-drawer">
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', background: 'linear-gradient(135deg, #0d4a47, #0d7470)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '11px' }}>{initials(leave.employee.user.name)}</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{leave.employee.user.name}</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{leave.employee.employeeId} • {leave.employee.department}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{status}</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569' }}>{leave.leaveType}</span>
          </div>
          {[
            ['Leave Type', leave.leaveType],
            ['Duration', `${fmtDate(leave.startDate)} → ${fmtDate(leave.endDate)} (${leave.days} day${leave.days > 1 ? 's' : ''})`],
            ['Reason', leave.reason ?? '—'],
            ['Applied On', fmtDate(leave.createdAt)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>{k as string}</p>
              <p style={{ fontSize: '13px', color: '#0f172a' }}>{v as string}</p>
            </div>
          ))}
        </div>
        {leave.status.toUpperCase() === 'PENDING' && (canApprove || canReject) && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {canReject && <button onClick={() => { onAction(leave.id, 'Rejected'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', border: '1.5px solid #fecaca', borderRadius: '8px', backgroundColor: 'white', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <XCircle size={14} /> Reject
            </button>}
            {canApprove && <button onClick={() => { onAction(leave.id, 'Approved'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <CheckCircle2 size={14} /> Approve
            </button>}
          </div>
        )}
      </div>
    </LegacyDrawer>
  );
}

export default function LeaveManagementPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isEmployee = role === 'EMPLOYEE';
  const access = useAccess();
  const canCreate = isEmployee && access.can('LEAVE_MANAGEMENT.CREATE');
  const canApprove = access.can('LEAVE_MANAGEMENT.APPROVE');
  const canReject = access.can('LEAVE_MANAGEMENT.REJECT');
  const [urlParams, setUrlParams] = useSearchParams();
  const search = urlParams.get('search') ?? '';
  const statusFilter = urlParams.get('status') ?? 'ALL';
  const typeFilter = urlParams.get('leaveType') ?? 'ALL';
  const page = Math.max(1, Number(urlParams.get('page') ?? '1') || 1);
  const limit = 20;
  const [viewLeave, setViewLeave] = useState<LeaveRequest | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter !== 'ALL') params.status = statusFilter;
  if (typeFilter !== 'ALL') params.leaveType = typeFilter;

  const { data, isLoading: loading } = useLeaves(params);
  const leaves: LeaveRequest[] = data?.leaves ?? [];
  const stats = data?.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const updateLeave = useUpdateLeave();
  const applyLeave = useApplyLeave();
  const ownLeaveQuery = useMyLeaves(isEmployee);
  const requestedDays = createForm.startDate && createForm.endDate && createForm.endDate >= createForm.startDate
    ? Math.floor((new Date(createForm.endDate).getTime() - new Date(createForm.startDate).getTime()) / 86_400_000) + 1
    : 0;
  const selectedBalance = ownLeaveQuery.data?.balance.find((balance) => createForm.leaveType.toLowerCase().startsWith(balance.type.toLowerCase()));

  const updateUrl = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(urlParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setUrlParams(next, { replace: true });
  };
  const handleSearchChange = (v: string) => updateUrl({ search: v || null, page: '1' });
  const handleStatusChange = (v: string) => updateUrl({ status: v === 'ALL' ? null : v, page: '1' });
  const handleTypeChange   = (v: string) => updateUrl({ leaveType: v === 'ALL' ? null : v, page: '1' });

  const handleAction = (id: string, status: string) => {
    updateLeave.mutate({ id, status }, {
      onSuccess: () => toast.success(`Leave ${status.toLowerCase()} successfully`),
      onError: (err) => toast.error(extractError(err, 'Failed to update leave')),
    });
  };

  const handleCreate = () => {
    if (!createForm.startDate || !createForm.endDate || !createForm.reason.trim()) {
      setCreateError('Leave type, dates, and reason are required.');
      return;
    }
    if (createForm.endDate < createForm.startDate) {
      setCreateError('End date must be on or after the start date.');
      return;
    }
    setCreateError('');
    applyLeave.mutate(createForm, {
      onSuccess: () => {
        setShowCreate(false);
        setCreateForm({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
        toast.success('Leave request created successfully');
      },
      onError: (error) => setCreateError(extractError(error, 'Failed to create leave request')),
    });
  };

  const statCards = [
    { label: 'Total Requests', value: stats.total,    icon: CalendarDays,  color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Pending',        value: stats.pending,  icon: Clock,         color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Approved',       value: stats.approved, icon: CheckCircle2,  color: '#10b981', bg: '#f0fdf4' },
    { label: 'Rejected',       value: stats.rejected, icon: XCircle,       color: '#ef4444', bg: '#fef2f2' },
  ];

  const selectStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Leave Management</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Review and manage employee leave requests</p>
        </div>
        {canCreate && <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><Plus size={14} /> Create request</button>}
      </div>

      {isEmployee && (ownLeaveQuery.isLoading ? <LoadingState label="Loading leave balances…" /> : ownLeaveQuery.isError ? <ErrorState description="Your leave balances could not be loaded." onRetry={() => void ownLeaveQuery.refetch()} /> : <section className="leave-balance-panel" aria-labelledby="leave-balance-title">
        <div className="leave-balance-panel__heading"><div><h2 id="leave-balance-title">Your leave balances</h2><p>Balances include approved leave. Pending requests are shown separately.</p></div><Link to="/employee/calendar" className="admin-button ghost"><CalendarDays size={16} aria-hidden="true" /> Open team calendar</Link></div>
        <div className="leave-balance-grid">{ownLeaveQuery.data?.balance.map((balance) => { const pending = ownLeaveQuery.data.leaves.filter((leave) => leave.status === 'PENDING' && leave.leaveType.toLowerCase().startsWith(balance.type.toLowerCase())).reduce((total, leave) => total + leave.days, 0); return <article key={balance.type} className="leave-balance-card"><span>{balance.type}</span><strong>{balance.remaining} days</strong><small>{balance.used} used · {pending} pending · {Math.max(0, balance.remaining - pending)} projected</small><div aria-hidden="true"><span style={{ width: `${Math.min(100, (balance.remaining / Math.max(1, balance.total)) * 100)}%` }} /></div></article>; })}</div>
      </section>)}

      <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statCards.map((s) => (
          <div key={s.label} className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.label}</p><p style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>{s.value}</p></div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={19} color={s.color} /></div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ width: '100%', paddingLeft: '34px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <select value={typeFilter} onChange={(e) => handleTypeChange(e.target.value)} style={selectStyle}>
            <option value="ALL">All Types</option>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
            <option value="ALL">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee', 'Leave Type', 'Duration', 'Days', 'Status', 'Remaining', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => {
                  const status = displayStatus(l.status);
                  const sm = STATUS_META[status] ?? STATUS_META['Pending']!;
                  const av = getAv(l.employee.user.name);
                  return (
                    <tr key={l.id} onClick={() => setViewLeave(l)} style={{ borderBottom: i < leaves.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>{initials(l.employee.user.name)}</div>
                          <div><p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{l.employee.user.name}</p><p style={{ fontSize: '11px', color: '#94a3b8' }}>{l.employee.employeeId}</p></div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{l.leaveType}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{l.days}d</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{status}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>—</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {l.status.toUpperCase() === 'PENDING' && <>
                            {canApprove && <button aria-label={`Approve leave for ${l.employee.user.name}`} onClick={(e) => { e.stopPropagation(); void handleAction(l.id, 'Approved'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#15803d' }}><CheckCircle2 size={13} /></button>}
                            {canReject && <button aria-label={`Reject leave for ${l.employee.user.name}`} onClick={(e) => { e.stopPropagation(); void handleAction(l.id, 'Rejected'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#b91c1c' }}><XCircle size={13} /></button>}
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ResponsiveTable>
          </div>
        )}
      </div>
      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => updateUrl({ page: String(p) })} />
      {viewLeave && <DetailModal leave={viewLeave} onClose={() => setViewLeave(null)} onAction={(id, status) => handleAction(id, status)} canApprove={canApprove} canReject={canReject} />}
      {canCreate && showCreate && <LegacyDrawer open onClose={() => { setShowCreate(false); setCreateError(''); }} direction="right" className="legacy-form-drawer">
        <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '440px', maxWidth: '94vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><div><h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Create leave request</h3><p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>Submit a leave request for your own employee record.</p></div><button aria-label="Close create leave form" onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button></div>
          {createError && <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>{createError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Leave type<select value={createForm.leaveType} onChange={(event) => setCreateForm((current) => ({ ...current, leaveType: event.target.value }))} style={{ ...selectStyle, display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box' }}>{LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>From<input type="date" value={createForm.startDate} onChange={(event) => setCreateForm((current) => ({ ...current, startDate: event.target.value }))} style={{ ...selectStyle, display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>To<input type="date" value={createForm.endDate} onChange={(event) => setCreateForm((current) => ({ ...current, endDate: event.target.value }))} style={{ ...selectStyle, display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box' }} /></label>
            </div>
            {selectedBalance && <div className={`leave-projection${requestedDays > selectedBalance.remaining ? ' leave-projection--warning' : ''}`} role="status"><span>Projected balance</span><strong>{selectedBalance.remaining} − {requestedDays} = {selectedBalance.remaining - requestedDays} days</strong>{requestedDays > selectedBalance.remaining && <small>This request exceeds the available balance and may require an exception.</small>}</div>}
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Reason<textarea rows={4} value={createForm.reason} onChange={(event) => setCreateForm((current) => ({ ...current, reason: event.target.value }))} style={{ ...selectStyle, display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box', resize: 'vertical' }} /></label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}><button onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button><button onClick={handleCreate} disabled={applyLeave.isPending} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#0d7470', color: 'white', fontSize: '13px', fontWeight: 600, cursor: applyLeave.isPending ? 'not-allowed' : 'pointer', opacity: applyLeave.isPending ? 0.65 : 1 }}>{applyLeave.isPending ? 'Creating…' : 'Create request'}</button></div>
        </div>
      </LegacyDrawer>}
    </div>
  );
}
