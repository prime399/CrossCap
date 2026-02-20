import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { calculateExportDimensions } from "./types";

const ASPECT_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "4:5", "16:10", "10:16"];
const QUALITIES = ["medium", "good", "source"] as const;

describe("calculateExportDimensions", () => {
	it("should always produce even width and height", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 640, max: 3840 }),
				fc.integer({ min: 480, max: 2160 }),
				fc.constantFrom(...QUALITIES),
				fc.constantFrom(...ASPECT_RATIOS),
				(sourceWidth, sourceHeight, quality, aspectRatio) => {
					const { width, height } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						quality,
						aspectRatio,
					);
					expect(width % 2).toBe(0);
					expect(height % 2).toBe(0);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("should always produce positive dimensions", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 100, max: 4000 }),
				fc.integer({ min: 100, max: 4000 }),
				fc.constantFrom(...QUALITIES),
				fc.constantFrom(...ASPECT_RATIOS),
				(sourceWidth, sourceHeight, quality, aspectRatio) => {
					const { width, height } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						quality,
						aspectRatio,
					);
					expect(width).toBeGreaterThan(0);
					expect(height).toBeGreaterThan(0);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("should produce positive bitrate", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 100, max: 4000 }),
				fc.integer({ min: 100, max: 4000 }),
				fc.constantFrom(...QUALITIES),
				fc.constantFrom(...ASPECT_RATIOS),
				(sourceWidth, sourceHeight, quality, aspectRatio) => {
					const { bitrate } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						quality,
						aspectRatio,
					);
					expect(bitrate).toBeGreaterThan(0);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("medium quality should cap height at 720", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 640, max: 3840 }),
				fc.integer({ min: 480, max: 2160 }),
				fc.constantFrom(...ASPECT_RATIOS),
				(sourceWidth, sourceHeight, aspectRatio) => {
					const { height } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						"medium",
						aspectRatio,
					);
					expect(height).toBe(720);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("good quality should cap height at 1080", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 640, max: 3840 }),
				fc.integer({ min: 480, max: 2160 }),
				fc.constantFrom(...ASPECT_RATIOS),
				(sourceWidth, sourceHeight, aspectRatio) => {
					const { height } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						"good",
						aspectRatio,
					);
					expect(height).toBe(1080);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("source quality bitrate should scale with resolution", () => {
		// 4K source should get higher bitrate than 720p source
		const dims4k = calculateExportDimensions(3840, 2160, "source", "16:9");
		const dims720 = calculateExportDimensions(1280, 720, "source", "16:9");
		expect(dims4k.bitrate).toBeGreaterThanOrEqual(dims720.bitrate);
	});

	it("1:1 aspect ratio with source quality should produce square output", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 100, max: 4000 }),
				fc.integer({ min: 100, max: 4000 }),
				(sourceWidth, sourceHeight) => {
					const { width, height } = calculateExportDimensions(
						sourceWidth,
						sourceHeight,
						"source",
						"1:1",
					);
					expect(width).toBe(height);
				},
			),
			{ numRuns: 100 },
		);
	});
});
