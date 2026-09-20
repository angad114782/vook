import { ResponsiveTable } from '../../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { Search, Download, Loader2, X, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { type Payslip } from '../../../api/hr';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import PaginationBar from '../../../components/data/Pagination';
import { useHrPayslips } from '../../../hooks/queries/useHrQueries';
import { hrApi } from '../../../api/hr';
import { useQueryClient } from '@tanstack/react-query';
import { extractError } from '../../../utils/errorUtils';
import LegacyDrawer from '../../../components/ui/LegacyDrawer';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = ['2024','2025','2026'];
const DEPTS  = ['All Departments','Engineering','Operations','HR','Finance','Sales','Support'];
const TYPES  = ['All Employees','Permanent','Contract'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#dcfce7', color: '#15803d' },
  Finalized:  { bg: '#dcfce7', color: '#15803d' },
  Processing: { bg: '#fed7aa', color: '#c2410c' },
  'On Hold':  { bg: '#fef9c3', color: '#a16207' },
  Pending:    { bg: '#f1f5f9', color: '#475569' },
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function CAPayslipsPage() {
  const today = new Date();
  const [search,      setSearch]      = useState('');
  const [month,       setMonth]       = useState(MONTHS[today.getMonth()]!);
  const [year,        setYear]        = useState(String(today.getFullYear()));
  const [dept,        setDept]        = useState('All Departments');
  const [type,        setType]        = useState('All Employees');
  const [page,        setPage]        = useState(1);
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const limit = 20;

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (month !== 'All Months') params.month = String(MONTHS.indexOf(month) + 1);
  if (year !== 'All Years') params.year = year;
  if (dept !== 'All Departments') params.department = dept;
  if (type !== 'All Employees') params.employmentType = type;

  const { data, isLoading: loading } = useHrPayslips(params);
  const payslips   = data?.payslips   ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDeptChange   = (v: string) => { setDept(v); setPage(1); };
  const handleTypeChange   = (v: string) => { setType(v); setPage(1); };
  const download = async (id: string, name: string) => {
    const { data } = await hrApi.downloadPayslip(id);
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(url);
  };
  const markPaid = async (id: string) => {
    if (!window.confirm('Mark this finalized payslip as paid?')) return;
    setPayingId(id);
    try {
      await hrApi.markPayslipPaid(id);
      await queryClient.invalidateQueries({ queryKey: ['hr', 'payslips'] });
      await queryClient.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
    } finally {
      setPayingId(null);
    }
  };
  const recalculate = async (payslip: Payslip) => {
    if (payslip.grossSalary !== 0 || payslip.totalDeductions !== 0 || payslip.netPay !== 0) return;
    if (!window.confirm(`Recalculate the zero-value payslip for ${payslip.employee.user.name}? Salary setup must already be corrected.`)) return;
    setActionError('');
    setRecalculatingId(payslip.id);
    try {
      await hrApi.recalculatePayslip(payslip.id);
      await queryClient.invalidateQueries({ queryKey: ['hr', 'payslips'] });
      await queryClient.invalidateQueries({ queryKey: ['ca', 'dashboard'] });
      setViewPayslip(null);
    } catch (err) {
      setActionError(extractError(err, 'Unable to recalculate payslip'));
    } finally {
      setRecalculatingId(null);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 28px 8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151',
    backgroundColor: 'white', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {actionError && <div style={{ padding: '11px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px' }}>{actionError}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Payslip History</h1>
            <span style={{ padding: '2px 10px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{pagination.total} Records</span>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>View and download payslips for all employees.</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Download size={13} /> Bulk Download
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by name or ID..." style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', width: '200px' }} />
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={selectStyle}>
          {MONTHS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle}>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select value={type} onChange={(e) => handleTypeChange(e.target.value)} style={selectStyle}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={dept} onChange={(e) => handleDeptChange(e.target.value)} style={selectStyle}>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#2563eb" /></div>
        ) : (
          <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['PAYSLIP ID', 'EMPLOYEE', 'PERIOD', 'NET PAY', 'STATUS', 'ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => {
                const sc = STATUS_STYLE[p.status] ?? STATUS_STYLE['Pending']!;
                return (
                  <tr key={p.id} onClick={() => setViewPayslip(p)} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}>
                    <td style={{ padding: '11px 14px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>{p.payslipId}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                          {ini(p.employee.user.name)}
                        </div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{p.employee.user.name}</p>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '12px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{p.period}</td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, color: '#2563eb', borderBottom: '1px solid #f1f5f9' }}>{fmt(p.netPay)}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); if (['Finalized', 'Paid'].includes(p.status)) void download(p.id, p.payslipId); }} disabled={!['Finalized', 'Paid'].includes(p.status)} style={{ background: 'none', border: 'none', cursor: ['Finalized', 'Paid'].includes(p.status) ? 'pointer' : 'not-allowed', color: '#2563eb', opacity: ['Finalized', 'Paid'].includes(p.status) ? 1 : 0.5 }} title="Download payslip"><Download size={15} /></button>
                        {p.grossSalary === 0 && p.totalDeductions === 0 && p.netPay === 0 && <button onClick={(e) => { e.stopPropagation(); void recalculate(p); }} disabled={recalculatingId === p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', borderRadius: '6px', padding: '4px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }} title="Recalculate zero-value payslip">{recalculatingId === p.id ? <Loader2 size={12} /> : <RefreshCw size={12} />} Fix</button>}
                        {p.status === 'Finalized' && <button onClick={(e) => { e.stopPropagation(); void markPaid(p.id); }} disabled={payingId === p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', borderRadius: '6px', padding: '4px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }} title="Mark as paid">{payingId === p.id ? <Loader2 size={12} /> : <CheckCircle2 size={12} />} Pay</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {payslips.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No payslips found</td></tr>
              )}
            </tbody>
          </ResponsiveTable>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />

      {/* Quick actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Download Payroll'].map((label) => (
            <button key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid #2563eb' }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewPayslip && (
        <LegacyDrawer open onClose={() => setViewPayslip(null)} direction="right" className="legacy-detail-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Payslip Detail</span>
              <button onClick={() => setViewPayslip(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {viewPayslip.grossSalary === 0 && viewPayslip.totalDeductions === 0 && viewPayslip.netPay === 0 && <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '11px', display: 'flex', gap: '7px', alignItems: 'flex-start' }}><AlertTriangle size={14} /> Salary setup was missing when this payslip was generated. Correct the employee salary structure, then choose Fix.</div>}
              {([
                ['Payslip ID',   viewPayslip.payslipId],
                ['Employee',     viewPayslip.employee.user.name],
                ['Period',       viewPayslip.period],
                ['Gross Salary', fmt(viewPayslip.grossSalary)],
                ['Deductions',   fmt(viewPayslip.totalDeductions)],
                ['Net Pay',      fmt(viewPayslip.netPay)],
                ['Status',       viewPayslip.status],
                ...(viewPayslip.snapshot?.calculationVersion === 'v2-detailed' ? [
                  ['Basic Salary', fmt(viewPayslip.snapshot.basicSalary ?? 0)],
                  ['Allowances', fmt(viewPayslip.snapshot.allowances ?? 0)],
                  ['Overtime Pay', fmt(viewPayslip.snapshot.overtimePay ?? 0)],
                  ['Reimbursements', fmt(viewPayslip.snapshot.reimbursementAmount ?? 0)],
                  ['Payable Days', String(viewPayslip.snapshot.payableDays ?? 0)],
                  ['Absent / Leave Days', String(viewPayslip.snapshot.absentDays ?? 0)],
                ] : []),
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: '13px', color: k === 'Net Pay' ? '#2563eb' : '#0f172a', fontWeight: k === 'Net Pay' ? 700 : 500 }}>{v}</span>
                </div>
              ))}
            </div>
            {viewPayslip.grossSalary === 0 && viewPayslip.totalDeductions === 0 && viewPayslip.netPay === 0 && <div style={{ padding: '0 22px 20px' }}><button onClick={() => void recalculate(viewPayslip)} disabled={recalculatingId === viewPayslip.id} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', background: '#2563eb', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{recalculatingId === viewPayslip.id ? 'Recalculating...' : 'Fix and recalculate payslip'}</button></div>}
          </div>
        </LegacyDrawer>
      )}
    </div>
  );
}
