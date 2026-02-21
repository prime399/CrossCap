import { WebDemuxer } from "web-demuxer";
import type { TrimRegion } from "@/components/video-editor/types";

export interface DecodedVideoInfo {
	width: number;
	height: number;
	duration: number; // seconds
	frameRate: number;
	codec: string;
	hasAudio: boolean;
	audioSampleRate?: number;
	audioChannels?: number;
}

/** Caller must close the VideoFrame after use. */
type OnFrameCallback = (
	frame: VideoFrame,
	exportTimestampUs: number,
	sourceTimestampMs: number,
) => Promise<void>;

/**
 * Decodes video frames via web-demuxer + VideoDecoder in a single forward pass.
 * Way faster than seeking an HTMLVideoElement per frame.
 *
 * Frames in trimmed regions are decoded (needed for P/B-frame state) but discarded.
 * Non-trimmed frames are delivered immediately with VFR→CFR resampling using a
 * sliding window of at most 2 source frames — no unbounded buffering.
 */
export class StreamingVideoDecoder {
	private demuxer: WebDemuxer | null = null;
	private decoder: VideoDecoder | null = null;
	private cancelled = false;
	private metadata: DecodedVideoInfo | null = null;

	async loadMetadata(videoUrl: string): Promise<DecodedVideoInfo> {
		console.log("[StreamingDecoder] loadMetadata — fetching:", videoUrl);
		const response = await fetch(videoUrl);
		if (!response.ok) {
			throw new Error(
				`[StreamingDecoder] fetch failed: ${response.status} ${response.statusText} for ${videoUrl}`,
			);
		}
		const blob = await response.blob();
		console.log("[StreamingDecoder] fetched blob:", blob.size, "bytes, type:", blob.type);
		const filename = videoUrl.split("/").pop() || "video";
		const file = new File([blob], filename, { type: blob.type });

		// Relative URL so it resolves correctly in both dev (http) and packaged (file://) builds
		const wasmUrl = new URL("./wasm/web-demuxer.wasm", window.location.href).href;
		console.log("[StreamingDecoder] WASM URL:", wasmUrl);
		this.demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
		await this.demuxer.load(file);
		console.log("[StreamingDecoder] demuxer loaded successfully");

		const mediaInfo = await this.demuxer.getMediaInfo();
		console.log("[StreamingDecoder] mediaInfo:", {
			duration: mediaInfo.duration,
			streams: mediaInfo.streams.map((s) => ({
				type: s.codec_type_string,
				codec: s.codec_string,
				width: s.width,
				height: s.height,
			})),
		});
		const videoStream = mediaInfo.streams.find((s) => s.codec_type_string === "video");
		const audioStream = mediaInfo.streams.find((s) => s.codec_type_string === "audio");

		let frameRate = 60;
		if (videoStream?.avg_frame_rate) {
			const parts = videoStream.avg_frame_rate.split("/");
			if (parts.length === 2) {
				const num = parseInt(parts[0], 10);
				const den = parseInt(parts[1], 10);
				if (den > 0 && num > 0) frameRate = num / den;
			}
		}

		this.metadata = {
			width: videoStream?.width || 1920,
			height: videoStream?.height || 1080,
			duration: mediaInfo.duration,
			frameRate,
			codec: videoStream?.codec_string || "unknown",
			hasAudio: Boolean(audioStream),
			audioSampleRate:
				typeof audioStream?.sample_rate === "number"
					? audioStream.sample_rate
					: typeof audioStream?.sample_rate === "string"
						? parseInt(audioStream.sample_rate, 10)
						: undefined,
			audioChannels: audioStream?.channels,
		};

		return this.metadata;
	}

	async decodeAll(
		targetFrameRate: number,
		trimRegions: TrimRegion[] | undefined,
		onFrame: OnFrameCallback,
	): Promise<void> {
		if (!this.demuxer || !this.metadata) {
			throw new Error("Must call loadMetadata() before decodeAll()");
		}

		console.log("[StreamingDecoder] Starting decode —", {
			targetFps: targetFrameRate,
			duration: this.metadata.duration,
			sourceCodec: this.metadata.codec,
			trimRegions: trimRegions?.length ?? 0,
		});

		const decoderConfig = await this.demuxer.getDecoderConfig("video");
		console.log("[StreamingDecoder] decoderConfig:", {
			codec: decoderConfig.codec,
			codedWidth: decoderConfig.codedWidth,
			codedHeight: decoderConfig.codedHeight,
			hardwareAcceleration: decoderConfig.hardwareAcceleration,
		});
		const segments = this.computeSegments(this.metadata.duration, trimRegions);
		console.log("[StreamingDecoder] segments:", segments);
		const frameDurationUs = 1_000_000 / targetFrameRate;
		const frameDurationSec = 1 / targetFrameRate;

		// Async frame queue — decoder pushes, consumer pulls
		const pendingFrames: VideoFrame[] = [];
		let frameResolve: ((frame: VideoFrame | null) => void) | null = null;
		let decodeError: Error | null = null;
		let decodeDone = false;

		let decodedFrameCount = 0;
		this.decoder = new VideoDecoder({
			output: (frame: VideoFrame) => {
				decodedFrameCount++;
				if (decodedFrameCount <= 3 || decodedFrameCount % 200 === 0) {
					console.log(`[StreamingDecoder] decoder output frame #${decodedFrameCount}`, {
						timestamp: frame.timestamp,
						duration: frame.duration,
						width: frame.codedWidth,
						height: frame.codedHeight,
					});
				}
				if (frameResolve) {
					const resolve = frameResolve;
					frameResolve = null;
					resolve(frame);
				} else {
					pendingFrames.push(frame);
				}
			},
			error: (e: DOMException) => {
				console.error("[StreamingDecoder] decoder error:", e.message);
				decodeError = new Error(`VideoDecoder error: ${e.message}`);
				if (frameResolve) {
					const resolve = frameResolve;
					frameResolve = null;
					resolve(null);
				}
			},
		});
		this.decoder.configure(decoderConfig);

		const getNextFrame = (): Promise<VideoFrame | null> => {
			if (decodeError) throw decodeError;
			if (this.cancelled) return Promise.resolve(null);
			if (pendingFrames.length > 0) return Promise.resolve(pendingFrames.shift()!);
			if (decodeDone) return Promise.resolve(null);
			return new Promise((resolve, reject) => {
				const cancelCheck = setInterval(() => {
					if (decodeError) {
						clearInterval(cancelCheck);
						frameResolve = null;
						reject(decodeError);
						return;
					}
					if (this.cancelled) {
						clearInterval(cancelCheck);
						frameResolve = null;
						resolve(null);
					}
				}, 100);
				frameResolve = (frame) => {
					clearInterval(cancelCheck);
					resolve(frame);
				};
			});
		};

		// One forward stream through the whole file
		const reader = this.demuxer.read("video").getReader();

		// Feed chunks to decoder in background with backpressure
		let chunksRead = 0;
		const feedPromise = (async () => {
			try {
				while (!this.cancelled) {
					const { done, value: chunk } = await reader.read();
					if (done || !chunk) {
						console.log(`[StreamingDecoder] feed done — ${chunksRead} chunks read`);
						break;
					}
					chunksRead++;
					if (chunksRead <= 3 || chunksRead % 200 === 0) {
						console.log(`[StreamingDecoder] feeding chunk #${chunksRead}`, {
							type: chunk.type,
							timestamp: chunk.timestamp,
							byteLength: chunk.byteLength,
							decoderQueueSize: this.decoder!.decodeQueueSize,
						});
					}

					while (this.decoder!.decodeQueueSize > 10 && !this.cancelled) {
						await new Promise((resolve) => setTimeout(resolve, 1));
					}
					if (this.cancelled) break;

					this.decoder!.decode(chunk);
				}

				if (!this.cancelled && this.decoder!.state === "configured") {
					await this.decoder!.flush();
				}
			} catch (e) {
				console.error("[StreamingDecoder] feed error:", e);
				decodeError = e instanceof Error ? e : new Error(String(e));
			} finally {
				console.log("[StreamingDecoder] feed loop ended", {
					chunksRead,
					decodedFrameCount,
					cancelled: this.cancelled,
					decoderState: this.decoder?.state,
				});
				decodeDone = true;
				if (frameResolve) {
					const resolve = frameResolve;
					frameResolve = null;
					resolve(null);
				}
			}
		})();

		// --- Streaming VFR→CFR delivery ---
		// Instead of buffering all frames per segment, deliver CFR frames on-the-fly.
		// Keep a sliding window: when a new source frame arrives at time T, emit all
		// CFR frames between the previous source frame and T using the previous frame.
		// This keeps at most 2 VideoFrames in memory at any time.
		let segmentIdx = 0;
		let exportFrameIndex = 0;
		let routedFrameCount = 0;
		let prevFrame: VideoFrame | null = null;
		let nextExportTimeSec = 0;

		while (!this.cancelled && segmentIdx < segments.length) {
			const frame = await getNextFrame();
			if (!frame) {
				console.log("[StreamingDecoder] getNextFrame returned null", {
					routedFrameCount,
					decodedFrameCount,
					decodeDone,
					cancelled: this.cancelled,
					decodeError: String(decodeError),
				});
				break;
			}
			routedFrameCount++;

			const frameTimeSec = frame.timestamp / 1_000_000;
			const currentSegment = segments[segmentIdx];

			if (routedFrameCount <= 5 || routedFrameCount % 200 === 0) {
				console.log(`[StreamingDecoder] routing frame #${routedFrameCount}`, {
					frameTimeSec: frameTimeSec.toFixed(3),
					segmentIdx,
					segmentRange: `${currentSegment.startSec.toFixed(3)}-${currentSegment.endSec.toFixed(3)}`,
					exportFrameIndex,
				});
			}

			// Before current segment — trimmed or pre-video
			if (frameTimeSec < currentSegment.startSec - 0.001) {
				frame.close();
				continue;
			}

			// Past current segment — flush remaining CFR frames and advance
			if (frameTimeSec >= currentSegment.endSec - 0.001) {
				// Emit remaining CFR frames for this segment using prevFrame
				if (prevFrame) {
					const segEndRelative = currentSegment.endSec - currentSegment.startSec;
					while (nextExportTimeSec < segEndRelative - 0.0001 && !this.cancelled) {
						exportFrameIndex = await this.emitFrame(
							prevFrame,
							exportFrameIndex,
							frameDurationUs,
							onFrame,
						);
						nextExportTimeSec += frameDurationSec;
					}
					prevFrame.close();
					prevFrame = null;
				}

				// Advance to next segment
				segmentIdx++;
				nextExportTimeSec = 0;

				while (
					segmentIdx < segments.length &&
					frameTimeSec >= segments[segmentIdx].endSec - 0.001
				) {
					segmentIdx++;
				}

				// Check if frame belongs to the new segment
				if (segmentIdx < segments.length && frameTimeSec >= segments[segmentIdx].startSec - 0.001) {
					prevFrame = frame;
					nextExportTimeSec = 0;
				} else {
					frame.close();
				}
				continue;
			}

			// Inside current segment — streaming CFR delivery
			const frameRelativeSec = frameTimeSec - currentSegment.startSec;

			if (!prevFrame) {
				// First frame in segment
				prevFrame = frame;
				nextExportTimeSec = 0;
				continue;
			}

			// Emit CFR frames up to this source frame's timestamp using prevFrame
			while (nextExportTimeSec < frameRelativeSec - 0.0001 && !this.cancelled) {
				exportFrameIndex = await this.emitFrame(
					prevFrame,
					exportFrameIndex,
					frameDurationUs,
					onFrame,
				);
				nextExportTimeSec += frameDurationSec;
			}

			// Replace prevFrame with current
			prevFrame.close();
			prevFrame = frame;
		}

		// Flush last segment: emit remaining CFR frames
		if (prevFrame && segmentIdx < segments.length && !this.cancelled) {
			const currentSegment = segments[segmentIdx];
			const segEndRelative = currentSegment.endSec - currentSegment.startSec;
			while (nextExportTimeSec < segEndRelative - 0.0001 && !this.cancelled) {
				exportFrameIndex = await this.emitFrame(
					prevFrame,
					exportFrameIndex,
					frameDurationUs,
					onFrame,
				);
				nextExportTimeSec += frameDurationSec;
			}
		}
		if (prevFrame) {
			prevFrame.close();
			prevFrame = null;
		}

		// Drain leftover decoded frames
		while (!decodeDone) {
			const frame = await getNextFrame();
			if (!frame) break;
			frame.close();
		}

		console.log("[StreamingDecoder] Decode complete —", {
			exportedFrames: exportFrameIndex,
			segments: segments.length,
			cancelled: this.cancelled,
		});

		try {
			reader.cancel();
		} catch {
			/* already closed */
		}
		await feedPromise;
		for (const f of pendingFrames) f.close();
		pendingFrames.length = 0;

		if (this.decoder?.state === "configured") {
			this.decoder.close();
		}
		this.decoder = null;
	}

	/**
	 * Emit a single CFR frame by cloning the source and calling onFrame.
	 * Returns the next exportFrameIndex.
	 */
	private async emitFrame(
		sourceFrame: VideoFrame,
		exportFrameIndex: number,
		frameDurationUs: number,
		onFrame: OnFrameCallback,
	): Promise<number> {
		const clone = new VideoFrame(sourceFrame, { timestamp: sourceFrame.timestamp });
		try {
			await onFrame(clone, exportFrameIndex * frameDurationUs, sourceFrame.timestamp / 1000);
		} catch (err) {
			clone.close();
			throw err;
		}
		return exportFrameIndex + 1;
	}

	private computeSegments(
		totalDuration: number,
		trimRegions?: TrimRegion[],
	): Array<{ startSec: number; endSec: number }> {
		if (!trimRegions || trimRegions.length === 0) {
			return [{ startSec: 0, endSec: totalDuration }];
		}

		const sorted = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
		const segments: Array<{ startSec: number; endSec: number }> = [];
		let cursor = 0;

		for (const trim of sorted) {
			const trimStart = trim.startMs / 1000;
			const trimEnd = trim.endMs / 1000;
			if (cursor < trimStart) {
				segments.push({ startSec: cursor, endSec: trimStart });
			}
			cursor = trimEnd;
		}

		if (cursor < totalDuration) {
			segments.push({ startSec: cursor, endSec: totalDuration });
		}

		return segments;
	}

	getEffectiveDuration(trimRegions?: TrimRegion[]): number {
		if (!this.metadata) throw new Error("Must call loadMetadata() first");
		const trimmed = (trimRegions || []).reduce((sum, r) => sum + (r.endMs - r.startMs) / 1000, 0);
		return this.metadata.duration - trimmed;
	}

	/**
	 * Compute total export frame count by summing per-segment counts.
	 * This matches the actual frame delivery in the streaming loop and avoids
	 * floating-point drift from computing ceil(totalDuration * fps).
	 */
	getEffectiveFrameCount(trimRegions: TrimRegion[] | undefined, targetFrameRate: number): number {
		if (!this.metadata) throw new Error("Must call loadMetadata() first");
		const segments = this.computeSegments(this.metadata.duration, trimRegions);
		return segments.reduce(
			(sum, seg) => sum + Math.ceil((seg.endSec - seg.startSec) * targetFrameRate),
			0,
		);
	}

	cancel(): void {
		this.cancelled = true;
	}

	destroy(): void {
		this.cancelled = true;

		if (this.decoder) {
			try {
				if (this.decoder.state === "configured") this.decoder.close();
			} catch {
				/* ignore */
			}
			this.decoder = null;
		}

		if (this.demuxer) {
			try {
				this.demuxer.destroy();
			} catch {
				/* demuxer already destroyed */
			}
		}
	}
}
