import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Loader2, Receipt, XCircle } from 'lucide-react';
import { paymentsApi, type Payment, type PaymentStatus } from '../../api/payments';
import { extractError } from '../../utils/errorUtils';

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: 'Paid', color: '#15803d', bg: '#dcfce7' },
  PENDING: { label: 'Pending', color: '#a16207', bg: '#fef9c3' },
  FAILED: { label: 'Failed', color: '#b91c1c', bg: '#fee2e2' },
  REFUNDED: { label: 'Refunded', color: '#7c3aed', bg: '#f3e8ff' },
  CANCELLED: { label: 'Cancelled', color: '#475569', bg: '#f1f5f9' },
  NOT_RECORDED: { label: 'Not recorded', color: '#64748b', bg: '#f1f5f9' },
};
const fieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #dbe5e4', borderRadius: 8, fontSize: 12, color: '#334155', background: 'white', outline: 'none', fontFamily: 'Inter, sans-serif' };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await paymentsApi.getAll({ source: 'RAZORPAY', status, page: String(page), limit: '10' });
      // Billing is online-only. Guard against older backends that may ignore
      // the source query and still return legacy offline records.
      setPayments(response.data.payments.filter((payment) => payment.source === 'RAZORPAY'));
      setTotalPages(response.data.pagination.totalPages || 1);
    } catch (reason) {
      setError(extractError(reason, 'Could not load payments'));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    paid: payments.filter((payment) => payment.status === 'PAID').length,
    pending: payments.filter((payment) => payment.status === 'PENDING').length,
    online: payments.filter((payment) => payment.source === 'RAZORPAY').length,
    total: payments.reduce((sum, payment) => sum + (payment.status === 'PAID' ? payment.amount : 0), 0),
  }), [payments]);
  const statCards = [
    { label: 'Paid on this page', value: String(stats.paid), icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4' },
    { label: 'Pending checkout', value: String(stats.pending), icon: Clock3, color: '#a16207', bg: '#fffbeb' },
    { label: 'Online payments', value: String(stats.online), icon: CreditCard, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Paid value', value: `₹${stats.total.toLocaleString('en-IN')}`, icon: Receipt, color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div><h1 style={{ margin: 0, fontSize: 21, fontWeight: 750, color: '#0f172a' }}>Payments</h1><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Online checkout records managed by the payment provider.</p></div>
    {error && <div role="alert" style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 13px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{error}<button onClick={() => setError('')} style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer' }}><XCircle size={15} /></button></div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>{statCards.map(({ label, value, icon: Icon, color, bg }) => <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}><span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, color, background: bg }}><Icon size={16} /></span><div><p style={{ margin: 0, fontSize: 19, fontWeight: 750, color: '#0f172a' }}>{value}</p><p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 11 }}>{label}</p></div></div>)}</div>
    <div style={{ display: 'flex', gap: 9, padding: 12, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <select aria-label="Filter by payment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} style={{ ...fieldStyle, width: 170 }}><option value="ALL">All statuses</option>{(['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as PaymentStatus[]).map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Company', 'Source', 'Plan', 'Amount', 'Status', 'Reference', 'Date'].map((heading) => <th key={heading} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.3px' }}>{heading}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}><Loader2 size={18} className="spin" style={{ verticalAlign: 'middle', marginRight: 7 }} /> Loading payments…</td></tr> : payments.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 45, color: '#64748b', fontSize: 13 }}>No payment records match these filters.</td></tr> : payments.map((payment) => {
        const meta = statusMeta[payment.status] ?? statusMeta.NOT_RECORDED;
        const reference = payment.reference || payment.razorpayPaymentId || payment.razorpayOrderId;
        return <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td style={{ padding: '13px 14px', color: '#0f172a', fontSize: 13, fontWeight: 650 }}>{payment.company?.name || 'Pending checkout / legacy'}<span style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 400 }}>{payment.company?.companyCode || ''}</span></td>
          <td style={{ padding: 14 }}><span style={{ padding: '4px 8px', borderRadius: 5, color: payment.source === 'RAZORPAY' ? '#2563eb' : '#64748b', background: payment.source === 'RAZORPAY' ? '#eff6ff' : '#f1f5f9', fontSize: 10, fontWeight: 750 }}>{payment.source}</span></td>
          <td style={{ padding: 14, color: '#475569', fontSize: 12 }}>{payment.plan}</td>
          <td style={{ padding: 14, color: '#0f172a', fontSize: 13, fontWeight: 700 }}>₹{payment.amount.toLocaleString('en-IN')}</td>
          <td style={{ padding: 14 }}><span style={{ padding: '4px 8px', borderRadius: 99, color: meta.color, background: meta.bg, fontSize: 10, fontWeight: 750 }}>{meta.label}</span></td>
          <td style={{ padding: 14, color: '#64748b', fontSize: 12 }}>{reference || '—'}</td>
          <td style={{ padding: 14, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-IN')}</td>
        </tr>;
      })}
    </tbody></table><div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 11 }}>Page {page} of {totalPages}</span><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 6, padding: 5, color: '#64748b', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={15} /></button><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 6, padding: 5, color: '#64748b', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={15} /></button></div></div>
  </div>;
}
