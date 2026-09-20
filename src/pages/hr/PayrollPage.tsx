import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useSearchParams } from 'react-router-dom';
import { type SalaryRow, type Payslip } from '../../api/hr';
import { DollarSign, Download, Loader2 } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useHrSalary, useHrPayslips } from '../../hooks/queries/useHrQueries';

const fmtCtc = (n: number | null) => n ? `₹${(n / 100000).toFixed(2)}L` : '—';
const fmtPay = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#16a34a' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
  { bg: '#f0f9ff', color: '#0284c7' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'H').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#dcfce7', color: '#15803d' },
  Processing: { bg: '#fef9c3', color: '#854d0e' },
  Pending:    { bg: '#f1f5f9', color: '#475569' },
};

export default function PayrollPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const tab = urlParams.get('tab') === 'payslips' ? 'payslips' : 'salary';
  const search = urlParams.get('search') ?? '';
  const page = Math.max(1, Number(urlParams.get('page') ?? '1') || 1);
  const limit = 20;

  const updateUrl = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(urlParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setUrlParams(next, { replace: true });
  };

  const debouncedSearch = useDebouncedValue(search, 500);
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data: salaryData, isLoading: salaryLoading } = useHrSalary(tab === 'salary' ? params : undefined);
  const { data: payslipData, isLoading: payslipLoading } = useHrPayslips(tab === 'payslips' ? params : undefined);

  const salary: SalaryRow[] = salaryData?.results ?? [];
  const payslips: Payslip[] = payslipData?.payslips ?? [];
  const pagination = (tab === 'salary' ? salaryData?.pagination : payslipData?.pagination) ?? { total: 0, page: 1, limit: 20, totalPages: 1 };
  const loading = tab === 'salary' ? salaryLoading : payslipLoading;

  const handleTabChange    = (t: 'salary' | 'payslips') => updateUrl({ tab: t === 'salary' ? null : t, search: null, page: '1' });
  const handleSearchChange = (v: string) => updateUrl({ search: v || null, page: '1' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Payroll</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Select the parameters for this payroll cycle</p>
        </div>
        <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '9px', overflow: 'hidden', backgroundColor: 'white' }}>
          {([
            { key: 'salary',   label: 'Salary Structure' },
            { key: 'payslips', label: 'Payslip History'  },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => handleTabChange(key)} style={{ padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === key ? '#2563eb' : 'white', color: tab === key ? 'white' : '#64748b', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{tab === 'salary' ? 'Salary Structure' : 'Payslip History'}</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc', width: '180px' }} />
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span></div>
        ) : tab === 'salary' ? (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee', 'Role', 'Type', 'Annual CTC', 'Last Revised', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salary.map((s, i) => {
                  const av = getAv(s.name);
                  return (
                    <tr key={s.id} style={{ borderBottom: i < salary.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>{initials(s.name)}</div>
                          <div><p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.name}</p><p style={{ fontSize: '11px', color: '#94a3b8' }}>{s.employeeId}</p></div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{s.designation ?? '—'}</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: s.employmentType === 'Permanent' ? '#dbeafe' : '#f5f3ff', color: s.employmentType === 'Permanent' ? '#1d4ed8' : '#6d28d9' }}>{s.employmentType}</span>
                      </td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtCtc(s.annualCtc)}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '12px', color: '#64748b' }}>{fmtDate(s.lastRevised)}</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                          <DollarSign size={12} /> Revise
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {salary.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No salary records found</td></tr>}
              </tbody>
            </ResponsiveTable>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Payslip ID', 'Employee', 'Period', 'Net Pay', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payslips.map((p, i) => {
                  const av = getAv(p.employee.user.name);
                  const sm = STATUS_META[p.status] ?? STATUS_META['Pending']!;
                  return (
                    <tr key={p.id} style={{ borderBottom: i < payslips.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>{p.payslipId}</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '9px', flexShrink: 0 }}>{initials(p.employee.user.name)}</div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{p.employee.user.name}</p>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{p.period}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtPay(p.netPay)}</span></td>
                      <td style={{ padding: '12px 18px' }}><span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{p.status}</span></td>
                      <td style={{ padding: '12px 18px' }}>
                        <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><Download size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
                {payslips.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No payslips found</td></tr>}
              </tbody>
            </ResponsiveTable>
          </div>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => updateUrl({ page: String(p) })} />

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 22px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[{ label: 'Download Payroll' }, { label: 'Manage Roles' }, { label: 'Download Summary' }, { label: 'View Reports' }].map((q) => (
            <button key={q.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#f8fafc'; el.style.borderColor = '#2563eb'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'white'; el.style.borderColor = '#e2e8f0'; }}
            >
              <Download size={20} color="#2563eb" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
