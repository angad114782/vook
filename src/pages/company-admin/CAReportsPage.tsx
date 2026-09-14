import { useState } from 'react';
import { Download, BarChart2, Clock, Users, CreditCard, X, Loader2 } from 'lucide-react';
import {
  useCaWorkforceReport,
  useCaLeaveReport,
  useCaPayrollReport,
  useCaAttendanceReport,
} from '../../hooks/queries/useCaQueries';

type ReportType = 'workforce' | 'payroll' | 'leave' | 'attendance';

const REPORT_CARDS: { id: ReportType; icon: typeof Clock; label: string; desc: string; color: string; bg: string }[] = [
  { id: 'attendance', icon: Clock,      label: 'Attendance Report',       desc: 'Monthly attendance summary — present, late, absent, leave, holiday.', color: '#0d7470', bg: '#f0fdfa' },
  { id: 'workforce',  icon: Users,      label: 'Workforce Report',         desc: 'Headcount, department distribution, employment type breakdown.', color: '#2563eb', bg: '#eff6ff' },
  { id: 'payroll',    icon: CreditCard, label: 'Payroll Report',           desc: 'Salary summary, gross, deductions, and net disbursements.', color: '#6366f1', bg: '#f5f3ff' },
  { id: 'leave',      icon: BarChart2,  label: 'Leave & Absence Report',   desc: 'Leave requests by status and type over a selected date range.', color: '#d97706', bg: '#fffbeb' },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  attendance: { bg: '#f0fdfa', color: '#0d7470' },
  payroll:    { bg: '#f5f3ff', color: '#6366f1' },
  workforce:  { bg: '#eff6ff', color: '#2563eb' },
  leave:      { bg: '#fffbeb', color: '#d97706' },
};

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── CSV download helper ──────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function CAReportsPage() {
  const [showModal,      setShowModal]      = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType>('attendance');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [atYear,         setAtYear]         = useState(String(new Date().getFullYear()));
  const [atMonth,        setAtMonth]        = useState(String(new Date().getMonth() + 1));
  const [previewData,    setPreviewData]    = useState<{ type: ReportType; rows: string[][]; headers: string[] } | null>(null);

  // Per-type enabled flags — set to true when user clicks Generate
  const [enabledWorkforce,  setEnabledWorkforce]  = useState(false);
  const [enabledLeave,      setEnabledLeave]      = useState(false);
  const [enabledPayroll,    setEnabledPayroll]     = useState(false);
  const [enabledAttendance, setEnabledAttendance] = useState(false);

  const leaveParams    = dateFrom || dateTo ? { from: dateFrom || undefined, to: dateTo || undefined } : undefined;
  const payrollParams  = dateFrom || dateTo ? { from: dateFrom || undefined, to: dateTo || undefined } : undefined;
  const attendParams   = { year: atYear, month: atMonth };

  const { data: workforceData,  isFetching: loadingWorkforce,  refetch: refetchWorkforce  } = useCaWorkforceReport(enabledWorkforce);
  const { data: leaveData,      isFetching: loadingLeave,      refetch: refetchLeave      } = useCaLeaveReport(leaveParams, enabledLeave);
  const { data: payrollData,    isFetching: loadingPayroll,    refetch: refetchPayroll    } = useCaPayrollReport(payrollParams, enabledPayroll);
  const { data: attendanceData, isFetching: loadingAttendance, refetch: refetchAttendance } = useCaAttendanceReport(attendParams, enabledAttendance);

  const generating = loadingWorkforce || loadingLeave || loadingPayroll || loadingAttendance;

  const openModal = (id: ReportType) => { setSelectedReport(id); setShowModal(true); setPreviewData(null); };

  const buildPreview = (type: ReportType): { headers: string[]; rows: string[][] } | null => {
    if (type === 'workforce' && workforceData) {
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Employees', String(workforceData.summary.total)],
          ['Active', String(workforceData.summary.active)],
          ['Inactive', String(workforceData.summary.inactive)],
          ...workforceData.byDepartment.map((d) => [`Dept: ${d.department}`, `${d.count} total, ${d.active} active`]),
          ...workforceData.byEmploymentType.map((t) => [`Type: ${t.type}`, String(t.count)]),
        ],
      };
    }
    if (type === 'leave' && leaveData) {
      return {
        headers: ['Category', 'Value'],
        rows: [
          ['Total Requests', String(leaveData.total)],
          ...leaveData.byStatus.map((s) => [`Status: ${s.status}`, String(s.count)]),
          ...leaveData.byType.map((t) => [`Type: ${t.type}`, String(t.count)]),
        ],
      };
    }
    if (type === 'payroll' && payrollData) {
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Payslips', String(payrollData.summary.count)],
          ['Total Gross',    fmtINR(payrollData.summary.totalGross)],
          ['Total Deductions', fmtINR(payrollData.summary.totalDeductions)],
          ['Total Net Paid',  fmtINR(payrollData.summary.totalNet)],
          ...payrollData.byMonth.map((m) => [`Month ${m.label}`, `${m.count} payslips, Net: ${fmtINR(m.net)}`]),
        ],
      };
    }
    if (type === 'attendance' && attendanceData) {
      return {
        headers: ['Status', 'Count'],
        rows: [
          ['Present',  String(attendanceData.byStatus.Present)],
          ['Late',     String(attendanceData.byStatus.Late)],
          ['Absent',   String(attendanceData.byStatus.Absent)],
          ['Leave',    String(attendanceData.byStatus.Leave)],
          ['Holiday',  String(attendanceData.byStatus.Holiday)],
          ['Total Records', String(attendanceData.totalRecords)],
          ['Total Employees', String(attendanceData.totalEmployees)],
        ],
      };
    }
    return null;
  };

  const handleGenerate = async () => {
    // Enable the selected report query and trigger a refetch
    if (selectedReport === 'workforce') {
      setEnabledWorkforce(true);
      await refetchWorkforce();
    } else if (selectedReport === 'leave') {
      setEnabledLeave(true);
      await refetchLeave();
    } else if (selectedReport === 'payroll') {
      setEnabledPayroll(true);
      await refetchPayroll();
    } else {
      setEnabledAttendance(true);
      await refetchAttendance();
    }

    const preview = buildPreview(selectedReport);
    if (preview) {
      setPreviewData({ type: selectedReport, ...preview });
    }
    setShowModal(false);
  };

  const handleDownload = () => {
    if (!previewData) return;
    const month = new Date().toISOString().slice(0, 7);
    downloadCSV(`${previewData.type}_report_${month}.csv`, [previewData.headers, ...previewData.rows]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Reports</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Generate and download custom reports for attendance, payroll, and workforce.</p>
      </div>

      {/* Report cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
        {REPORT_CARDS.map(({ id, icon: Icon, label, desc, color, bg }) => (
          <div key={id} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{label}</p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>{desc}</p>
                <button onClick={() => openModal(id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '12px', padding: '6px 14px', borderRadius: '7px', backgroundColor: color, border: 'none', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <Download size={11} /> Generate Report
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview panel */}
      {previewData && !showModal && (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: TYPE_COLORS[previewData.type]?.bg, color: TYPE_COLORS[previewData.type]?.color, textTransform: 'capitalize' }}>{previewData.type}</span>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Report Preview</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Download size={11} /> Download CSV
              </button>
              <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {previewData.headers.map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '10px 16px', fontSize: '12px', color: j === 0 ? '#374151' : '#0f172a', fontWeight: j === 1 ? 600 : 400, borderBottom: '1px solid #f1f5f9' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Generate Report</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Report Type</label>
                <select value={selectedReport} onChange={(e) => setSelectedReport(e.target.value as ReportType)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: 'white' }}>
                  {REPORT_CARDS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              {selectedReport === 'attendance' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Year</label>
                    <input type="number" value={atYear} onChange={(e) => setAtYear(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Month</label>
                    <select value={atMonth} onChange={(e) => setAtMonth(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: 'white' }}>
                      {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '9px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => void handleGenerate()} disabled={generating} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: '8px', backgroundColor: generating ? '#7ab8b6' : '#0d7470', color: 'white', fontSize: '12px', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
                {generating ? 'Generating…' : 'Generate & Preview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
