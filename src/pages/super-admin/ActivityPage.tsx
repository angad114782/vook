import { useState, useEffect } from 'react';
import { activityApi, type ActivityLog } from '../../api/activity';
import { useSaActivity } from '../../hooks/queries/useSaQueries';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  Activity, CheckCircle2, XCircle, Calendar,
  Search, X, ChevronLeft, ChevronRight,
  Loader2, Download, Shield, FileText, BarChart3,
  LogIn, Clock,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

const roleMeta: Record<string, { label: string; bg: string; color: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin',   bg: '#ede9fe', color: '#6d28d9' },
  COMPANY_ADMIN: { label: 'Company Admin', bg: '#fdf4ff', color: '#a21caf' },
  HR:            { label: 'HR',            bg: '#dbeafe', color: '#1d4ed8' },
  FINANCE:       { label: 'Finance',       bg: '#f0fdf4', color: '#15803d' },
  SUPERVISOR:    { label: 'Supervisor',    bg: '#fff7ed', color: '#c2410c' },
  MANAGER:       { label: 'Manager',       bg: '#fef9c3', color: '#854d0e' },
  EMPLOYEE:      { label: 'Employee',      bg: '#f1f5f9', color: '#475569' },
};

const moduleColors: Record<string, string> = {
  Auth:          '#6366f1',
  Companies:     '#0f766e',
  Subscriptions: '#7c3aed',
  Employees:     '#3b82f6',
  Attendance:    '#f59e0b',
  Leaves:        '#10b981',
  Approvals:     '#8b5cf6',
  Expenses:      '#ef4444',
  Documents:     '#0ea5e9',
  Payroll:       '#14b8a6',
  Shifts:        '#ec4899',
  Users:         '#64748b',
  Settings:      '#a16207',
  Support:       '#f97316',
};

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f5f3ff', color: '#8b5cf6' },
  { bg: '#f0f9ff', color: '#0ea5e9' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAvatarColor = (name?: string) => avatarColors[(name ?? 'A').charCodeAt(0) % avatarColors.length];
const initials = (name?: string) => (name ?? 'System').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const fmtTime = (d: string) => {
  const dt = new Date(d);
  return {
    time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    date: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
};

const fmtFull = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

// ── View Log Modal ────────────────────────────────────────────────────────────

function LogModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const rm = log.user ? roleMeta[log.user.role] : null;
  const modColor = log.module ? (moduleColors[log.module] ?? '#64748b') : '#64748b';
  const row = (label: string, value: string, highlight?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '13px', color: '#64748b', minWidth: '130px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: highlight ?? '#0f172a', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'linear-gradient(135deg, #0d4a47, #0d7470)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>Activity Detail</h2>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>{fmtFull(log.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Status badge */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: log.status === 'Success' ? '#dcfce7' : '#fee2e2', color: log.status === 'Success' ? '#15803d' : '#b91c1c' }}>
              {log.status === 'Success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {log.status}
            </span>
            {log.module && (
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: `${modColor}15`, color: modColor }}>
                {log.module}
              </span>
            )}
          </div>

          {row('Action', log.action)}
          {row('User', log.user?.name ?? '—')}
          {log.user && row('Role', rm?.label ?? log.user.role)}
          {row('Email', log.user?.email ?? '—')}
          {row('Company', log.company ? `${log.company.name} (${log.company.companyCode})` : '—')}
          {row('IP Address', log.ipAddress ?? '—')}
          {row('Timestamp', fmtFull(log.createdAt))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const MODULES = ['Auth', 'Companies', 'Subscriptions', 'Employees', 'Attendance', 'Leaves', 'Approvals', 'Expenses', 'Documents', 'Payroll', 'Shifts', 'Users', 'Settings', 'Support'];
const ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'FINANCE', 'SUPERVISOR', 'MANAGER', 'EMPLOYEE'];

const quickActions = [
  { icon: Download,  label: 'Download Logs' },
  { icon: Shield,    label: 'Manage Roles' },
  { icon: FileText,  label: 'Export Report' },
  { icon: BarChart3, label: 'View Reports' },
];

export default function ActivityPage() {
  const [tab,          setTab]          = useState<'activity' | 'login'>('activity');
  const [companies,    setCompanies]    = useState<{ id: string; name: string }[]>([]);
  const [search,       setSearch]       = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [roleFilter,   setRoleFilter]   = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page,         setPage]         = useState(1);
  const [viewLog,      setViewLog]      = useState<ActivityLog | null>(null);
  const debouncedSearch = useDebouncedValue(search, 500);

  const actParams: Record<string, string> = { type: tab, page: String(page), limit: '10' };
  if (debouncedSearch.trim().length >= 2) actParams.search = debouncedSearch.trim();
  if (companyFilter !== 'ALL') actParams.company = companyFilter;
  if (roleFilter !== 'ALL') actParams.role = roleFilter;
  if (moduleFilter !== 'ALL') actParams.module = moduleFilter;
  if (statusFilter !== 'ALL') actParams.status = statusFilter;

  const { data, isLoading: loading } = useSaActivity(actParams);
  const logs       = (data?.logs       ?? []) as ActivityLog[];
  const stats      = data?.stats       ?? { total: 0, today: 0, success: 0, failed: 0 };
  const pagination = data?.pagination  ?? { total: 0, page: 1, totalPages: 1 };

  useEffect(() => {
    activityApi.getCompanies().then(({ data }) => setCompanies(data)).catch(() => {});
  }, []);

  const resetFilters = () => {
    setSearch(''); setCompanyFilter('ALL'); setRoleFilter('ALL');
    setModuleFilter('ALL'); setStatusFilter('ALL'); setPage(1);
  };

  const statsRow = [
    { label: 'Total Logs',    value: stats.total,   icon: Activity,      bg: '#eff6ff', color: '#3b82f6' },
    { label: 'Today',         value: stats.today,   icon: Calendar,      bg: '#f0fdf4', color: '#22c55e' },
    { label: 'Success',       value: stats.success, icon: CheckCircle2,  bg: '#f0fdf4', color: '#16a34a' },
    { label: 'Failed',        value: stats.failed,  icon: XCircle,       bg: '#fef2f2', color: '#dc2626' },
  ];

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '12px', color: '#374151', backgroundColor: 'white',
    cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Activity Logs</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Monitor all user actions and system activity across the platform</p>
        </div>
        {/* Tab buttons - top right like Figma */}
        <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '9px', overflow: 'hidden', backgroundColor: 'white' }}>
          {(['login', 'activity'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(1); resetFilters(); }} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              backgroundColor: tab === t ? '#0d7470' : 'white',
              color: tab === t ? 'white' : '#64748b',
              transition: 'all 0.15s',
            }}>
              {t === 'login' ? <LogIn size={14} /> : <Activity size={14} />}
              {t === 'login' ? 'Login Log' : 'Activity Log'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statsRow.map((s) => (
          <div key={s.label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>{s.value}</p>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={19} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        {/* Filters */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by company name..."
              style={{ width: '100%', paddingLeft: '34px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }}
            />
          </div>
          <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{roleMeta[r]?.label ?? r}</option>)}
          </select>
          <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Status</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Loading logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Activity size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No logs found</p>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>Try changing filters</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Time', 'User', 'Role', 'Company', 'Action', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const { time, date } = fmtTime(log.createdAt);
                  const rm = log.user ? roleMeta[log.user.role] : null;
                  const av = log.user ? getAvatarColor(log.user.name) : avatarColors[0]!;
                  const modColor = log.module ? (moduleColors[log.module] ?? '#64748b') : '#64748b';
                  return (
                    <tr key={log.id} onClick={() => setViewLog(log)} style={{ borderBottom: i < logs.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      {/* Time */}
                      <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Clock size={13} color="#64748b" />
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{time}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{date}</p>
                          </div>
                        </div>
                      </td>
                      {/* User */}
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>
                            {log.user ? initials(log.user.name) : '?'}
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{log.user?.name ?? '—'}</p>
                        </div>
                      </td>
                      {/* Role */}
                      <td style={{ padding: '13px 20px' }}>
                        {rm ? (
                          <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: rm.bg, color: rm.color, whiteSpace: 'nowrap' }}>{rm.label}</span>
                        ) : <span style={{ color: '#94a3b8', fontSize: '13px' }}>—</span>}
                      </td>
                      {/* Company */}
                      <td style={{ padding: '13px 20px' }}>
                        <p style={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>{log.company?.name ?? '—'}</p>
                        {log.company && <p style={{ fontSize: '10px', color: '#94a3b8' }}>{log.company.companyCode}</p>}
                      </td>
                      {/* Action */}
                      <td style={{ padding: '13px 20px' }}>
                        <div>
                          <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap' }}>{log.action}</p>
                          {log.module && (
                            <span style={{ fontSize: '11px', color: modColor, fontWeight: 600 }}>{log.module}</span>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: log.status === 'Success' ? '#dcfce7' : '#fee2e2', color: log.status === 'Success' ? '#15803d' : '#b91c1c' }}>
                          {log.status === 'Success' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, pagination.total)} of {pagination.total} logs
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === 1 ? '#f8fafc' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? '#cbd5e1' : '#374151' }}><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: p === page ? '#0d7470' : 'white', color: p === page ? 'white' : '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: p === page ? 700 : 400 }}>{p}</button>
              ))}
              <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === pagination.totalPages ? '#f8fafc' : 'white', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === pagination.totalPages ? '#cbd5e1' : '#374151' }}><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 22px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {quickActions.map((q) => (
            <button key={q.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#f8fafc'; el.style.borderColor = '#0d7470'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'white'; el.style.borderColor = '#e2e8f0'; }}
            >
              <q.icon size={22} color="#0d7470" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* View Modal */}
      {viewLog && <LogModal log={viewLog} onClose={() => setViewLog(null)} />}
    </div>
  );
}
