import type { CursorTelemetryPoint, TrimRegion, ZoomFocus, ZoomRegion } from "../types";

export const MIN_DWELL_DURATION_MS = 450;
export const MAX_DWELL_DURATION_MS = 2600;
export const DWELL_MOVE_THRESHOLD = 0.02;
export const SUGGESTION_SPACING_MS = 1800;
export const MIN_REGION_DURATION_MS = 1000;
export const MAX_REGION_DURATION_MS = 2400;

export type AutoZoomSuggestion =
	| { type: "no_cursor_telemetry" }
	| { type: "no_usable_cursor_telemetry" }
	| { type: "no_dwell_candidates" }
	| { type: "no_slots_available" }
	| {
			type: "ok";
			suggestions: Array<{ start: number; end: number; focus: ZoomFocus }>;
	  };

export function calculateDefaultRegionDurationMs(totalMs: number): number {
	return Math.max(
		MIN_REGION_DURATION_MS,
		Math.min(MAX_REGION_DURATION_MS, Math.round(Math.max(0, totalMs) * 0.05)),
	);
}

export function generateAutoZoomSuggestions(params: {
	totalMs: number;
	defaultDurationMs: number;
	cursorTelemetry: CursorTelemetryPoint[];
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
}): AutoZoomSuggestion {
	const { totalMs, defaultDurationMs, cursorTelemetry, zoomRegions, trimRegions } = params;

	if (cursorTelemetry.length < 2) {
		return { type: "no_cursor_telemetry" };
	}

	const reservedSpans = [...zoomRegions, ...trimRegions]
		.map((region) => ({ start: region.startMs, end: region.endMs }))
		.sort((a, b) => a.start - b.start);

	const normalizedSamples = [...cursorTelemetry]
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) && Number.isFinite(sample.cx) && Number.isFinite(sample.cy),
		)
		.sort((a, b) => a.timeMs - b.timeMs)
		.map((sample) => ({
			timeMs: Math.max(0, Math.min(sample.timeMs, totalMs)),
			cx: Math.max(0, Math.min(sample.cx, 1)),
			cy: Math.max(0, Math.min(sample.cy, 1)),
		}));

	if (normalizedSamples.length < 2) {
		return { type: "no_usable_cursor_telemetry" };
	}

	const dwellCandidates: Array<{ centerTimeMs: number; focus: ZoomFocus; strength: number }> = [];
	let runStart = 0;

	const pushRunIfDwell = (startIndex: number, endIndexExclusive: number) => {
		if (endIndexExclusive - startIndex < 2) return;

		const start = normalizedSamples[startIndex];
		const end = normalizedSamples[endIndexExclusive - 1];
		const runDuration = end.timeMs - start.timeMs;
		if (runDuration < MIN_DWELL_DURATION_MS || runDuration > MAX_DWELL_DURATION_MS) {
			return;
		}

		const runSamples = normalizedSamples.slice(startIndex, endIndexExclusive);
		const avgCx = runSamples.reduce((sum, sample) => sum + sample.cx, 0) / runSamples.length;
		const avgCy = runSamples.reduce((sum, sample) => sum + sample.cy, 0) / runSamples.length;

		dwellCandidates.push({
			centerTimeMs: Math.round((start.timeMs + end.timeMs) / 2),
			focus: { cx: avgCx, cy: avgCy },
			strength: runDuration,
		});
	};

	for (let index = 1; index < normalizedSamples.length; index += 1) {
		const prev = normalizedSamples[index - 1];
		const curr = normalizedSamples[index];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);
		if (distance > DWELL_MOVE_THRESHOLD) {
			pushRunIfDwell(runStart, index);
			runStart = index;
		}
	}
	pushRunIfDwell(runStart, normalizedSamples.length);

	if (dwellCandidates.length === 0) {
		return { type: "no_dwell_candidates" };
	}

	const sortedCandidates = [...dwellCandidates].sort((a, b) => b.strength - a.strength);
	const acceptedCenters: number[] = [];
	const suggestions: Array<{ start: number; end: number; focus: ZoomFocus }> = [];

	sortedCandidates.forEach((candidate) => {
		const tooCloseToAccepted = acceptedCenters.some(
			(center) => Math.abs(center - candidate.centerTimeMs) < SUGGESTION_SPACING_MS,
		);
		if (tooCloseToAccepted) return;

		const centeredStart = Math.round(candidate.centerTimeMs - defaultDurationMs / 2);
		const candidateStart = Math.max(0, Math.min(centeredStart, totalMs - defaultDurationMs));
		const candidateEnd = candidateStart + defaultDurationMs;
		const hasOverlap = reservedSpans.some(
			(span) => candidateEnd > span.start && candidateStart < span.end,
		);
		if (hasOverlap) return;

		reservedSpans.push({ start: candidateStart, end: candidateEnd });
		acceptedCenters.push(candidate.centerTimeMs);
		suggestions.push({ start: candidateStart, end: candidateEnd, focus: candidate.focus });
	});

	if (suggestions.length === 0) {
		return { type: "no_slots_available" };
	}

	return { type: "ok", suggestions };
}
