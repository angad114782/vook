import { useState } from 'react';
import { type CALog } from '../../api/companyAdmin';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import PaginationBar from '../../components/data/Pagination';
import { useCaActivity } from '../../hooks/queries/useCaQueries';

const STATUS_META: Record<string, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  Success: { bg: '#f0fdf4', color: '#15803d', icon: CheckCircle2 },
  Failed:  { bg: '#fef2f2', color: '#b91c1c', icon: XCircle },
  Pending: { bg: '#fef9c3', color: '#854d0e', icon: Clock },
};

const ROLE_COLORS: Record<string, string> = {
  HR: '#0d7470', MANAGER: '#2563eb', SUPERVISOR: '#7c3aed',
  FINANCE: '#ea580c', EMPLOYEE: '#16a34a', COMPANY_ADMIN: '#6366f1', SUPER_ADMIN: '#0f172a',
};

const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function CAActivityPage() {
  const [filter, setFilter] = useState<'All' | 'Success' | 'Failed'>('All');
  const [page,   setPage]   = useState(1);
  const limit = 20;

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (filter !== 'All') params.status = filter;

  const { data, isLoading: loading } = useCaActivity(params);
  const logs       = (data?.logs ?? []) as CALog[];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleFilter = (f: 'All' | 'Success' | 'Failed') => { setFilter(f); setPage(1); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Activity Log</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>All user actions and system events in your company</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['All', 'Success', 'Failed'] as const).map((f) => (
            <button key={f} onClick={() => handleFilter(f)} style={{ padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: filter === f ? '#6366f1' : '#f1f5f9', color: filter === f ? 'white' : '#64748b', transition: 'all 0.15s' }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#6366f1" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['Action', 'Module', 'User', 'Role', 'Status', 'Time'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const sm = STATUS_META[log.status] ?? STATUS_META['Success']!;
                const Icon = sm.icon;
                const roleColor = ROLE_COLORS[log.user?.role ?? ''] ?? '#94a3b8';
                return (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}><span style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{log.action}</span></td>
                    <td style={{ padding: '11px 16px' }}><span style={{ fontSize: '12px', color: '#64748b' }}>{log.module ?? '—'}</span></td>
                    <td style={{ padding: '11px 16px' }}><span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{log.user?.name ?? 'System'}</span></td>
                    <td style={{ padding: '11px 16px' }}><span style={{ fontSize: '11px', fontWeight: 600, color: roleColor }}>{log.user?.role?.replace('_', ' ') ?? '—'}</span></td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', backgroundColor: sm.bg }}>
                        <Icon size={11} color={sm.color} />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: sm.color }}>{log.status}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}><span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtTime(log.createdAt)}</span></td>
                  </tr>
                );
              })}
              {logs.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No activity logs found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />
    </div>
  );
}
