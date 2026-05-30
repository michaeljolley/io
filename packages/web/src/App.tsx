import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/auth';
import { ChatView } from './views/ChatView';
import { FeedView } from './views/FeedView';
import { LoginView } from './views/LoginView';
import { SchedulesView } from './views/SchedulesView';
import { SettingsView } from './views/SettingsView';
import { SkillsView } from './views/SkillsView';
import { SquadsView } from './views/SquadsView';
import { UsageView } from './views/UsageView';
import { WikiView } from './views/WikiView';

function AuthGate({ children }: { children: React.ReactNode }) {
	const { session, supabase, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-[var(--color-muted-foreground)]">
				Loading...
			</div>
		);
	}

	// If Supabase isn't configured, skip auth entirely
	if (!supabase) {
		return <>{children}</>;
	}

	// Require login
	if (!session) {
		return <LoginView />;
	}

	return <>{children}</>;
}

export function App() {
	return (
		<AuthProvider>
			{/* Floating orbs */}
			<div className="orb orb-1" />
			<div className="orb orb-2" />
			<div className="orb orb-3" />

			<AuthGate>
				<Routes>
					<Route element={<Layout />}>
						<Route index element={<ChatView />} />
						<Route path="squads" element={<SquadsView />} />
						<Route path="squads/:name" element={<SquadsView />} />
						<Route path="feed" element={<FeedView />} />
						<Route path="skills" element={<SkillsView />} />
						<Route path="schedules" element={<SchedulesView />} />
						<Route path="wiki" element={<WikiView />} />
						<Route path="settings" element={<SettingsView />} />
						<Route path="usage" element={<UsageView />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Route>
				</Routes>
			</AuthGate>
		</AuthProvider>
	);
}
