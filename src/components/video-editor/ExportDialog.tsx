import { CircleNotch, DownloadSimple, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExportProgress } from "@/lib/exporter";

interface ExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
	progress: ExportProgress | null;
	isExporting: boolean;
	error: string | null;
	onCancel?: () => void;
	exportFormat?: "mp4" | "gif";
}

export function ExportDialog({
	isOpen,
	onClose,
	progress,
	isExporting,
	error,
	onCancel,
	exportFormat = "mp4",
}: ExportDialogProps) {
	const [showSuccess, setShowSuccess] = useState(false);

	// Reset showSuccess when a new export starts or dialog reopens
	useEffect(() => {
		if (isExporting) {
			setShowSuccess(false);
		}
	}, [isExporting]);

	// Reset showSuccess when dialog opens fresh
	useEffect(() => {
		if (isOpen && !isExporting && !progress) {
			setShowSuccess(false);
		}
	}, [isOpen, isExporting, progress]);

	useEffect(() => {
		if (!isExporting && progress && progress.percentage >= 100 && !error) {
			setShowSuccess(true);
			const timer = setTimeout(() => {
				setShowSuccess(false);
				onClose();
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isExporting, progress, error, onClose]);

	if (!isOpen) return null;

	const formatLabel = exportFormat === "gif" ? "GIF" : "Video";

	// Determine if we're in the compiling/finalizing phase
	const isFinalizing = progress?.phase === "finalizing";
	const isCompiling = isExporting && progress && isFinalizing && exportFormat === "gif";
	const isFinalizingMp4 = isExporting && isFinalizing && exportFormat === "mp4";
	const renderProgress =
		typeof progress?.renderProgress === "number"
			? Math.max(0, Math.min(100, progress.renderProgress))
			: undefined;
	const frameProgress =
		typeof progress?.percentage === "number" ? Math.max(0, Math.min(100, progress.percentage)) : 0;
	const visibleProgress = isFinalizing ? (renderProgress ?? frameProgress) : frameProgress;
	const statusDetail = progress?.phaseDetail;

	// Get status message based on phase
	const getStatusMessage = () => {
		if (error) return "Please try again";
		if (isFinalizingMp4) return statusDetail || "Finalizing video...";
		if (isCompiling || isFinalizing) {
			if (renderProgress !== undefined) {
				return `${statusDetail || "Compiling GIF"}... ${renderProgress}%`;
			}
			return `${statusDetail || "Compiling GIF"}...`;
		}
		if (progress) return statusDetail || "Rendering frames...";
		return "Preparing export...";
	};

	// Get title based on phase
	const getTitle = () => {
		if (error) return "Export Failed";
		if (isFinalizingMp4) return "Finalizing Video";
		if (isCompiling || isFinalizing) return "Compiling GIF";
		return `Exporting ${formatLabel}`;
	};

	return (
		<>
			<div
				className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-in fade-in duration-200"
				onClick={isExporting ? undefined : onClose}
			/>
			<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-md animate-in zoom-in-95 duration-200">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-4">
						{showSuccess ? (
							<>
								<div className="w-12 h-12 rounded-full bg-cc-accent/20 flex items-center justify-center ring-1 ring-cc-accent/50">
									<DownloadSimple size={24} weight="bold" className="text-cc-accent" />
								</div>
								<div>
									<span className="text-xl font-bold text-slate-200 block">Export Complete</span>
									<span className="text-sm text-slate-400">
										Your {formatLabel.toLowerCase()} is ready
									</span>
								</div>
							</>
						) : (
							<>
								{isExporting ? (
									<div className="w-12 h-12 rounded-full bg-cc-accent/10 flex items-center justify-center">
										<CircleNotch size={24} weight="bold" className="text-cc-accent animate-spin" />
									</div>
								) : (
									<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
										<DownloadSimple size={24} weight="bold" className="text-slate-200" />
									</div>
								)}
								<div>
									<span className="text-xl font-bold text-slate-200 block">{getTitle()}</span>
									<span className="text-sm text-slate-400">{getStatusMessage()}</span>
								</div>
							</>
						)}
					</div>
					{!isExporting && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
						>
							<X size={20} weight="bold" />
						</Button>
					)}
				</div>

				{error && (
					<div className="mb-6 animate-in slide-in-from-top-2">
						<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
							<div className="p-1 bg-red-500/20 rounded-full">
								<X size={12} weight="bold" className="text-red-400" />
							</div>
							<p className="text-sm text-red-400 leading-relaxed">{error}</p>
						</div>
					</div>
				)}

				{isExporting && (
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
								<span>
									{isFinalizingMp4
										? "Finalizing"
										: isCompiling || isFinalizing
											? "Compiling"
											: "Rendering Frames"}
								</span>
								<span className="font-mono text-slate-200">
									{`${Math.round(visibleProgress)}%`}
								</span>
							</div>
							<div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
								<div
									className="h-full bg-cc-accent shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all duration-300 ease-out"
									style={{ width: `${visibleProgress}%` }}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white/5 rounded-xl p-3 border border-white/5">
								<div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
									{isFinalizingMp4 || isCompiling || isFinalizing ? "Status" : "Format"}
								</div>
								<div className="text-slate-200 font-medium text-sm">
									{isFinalizingMp4
										? "Finalizing..."
										: isCompiling || isFinalizing
											? "Compiling..."
											: formatLabel}
								</div>
							</div>
							<div className="bg-white/5 rounded-xl p-3 border border-white/5">
								<div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
									Frames
								</div>
								<div className="text-slate-200 font-medium text-sm">
									{progress ? `${progress.currentFrame} / ${progress.totalFrames}` : "0 / 0"}
								</div>
							</div>
						</div>

						{onCancel && (
							<div className="pt-2">
								<Button
									onClick={onCancel}
									variant="destructive"
									className="w-full py-6 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all rounded-xl"
								>
									Cancel Export
								</Button>
							</div>
						)}
					</div>
				)}

				{showSuccess && (
					<div className="text-center py-4 animate-in zoom-in-95">
						<p className="text-lg text-slate-200 font-medium">{formatLabel} saved successfully!</p>
					</div>
				)}
			</div>
		</>
	);
}
