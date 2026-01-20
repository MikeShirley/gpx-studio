import { useState } from 'react';

interface TreeNodeProps {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleEnabled: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  color?: string;
  subtitle?: string;
  tooltip?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TreeNode({
  icon,
  label,
  enabled,
  selected,
  onSelect,
  onToggleEnabled,
  expandable,
  expanded,
  onToggleExpanded,
  color,
  subtitle,
  tooltip,
  onMouseEnter: onMouseEnterProp,
  onMouseLeave: onMouseLeaveProp,
}: TreeNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (tooltip) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({ x: rect.right + 8, y: rect.top });
      setShowTooltip(true);
    }
    onMouseEnterProp?.();
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    onMouseLeaveProp?.();
  };

  return (
    <div
      className={`
        tree-node-item
        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm relative
        transition-all duration-150
        border-l-4
        ${selected ? 'selected-item' : ''}
        ${!enabled ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Tooltip - pointer-events-none prevents it from interfering with mouse events */}
      {showTooltip && tooltip && (
        <div
          className="fixed z-[10001] bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-pre-line max-w-[250px] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {tooltip}
        </div>
      )}
      {/* Expand/collapse button */}
      {expandable ? (
        <button
          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded?.();
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      ) : (
        <div className="w-4" />
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          e.stopPropagation();
          onToggleEnabled();
        }}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
      />

      {/* Color indicator */}
      {color && (
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Icon */}
      <span className="flex-shrink-0">{icon}</span>

      {/* Label and subtitle */}
      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {subtitle && (
          <div className="text-xs text-gray-400 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
