import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import './LoginPage.css';

/**
 * The same frame as the sign-in screen (dark-teal side panel + white card) for every account page:
 * forgot password, reset password, accept invitation. Colours, spacing and fields match the rest of the product.
 */
const FEATURES = ['Employee Management', 'Attendance Tracking', 'Payroll Processing', 'Shift Planning'];

export const authLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
export const authInput: CSSProperties = { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#0f172a', outline: 'none', transition: 'border-color 0.15s', backgroundColor: 'white', fontFamily: 'Inter, sans-serif' };
export const focusTeal = { onFocus: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#0d7470'), onBlur: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#e2e8f0') };
export const authButton = (busy: boolean): CSSProperties => ({ width: '100%', padding: '12px 24px', backgroundColor: busy ? '#5fa8a5' : '#0d7470', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'background-color 0.15s' });

export function AuthAlert({ children }: { children: ReactNode }) {
  return <div role="alert" className="login-error" style={{ marginBottom: 20, padding: '12px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{children}</div>;
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: 18, padding: 12, border: '1px dashed #f59e0b', background: '#fffbeb', borderRadius: 8, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>{children}</div>;
}

export function AuthIcon({ children }: { children: ReactNode }) {
  return <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 12, color: '#0d7470', background: '#dff3f1', marginBottom: 18 }}>{children}</div>;
}

export default function AuthShell({ title, subtitle, children, back = true }: { title: string; subtitle?: string; children: ReactNode; back?: boolean }) {
  return (
    <main className="login-page" style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <div className="login-hero" style={{ width: '45%', minWidth: '45%', backgroundColor: '#0d4a47', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, height: '100%' }}>
        <div className="login-hero__content" style={{ width: '100%', maxWidth: 380 }}>
          <div className="login-brand" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div className="login-brand__mark" style={{ width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>W</span>
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 22, letterSpacing: '-0.3px' }}>Work Management</span>
          </div>
          <h1 className="login-hero__title" style={{ color: 'white', fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.5px' }}>Manage your<br />workforce smarter</h1>
          <p className="login-hero__copy" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>All-in-one platform for HR, attendance, payroll, and workforce planning.</p>
          <div className="login-features" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={18} color="#4ade80" />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-workspace" style={{ flex: 1, backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div className="login-workspace__content" style={{ width: '100%', maxWidth: 420 }}>
          <div className="login-card" style={{ backgroundColor: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            {back && <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, fontWeight: 500, textDecoration: 'none', marginBottom: 24 }}><ArrowLeft size={15} /> Back to sign in</Link>}
            <div className="login-card__header" style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</h2>
              {subtitle && <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>{subtitle}</p>}
            </div>
            {children}
          </div>
          <p className="login-copyright" style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 20 }}>© 2026 Work Management. All rights reserved.</p>
        </div>
      </div>
    </main>
  );
}
