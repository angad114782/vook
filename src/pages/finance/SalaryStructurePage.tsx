import { useState } from 'react';
import type { SalaryRow } from '../../api/hr';
import { Edit2, Loader2, Download, Eye, BarChart2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useFinanceSalary } from '../../hooks/queries/useFinanceQueries';

const fmtCtc = (n: number | null) => n ? `₹${(n / 100000).toFixed(2)}L` : '—';
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#16a34a' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
  { bg: '#f0f9ff', color: '#0284c7' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'F').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function SalaryStructurePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('February');
  const [yearFilter, setYearFilter] = useState('2026');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [empFilter, setEmpFilter] = useState('All Employees');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (deptFilter !== 'All Departments') params.department = deptFilter;
  if (empFilter !== 'All Employees') params.employmentType = empFilter;

  const { data, isLoading: loading } = useFinanceSalary(params);
  const salary: SalaryRow[] = data?.results ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDeptChange   = (v: string) => { setDeptFilter(v); setPage(1); };
  const handleEmpChange    = (v: string) => { setEmpFilter(v); setPage(1); };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const selStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  const QUICK = [
    { label: 'View Attendance', icon: Eye,      path: '/finance/dashboard' },
    { label: 'Settings',        icon: Edit2,     path: '/finance/settings' },
    { label: 'Download Report', icon: Download,  path: '/finance/reports' },
    { label: 'View Reports',    icon: BarChart2, path: '/finance/reports' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Salary Structure</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Select the parameters for this payroll cycle</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={selStyle}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={selStyle}>
            <option>2026</option><option>2025</option><option>2024</option>
          </select>
          <select value={empFilter} onChange={(e) => handleEmpChange(e.target.value)} style={selStyle}>
            <option>All Employees</option><option>Permanent</option><option>Contract</option>
          </select>
          <select value={deptFilter} onChange={(e) => handleDeptChange(e.target.value)} style={selStyle}>
            <option>All Departments</option><option>Engineering</option><option>Sales</option><option>Finance</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['EMPLOYEE', 'ROLE', 'TYPE', 'ANNUAL CTC', 'LAST REVISED', 'ACTIONS'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salary.map((s, i) => {
                  const av = getAv(s.name);
                  return (
                    <tr key={s.id} style={{ borderBottom: i < salary.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>{initials(s.name)}</div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.name}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{s.designation ?? 'Line Supervisor'}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: s.employmentType === 'Permanent' ? '#dbeafe' : '#fef9c3', color: s.employmentType === 'Permanent' ? '#1d4ed8' : '#854d0e' }}>{s.employmentType}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtCtc(s.annualCtc)}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b' }}>{fmtDate(s.lastRevised)}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb' }}><Edit2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
                {salary.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>QUICK ACTIONS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {QUICK.map(({ label, icon: Icon, path }) => (
              <button key={label} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
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
