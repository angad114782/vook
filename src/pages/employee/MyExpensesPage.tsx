import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { employeeApi, type MyExpense } from '../../api/employee';
import { Loader2, Plus, X, Receipt, CheckCircle2, Upload } from 'lucide-react';
import { extractError } from '../../utils/errorUtils';
import { useMyExpenses } from '../../hooks/queries/useEmployeeQueries';

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Pending:  { bg: '#fef9c3', color: '#854d0e' },
  Approved: { bg: '#dcfce7', color: '#15803d' },
  Rejected: { bg: '#fef2f2', color: '#b91c1c' },
};

const CAT_META: Record<string, { bg: string; color: string }> = {
  Travel:      { bg: '#dbeafe', color: '#1d4ed8' },
  Materials:   { bg: '#dcfce7', color: '#15803d' },
  Utilities:   { bg: '#fef9c3', color: '#854d0e' },
  Maintenance: { bg: '#f5f3ff', color: '#6d28d9' },
  Others:      { bg: '#f1f5f9', color: '#475569' },
};

const CATEGORIES = ['Travel', 'Materials', 'Utilities', 'Maintenance', 'Others'];
const fmtAmt  = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyExpensesPage() {
  const qc = useQueryClient();
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form,       setForm]       = useState({ category: 'Travel', amount: '', description: '' });
  const [formError,  setFormError]  = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: expData, isLoading: loading } = useMyExpenses();

  const expenses = ((expData as { expenses?: MyExpense[] } | undefined)?.expenses ?? []) as MyExpense[];
  const stats    = ((expData as { stats?: { pending: number; approved: number; total: number } } | undefined)?.stats) ?? { pending: 0, approved: 0, total: 0 };

  const handleSubmit = async () => {
    if (!form.amount || !form.description) { setFormError('All fields are required'); return; }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) { setFormError('Enter a valid amount'); return; }
    setSubmitting(true); setFormError('');
    try {
      let receiptUrl = '';
      if (receiptFile) {
        const { data } = await employeeApi.uploadReceiptFile(receiptFile);
        receiptUrl = data.fileUrl;
      }
      await employeeApi.submitExpense({
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        receiptUrl,
      });
      setShowSubmit(false);
      setReceiptFile(null);
      setForm({ category: 'Travel', amount: '', description: '' });
      void qc.invalidateQueries({ queryKey: ['emp', 'expenses'] });
      void qc.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    } catch (err) { setFormError(extractError(err, 'Submission failed. Try again.')); }
    finally { setSubmitting(false); }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setReceiptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>My Expenses</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Submit and track your expense reimbursements</p>
        </div>
        <button onClick={() => setShowSubmit(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Plus size={14} /> Submit Expense
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          { label: 'Pending Approval', value: stats.pending,  icon: Receipt,      iconBg: '#fff7ed', iconColor: '#ea580c', valColor: '#ea580c' },
          { label: 'Approved',         value: stats.approved, icon: CheckCircle2, iconBg: '#f0fdf4', iconColor: '#16a34a', valColor: '#16a34a' },
          { label: 'Total Submitted',  value: expenses.length,icon: Receipt,      iconBg: '#eff6ff', iconColor: '#2563eb', valColor: '#0f172a' },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, valColor }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: valColor, marginTop: '4px' }}>{value}</p>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color={iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Expenses table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Expense Claims</h3>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['Category', 'Amount', 'Description', 'Date', 'Status', 'Receipt'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => {
                const cm = CAT_META[e.category] ?? CAT_META['Others']!;
                const sm = STATUS_META[e.status] ?? STATUS_META['Pending']!;
                return (
                  <tr key={e.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <td style={{ padding: '12px 20px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: cm.bg, color: cm.color }}>{e.category}</span></td>
                    <td style={{ padding: '12px 20px' }}><span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{fmtAmt(e.amount)}</span></td>
                    <td style={{ padding: '12px 20px' }}><span style={{ fontSize: '12px', color: '#64748b', maxWidth: '220px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description ?? '—'}</span></td>
                    <td style={{ padding: '12px 20px' }}><span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(e.createdAt)}</span></td>
                    <td style={{ padding: '12px 20px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{e.status}</span></td>
                    <td style={{ padding: '12px 20px' }}>
                      {e.receiptUrl ? (
                        <a 
                          href={e.receiptUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0d7470', fontSize: '12px', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          <Receipt size={13} /> View Receipt
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No expense claims yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Submit Expense Modal */}
      {showSubmit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '94vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Submit Expense Claim</h3>
              <button onClick={() => { setShowSubmit(false); setFormError(''); setReceiptFile(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {formError && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>{formError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Category</label>
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', backgroundColor: 'white', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Amount (₹)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="e.g. 1500" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe the expense..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Receipt / Proof (Optional)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{ 
                    border: '2px dashed #cbd5e1', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'center', 
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {receiptFile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, wordBreak: 'break-all' }}>{receiptFile.name}</p>
                      <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{(receiptFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{ marginTop: '8px', fontSize: '11px', color: '#b91c1c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        Remove proof
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={18} color="#0d7470" style={{ margin: '0 auto 6px' }} />
                      <p style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>Click or Drag image/PDF here</p>
                      <p style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>PDF, PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setShowSubmit(false); setFormError(''); setReceiptFile(null); }} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => void handleSubmit()} disabled={submitting} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: submitting ? '#5fa8a5' : '#0d7470', color: 'white', fontSize: '13px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {submitting ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
