import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { type Employee } from '../../api/hr';
import { extractError } from '../../utils/errorUtils';
import { Check, Loader2, ChevronRight } from 'lucide-react';
import { useFinanceEmployees } from '../../hooks/queries/useFinanceQueries';
import { useFinanceRunPayroll } from '../../hooks/mutations/useFinanceMutations';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: 'Select Employees' },
  { n: 2, label: 'Review Attendance' },
  { n: 3, label: 'Salary Calculation' },
  { n: 4, label: 'Finalize & Generate' },
];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#16a34a' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
  { bg: '#f0f9ff', color: '#0284c7' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'F').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtPay = (n: number) => `INR ${Math.round(n).toLocaleString('en-IN')}`;

function StepBar({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '24px' }}>
      {STEPS.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, backgroundColor: done ? '#2563eb' : active ? '#2563eb' : '#e2e8f0', color: done || active ? 'white' : '#94a3b8', transition: 'all 0.2s' }}>
                {done ? <Check size={13} /> : s.n}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: active ? '#2563eb' : done ? '#16a34a' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', backgroundColor: done ? '#2563eb' : '#e2e8f0', margin: '0 10px', minWidth: '20px', transition: 'background 0.2s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface EmpRow { emp: Employee; selected: boolean; daysPresent: number; leaves: number; ot: number }

export default function FinancePayrollPage() {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [generated, setGenerated] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const today = new Date();
  const [periodMonth, setPeriodMonth] = useState(today.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(today.getFullYear());

  const { data: empData, isLoading: loading } = useFinanceEmployees({ limit: '200' });
  const runPayroll = useFinanceRunPayroll();

  const employees = empData?.employees ?? [];

  // Initialize rows once employees are loaded
  useEffect(() => {
    const loadedEmployees = empData?.employees ?? [];
    if (loadedEmployees.length > 0 && rows.length === 0) {
      setRows(loadedEmployees.map((e) => ({
        emp: e,
        selected: false,
        daysPresent: 0,
        leaves: 0,
        ot: 0,
      })));
    }
  }, [empData?.employees, rows.length]);

  const toggleAll = (v: boolean) => setRows((r) => r.map((x) => filtered.some((item) => item.emp.id === x.emp.id) ? { ...x, selected: v } : x));
  const toggleRow = (id: string) => setRows((r) => r.map((x) => x.emp.id === id ? { ...x, selected: !x.selected } : x));

  const selected = rows.filter((r) => r.selected);
  const filtered = typeFilter === 'All Types' ? rows : rows.filter((r) => r.emp.employmentType === typeFilter);

  const calcSalary = (r: EmpRow) => {
    const base = Math.max(0, r.emp.annualCtc ?? 0) / 12;
    const allowance = base * 0.15;
    const deduction = (r.leaves * base) / 26;
    const net = base + allowance - deduction;
    return { base, allowance, deduction, net, configured: base > 0 };
  };

  const totalNet = selected.reduce((s, r) => s + calcSalary(r).net, 0);
  const holdCount = selected.filter((r) => r.leaves > 2).length;
  const holdAmt = selected.filter((r) => r.leaves > 2).reduce((s, r) => s + calcSalary(r).net, 0);
  const missingSalary = selected.filter((r) => !calcSalary(r).configured);
  const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59, 999);
  const noPayableDays = selected.filter((r) => r.emp.joiningDate && new Date(r.emp.joiningDate) > periodEnd);

  const handleGenerate = () => {
    setGenerateError('');
    if (selected.length === 0) {
      setGenerateError('Select at least one employee before generating payroll.');
      return;
    }
    if (missingSalary.length > 0) {
      setGenerateError(`Add a positive annual CTC for: ${missingSalary.map((r) => `${r.emp.user.name} (${r.emp.employeeId})`).join(', ')}.`);
      return;
    }
    if (noPayableDays.length > 0) {
      setGenerateError(`No payable days in the selected period for: ${noPayableDays.map((r) => `${r.emp.user.name} (${r.emp.employeeId})`).join(', ')}. Select the employee's joining month or a later period.`);
      return;
    }
    runPayroll.mutate(
      {
        month: periodMonth,
        year: periodYear,
        employeeIds: selected.map((r) => r.emp.id),
      },
      {
        onSuccess: () => {
          setGenerated(true);
          toast.success('Payslips generated successfully');
        },
        onError: (err) => {
          const message = extractError(err, 'Failed to generate payslips');
          setGenerateError(message);
          toast.error(message);
        },
      },
    );
  };

  const generating = runPayroll.isPending;

  const btnStyle = (disabled = false): React.CSSProperties => ({
    padding: '9px 22px', backgroundColor: disabled ? '#e2e8f0' : '#2563eb', border: 'none', borderRadius: '8px',
    color: disabled ? '#94a3b8' : 'white', fontSize: '13px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Payroll Management</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Process salary for all employees for a selected period</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
        <StepBar step={step} />

        {/* Step 1 – Select Employees */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Select Employees</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} aria-label="Payroll month" style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
                <select value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} aria-label="Payroll year" style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  {['All Types', 'Permanent', 'Contract'].map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: typeFilter === t ? '#2563eb' : 'white', color: typeFilter === t ? 'white' : '#374151' }}>{t}</button>
                  ))}
                </div>
                <select style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                  <option>Pending</option><option>All</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#2563eb" /></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', width: '32px' }}>
                        <input type="checkbox" checked={filtered.every((r) => r.selected)} onChange={(e) => toggleAll(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                      </th>
                      {['Employee', 'Type', 'Department', 'Status'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const av = getAv(r.emp.user.name);
                      return (
                        <tr key={r.emp.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.emp.id)} style={{ accentColor: '#2563eb' }} />
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '9px', flexShrink: 0 }}>{initials(r.emp.user.name)}</div>
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{r.emp.user.name}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8' }}>{r.emp.employeeId}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: r.emp.employmentType === 'Permanent' ? '#dbeafe' : '#fef9c3', color: r.emp.employmentType === 'Permanent' ? '#1d4ed8' : '#854d0e' }}>{r.emp.employmentType}</span>
                          </td>
                          <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{r.emp.department ?? '—'}</span></td>
                          <td style={{ padding: '11px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fff7ed', color: '#ea580c' }}>Pending</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>{selected.length} of {employees.length} employees selected</span>
              <button onClick={() => selected.length > 0 && missingSalary.length === 0 && noPayableDays.length === 0 && setStep(2)} style={btnStyle(selected.length === 0 || missingSalary.length > 0 || noPayableDays.length > 0)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
            {missingSalary.length > 0 && (
              <div style={{ marginTop: '12px', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '12px' }}>
                Salary setup is missing for {missingSalary.length} selected employee{missingSalary.length === 1 ? '' : 's'}. Add Annual CTC in Salary Structure before continuing.
              </div>
            )}
            {noPayableDays.length > 0 && (
              <div style={{ marginTop: '12px', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '12px' }}>
                {noPayableDays.map((r) => `${r.emp.user.name} (${r.emp.employeeId})`).join(', ')} joined after this payroll period. Select the employee&apos;s joining month or a later period.
              </div>
            )}
          </>
        )}

        {/* Step 2 – Review Attendance */}
        {step === 2 && (
          <>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Review Attendance</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Employee', 'Days Present', 'Leaves', 'Overtime Days', 'Issues'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((r, i) => (
                    <tr key={r.emp.id} style={{ borderBottom: i < selected.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{r.emp.user.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>{r.emp.employeeId}</p>
                      </td>
                      <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{r.daysPresent}</span></td>
                      <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{r.leaves}</span></td>
                      <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{r.ot}</span></td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: r.leaves > 2 ? '#ea580c' : '#16a34a', backgroundColor: r.leaves > 2 ? '#fff7ed' : '#f0fdf4', padding: '2px 8px', borderRadius: '20px' }}>{r.leaves > 2 ? 'Review Needed' : 'No Issues'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#374151' }}>Total</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>{selected.reduce((s, r) => s + r.daysPresent, 0)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>{selected.reduce((s, r) => s + r.leaves, 0)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>{selected.reduce((s, r) => s + r.ot, 0)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#ea580c' }}>{selected.filter((r) => r.leaves > 2).length} pending</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
              <button onClick={() => setStep(3)} style={btnStyle()}>Next <ChevronRight size={14} /></button>
            </div>
          </>
        )}

        {/* Step 3 – Salary Calculation */}
        {step === 3 && (
          <>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Salary Calculation</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Employee', 'Basic Salary', 'Allowances', 'Deductions', 'Net Salary', 'Details'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((r, i) => {
                    const { base, allowance, deduction, net, configured } = calcSalary(r);
                    return (
                      <tr key={r.emp.id} style={{ borderBottom: i < selected.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{r.emp.user.name}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{r.emp.employeeId}</p>
                        </td>
                        <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: configured ? '#374151' : '#dc2626' }}>{configured ? fmtPay(base) : 'Not configured'}</span></td>
                        <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>+{fmtPay(Math.round(allowance))}</span></td>
                        <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>-{fmtPay(Math.round(deduction))}</span></td>
                        <td style={{ padding: '11px 14px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtPay(Math.round(net))}</span></td>
                        <td style={{ padding: '11px 14px' }}><button style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View →</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setStep(2)} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
              <button onClick={() => setStep(4)} style={btnStyle()}>Next <ChevronRight size={14} /></button>
            </div>
          </>
        )}

        {/* Step 4 – Finalize & Generate */}
        {step === 4 && (
          <>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Payroll Summary</h3>
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Employee', 'Net Salary'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((r, i) => {
                    const av = getAv(r.emp.user.name);
                    const { net } = calcSalary(r);
                    return (
                      <tr key={r.emp.id} style={{ borderBottom: i < selected.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '9px', flexShrink: 0 }}>{initials(r.emp.user.name)}</div>
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{r.emp.user.name}</p>
                              <p style={{ fontSize: '11px', color: '#94a3b8' }}>{r.emp.designation ?? r.emp.department}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmtPay(Math.round(net))}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Processed</p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{selected.length - holdCount}</p>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Amount</p>
                <p style={{ fontSize: '17px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{fmtPay(Math.round(totalNet - holdAmt))}</p>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Holding</p>
                <p style={{ fontSize: '17px', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>{fmtPay(Math.round(holdAmt))}</p>
              </div>
            </div>

            {generated && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} color="#16a34a" />
                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>Payslips generated successfully for {selected.length - holdCount} employees.</span>
              </div>
            )}
            {generateError && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 600 }}>{generateError}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => { setStep(3); setGenerated(false); }} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', alignSelf: 'center' }}>QUICK ACTIONS</p>
                <button onClick={() => handleGenerate()} disabled={generating || generated} style={btnStyle(generating || generated)}>
                  {generating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : generated ? '✓ Payslips Generated' : 'Generate Payslips →'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
