import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const roleHome: Record<string, string> = {
  SUPER_ADMIN: '/dashboard',
  COMPANY_ADMIN: '/company-admin/dashboard',
  HR: '/hr/dashboard',
  MANAGER: '/manager/dashboard',
  SUPERVISOR: '/supervisor/dashboard',
  FINANCE: '/finance/dashboard',
  EMPLOYEE: '/employee/dashboard',
};

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const home = user ? (roleHome[user.role] ?? '/login') : '/login';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif', textAlign: 'center', padding: '24px' }}>
      <p style={{ fontSize: '96px', fontWeight: 800, color: '#e2e8f0', lineHeight: 1, margin: 0 }}>404</p>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '16px', marginBottom: '8px' }}>Page not found</h1>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>The page you're looking for doesn't exist or you don't have access to it.</p>
      <button
        onClick={() => navigate(home)}
        style={{ padding: '10px 24px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
