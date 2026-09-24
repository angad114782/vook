import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useFinancePayrollReport, useFinanceAttendanceReport, useFinanceWorkforceReport } from '../../hooks/queries/useFinanceQueries';
import { useAccess } from '../../hooks/queries/useAccess';

type Tab = 'Payroll Report' | 'Attendance Inputs' | 'Workforce';
const TABS: Tab[] = ['Payroll Report', 'Attendance Inputs', 'Workforce'];


function SummaryRow({ items }: { items: { label: string; value: string; trend?: string; up?: boolean }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
      {items.map(({ label, value, trend, up }) => (
        <div key={label} style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px 14px' }}>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{value}</p>
          {trend && <p style={{ fontSize: '10px', fontWeight: 700, color: up ? '#16a34a' : '#dc2626', marginTop: '2px' }}>{up ? '↑' : '↓'} {trend}</p>}
        </div>
      ))}
    </div>
  );
}

type PayrollReport = {
  summary: { totalNet: number; totalGross: number; totalDeductions: number; count: number };
  byMonth: { label: string; net: number; count: number }[];
};

type AttendanceReport = {
  totalRecords: number;
  totalEmployees: number;
  byStatus: { Present: number; Late: number; Absent: number; Leave: number; Holiday: number };
};

type WorkforceReport = {
  summary: { total: number; active: number; inactive: number };
  byDepartment: { department: string; count: number; active: number }[];
};

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function FinanceReportsPage() {
  const access = useAccess();
  const canExport = access.can('REPORTS_ANALYTICS.EXPORT');
  const [tab, setTab] = useState<Tab>('Payroll Report');

  const { data: payroll, isLoading: payrollLoading } = useFinancePayrollReport(undefined, true);
  const { data: attendance, isLoading: attendanceLoading } = useFinanceAttendanceReport(
    { year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1) },
    true,
  );
  const { data: workforce, isLoading: workforceLoading } = useFinanceWorkforceReport(true);

  const loading = payrollLoading || attendanceLoading || workforceLoading;

  const payrollData = payroll as PayrollReport | undefined;
  const attendanceData = attendance as AttendanceReport | undefined;
  const workforceData = workforce as WorkforceReport | undefined;
  const exportReport = () => {
    let rows: Array<Array<string | number>> = [];
    if (tab === 'Payroll Report' && payrollData) rows = [['Period', 'Net pay', 'Payslips'], ...payrollData.byMonth.map((item) => [item.label, item.net, item.count])];
    if (tab === 'Attendance Inputs' && attendanceData) rows = [['Status', 'Records'], ...Object.entries(attendanceData.byStatus)];
    if (tab === 'Workforce' && workforceData) rows = [['Department', 'Employees', 'Active'], ...workforceData.byDepartment.map((item) => [item.department, item.count, item.active])];
    if (!rows.length) return;
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${tab.toLowerCase().replaceAll(' ', '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Reports</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Financial summaries and analytics across payroll, expenses, and costs</p>
        </div>
        {canExport && <button onClick={exportReport} disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Download size={15} aria-hidden="true" /> Export CSV</button>}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ padding: '4px', display: 'flex', gap: '2px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? '#2563eb' : 'transparent', color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s' }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#2563eb" /></div>
          ) : tab === 'Payroll Report' && payrollData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Live Payroll Summary</h3>
              </div>
              <SummaryRow items={[
                { label: 'Total Net', value: fmtMoney(payrollData.summary.totalNet) },
                { label: 'Gross', value: fmtMoney(payrollData.summary.totalGross) },
                { label: 'Deductions', value: fmtMoney(payrollData.summary.totalDeductions) },
                { label: 'Payslips', value: String(payrollData.summary.count) },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {payrollData.byMonth.map((m) => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: '12px', color: '#0f172a' }}>{fmtMoney(m.net)} · {m.count} payslips</span>
                  </div>
                ))}
              </div>
            </>
          ) : tab === 'Attendance Inputs' && attendanceData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Attendance Cost Inputs</h3>
              </div>
              <SummaryRow items={[
                { label: 'Present', value: String(attendanceData.byStatus.Present) },
                { label: 'Late', value: String(attendanceData.byStatus.Late) },
                { label: 'Absent', value: String(attendanceData.byStatus.Absent) },
                { label: 'Leave', value: String(attendanceData.byStatus.Leave) },
              ]} />
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(attendanceData.byStatus).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', width: '90px' }}>{label}</span>
                    <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${attendanceData.totalRecords ? (value / attendanceData.totalRecords) * 100 : 0}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', width: '30px', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : workforceData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Workforce Cost Base</h3>
              </div>
              <SummaryRow items={[
                { label: 'Total Employees', value: String(workforceData.summary.total) },
                { label: 'Active', value: String(workforceData.summary.active) },
                { label: 'Inactive', value: String(workforceData.summary.inactive) },
                { label: 'Departments', value: String(workforceData.byDepartment.length) },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {workforceData.byDepartment.map((d) => (
                  <div key={d.department} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{d.department}</span>
                    <span style={{ fontSize: '12px', color: '#0f172a' }}>{d.active}/{d.count} active</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
