import { useTimezone } from "@/hooks/use-config";
import { formatTime } from "@/lib/timezone";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface Notification {
	id: string;
	message: string;
	timestamp: string;
	eventType: string;
}

// Global notification store (persists across mounts)
let globalNotifications: Notification[] = [];
const listeners = new Set<() => void>();

export function pushNotification(n: Notification) {
	globalNotifications = [n, ...globalNotifications].slice(0, 50);
	for (const fn of listeners) fn();
}

export function clearNotifications() {
	globalNotifications = [];
	for (const fn of listeners) fn();
}

function useNotifications() {
	const [, forceUpdate] = useState(0);
	useEffect(() => {
		const listener = () => forceUpdate((n) => n + 1);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return globalNotifications;
}

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const notifications = useNotifications();
	const panelRef = useRef<HTMLDivElement>(null);
	const [lastSeenCount, setLastSeenCount] = useState(0);
	const timezone = useTimezone();

	const unreadCount = notifications.length - lastSeenCount;

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		if (open) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [open]);

	function toggle() {
		setOpen(!open);
		if (!open) {
			setLastSeenCount(notifications.length);
		}
	}

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={toggle}
				className="relative p-2 rounded-xl hover:bg-white/[0.05] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
				title="Notifications"
			>
				<Bell className="w-3.5 h-3.5" />
				{unreadCount > 0 && (
					<span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E43A9C]" />
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#1a1a1a] shadow-2xl z-50">
					<div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
						<span className="text-xs font-mono text-zinc-300">Notifications</span>
						{notifications.length > 0 && (
							<button
								type="button"
								onClick={clearNotifications}
								className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer"
							>
								Clear all
							</button>
						)}
					</div>

					{notifications.length === 0 ? (
						<div className="px-4 py-8 text-center text-zinc-600 text-xs font-mono">
							No notifications yet
						</div>
					) : (
						<div className="divide-y divide-white/[0.04]">
							{notifications.map((n) => (
								<div key={n.id} className="px-4 py-3 hover:bg-white/[0.03]">
									<p className="text-xs text-zinc-300 leading-relaxed">{n.message}</p>
									<p className="text-[10px] text-zinc-600 font-mono mt-1">
										{formatTime(n.timestamp, timezone)}
									</p>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
