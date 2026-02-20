import { cn } from "@/lib/utils";

interface CursorToggleProps {
	checked: boolean;
	onCheckedChange: (value: boolean) => void;
	className?: string;
}

export function CursorToggle({ checked, onCheckedChange, className }: CursorToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange(!checked)}
			className={cn(
				"relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
				checked ? "bg-cc-accent" : "bg-[#23232a]",
				className,
			)}
		>
			<span
				className={cn(
					"pointer-events-none flex h-5 w-5 items-center justify-center rounded-full shadow-md transition-all duration-300",
					checked
						? "translate-x-8 bg-white shadow-[0_0_8px_rgba(249,115,22,0.4)]"
						: "translate-x-1 bg-white/10 shadow-[0_0_6px_rgba(255,255,255,0.1)]",
				)}
				style={{
					transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
				}}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					className={cn(
						"transition-all duration-300",
						checked ? "text-cc-accent opacity-100 scale-100" : "text-slate-500 opacity-50 scale-90",
					)}
				>
					<path
						d="M4 4L10.5 20.5L13 13L20.5 10.5L4 4Z"
						fill="currentColor"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
		</button>
	);
}
