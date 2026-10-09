import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { authApi } from '../../api/auth';
import { prepareBotProof } from '../../lib/botProof';
import { extractError } from '../../utils/errorUtils';
import AuthShell, { AuthAlert, AuthIcon, AuthNotice, authButton, authInput, authLabel, focusTeal } from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState('');
  const [trap, setTrap] = useState(''); // hidden field only bots fill in
  useEffect(() => { void prepareBotProof(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await authApi.requestPasswordReset(email, trap);
      setDevLink(data.devResetLink ?? '');
      setSubmitted(true);
    } catch (err) {
      setError(extractError(err, 'We could not start the password reset. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Check your inbox" subtitle="If an active account exists for that email, we have sent a link to reset the password. It works for one hour.">
        <AuthIcon><CheckCircle2 size={24} /></AuthIcon>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: 0 }}>Can’t see it? Check your spam folder, or try again in a few minutes.</p>
        {devLink && <AuthNotice>Test mode: no email server is connected, so use this link to set a new password.<br /><a href={devLink} style={{ color: '#0d7470', fontWeight: 700 }}>Set a new password</a></AuthNotice>}
        <Link to="/login" style={{ ...authButton(false), marginTop: 24 }}>Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your work email and we will send you a secure link to choose a new one.">
      <AuthIcon><Mail size={24} /></AuthIcon>
      {error && <AuthAlert>{error}</AuthAlert>}
      <form className="login-form" onSubmit={submit} aria-busy={busy}>
        <input name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <div style={{ marginBottom: 22 }}>
          <label htmlFor="forgot-email" style={authLabel}>Email address</label>
          <input id="forgot-email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={authInput} {...focusTeal} />
        </div>
        <button className="login-submit" type="submit" disabled={busy} style={authButton(busy)}>
          {busy ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending link…</> : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
