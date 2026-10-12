import React from "react";

interface RetroWindowProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  active?: boolean;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  icon,
  subtitle,
  onMinimize,
  onMaximize,
  onClose,
  children,
  className = "",
  headerRight,
  active = true,
}) => {
  return (
    <div className={`retro-window flex flex-col overflow-hidden text-xs ${className}`}>
      {/* Title Bar */}
      <div
        className={`px-1.5 py-1 flex items-center justify-between select-none ${
          active ? "retro-titlebar" : "retro-titlebar-inactive"
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {icon && <span className="flex-shrink-0 text-amber-200">{icon}</span>}
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="font-bold tracking-wide text-white text-[11px] drop-shadow-[1px_1px_0px_rgba(0,0,0,0.8)]">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-teal-200 opacity-90 hidden sm:inline">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {headerRight}
          <button
            type="button"
            onClick={onMinimize}
            className="retro-ctrl-btn"
            title="Minimize"
          >
            _
          </button>
          <button
            type="button"
            onClick={onMaximize}
            className="retro-ctrl-btn"
            title="Maximize"
          >
            &#9633;
          </button>
          <button
            type="button"
            onClick={onClose}
            className="retro-ctrl-btn"
            title="Close"
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="p-1.5 flex-1 flex flex-col overflow-auto bg-[#E8DFCB]">
        {children}
      </div>
    </div>
  );
};
