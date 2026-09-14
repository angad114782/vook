import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { authApi } from '../../api/auth';
import { extractError } from '../../utils/errorUtils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authApi.requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(extractError(err, 'Unable to start password recovery. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: '420px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '36px', boxShadow: '0 12px 35px rgba(15, 23, 42, 0.08)' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', textDecoration: 'none', marginBottom: '28px' }}><ArrowLeft size={15} /> Back to sign in</Link>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={42} color="#16a34a" style={{ marginBottom: '14px' }} />
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>Check your inbox</h1>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '12px 0 0' }}>If an active Vook account exists for that email, you will receive a reset link. Check your spam folder too.</p>
          </div>
        ) : (
          <>
            <div style={{ width: '44px', height: '44px', display: 'grid', placeItems: 'center', borderRadius: '12px', color: '#2563eb', background: '#eff6ff', marginBottom: '18px' }}><Mail size={22} /></div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>Forgot password?</h1>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '8px 0 24px' }}>Enter your work email and we will send a secure password reset link.</p>
            {error && <div role="alert" style={{ marginBottom: '18px', padding: '11px 13px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
            <form onSubmit={submit} style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>Work email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', font: 'inherit' }} /></label>
              <button type="submit" disabled={busy} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: 0, borderRadius: '8px', padding: '12px', color: '#fff', background: busy ? '#93c5fd' : '#2563eb', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>{busy && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}{busy ? 'Sending link…' : 'Send reset link'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
