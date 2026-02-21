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
 * Non-trimmed frames get buffered per segment and resampled to the target frame rate.
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

		// Async frame queue — decoder pushes, consumer pulls
		const pendingFrames: VideoFrame[] = [];
		let frameResolve: ((frame: VideoFrame | null) => void) | null = null;
		let decodeError: Error | null = null;
		let decodeDone = false;

		let decodedFrameCount = 0;
		this.decoder = new VideoDecoder({
			output: (frame: VideoFrame) => {
				decodedFrameCount++;
				if (decodedFrameCount <= 3 || decodedFrameCount % 100 === 0) {
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
				// Wrap resolve to clear the interval when settled normally
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
					if (chunksRead <= 3 || chunksRead % 100 === 0) {
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

		// Route decoded frames into segments by timestamp, then deliver with VFR→CFR resampling
		let segmentIdx = 0;
		let exportFrameIndex = 0;
		let segmentBuffer: VideoFrame[] = [];
		let routedFrameCount = 0;

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

			if (routedFrameCount <= 5 || routedFrameCount % 100 === 0) {
				console.log(`[StreamingDecoder] routing frame #${routedFrameCount}`, {
					frameTimeSec: frameTimeSec.toFixed(3),
					segmentIdx,
					segmentRange: `${currentSegment.startSec.toFixed(3)}-${currentSegment.endSec.toFixed(3)}`,
					bufferSize: segmentBuffer.length,
				});
			}

			// Before current segment — trimmed or pre-video
			if (frameTimeSec < currentSegment.startSec - 0.001) {
				frame.close();
				continue;
			}

			// Past current segment — flush buffer and advance
			if (frameTimeSec >= currentSegment.endSec - 0.001) {
				try {
					exportFrameIndex = await this.deliverSegment(
						segmentBuffer,
						currentSegment,
						targetFrameRate,
						frameDurationUs,
						exportFrameIndex,
						onFrame,
					);
				} catch (err) {
					frame.close();
					throw err;
				} finally {
					for (const f of segmentBuffer) f.close();
					segmentBuffer = [];
				}

				segmentIdx++;
				while (
					segmentIdx < segments.length &&
					frameTimeSec >= segments[segmentIdx].endSec - 0.001
				) {
					segmentIdx++;
				}

				if (segmentIdx < segments.length && frameTimeSec >= segments[segmentIdx].startSec - 0.001) {
					segmentBuffer.push(frame);
				} else {
					frame.close();
				}
				continue;
			}

			segmentBuffer.push(frame);
		}

		// Flush last segment
		if (segmentBuffer.length > 0 && segmentIdx < segments.length) {
			try {
				exportFrameIndex = await this.deliverSegment(
					segmentBuffer,
					segments[segmentIdx],
					targetFrameRate,
					frameDurationUs,
					exportFrameIndex,
					onFrame,
				);
			} finally {
				for (const f of segmentBuffer) f.close();
			}
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
	 * Resample buffered frames to fill the target frame count for this segment.
	 * Handles VFR sources by duplicating/decimating as needed.
	 */
	private async deliverSegment(
		frames: VideoFrame[],
		segment: { startSec: number; endSec: number },
		targetFrameRate: number,
		frameDurationUs: number,
		startExportFrameIndex: number,
		onFrame: OnFrameCallback,
	): Promise<number> {
		if (frames.length === 0) return startExportFrameIndex;

		const segmentFrameCount = Math.ceil((segment.endSec - segment.startSec) * targetFrameRate);
		let exportFrameIndex = startExportFrameIndex;

		for (let i = 0; i < segmentFrameCount && !this.cancelled; i++) {
			const sourceIdx = Math.min(
				Math.floor((i * frames.length) / segmentFrameCount),
				frames.length - 1,
			);
			const sourceFrame = frames[sourceIdx];
			const clone = new VideoFrame(sourceFrame, { timestamp: sourceFrame.timestamp });
			try {
				await onFrame(clone, exportFrameIndex * frameDurationUs, sourceFrame.timestamp / 1000);
			} catch (err) {
				clone.close();
				throw err;
			}
			exportFrameIndex++;
		}

		return exportFrameIndex;
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
	 * This matches the actual frame delivery in deliverSegment() and avoids
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
