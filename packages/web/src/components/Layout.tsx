import { cn } from '@/lib/utils';
import {
	BarChart2,
	BookOpen,
	Calendar,
	Inbox,
	MessageSquare,
	Settings,
	Users,
	Zap,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

const IO_MARK_PATH =
	'M147.692 0C178.28 0.00010928 203.077 24.7968 203.077 55.3848C203.077 85.0894 179.692 109.331 150.327 110.706C126.508 116.901 108.924 138.549 108.924 164.308C108.924 167.879 109.261 171.372 109.907 174.755C109.903 174.756 109.898 174.755 109.894 174.756C110.468 177.955 110.77 181.25 110.77 184.615C110.77 187.98 110.468 191.274 109.894 194.474C109.898 194.474 109.903 194.475 109.907 194.476C109.261 197.859 108.924 201.351 108.924 204.923C108.924 230.68 126.507 252.329 150.325 258.524C179.691 259.899 203.077 284.14 203.077 313.846C203.077 344.434 178.28 369.23 147.692 369.23C117.104 369.23 92.3076 344.434 92.3076 313.846C92.3076 309.539 92.7986 305.348 93.7285 301.324C94.007 299.075 94.1543 296.785 94.1543 294.461C94.1541 266.662 73.6718 243.647 46.9756 239.682C46.9934 239.579 47.0138 239.477 47.0322 239.374C20.4072 235.347 2.80541e-05 212.364 0 184.615C0 156.866 20.4071 133.883 47.0322 129.855C47.0139 129.753 46.9934 129.651 46.9756 129.549C73.6719 125.584 94.1542 102.569 94.1543 74.7695C94.1543 72.4447 94.0063 70.1538 93.7275 67.9043C92.7979 63.8813 92.3076 59.6903 92.3076 55.3848C92.3076 24.7967 117.104 0 147.692 0ZM332.308 0C362.896 4.74175e-05 387.692 24.7967 387.692 55.3848C387.692 60.1359 387.093 64.747 385.968 69.1475C385.781 70.9962 385.683 72.8716 385.683 74.7695C385.683 102.569 406.165 125.584 432.861 129.549C432.845 129.643 432.826 129.738 432.809 129.832C459.511 133.792 480 156.811 480 184.615C480 212.419 459.511 235.438 432.809 239.397C432.826 239.492 432.845 239.587 432.861 239.682C406.165 243.647 385.683 266.661 385.683 294.461C385.683 296.358 385.781 298.233 385.968 300.081C387.093 304.482 387.692 309.094 387.692 313.846C387.692 344.434 362.896 369.23 332.308 369.23C301.72 369.23 276.923 344.434 276.923 313.846C276.923 309.537 277.414 305.344 278.345 301.318C278.622 299.071 278.77 296.783 278.77 294.461C278.769 266.661 258.287 243.647 231.591 239.682C231.609 239.579 231.629 239.477 231.647 239.374C205.022 235.347 184.615 212.364 184.615 184.615C184.615 156.866 205.022 133.883 231.647 129.855C231.629 129.753 231.609 129.651 231.591 129.549C258.287 125.584 278.769 102.569 278.77 74.7695C278.77 72.4467 278.622 70.1582 278.345 67.9111C277.414 63.886 276.923 59.6928 276.923 55.3848C276.923 24.7967 301.72 0 332.308 0Z';

const NAV_ITEMS = [
	{ to: '/', icon: MessageSquare, label: 'Chat' },
	{ to: '/squads', icon: Users, label: 'Squads' },
	{ to: '/feed', icon: Inbox, label: 'Feed' },
	{ to: '/skills', icon: Zap, label: 'Skills' },
	{ to: '/schedules', icon: Calendar, label: 'Schedules' },
	{ to: '/wiki', icon: BookOpen, label: 'Wiki' },
	{ to: '/usage', icon: BarChart2, label: 'Usage' },
	{ to: '/settings', icon: Settings, label: 'Settings' },
] as const;

function IoMark({ height = 28 }: { height?: number }) {
	const width = Math.round(height * (480 / 369.23));
	return (
		<svg width={width} height={height} viewBox="0 0 480 369.23" fill="none" aria-hidden>
			<path d={IO_MARK_PATH} fill="url(#io-g)" />
			<defs>
				<linearGradient
					id="io-g"
					x1="0"
					x2="450.529"
					y1="347"
					y2="14.3087"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D83333" />
					<stop offset="0.515" stopColor="#E43A9C" />
					<stop offset="1" stopColor="#F041FF" />
				</linearGradient>
			</defs>
		</svg>
	);
}

export function Layout() {
	return (
		<div className="flex h-screen relative z-10">
			{/* Sidebar */}
			<aside className="w-16 flex flex-col items-center py-4 gap-1 border-r border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm">
				{/* Logo */}
				<div className="mb-4">
					<IoMark height={24} />
				</div>

				{/* Nav items */}
				<nav className="flex flex-col gap-1 flex-1">
					{NAV_ITEMS.map(({ to, icon: Icon, label }) => (
						<NavLink
							key={to}
							to={to}
							end={to === '/'}
							className={({ isActive }) =>
								cn(
									'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
									'hover:bg-white/5',
									isActive && 'bg-white/10 text-[var(--color-accent)]',
									!isActive && 'text-[var(--color-muted-foreground)]',
								)
							}
							title={label}
						>
							<Icon size={20} />
						</NavLink>
					))}
				</nav>
			</aside>

			{/* Main content */}
			<main className="flex-1 overflow-hidden">
				<Outlet />
			</main>
		</div>
	);
}
