import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type AttendanceRecord, type AttendanceRegularizationReview } from '../../api/hr';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { Users, UserCheck, UserX, Clock, Loader2, X, Plus, Search, LockKeyhole } from 'lucide-react';
import { extractError } from '../../utils/errorUtils';
import { useAttendanceRegularizations, useHrAttendance, useAttendancePeriod, useAttendanceRecords, useEmployees } from '../../hooks/queries/useHrQueries';
import { useAttendanceRegularizationAction, useCreateAttendance, useLockAttendancePeriod } from '../../hooks/mutations/useHrMutations';
import LegacyDrawer from '../../components/ui/LegacyDrawer';
import { useAccess } from '../../hooks/queries/useAccess';
import { useAuthStore } from '../../store/authStore';
import { useMyRegularizations } from '../../hooks/queries/useEmployeeQueries';
import { useRequestRegularization } from '../../hooks/mutations/useEmployeeMutations';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../../components/ui/ProductPrimitives';
import AppDialog from '../../components/ui/AppDialog';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Present: { bg: '#f0fdf4', color: '#15803d' },
  Late:    { bg: '#fff7ed', color: '#c2410c' },
  Absent:  { bg: '#fef2f2', color: '#b91c1c' },
  Leave:   { bg: '#eff6ff', color: '#1d4ed8' },
  Holiday: { bg: '#f5f3ff', color: '#7c3aed' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (t: string | null) => t ? t : '—';

// ── Manual Entry Modal ────────────────────────────────────────────────────────

function AddRecordModal({ onClose }: { onClose: () => void }) {
  const [error, setError]           = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn]       = useState('');
  const [checkOut, setCheckOut]     = useState('');
  const [status, setStatus]         = useState('Present');
  const [notes, setNotes]           = useState('');

  const { data: empData, isLoading: empLoading } = useEmployees({ limit: '200' });
  const employees = empData?.employees ?? [];
  const createAttendance = useCreateAttendance();
  const saving = createAttendance.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { setError('Please select an employee'); return; }
    setError('');
    createAttendance.mutate({
      employeeId,
      date,
      checkIn:  checkIn  || undefined,
      checkOut: checkOut || undefined,
      status,
      notes: notes || undefined,
    }, {
      onSuccess: () => { toast.success('Attendance recorded'); onClose(); },
      onError: (err: unknown) => setError(extractError(err, 'Something went wrong')),
    });
  };

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a', backgroundColor: 'white', boxSizing: 'border-box' };

  return (
    <LegacyDrawer open onClose={onClose} direction="right" className="legacy-form-drawer">
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Add Attendance Record</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Manually mark attendance for an employee</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Employee *</label>
              {empLoading ? (
                <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
              ) : (
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.name} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Date *</label>
              <input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Status *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Present', 'Late', 'Absent', 'Leave', 'Holiday'].map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} style={{ padding: '5px 14px', border: `2px solid ${status === s ? '#0d7470' : '#e2e8f0'}`, borderRadius: '20px', backgroundColor: status === s ? '#f0fafa' : 'white', color: status === s ? '#0d7470' : '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Check In (HH:MM)</label>
              <input type="time" style={inp} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Check Out (HH:MM)</label>
              <input type="time" style={inp} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Notes</label>
            <input style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Save Record
            </button>
          </div>
        </form>
      </div>
    </LegacyDrawer>
  );
}

function EmployeeRegularizationPanel() {
  const query = useMyRegularizations();
  const mutation = useRequestRegularization();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), requestedCheckIn: '', requestedCheckOut: '', reason: '' });
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date || !form.reason.trim() || (!form.requestedCheckIn && !form.requestedCheckOut)) { setError('Choose a date, enter the corrected punch time, and explain the reason.'); return; }
    setError('');
    mutation.mutate({ ...form, requestedCheckIn: form.requestedCheckIn || undefined, requestedCheckOut: form.requestedCheckOut || undefined }, { onSuccess: () => { toast.success('Regularization request submitted'); setForm({ date: new Date().toISOString().slice(0, 10), requestedCheckIn: '', requestedCheckOut: '', reason: '' }); }, onError: (requestError) => setError(extractError(requestError, 'Unable to submit regularization')) });
  };
  return <div className="regularization-layout">
    <form className="admin-card regularization-form" onSubmit={submit}><div><h2>Correct a missed punch</h2><p>Submit the time that should appear on your attendance record. Your approver will see the reason and history.</p></div>{error && <div className="product-error" role="alert">{error}</div>}<label className="admin-label">Attendance date<input className="admin-input" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><div className="regularization-form__times"><label className="admin-label">Correct check-in<input className="admin-input" type="time" value={form.requestedCheckIn} onChange={(event) => setForm({ ...form, requestedCheckIn: event.target.value })} /></label><label className="admin-label">Correct check-out<input className="admin-input" type="time" value={form.requestedCheckOut} onChange={(event) => setForm({ ...form, requestedCheckOut: event.target.value })} /></label></div><label className="admin-label">Reason<textarea className="admin-input" rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example: device was offline at the branch" /></label><button className="admin-button" disabled={mutation.isPending}>{mutation.isPending ? 'Submitting…' : 'Submit for approval'}</button></form>
    <section className="admin-card regularization-history"><div><h2>Request history</h2><p>Track the current workflow stage and decision.</p></div>{query.isLoading ? <LoadingState label="Loading requests…" /> : query.isError ? <ErrorState description="Requests could not be loaded." onRetry={() => void query.refetch()} /> : !query.data?.regularizations.length ? <EmptyState title="No regularization requests" description="Submitted corrections will appear here with their approval status." /> : <div className="regularization-list">{query.data.regularizations.map((item) => <article key={item.id}><div><strong>{fmtDate(item.date)}</strong><StatusBadge status={item.status} /></div><p>{item.requestedCheckIn ? `In ${item.requestedCheckIn}` : 'Check-in unchanged'} · {item.requestedCheckOut ? `Out ${item.requestedCheckOut}` : 'Check-out unchanged'}</p><small>{item.reason}</small><span>{item.approvalStage.replaceAll('_', ' ').toLowerCase()}</span></article>)}</div>}</section>
  </div>;
}

function AttendanceExceptionInbox({ role, canApprove, canReject }: { role: string; canApprove: boolean; canReject: boolean }) {
  const query = useAttendanceRegularizations();
  const mutation = useAttendanceRegularizationAction();
  const [decision, setDecision] = useState<{ item: AttendanceRegularizationReview; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const expectedRole: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' };
  const canAct = (item: AttendanceRegularizationReview) => role === 'COMPANY_ADMIN' || expectedRole[item.approvalStage] === role;
  const submit = () => {
    if (!decision) return;
    if (decision.action === 'REJECT' && !comment.trim()) { setError('Add a reason before rejecting this correction.'); return; }
    setError('');
    mutation.mutate({ id: decision.item.id, action: decision.action, comment: comment.trim() }, { onSuccess: () => { toast.success(decision.action === 'APPROVE' ? 'Regularization moved to the next stage' : 'Regularization rejected'); setDecision(null); setComment(''); }, onError: (actionError) => setError(extractError(actionError, 'Unable to update this request')) });
  };
  return <section className="admin-card exception-inbox"><header><div><h2>Attendance exceptions</h2><p>Resolve missed-punch corrections in the configured approval sequence before locking attendance.</p></div><StatusBadge status={`${query.data?.regularizations.filter((item) => item.status === 'PENDING').length ?? 0}_PENDING`}>{query.data?.regularizations.filter((item) => item.status === 'PENDING').length ?? 0} pending</StatusBadge></header>{query.isLoading ? <LoadingState label="Loading attendance exceptions…" /> : query.isError ? <ErrorState description="Attendance exceptions could not be loaded." onRetry={() => void query.refetch()} /> : !query.data?.regularizations.length ? <EmptyState title="No attendance exceptions" description="Regularization requests will appear here for review." /> : <div className="exception-list">{query.data.regularizations.map((item) => { const actionable = item.status === 'PENDING' && canAct(item); return <article key={item.id}><div className="exception-list__identity"><strong>{item.employee.user.name}</strong><small>{item.employee.employeeId} · {item.employee.department ?? 'No department'}</small></div><div><strong>{fmtDate(item.date)}</strong><small>{item.requestedCheckIn ? `In ${item.requestedCheckIn}` : 'In unchanged'} · {item.requestedCheckOut ? `Out ${item.requestedCheckOut}` : 'Out unchanged'}</small></div><div><StatusBadge status={item.status} /><small>{item.approvalStage.replaceAll('_', ' ').toLowerCase()}</small></div><p>{item.reason}</p>{actionable && <div className="exception-list__actions">{canReject && <button className="admin-button admin-button--secondary" onClick={() => { setDecision({ item, action: 'REJECT' }); setComment(''); setError(''); }}>Reject</button>}{canApprove && <button className="admin-button" onClick={() => { setDecision({ item, action: 'APPROVE' }); setComment(''); setError(''); }}>Approve</button>}</div>}</article>; })}</div>}
    {decision && <AppDialog open onOpenChange={(open) => !open && setDecision(null)} title={`${decision.action === 'APPROVE' ? 'Approve' : 'Reject'} attendance correction`} description={`${decision.item.employee.user.name} · ${fmtDate(decision.item.date)}`} footer={<><button className="admin-button admin-button--secondary" onClick={() => setDecision(null)}>Cancel</button><button className="admin-button" disabled={mutation.isPending} onClick={submit}>{mutation.isPending ? 'Saving…' : decision.action === 'APPROVE' ? 'Approve and continue' : 'Reject request'}</button></>}><div className="product-form">{error && <div className="product-error" role="alert">{error}</div>}<div className="product-notice">Requested punch: {decision.item.requestedCheckIn || 'unchanged'} → {decision.item.requestedCheckOut || 'unchanged'}</div><label className="admin-label">Comment {decision.action === 'REJECT' ? '(required)' : '(optional)'}<textarea className="admin-input" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label></div></AppDialog>}
  </section>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const role = useAuthStore((state) => state.user?.role);
  const isEmployee = role === 'EMPLOYEE';
  const access = useAccess();
  const canCreate = !isEmployee && access.can('ATTENDANCE.CREATE');
  const canApproveRegularization = access.can('ATTENDANCE.APPROVE');
  const canRejectRegularization = access.can('ATTENDANCE.REJECT');
  const canReviewRegularizations = !isEmployee && (canApproveRegularization || canRejectRegularization);
  const [urlParams, setUrlParams] = useSearchParams();
  const requestedTab = urlParams.get('tab');
  const tab = requestedTab === 'records' || ((isEmployee || canReviewRegularizations) && requestedTab === 'regularization') ? requestedTab : 'overview';
  const page = Math.max(1, Number(urlParams.get('page') ?? '1') || 1);
  const search = urlParams.get('search') ?? '';
  const monthFilter = urlParams.get('month') ?? String(new Date().getMonth() + 1);
  const yearFilter = urlParams.get('year') ?? String(new Date().getFullYear());
  const debouncedSearch = useDebouncedValue(search, 500);
  const [showAddModal, setShowAddModal] = useState(false);

  const updateUrl = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(urlParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setUrlParams(next, { replace: true });
  };

  const { data: overviewData, isLoading: overviewLoading } = useHrAttendance();
  const periodQuery = useAttendancePeriod(Number(monthFilter), Number(yearFilter));
  const lockPeriod = useLockAttendancePeriod();

  const recordParams: Record<string, string> = { page: String(page), limit: '20', month: monthFilter, year: yearFilter };
  if (debouncedSearch) recordParams.search = debouncedSearch;
  const { data: recordsData, isLoading: recordsLoading } = useAttendanceRecords(tab === 'records' ? recordParams : undefined);
  const records: AttendanceRecord[] = recordsData?.records ?? [];
  const pagination = recordsData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => updateUrl({ search: v || null, page: '1' });
  const handleLockPeriod = () => {
    if (!periodQuery.data || periodQuery.data.status === 'LOCKED') return;
    if (!window.confirm(`Lock attendance for ${MONTHS[Number(monthFilter) - 1]} ${yearFilter}? Payroll can use this period after locking, and attendance changes should require an authorized correction.`)) return;
    lockPeriod.mutate({ month: Number(monthFilter), year: Number(yearFilter), version: periodQuery.data.version }, { onSuccess: () => toast.success('Attendance period locked for payroll'), onError: (error) => toast.error(extractError(error, 'Unable to lock attendance period')) });
  };

  const s = overviewData?.stats;
  const statCards = [
    { label: 'Total Workforce', value: s?.totalWorkforce ?? 0, sub: `${s?.perm ?? 0} Perm | ${s?.cont ?? 0} Cont`, icon: Users,     color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Present Today',   value: s?.presentToday ?? 0,   sub: `${s?.presentPct ?? 0}% of total`,              icon: UserCheck, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Absent',          value: s?.absent ?? 0,          sub: `${s?.absentPct ?? 0}% impact`,                 icon: UserX,     color: '#ef4444', bg: '#fef2f2' },
    { label: 'Late Arrivals',   value: s?.lateArrivals ?? 0,    sub: 'Checked in after 09:00',                       icon: Clock,     color: '#f59e0b', bg: '#fffbeb' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Attendance</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Company-wide attendance overview and daily records</p>
        </div>
        {tab === 'records' && !isEmployee && <div className="attendance-period-actions"><StatusBadge status={periodQuery.data?.status ?? 'OPEN'}>{periodQuery.data?.status === 'LOCKED' ? 'Attendance locked' : 'Attendance open'}</StatusBadge>{canCreate && periodQuery.data?.status !== 'LOCKED' && <><button className="admin-button admin-button--secondary" disabled={lockPeriod.isPending || periodQuery.isLoading} onClick={handleLockPeriod}><LockKeyhole size={15} aria-hidden="true" /> {lockPeriod.isPending ? 'Locking…' : 'Lock period'}</button><button className="admin-button" onClick={() => setShowAddModal(true)}><Plus size={15} aria-hidden="true" /> Add record</button></>}</div>}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {[['overview', 'Overview'], ['records', 'Daily Records'], ...((isEmployee || canReviewRegularizations) ? [['regularization', isEmployee ? 'Regularization' : 'Exceptions']] : [])].map(([key, label]) => (
          <button key={key} onClick={() => updateUrl({ tab: key === 'overview' ? null : key, page: '1' })} style={{ padding: '8px 18px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === key ? '#0d7470' : 'transparent', color: tab === key ? 'white' : '#64748b', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>

      {tab === 'regularization' && isEmployee && <EmployeeRegularizationPanel />}
      {tab === 'regularization' && canReviewRegularizations && <AttendanceExceptionInbox role={role ?? ''} canApprove={canApproveRegularization} canReject={canRejectRegularization} />}

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', gap: '10px', color: '#64748b' }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span>
            </div>
          ) : (
            <>
              <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {statCards.map((sc) => (
                  <div key={sc.label} className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{sc.label}</p>
                        <p style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{sc.value.toLocaleString()}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sc.sub}</p>
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <sc.icon size={18} color={sc.color} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>Department-wise Attendance</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(overviewData?.departments ?? []).map((dept) => (
                    <div key={dept.department}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{dept.department}</span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{dept.present}/{dept.total} present</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d7470' }}>{dept.percentage}%</span>
                        </div>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${dept.percentage}%`, backgroundColor: '#0d7470', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                  {(overviewData?.departments ?? []).length === 0 && (
                    <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No attendance records for today yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Records Tab ── */}
      {tab === 'records' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {periodQuery.data?.status === 'LOCKED' && <div className="attendance-lock-notice"><LockKeyhole size={16} aria-hidden="true" /><span><strong>This period is locked.</strong> Payroll may consume this attendance snapshot; corrections require an audited regularization workflow.</span></div>}
          {/* Filters */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by employee name..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
            </div>
            <select value={monthFilter} onChange={(e) => updateUrl({ month: e.target.value, page: '1' })} style={{ padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={yearFilter} onChange={(e) => updateUrl({ year: e.target.value, page: '1' })} style={{ padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              {[new Date().getFullYear() - 1, new Date().getFullYear()].map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>

          {/* Table */}
          {recordsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading records...</span>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <UserCheck size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No attendance records for this period</p>
              <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>Use "Add Record" to create manual entries</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Date', 'Employee', 'Department', 'Check In', 'Check Out', 'Status', 'Source'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const sm = STATUS_STYLE[r.status] ?? STATUS_STYLE['Present']!;
                    const emp = r.employeeId;
                    return (
                      <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{emp?.userId?.name ?? '—'}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{emp?.employeeId ?? ''}</p>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#64748b' }}>{emp?.department ?? '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#374151' }}>{fmtTime(r.checkIn)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#374151' }}>{fmtTime(r.checkOut)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '11px', color: '#94a3b8' }}>{r.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </ResponsiveTable>
            </div>
          )}

          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onPageChange={(p) => updateUrl({ page: String(p) })} />
        </div>
      )}

      {canCreate && showAddModal && (
        <AddRecordModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
