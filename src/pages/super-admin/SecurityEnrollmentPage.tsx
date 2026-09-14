import { useEffect, useState } from 'react';
import { Copy, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { accountApi } from '../../api/account';
import { useAuthStore } from '../../store/authStore';

type Status = { enabled: boolean; required: boolean; enrollmentDeadline?: string };
type Setup = { secret: string; otpauthUri: string };

export default function SecurityEnrollmentPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [status, setStatus] = useState<Status>();
  const [setup, setSetup] = useState<Setup>();
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    accountApi.getTwoFactorStatus<Status>().then(({ data }) => setStatus(data)).catch(() => toast.error('Unable to load security status.'));
  }, []);

  const begin = async () => {
    setBusy(true);
    try {
      const { data } = await accountApi.setupTwoFactor<Setup>();
      setSetup(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to start enrollment.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await accountApi.verifyTwoFactor(otp);
      toast.success('Two-factor authentication is enabled.');
      await logout();
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Verification failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header"><div><h1>Secure your account</h1><p>Super Admin accounts require an authenticator code in addition to a password.</p></div><div className="health-chip"><ShieldCheck size={15} /> Required protection</div></header>
      <section className="admin-card security-enrollment-card">
        {!status ? <div className="empty-state"><Loader2 size={20} /> Loading security status…</div> : status.enabled ? (
          <div><h2>Two-factor authentication is active</h2><p>Your account is protected. You can continue to the dashboard.</p><button className="admin-button admin-button--primary" onClick={() => navigate('/dashboard')}>Open dashboard</button></div>
        ) : !setup ? (
          <div>
            <h2 style={{ marginTop: 0 }}>Connect an authenticator app</h2>
            <p style={{ color: '#64748b', lineHeight: 1.6 }}>Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app. Enrollment must be completed before {status.enrollmentDeadline ? new Date(status.enrollmentDeadline).toLocaleString('en-IN') : 'the grace period ends'}.</p>
            <button className="admin-button admin-button--primary" onClick={() => void begin()} disabled={busy}>{busy ? <Loader2 size={16} /> : <ShieldCheck size={16} />} Start enrollment</button>
          </div>
        ) : (
          <div>
            <h2 style={{ marginTop: 0 }}>Add VOOK to your authenticator</h2>
            <p style={{ color: '#64748b' }}>Open the setup link on a device with your authenticator app, or copy the manual key.</p>
            <a className="admin-button admin-button--secondary" href={setup.otpauthUri}>Open authenticator app</a>
            <div style={{ margin: '20px 0', padding: 16, border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
              <span style={{ display: 'block', color: '#64748b', fontSize: 12, marginBottom: 6 }}>Manual setup key</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><code style={{ overflowWrap: 'anywhere', flex: 1 }}>{setup.secret}</code><button className="icon-button" aria-label="Copy setup key" onClick={() => void navigator.clipboard.writeText(setup.secret).then(() => toast.success('Setup key copied.'))}><Copy size={16} /></button></div>
            </div>
            <label htmlFor="enrollment-otp" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 7 }}>Verification code</label>
            <input id="enrollment-otp" className="admin-input" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ maxWidth: 240, letterSpacing: '0.2em' }} />
            <div style={{ marginTop: 18 }}><button className="admin-button admin-button--primary" onClick={() => void verify()} disabled={busy || otp.length !== 6}>{busy ? <Loader2 size={16} /> : <ShieldCheck size={16} />} Verify and enable</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
