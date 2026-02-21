import { describe, expect, it } from "vitest";
import {
	calculateDefaultRegionDurationMs,
	generateAutoZoomSuggestions,
} from "./autoZoomSuggestions";

function makeDwell(startMs: number, endMs: number, cx: number, cy: number) {
	const samples = [];
	for (let time = startMs; time <= endMs; time += 100) {
		samples.push({ timeMs: time, cx, cy });
	}
	return samples;
}

describe("auto zoom suggestions", () => {
	it("clamps default region duration to sane bounds", () => {
		expect(calculateDefaultRegionDurationMs(5_000)).toBe(1_000);
		expect(calculateDefaultRegionDurationMs(40_000)).toBe(2_000);
		expect(calculateDefaultRegionDurationMs(120_000)).toBe(2_400);
	});

	it("does not place suggestions inside trim regions", () => {
		const cursorTelemetry = [
			...makeDwell(4_000, 5_000, 0.2, 0.2),
			...makeDwell(8_000, 9_000, 0.7, 0.6),
		];
		const result = generateAutoZoomSuggestions({
			totalMs: 12_000,
			defaultDurationMs: 1_000,
			cursorTelemetry,
			zoomRegions: [],
			trimRegions: [{ id: "trim-1", startMs: 3_500, endMs: 5_500 }],
		});

		expect(result.type).toBe("ok");
		if (result.type !== "ok") return;
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0].start).toBeGreaterThanOrEqual(7_500);
		expect(result.suggestions[0].end).toBeLessThanOrEqual(9_500);
	});

	it("returns no slots when all dwell candidates overlap zoom/trim spans", () => {
		const cursorTelemetry = makeDwell(4_000, 5_200, 0.3, 0.4);
		const result = generateAutoZoomSuggestions({
			totalMs: 10_000,
			defaultDurationMs: 1_000,
			cursorTelemetry,
			zoomRegions: [
				{ id: "zoom-1", startMs: 4_000, endMs: 5_500, depth: 3, focus: { cx: 0.5, cy: 0.5 } },
			],
			trimRegions: [],
		});

		expect(result.type).toBe("no_slots_available");
	});
});
