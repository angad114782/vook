import { useQuery } from '@tanstack/react-query';
import { FileClock, ShieldCheck } from 'lucide-react';
import { auditApi } from '../../api/integrations';

export default function AuditPage() {
  const query = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.list({ limit: '50' }).then((response) => response.data as any),
  });
  const logs = query.data?.logs ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Audit & security</h1>
          <p>Append-only evidence for sensitive configuration, subscription, entitlement, and access actions.</p>
        </div>
        <div className="health-chip"><ShieldCheck size={14} /> Security events retained</div>
      </header>

      <section className="admin-card admin-table-card">
        {query.isLoading ? (
          <div className="empty-state">Loading audit events…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><FileClock size={26} /><strong>No audit events</strong><p>Sensitive platform actions will appear here.</p></div>
        ) : (
          <div className="admin-table-scroll">
            <table className="org-table">
              <thead><tr><th>Event</th><th>Actor</th><th>Company</th><th>Reason</th><th>Time</th></tr></thead>
              <tbody>{logs.map((log: any) => (
                <tr key={log.id}>
                  <td><div className="table-primary-cell"><FileClock size={15} /><span><strong>{log.action.replaceAll('_', ' ')}</strong><small>{log.entityType}</small></span></div></td>
                  <td>{log.actorId?.name ?? 'System'}</td>
                  <td>{log.companyId?.name ?? 'Platform'}</td>
                  <td>{log.reason ?? '—'}</td>
                  <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
