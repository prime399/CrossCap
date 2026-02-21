import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		className={cn("relative flex w-full touch-none select-none items-center py-1", className)}
		{...props}
	>
		<SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/12">
			<SliderPrimitive.Range className="absolute h-full bg-[#2ea8ff]" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-white/35 bg-[#f8fafc] shadow-[0_2px_8px_rgba(15,23,42,0.45)] transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ea8ff]/50 disabled:pointer-events-none disabled:opacity-50" />
	</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
