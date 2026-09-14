import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { accountApi } from '../../api/account';
import { extractError } from '../../utils/errorUtils';
export default function AcceptInvitationPage() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) { setMessage('Passwords do not match.'); return; } setBusy(true); try { await accountApi.acceptInvitation(params.get('token'), password); setMessage('Invitation accepted. You can now sign in.'); } catch (error) { setMessage(extractError(error, 'This invitation is invalid or expired.')); } finally { setBusy(false); } };
  const complete = message.startsWith('Invitation accepted');
  return <main className="registration-result"><div><KeyRound size={30} /><h1>{complete ? 'Your account is ready' : 'Accept your invitation'}</h1>{complete ? <><p>{message}</p><Link className="admin-button" to="/login">Continue to sign in</Link></> : <form onSubmit={submit} style={{ width: '100%', display: 'grid', gap: 14 }}><label className="admin-label" style={{ textAlign: 'left' }}>Create password<input className="admin-input" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label className="admin-label" style={{ textAlign: 'left' }}>Confirm password<input className="admin-input" required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>{message && <div className="form-error" role="alert">{message}</div>}<button className="admin-button" disabled={busy}>{busy && <Loader2 size={15} />} Set password and accept</button></form>}</div></main>;
}
