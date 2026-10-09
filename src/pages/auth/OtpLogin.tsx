import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Smartphone } from 'lucide-react';
import { authApi, type LoginOptions, type OtpChannel } from '../../api/auth';
import { prepareBotProof } from '../../lib/botProof';
import { useAuthStore } from '../../store/authStore';
import { extractError } from '../../utils/errorUtils';

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#0f172a', backgroundColor: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const primary = (busy: boolean): React.CSSProperties => ({ width: '100%', padding: '12px 24px', backgroundColor: busy ? '#5fa8a5' : '#0d7470', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, sans-serif' });

const CHANNEL_LABEL: Record<OtpChannel, string> = { WHATSAPP: 'WhatsApp', SMS: 'Text message (SMS)' };

/** Sign in with a one-time code sent to the person's mobile number. */
export default function OtpLogin({ options, onSignedIn, onError }: { options: LoginOptions['otp']; onSignedIn: () => void; onError: (message: string) => void }) {
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [mobile, setMobile] = useState('');
  const [channel, setChannel] = useState<OtpChannel>(options.channels[0] ?? 'WHATSAPP');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(0);
  const [testCode, setTestCode] = useState('');
  const [trap, setTrap] = useState(''); // hidden field only bots fill in

  useEffect(() => { void prepareBotProof(); }, []);
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait((w) => w - 1), 1000); return () => window.clearTimeout(t); }, [wait]);

  const digits = mobile.replace(/\D/g, '');
  const validMobile = digits.length >= 10;

  const send = async () => {
    onError('');
    setSending(true);
    try {
      const { data } = await authApi.requestOtp(mobile, channel, trap);
      setSent(true);
      setCode('');
      setWait(data.resendAfterSeconds);
      setTestCode(data.devOtp ?? '');
    } catch (err) {
      const e = err as { response?: { data?: { error?: { details?: { retryAfterSeconds?: number } } } } };
      const retry = e.response?.data?.error?.details?.retryAfterSeconds;
      if (retry) setWait(retry);
      onError(extractError(err, 'We could not send the code. Please try again.'));
    } finally { setSending(false); }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    onError('');
    try {
      await loginWithOtp(mobile, code, needsTotp ? totp : undefined);
      onSignedIn();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { code?: string } } } };
      if (e.response?.data?.error?.code === 'TWO_FACTOR_REQUIRED') { setNeedsTotp(true); return; }
      onError(extractError(err, 'We could not sign you in. Please try again.'));
    }
  };

  return (
    <div>
      <input name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
      {!sent ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <label htmlFor="otp-mobile" style={label}>Mobile number</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <span aria-hidden style={{ ...input, width: 64, display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#475569' }}>+91</span>
              <input id="otp-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d\s+-]/g, '').slice(0, 16))} placeholder="98765 43210" style={input} />
            </div>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={label}>Send my code on</legend>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, options.channels.length)}, 1fr)`, gap: 8 }}>
              {options.channels.map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)} aria-pressed={channel === c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${channel === c ? '#0d7470' : '#e2e8f0'}`, background: channel === c ? '#f0fdfa' : 'white', color: channel === c ? '#0d4a47' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {c === 'WHATSAPP' ? <MessageCircle size={16} aria-hidden /> : <Smartphone size={16} aria-hidden />} {CHANNEL_LABEL[c]}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => void send()} disabled={!validMobile || sending} style={{ ...primary(sending), opacity: validMobile ? 1 : 0.6 }}>
            {sending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending code…</> : 'Send code'}
          </button>
        </div>
      ) : (
        <form onSubmit={verify} style={{ display: 'grid', gap: 18 }} aria-busy={isLoading}>
          <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            If <strong>+91 {digits.slice(-10)}</strong> is registered, we sent a 6-digit code on {CHANNEL_LABEL[channel]}. It works for a few minutes.{' '}
            <button type="button" onClick={() => { setSent(false); setNeedsTotp(false); setTestCode(''); }} style={{ border: 0, background: 'none', color: '#0d7470', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}>Change number</button>
          </p>
          {testCode && <p style={{ margin: 0, padding: 12, border: '1px dashed #f59e0b', background: '#fffbeb', borderRadius: 8, fontSize: 13, color: '#92400e' }}>Test mode: nothing was really sent. Your code is <strong style={{ letterSpacing: '0.15em' }}>{testCode}</strong></p>}
          <div>
            <label htmlFor="otp-code" style={label}>6-digit code</label>
            <input id="otp-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ ...input, fontSize: 20, letterSpacing: '0.35em', textAlign: 'center' }} />
          </div>
          {needsTotp && (
            <div>
              <label htmlFor="otp-totp" style={label}>Authenticator code</label>
              <input id="otp-totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ ...input, letterSpacing: '0.25em' }} />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>Your account also uses an authenticator app. Enter its current code.</p>
            </div>
          )}
          <button type="submit" disabled={isLoading || code.length !== 6} style={{ ...primary(isLoading), opacity: code.length === 6 ? 1 : 0.6 }}>
            {isLoading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</> : 'Verify and sign in'}
          </button>
          <button type="button" onClick={() => void send()} disabled={wait > 0 || sending} style={{ border: 0, background: 'none', color: wait > 0 ? '#94a3b8' : '#0d7470', fontWeight: 600, fontSize: 13, cursor: wait > 0 ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          </button>
        </form>
      )}
    </div>
  );
}
