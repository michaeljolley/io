import {
  BarChart2,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageSquare,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { IoMark } from "./IoMark";

type NavItem = { path: string; icon: React.ElementType; label: string };

const NAV_TOP: NavItem[] = [
  { path: "/squads", icon: Users, label: "Squads" },
  { path: "/skills", icon: Zap, label: "Skills" },
  { path: "/schedules", icon: Calendar, label: "Schedules" },
  { path: "/wiki", icon: BookOpen, label: "Wiki" },
  { path: "/usage", icon: BarChart2, label: "Usage" },
];

const NAV_BOTTOM: NavItem[] = [
  { path: "/chat", icon: MessageSquare, label: "Chat" },
  { path: "/feed", icon: Inbox, label: "Inbox" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function NavBtn({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center cursor-pointer gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono transition-colors ${active ? "text-[#66FCF1]" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"} ${collapsed ? "justify-center" : ""}`}
      style={active ? { background: "rgba(102,252,241,0.1)" } : undefined}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {!collapsed && item.label}
    </button>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/squads") return location.pathname.startsWith("/squads");
    if (path === "/chat") return location.pathname === "/" || location.pathname === "/chat";
    return location.pathname === path;
  };

  return (
    <div
      className={`flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#181818] transition-all duration-200 ${collapsed ? "w-[52px]" : "w-[210px]"}`}
    >
      {/* Logo header */}
      <div
        className={`h-[52px] flex items-center border-b border-white/[0.06] flex-shrink-0 ${collapsed ? "justify-center px-3" : "justify-between pl-4 pr-3"}`}
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
          <NavBtn
            key={item.path}
            item={item}
            active={isActive(item.path)}
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-white/[0.06]">
        <div className="py-1.5 px-1.5 space-y-0.5">
          {NAV_BOTTOM.map((item) => (
            <NavBtn
              key={item.path}
              item={item}
              active={isActive(item.path)}
              collapsed={collapsed}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
        <div className="border-t border-white/[0.05] py-1.5 px-1.5 space-y-0.5">
          <a
            href="https://github.com/michaeljolley/io"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            {!collapsed && <span className="text-zinc-700">v0.9.2</span>}
          </a>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-mono text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors ${collapsed ? "justify-center" : ""}`}
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
  );
}
