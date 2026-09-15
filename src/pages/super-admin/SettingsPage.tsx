import { useState } from "react";
import {
  Settings,
  Shield,
  Bell,
  Wrench,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { accountApi } from "../../api/account";
import { platformApi } from "../../api/platform";
import NotificationSettingsTab from "./NotificationSettingsTab";

// ── helpers ───────────────────────────────────────────────────────────────────

type Tab = "general" | "security" | "notifications" | "system";

const TABS: {
  key: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}[] = [
  { key: "general", label: "General", icon: Settings },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "system", label: "System Config", icon: Wrench },
];

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        backgroundColor: on ? "#0d7470" : "#e2e8f0",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "3px",
          left: on ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </div>
  );
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "28px",
        right: "28px",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 18px",
        borderRadius: "10px",
        backgroundColor: type === "success" ? "#0d7470" : "#b91c1c",
        color: "white",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.7)",
          marginLeft: "4px",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── input / label styles (shared) ─────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  color: "#0f172a",
  backgroundColor: "white",
};
const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "5px",
  display: "block",
};
const hintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#94a3b8",
  marginTop: "4px",
};

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
          {title}
        </h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
          {subtitle}
        </p>
      </div>
      <div style={{ padding: "22px" }}>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        padding: "14px 0",
        borderBottom: "1px solid #f8fafc",
      }}
    >
      <div>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
          {label}
        </p>
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
          {description}
        </p>
      </div>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

// ── General Tab ───────────────────────────────────────────────────────────────

function GeneralTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void;
}) {
  const [form, setForm] = useState({
    platformName: "WorkManage SaaS",
    platformUrl: "https://app.workmanage.io",
    supportEmail: "support@workmanage.io",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformApi.updateSettings("general", form);
      showToast("General settings saved successfully", "success");
    } catch {
      showToast("Unable to save general settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="General Settings"
      subtitle="Configure basic platform identity and preferences"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Platform Name</label>
          <input
            value={form.platformName}
            onChange={(e) => set("platformName", e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Platform URL</label>
          <input
            value={form.platformUrl}
            onChange={(e) => set("platformUrl", e.target.value)}
            style={inputStyle}
          />
          <p style={hintStyle}>
            This URL is used in email communications and notifications
          </p>
        </div>
        <div>
          <label style={labelStyle}>Support Email</label>
          <input
            value={form.supportEmail}
            onChange={(e) => set("supportEmail", e.target.value)}
            type="email"
            style={inputStyle}
          />
          <p style={hintStyle}>
            This email is displayed for customer support inquiries
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "4px",
          }}
        >
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 22px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? (
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Save size={13} />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function ChangePasswordModal({
  onClose,
  showToast,
}: {
  onClose: () => void;
  showToast: (m: string, t: "success" | "error") => void;
}) {
  const [form, setForm] = useState({ current: "", newPass: "", confirm: "" });
  const [show, setShow] = useState({
    current: false,
    newPass: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = (k: keyof typeof show) =>
    setShow((s) => ({ ...s, [k]: !s[k] }));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.current || !form.newPass || !form.confirm) {
      setError("All fields are required.");
      return;
    }
    if (form.newPass !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (form.newPass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await accountApi.changePassword(form.current, form.newPass);
      showToast("Password updated successfully", "success");
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(msg ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const PassInput = ({
    field,
    placeholder,
  }: {
    field: "current" | "newPass" | "confirm";
    placeholder: string;
  }) => (
    <div style={{ position: "relative" }}>
      <input
        type={show[field] ? "text" : "password"}
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: "38px" }}
      />
      <button
        onClick={() => toggle(field)}
        type="button"
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#94a3b8",
        }}
      >
        {show[field] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            background: "linear-gradient(135deg, #0d4a47, #0d7470)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                backgroundColor: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={16} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>
                Update Admin Password
              </h3>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                Change your account password
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}
          <div>
            <label style={labelStyle}>Current Password</label>
            <PassInput field="current" placeholder="Enter current password" />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <PassInput field="newPass" placeholder="Enter new password" />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <PassInput field="confirm" placeholder="Confirm new password" />
          </div>
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              backgroundColor: "white",
              border: "1.5px solid #e2e8f0",
              borderRadius: "8px",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading && (
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
            )}
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void;
}) {
  const [twoFA, setTwoFA] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformApi.updateSettings("security", { twoFA, sessionTimeout });
      showToast("Security settings saved successfully", "success");
    } catch {
      showToast("Unable to save security settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionCard
        title="Security Settings"
        subtitle="Configure authentication and access control"
      >
        {/* Warning notice */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "8px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            marginBottom: "20px",
          }}
        >
          <AlertTriangle
            size={16}
            color="#d97706"
            style={{ flexShrink: 0, marginTop: "1px" }}
          />
          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>
              Security Notice
            </p>
            <p style={{ fontSize: "12px", color: "#78350f", marginTop: "2px" }}>
              Changes to security settings will affect all admin access to the
              platform.
            </p>
          </div>
        </div>

        <ToggleRow
          label="Two-Factor Authentication"
          description="Require 2FA for all super admin accounts"
          value={twoFA}
          onChange={setTwoFA}
        />
        <ToggleRow
          label="Auto Session Timeout"
          description="Automatically log out inactive users"
          value={sessionTimeout}
          onChange={setSessionTimeout}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "20px",
          }}
        >
          <button
            onClick={() => setShowPwModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 18px",
              backgroundColor: "white",
              border: "1.5px solid #0d7470",
              borderRadius: "8px",
              color: "#0d7470",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <Shield size={14} /> Change Password
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 22px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? (
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Save size={13} />
            )}
            Save Security Settings
          </button>
        </div>
      </SectionCard>

      {showPwModal && (
        <ChangePasswordModal
          onClose={() => setShowPwModal(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

function NotificationsTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void;
}) {
  return <NotificationSettingsTab showToast={showToast} />;
}

// ── System Config Tab ─────────────────────────────────────────────────────────

function SystemConfigTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void;
}) {
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformApi.updateSettings("system", {
        maintenance,
        maintenanceMsg,
      });
      showToast("System configuration updated", "success");
    } catch {
      showToast("Unable to save system configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="System Configuration"
      subtitle="Manage platform-wide system settings and feature availability"
    >
      {/* Critical warning */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "8px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          marginBottom: "22px",
        }}
      >
        <AlertCircle
          size={16}
          color="#b91c1c"
          style={{ flexShrink: 0, marginTop: "1px" }}
        />
        <div>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#991b1b" }}>
            Critical Configuration
          </p>
          <p style={{ fontSize: "12px", color: "#7f1d1d", marginTop: "2px" }}>
            Changes to these settings will affect all companies on the platform.
            Use with caution.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Maintenance mode */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: maintenance ? "#fef9c3" : "#f8fafc",
            border: `1px solid ${maintenance ? "#fde68a" : "#f1f5f9"}`,
            transition: "all 0.2s",
          }}
        >
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
              Maintenance Mode
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
              Temporarily disable platform access for all users
            </p>
          </div>
          <Toggle on={maintenance} onChange={setMaintenance} />
        </div>

        {/* Maintenance message — only show when ON */}
        {maintenance && (
          <div>
            <label style={labelStyle}>Maintenance Message</label>
            <textarea
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="Message to display during maintenance..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
            <p style={hintStyle}>
              This message will be shown to all users who try to access the
              platform
            </p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 22px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? (
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Save size={13} />
            )}
            Save Configuration
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
          Settings
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
          Configure platform identity, access, notifications, and system behavior
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          backgroundColor: "white",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          padding: "4px",
          gap: "2px",
          width: "fit-content",
        }}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 20px",
              border: "none",
              borderRadius: "7px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              backgroundColor: tab === key ? "#0d7470" : "transparent",
              color: tab === key ? "white" : "#64748b",
              transition: "all 0.15s",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "general" && <GeneralTab showToast={showToast} />}
      {tab === "security" && <SecurityTab showToast={showToast} />}
      {tab === "notifications" && <NotificationsTab showToast={showToast} />}
      {tab === "system" && <SystemConfigTab showToast={showToast} />}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
