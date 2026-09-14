import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { authApi } from '../../api/auth';
import { extractError } from '../../utils/errorUtils';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? '' : 'This password reset link is missing or invalid.');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(extractError(err, 'This password reset link is invalid or has expired.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: '420px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '36px', boxShadow: '0 12px 35px rgba(15, 23, 42, 0.08)' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', textDecoration: 'none', marginBottom: '28px' }}><ArrowLeft size={15} /> Back to sign in</Link>
        {success ? (
          <div style={{ textAlign: 'center' }}><CheckCircle2 size={42} color="#16a34a" style={{ marginBottom: '14px' }} /><h1 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>Password updated</h1><p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '12px 0 22px' }}>Your password has been reset and other active sessions were signed out.</p><Link to="/login" style={{ display: 'inline-block', color: '#2563eb', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Continue to sign in</Link></div>
        ) : (
          <>
            <div style={{ width: '44px', height: '44px', display: 'grid', placeItems: 'center', borderRadius: '12px', color: '#2563eb', background: '#eff6ff', marginBottom: '18px' }}><LockKeyhole size={22} /></div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>Create a new password</h1>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '8px 0 24px' }}>Use at least 8 characters. Your reset link can be used only once.</p>
            {error && <div role="alert" style={{ marginBottom: '18px', padding: '11px 13px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
            <form onSubmit={submit} style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>New password<div style={{ position: 'relative' }}><input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 42px 11px 13px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', font: 'inherit' }} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
              <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>Confirm new password<input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', font: 'inherit' }} /></label>
              <button type="submit" disabled={busy || !token} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: 0, borderRadius: '8px', padding: '12px', color: '#fff', background: busy || !token ? '#93c5fd' : '#2563eb', fontWeight: 700, cursor: busy || !token ? 'not-allowed' : 'pointer' }}>{busy && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}{busy ? 'Updating password…' : 'Update password'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
