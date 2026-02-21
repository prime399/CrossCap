import * as v from "valibot";
import type {
	AnnotationRegion,
	CropRegion,
	TrimRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import {
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_CROP_REGION,
	DEFAULT_FIGURE_DATA,
	DEFAULT_ZOOM_DEPTH,
} from "@/components/video-editor/types";
import { WALLPAPER_PATHS } from "@/constants/wallpapers";
import type { ExportFormat, ExportQuality, GifFrameRate, GifSizePreset } from "@/lib/exporter";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

const finiteNumber = (fallback: number) =>
	v.pipe(
		v.unknown(),
		v.transform((val) => (typeof val === "number" && Number.isFinite(val) ? val : fallback)),
	);

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

const ZoomFocusSchema = v.pipe(
	v.object({
		cx: finiteNumber(0.5),
		cy: finiteNumber(0.5),
	}),
	v.transform((f) => ({ cx: clamp(f.cx, 0, 1), cy: clamp(f.cy, 0, 1) })),
);

const TimespanSchema = v.pipe(
	v.object({
		startMs: finiteNumber(0),
		endMs: finiteNumber(1000),
	}),
	v.transform((t) => {
		const rawStart = Math.round(t.startMs);
		const rawEnd = Math.round(t.endMs);
		const startMs = Math.max(0, Math.min(rawStart, rawEnd));
		const endMs = Math.max(startMs + 1, rawEnd);
		return { startMs, endMs };
	}),
);

const ZoomRegionSchema = v.pipe(
	v.object({
		id: v.string(),
		startMs: finiteNumber(0),
		endMs: finiteNumber(1000),
		depth: v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && [1, 2, 3, 4, 5, 6].includes(val) ? val : DEFAULT_ZOOM_DEPTH,
			),
		),
		focus: v.optional(ZoomFocusSchema),
	}),
	v.transform((r) => {
		const span = v.parse(TimespanSchema, { startMs: r.startMs, endMs: r.endMs });
		return {
			id: r.id,
			...span,
			depth: r.depth as 1 | 2 | 3 | 4 | 5 | 6,
			focus: r.focus ?? { cx: 0.5, cy: 0.5 },
		};
	}),
);

const TrimRegionSchema = v.pipe(
	v.object({
		id: v.string(),
		startMs: finiteNumber(0),
		endMs: finiteNumber(1000),
	}),
	v.transform((r) => {
		const span = v.parse(TimespanSchema, { startMs: r.startMs, endMs: r.endMs });
		return { id: r.id, ...span };
	}),
);

const AnnotationRegionSchema = v.pipe(
	v.object({
		id: v.string(),
		startMs: finiteNumber(0),
		endMs: finiteNumber(1000),
		type: v.pipe(
			v.unknown(),
			v.transform((val) => (val === "image" || val === "figure" ? val : ("text" as const))),
		),
		content: v.optional(
			v.pipe(
				v.unknown(),
				v.transform((val) => (typeof val === "string" ? val : "")),
			),
		),
		textContent: v.optional(
			v.pipe(
				v.unknown(),
				v.transform((val) => (typeof val === "string" ? val : undefined)),
			),
		),
		imageContent: v.optional(
			v.pipe(
				v.unknown(),
				v.transform((val) => (typeof val === "string" ? val : undefined)),
			),
		),
		position: v.optional(
			v.object({
				x: finiteNumber(DEFAULT_ANNOTATION_POSITION.x),
				y: finiteNumber(DEFAULT_ANNOTATION_POSITION.y),
			}),
		),
		size: v.optional(
			v.object({
				width: finiteNumber(DEFAULT_ANNOTATION_SIZE.width),
				height: finiteNumber(DEFAULT_ANNOTATION_SIZE.height),
			}),
		),
		style: v.optional(
			v.pipe(
				v.unknown(),
				v.transform((val) => (val && typeof val === "object" ? val : {})),
			),
		),
		zIndex: v.optional(finiteNumber(0)),
		figureData: v.optional(
			v.pipe(
				v.unknown(),
				v.transform((val) =>
					val && typeof val === "object" ? { ...DEFAULT_FIGURE_DATA, ...val } : undefined,
				),
			),
		),
	}),
	v.transform((r) => {
		const span = v.parse(TimespanSchema, { startMs: r.startMs, endMs: r.endMs });
		return {
			id: r.id,
			...span,
			type: r.type as "text" | "image" | "figure",
			content: r.content ?? "",
			textContent: r.textContent,
			imageContent: r.imageContent,
			position: {
				x: clamp(r.position?.x ?? DEFAULT_ANNOTATION_POSITION.x, 0, 100),
				y: clamp(r.position?.y ?? DEFAULT_ANNOTATION_POSITION.y, 0, 100),
			},
			size: {
				width: clamp(r.size?.width ?? DEFAULT_ANNOTATION_SIZE.width, 1, 200),
				height: clamp(r.size?.height ?? DEFAULT_ANNOTATION_SIZE.height, 1, 200),
			},
			style: { ...DEFAULT_ANNOTATION_STYLE, ...(r.style as object) },
			zIndex: r.zIndex ?? 1,
			figureData: r.figureData as typeof DEFAULT_FIGURE_DATA | undefined,
		};
	}),
);

const CropRegionSchema = v.pipe(
	v.object({
		x: finiteNumber(DEFAULT_CROP_REGION.x),
		y: finiteNumber(DEFAULT_CROP_REGION.y),
		width: finiteNumber(DEFAULT_CROP_REGION.width),
		height: finiteNumber(DEFAULT_CROP_REGION.height),
	}),
	v.transform((c) => {
		const x = clamp(c.x, 0, 1);
		const y = clamp(c.y, 0, 1);
		return {
			x,
			y,
			width: clamp(c.width, 0.01, 1 - x),
			height: clamp(c.height, 0.01, 1 - y),
		};
	}),
);

const VALID_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "4:5", "16:10", "10:16"] as const;
const VALID_QUALITIES = ["medium", "good", "source"] as const;
const VALID_FORMATS = ["mp4", "gif"] as const;
const VALID_GIF_FRAME_RATES = [15, 20, 25, 30] as const;
const VALID_GIF_SIZE_PRESETS = ["medium", "large", "original"] as const;

const EditorSchema = v.object({
	wallpaper: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "string" ? val : WALLPAPER_PATHS[0])),
		),
		WALLPAPER_PATHS[0],
	),
	shadowIntensity: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "number" ? val : 0)),
		),
		0,
	),
	shadowSize: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 1) : 0.4,
			),
		),
		0.4,
	),
	shadowOpacity: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 1) : 0.6,
			),
		),
		0.6,
	),
	shadowBlur: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 1) : 0.45,
			),
		),
		0.45,
	),
	showBlur: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "boolean" ? val : false)),
		),
		false,
	),
	motionBlurEnabled: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "boolean" ? val : false)),
		),
		false,
	),
	borderRadius: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "number" ? val : 0)),
		),
		0,
	),
	cornerStyle: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				val === "rounded" || val === "squircle" || val === "sharp" ? val : "squircle",
			),
		),
		"squircle",
	),
	borderEnabled: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "boolean" ? val : false)),
		),
		false,
	),
	borderWidth: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 24) : 2,
			),
		),
		2,
	),
	borderColor: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "string" ? val : "#000000")),
		),
		"#000000",
	),
	borderOpacity: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 1) : 0.85,
			),
		),
		0.85,
	),
	padding: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && Number.isFinite(val) ? clamp(val, 0, 100) : 50,
			),
		),
		50,
	),
	cropRegion: v.optional(CropRegionSchema),
	zoomRegions: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (Array.isArray(val) ? val : [])),
		),
	),
	trimRegions: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (Array.isArray(val) ? val : [])),
		),
	),
	annotationRegions: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (Array.isArray(val) ? val : [])),
		),
	),
	aspectRatio: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "string" && (VALID_ASPECT_RATIOS as readonly string[]).includes(val)
					? (val as (typeof VALID_ASPECT_RATIOS)[number])
					: "16:9",
			),
		),
		"16:9",
	),
	exportQuality: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "string" && (VALID_QUALITIES as readonly string[]).includes(val)
					? (val as (typeof VALID_QUALITIES)[number])
					: "good",
			),
		),
		"good",
	),
	exportFormat: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "string" && (VALID_FORMATS as readonly string[]).includes(val)
					? (val as (typeof VALID_FORMATS)[number])
					: "mp4",
			),
		),
		"mp4",
	),
	gifFrameRate: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "number" && (VALID_GIF_FRAME_RATES as readonly number[]).includes(val)
					? (val as (typeof VALID_GIF_FRAME_RATES)[number])
					: 15,
			),
		),
		15,
	),
	gifLoop: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) => (typeof val === "boolean" ? val : true)),
		),
		true,
	),
	gifSizePreset: v.optional(
		v.pipe(
			v.unknown(),
			v.transform((val) =>
				typeof val === "string" && (VALID_GIF_SIZE_PRESETS as readonly string[]).includes(val)
					? (val as (typeof VALID_GIF_SIZE_PRESETS)[number])
					: "medium",
			),
		),
		"medium",
	),
});

export const ProjectDataSchema = v.object({
	version: v.number(),
	videoPath: v.pipe(v.string(), v.minLength(1)),
	editor: EditorSchema,
});

export type ProjectData = v.InferOutput<typeof ProjectDataSchema>;

function filterWithId(items: unknown[]): unknown[] {
	return items.filter((item) =>
		Boolean(
			item &&
				typeof item === "object" &&
				"id" in item &&
				typeof (item as { id: unknown }).id === "string",
		),
	);
}

export interface ParsedEditor {
	wallpaper: string;
	shadowIntensity: number;
	shadowSize: number;
	shadowOpacity: number;
	shadowBlur: number;
	showBlur: boolean;
	motionBlurEnabled: boolean;
	borderRadius: number;
	cornerStyle: "rounded" | "squircle" | "sharp";
	borderEnabled: boolean;
	borderWidth: number;
	borderColor: string;
	borderOpacity: number;
	padding: number;
	cropRegion: CropRegion;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	annotationRegions: AnnotationRegion[];
	aspectRatio: AspectRatio;
	exportQuality: ExportQuality;
	exportFormat: ExportFormat;
	gifFrameRate: GifFrameRate;
	gifLoop: boolean;
	gifSizePreset: GifSizePreset;
}

export function parseProjectEditor(raw: unknown): ParsedEditor {
	const parsed = v.parse(EditorSchema, raw ?? {});

	const zoomRegions = filterWithId(parsed.zoomRegions as unknown[]).map(
		(r) => v.parse(ZoomRegionSchema, r) as unknown as ZoomRegion,
	);
	const trimRegions = filterWithId(parsed.trimRegions as unknown[]).map(
		(r) => v.parse(TrimRegionSchema, r) as unknown as TrimRegion,
	);
	const annotationRegions = filterWithId(parsed.annotationRegions as unknown[]).map((r, index) => {
		const region = v.parse(AnnotationRegionSchema, r) as unknown as AnnotationRegion;
		if (region.zIndex === 1 && r && typeof r === "object" && !("zIndex" in r)) {
			return { ...region, zIndex: index + 1 };
		}
		return region;
	});

	return {
		wallpaper: parsed.wallpaper,
		shadowIntensity: parsed.shadowIntensity,
		shadowSize: parsed.shadowSize,
		shadowOpacity: parsed.shadowOpacity,
		shadowBlur: parsed.shadowBlur,
		showBlur: parsed.showBlur,
		motionBlurEnabled: parsed.motionBlurEnabled,
		borderRadius: parsed.borderRadius,
		cornerStyle: parsed.cornerStyle,
		borderEnabled: parsed.borderEnabled,
		borderWidth: parsed.borderWidth,
		borderColor: parsed.borderColor,
		borderOpacity: parsed.borderOpacity,
		padding: parsed.padding,
		cropRegion: parsed.cropRegion ?? DEFAULT_CROP_REGION,
		zoomRegions,
		trimRegions,
		annotationRegions,
		aspectRatio: parsed.aspectRatio,
		exportQuality: parsed.exportQuality,
		exportFormat: parsed.exportFormat,
		gifFrameRate: parsed.gifFrameRate,
		gifLoop: parsed.gifLoop,
		gifSizePreset: parsed.gifSizePreset,
	};
}

export function validateProjectData(candidate: unknown): candidate is ProjectData {
	const result = v.safeParse(ProjectDataSchema, candidate);
	return result.success;
}
