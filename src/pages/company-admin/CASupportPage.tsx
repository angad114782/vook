import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, LifeBuoy, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { supportApi, type SupportTicket } from '../../api/support';
import TicketConversationModal from '../../components/support/TicketConversationModal';
import type { AppNotification } from '../../api/notifications';

const statusName: Record<string, string> = { PENDING: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const categories = ['General', 'Payroll', 'Attendance', 'Account', 'Bug report'];
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const statusStyle: Record<string, { bg: string; color: string; dot: string }> = { PENDING: { bg: '#fffbeb', color: '#a16207', dot: '#eab308' }, IN_PROGRESS: { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' }, RESOLVED: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' }, CLOSED: { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' } };

export default function CASupportPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ category: 'General', subject: '', description: '', priority: 'MEDIUM' });
  const queryClient = useQueryClient();
  const ticketsQuery = useQuery({ queryKey: ['support', 'tickets', 'company-admin'], queryFn: () => supportApi.getAll({ limit: '50' }).then((response) => response.data) });
  const createMutation = useMutation({ mutationFn: () => supportApi.create(form).then((response) => response.data), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['support', 'tickets', 'company-admin'] }); } });
  const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data?.tickets]);
  const handleTicketUpdate = useCallback((id: string, status: string) => {
    setSelected((current) => current?.id === id ? { ...current, status: status as SupportTicket['status'] } : current);
    queryClient.setQueryData(['support', 'tickets', 'company-admin'], (current: typeof ticketsQuery.data | undefined) => current ? { ...current, tickets: current.tickets.map((ticket) => ticket.id === id ? { ...ticket, status: status as SupportTicket['status'] } : ticket) } : current);
  }, [queryClient]);

  // A successful notification read already contains the new, server-authorized
  // status. Update the visible ticket pill locally instead of refetching.
  useEffect(() => {
    const onStatusObserved = (event: Event) => {
      const detail = (event as CustomEvent<{ ticketId?: string; status?: string }>).detail;
      if (!detail?.ticketId || !detail.status || !statusStyle[detail.status]) return;
      handleTicketUpdate(detail.ticketId, detail.status);
    };
    window.addEventListener('support-ticket-status-observed', onStatusObserved);
    return () => window.removeEventListener('support-ticket-status-observed', onStatusObserved);
  }, [handleTicketUpdate]);

  useEffect(() => {
    const ticketId = params.get('ticket');
    if (!ticketId || !ticketsQuery.isFetched) return;
    const notification = (location.state as { notification?: AppNotification } | null)?.notification;
    const status = notification?.metadata?.status;
    const cachedTicket = tickets.find((ticket) => ticket.id === ticketId);
    if (cachedTicket) {
      setSelected({ ...cachedTicket, ...(typeof status === 'string' ? { status: status as SupportTicket['status'] } : {}) });
      if (typeof status === 'string') {
        queryClient.setQueryData(['support', 'tickets', 'company-admin'], (current: typeof ticketsQuery.data | undefined) => current ? {
          ...current,
          tickets: current.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: status as SupportTicket['status'] } : ticket),
        } : current);
      }
      setParams({}, { replace: true });
      return;
    }
    void supportApi.getOne(ticketId).then(({ data }) => setSelected(data)).finally(() => setParams({}, { replace: true }));
  }, [location.state, params, queryClient, setParams, tickets, ticketsQuery.isFetched]);

  const create = async () => { if (!form.subject.trim() || !form.description.trim() || createMutation.isPending) return; await createMutation.mutateAsync(); setShowNew(false); setForm({ category: 'General', subject: '', description: '', priority: 'MEDIUM' }); };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h1 style={{ fontSize: 20, margin: 0 }}>Help &amp; Support</h1><p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Track support requests and chat with the support team.</p></div><button style={primary} onClick={() => setShowNew(true)}><Plus size={15} /> New ticket</button></div>
    <div style={card}><div style={listHeader}><div><h2 style={listTitle}>Your support tickets</h2><p style={listHint}>{tickets.length ? `${tickets.length} request${tickets.length === 1 ? '' : 's'} · Select a ticket to view the conversation` : 'Create a ticket and our support team will get back to you.'}</p></div><span style={countBadge}>{tickets.length}</span></div>{ticketsQuery.isLoading ? <div style={{ padding: 52, display: 'grid', placeItems: 'center', gap: 8, color: '#94a3b8' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: 12 }}>Loading your tickets…</span></div> : tickets.length ? <div>{tickets.map((ticket) => { const state = statusStyle[ticket.status]!; return <button key={ticket.id} onClick={() => setSelected(ticket)} style={ticketRow}><div style={ticketIcon}><MessageSquare size={15} /></div><span style={ticketMain}><span style={ticketTop}><b style={ticketSubject}>{ticket.subject}</b><span style={{ ...statusPill, background: state.bg, color: state.color }}><span style={{ ...statusDot, background: state.dot }} />{statusName[ticket.status]}</span></span><span style={ticketMeta}><span>{ticket.ticketNo}</span><span>·</span><span>{ticket.category}</span><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={11} />{formatDate(ticket.createdAt)}</span></span></span><ChevronRight size={16} color="#94a3b8" /></button>; })}</div> : <div style={emptyState}><div style={emptyIcon}><LifeBuoy size={20} /></div><b>No tickets yet</b><p>Need help? Create your first support request.</p><button style={primary} onClick={() => setShowNew(true)}><Plus size={14} /> Create ticket</button></div>}</div>
    {showNew && <NewTicketModal form={form} setForm={setForm} loading={createMutation.isPending} onClose={() => setShowNew(false)} onSubmit={() => void create()} />}
    {selected && <TicketConversationModal ticket={selected} onClose={() => setSelected(null)} onStatusChange={handleTicketUpdate} />}
  </div>;
}

function NewTicketModal({ form, setForm, loading, onClose, onSubmit }: { form: { category: string; subject: string; description: string; priority: string }; setForm: (value: { category: string; subject: string; description: string; priority: string }) => void; loading: boolean; onClose: () => void; onSubmit: () => void }) {
  return <div onClick={onClose} style={overlay}><div onClick={(event) => event.stopPropagation()} style={newModal}><button onClick={onClose} style={close}><X size={17} /></button><div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}><h2 style={{ margin: 0, fontSize: 16 }}>Submit support ticket</h2><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} style={input}>{categories.map((category) => <option key={category}>{category}</option>)}</select><input placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} style={input} /><textarea placeholder="Describe the issue" rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={input} /><button style={{ ...primary, opacity: loading ? .6 : 1 }} disabled={loading} onClick={onSubmit}>{loading ? <Loader2 size={14} /> : 'Submit ticket'}</button></div></div></div>;
}

const card: React.CSSProperties = { overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' };
const ticketRow: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 0, borderBottom: '1px solid #f1f5f9', background: 'white', textAlign: 'left', cursor: 'pointer' };
const listHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #eef2f5' };
const listTitle: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 14, fontWeight: 750 };
const listHint: React.CSSProperties = { margin: '4px 0 0', color: '#94a3b8', fontSize: 11 };
const countBadge: React.CSSProperties = { display: 'grid', placeItems: 'center', minWidth: 28, height: 24, padding: '0 7px', borderRadius: 20, color: '#0d7470', background: '#e6fffa', fontSize: 11, fontWeight: 800 };
const ticketIcon: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 32, height: 32, flexShrink: 0, borderRadius: 9, color: '#0d7470', background: '#e6fffa' };
const ticketMain: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 5 };
const ticketTop: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 };
const ticketSubject: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a', fontSize: 13, fontWeight: 650 };
const ticketMeta: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 10 };
const statusPill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '4px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700 };
const statusDot: React.CSSProperties = { width: 5, height: 5, borderRadius: '50%' };
const emptyState: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '54px 20px', color: '#475569', fontSize: 13 };
const emptyIcon: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 42, height: 42, marginBottom: 3, borderRadius: 12, color: '#0d7470', background: '#e6fffa' };
const primary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 13px', border: 0, borderRadius: 8, background: '#0d7470', color: 'white', fontWeight: 700, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.48)' };
const newModal: React.CSSProperties = { width: 'min(480px,100%)', overflow: 'hidden', borderRadius: 14, background: 'white', boxShadow: '0 20px 60px rgba(15,23,42,.2)' };
const close: React.CSSProperties = { display: 'grid', placeItems: 'center', marginLeft: 'auto', padding: '12px 14px 4px', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' };
