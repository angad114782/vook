import { useNavigate } from 'react-router-dom';
import { Download, Shield, FileText, BarChart2, Loader2 } from 'lucide-react';
import { useCaDashboard } from '../../hooks/queries/useCaQueries';
import { useHrAttendance } from '../../hooks/queries/useHrQueries';

function DonutChart({ active, total }: { active: number; total: number }) {
  const absent = total - active;
  const values = [
    { label: 'Active',  value: active, color: '#0d7470' },
    { label: 'Inactive', value: absent, color: '#fca5a5' },
  ];
  const sum = values.reduce((s, v) => s + v.value, 0) || 1;
  const cx = 60; const cy = 60; const r = 48; const innerR = 28;
  let cumPct = 0;
  const slices = values.map((w) => {
    const startAngle = (cumPct / sum) * 2 * Math.PI - Math.PI / 2;
    cumPct += w.value;
    const endAngle = (cumPct / sum) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);   const y2 = cy + r * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);   const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle); const y4 = cy + innerR * Math.sin(startAngle);
    const large = w.value / sum > 0.5 ? 1 : 0;
    return { ...w, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z` };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg viewBox="0 0 120 120" style={{ width: '110px', flexShrink: 0 }}>
        {slices.map((s) => <path key={s.label} d={s.d} fill={s.color} />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#94a3b8">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {values.map((w) => (
          <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: w.color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#374151' }}>{w.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginLeft: 'auto', paddingLeft: '12px' }}>{w.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CADashboardPage() {
  const navigate = useNavigate();
  const { data: dashData, isLoading: dashLoading } = useCaDashboard();
  const { data: attData,  isLoading: attLoading  } = useHrAttendance();

  const loading = dashLoading || attLoading;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" />
      </div>
    );
  }

  const totalEmployees  = dashData?.stats.totalEmployees  ?? 0;
  const activeEmployees = dashData?.stats.activeEmployees ?? 0;
  const pendingLeaves   = dashData?.stats.pendingLeaves   ?? 0;
  const pendingExpenses = dashData?.stats.pendingExpenses ?? 0;
  const deptBreakdown   = dashData?.deptBreakdown         ?? [];

  const totalPresent   = attData?.stats.presentToday  ?? 0;
  const totalAbsent    = attData?.stats.absent         ?? 0;
  const lateArrivals   = attData?.stats.lateArrivals   ?? 0;
  const attendancePct  = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0;

  const STATS = [
    { label: 'Late Arrivals',     value: lateArrivals,                        color: '#0d7470', bg: '#f0fdfa', sub: 'Today' },
    { label: 'Present Today',     value: totalPresent,                        color: '#2563eb', bg: '#eff6ff', sub: `${attendancePct}% of total` },
    { label: 'Absent Today',      value: totalAbsent,                         color: '#ea580c', bg: '#fff7ed', sub: `${100 - attendancePct}% absent` },
    { label: 'Pending Approvals', value: pendingLeaves + pendingExpenses,      color: '#0d7470', bg: '#f0fdfa', sub: 'Requires action' },
  ];

  const maxDept = Math.max(...deptBreakdown.map((dep) => dep.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Overview of today's attendance and workforce status.</p>
      </div>
      {dashData?.onboarding && dashData.onboarding.status !== 'COMPLETED' && <div className="admin-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderLeft: '4px solid #0d7470' }}><div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>Finish company setup</strong><p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{dashData.onboarding.steps.filter((step) => ['COMPLETED', 'SKIPPED'].includes(step.status)).length} of {dashData.onboarding.steps.length} steps complete. Policies, roles, and invitations can be finished at any time.</p></div><button className="admin-button" onClick={() => navigate('/company-admin/onboarding')}>Continue setup</button></div>}

      <div className="dashboard-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {STATS.map(({ label, value, color, bg, sub }) => (
          <div key={label} className="dashboard-stat-card" style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
            <div className="dashboard-stat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: color, opacity: 0.7 }} />
            </div>
            <p className="dashboard-stat-value" style={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            <p className="dashboard-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{label}</p>
            <p className="dashboard-stat-sub" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Department breakdown */}
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Headcount by Department</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {deptBreakdown.slice(0, 5).map((dep) => (
              <div key={dep.department}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{dep.department}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{dep.count}</span>
                </div>
                <div style={{ height: '10px', backgroundColor: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${(dep.count / maxDept) * 100}%`, height: '100%', backgroundColor: '#0d7470', borderRadius: '5px' }} />
                </div>
              </div>
            ))}
            {deptBreakdown.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No department data</p>
            )}
          </div>
        </div>

        {/* Workforce Composition */}
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Workforce Composition</h3>
            <button onClick={() => navigate('/company-admin/workforce')} style={{ fontSize: '11px', color: '#0d7470', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View Detail</button>
          </div>
          <DonutChart active={activeEmployees} total={totalEmployees} />
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { label: 'Download Payroll', icon: Download,  path: '/company-admin/payroll' },
            { label: 'Manage Roles',     icon: Shield,    path: '/company-admin/settings/roles' },
            { label: 'Download Summary', icon: FileText,  path: '/company-admin/reports' },
            { label: 'View Reports',     icon: BarChart2, path: '/company-admin/reports' },
          ].map(({ label, icon: Icon, path }) => (
            <button key={label} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#0d7470'; el.style.backgroundColor = '#f0fdfa'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e2e8f0'; el.style.backgroundColor = 'white'; }}>
              <Icon size={18} color="#0d7470" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'center' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
