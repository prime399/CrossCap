import { CaretDown, ClockCounterClockwise, CornersOut } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { type CropRegion, DEFAULT_CROP_REGION } from "./types";

const MIN_CROP_SIZE = 0.05;
const KEYBOARD_NUDGE = 0.005;
const KEYBOARD_NUDGE_FAST = 0.02;
const RATIO_OPTIONS = [
	"Free",
	"1:1",
	"2:1",
	"3:2",
	"4:3",
	"9:16",
	"16:9",
	"16:10",
	"21:9",
] as const;

interface CropControlProps {
	videoElement: HTMLVideoElement | null;
	cropRegion: CropRegion;
	onCropChange: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	onReset?: () => void;
}

type DragHandle =
	| "move"
	| "top"
	| "right"
	| "bottom"
	| "left"
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right";

interface RectBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function isDefaultRegion(region: CropRegion) {
	return (
		region.x === DEFAULT_CROP_REGION.x &&
		region.y === DEFAULT_CROP_REGION.y &&
		region.width === DEFAULT_CROP_REGION.width &&
		region.height === DEFAULT_CROP_REGION.height
	);
}

function formatPercent(value: number) {
	return `${Math.round(value * 1000) / 10}%`;
}

function parseRatioLabel(label: (typeof RATIO_OPTIONS)[number]): number | null {
	if (label === "Free") return null;
	const [w, h] = label.split(":").map((v) => Number.parseFloat(v));
	if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
	return w / h;
}

function createCenteredCropForAspect(
	videoAspectRatio: number,
	targetAspectRatio: number,
): CropRegion {
	if (videoAspectRatio <= 0 || targetAspectRatio <= 0) return DEFAULT_CROP_REGION;

	if (videoAspectRatio > targetAspectRatio) {
		const width = targetAspectRatio / videoAspectRatio;
		return { x: (1 - width) / 2, y: 0, width, height: 1 };
	}

	const height = videoAspectRatio / targetAspectRatio;
	return { x: 0, y: (1 - height) / 2, width: 1, height };
}

function fitRectToViewport(rect: RectBounds): RectBounds {
	let { left, right, top, bottom } = rect;

	left = clamp(left, 0, 1 - MIN_CROP_SIZE);
	right = clamp(right, MIN_CROP_SIZE, 1);
	top = clamp(top, 0, 1 - MIN_CROP_SIZE);
	bottom = clamp(bottom, MIN_CROP_SIZE, 1);

	if (right - left < MIN_CROP_SIZE) {
		right = clamp(left + MIN_CROP_SIZE, MIN_CROP_SIZE, 1);
		left = clamp(right - MIN_CROP_SIZE, 0, 1 - MIN_CROP_SIZE);
	}

	if (bottom - top < MIN_CROP_SIZE) {
		bottom = clamp(top + MIN_CROP_SIZE, MIN_CROP_SIZE, 1);
		top = clamp(bottom - MIN_CROP_SIZE, 0, 1 - MIN_CROP_SIZE);
	}

	return { left, right, top, bottom };
}

function applyRatioConstraint(handle: DragHandle, rect: RectBounds, ratio: number): RectBounds {
	let { left, right, top, bottom } = rect;

	const widthRaw = right - left;
	const heightRaw = bottom - top;
	const centerX = (left + right) / 2;
	const centerY = (top + bottom) / 2;

	if (handle === "top-left") {
		const anchorX = right;
		const anchorY = bottom;
		let width = anchorX - left;
		let height = anchorY - top;
		if (width / height > ratio) width = height * ratio;
		else height = width / ratio;
		left = anchorX - width;
		top = anchorY - height;
	} else if (handle === "top-right") {
		const anchorX = left;
		const anchorY = bottom;
		let width = right - anchorX;
		let height = anchorY - top;
		if (width / height > ratio) width = height * ratio;
		else height = width / ratio;
		right = anchorX + width;
		top = anchorY - height;
	} else if (handle === "bottom-left") {
		const anchorX = right;
		const anchorY = top;
		let width = anchorX - left;
		let height = bottom - anchorY;
		if (width / height > ratio) width = height * ratio;
		else height = width / ratio;
		left = anchorX - width;
		bottom = anchorY + height;
	} else if (handle === "bottom-right") {
		const anchorX = left;
		const anchorY = top;
		let width = right - anchorX;
		let height = bottom - anchorY;
		if (width / height > ratio) width = height * ratio;
		else height = width / ratio;
		right = anchorX + width;
		bottom = anchorY + height;
	} else if (handle === "left" || handle === "right") {
		const width = Math.max(widthRaw, MIN_CROP_SIZE);
		const height = width / ratio;
		top = centerY - height / 2;
		bottom = centerY + height / 2;
	} else if (handle === "top" || handle === "bottom") {
		const height = Math.max(heightRaw, MIN_CROP_SIZE);
		const width = height * ratio;
		left = centerX - width / 2;
		right = centerX + width / 2;
	}

	return fitRectToViewport({ left, right, top, bottom });
}

export function CropControl({
	videoElement,
	cropRegion,
	onCropChange,
	aspectRatio,
	onReset,
}: CropControlProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		handle: DragHandle;
		startX: number;
		startY: number;
		initialCrop: CropRegion;
	} | null>(null);
	const [activeDrag, setActiveDrag] = useState<DragHandle | null>(null);
	const [isFocused, setIsFocused] = useState(false);
	const [ratioMode, setRatioMode] = useState<(typeof RATIO_OPTIONS)[number]>("Free");
	const [snapToRatio, setSnapToRatio] = useState(true);

	const videoAspectRatio = useMemo(() => {
		if (videoElement?.videoWidth && videoElement.videoHeight) {
			return videoElement.videoWidth / videoElement.videoHeight;
		}
		return 16 / 9;
	}, [videoElement?.videoWidth, videoElement?.videoHeight]);

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
			const initial = drag.initialCrop;
			let left = initial.x;
			let right = initial.x + initial.width;
			let top = initial.y;
			let bottom = initial.y + initial.height;

			switch (drag.handle) {
				case "move":
					left = clamp(initial.x + deltaX, 0, 1 - initial.width);
					top = clamp(initial.y + deltaY, 0, 1 - initial.height);
					right = left + initial.width;
					bottom = top + initial.height;
					break;
				case "top":
					top = initial.y + deltaY;
					break;
				case "bottom":
					bottom = initial.y + initial.height + deltaY;
					break;
				case "left":
					left = initial.x + deltaX;
					break;
				case "right":
					right = initial.x + initial.width + deltaX;
					break;
				case "top-left":
					top = initial.y + deltaY;
					left = initial.x + deltaX;
					break;
				case "top-right":
					top = initial.y + deltaY;
					right = initial.x + initial.width + deltaX;
					break;
				case "bottom-left":
					bottom = initial.y + initial.height + deltaY;
					left = initial.x + deltaX;
					break;
				case "bottom-right":
					bottom = initial.y + initial.height + deltaY;
					right = initial.x + initial.width + deltaX;
					break;
			}

			let next = fitRectToViewport({ left, right, top, bottom });
			const snapRatio = snapToRatio ? parseRatioLabel(ratioMode) : null;
			if (snapRatio && drag.handle !== "move") {
				next = applyRatioConstraint(drag.handle, next, snapRatio);
			}

			onCropChange({
				x: next.left,
				y: next.top,
				width: next.right - next.left,
				height: next.bottom - next.top,
			});
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
	}, [activeDrag, onCropChange, ratioMode, snapToRatio]);

	const handleKeyboardAdjust = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			const isArrowKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
			if (!isArrowKey) return;

			event.preventDefault();
			const step = event.shiftKey ? KEYBOARD_NUDGE_FAST : KEYBOARD_NUDGE;

			if (event.altKey) {
				let width = cropRegion.width;
				let height = cropRegion.height;

				if (event.key === "ArrowLeft") width = clamp(width - step, MIN_CROP_SIZE, 1 - cropRegion.x);
				if (event.key === "ArrowRight")
					width = clamp(width + step, MIN_CROP_SIZE, 1 - cropRegion.x);
				if (event.key === "ArrowUp") height = clamp(height - step, MIN_CROP_SIZE, 1 - cropRegion.y);
				if (event.key === "ArrowDown")
					height = clamp(height + step, MIN_CROP_SIZE, 1 - cropRegion.y);

				onCropChange({ ...cropRegion, width, height });
				return;
			}

			let x = cropRegion.x;
			let y = cropRegion.y;
			if (event.key === "ArrowLeft") x -= step;
			if (event.key === "ArrowRight") x += step;
			if (event.key === "ArrowUp") y -= step;
			if (event.key === "ArrowDown") y += step;

			onCropChange({
				...cropRegion,
				x: clamp(x, 0, 1 - cropRegion.width),
				y: clamp(y, 0, 1 - cropRegion.height),
			});
		},
		[cropRegion, onCropChange],
	);

	const applyAspectPreset = useCallback(
		(targetAspect: number) => {
			onCropChange(createCenteredCropForAspect(videoAspectRatio, targetAspect));
		},
		[videoAspectRatio, onCropChange],
	);

	const applyPixelRect = useCallback(
		(pxX: number, pxY: number, pxW: number, pxH: number) => {
			const widthPx = videoElement?.videoWidth ?? 1920;
			const heightPx = videoElement?.videoHeight ?? 1080;

			const x = clamp(pxX / widthPx, 0, 1 - MIN_CROP_SIZE);
			const y = clamp(pxY / heightPx, 0, 1 - MIN_CROP_SIZE);
			const width = clamp(pxW / widthPx, MIN_CROP_SIZE, 1 - x);
			const height = clamp(pxH / heightPx, MIN_CROP_SIZE, 1 - y);
			onCropChange({ x, y, width, height });
		},
		[videoElement?.videoHeight, videoElement?.videoWidth, onCropChange],
	);

	useEffect(() => {
		const ratio = parseRatioLabel(ratioMode);
		if (ratio && snapToRatio) {
			applyAspectPreset(ratio);
		}
	}, [ratioMode, snapToRatio, applyAspectPreset]);

	const isDefault = isDefaultRegion(cropRegion);
	const cropPixelX = cropRegion.x * 100;
	const cropPixelY = cropRegion.y * 100;
	const cropPixelWidth = cropRegion.width * 100;
	const cropPixelHeight = cropRegion.height * 100;
	const sourceWidthPx = videoElement?.videoWidth ?? 1920;
	const sourceHeightPx = videoElement?.videoHeight ?? 1080;
	const croppedWidthPx = Math.round(sourceWidthPx * cropRegion.width);
	const croppedHeightPx = Math.round(sourceHeightPx * cropRegion.height);
	const cropXPx = Math.round(sourceWidthPx * cropRegion.x);
	const cropYPx = Math.round(sourceHeightPx * cropRegion.y);

	return (
		<div className="w-full max-w-[980px] mx-auto space-y-3">
			<div className="rounded-2xl border border-white/10 bg-[#0f1116] p-2.5 text-xs shadow-xl">
				<div className="flex items-center justify-between gap-2 flex-wrap">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-slate-400">Size</span>
						<input
							type="number"
							value={croppedWidthPx}
							onChange={(e) =>
								applyPixelRect(
									cropXPx,
									cropYPx,
									Number.parseInt(e.target.value || "0", 10),
									croppedHeightPx,
								)
							}
							className="w-[70px] h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-slate-100"
						/>
						<span className="text-slate-500">×</span>
						<input
							type="number"
							value={croppedHeightPx}
							onChange={(e) =>
								applyPixelRect(
									cropXPx,
									cropYPx,
									croppedWidthPx,
									Number.parseInt(e.target.value || "0", 10),
								)
							}
							className="w-[70px] h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-slate-100"
						/>
						<span className="ml-2 text-slate-400">Position</span>
						<input
							type="number"
							value={cropXPx}
							onChange={(e) =>
								applyPixelRect(
									Number.parseInt(e.target.value || "0", 10),
									cropYPx,
									croppedWidthPx,
									croppedHeightPx,
								)
							}
							className="w-[70px] h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-slate-100"
						/>
						<span className="text-slate-500">×</span>
						<input
							type="number"
							value={cropYPx}
							onChange={(e) =>
								applyPixelRect(
									cropXPx,
									Number.parseInt(e.target.value || "0", 10),
									croppedWidthPx,
									croppedHeightPx,
								)
							}
							className="w-[70px] h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-slate-100"
						/>
					</div>

					<div className="flex items-center gap-1.5">
						<div className="relative">
							<select
								value={ratioMode}
								onChange={(e) => setRatioMode(e.target.value as (typeof RATIO_OPTIONS)[number])}
								className="h-8 pr-7 pl-2.5 rounded-md border border-white/10 bg-white/[0.04] text-slate-200 appearance-none"
							>
								{RATIO_OPTIONS.map((ratio) => (
									<option key={ratio} value={ratio}>
										{ratio}
									</option>
								))}
							</select>
							<CaretDown
								size={12}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
							/>
						</div>
						<label className="flex items-center gap-1.5 px-2 h-8 rounded-md border border-white/10 bg-white/[0.04] text-slate-300">
							<input
								type="checkbox"
								checked={snapToRatio}
								onChange={(e) => setSnapToRatio(e.target.checked)}
								className="accent-cc-accent"
							/>
							Snap to ratios
						</label>
						<button
							type="button"
							onClick={() => applyAspectPreset(getAspectRatioValue(aspectRatio))}
							className="h-8 px-2 rounded-md border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] inline-flex items-center gap-1"
						>
							<CornersOut size={14} />
							Full
						</button>
						{onReset && (
							<button
								type="button"
								onClick={onReset}
								className="h-8 px-2 rounded-md border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] inline-flex items-center gap-1"
							>
								<ClockCounterClockwise size={14} />
								Reset
							</button>
						)}
					</div>
				</div>
			</div>

			<div
				ref={containerRef}
				tabIndex={0}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				onKeyDown={handleKeyboardAdjust}
				className={cn(
					"relative w-full bg-black rounded-lg overflow-visible select-none shadow-2xl outline-none mx-auto",
					isFocused && "ring-2 ring-cc-accent/50",
				)}
				style={{
					aspectRatio: videoAspectRatio,
					maxWidth: "920px",
					maxHeight: "60vh",
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
							fillOpacity="0.58"
							mask="url(#cropMask)"
						/>
					</svg>
				</div>

				<div
					className="absolute z-10 border-2 border-[#f1f5f9] bg-transparent pointer-events-auto cursor-move"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						height: `${cropPixelHeight}%`,
					}}
					onPointerDown={(e) => handlePointerDown(e, "move")}
				>
					<div className="absolute top-0 bottom-0 left-1/3 border-l border-white/25 pointer-events-none" />
					<div className="absolute top-0 bottom-0 left-2/3 border-l border-white/25 pointer-events-none" />
					<div className="absolute left-0 right-0 top-1/3 border-t border-white/25 pointer-events-none" />
					<div className="absolute left-0 right-0 top-2/3 border-t border-white/25 pointer-events-none" />
				</div>

				<div
					className="absolute h-2 cursor-ns-resize z-20 pointer-events-auto"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "top")}
				/>
				<div
					className="absolute h-2 cursor-ns-resize z-20 pointer-events-auto"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "bottom")}
				/>
				<div
					className="absolute w-2 cursor-ew-resize z-20 pointer-events-auto"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "left")}
				/>
				<div
					className="absolute w-2 cursor-ew-resize z-20 pointer-events-auto"
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "right")}
				/>

				{[
					{ handle: "top-left" as const, left: cropPixelX, top: cropPixelY, cursor: "nwse-resize" },
					{
						handle: "top-right" as const,
						left: cropPixelX + cropPixelWidth,
						top: cropPixelY,
						cursor: "nesw-resize",
					},
					{
						handle: "bottom-left" as const,
						left: cropPixelX,
						top: cropPixelY + cropPixelHeight,
						cursor: "nesw-resize",
					},
					{
						handle: "bottom-right" as const,
						left: cropPixelX + cropPixelWidth,
						top: cropPixelY + cropPixelHeight,
						cursor: "nwse-resize",
					},
				].map((corner) => (
					<div
						key={corner.handle}
						className="absolute w-3.5 h-3.5 rounded-[2px] border border-black/40 bg-white z-30 pointer-events-auto"
						style={{
							left: `${corner.left}%`,
							top: `${corner.top}%`,
							transform: "translate(-50%, -50%)",
							cursor: corner.cursor,
						}}
						onPointerDown={(e) => handlePointerDown(e, corner.handle)}
					/>
				))}
			</div>

			<div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-slate-300">
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
					<div>
						<span className="text-slate-500">X</span> {formatPercent(cropRegion.x)}
					</div>
					<div>
						<span className="text-slate-500">Y</span> {formatPercent(cropRegion.y)}
					</div>
					<div>
						<span className="text-slate-500">Width</span> {formatPercent(cropRegion.width)}
					</div>
					<div>
						<span className="text-slate-500">Height</span> {formatPercent(cropRegion.height)}
					</div>
				</div>
				<div className="mt-2 text-slate-400">
					Cropped resolution: {croppedWidthPx} × {croppedHeightPx}
				</div>
				<div className="mt-2 text-slate-500">
					Arrow keys move crop, <kbd className="px-1 rounded bg-white/10">Shift</kbd> for faster
					move,
					<kbd className="px-1 rounded bg-white/10">Alt</kbd> + arrows to resize.
				</div>
				{!isDefault && onReset && (
					<div className="mt-2">
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
		</div>
	);
}
