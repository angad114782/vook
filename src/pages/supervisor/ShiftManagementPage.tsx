import { useState, useMemo } from 'react';
import { Plus, AlertTriangle, Loader2, X } from 'lucide-react';
import type { Employee, ShiftAssignment, ShiftPlan, ShiftShortage } from '../../api/hr';
import { useSupShifts, useSupWorkforce } from '../../hooks/queries/useSupQueries';
import { useCreateShift } from '../../hooks/mutations/useHrMutations';
import { extractError } from '../../utils/errorUtils';
import { toast } from 'sonner';

type ShiftTab = 'Shift Assignment' | 'Workforce Planning' | 'Shortage Alerts';
const SHIFT_TABS: ShiftTab[] = ['Shift Assignment', 'Workforce Planning', 'Shortage Alerts'];
const SHIFT_ORDER: Array<'Morning' | 'Evening' | 'Night'> = ['Morning', 'Evening', 'Night'];

function ShiftCard({ label, color, employees }: { label: string; color: string; employees: ShiftAssignment[] }) {
  return (
    <div style={{ borderRadius: '12px', border: `2px solid ${color}20`, overflow: 'hidden' }}>
      <div style={{ backgroundColor: color, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{employees.length} workers</span>
      </div>
      <div style={{ backgroundColor: 'white' }}>
        {employees.map((e, i) => (
          <div key={i} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < employees.length - 1 ? `1px solid ${color}15` : 'none' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{e.name}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8' }}>{e.id} • {e.dept}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: '#64748b' }}>{e.role}</p>
              <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{e.shift}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShiftManagementPage() {
  const [tab, setTab] = useState<ShiftTab>('Shift Assignment');
  const [date, setDate] = useState('Today');
  const [department, setDepartment] = useState('All Departments');
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ employeeId: '', shiftName: 'Morning' as 'Morning' | 'Evening' | 'Night', date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');

  const createShift = useCreateShift();

  const shiftsParams = useMemo(() => {
    const params: Record<string, string> = { date: form.date };
    if (department !== 'All Departments') params.department = department;
    return params;
  }, [form.date, department]);

  const { data: shiftData, isLoading: shiftsLoading } = useSupShifts(shiftsParams);
  const { data: empData } = useSupWorkforce({ limit: '200' });

  const stats     = shiftData?.stats     ?? { totalWorkers: 0, morningShift: 0, eveningShift: 0, nightShift: 0 };
  const shifts    = shiftData?.shifts    ?? { Morning: [], Evening: [], Night: [] };
  const plans: ShiftPlan[]     = shiftData?.plans     ?? [];
  const shortages: ShiftShortage[] = shiftData?.shortages ?? [];
  const employees: Employee[]  = empData?.employees   ?? [];

  const loading = shiftsLoading;

  // Sync form.date when date tab changes
  const handleDateChange = (d: string) => {
    setDate(d);
    const next = d === 'Today'
      ? new Date()
      : d === 'Tomorrow'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date();
    setForm((prev) => ({ ...prev, date: next.toISOString().slice(0, 10) }));
  };

  const handleAssign = async () => {
    if (!form.employeeId) { setError('Select an employee'); return; }
    setError('');
    try {
      await createShift.mutateAsync(form);
      toast.success('Shift assigned successfully');
      setShowAssign(false);
      setForm((prev) => ({ ...prev, employeeId: '' }));
    } catch (err) {
      setError(extractError(err, 'Failed to assign shift. This employee may already have a shift for the selected date.'));
    }
  };

  const saving = createShift.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Shift Management</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage shift assignments and workforce planning</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAssign(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <Plus size={13} /> Assign Shift
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {SHIFT_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? '#0d7470' : 'transparent', color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {t}
            {t === 'Shortage Alerts' && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: tab === t ? '#f87171' : '#dc2626', display: 'inline-block' }} />}
          </button>
        ))}
      </div>

      {tab === 'Shift Assignment' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Date:</span>
            <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              {['Today', 'Tomorrow', 'This Week'].map((d) => (
                <button key={d} onClick={() => handleDateChange(d)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: date === d ? '#0d7470' : 'white', color: date === d ? 'white' : '#374151' }}>{d}</button>
              ))}
            </div>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              <option>All Departments</option>
              {[...new Set(employees.map((e) => e.department).filter(Boolean))].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[
              { label: 'Total Workers', value: String(stats.totalWorkers), sub: 'Assigned on selected date', badge: '' },
              { label: 'Morning Shift', value: String(stats.morningShift), sub: '06:00 - 14:00', badge: 'green' },
              { label: 'Evening Shift', value: String(stats.eveningShift), sub: '14:00 - 22:00', badge: 'yellow' },
              { label: 'Night Shift', value: String(stats.nightShift), sub: '22:00 - 06:00', badge: 'blue' },
            ].map(({ label, value, sub, badge }) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}</p>
                  {badge && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: badge === 'green' ? '#16a34a' : badge === 'yellow' ? '#f59e0b' : '#3b82f6' }} />}
                </div>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{value}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Shift cards */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <ShiftCard label="Morning Shift  06:00 - 14:00" color="#0d7470" employees={shifts.Morning} />
              <ShiftCard label="Evening Shift  14:00 - 22:00" color="#f59e0b" employees={shifts.Evening} />
              <ShiftCard label="Night Shift    22:00 - 06:00" color="#6366f1" employees={shifts.Night} />
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '12px' }}>QUICK ACTIONS</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {['Mark Attendance', 'Approve Leave', 'Assign Shifts', 'View Workforce'].map((label) => (
                <button key={label} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#0d7470'; el.style.backgroundColor = '#f0fdfa'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e2e8f0'; el.style.backgroundColor = 'white'; }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'Workforce Planning' && (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              <option>All Departments</option>
              {[...new Set(employees.map((e) => e.department).filter(Boolean))].map((d) => <option key={d}>{d}</option>)}
            </select>
            <select style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              <option>All Status</option>
              <option>Understaffed</option>
              <option>Fulfilled</option>
            </select>
            <button onClick={() => setShowAssign(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <Plus size={12} /> Assign Worker
            </button>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Department', 'Machine', 'Shift', 'Required', 'Action'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((row, i) => (
                  <tr key={`${row.department}-${row.shift}`} style={{ borderBottom: i < plans.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{row.department}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{row.department}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{row.shift}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{row.required}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: row.shortage > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{row.assigned} assigned</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'Shortage Alerts' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[
              { label: 'Total Plans', value: String(plans.length), color: '#374151', sub: 'Active planning rows' },
              { label: 'Understaffed', value: String(shortages.length), color: '#dc2626', sub: 'Need workers' },
              { label: 'Fully Staffed', value: String(plans.filter((p) => p.shortage === 0).length), color: '#16a34a', sub: 'Requirement met' },
              { label: 'Critical', value: String(shortages.filter((s) => s.severity === 'critical').length), color: '#7c3aed', sub: 'High shortage' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color, marginTop: '4px' }}>{value}</p>
                {sub && <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Summary bar */}
          <div style={{ backgroundColor: '#fff7ed', borderRadius: '10px', border: '1px solid #fed7aa', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} color="#ea580c" />
            <span style={{ fontSize: '13px', color: '#ea580c', fontWeight: 600 }}>
              {shortages.length === 0 ? 'No shift shortages for the selected date.' : `${shortages.length} shift groups are understaffed for the selected date.`}
            </span>
          </div>

          {/* Critical Shortages */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fef2f2' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#b91c1c' }}>● Critical Shortages</h3>
            </div>
            {shortages.filter((s) => s.severity === 'critical').map((s, i) => (
              <div key={i} style={{ padding: '14px 20px', borderBottom: i < shortages.filter((s) => s.severity === 'critical').length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{s.station}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.shift} • Required: {s.required} workers • Currently: {s.actual}</p>
                  <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '3px', fontWeight: 600 }}>Short by {s.required - s.actual} workers</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setShowAssign(true)} style={{ padding: '6px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Assign Worker</button>
                </div>
              </div>
            ))}
            {shortages.filter((s) => s.severity === 'critical').length === 0 && <div style={{ padding: '16px 20px', fontSize: '13px', color: '#94a3b8' }}>No critical shortages.</div>}
          </div>

          {/* Understaffed */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>● Understaffed</h3>
            </div>
            {shortages.filter((s) => s.severity !== 'critical').map((s, i) => (
              <div key={i} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{s.station}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.shift}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowAssign(true)} style={{ padding: '6px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Assign Worker</button>
                </div>
              </div>
            ))}
            {shortages.filter((s) => s.severity !== 'critical').length === 0 && <div style={{ padding: '16px 20px', fontSize: '13px', color: '#94a3b8' }}>No non-critical shortages.</div>}
          </div>
        </>
      )}

      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '420px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 18px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Assign Shift</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Create a shift assignment for the selected date.</p>
              </div>
              <button onClick={() => setShowAssign(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#64748b" /></button>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {error && <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px' }}>{error}</div>}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Employee</label>
                <select value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}>
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.user.name} · {e.employeeId}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Shift</label>
                  <select value={form.shiftName} onChange={(e) => setForm((prev) => ({ ...prev, shiftName: e.target.value as 'Morning' | 'Evening' | 'Night' }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}>
                    {SHIFT_ORDER.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAssign(false)} style={{ padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void handleAssign()} disabled={saving} style={{ padding: '9px 16px', border: 'none', borderRadius: '8px', backgroundColor: saving ? '#94a3b8' : '#0d7470', color: 'white', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Assign Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
