import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { toast } from 'sonner';
import { type Expense } from '../../api/finance';
import { Search, CheckCircle2, X, Loader2, Paperclip, Plus } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { extractError } from '../../utils/errorUtils';
import { useFinanceExpenses } from '../../hooks/queries/useFinanceQueries';
import { useFinanceUpdateExpense } from '../../hooks/mutations/useFinanceMutations';
import LegacyDrawer from '../../components/ui/LegacyDrawer';
import { useAccess } from '../../hooks/queries/useAccess';
import { useSubmitExpense } from '../../hooks/mutations/useEmployeeMutations';
import { StatusBadge } from '../../components/ui/ProductPrimitives';

type Tab = 'All Request' | 'Pending Requests' | 'Approved Requests' | 'Completed Requests';
const TABS: Tab[] = ['All Request', 'Pending Requests', 'Approved Requests', 'Completed Requests'];

const CAT_META: Record<string, { bg: string; color: string }> = {
  Travel:      { bg: '#dbeafe', color: '#1d4ed8' },
  Materials:   { bg: '#dcfce7', color: '#15803d' },
  Utilities:   { bg: '#fef9c3', color: '#854d0e' },
  Maintenance: { bg: '#f5f3ff', color: '#6d28d9' },
  Others:      { bg: '#f1f5f9', color: '#475569' },
};

const fmtAmt  = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ExpensesPage() {
  const access = useAccess();
  const canCreate = access.can('EXPENSE_MANAGEMENT.CREATE');
  const canApprove = access.can('EXPENSE_MANAGEMENT.APPROVE');
  const canReject = access.can('EXPENSE_MANAGEMENT.REJECT');
  const canProcess = access.can('EXPENSE_MANAGEMENT.PROCESS');
  const [tab,         setTab]         = useState<Tab>('All Request');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [limit]                       = useState(20);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({ category: 'Travel', amount: '', description: '' });

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (tab === 'Pending Requests')   params.status = 'PENDING';
  if (tab === 'Approved Requests')  params.status = 'APPROVED';
  if (tab === 'Completed Requests') params.status = 'COMPLETED';

  const { data, isLoading: loading } = useFinanceExpenses(params);
  const expenses: Expense[] = data?.expenses ?? [];
  const stats = data?.stats ?? { pending: 0, approved: 0, rejected: 0 };
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const updateExpense = useFinanceUpdateExpense();
  const submitExpense = useSubmitExpense();

  const handleTabChange = (t: Tab) => { setTab(t); setPage(1); };
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };

  const handleAction = (id: string, status: string) => {
    updateExpense.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Expense ${status.toLowerCase()}`),
        onError: (err) => toast.error(extractError(err, 'Failed to update expense')),
      },
    );
  };
  const handleCreate = () => {
    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !createForm.description.trim()) {
      setCreateError('Enter a positive amount and a description.');
      return;
    }
    setCreateError('');
    submitExpense.mutate({ category: createForm.category, amount, description: createForm.description }, {
      onSuccess: () => {
        setShowCreate(false);
        setCreateForm({ category: 'Travel', amount: '', description: '' });
        toast.success('Expense submitted successfully');
      },
      onError: (error) => setCreateError(extractError(error, 'Failed to submit expense')),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div><h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Expenses</h1><p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Review, validate, and track employee expense claims</p></div>
        {canCreate && <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><Plus size={14} /> Submit expense</button>}
      </div>

      {/* Stats */}
      <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Pending Requests',  value: stats.pending,  color: '#ea580c', iconBg: '#fff7ed' },
          { label: 'Approved',          value: stats.approved, color: '#16a34a', iconBg: '#f0fdf4' },
          { label: 'Rejected Requests', value: stats.rejected, color: '#dc2626', iconBg: '#fef2f2' },
        ].map(({ label, value, color, iconBg }) => (
          <div key={label} className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color, marginTop: '4px' }}>{value}</p>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {label === 'Approved' ? <CheckCircle2 size={16} color={color} /> : label === 'Rejected Requests' ? <X size={16} color={color} /> : <Loader2 size={16} color={color} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ padding: '4px', display: 'flex', gap: '2px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => handleTabChange(t)} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? '#0d7470' : 'transparent', color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>{t}</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '240px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee', 'Category', 'Amount', 'Date', 'Status', 'Action'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, i) => {
                  const cm = CAT_META[exp.category] ?? CAT_META['Others']!;
                  return (
                    <tr key={exp.id} onClick={() => setViewExpense(exp)} style={{ borderBottom: i < expenses.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{exp.employee.user.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>{exp.employee.employeeId}</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: cm.bg, color: cm.color }}>{exp.category}</span>
                          {exp.receiptUrl && <Paperclip size={11} color="#94a3b8" aria-label="Receipt attached" />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtAmt(exp.amount)}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(exp.createdAt)}</span></td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={exp.status} /></td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {['PENDING', 'SUBMITTED', 'MANAGER_APPROVED'].includes(exp.status.toUpperCase()) && (
                            <>
                              {canApprove && <button aria-label="Approve expense" onClick={(e) => { e.stopPropagation(); handleAction(exp.id, 'Approved'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle2 size={13} color="white" /></button>}
                              {canReject && <button aria-label="Reject expense" onClick={(e) => { e.stopPropagation(); handleAction(exp.id, 'Rejected'); }} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={13} color="white" /></button>}
                            </>
                          )}
                          {exp.status.toUpperCase() === 'FINANCE_APPROVED' && canProcess && <button className="admin-button admin-button--secondary" onClick={(event) => { event.stopPropagation(); handleAction(exp.id, 'Paid'); }}>Mark paid</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {expenses.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No expense claims found</td></tr>
                )}
              </tbody>
            </ResponsiveTable>
          </div>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />

      {viewExpense && (
        <LegacyDrawer open onClose={() => setViewExpense(null)} direction="right" className="legacy-detail-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Expense Detail</span>
              <button onClick={() => setViewExpense(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {([
                ['Employee',   viewExpense.employee.user.name],
                ['Employee ID', viewExpense.employee.employeeId],
                ['Category',   viewExpense.category],
                ['Amount',     fmtAmt(viewExpense.amount)],
                ['Date',       fmtDate(viewExpense.createdAt)],
                ['Status',     viewExpense.status],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              {viewExpense.receiptUrl && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Receipt</span>
                  <a href={viewExpense.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#0d7470', fontWeight: 500 }}>View Receipt</a>
                </div>
              )}
            </div>
            {['PENDING', 'SUBMITTED', 'MANAGER_APPROVED'].includes(viewExpense.status.toUpperCase()) && (canApprove || canReject) && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {canReject && <button onClick={() => { handleAction(viewExpense.id, 'Rejected'); setViewExpense(null); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', border: '1.5px solid #fecaca', borderRadius: '8px', backgroundColor: 'white', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><X size={13} /> Reject</button>}
                {canApprove && <button onClick={() => { handleAction(viewExpense.id, 'Approved'); setViewExpense(null); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}><CheckCircle2 size={13} /> Approve</button>}
              </div>
            )}
            {viewExpense.status.toUpperCase() === 'FINANCE_APPROVED' && canProcess && <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}><button className="admin-button admin-button--primary" onClick={() => { handleAction(viewExpense.id, 'Paid'); setViewExpense(null); }}>Mark reimbursement paid</button></div>}
          </div>
        </LegacyDrawer>
      )}
      {canCreate && showCreate && <LegacyDrawer open onClose={() => { setShowCreate(false); setCreateError(''); }} direction="right" className="legacy-form-drawer">
        <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '94vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Submit expense</h3><button aria-label="Close expense form" onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button></div>
          {createError && <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>{createError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Category<select value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}>{Object.keys(CAT_META).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Amount<input type="number" min="0" value={createForm.amount} onChange={(event) => setCreateForm((current) => ({ ...current, amount: event.target.value }))} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }} /></label>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Description<textarea rows={4} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical' }} /></label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}><button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: 'white', fontWeight: 600 }}>Cancel</button><button onClick={handleCreate} disabled={submitExpense.isPending} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: '#0d7470', color: 'white', fontWeight: 600, opacity: submitExpense.isPending ? 0.65 : 1 }}>{submitExpense.isPending ? 'Submitting…' : 'Submit expense'}</button></div>
        </div>
      </LegacyDrawer>}
    </div>
  );
}
