import { ResponsiveTable } from '../../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { Search, Edit2, X, Loader2 } from 'lucide-react';
import { type SalaryRow } from '../../../api/hr';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import PaginationBar from '../../../components/data/Pagination';
import { useHrSalary } from '../../../hooks/queries/useHrQueries';
import { hrApi } from '../../../api/hr';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import LegacyDrawer from '../../../components/ui/LegacyDrawer';

const fmtCtc = (n: number | null) => n ? `INR ${n.toLocaleString('en-IN')}` : 'Not configured';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';

export default function CASalaryStructurePage() {
  const [search,  setSearch]  = useState('');
  const [editEmp, setEditEmp] = useState<SalaryRow | null>(null);
  const [editCTC, setEditCTC] = useState('');
  const [editBasic, setEditBasic] = useState('');
  const [editAllowances, setEditAllowances] = useState('');
  const [editDeductions, setEditDeductions] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [page,    setPage]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const queryClient = useQueryClient();
  const limit = 20;

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading: loading } = useHrSalary(params);
  const salary     = data?.results    ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };

  const openEdit = (e: SalaryRow) => {
    setEditEmp(e);
    setEditCTC(String(e.annualCtc ?? ''));
    setEditBasic(e.basicAnnual ? String(e.basicAnnual) : '');
    setEditAllowances(e.allowancesAnnual ? String(e.allowancesAnnual) : '');
    setEditDeductions(e.deductionsAnnual ? String(e.deductionsAnnual) : '');
    setEffectiveFrom(e.effectiveFrom ? e.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10));
  };
  const saveSalary = async () => {
    if (!editEmp || !Number.isFinite(Number(editCTC)) || Number(editCTC) <= 0) { toast.error('Enter a positive annual CTC'); return; }
    const optionalAmounts = [editBasic, editAllowances, editDeductions].filter(Boolean);
    if (optionalAmounts.some((amount) => !Number.isFinite(Number(amount)) || Number(amount) < 0)) { toast.error('Salary components must be zero or greater'); return; }
    const annualCtc = Number(editCTC);
    setSaving(true);
    try {
      await hrApi.saveSalary({
        employeeId: editEmp.id,
        annualCtc,
        basicAnnual: editBasic === '' ? annualCtc : Number(editBasic),
        allowancesAnnual: editAllowances === '' ? Math.round(annualCtc * 0.15) : Number(editAllowances),
        ...(editDeductions ? { deductionsAnnual: Number(editDeductions) } : {}),
        ...(effectiveFrom ? { effectiveFrom: `${effectiveFrom}T00:00:00.000Z` } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['hr', 'salary'] });
      setEditEmp(null);
      toast.success('Salary structure saved');
    } catch {
      toast.error('Unable to save salary structure');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Salary Structure</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>View and update employee CTC and salary components.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', width: '200px' }} />
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{pagination.total} employees</span>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#2563eb" /></div>
        ) : (
          <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['EMPLOYEE', 'ROLE', 'TYPE', 'ANNUAL CTC', 'LAST REVISED', 'ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salary.map((e, i) => (
                <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{e.name}</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>{e.employeeId}</p>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{e.designation ?? '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, border: `1px solid ${e.employmentType === 'Permanent' ? '#2563eb' : '#d97706'}`, color: e.employmentType === 'Permanent' ? '#2563eb' : '#d97706', backgroundColor: 'white' }}>
                      {e.employmentType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: e.annualCtc && e.annualCtc > 0 ? '#0f172a' : '#dc2626', borderBottom: '1px solid #f1f5f9' }}>{fmtCtc(e.annualCtc)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>{fmtDate(e.lastRevised)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <button aria-label={`Revise salary for ${e.name}`} onClick={() => openEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center' }}>
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {salary.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No records found</td></tr>
              )}
            </tbody>
          </ResponsiveTable>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />

      {/* Edit CTC Modal */}
      {editEmp && (
        <LegacyDrawer open onClose={() => setEditEmp(null)} direction="right" className="legacy-form-drawer">
          <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Edit Salary — {editEmp.name}</h2>
              <button onClick={() => setEditEmp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Annual CTC (₹)</label>
                <input type="number" value={editCTC} onChange={(e) => setEditCTC(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', boxSizing: 'border-box' }} onFocus={(e) => (e.target.style.borderColor = '#2563eb')} onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')} />
                {editCTC && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Monthly: ₹{Math.round(Number(editCTC) / 12).toLocaleString('en-IN')}</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Basic annual<input type="number" min="0" value={editBasic} onChange={(e) => setEditBasic(e.target.value)} placeholder="Auto from CTC" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', boxSizing: 'border-box' }} /></label>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Allowances annual<input type="number" min="0" value={editAllowances} onChange={(e) => setEditAllowances(e.target.value)} placeholder="Auto 15%" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', boxSizing: 'border-box' }} /></label>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Deductions annual<input type="number" min="0" value={editDeductions} onChange={(e) => setEditDeductions(e.target.value)} placeholder="0" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', boxSizing: 'border-box' }} /></label>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Effective from<input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', boxSizing: 'border-box' }} /></label>
              </div>
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
                <p style={{ fontSize: '11px', color: '#64748b' }}>Role: <strong style={{ color: '#374151' }}>{editEmp.designation ?? '—'}</strong></p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Type: <strong style={{ color: '#374151' }}>{editEmp.employmentType}</strong></p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Last Revised: <strong style={{ color: '#2563eb' }}>{fmtDate(editEmp.lastRevised)}</strong></p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => setEditEmp(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => void saveSalary()} disabled={saving} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: '8px', backgroundColor: saving ? '#94a3b8' : '#2563eb', color: 'white', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </LegacyDrawer>
      )}
    </div>
  );
}
