import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import type { Payslip } from '../../api/hr';
import { Eye, Download, Loader2, BarChart2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useFinancePayslips } from '../../hooks/queries/useFinanceQueries';

const fmtPay = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#dcfce7', color: '#15803d' },
  Processing: { bg: '#fef9c3', color: '#854d0e' },
  Pending:    { bg: '#f1f5f9', color: '#475569' },
};

const QUICK = [
  { label: 'View Attendance', icon: Eye },
  { label: 'Settings',        icon: Download },
  { label: 'Download Report', icon: Download },
  { label: 'View Reports',    icon: BarChart2 },
];

export default function PayslipsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('February');
  const [year, setYear] = useState('2026');
  const [dept, setDept] = useState('All Departments');
  const [empType, setEmpType] = useState('All Employees');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (dept !== 'All Departments') params.department = dept;
  if (empType !== 'All Employees') params.employmentType = empType;

  const { data, isLoading: loading } = useFinancePayslips(params);
  const payslips: Payslip[] = data?.payslips ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDeptChange   = (v: string) => { setDept(v); setPage(1); };
  const handleEmpChange    = (v: string) => { setEmpType(v); setPage(1); };

  const selStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Payslip <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginLeft: '6px' }}>{pagination.total} Records</span></h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Select the parameters for this payroll cycle</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by name or ID..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={selStyle}>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={selStyle}><option>2026</option><option>2025</option></select>
          <select value={dept} onChange={(e) => handleDeptChange(e.target.value)} style={selStyle}>
            <option>All Departments</option><option>Engineering</option><option>Sales</option><option>Finance</option>
          </select>
          <select value={empType} onChange={(e) => handleEmpChange(e.target.value)} style={selStyle}>
            <option>All Employees</option><option>Permanent</option><option>Contract</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['PAYSLIP ID', 'EMPLOYEE', 'PERIOD', 'NET PAY', 'STATUS', 'ACTIONS'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payslips.map((p, i) => {
                  const sm = STATUS_META[p.status] ?? STATUS_META['Pending']!;
                  return (
                    <tr key={p.id} style={{ borderBottom: i < payslips.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>{p.payslipId}</span></td>
                      <td style={{ padding: '12px 16px' }}><p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{p.employee.user.name}</p></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{p.period}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtPay(p.netPay)}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{p.status}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><Eye size={13} /></button>
                          <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><Download size={13} /></button>
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
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>QUICK ACTIONS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {QUICK.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => navigate('/finance/reports')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2563eb'; el.style.backgroundColor = '#eff6ff'; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e2e8f0'; el.style.backgroundColor = 'white'; }}>
                <Icon size={18} color="#2563eb" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'center' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />
    </div>
  );
}
