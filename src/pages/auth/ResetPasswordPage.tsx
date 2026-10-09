import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { authApi } from '../../api/auth';
import { extractError } from '../../utils/errorUtils';
import AuthShell, { AuthAlert, AuthIcon, authButton, authInput, authLabel, focusTeal } from './AuthShell';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? '' : 'This password reset link is missing or not valid. Please ask for a new one.');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) { setError('Your password needs at least 8 characters, with letters and a number.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(extractError(err, 'This link has expired or was already used. Please ask for a new one.'));
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <AuthShell title="Password updated" subtitle="Your password has been changed and other devices were signed out. You can sign in with the new password now." back={false}>
        <AuthIcon><CheckCircle2 size={24} /></AuthIcon>
        <Link to="/login" style={authButton(false)}>Continue to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create a new password" subtitle="Use at least 8 characters with letters and a number. This link works only once.">
      <AuthIcon><LockKeyhole size={24} /></AuthIcon>
      {error && <AuthAlert>{error}</AuthAlert>}
      {!token && <Link to="/forgot-password" style={{ ...authButton(false), marginBottom: 8 }}>Ask for a new link</Link>}
      {token && (
        <form className="login-form" onSubmit={submit} aria-busy={busy}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="reset-password" style={authLabel}>New password</label>
            <div className="login-password-field" style={{ position: 'relative' }}>
              <input id="reset-password" name="password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a new password" style={{ ...authInput, padding: '11px 40px 11px 14px' }} {...focusTeal} />
              <button className="login-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="reset-confirm" style={authLabel}>Confirm new password</label>
            <input id="reset-confirm" name="confirm" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" style={authInput} {...focusTeal} />
          </div>
          <button className="login-submit" type="submit" disabled={busy} style={authButton(busy)}>
            {busy ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save new password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
