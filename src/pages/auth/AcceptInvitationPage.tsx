import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { accountApi } from '../../api/account';
import { extractError } from '../../utils/errorUtils';
import AuthShell, { AuthAlert, AuthIcon, authButton, authInput, authLabel, focusTeal } from './AuthShell';

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? '' : 'This invitation link is missing or not valid. Please ask your admin to send it again.');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    setError('');
    try {
      await accountApi.acceptInvitation(token, password);
      setDone(true);
    } catch (err) {
      setError(extractError(err, 'This invitation has expired or was already used. Please ask your admin to send it again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Your account is ready" subtitle="Your password is set. You can sign in now." back={false}>
        <AuthIcon><CheckCircle2 size={24} /></AuthIcon>
        <Link to="/login" style={authButton(false)}>Continue to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accept your invitation" subtitle="Choose a password to finish setting up your account. Use at least 8 characters with letters and a number.">
      <AuthIcon><KeyRound size={24} /></AuthIcon>
      {error && <AuthAlert>{error}</AuthAlert>}
      {token && (
        <form className="login-form" onSubmit={submit} aria-busy={busy}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="invite-password" style={authLabel}>Create password</label>
            <input id="invite-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a password" style={authInput} {...focusTeal} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="invite-confirm" style={authLabel}>Confirm password</label>
            <input id="invite-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" style={authInput} {...focusTeal} />
          </div>
          <button className="login-submit" type="submit" disabled={busy} style={authButton(busy)}>
            {busy ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Set password and continue'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
