import { useMemo, useState } from 'react';
import { Download, Clock, Loader2 } from 'lucide-react';
import { caApi } from '../../../api/companyAdmin';

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Payroll Summary',  desc: 'Consolidated view of all salary disbursements' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CAPayrollReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedType, setSelectedType] = useState('monthly');
  const [fromMonth,  setFromMonth]  = useState('January');
  const [toMonth,    setToMonth]    = useState(MONTHS[new Date().getMonth()]!);
  const [fromYear,   setFromYear]   = useState(String(currentYear));
  const [toYear,     setToYear]     = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<{ name: string; date: string; size: string }[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);

  const params = useMemo(() => {
    const fromMonthIndex = MONTHS.indexOf(fromMonth) + 1;
    const toMonthIndex = MONTHS.indexOf(toMonth) + 1;
    const from = `${fromYear}-${String(fromMonthIndex).padStart(2, '0')}-01`;
    const to = `${toYear}-${String(toMonthIndex).padStart(2, '0')}-31`;
    return { from, to };
  }, [fromMonth, fromYear, toMonth, toYear]);

  const downloadRows = (name: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await caApi.getPayrollReport(params);
      const rows: string[][] = [
        ['Metric', 'Value'],
        ['Total Payslips', String(data.summary.count)],
        ['Total Gross', String(data.summary.totalGross)],
        ['Total Deductions', String(data.summary.totalDeductions)],
        ['Total Net', String(data.summary.totalNet)],
        ...data.byMonth.map((m) => [`Month ${m.label}`, `Net ${m.net} / Count ${m.count}`]),
      ];
      setPreview(rows);
      const fileName = `payroll-report-${selectedType}-${Date.now()}.csv`;
      downloadRows(fileName, rows);
      setRecentDownloads((prev) => [{ name: fileName, date: new Date().toLocaleString('en-IN'), size: `${Math.max(1, Math.round(JSON.stringify(rows).length / 1024))} KB` }, ...prev].slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151',
    backgroundColor: 'white', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Generate Reports</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Select parameters to export payroll data.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left: config panel */}
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
          {/* Report type */}
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Report Type</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {REPORT_TYPES.map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setSelectedType(id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px', border: `1.5px solid ${selectedType === id ? '#2563eb' : '#e2e8f0'}`, borderRadius: '9px', backgroundColor: selectedType === id ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
                >
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${selectedType === id ? '#2563eb' : '#d1d5db'}`, backgroundColor: selectedType === id ? '#2563eb' : 'white', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedType === id && <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'white' }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: selectedType === id ? '#0f172a' : '#374151' }}>{label}</p>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>From Month</label>
              <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} style={selectStyle}>
                {MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={fromYear} onChange={(e) => setFromYear(e.target.value)} style={{ ...selectStyle, marginTop: '6px' }}>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>To Month</label>
              <select value={toMonth} onChange={(e) => setToMonth(e.target.value)} style={selectStyle}>
                {MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={toYear} onChange={(e) => setToYear(e.target.value)} style={{ ...selectStyle, marginTop: '6px' }}>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Format */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Format</label>
            <div className="product-notice">CSV export · includes the selected period and generated-at timestamp in the filename.</div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { setFromMonth('January'); setToMonth(MONTHS[new Date().getMonth()]!); setFromYear(String(currentYear)); setToYear(String(currentYear)); }}
              style={{ padding: '10px 20px', border: '1.5px solid #e2e8f0', borderRadius: '9px', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >Clear</button>
            <button
              onClick={() => void handleGenerate()}
              disabled={loading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />} Download Report
            </button>
          </div>
          {preview.length > 0 && (
            <div style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Preview</div>
              {preview.slice(0, 6).map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', fontSize: '12px' }}>
                  <span style={{ color: '#374151' }}>{row[0]}</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{row[1]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent downloads */}
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Recent Downloads</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recentDownloads.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>No reports downloaded in this session.</p>}
            {recentDownloads.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < recentDownloads.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={12} color="#94a3b8" />
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{r.name}</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{r.date} · {r.size}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
