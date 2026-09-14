import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Send } from 'lucide-react';
import { toast } from 'sonner';
import { platformApi } from '../../api/platform';

export default function NotificationsAdminPage() {
  const client = useQueryClient();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', targetRole: 'ALL', severity: 'INFO', reason: '' });
  const broadcasts = useQuery({ queryKey: ['platform', 'broadcasts'], queryFn: () => platformApi.getBroadcasts<any>().then((response) => response.data) });

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const { data } = await platformApi.createBroadcast<{ recipients: number }>(form);
      toast.success(`Notification sent to ${data.recipients} users.`);
      setForm({ ...form, title: '', message: '', reason: '' });
      await client.invalidateQueries({ queryKey: ['platform', 'broadcasts'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to send notification.');
    } finally { setSending(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><h1>Notifications</h1><p>Send targeted operational messages and review delivery and read coverage.</p></div>
        <div className="health-chip"><BellRing size={14} /> In-app delivery</div>
      </header>

      <div className="admin-split-layout">
        <form className="admin-card admin-form-card" onSubmit={send}>
          <h2>New broadcast</h2>
          <label className="admin-label">Title<input className="admin-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={120} /></label>
          <label className="admin-label">Message<textarea className="admin-input" rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required maxLength={1000} /></label>
          <div className="admin-form-columns">
            <label className="admin-label">Audience<select className="admin-input" value={form.targetRole} onChange={(event) => setForm({ ...form, targetRole: event.target.value })}>{['ALL', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPERVISOR', 'FINANCE', 'EMPLOYEE'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="admin-label">Severity<select className="admin-input" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>{['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="admin-label">Audit reason<input className="admin-input" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></label>
          <div className="admin-form-actions"><button className="admin-button" disabled={sending}><Send size={15} /> {sending ? 'Sending…' : 'Send notification'}</button></div>
        </form>

        <section className="admin-card admin-list-card">
          <h2>Recent broadcasts</h2>
          {broadcasts.isLoading && <div className="empty-state">Loading broadcasts…</div>}
          {!broadcasts.isLoading && !broadcasts.data?.length && <div className="empty-state"><BellRing size={24} /><strong>No broadcasts yet</strong></div>}
          {broadcasts.data?.map((item) => <article className="broadcast-row" key={item._id}><div><strong>{item.title}</strong><span data-status={item.severity}>{item.severity}</span></div><p>{item.message}</p><small>{item.recipients} recipients · {item.unread} unread · {new Date(item.createdAt).toLocaleString('en-IN')}</small></article>)}
        </section>
      </div>
    </div>
  );
}
