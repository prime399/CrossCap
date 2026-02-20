import Block from "@uiw/react-color-block";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CursorToggle } from "./CursorToggle";

interface CursorSettingsPanelProps {
	cursorEnabled?: boolean;
	onCursorEnabledChange?: (value: boolean) => void;
	cursorSize?: number;
	onCursorSizeChange?: (value: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (value: number) => void;
	clickHighlight?: boolean;
	onClickHighlightChange?: (value: boolean) => void;
	clickHighlightColor?: string;
	onClickHighlightColorChange?: (value: string) => void;
}

const HIGHLIGHT_COLORS = [
	"#FFCC00",
	"#FF0000",
	"#00FF00",
	"#0000FF",
	"#FF6B00",
	"#E91E63",
	"#9B59B6",
	"#00BCD4",
	"#f97316",
	"#FFFFFF",
];

export function CursorSettingsPanel({
	cursorEnabled = true,
	onCursorEnabledChange,
	cursorSize = 1,
	onCursorSizeChange,
	cursorSmoothing = 0,
	onCursorSmoothingChange,
	clickHighlight = false,
	onClickHighlightChange,
	clickHighlightColor = "#FFCC00",
	onClickHighlightColorChange,
}: CursorSettingsPanelProps) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
				<div className="text-[11px] font-medium text-slate-300">Show Cursor</div>
				<CursorToggle checked={cursorEnabled} onCheckedChange={(v) => onCursorEnabledChange?.(v)} />
			</div>

			<div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
				<div className="flex items-center justify-between mb-1.5">
					<div className="text-[11px] font-medium text-slate-300">Cursor Size</div>
					<span className="text-[10px] text-slate-500 font-mono">{cursorSize.toFixed(1)}x</span>
				</div>
				<Slider
					value={[cursorSize]}
					onValueChange={(values) => onCursorSizeChange?.(values[0])}
					min={0.5}
					max={3}
					step={0.1}
					className="w-full [&_[role=slider]]:bg-cc-accent [&_[role=slider]]:border-cc-accent [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
				/>
			</div>

			<div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
				<div className="flex items-center justify-between mb-1.5">
					<div className="text-[11px] font-medium text-slate-300">Smoothing</div>
					<span className="text-[10px] text-slate-500 font-mono">{cursorSmoothing}%</span>
				</div>
				<Slider
					value={[cursorSmoothing]}
					onValueChange={(values) => onCursorSmoothingChange?.(values[0])}
					min={0}
					max={100}
					step={1}
					className="w-full [&_[role=slider]]:bg-cc-accent [&_[role=slider]]:border-cc-accent [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
				/>
			</div>

			<div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
				<div className="flex items-center gap-2">
					<div className="text-[11px] font-medium text-slate-300">Click Highlight</div>
					<Popover>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="w-4 h-4 rounded-full border border-white/20 transition-colors hover:border-white/40"
								style={{ backgroundColor: clickHighlightColor }}
								aria-label="Pick highlight color"
							/>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-2 bg-[#1a1a1f] border-white/10" side="top">
							<Block
								color={clickHighlightColor}
								colors={HIGHLIGHT_COLORS}
								onChange={(color) => onClickHighlightColorChange?.(color.hex)}
							/>
						</PopoverContent>
					</Popover>
				</div>
				<Switch
					checked={clickHighlight}
					onCheckedChange={onClickHighlightChange}
					className="data-[state=checked]:bg-cc-accent scale-90"
				/>
			</div>
		</div>
	);
}
