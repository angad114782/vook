import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  KeyRound,
  MessageCircle,
  PlugZap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { integrationsApi, type Integration } from "../../api/integrations";
import AttendanceDevicesCard from "./AttendanceDevicesCard";
import { isMockMode } from "../../config/runtime";

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

      {isMockMode
        ? <section className="admin-card"><h2>Attendance devices</h2><p className="notice-muted">Device connections need the live server. Switch the app to API mode to add providers and set API keys.</p></section>
        : <AttendanceDevicesCard />}

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
