import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMgrAttendanceReport, useMgrWorkforceReport, useMgrPayrollReport } from '../../hooks/queries/useMgrQueries';

type ReportTab = 'Attendance Report' | 'Workforce Report' | 'Payroll Report';
const REPORT_TABS: ReportTab[] = ['Attendance Report', 'Workforce Report', 'Payroll Report'];

type AttendanceReport = {
  period: { year: number; month: number };
  totalRecords: number;
  totalEmployees: number;
  byStatus: { Present: number; Late: number; Absent: number; Leave: number; Holiday: number };
};

type WorkforceReport = {
  summary: { total: number; active: number; inactive: number };
  byDepartment: { department: string; count: number; active: number }[];
  byEmploymentType: { type: string; count: number }[];
};

type PayrollReport = {
  summary: { totalNet: number; totalGross: number; totalDeductions: number; count: number };
  byMonth: { label: string; net: number; count: number }[];
  recent: { id: string; employeeName: string; month: number; year: number; netSalary: number; status: string }[];
};

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function ManagerReportsPage() {
  const [tab, setTab] = useState<ReportTab>('Attendance Report');

  const { data: attendanceRaw, isLoading: attendanceLoading } = useMgrAttendanceReport(
    { year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1) },
    true,
  );
  const { data: workforceRaw, isLoading: workforceLoading } = useMgrWorkforceReport(true);
  const { data: payrollRaw, isLoading: payrollLoading } = useMgrPayrollReport(undefined, true);

  const loading = attendanceLoading || workforceLoading || payrollLoading;

  const attendance = attendanceRaw as AttendanceReport | undefined;
  const workforce = workforceRaw as WorkforceReport | undefined;
  const payroll = payrollRaw as PayrollReport | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Reports</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Live report data for attendance, workforce, and payroll.</p>
      </div>

      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {REPORT_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? '#0d7470' : 'transparent', color: tab === t ? 'white' : '#64748b' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
      ) : tab === 'Attendance Report' && attendance ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Total Records</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{attendance.totalRecords}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Employees Covered</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{attendance.totalEmployees}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Period</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{attendance.period.month}/{attendance.period.year}</p></div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
            {Object.entries(attendance.byStatus).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </>
      ) : tab === 'Workforce Report' && workforce ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Total Employees</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{workforce.summary.total}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Active</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>{workforce.summary.active}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Inactive</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>{workforce.summary.inactive}</p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Department Breakdown</h3>
              {workforce.byDepartment.map((d) => (
                <div key={d.department} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{d.department}</span>
                  <span style={{ fontSize: '13px', color: '#0f172a' }}>{d.active}/{d.count} active</span>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Employment Types</h3>
              {workforce.byEmploymentType.map((t) => (
                <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{t.type}</span>
                  <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : payroll ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Payslips</p><p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{payroll.summary.count}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Gross</p><p style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{fmtMoney(payroll.summary.totalGross)}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Deductions</p><p style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{fmtMoney(payroll.summary.totalDeductions)}</p></div>
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}><p style={{ fontSize: '11px', color: '#64748b' }}>Net</p><p style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{fmtMoney(payroll.summary.totalNet)}</p></div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Recent Payslips</h3>
            {payroll.recent.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{p.employeeName}</span>
                <span style={{ fontSize: '13px', color: '#0f172a' }}>{p.month}/{p.year} · {fmtMoney(p.netSalary)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
