import { NotificationBell } from "@/components/NotificationPanel";
import { IoMark } from "@/components/ui/io-mark";
import { StatusDot } from "@/components/ui/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { APP_VERSION, type InboxItem } from "@io/shared";
import {
	BarChart2,
	BookOpen,
	Calendar,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Inbox,
	LogOut,
	MessageSquare,
	Settings,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";

const NAV_TOP = [
	{ to: "/squads", icon: Users, label: "Squads" },
	{ to: "/skills", icon: Zap, label: "Skills" },
	{ to: "/schedules", icon: Calendar, label: "Schedules" },
	{ to: "/wiki", icon: BookOpen, label: "Wiki" },
	{ to: "/usage", icon: BarChart2, label: "Usage" },
] as const;

const NAV_BOTTOM = [
	{ to: "/", icon: MessageSquare, label: "Chat" },
	{ to: "/feed", icon: Inbox, label: "Inbox" },
	{ to: "/settings", icon: Settings, label: "Settings" },
] as const;

function NavBtn({
	to,
	icon: Icon,
	label,
	collapsed,
	badge,
}: { to: string; icon: React.ElementType; label: string; collapsed: boolean; badge?: number }) {
	return (
		<NavLink
			to={to}
			end={to === "/"}
			title={collapsed ? label : undefined}
			className={({ isActive }) =>
				cn(
					"w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono transition-colors cursor-pointer relative",
					collapsed ? "justify-center" : "",
					isActive ? "text-[#E43A9C]" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]",
				)
			}
			style={({ isActive }) => (isActive ? { background: "rgba(228,58,156,0.1)" } : undefined)}
		>
			<Icon className="w-3.5 h-3.5 flex-shrink-0" />
			{!collapsed && label}
			{badge != null && badge > 0 && (
				<span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[#E43A9C] text-[9px] text-white font-mono px-1">
					{badge > 99 ? "99+" : badge}
				</span>
			)}
		</NavLink>
	);
}

export function Layout() {
	const [collapsed, setCollapsed] = useState(false);
	const [version] = useState(APP_VERSION);
	const [unreadCount, setUnreadCount] = useState(0);
	const { supabase } = useAuth();

	useEffect(() => {
		let active = true;

		const loadUnreadCount = () => {
			api
				.get<{ entries?: InboxItem[] }>("/inbox?limit=200")
				.then((response) => {
					if (!active) {
						return;
					}
					const entries = response.entries ?? [];
					setUnreadCount(entries.filter((item) => item.status === "pending").length);
				})
				.catch(() => {});
		};

		loadUnreadCount();
		const interval = setInterval(loadUnreadCount, 30000);

		return () => {
			active = false;
			clearInterval(interval);
		};
	}, []);

	return (
		<div className="flex h-screen overflow-hidden bg-background relative">
			{/* Sidebar */}
			<div
				className={cn(
					"flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#181818] transition-all duration-200",
					collapsed ? "w-[52px]" : "w-[210px]",
				)}
			>
				{/* Logo header */}
				<div
					className={cn(
						"h-[52px] flex items-center border-b border-white/[0.06] flex-shrink-0",
						collapsed ? "justify-center px-3" : "justify-between pl-4 pr-3",
					)}
				>
					{collapsed ? (
						<IoMark height={26} />
					) : (
						<div className="flex items-center gap-2.5">
							<IoMark height={26} />
							<span
								className="text-2xl text-white tracking-wider leading-none"
								style={{ fontFamily: "'Bebas Neue', sans-serif" }}
							>
								IO
							</span>
						</div>
					)}
				</div>

				{/* Top nav */}
				<nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
					{NAV_TOP.map((item) => (
						<NavBtn key={item.to} collapsed={collapsed} {...item} />
					))}
				</nav>

				{/* Bottom nav */}
				<div className="flex-shrink-0 border-t border-white/[0.06]">
					<div className="py-1.5 px-1.5 space-y-0.5">
						{NAV_BOTTOM.map((item) => (
							<NavBtn
								key={item.to}
								collapsed={collapsed}
								badge={item.to === "/feed" ? unreadCount : undefined}
								{...item}
							/>
						))}
					</div>
					<div className="border-t border-white/[0.05] py-1.5 px-1.5 space-y-0.5">
						<a
							href={`https://github.com/michaeljolley/io/releases/tag/v${version}`}
							target="_blank"
							rel="noreferrer"
							title="GitHub"
							className={cn(
								"flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors cursor-pointer",
								collapsed && "justify-center",
							)}
						>
							<ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
							{!collapsed && <span className="text-zinc-700">v{version}</span>}
						</a>
						<button
							type="button"
							onClick={() => setCollapsed(!collapsed)}
							title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							className={cn(
								"w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors cursor-pointer",
								collapsed && "justify-center",
							)}
						>
							{collapsed ? (
								<ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
							) : (
								<ChevronLeft className="w-3.5 h-3.5 flex-shrink-0" />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
				{/* Top bar */}
				<div className="h-[52px] flex-shrink-0 flex items-center justify-between px-4 border-b border-white/[0.06] bg-[#181818]">
					<div className="flex items-center gap-2">
						<StatusDot status="connected" />
						<span className="text-[11px] font-mono text-green-400">connected</span>
					</div>
					<div className="flex items-center gap-1.5">
						{/* Notification bell */}
						<NotificationBell />

						{/* Logout */}
						{supabase && (
							<button
								type="button"
								onClick={() => supabase.auth.signOut()}
								className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
								title="Sign out"
							>
								<LogOut className="w-3.5 h-3.5" />
							</button>
						)}
					</div>
				</div>

				{/* Page content */}
				<main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
					<div
						className="absolute inset-0 overflow-hidden pointer-events-none"
						style={{ zIndex: 0 }}
					>
						<div className="orb orb-pink" />
						<div className="orb orb-gray" />
					</div>
					<Outlet />
				</main>
			</div>
		</div>
	);
}
