import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, Download, Loader2 } from 'lucide-react';
import { hrApi } from '../../../api/hr';
import { useEmployees } from '../../../hooks/queries/useHrQueries';
import { extractError } from '../../../utils/errorUtils';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);

function StepCircle({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${done || active ? '#2563eb' : '#e2e8f0'}`, backgroundColor: done ? '#2563eb' : active ? 'white' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {done
          ? <CheckCircle2 size={18} color="white" fill="#2563eb" />
          : <span style={{ fontSize: '13px', fontWeight: 700, color: active ? '#2563eb' : '#94a3b8' }}>{n}</span>
        }
      </div>
      <span style={{ fontSize: '10px', fontWeight: active ? 700 : 500, color: active ? '#2563eb' : '#94a3b8', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <div style={{ flex: 1, height: '2px', backgroundColor: done ? '#2563eb' : '#e2e8f0', marginBottom: '18px' }} />;
}

export default function CARunPayrollPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [step,    setStep]    = useState(1);
  const [month,   setMonth]   = useState(MONTHS[today.getMonth()]!);
  const [year,    setYear]    = useState(String(today.getFullYear()));
  const [locked,  setLocked]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState<{ created: number; skipped: number } | null>(null);

  const { data: employeesData, isLoading: employeesLoading } = useEmployees({ limit: '200', status: 'Active' });
  const eligibleEmployees = employeesData?.employees ?? [];

  const handleRunPayroll = async () => {
    setSaving(true);
    setError('');
    try {
      const monthNumber = MONTHS.indexOf(month) + 1;
      if (employeesLoading) { setError('Employee records are still loading. Please try again.'); return; }
      if (!eligibleEmployees.length) { setError('No active employees found for this run.'); return; }
      const periodEnd = new Date(Number(year), monthNumber, 0, 23, 59, 59, 999);
      const notStarted = eligibleEmployees.filter((employee) => employee.joiningDate && new Date(employee.joiningDate) > periodEnd);
      if (notStarted.length > 0) {
        setError(`No payable days in ${month} ${year} for: ${notStarted.map((employee) => `${employee.user.name} (${employee.employeeId})`).join(', ')}. Select the joining month or a later period.`);
        return;
      }
      const { data } = await hrApi.runPayroll({ month: monthNumber, year: Number(year), employeeIds: eligibleEmployees.map((employee) => employee.id) });
      await hrApi.finalizePayroll(data.runId);
      setResult({ created: data.created, skipped: data.skipped });
      setLocked(true);
    } catch (err) {
      setError(extractError(err, 'Failed to process payroll. Verify the selected period and salary setup.'));
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151',
    backgroundColor: 'white', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer',
  };

  if (locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '48px 40px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f0fdf4', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={32} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Payroll Finalized Successfully!</h2>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>{month} {year} payroll has been finalized. Payslips are now available to employees.</p>
          {result && (
            <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'left' }}>
              <p style={{ fontSize: '12px', color: '#0f172a', fontWeight: 700 }}>Run summary</p>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Created payslips: {result.created}</p>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Skipped existing payslips: {result.skipped}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
            <button
              onClick={() => navigate('/company-admin/payroll/payslips')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              <Download size={15} /> Generate Payslips
            </button>
            <button
              onClick={() => navigate('/company-admin/payroll/overview')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'white', color: '#374151', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              <Home size={15} /> Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Configure Payroll Run</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Select the parameters for this payroll cycle.</p>
      </div>

      {/* Step wizard */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', padding: '0 8px' }}>
        <StepCircle n={1} label="Configure Period" active={step === 1} done={step > 1} />
        <StepLine done={step > 1} />
        <StepCircle n={2} label="Review & Edit"    active={step === 2} done={step > 2} />
        <StepLine done={step > 2} />
        <StepCircle n={3} label="Validate & Lock"  active={step === 3} done={false} />
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} style={selectStyle}>
                {MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle}>
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            style={{ width: '100%', padding: '13px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            Generate Payroll Preview →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            {month} {year} — All active employees
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>This run includes {eligibleEmployees.length} active employee{eligibleEmployees.length === 1 ? '' : 's'}. Amounts are calculated from each employee’s saved salary structure, attendance, overtime, and approved reimbursements.</p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button onClick={() => setStep(1)} style={{ padding: '12px 20px', border: '1.5px solid #e2e8f0', borderRadius: '10px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
            <button onClick={() => setStep(3)} style={{ flex: 1, padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Proceed to Validate & Lock →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Validate & Lock Payroll</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Review the summary below. Once locked, payroll cannot be edited.</p>
          {error && <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px' }}>{error}</div>}

          <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Period',        value: `${month} ${year}` },
                { label: 'Employees',     value: `${eligibleEmployees.length} active employee${eligibleEmployees.length === 1 ? '' : 's'}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
                  <p style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600, marginTop: '3px' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>⚠ Once you lock the payroll, no further edits can be made for this cycle.</p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(2)} style={{ padding: '12px 20px', border: '1.5px solid #e2e8f0', borderRadius: '10px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
            <button
              onClick={() => void handleRunPayroll()}
              disabled={saving}
              style={{ flex: 1, padding: '12px', backgroundColor: saving ? '#94a3b8' : '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Lock & Process Payroll
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
