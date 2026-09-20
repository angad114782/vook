import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Shield, FileText, BarChart2, Play, Loader2 } from 'lucide-react';
import { type Payslip, type SalaryRow } from '../../../api/hr';
import { useHrSalary, useHrPayslips } from '../../../hooks/queries/useHrQueries';
import { useCaPayrollReport } from '../../../hooks/queries/useCaQueries';

const MONTHS_LIST = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = ['2024','2025','2026'];
const DEPTS_FILTER = ['All Departments','Engineering','Operations','HR','Finance','Sales','Support'];
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/* ── Quick Actions ───────────────────────────── */
export default function CAPayrollOverviewPage() {
  const navigate = useNavigate();
  const [period,  setPeriod]  = useState('February');
  const [year,    setYear]    = useState('2026');
  const [dept,    setDept]    = useState('All Departments');
  const salaryParams: Record<string, string> = { limit: '200' };
  if (dept !== 'All Departments') salaryParams.department = dept;

  const { data: salaryData,   isLoading: salaryLoading   } = useHrSalary(salaryParams);
  const { data: payslipsData, isLoading: payslipsLoading } = useHrPayslips({ limit: '200' });
  const { data: payrollReport, isLoading: reportLoading  } = useCaPayrollReport(undefined, true);

  const salaryRows = useMemo(() => (salaryData?.results ?? []) as SalaryRow[], [salaryData?.results]);
  const payslips   = (payslipsData?.payslips ?? []) as Payslip[];
  const loading    = salaryLoading || payslipsLoading || reportLoading;

  const departmentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    salaryRows.forEach((row) => {
      const key = row.department ?? 'Unassigned';
      map.set(key, (map.get(key) ?? 0) + ((row.annualCtc ?? 0) / 12));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries()).map(([name, amount]) => ({
      name,
      amount,
      pct: total ? Math.round((amount / total) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [salaryRows]);

  const sel: React.CSSProperties = {
    padding: '7px 26px 7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151',
    backgroundColor: 'white', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', cursor: 'pointer',
  };

  const totalEmployees = salaryRows.length || 1;
  const processed = payslips.filter((p) => ['Finalized', 'Paid'].includes(p.status)).length;
  const pending = payslips.filter((p) => p.status !== 'Paid').length;
  const procPct = Math.round((processed / totalEmployees) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header ── */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Payroll Management</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Manage salaries, payslips, and compliance</p>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Period:</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={sel}>
          {MONTHS_LIST.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} style={sel}>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Dept:</span>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={sel}>
          {DEPTS_FILTER.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '70px' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} color="#2563eb" /></div>
      ) : (
        <>
          <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
            {[
              { label: 'TOTAL PAYROLL COST', value: fmtMoney(payrollReport?.summary.totalGross ?? 0), sub: `${salaryRows.length} salary rows`, subColor: '#2563eb' },
              { label: 'NET SALARY PAYABLE', value: fmtMoney(payrollReport?.summary.totalNet ?? 0), sub: `${processed} paid payslips`, subColor: '#2563eb' },
              { label: 'TOTAL DEDUCTIONS', value: fmtMoney(payrollReport?.summary.totalDeductions ?? 0), sub: 'PF, tax, leave deductions', subColor: '#dc2626' },
              { label: 'PAYSLIPS GENERATED', value: String(payrollReport?.summary.count ?? 0), sub: `${pending} pending review`, subColor: '#d97706' },
            ].map(({ label, value, sub, subColor }) => (
              <div key={label} className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.4 }}>{label}</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '10px', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '11px', color: subColor, marginTop: '7px', fontWeight: 500 }}>{sub}</p>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Payroll Cost Trend</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(payrollReport?.byMonth ?? []).map((m) => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: '12px', color: '#0f172a' }}>{fmtMoney(m.net)} · {m.count} payslips</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

            <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Department-wise Payroll</h3>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>{period} {year}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {departmentBreakdown.map((row) => (
                  <div key={row.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{row.name}</span>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{fmtMoney(row.amount)}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', minWidth: '28px', textAlign: 'right' }}>{row.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: '7px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${row.pct}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Processing Status</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{totalEmployees} employees</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                  <svg viewBox="0 0 80 80" style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#2563eb" strokeWidth="10" strokeDasharray={`${(procPct / 100) * 201} 201`} strokeLinecap="round"/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{procPct}%</span>
                    <span style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 600 }}>Done</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>
                    <strong style={{ color: '#2563eb' }}>{processed}</strong> paid payslips out of {totalEmployees} active salary rows.
                  </p>
                  <p style={{ fontSize: '11px', color: '#d97706', marginTop: '4px', fontWeight: 500 }}>
                    {pending} still pending action
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  { label: 'Processed', count: processed, color: '#2563eb' },
                  { label: 'Pending', count: pending, color: '#d97706' },
                ].map(({ label, count, color }) => {
                  const pct = Math.round((count / totalEmployees) * 100);
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '76px', fontSize: '11px', color: '#374151', fontWeight: 500 }}>{label}</span>
                      <div style={{ flex: 1, height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
                      </div>
                      <span style={{ width: '32px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>QUICK ACTIONS</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px' }}>
              {[
                { label: 'Run Payroll', Icon: Play, path: '/company-admin/payroll/run' },
                { label: 'Payroll Reports', Icon: Download, path: '/company-admin/payroll/reports' },
                { label: 'Manage Roles', Icon: Shield, path: '/company-admin/settings/roles' },
                { label: 'Payslips', Icon: FileText, path: '/company-admin/payroll/payslips' },
                { label: 'View Reports', Icon: BarChart2, path: '/company-admin/reports' },
              ].map(({ label, Icon, path }) => (
                <button key={label} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '13px 8px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color="#2563eb" />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
