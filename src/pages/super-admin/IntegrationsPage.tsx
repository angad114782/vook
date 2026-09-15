import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  Fingerprint,
  FlaskConical,
  KeyRound,
  MessageCircle,
  Globe2,
  PlugZap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { integrationsApi, type Integration } from "../../api/integrations";
import { activateAttendanceDevice, listAttendanceDevices, saveAttendanceDevice, testAttendanceDevice, type AttendanceDeviceConnection } from "../../mocks/attendanceDevices";

function ProviderCard({ provider }: { provider: Integration }) {
  const isWhatsApp = provider.providerKey === "WHATSAPP";
  const client = useQueryClient();
  const [publicConfig, setPublicConfig] = useState<Record<string, unknown>>(
    provider.publicConfig ?? {},
  );
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  useEffect(() => {
    setPublicConfig(provider.publicConfig ?? {});
    setSecrets({});
  }, [provider.providerKey, provider.status, provider.publicConfig]);
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["integrations"] });
  const action = useMutation({
    mutationFn: async (kind: "save" | "test" | "activate" | "disable") => {
      if (kind === "save")
        return integrationsApi.save(provider.providerKey, {
          publicConfig,
          secrets,
          reason: "Dashboard configuration update",
        });
      if (kind === "test") return integrationsApi.test(provider.providerKey);
      if (kind === "activate")
        return integrationsApi.activate(
          provider.providerKey,
          "Approved after successful connection test",
        );
      return integrationsApi.disable(
        provider.providerKey,
        "Disabled from dashboard",
      );
    },
    onSuccess: (_response, kind) => {
      toast.success(
        kind === "test" ? "Configuration validated" : kind === "save" ? "Integration draft saved" : "Integration updated",
      );
      refresh();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message ?? "Integration action failed",
      ),
  });
  return (
    <article className={`admin-card integration-card${isWhatsApp ? " integration-card--whatsapp" : ""}`}>
      <header>
        <div className={`provider-icon${isWhatsApp ? " provider-icon--whatsapp" : ""}`}>
          {isWhatsApp ? <MessageCircle size={18} /> : <PlugZap size={18} />}
        </div>
        <div>
          <h2>{provider.displayName}</h2>
          <p>{isWhatsApp ? "HRMS MESSAGING" : provider.category}</p>
        </div>
        <span data-status={provider.status}>
          {provider.status.replaceAll("_", " ")}
        </span>
      </header>
      {!provider.available && (
        <div className="notice-muted">
          Adapter readiness: configuration draft only. Activation is
          intentionally disabled.
        </div>
      )}
      <div className="integration-fields">
        {(provider.publicFields ?? []).map((field) => (
          <label className="admin-label" key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            <input
              className="admin-input"
              value={String(publicConfig[field.key] ?? "")}
              disabled={action.isPending}
              onChange={(event) =>
                setPublicConfig((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        {(provider.secretFields ?? []).map((field) => (
          <label className="admin-label" key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            <input
              className="admin-input"
              type="password"
              value={secrets[field.key] ?? ""}
              disabled={action.isPending}
              placeholder={
              provider.secretConfigured
                  ? "Saved — enter to replace"
                  : ""
              }
              onChange={(event) =>
                setSecrets((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <footer>
        <button
          className="admin-button admin-button--secondary"
          disabled={action.isPending}
          onClick={() => action.mutate("save")}
        >
          <Save size={15} /> {isWhatsApp ? "Save credentials" : "Save draft"}
        </button>
        <button
          className="admin-button admin-button--secondary"
          disabled={!provider.available || action.isPending}
          onClick={() => action.mutate("test")}
        >
          <FlaskConical size={15} /> {isWhatsApp ? "Test connection" : "Test"}
        </button>
        {provider.status === "ACTIVE" ? (
          <button
            className="admin-button admin-button--secondary"
            disabled={action.isPending}
            onClick={() => action.mutate("disable")}
          >
            Disable
          </button>
        ) : (
          <button
            className="admin-button"
            disabled={!provider.available || !provider.lastTestedAt || action.isPending}
            onClick={() => action.mutate("activate")}
          >
            <ShieldCheck size={15} /> Activate
          </button>
        )}
      </footer>
      <small className="secret-note">
        <KeyRound size={13} /> Secrets are masked after saving and are never
        returned in the integration response. This frontend demo keeps provider state in local mock data.
        {provider.pendingConfiguration
          ? " A newer configuration is waiting for a successful test."
          : ""}
      </small>
    </article>
  );
}

function fieldLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function AttendanceDevicesCard() {
  const client = useQueryClient();
  const [providerKey, setProviderKey] = useState("MOBILE_GEOLOCATION");
  const [displayName, setDisplayName] = useState("");
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({});
  const [deviceSerials, setDeviceSerials] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const query = useQuery({
    queryKey: ["attendance-devices", "global"],
    queryFn: () => listAttendanceDevices(),
  });
  const manifests = query.data?.manifests ?? [];
  const connections = query.data?.connections ?? [];
  const selected = manifests.find((manifest) => manifest.key === providerKey);
  const refresh = () => client.invalidateQueries({ queryKey: ["attendance-devices", "global"] });
  const save = useMutation({
    mutationFn: () => saveAttendanceDevice({
      providerKey: selected?.key ?? "",
      displayName: displayName.trim() || selected?.name || "Attendance device",
      publicConfig,
      deviceSerials: deviceSerials.split(",").map((serial) => serial.trim()).filter(Boolean),
      hasSecret: Boolean(apiSecret),
      reason: "Configure attendance devices supplied with Vook",
    }),
    onSuccess: () => { toast.success("Attendance device connection saved."); setApiSecret(""); void refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Unable to save device connection."),
  });
  const action = useMutation({
    mutationFn: ({ connection, kind }: { connection: AttendanceDeviceConnection; kind: "test" | "activate" }) => kind === "test"
      ? testAttendanceDevice(connection.id)
      : activateAttendanceDevice(connection.id),
    onSuccess: (_response, variables) => { toast.success(variables.kind === "test" ? "Device configuration tested." : "Device connection activated."); void refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Unable to update device connection."),
  });

  return (
    <section className="admin-card attendance-connection-builder">
      <header className="attendance-device-header">
        <div className="provider-icon"><Fingerprint size={18} /></div>
        <div><h2>Attendance devices</h2><p>Set a shared device connection once for every company on Vook.</p></div>
        <span className="attendance-global-badge"><Globe2 size={13} /> Global</span>
      </header>
      <div className="attendance-device-form">
        <label className="admin-label">Device provider<select className="admin-input" value={selected?.key ?? ""} onChange={(event) => { setProviderKey(event.target.value); setPublicConfig({}); }}>
          {manifests.map((manifest) => <option key={manifest.key} value={manifest.key}>{manifest.name}</option>)}
        </select></label>
        <label className="admin-label">Connection name<input className="admin-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={selected?.name ?? "Primary attendance device"} /></label>
        {selected?.fields.map((field) => <label className="admin-label" key={field}>{fieldLabel(field)}<input className="admin-input" value={publicConfig[field] ?? ""} onChange={(event) => setPublicConfig((current) => ({ ...current, [field]: event.target.value }))} placeholder={field === "baseUrl" ? "https://device-provider.example/api" : field === "minimumAccuracyMeters" ? "100" : undefined} /></label>)}
      </div>
      {selected && <p className="attendance-device-help">{selected.description} <span>Mode: {selected.mode.replaceAll("_", " ")}</span></p>}
      <details className="attendance-device-advanced">
        <summary>Optional device details</summary>
        <div className="attendance-device-advanced__fields">
          <label className="admin-label">Device serial numbers<input className="admin-input" value={deviceSerials} onChange={(event) => setDeviceSerials(event.target.value)} placeholder="Comma-separated serial numbers" /></label>
          <label className="admin-label">API secret or bridge token<input className="admin-input" type="password" value={apiSecret} onChange={(event) => setApiSecret(event.target.value)} placeholder="Enter token if your provider requires one" /></label>
        </div>
      </details>
      <footer className="attendance-device-actions"><span>Changes apply to all companies.</span><button className="admin-button" disabled={!selected || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save global connection"}</button></footer>
      <details className="attendance-device-saved" open={!connections.length}>
        <summary>Saved global connections <span>{connections.length}</span><ChevronDown size={15} /></summary>
        <div className="attendance-connection-grid">
          {connections.map((connection) => <article className="attendance-device-row" key={connection.id}>
            <div className="provider-icon"><Fingerprint size={16} /></div>
            <span><strong>{connection.displayName}</strong><small>{connection.providerKey.replaceAll("_", " ")} · {connection.connectionMode.replaceAll("_", " ")}{connection.deviceSerials?.length ? ` · ${connection.deviceSerials.length} devices` : ""}</small></span>
            <span className={`admin-status ${connection.status === "ACTIVE" ? "success" : connection.status === "ERROR" ? "danger" : "neutral"}`}>{connection.status}</span>
            <div className="attendance-device-row__actions">
              <button className="admin-button admin-button--secondary" disabled={action.isPending} onClick={() => action.mutate({ connection, kind: "test" })}>Test</button>
              <button className="admin-button" disabled={action.isPending || connection.status !== "TESTED"} onClick={() => action.mutate({ connection, kind: "activate" })}>Activate</button>
            </div>
          </article>)}
          {!connections.length && <p className="notice-muted">No global attendance sources are configured yet.</p>}
        </div>
      </details>
    </section>
  );
}

export default function IntegrationsPage() {
  const query = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationsApi.list().then((response) => response.data),
  });
  const providers = query.data ?? [];
  const whatsapp = providers.find((provider) => provider.providerKey === "WHATSAPP");
  const email = providers.find((provider) => provider.providerKey === "SMTP");
  const payments = providers.filter((provider) => provider.category === "PAYMENTS");
  const otherProviders = providers.filter((provider) =>
    provider.providerKey !== "WHATSAPP" && provider.providerKey !== "SMTP" && provider.category !== "PAYMENTS",
  );

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Integrations</h1>
          <p>
            Manage global messaging, attendance devices and payment connections for the Vook platform.
          </p>
        </div>
        <div className="health-chip">
          <CheckCircle2 size={15} />
          {query.data?.filter((item) => item.status === "ACTIVE").length ??
            0}{" "}
          active
        </div>
      </header>

      <section className="integration-section">
        <header className="integration-section__header">
          <div><h2>Messaging</h2><p>Send HRMS updates through your platform channels.</p></div>
          <span>{[whatsapp, email].filter((provider) => provider?.status === "ACTIVE").length} active</span>
        </header>
        <div className="integration-grid integration-grid--messaging">
          {whatsapp && <ProviderCard key={whatsapp.providerKey} provider={whatsapp} />}
          {email && <ProviderCard key={email.providerKey} provider={email} />}
          {query.isLoading && <div className="integration-loading">Loading messaging providers…</div>}
        </div>
      </section>

      <AttendanceDevicesCard />

      {payments.length > 0 && (
        <details className="integration-section integration-section--foldout">
          <summary><span><PlugZap size={16} /><strong>Payment gateways</strong><small>{payments.length} providers</small></span><ChevronDown size={16} /></summary>
          <div className="integration-grid">
            {payments.map((provider) => <ProviderCard key={provider.providerKey} provider={provider} />)}
          </div>
        </details>
      )}
      {otherProviders.length > 0 && (
        <details className="integration-section integration-section--foldout">
          <summary><span><PlugZap size={16} /><strong>Other providers</strong><small>{otherProviders.length} providers</small></span><ChevronDown size={16} /></summary>
          <div className="integration-grid">
            {otherProviders.map((provider) => <ProviderCard key={provider.providerKey} provider={provider} />)}
          </div>
        </details>
      )}
    </div>
  );
}
