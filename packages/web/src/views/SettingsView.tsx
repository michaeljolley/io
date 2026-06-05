import { PrimaryBtn } from "@/components/ui/shared";
import { api } from "@/lib/api";
import { TIMEZONE_OPTIONS } from "@/lib/timezone";
import { Eye, EyeOff } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

interface Config {
	apiPort: number;
	logLevel: string;
	defaultModel: string;
	maxInstancesPerSquad: number;
	dataDir: string;
	timezone: string;
	pricing: { refreshIntervalHours: number };
	telegram: { botToken: string | null; allowedChatIds: number[] };
	supabase: { projectUrl: string | null; anonKey: string | null; jwtSecret: string | null };
}

type TabId = "general" | "telegram" | "auth";

const TABS: { id: TabId; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "telegram", label: "Telegram" },
	{ id: "auth", label: "Auth" },
];

const FI_BASE =
	"rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm font-mono text-zinc-300 outline-none focus:border-[#E43A9C]/50";

// Sized input classes based on expected data width
const FI_XS = `${FI_BASE} w-[72px]`; // port, small numbers
const FI_SM = `${FI_BASE} w-[100px]`; // short values (instances, hours)
const FI_MD = `${FI_BASE} w-[200px]`; // model names, log level
const FI_LG = `${FI_BASE} w-[320px]`; // URLs, tokens, paths
const FI_SELECT = `${FI_BASE} w-[140px] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M3%204.5L6%208l3-3.5H3z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8`;

export function SettingsView() {
	const [config, setConfig] = useState<Config | null>(null);
	const [tab, setTab] = useState<TabId>("general");

	useEffect(() => {
		api
			.get<{ config: Config }>("/config")
			.then((d) => setConfig(d.config))
			.catch(() => {});
	}, []);

	function update(patch: Partial<Config>) {
		if (!config) return;
		setConfig({ ...config, ...patch });
	}

	async function save() {
		if (!config) return;
		try {
			const { dataDir: _dataDir, ...rest } = config;
			await api.patch("/config", rest);
			toast.success("Settings saved");
		} catch {
			toast.error("Failed to save settings");
		}
	}

	if (!config) {
		return <div className="flex h-full items-center justify-center text-zinc-600">Loading...</div>;
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl">
				<h2
					className="mb-6 text-2xl tracking-wide text-zinc-100"
					style={{ fontFamily: "'Bebas Neue', sans-serif" }}
				>
					Settings
				</h2>

				<div className="mb-6 flex gap-6 border-b border-white/[0.07]">
					{TABS.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setTab(item.id)}
							className={`-mb-px border-b-2 px-1 pb-3 text-[11px] font-mono transition-colors ${
								tab === item.id
									? "border-[#E43A9C] text-[#E43A9C]"
									: "border-transparent text-zinc-500 hover:text-zinc-300"
							}`}
						>
							{item.label}
						</button>
					))}
				</div>

				<div className="glass-card rounded-2xl border border-white/[0.07] p-5">
					{tab === "general" && (
						<>
							<FormRow label="Log Level">
								<select
									value={config.logLevel}
									onChange={(e) => update({ logLevel: e.target.value })}
									className={FI_SELECT}
								>
									{["trace", "debug", "info", "warn", "error", "fatal"].map((level) => (
										<option key={level} value={level}>
											{level}
										</option>
									))}
								</select>
							</FormRow>
							<FormRow label="Default Model">
								<input
									type="text"
									value={config.defaultModel}
									onChange={(e) => update({ defaultModel: e.target.value })}
									className={FI_MD}
								/>
							</FormRow>
							<FormRow label="Timezone">
								<select
									value={config.timezone}
									onChange={(e) => update({ timezone: e.target.value })}
									className={`${FI_BASE} w-[200px] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M3%204.5L6%208l3-3.5H3z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-no-repeat pr-8`}
								>
									{TIMEZONE_OPTIONS.map((tz) => (
										<option key={tz.value} value={tz.value}>
											{tz.label}
										</option>
									))}
								</select>
							</FormRow>
							<FormRow label="Max Instances">
								<input
									type="number"
									value={config.maxInstancesPerSquad}
									onChange={(e) => update({ maxInstancesPerSquad: Number(e.target.value) })}
									className={FI_XS}
									min={1}
									max={10}
								/>
							</FormRow>
							<FormRow label="API Port">
								<input
									type="number"
									value={config.apiPort}
									onChange={(e) => update({ apiPort: Number(e.target.value) })}
									className={FI_XS}
								/>
							</FormRow>
							<FormRow label="Pricing Refresh (hrs)">
								<input
									type="number"
									value={config.pricing.refreshIntervalHours}
									onChange={(e) =>
										update({ pricing: { refreshIntervalHours: Number(e.target.value) } })
									}
									className={FI_SM}
									min={1}
								/>
							</FormRow>
							<FormRow label="Data Dir">
								<input
									type="text"
									value={config.dataDir}
									readOnly
									className={`${FI_LG} cursor-default text-zinc-500`}
								/>
							</FormRow>
						</>
					)}

					{tab === "telegram" && (
						<>
							<FormRow label="Bot Token">
								<MaskedInput
									value={config.telegram.botToken ?? ""}
									onChange={(value) =>
										update({ telegram: { ...config.telegram, botToken: value || null } })
									}
									size="lg"
								/>
							</FormRow>
							<FormRow label="Allowed Chat IDs">
								<input
									type="text"
									value={config.telegram.allowedChatIds.join(", ")}
									onChange={(e) =>
										update({
											telegram: {
												...config.telegram,
												allowedChatIds: e.target.value
													.split(",")
													.map((segment) => Number(segment.trim()))
													.filter((value) => !Number.isNaN(value)),
											},
										})
									}
									className={FI_MD}
								/>
							</FormRow>
						</>
					)}

					{tab === "auth" && (
						<>
							<FormRow label="Project URL">
								<input
									type="text"
									value={config.supabase.projectUrl ?? ""}
									onChange={(e) =>
										update({
											supabase: { ...config.supabase, projectUrl: e.target.value || null },
										})
									}
									className={FI_LG}
								/>
							</FormRow>
							<FormRow label="Anon Key">
								<MaskedInput
									value={config.supabase.anonKey ?? ""}
									onChange={(value) =>
										update({ supabase: { ...config.supabase, anonKey: value || null } })
									}
									size="lg"
								/>
							</FormRow>
							<FormRow label="JWT Secret">
								<MaskedInput
									value={config.supabase.jwtSecret ?? ""}
									onChange={(value) =>
										update({ supabase: { ...config.supabase, jwtSecret: value || null } })
									}
									size="lg"
								/>
							</FormRow>
						</>
					)}

					<div className="flex justify-end pt-6">
						<PrimaryBtn onClick={save} className="px-4 py-2.5">
							Save Settings
						</PrimaryBtn>
					</div>
				</div>
			</div>
		</div>
	);
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-6 border-b border-white/[0.07] py-3">
			<span className="text-[11px] font-mono text-zinc-400 shrink-0">{label}</span>
			<div className="flex justify-end">{children}</div>
		</div>
	);
}

function MaskedInput({
	value,
	onChange,
	size = "lg",
}: { value: string; onChange: (v: string) => void; size?: "md" | "lg" }) {
	const [visible, setVisible] = useState(false);
	const widthClass = size === "lg" ? "w-[320px]" : "w-[200px]";

	return (
		<div className="relative">
			<input
				type={visible ? "text" : "password"}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`${FI_BASE} ${widthClass} pr-9`}
			/>
			<button
				type="button"
				onClick={() => setVisible((current) => !current)}
				className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-400"
				aria-label={visible ? "Hide value" : "Show value"}
			>
				{visible ? <EyeOff size={14} /> : <Eye size={14} />}
			</button>
		</div>
	);
}
