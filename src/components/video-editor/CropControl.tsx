import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type AspectRatio } from "@/utils/aspectRatioUtils";

interface CropRegion {
	x: number; // 0-1 normalized
	y: number; // 0-1 normalized
	width: number; // 0-1 normalized
	height: number; // 0-1 normalized
}

interface CropControlProps {
	videoElement: HTMLVideoElement | null;
	cropRegion: CropRegion;
	onCropChange: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	onReset?: () => void;
}

type DragHandle = "top" | "right" | "bottom" | "left";

export function CropControl({ videoElement, cropRegion, onCropChange, onReset }: CropControlProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		handle: DragHandle;
		startX: number;
		startY: number;
		initialCrop: CropRegion;
	} | null>(null);
	const [activeDrag, setActiveDrag] = useState<DragHandle | null>(null);

	useEffect(() => {
		if (!videoElement || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return;

		canvas.width = videoElement.videoWidth || 1920;
		canvas.height = videoElement.videoHeight || 1080;

		let rafId: number;
		const draw = () => {
			if (videoElement.readyState >= 2) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			}
			rafId = requestAnimationFrame(draw);
		};

		rafId = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafId);
	}, [videoElement]);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent, handle: DragHandle) => {
			e.stopPropagation();
			e.preventDefault();
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			dragRef.current = {
				handle,
				startX: (e.clientX - rect.left) / rect.width,
				startY: (e.clientY - rect.top) / rect.height,
				initialCrop: { ...cropRegion },
			};
			setActiveDrag(handle);
		},
		[cropRegion],
	);

	useEffect(() => {
		if (!activeDrag) return;

		const handleMove = (e: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;

			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			const currentX = (e.clientX - rect.left) / rect.width;
			const currentY = (e.clientY - rect.top) / rect.height;
			const deltaX = currentX - drag.startX;
			const deltaY = currentY - drag.startY;
			const ic = drag.initialCrop;
			const newCrop = { ...ic };

			switch (drag.handle) {
				case "top": {
					const newY = Math.max(0, ic.y + deltaY);
					const bottom = ic.y + ic.height;
					newCrop.y = Math.min(newY, bottom - 0.1);
					newCrop.height = bottom - newCrop.y;
					break;
				}
				case "bottom":
					newCrop.height = Math.max(0.1, Math.min(ic.height + deltaY, 1 - ic.y));
					break;
				case "left": {
					const newX = Math.max(0, ic.x + deltaX);
					const right = ic.x + ic.width;
					newCrop.x = Math.min(newX, right - 0.1);
					newCrop.width = right - newCrop.x;
					break;
				}
				case "right":
					newCrop.width = Math.max(0.1, Math.min(ic.width + deltaX, 1 - ic.x));
					break;
			}

			onCropChange(newCrop);
		};

		const handleUp = () => {
			dragRef.current = null;
			setActiveDrag(null);
		};

		document.addEventListener("pointermove", handleMove);
		document.addEventListener("pointerup", handleUp);
		return () => {
			document.removeEventListener("pointermove", handleMove);
			document.removeEventListener("pointerup", handleUp);
		};
	}, [activeDrag, onCropChange]);

	const isDefault =
		cropRegion.x === 0 && cropRegion.y === 0 && cropRegion.width === 1 && cropRegion.height === 1;

	const cropPixelX = cropRegion.x * 100;
	const cropPixelY = cropRegion.y * 100;
	const cropPixelWidth = cropRegion.width * 100;
	const cropPixelHeight = cropRegion.height * 100;
	const videoAspectRatio = videoElement
		? videoElement.videoWidth / videoElement.videoHeight
		: 16 / 9;
	const isVideoPortrait = videoAspectRatio < 1;
	const maxContainerWidth = isVideoPortrait ? "40vw" : "75vw";

	return (
		<div className="w-full p-8">
			<div
				ref={containerRef}
				className="relative w-full bg-black rounded-lg overflow-visible cursor-default select-none shadow-2xl"
				style={{
					aspectRatio: videoAspectRatio,
					maxWidth: maxContainerWidth,
					maxHeight: "75vh",
					margin: "0 auto",
				}}
			>
				<canvas
					ref={canvasRef}
					className="w-full h-full rounded-lg"
					style={{ imageRendering: "auto" }}
				/>

				<div className="absolute inset-0 pointer-events-none">
					<svg width="100%" height="100%" className="absolute inset-0">
						<defs>
							<mask id="cropMask">
								<rect width="100%" height="100%" fill="white" />
								<rect
									x={`${cropPixelX}%`}
									y={`${cropPixelY}%`}
									width={`${cropPixelWidth}%`}
									height={`${cropPixelHeight}%`}
									fill="black"
								/>
							</mask>
						</defs>
						<rect
							width="100%"
							height="100%"
							fill="black"
							fillOpacity="0.6"
							mask="url(#cropMask)"
						/>
					</svg>
				</div>

				{/* Top handle */}
				<div
					className={cn(
						"absolute h-[3px] cursor-ns-resize z-20 pointer-events-auto bg-cc-accent",
						activeDrag === "top" && "bg-white",
					)}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "top")}
				/>

				{/* Bottom handle */}
				<div
					className={cn(
						"absolute h-[3px] cursor-ns-resize z-20 pointer-events-auto bg-cc-accent",
						activeDrag === "bottom" && "bg-white",
					)}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "bottom")}
				/>

				{/* Left handle */}
				<div
					className={cn(
						"absolute w-[3px] cursor-ew-resize z-20 pointer-events-auto bg-cc-accent",
						activeDrag === "left" && "bg-white",
					)}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "left")}
				/>

				{/* Right handle */}
				<div
					className={cn(
						"absolute w-[3px] cursor-ew-resize z-20 pointer-events-auto bg-cc-accent",
						activeDrag === "right" && "bg-white",
					)}
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "right")}
				/>
			</div>

			{!isDefault && onReset && (
				<div className="flex justify-center mt-4">
					<button
						type="button"
						onClick={onReset}
						className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
					>
						Reset crop
					</button>
				</div>
			)}
		</div>
	);
}
