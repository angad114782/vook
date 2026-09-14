import { useEffect, useState } from 'react';
import { KeyRound, Laptop, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { accountApi } from '../../api/account';
import { useAuthStore } from '../../store/authStore';

type Session = { _id: string; createdAt: string; expiresAt: string; ipAddress?: string; userAgent?: string };

export default function CAAccountSecurityPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const load = () => accountApi.getSessions<Session>().then(({ data }) => setSessions(data.sessions)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) { toast.error('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await accountApi.changePassword(passwords.currentPassword, passwords.newPassword);
      toast.success('Password changed. Sign in again.');
      await logout();
      navigate('/login', { replace: true });
    } catch (error: any) { toast.error(error.response?.data?.message ?? 'Unable to change password.'); }
    finally { setSaving(false); }
  };

  const revokeAll = async () => {
    if (!window.confirm('Sign out every session, including this one?')) return;
    await accountApi.revokeAllSessions();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><h1>Account & security</h1><p>Manage your password and signed-in devices. This area remains available during subscription recovery.</p></div>
        <div className="health-chip"><ShieldCheck size={14} /> Protected account</div>
      </header>

      <div className="account-security-grid">
        <section className="admin-card account-security-card">
          <h2><KeyRound size={17} /> Change password</h2>
          <form onSubmit={changePassword}>
            <label className="admin-label">Current password<input className="admin-input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></label>
            <label className="admin-label">New password<input className="admin-input" type="password" minLength={8} value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required /></label>
            <label className="admin-label">Confirm new password<input className="admin-input" type="password" minLength={8} value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} required /></label>
            <div className="admin-form-actions"><button className="admin-button" disabled={saving}>{saving && <Loader2 size={15} />} Update password</button></div>
          </form>
        </section>

        <section className="admin-card account-security-card">
          <header><div><h2>Active sessions</h2><p>Revoke access from devices you no longer use.</p></div><button className="admin-button admin-button--secondary" onClick={() => void revokeAll()}>Revoke all</button></header>
          {loading ? <div className="empty-state"><Loader2 size={18} /> Loading sessions…</div> : sessions.length === 0 ? <div className="empty-state">No active sessions</div> : sessions.map((session) => (
            <div className="session-row" key={session._id}>
              {/mobile|android|iphone/i.test(session.userAgent ?? '') ? <Smartphone size={18} /> : <Laptop size={18} />}
              <div><strong>{session.ipAddress ?? 'Unknown IP'}</strong><small>{new Date(session.createdAt).toLocaleString('en-IN')} · expires {new Date(session.expiresAt).toLocaleDateString('en-IN')}</small></div>
              <button className="admin-button admin-button--secondary" onClick={async () => { await accountApi.revokeSession(session._id); await load(); }}>Revoke</button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
