import { Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { ChatView } from "./views/ChatView";
import { FeedView } from "./views/FeedView";
import { SchedulesView } from "./views/SchedulesView";
import { SettingsView } from "./views/SettingsView";
import { SkillsView } from "./views/SkillsView";
import { SquadsView } from "./views/SquadsView";
import { UsageView } from "./views/UsageView";
import { WikiView } from "./views/WikiView";

export function App() {
	return (
		<>
			{/* Floating orbs */}
			<div className="orb orb-1" />
			<div className="orb orb-2" />
			<div className="orb orb-3" />

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
		</>
	);
}
