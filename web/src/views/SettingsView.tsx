import { Eye, EyeOff, Save, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PrimaryBtn, SecondaryBtn, Toggle } from "@/components/ui";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

type SettingsTab = "General" | "Telegram" | "Auth" | "Advanced";

interface SettingsForm {
  defaultModel: string;
  port: string;
  notificationMode: string;
  telegramToken: string;
  telegramUserId: string;
  telegramEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  authorizedEmail: string;
  modelTiers: {
    high: string[];
    medium: string[];
    low: string[];
  };
  selfEdit: boolean;
  watchdog: boolean;
}

const tabs: SettingsTab[] = ["General", "Telegram", "Auth", "Advanced"];
const MASK = "••••••••";
const inputClass =
  "bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30";
const tabClass =
  "cursor-pointer px-2 pb-2 text-[14px] border-b font-mono uppercase tracking-[0.18em] transition-colors";

const emptySettings: SettingsForm = {
  defaultModel: "",
  port: "3170",
  notificationMode: "meaningful",
  telegramToken: "",
  telegramUserId: "",
  telegramEnabled: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  authorizedEmail: "",
  modelTiers: {
    high: [],
    medium: [],
    low: [],
  },
  selfEdit: false,
  watchdog: true,
};

async function authJson<T>(paths: string[], init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;

  for (let index = 0; index < paths.length; index += 1) {
    const res = await fetch(paths[index], {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    if (res.status === 404 && index < paths.length - 1) continue;

    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }

  throw new Error("Request failed");
}

function parseTier(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSettings(data: Record<string, unknown>): SettingsForm {
  return {
    defaultModel: String(data.defaultModel ?? data.model ?? ""),
    port: String(data.port ?? "3170"),
    notificationMode: String(data.notificationMode ?? data.backgroundNotifyMode ?? "meaningful"),
    telegramToken: String(data.telegramToken ?? data.telegramBotToken ?? ""),
    telegramUserId: String(data.telegramUserId ?? data.authorizedUserId ?? ""),
    telegramEnabled: Boolean(data.telegramEnabled),
    supabaseUrl: String(data.supabaseUrl ?? ""),
    supabaseAnonKey: String(data.supabaseAnonKey ?? ""),
    authorizedEmail: String(data.authorizedEmail ?? ""),
    modelTiers: {
      high: parseTier(
        data.modelTiers && typeof data.modelTiers === "object"
          ? (data.modelTiers as Record<string, unknown>).high
          : data.highModels,
      ),
      medium: parseTier(
        data.modelTiers && typeof data.modelTiers === "object"
          ? (data.modelTiers as Record<string, unknown>).medium
          : data.mediumModels,
      ),
      low: parseTier(
        data.modelTiers && typeof data.modelTiers === "object"
          ? (data.modelTiers as Record<string, unknown>).low
          : data.lowModels,
      ),
    },
    selfEdit: Boolean(data.selfEdit ?? data.selfEditEnabled),
    watchdog: Boolean(data.watchdog ?? data.watchdogEnabled ?? true),
  };
}

function buildPayload(settings: SettingsForm) {
  const telegramToken = settings.telegramToken === MASK ? undefined : settings.telegramToken;
  const supabaseAnonKey = settings.supabaseAnonKey === MASK ? undefined : settings.supabaseAnonKey;

  return {
    defaultModel: settings.defaultModel,
    port: Number(settings.port || 3170),
    notificationMode: settings.notificationMode,
    backgroundNotifyMode: settings.notificationMode,
    telegramToken,
    telegramBotToken: telegramToken,
    telegramUserId: settings.telegramUserId ? Number(settings.telegramUserId) : undefined,
    authorizedUserId: settings.telegramUserId ? Number(settings.telegramUserId) : undefined,
    telegramEnabled: settings.telegramEnabled,
    supabaseUrl: settings.supabaseUrl,
    supabaseAnonKey,
    authorizedEmail: settings.authorizedEmail,
    modelTiers: settings.modelTiers,
    selfEdit: settings.selfEdit,
    selfEditEnabled: settings.selfEdit,
    watchdog: settings.watchdog,
    watchdogEnabled: settings.watchdog,
  };
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.04] py-4 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:items-center">
      <div className="w-40 text-[14px] font-mono text-zinc-500">{label}</div>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function SensitiveField({
  value,
  placeholder,
  visible,
  onToggle,
  onChange,
  onReveal,
  revealField,
}: {
  value: string;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onReveal?: (field: string, realValue: string) => void;
  revealField?: string;
}) {
  const handleToggle = async () => {
    if (!visible && revealField && value === MASK) {
      try {
        const data = await authJson<Record<string, string>>([`/api/settings/reveal?field=${revealField}`]);
        if (data[revealField]) {
          onChange(data[revealField]);
          onReveal?.(revealField, data[revealField]);
        }
      } catch {
        // If reveal fails, just toggle visibility of the masked value
      }
    }
    onToggle();
  };

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} w-full pr-10`}
      />
      <button
        type="button"
        onClick={handleToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function SettingsView() {
  const [settings, setSettings] = useState<SettingsForm>(emptySettings);
  const [initialSettings, setInitialSettings] = useState<SettingsForm>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("General");
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  const loadSettings = useCallback(async () => {
    const response = await authJson<Record<string, unknown>>(["/api/config", "/api/settings"]);
    const normalized = normalizeSettings(response);
    setSettings(normalized);
    setInitialSettings(normalized);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadSettings();
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSettings]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [initialSettings, settings],
  );

  const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleReveal = (_field: string, realValue: string) => {
    // Update initialSettings so revealing a secret doesn't mark the form dirty
    setInitialSettings((current) => {
      if (_field === "telegramBotToken") return { ...current, telegramToken: realValue };
      if (_field === "supabaseAnonKey") return { ...current, supabaseAnonKey: realValue };
      return current;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await authJson(["/api/config", "/api/settings"], {
        method: "PUT",
        body: JSON.stringify(buildPayload(settings)),
      });
      setInitialSettings(settings);
      notifySuccess("Settings saved");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[14px] font-mono text-zinc-500">Loading settings…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-6 p-6 text-zinc-200">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl leading-none text-zinc-100" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Settings
          </h1>
          <p className="mt-2 text-[14px] font-mono text-zinc-500">
            Control auth, notifications, models, and runtime behavior.
          </p>
        </div>
      </div>

      <div className="glass-card border border-white/[0.07] rounded-2xl overflow-hidden w-full lg:w-1/2">
        <div className="px-5 pt-4">
          <div className="flex flex-wrap gap-4 border-b border-white/[0.06]">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${tabClass} ${activeTab !== tab ? "hover:text-zinc-300" : ""}`}
                style={{
                  borderColor: activeTab === tab ? "#66FCF1" : "transparent",
                  color: activeTab === tab ? "#66FCF1" : undefined,
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
          {activeTab === "General" ? (
            <div className="space-y-1">
              <FormRow label="Default model">
                <input
                  value={settings.defaultModel}
                  onChange={(event) => updateField("defaultModel", event.target.value)}
                  placeholder="gpt-5"
                  className={`${inputClass} w-56`}
                />
              </FormRow>
              <FormRow label="Port">
                <input
                  type="number"
                  value={settings.port}
                  onChange={(event) => updateField("port", event.target.value)}
                  className={`${inputClass} w-24`}
                />
              </FormRow>
              <FormRow label="Notification mode">
                <select
                  value={settings.notificationMode}
                  onChange={(event) => updateField("notificationMode", event.target.value)}
                  className={`${inputClass} w-40`}
                >
                  <option value="all">all</option>
                  <option value="meaningful">meaningful</option>
                  <option value="off">off</option>
                </select>
              </FormRow>
            </div>
          ) : null}

          {activeTab === "Telegram" ? (
            <div className="space-y-1">
              <FormRow label="Enable">
                <Toggle
                  checked={settings.telegramEnabled}
                  onChange={() => updateField("telegramEnabled", !settings.telegramEnabled)}
                />
              </FormRow>
              <FormRow label="Bot token">
                <div className="w-48">
                  <SensitiveField
                    value={settings.telegramToken}
                    visible={showTelegramToken}
                    onToggle={() => setShowTelegramToken((current) => !current)}
                    onChange={(value) => updateField("telegramToken", value)}
                    onReveal={handleReveal}
                    placeholder="Telegram bot token"
                    revealField="telegramBotToken"
                  />
                </div>
              </FormRow>
              <FormRow label="Authorized user ID">
                <input
                  value={settings.telegramUserId}
                  onChange={(event) => updateField("telegramUserId", event.target.value)}
                  placeholder="123456789"
                  className={`${inputClass} w-40`}
                />
              </FormRow>
            </div>
          ) : null}

          {activeTab === "Auth" ? (
            <div className="space-y-1">
              <FormRow label="Supabase URL">
                <input
                  value={settings.supabaseUrl}
                  onChange={(event) => updateField("supabaseUrl", event.target.value)}
                  placeholder="https://project.supabase.co"
                  className={`${inputClass} w-72`}
                />
              </FormRow>
              <FormRow label="Anon key">
                <div className="w-72">
                  <SensitiveField
                    value={settings.supabaseAnonKey}
                    visible={showSupabaseKey}
                    onToggle={() => setShowSupabaseKey((current) => !current)}
                    onChange={(value) => updateField("supabaseAnonKey", value)}
                    onReveal={handleReveal}
                    placeholder="Supabase anon key"
                    revealField="supabaseAnonKey"
                  />
                </div>
              </FormRow>
              <FormRow label="Authorized email">
                <input
                  type="email"
                  value={settings.authorizedEmail}
                  onChange={(event) => updateField("authorizedEmail", event.target.value)}
                  placeholder="you@example.com"
                  className={`${inputClass} w-64`}
                />
              </FormRow>
            </div>
          ) : null}

          {activeTab === "Advanced" ? (
            <div className="space-y-1">
              <FormRow label="Self-edit">
                <Toggle checked={settings.selfEdit} onChange={() => updateField("selfEdit", !settings.selfEdit)} />
              </FormRow>
              <FormRow label="Watchdog">
                <Toggle checked={settings.watchdog} onChange={() => updateField("watchdog", !settings.watchdog)} />
              </FormRow>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-[14px] font-mono text-zinc-600">
            {dirty ? "Unsaved changes" : `Secrets remain masked as ${MASK}`}
          </p>
          <div className="flex items-center gap-2">
            <SecondaryBtn
              onClick={() => setSettings(initialSettings)}
              className={`px-4 py-2 ${dirty ? "" : "pointer-events-none opacity-50"}`}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={save} className={`px-4 py-2 ${saving ? "pointer-events-none opacity-60" : ""}`}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
