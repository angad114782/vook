import { useState } from 'react';
import { CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';

const EMP_TYPES = ['All Employees','Permanent Staff','Contract Workers'];

interface NumInput { label: string; value: string; onChange: (v: string) => void }

function SpinnerInput({ label, value, onChange }: NumInput) {
  const num = parseFloat(value) || 0;
  return (
    <div>
      <p style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '5px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '110px' }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: '8px 10px', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#0f172a', fontFamily: 'Inter, sans-serif', width: '70px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
          <button onClick={() => onChange(String(+(num + 0.25).toFixed(2)))} style={{ padding: '4px 6px', border: 'none', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronUp size={10} color="#64748b" /></button>
          <button onClick={() => onChange(String(+(Math.max(0, num - 0.25)).toFixed(2)))} style={{ padding: '4px 6px', border: 'none', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronDown size={10} color="#64748b" /></button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', backgroundColor: on ? '#2563eb' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: '3px', left: on ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

function EmpSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '5px 24px 5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: 'white', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', cursor: 'pointer' }}>
      {EMP_TYPES.map((t) => <option key={t}>{t}</option>)}
    </select>
  );
}

export default function CACompliancePage() {
  // PF
  const [pfEnabled,   setPfEnabled]   = useState(true);
  const [pfEmpType,   setPfEmpType]   = useState('All Employees');
  const [pfEmpShare,  setPfEmpShare]  = useState('12');
  const [pfEmrShare,  setPfEmrShare]  = useState('12');

  // ESI
  const [esiEnabled,  setEsiEnabled]  = useState(true);
  const [esiEmpType,  setEsiEmpType]  = useState('All Employees');
  const [esiEmpShare, setEsiEmpShare] = useState('0.75');
  const [esiEmrShare, setEsiEmrShare] = useState('3.25');

  // PT
  const [ptEnabled,   setPtEnabled]   = useState(true);
  const [ptEmpType,   setPtEmpType]   = useState('All Employees');

  // TDS
  const [tdsEnabled,  setTdsEnabled]  = useState(true);
  const [tdsEmpType,  setTdsEmpType]  = useState('All Employees');
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = () => {
    setSaveMsg('Draft saved locally for this session. Backend persistence is still pending.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Statutory Configuration</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Select the parameters for this payroll cycle.</p>
        </div>
        <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          💾 Save Changes
        </button>
      </div>
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px' }}>
        <p style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Compliance configuration is still a draft UI. Live backend persistence has not been built yet.</p>
        {saveMsg && <p style={{ fontSize: '12px', color: '#a16207', marginTop: '6px' }}>{saveMsg}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

        {/* PF Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Provident Fund (PF)</h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Employee &amp; Employer Contribution Rules</p>
            </div>
            <EmpSelect value={pfEmpType} onChange={setPfEmpType} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Enable PF Deduction</span>
            <Toggle on={pfEnabled} onToggle={() => setPfEnabled((p) => !p)} />
          </div>
          {pfEnabled && (
            <>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                <SpinnerInput label="EMPLOYEE SHARE (%)" value={pfEmpShare} onChange={setPfEmpShare} />
                <SpinnerInput label="EMPLOYER SHARE (%)" value={pfEmrShare} onChange={setPfEmrShare} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '9px 12px' }}>
                <CheckCircle2 size={13} color="#16a34a" />
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 500 }}>Wage Limit: ₹25,000 / month</span>
              </div>
            </>
          )}
        </div>

        {/* ESI Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>ESI Corporation</h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Employee State Insurance Rules</p>
            </div>
            <EmpSelect value={esiEmpType} onChange={setEsiEmpType} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Enable ESI Deduction</span>
            <Toggle on={esiEnabled} onToggle={() => setEsiEnabled((p) => !p)} />
          </div>
          {esiEnabled && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <SpinnerInput label="EMPLOYEE SHARE (%)" value={esiEmpShare} onChange={setEsiEmpShare} />
              <SpinnerInput label="EMPLOYER SHARE (%)" value={esiEmrShare} onChange={setEsiEmrShare} />
            </div>
          )}
        </div>

        {/* PT Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Professional Tax (PT)</h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>State-wise Tax Slab Rules</p>
            </div>
            <EmpSelect value={ptEmpType} onChange={setPtEmpType} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Enable PT Deduction</span>
            <Toggle on={ptEnabled} onToggle={() => setPtEnabled((p) => !p)} />
          </div>
          {ptEnabled && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Salary Range</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Tax Amount</span>
              </div>
              {[
                { range: 'Up to ₹10,000',  tax: 'Nil'          },
                { range: 'Above ₹10,000',  tax: '₹200 / month' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: i === 0 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: '12px', color: '#374151' }}>{row.range}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{row.tax}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TDS Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Tax Deducted at Source</h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Income Tax Rules &amp; Regimes</p>
            </div>
            <EmpSelect value={tdsEmpType} onChange={setTdsEmpType} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Auto-calculate TDS</span>
            <Toggle on={tdsEnabled} onToggle={() => setTdsEnabled((p) => !p)} />
          </div>
          {tdsEnabled && (
            <>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                  TDS is calculated based on the employee's declared investment proofs and estimated annual income projection.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: 600, fontFamily: 'Inter, sans-serif', padding: 0 }}>View Tax Slabs</button>
                <span style={{ color: '#e2e8f0' }}>•</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: 600, fontFamily: 'Inter, sans-serif', padding: 0 }}>Manage Exemptions</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
