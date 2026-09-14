import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAccess } from '../../hooks/queries/useAccess';
import { routeVisible } from '../../config/routeAccess';
import {
  LayoutDashboard, Users, Clock, CalendarDays,
  CheckSquare, DollarSign, FileText, Settings, LogOut,
} from 'lucide-react';

const NAV = [
  { to: '/hr/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/hr/employees',  label: 'Employees',           icon: Users           },
  { to: '/hr/attendance', label: 'Attendance',          icon: Clock           },
  { to: '/hr/leaves',     label: 'Leave Management',    icon: CalendarDays    },
  { to: '/hr/approvals',  label: 'Approvals',           icon: CheckSquare     },
  { to: '/hr/payroll',    label: 'Payroll',             icon: DollarSign      },
  { to: '/hr/documents',  label: 'Document Policies',   icon: FileText        },
  { to: '/hr/settings',   label: 'Settings',            icon: Settings        },
];

export default function HRSidebar() {
  const { user, logout } = useAuthStore();
  const access = useAccess();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (name?: string) => (name ?? 'HR').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ width: '220px', minHeight: '100vh', backgroundColor: '#0d4a47', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0 }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif' }}>LOGO</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV.filter(({ to }) => routeVisible(access, to)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 20px', textDecoration: 'none', transition: 'all 0.15s',
            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
            borderLeft: isActive ? '3px solid #4ade80' : '3px solid transparent',
            fontWeight: isActive ? 600 : 400,
          })}>
            <Icon size={16} />
            <span style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Sign Out */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0d4a47', flexShrink: 0 }}>
            {user ? initials(user.name) : 'HR'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? 'HR User'}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Human Resource</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '13px', padding: '4px 0', fontFamily: 'Inter, sans-serif' }}>
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
