import { useNavigate } from 'react-router-dom';
import { Clock, UserCheck, UserX, ClipboardList, Loader2 } from 'lucide-react';
import { useHrAttendance, useApprovals, useLeaves } from '../../hooks/queries/useHrQueries';

export default function ManagerDashboardPage() {
  const navigate = useNavigate();

  const { data: attData, isLoading: attLoading } = useHrAttendance();
  const { data: appData, isLoading: appLoading } = useApprovals({ limit: '1' });
  const { data: leaveData, isLoading: leaveLoading } = useLeaves({ status: 'Pending', limit: '1' });

  const loading = attLoading || appLoading || leaveLoading;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" />
      </div>
    );
  }

  const att = attData?.stats;
  const depts = attData?.departments?.slice(0, 5) ?? [];
  const pendingApprovals = appData?.stats?.pending ?? 0;
  const pendingLeaves = leaveData?.stats?.pending ?? 0;

  const STAT_CARDS = [
    { label: 'Late Arrivals',     value: att?.lateArrivals ?? 0,    icon: Clock,         iconBg: '#fff7ed', iconColor: '#ea580c', sub: 'Today' },
    { label: 'Present Today',     value: att?.presentToday ?? 0,    icon: UserCheck,     iconBg: '#f0fdf4', iconColor: '#16a34a', sub: 'Active now' },
    { label: 'Absent Today',      value: att?.absent ?? 0,          icon: UserX,         iconBg: '#fef2f2', iconColor: '#dc2626', sub: 'Not checked in' },
    { label: 'Pending Approvals', value: pendingApprovals,          icon: ClipboardList, iconBg: '#eff6ff', iconColor: '#2563eb', sub: 'Awaiting action' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Monitor your team's attendance and workforce status</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconColor, sub }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
              <div style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={iconColor} />
              </div>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Attendance by Department */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Attendance by Department</h3>
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {depts.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No attendance data</p>
            )}
            {depts.map((dept) => (
              <div key={dept.department}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{dept.department}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>● {dept.present}</span>
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>● {dept.total - dept.present}</span>
                  </div>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${dept.percentage}%`, height: '100%', backgroundColor: '#0d7470', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Pending Actions</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Items requiring your attention</p>
          </div>
          <div style={{ padding: '12px 0' }}>
            {[
              { label: 'Approve Leave Requests',  count: pendingLeaves,    path: '/manager/approvals', priority: 'High',   priorityColor: '#dc2626', priorityBg: '#fef2f2' },
              { label: 'Approve Other Requests',  count: pendingApprovals, path: '/manager/approvals', priority: 'Medium', priorityColor: '#d97706', priorityBg: '#fffbeb' },
            ].map((p, i) => (
              <div key={i} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: i === 0 ? '1px solid #f8fafc' : 'none' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{p.label}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.count} items pending</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, backgroundColor: p.priorityBg, color: p.priorityColor }}>{p.priority}</span>
                  <button onClick={() => navigate(p.path)} style={{ padding: '6px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Review</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
