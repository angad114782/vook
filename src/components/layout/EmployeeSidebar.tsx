import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, Plane, FileText, Receipt, FolderOpen, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAccess } from '../../hooks/queries/useAccess';
import { routeVisible } from '../../config/routeAccess';

const NAV = [
  { to: '/employee/dashboard',   label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/employee/attendance',  label: 'Attendance',  Icon: CalendarCheck },
  { to: '/employee/leaves',      label: 'My Leaves',   Icon: Plane },
  { to: '/employee/payslips',    label: 'Payslips',    Icon: FileText },
  { to: '/employee/expenses',    label: 'Expenses',    Icon: Receipt },
  { to: '/employee/documents',   label: 'Documents',   Icon: FolderOpen },
  { to: '/employee/settings',    label: 'Settings',    Icon: Settings },
];

export default function EmployeeSidebar() {
  const navigate  = useNavigate();
  const { logout } = useAuthStore();
  const access = useAccess();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ width: '200px', minWidth: '200px', backgroundColor: '#0d4a47', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '16px' }}>W</span>
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.2px' }}>WorkMgmt</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.filter(({ to }) => routeVisible(access, to)).map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px',
            textDecoration: 'none', fontSize: '13px', fontWeight: 500, position: 'relative',
            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
            transition: 'all 0.15s',
          })}>
            {({ isActive }) => (
              <>
                {isActive && <div style={{ position: 'absolute', left: 0, width: '3px', height: '28px', backgroundColor: '#4ade80', borderRadius: '0 3px 3px 0' }} />}
                <Icon size={15} />
                <span style={{ fontSize: '12.5px' }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', width: '100%', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
