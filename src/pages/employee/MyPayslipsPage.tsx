import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import type { MyPayslip } from '../../api/employee';
import { Download, Loader2, X } from 'lucide-react';
import { useMyPayslips } from '../../hooks/queries/useEmployeeQueries';
import { employeeApi } from '../../api/employee';
import LegacyDrawer from '../../components/ui/LegacyDrawer';

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#dcfce7', color: '#15803d' },
  Finalized:  { bg: '#dcfce7', color: '#15803d' },
  Processing: { bg: '#fef9c3', color: '#854d0e' },
  Pending:    { bg: '#f1f5f9', color: '#475569' },
};

const fmtPay = (n: number) => `INR ${Math.round(n).toLocaleString('en-IN')}`;

export default function MyPayslipsPage() {
  const [viewPayslip, setViewPayslip] = useState<MyPayslip | null>(null);

  const { data, isLoading: loading } = useMyPayslips();
  const payslips: MyPayslip[] = data ?? [];

  const finalized = (p: MyPayslip) => ['Finalized', 'Paid'].includes(p.status);
  const latestPaid = payslips.find(finalized);
  const totalYTD   = payslips.filter(finalized).reduce((s, p) => s + p.netPay, 0);
  const download = async (id: string, name: string) => {
    const { data } = await employeeApi.downloadPayslip(id);
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>My Payslips</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>View and download your monthly salary statements</p>
      </div>

      {/* Summary cards */}
      <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        <div className="responsive-stat-card" style={{ backgroundColor: '#0d4a47', borderRadius: '12px', padding: '18px 20px', color: 'white' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Latest Net Pay</p>
          <p style={{ fontSize: '26px', fontWeight: 800, marginTop: '6px' }}>{latestPaid ? fmtPay(latestPaid.netPay) : '—'}</p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>{latestPaid?.period ?? 'No paid payslip'}</p>
        </div>
        <div className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Earned YTD</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{fmtPay(totalYTD)}</p>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{payslips.filter(finalized).length} finalized payslip(s)</p>
        </div>
        <div className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Payslips</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{payslips.length}</p>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{payslips.filter(finalized).length} finalized</p>
        </div>
      </div>

      {/* Net pay trend - mini SVG */}
      {payslips.length >= 2 && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Net Pay Trend</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            {[...payslips].reverse().map((p, _i, arr) => {
              const max = Math.max(...arr.map((x) => x.netPay));
              const pct = (p.netPay / max) * 100;
              return (
                <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#0d7470' }}>{fmtPay(p.netPay)}</span>
                  <div style={{ width: '100%', height: '50px', display: 'flex', alignItems: 'flex-end', padding: '0 3px', boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', height: `${pct}%`, backgroundColor: p.status === 'Processing' ? '#fcd34d' : '#0d7470', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                  </div>
                  <span style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>{p.period.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payslip table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>All Payslips</h3>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
        ) : (
          <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['Payslip ID', 'Period', 'Net Pay', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => {
                const sm = STATUS_META[p.status] ?? STATUS_META['Pending']!;
                return (
                  <tr key={p.id} onClick={() => setViewPayslip(p)} style={{ borderBottom: i < payslips.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                    <td style={{ padding: '14px 20px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: '#0d7470', fontFamily: 'monospace' }}>{p.payslipId}</span></td>
                    <td style={{ padding: '14px 20px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{p.period}</span></td>
                    <td style={{ padding: '14px 20px' }}><span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{fmtPay(p.netPay)}</span></td>
                    <td style={{ padding: '14px 20px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{p.status}</span></td>
                    <td style={{ padding: '14px 20px' }}>
                      <button onClick={(e) => { e.stopPropagation(); if (finalized(p)) void download(p.id, p.payslipId); }} disabled={!finalized(p)} title={!finalized(p) ? 'Available once finalized' : 'Download payslip'} style={{ width: '30px', height: '30px', borderRadius: '7px', border: 'none', backgroundColor: finalized(p) ? '#0d7470' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: finalized(p) ? 'pointer' : 'not-allowed', opacity: finalized(p) ? 1 : 0.5 }}><Download size={13} color={finalized(p) ? 'white' : '#94a3b8'} /></button>
                    </td>
                  </tr>
                );
              })}
              {payslips.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No payslips found</td></tr>
              )}
            </tbody>
          </ResponsiveTable>
        )}
      </div>

      {viewPayslip && (
        <LegacyDrawer open onClose={() => setViewPayslip(null)} direction="right" className="legacy-detail-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Payslip Detail</span>
              <button onClick={() => setViewPayslip(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {viewPayslip.grossSalary === 0 && viewPayslip.netPay === 0 && <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '11px' }}>This payslip was generated before salary setup was completed. Please contact HR for correction.</div>}
              {([
                ['Payslip ID',   viewPayslip.payslipId],
                ['Period',       viewPayslip.period],
                ['Gross Salary', fmtPay(viewPayslip.grossSalary)],
                ['Deductions',   fmtPay(viewPayslip.totalDeductions)],
                ['Net Pay',      fmtPay(viewPayslip.netPay)],
                ['Status',       viewPayslip.status],
                ...(viewPayslip.snapshot?.calculationVersion === 'v2-detailed' ? [
                  ['Basic Salary', fmtPay(viewPayslip.snapshot.basicSalary ?? 0)],
                  ['Allowances', fmtPay(viewPayslip.snapshot.allowances ?? 0)],
                  ['Overtime Pay', fmtPay(viewPayslip.snapshot.overtimePay ?? 0)],
                  ['Reimbursements', fmtPay(viewPayslip.snapshot.reimbursementAmount ?? 0)],
                  ['Payable Days', String(viewPayslip.snapshot.payableDays ?? 0)],
                  ['Absent / Leave Days', String(viewPayslip.snapshot.absentDays ?? 0)],
                ] : []),
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: '13px', color: k === 'Net Pay' ? '#0d7470' : '#0f172a', fontWeight: k === 'Net Pay' ? 700 : 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </LegacyDrawer>
      )}
    </div>
  );
}
