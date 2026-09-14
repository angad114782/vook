import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { isMockMode } from '../../config/runtime';
import type { DemoAccount } from '../../api/demo';
import { useDemoAccounts, useResetDemoData } from '../../hooks/queries/useDemo';

const features = [
  'Employee Management',
  'Attendance Tracking',
  'Payroll Processing',
  'Shift Planning',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const demoAccountsQuery = useDemoAccounts();
  const resetDemo = useResetDemoData();
  const demoAccounts = demoAccountsQuery.data?.accounts ?? [];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState('');

  const navigateForRole = (role?: string) => {
    if (role === 'SUPER_ADMIN') navigate('/dashboard');
    else if (role === 'COMPANY_ADMIN') navigate('/company-admin/dashboard');
    else if (role === 'HR') navigate('/hr/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'SUPERVISOR') navigate('/supervisor/dashboard');
    else if (role === 'FINANCE') navigate('/finance/dashboard');
    else if (role === 'EMPLOYEE') navigate('/employee/dashboard');
    else navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password, needsOtp ? otp : undefined);
      const { user } = useAuthStore.getState();
      if (user?.role === 'SUPER_ADMIN' && user.twoFactorEnrollmentRequired) navigate('/security');
      else navigateForRole(user?.role);
    } catch (err: unknown) {
      console.error('Login failed:', err);
      const e = err as { response?: { status?: number; data?: { error?: { message?: string; code?: string } } }; message?: string };
      if (e.response?.data?.error?.code === 'TWO_FACTOR_REQUIRED') {
        setNeedsOtp(true);
        setError('');
        return;
      }
      if (!e.response) {
        setError(`Network/CORS error: ${e.message || 'request could not reach the server'} (check browser console)`);
      } else {
        setError(e.response.data?.error?.message || `Login failed (HTTP ${e.response.status})`);
      }
    }
  };

  const selectDemoAccount = async (account: DemoAccount) => {
    setEmail(account.email); setPassword(account.password); setError('');
    try { await login(account.email, account.password); navigateForRole(account.role); }
    catch (reason) { setError((reason as Error).message || 'Could not start the demo session.'); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* ── Left Panel ── */}
      <div
        style={{
          width: '45%',
          minWidth: '45%',
          backgroundColor: '#0d4a47',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          height: '100%',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px' }}>
            <div style={{
              width: '48px', height: '48px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '20px' }}>W</span>
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.3px' }}>
              Work Management
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px', letterSpacing: '-0.5px' }}>
            Manage your<br />workforce smarter
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: 1.6, marginBottom: '40px' }}>
            All-in-one platform for HR, attendance, payroll, and workforce planning.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {features.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#4ade80" />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={{
        flex: 1,
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '40px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                Welcome back
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>
                Sign in to your admin account
              </p>
            </div>

            {isMockMode && (
              <section aria-label="Demo accounts" style={{ marginBottom: 20, padding: 12, borderRadius: 10, background: '#f0fdfa', border: '1px solid #99f6e4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 12, color: '#115e59' }}>Demo mode · choose a role</strong>
                  <button type="button" disabled={resetDemo.isPending} onClick={() => void resetDemo.mutateAsync().then(() => { localStorage.removeItem('vook-auth-display'); window.location.reload(); })} style={{ border: 0, padding: 0, background: 'transparent', color: '#0f766e', fontSize: 11, cursor: resetDemo.isPending ? 'wait' : 'pointer', textDecoration: 'underline' }}>{resetDemo.isPending ? 'Resetting…' : 'Reset data'}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  {demoAccounts.map((account) => <button key={account.role} type="button" disabled={isLoading} onClick={() => void selectDemoAccount(account)} title={account.email} style={{ border: '1px solid #99f6e4', borderRadius: 7, background: 'white', color: '#134e4a', padding: '7px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>{account.role.replaceAll('_', ' ')}</button>)}
                </div>
                {demoAccountsQuery.isError && <small style={{ display: 'block', marginTop: 8, color: '#b91c1c' }}>Demo accounts could not be loaded. Reset the page and try again.</small>}
                <small style={{ display: 'block', marginTop: 8, color: '#0f766e' }}>Mock-only password: Demo@123</small>
              </section>
            )}

            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@workmgmt.com"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    backgroundColor: 'white',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#0d7470')}
                  onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                      backgroundColor: 'white',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#0d7470')}
                    onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {needsOtp && (
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="login-otp" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Authenticator code
                  </label>
                  <input
                    id="login-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    pattern="[0-9]{6}"
                    required
                    autoFocus
                    style={{ width: '100%', minHeight: 44, padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '18px', letterSpacing: '0.25em', color: '#0f172a', backgroundColor: 'white' }}
                  />
                  <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 12 }}>Enter the six-digit code from your authenticator app.</p>
                </div>
              )}

              {/* Remember + Forgot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: '#0d7470', width: '14px', height: '14px' }} />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Remember me</span>
                </label>
                <Link to="/forgot-password" style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: isLoading ? '#5fa8a5' : '#0d7470',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background-color 0.15s',
                }}
              >
                {isLoading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</> : 'Sign In'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#64748b' }}>New company? <Link to="/register" style={{ color: '#0d7470', fontWeight: 700 }}>Create an account</Link></p>
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
            © 2026 Work Management. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
