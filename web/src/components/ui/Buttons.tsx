import type { ReactNode } from "react";

export function PrimaryBtn({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 font-mono text-[14px] rounded-lg active:opacity-80 cursor-pointer primary-btn ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryBtn({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center cursor-pointer gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[14px] text-zinc-400 bg-[#252525] hover:bg-[#2e2e2e] hover:text-zinc-100 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function DangerBtn({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center cursor-pointer gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[14px] text-zinc-400 bg-[#252525] hover:bg-red-500/10 hover:text-red-400 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function WarnBtn({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center cursor-pointer gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[14px] text-zinc-400 bg-[#252525] hover:bg-amber-500/10 hover:text-amber-400 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
