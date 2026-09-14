import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type LeaveRequest } from '../../api/hr';
import { Search, CheckCircle2, XCircle, Clock, CalendarDays, Loader2, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { extractError } from '../../utils/errorUtils';
import { useLeaves } from '../../hooks/queries/useHrQueries';
import { useUpdateLeave } from '../../hooks/mutations/useHrMutations';

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

function DetailModal({ leave, onClose, onAction }: { leave: LeaveRequest; onClose: () => void; onAction: (id: string, status: string) => void }) {
  const sm = STATUS_META[leave.status] ?? STATUS_META['Pending']!;
  const av = getAv(leave.employee.user.name);
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
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
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{leave.status}</span>
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
        {leave.status === 'Pending' && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => { onAction(leave.id, 'Rejected'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', border: '1.5px solid #fecaca', borderRadius: '8px', backgroundColor: 'white', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <XCircle size={14} /> Reject
            </button>
            <button onClick={() => { onAction(leave.id, 'Approved'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <CheckCircle2 size={14} /> Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaveManagementPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const search = urlParams.get('search') ?? '';
  const statusFilter = urlParams.get('status') ?? 'ALL';
  const typeFilter = urlParams.get('leaveType') ?? 'ALL';
  const page = Math.max(1, Number(urlParams.get('page') ?? '1') || 1);
  const limit = 20;
  const [viewLeave, setViewLeave] = useState<LeaveRequest | null>(null);

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

  const statCards = [
    { label: 'Total Requests', value: stats.total,    icon: CalendarDays,  color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Pending',        value: stats.pending,  icon: Clock,         color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Approved',       value: stats.approved, icon: CheckCircle2,  color: '#10b981', bg: '#f0fdf4' },
    { label: 'Rejected',       value: stats.rejected, icon: XCircle,       color: '#ef4444', bg: '#fef2f2' },
  ];

  const selectStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Leave Management</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Review and manage employee leave requests</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee', 'Leave Type', 'Duration', 'Days', 'Status', 'Remaining', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => {
                  const sm = STATUS_META[l.status] ?? STATUS_META['Pending']!;
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
                      <td style={{ padding: '12px 18px' }}><span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{l.status}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>—</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {l.status === 'Pending' && <>
                            <button onClick={(e) => { e.stopPropagation(); void handleAction(l.id, 'Approved'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#15803d' }}><CheckCircle2 size={13} /></button>
                            <button onClick={(e) => { e.stopPropagation(); void handleAction(l.id, 'Rejected'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#b91c1c' }}><XCircle size={13} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => updateUrl({ page: String(p) })} />
      {viewLeave && <DetailModal leave={viewLeave} onClose={() => setViewLeave(null)} onAction={(id, status) => handleAction(id, status)} />}
    </div>
  );
}
