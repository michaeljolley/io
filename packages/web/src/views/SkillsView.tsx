import { MarkdownRenderer } from "@/components/ui/markdown";
import { Chip, DangerBtn, PrimaryBtn, SecondaryBtn } from "@/components/ui/shared";
import { api } from "@/lib/api";
import {
	Download,
	ExternalLink,
	LoaderCircle,
	Pencil,
	Search,
	Sparkles,
	Trash2,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SkillSourceTab = "installed" | "awesome-copilot" | "skillssh";
type RemoteSkillSource = Exclude<SkillSourceTab, "installed">;

function getSkillKey(skill: { name: string; url?: string }): string {
	return "url" in skill && skill.url ? skill.url : skill.name;
}

interface InstalledSkillSummary {
	name: string;
	activatedForOrchestrator: boolean;
	preview: string;
	description: string;
	filePath: string;
}

interface InstalledSkillDetail {
	name: string;
	content: string;
	filePath: string;
}

interface RemoteSkill {
	name: string;
	title: string;
	description: string;
	url: string;
	source: RemoteSkillSource;
	installed: boolean;
	registrySource?: string;
	skillId?: string;
	installs?: number;
}

const SOURCE_TABS: Array<{ id: SkillSourceTab; label: string }> = [
	{ id: "installed", label: "Installed" },
	{ id: "awesome-copilot", label: "Awesome Copilot" },
	{ id: "skillssh", label: "skills.sh" },
];

function formatSourceLabel(source: RemoteSkillSource) {
	return source === "awesome-copilot" ? "Awesome Copilot" : "skills.sh";
}

function formatInstalls(installs?: number) {
	if (!installs) return null;
	if (installs >= 1_000_000)
		return `${(installs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M installs`;
	if (installs >= 1_000) return `${(installs / 1_000).toFixed(1).replace(/\.0$/, "")}K installs`;
	return `${installs} installs`;
}

function getRegistryUrl(skill: RemoteSkill): string | null {
	if (skill.source === "skillssh" && skill.registrySource && skill.skillId) {
		return `https://www.skills.sh/${skill.registrySource}/${skill.skillId}`;
	}
	if (skill.source === "awesome-copilot") {
		const match = skill.url?.match(
			/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/(?:main|HEAD)\/(.+)\/SKILL\.md/,
		);
		if (match) {
			return `https://github.com/${match[1]}/tree/main/${match[2]}`;
		}
	}
	return null;
}

interface ParsedSkill {
	frontMatter: Record<string, string | string[] | Record<string, string>>;
	body: string;
}

function parseArrayValue(value: string): string[] {
	return value
		.slice(1, -1)
		.split(",")
		.map((s) => s.trim().replace(/^["']|["']$/g, ""));
}

function processKvLine(
	frontMatter: Record<string, string | string[] | Record<string, string>>,
	currentKey: string,
	currentArrayItems: string[] | null,
	value: string,
	newKey: string,
): { key: string; arrayItems: string[] | null } {
	if (currentKey && currentArrayItems) {
		frontMatter[currentKey] = currentArrayItems;
	}
	const trimmed = value.trim();
	if (trimmed === "" || trimmed === "[]") {
		return { key: newKey, arrayItems: [] };
	}
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		frontMatter[newKey] = parseArrayValue(trimmed);
		return { key: newKey, arrayItems: null };
	}
	frontMatter[newKey] = trimmed.replace(/^["']|["']$/g, "");
	return { key: newKey, arrayItems: null };
}

function parseFrontMatterLines(
	fmRaw: string,
): Record<string, string | string[] | Record<string, string>> {
	const frontMatter: Record<string, string | string[] | Record<string, string>> = {};
	let currentKey = "";
	let currentArrayItems: string[] | null = null;

	for (const line of fmRaw.split("\n")) {
		const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
		if (kvMatch) {
			const result = processKvLine(
				frontMatter,
				currentKey,
				currentArrayItems,
				kvMatch[2] ?? "",
				kvMatch[1] ?? "",
			);
			currentKey = result.key;
			currentArrayItems = result.arrayItems;
		} else if (line.match(/^\s+-\s+(.+)/) && currentKey) {
			if (!currentArrayItems) currentArrayItems = [];
			currentArrayItems.push(line.replace(/^\s+-\s+/, "").trim());
		}
	}
	if (currentKey && currentArrayItems) {
		frontMatter[currentKey] = currentArrayItems;
	}

	return frontMatter;
}

function parseSkillContent(content: string): ParsedSkill {
	const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!fmMatch) {
		return { frontMatter: {}, body: content };
	}

	return { frontMatter: parseFrontMatterLines(fmMatch[1] ?? ""), body: fmMatch[2] ?? "" };
}

function SkillContentView({ content }: { content: string }) {
	const { body } = parseSkillContent(content);

	if (!body.trim()) {
		return <p className="font-mono text-[11px] text-zinc-500">No content body in this skill.</p>;
	}

	return <MarkdownRenderer content={body} />;
}

function SkillsSidebar({
	sourceTab,
	setSourceTab,
	search,
	setSearch,
	installedSkillsCount,
	loadingList,
	visibleSkills,
	selectedKey,
	setSelectedKey,
	setIsEditing,
	remoteError,
}: {
	sourceTab: SkillSourceTab;
	setSourceTab: (tab: SkillSourceTab) => void;
	search: string;
	setSearch: (s: string) => void;
	installedSkillsCount: number;
	loadingList: boolean;
	visibleSkills: Array<InstalledSkillSummary | RemoteSkill>;
	selectedKey: string | null;
	setSelectedKey: (key: string) => void;
	setIsEditing: (editing: boolean) => void;
	remoteError: string | null;
}) {
	return (
		<div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
			<div className="px-2.5 pt-2.5 pb-2 flex-shrink-0 border-b border-white/[0.06] space-y-2">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-700" />
					<input
						type="text"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search skills…"
						className="w-full bg-[#181818] border border-white/[0.06] rounded-xl pl-7 pr-2 py-1.5 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#E43A9C]/30 transition-colors"
					/>
				</div>
				<div className="flex flex-col gap-0.5">
					{SOURCE_TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setSourceTab(tab.id)}
							className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors flex items-center justify-between cursor-pointer ${
								sourceTab === tab.id
									? "text-[#E43A9C]"
									: "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
							}`}
							style={sourceTab === tab.id ? { background: "rgba(228,58,156,0.10)" } : undefined}
						>
							<span>{tab.label}</span>
							{tab.id === "installed" && (
								<span className="text-[10px] text-zinc-600">{installedSkillsCount}</span>
							)}
						</button>
					))}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto py-1.5">
				{loadingList && sourceTab !== "installed" ? (
					<div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 font-mono text-[11px] text-zinc-500">
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Searching registry...
					</div>
				) : null}

				{visibleSkills.map((skill) => {
					const skillKey = getSkillKey(skill);
					const isSelected = selectedKey === skillKey;
					const description =
						skill.description || ("preview" in skill ? skill.preview : "No description available.");
					return (
						<button
							key={`${sourceTab}:${skillKey}`}
							type="button"
							onClick={() => {
								setIsEditing(false);
								setSelectedKey(skillKey);
							}}
							className={`w-full text-left px-3 py-2.5 border-b border-white/[0.03] transition-colors cursor-pointer ${
								isSelected
									? "border-l-2 border-l-[#E43A9C] bg-[#E43A9C]/5"
									: "hover:bg-white/[0.03]"
							}`}
						>
							<div className="flex items-center gap-2 mb-0.5">
								<span className="truncate font-mono text-[11px] text-zinc-200">{skill.name}</span>
								{"installed" in skill && skill.installed ? (
									<Chip variant="success">installed</Chip>
								) : null}
							</div>
							<p className="line-clamp-2 font-mono text-[10px] leading-relaxed text-zinc-600">
								{description}
							</p>
						</button>
					);
				})}

				{!loadingList && visibleSkills.length === 0 ? (
					<SkillsEmptyState sourceTab={sourceTab} search={search} remoteError={remoteError} />
				) : null}
			</div>
		</div>
	);
}

function SkillsEmptyState({
	sourceTab,
	search,
	remoteError,
}: { sourceTab: SkillSourceTab; search: string; remoteError: string | null }) {
	let message: string;
	if (remoteError) {
		message = remoteError;
	} else if (sourceTab === "skillssh" && !search.trim()) {
		message = "Start typing to search the skills.sh registry.";
	} else if (search.trim()) {
		message = "No skills match your search.";
	} else {
		message = "No skills available in this source.";
	}
	return (
		<div className="px-4 py-8">
			<p className="font-mono text-[11px] leading-relaxed text-zinc-500">{message}</p>
		</div>
	);
}

function InstalledSkillPanel({
	summary,
	detail,
	loadingDetail,
	isEditing,
	setIsEditing,
	draftContent,
	setDraftContent,
	busy,
	onSave,
	onRemove,
}: {
	summary: InstalledSkillSummary;
	detail: InstalledSkillDetail | null;
	loadingDetail: boolean;
	isEditing: boolean;
	setIsEditing: (editing: boolean) => void;
	draftContent: string;
	setDraftContent: (content: string) => void;
	busy: boolean;
	onSave: () => void;
	onRemove: (name: string) => void;
}) {
	const isActive = summary.activatedForOrchestrator;
	return (
		<>
			<div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
				<div className="flex min-w-0 gap-4">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E43A9C]/12 text-[#E43A9C]">
						<Zap className="h-6 w-6" />
					</div>
					<div className="min-w-0">
						<h3
							className="truncate text-[34px] uppercase tracking-[0.08em] text-zinc-100"
							style={{ fontFamily: "'Bebas Neue', sans-serif" }}
						>
							{summary.name}
						</h3>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<Chip variant="success">installed</Chip>
							{isActive ? (
								<Chip variant="warning">active</Chip>
							) : (
								<Chip variant="muted">inactive</Chip>
							)}
							<Chip variant="muted">local skill</Chip>
						</div>
						<div className="mt-3 space-y-1 font-mono text-[11px] text-zinc-500">
							<p>path: {summary.filePath}</p>
							<p>orchestrator: {isActive ? "enabled" : "disabled"}</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{isEditing ? (
						<PrimaryBtn
							onClick={onSave}
							disabled={busy || draftContent === parseSkillContent(detail?.content ?? "").body}
							className="px-3 py-2"
						>
							{busy ? (
								<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Pencil className="h-3.5 w-3.5" />
							)}
							Save
						</PrimaryBtn>
					) : (
						<SecondaryBtn onClick={() => setIsEditing(true)} className="px-3 py-2">
							<Pencil className="h-3.5 w-3.5" /> Edit
						</SecondaryBtn>
					)}
					<DangerBtn onClick={() => onRemove(summary.name)} className="px-3 py-2">
						{busy ? (
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Trash2 className="h-3.5 w-3.5" />
						)}
						Remove
					</DangerBtn>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto pr-1">
				{loadingDetail && !detail ? (
					<div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading skill...
					</div>
				) : isEditing ? (
					<div className="space-y-3">
						<textarea
							value={draftContent}
							onChange={(event) => setDraftContent(event.target.value)}
							className="min-h-[440px] w-full rounded-2xl border border-white/[0.08] bg-black/30 p-4 font-mono text-[12px] leading-6 text-zinc-200 outline-none transition-colors focus:border-[#E43A9C]/50"
						/>
						<div className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
							<span>Editing skill markdown</span>
							<SecondaryBtn
								onClick={() => {
									setIsEditing(false);
									const { body } = parseSkillContent(detail?.content ?? "");
									setDraftContent(body);
								}}
								className="px-3 py-2"
							>
								Cancel
							</SecondaryBtn>
						</div>
					</div>
				) : detail ? (
					<SkillContentView content={detail.content} />
				) : (
					<p className="font-mono text-[11px] text-zinc-500">
						Select an installed skill to inspect it.
					</p>
				)}
			</div>
		</>
	);
}

function RemoteSkillPanel({
	skill,
	busy,
	onInstall,
	onOpenInstalled,
}: {
	skill: RemoteSkill;
	busy: boolean;
	onInstall: (skill: RemoteSkill) => void;
	onOpenInstalled: () => void;
}) {
	const registryUrl = getRegistryUrl(skill);
	return (
		<>
			<div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
				<div className="flex min-w-0 gap-4">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E43A9C]/12 text-[#E43A9C]">
						<Sparkles className="h-6 w-6" />
					</div>
					<div className="min-w-0">
						<h3
							className="truncate text-[34px] uppercase tracking-[0.08em] text-zinc-100"
							style={{ fontFamily: "'Bebas Neue', sans-serif" }}
						>
							{skill.title || skill.name}
						</h3>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<Chip variant={skill.installed ? "success" : "default"}>
								{skill.installed ? "installed" : "available"}
							</Chip>
							<Chip variant="muted">{formatSourceLabel(skill.source)}</Chip>
							{formatInstalls(skill.installs) ? (
								<Chip variant="info">{formatInstalls(skill.installs)}</Chip>
							) : null}
						</div>
						<div className="mt-3 space-y-1 font-mono text-[11px] text-zinc-500">
							<p>registry: {formatSourceLabel(skill.source)}</p>
							{skill.registrySource ? <p>source: {skill.registrySource}</p> : null}
							{registryUrl ? (
								<a
									href={registryUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-[#E43A9C] hover:text-[#f041ff] transition-colors"
								>
									<ExternalLink className="h-3 w-3" />
									View on {formatSourceLabel(skill.source)}
								</a>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{skill.installed ? (
						<SecondaryBtn onClick={onOpenInstalled} className="px-3 py-2">
							Open installed
						</SecondaryBtn>
					) : (
						<PrimaryBtn
							onClick={() => onInstall(skill)}
							disabled={busy || (!skill.url && !skill.registrySource)}
							className="px-3 py-2"
						>
							{busy ? (
								<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Download className="h-3.5 w-3.5" />
							)}
							Install
						</PrimaryBtn>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto pr-1">
				<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
					<p className="font-mono text-[12px] leading-7 text-zinc-300">
						{skill.description || "No registry description is available for this skill yet."}
					</p>
				</div>
				<div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-black/20 p-4 font-mono text-[11px] leading-6 text-zinc-500">
					Install will fetch the skill definition from the selected registry source and add it to
					your local skills library.
				</div>
			</div>
		</>
	);
}

async function fetchRemoteSkills(
	sourceTab: SkillSourceTab,
	query: string,
	isCancelled: () => boolean,
	setRemoteSkills: (skills: RemoteSkill[]) => void,
	setRemoteError: (error: string | null) => void,
	setLoadingList: (loading: boolean) => void,
) {
	try {
		const data = await api.get<{ skills: RemoteSkill[] }>(
			`/skills/discover?source=${sourceTab}&q=${encodeURIComponent(query)}`,
		);
		if (!isCancelled()) {
			setRemoteSkills(data.skills);
			setRemoteError(null);
		}
	} catch (error) {
		if (!isCancelled()) {
			setRemoteSkills([]);
			setRemoteError(error instanceof Error ? error.message : "Discovery failed");
		}
	} finally {
		if (!isCancelled()) setLoadingList(false);
	}
}

function useRemoteSkillSearch(
	sourceTab: SkillSourceTab,
	search: string,
	setRemoteSkills: (skills: RemoteSkill[]) => void,
	setRemoteError: (error: string | null) => void,
	setLoadingList: (loading: boolean) => void,
) {
	useEffect(() => {
		if (sourceTab === "installed") {
			setRemoteError(null);
			return;
		}

		const query = search.trim();
		if (sourceTab === "skillssh" && !query) {
			setRemoteSkills([]);
			setRemoteError(null);
			setLoadingList(false);
			return;
		}

		let cancelled = false;
		setLoadingList(true);

		const timeoutId = window.setTimeout(
			() =>
				fetchRemoteSkills(
					sourceTab,
					query,
					() => cancelled,
					setRemoteSkills,
					setRemoteError,
					setLoadingList,
				),
			250,
		);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [sourceTab, search, setRemoteSkills, setRemoteError, setLoadingList]);
}

export function SkillsView() {
	const [sourceTab, setSourceTab] = useState<SkillSourceTab>("installed");
	const [installedSkills, setInstalledSkills] = useState<InstalledSkillSummary[]>([]);
	const [remoteSkills, setRemoteSkills] = useState<RemoteSkill[]>([]);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const [selectedInstalledSkill, setSelectedInstalledSkill] = useState<InstalledSkillDetail | null>(
		null,
	);
	const [search, setSearch] = useState("");
	const [loadingList, setLoadingList] = useState(false);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [draftContent, setDraftContent] = useState("");
	const [busySkillName, setBusySkillName] = useState<string | null>(null);
	const [remoteError, setRemoteError] = useState<string | null>(null);

	const loadInstalledSkills = useCallback(async () => {
		try {
			const data = await api.get<{ skills: InstalledSkillSummary[] }>("/skills");
			const installedNames = new Set(data.skills.map((skill) => (skill.name || "").toLowerCase()));
			setInstalledSkills(data.skills);
			setRemoteSkills((previous) =>
				previous.map((skill) => ({
					...skill,
					installed: installedNames.has((skill.name || "").toLowerCase()),
				})),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to load skills");
		}
	}, []);

	const loadInstalledSkillDetail = useCallback(async (name: string) => {
		setLoadingDetail(true);
		try {
			const skill = await api.get<InstalledSkillDetail>(`/skills/${encodeURIComponent(name)}`);
			setSelectedInstalledSkill(skill);
			const { body } = parseSkillContent(skill.content);
			setDraftContent(body);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to load skill");
			setSelectedInstalledSkill(null);
		} finally {
			setLoadingDetail(false);
		}
	}, []);

	useEffect(() => {
		loadInstalledSkills();
	}, [loadInstalledSkills]);

	useRemoteSkillSearch(sourceTab, search, setRemoteSkills, setRemoteError, setLoadingList);

	const filteredInstalledSkills = useMemo(() => {
		const needle = search.trim().toLowerCase();
		if (!needle) return installedSkills;
		return installedSkills.filter((skill) =>
			[skill.name, skill.description, skill.preview].some((value) =>
				value?.toLowerCase().includes(needle),
			),
		);
	}, [installedSkills, search]);

	const visibleSkills = sourceTab === "installed" ? filteredInstalledSkills : remoteSkills;
	const selectedInstalledSummary =
		filteredInstalledSkills.find((skill) => skill.name === selectedKey) ?? null;
	const selectedRemoteSkill =
		remoteSkills.find((skill) => getSkillKey(skill) === selectedKey) ?? null;
	const selectedName = selectedInstalledSummary?.name ?? selectedRemoteSkill?.name ?? null;

	useEffect(() => {
		setIsEditing(false);
		if (!visibleSkills.length) {
			setSelectedKey(null);
			if (sourceTab !== "installed") setSelectedInstalledSkill(null);
			return;
		}

		if (!selectedKey || !visibleSkills.some((skill) => getSkillKey(skill) === selectedKey)) {
			const firstSkill = visibleSkills[0];
			if (firstSkill) {
				setSelectedKey(getSkillKey(firstSkill));
			}
		}
	}, [selectedKey, sourceTab, visibleSkills]);

	useEffect(() => {
		if (sourceTab !== "installed" || !selectedName) {
			setSelectedInstalledSkill(null);
			return;
		}

		loadInstalledSkillDetail(selectedName);
	}, [loadInstalledSkillDetail, selectedName, sourceTab]);

	async function handleInstall(skill: RemoteSkill) {
		if (!skill.url && !skill.registrySource) {
			toast.error("Install source is not available for this skill yet");
			return;
		}

		setBusySkillName(skill.name);
		try {
			await api.post("/skills/install", {
				name: skill.name,
				source: skill.source,
				url: skill.url,
				registrySource: skill.registrySource,
				skillId: skill.skillId,
			});
			toast.success(`Installed ${skill.title || skill.name}`);
			await loadInstalledSkills();
			setRemoteSkills((previous) =>
				previous.map((entry) =>
					entry.name === skill.name ? { ...entry, installed: true } : entry,
				),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Install failed");
		} finally {
			setBusySkillName(null);
		}
	}

	async function handleRemove(name: string) {
		setBusySkillName(name);
		try {
			await api.delete(`/skills/${encodeURIComponent(name)}`);
			toast.success(`Removed ${name}`);
			await loadInstalledSkills();
			setRemoteSkills((previous) =>
				previous.map((skill) => (skill.name === name ? { ...skill, installed: false } : skill)),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to remove skill");
		} finally {
			setBusySkillName(null);
		}
	}

	async function handleSaveEdit() {
		if (!selectedInstalledSkill) return;
		setBusySkillName(selectedInstalledSkill.name);
		try {
			// Reconstruct full content: preserve original frontmatter + updated body
			const fmMatch = selectedInstalledSkill.content.match(/^(---\s*\n[\s\S]*?\n---\s*\n)/);
			const fullContent = fmMatch ? `${fmMatch[1]}${draftContent}` : draftContent;
			await api.put(`/skills/${encodeURIComponent(selectedInstalledSkill.name)}`, {
				content: fullContent,
			});
			toast.success(`Updated ${selectedInstalledSkill.name}`);
			setIsEditing(false);
			await Promise.all([
				loadInstalledSkills(),
				loadInstalledSkillDetail(selectedInstalledSkill.name),
			]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save skill");
		} finally {
			setBusySkillName(null);
		}
	}

	return (
		<div className="flex flex-1 min-h-0 overflow-hidden">
			<SkillsSidebar
				sourceTab={sourceTab}
				setSourceTab={setSourceTab}
				search={search}
				setSearch={setSearch}
				installedSkillsCount={installedSkills.length}
				loadingList={loadingList}
				visibleSkills={visibleSkills}
				selectedKey={selectedKey}
				setSelectedKey={setSelectedKey}
				setIsEditing={setIsEditing}
				remoteError={remoteError}
			/>

			{/* Right detail panel */}
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
				{sourceTab === "installed" && selectedInstalledSummary ? (
					<InstalledSkillPanel
						summary={selectedInstalledSummary}
						detail={selectedInstalledSkill}
						loadingDetail={loadingDetail}
						isEditing={isEditing}
						setIsEditing={setIsEditing}
						draftContent={draftContent}
						setDraftContent={setDraftContent}
						busy={busySkillName === selectedInstalledSkill?.name}
						onSave={handleSaveEdit}
						onRemove={handleRemove}
					/>
				) : sourceTab !== "installed" && selectedRemoteSkill ? (
					<RemoteSkillPanel
						skill={selectedRemoteSkill}
						busy={busySkillName === selectedRemoteSkill?.name}
						onInstall={handleInstall}
						onOpenInstalled={() => {
							setSourceTab("installed");
							setSelectedKey(selectedRemoteSkill.name);
						}}
					/>
				) : (
					<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
						<div>
							<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E43A9C]/12 text-[#E43A9C]">
								<Zap className="h-6 w-6" />
							</div>
							<h3
								className="text-[28px] uppercase tracking-[0.08em] text-zinc-100"
								style={{ fontFamily: "'Bebas Neue', sans-serif" }}
							>
								Select a Skill
							</h3>
							<p className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
								Choose a skill from the left panel to inspect details, install registry entries, or
								edit local definitions.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
