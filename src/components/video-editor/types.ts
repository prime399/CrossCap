import type { ExportQuality, ExportFormat, GifFrameRate, GifSizePreset } from '@/lib/exporter';

export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZoomFocus {
  cx: number; // normalized horizontal center (0-1)
  cy: number; // normalized vertical center (0-1)
}

export interface ZoomRegion {
  id: string;
  startMs: number;
  endMs: number;
  depth: ZoomDepth;
  focus: ZoomFocus;
}

export interface TrimRegion {
  id: string;
  startMs: number;
  endMs: number;
}

export type AnnotationType = 'text' | 'image' | 'figure';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'down-right' | 'down-left';

export interface FigureData {
  arrowDirection: ArrowDirection;
  color: string;
  strokeWidth: number;
}

export interface AnnotationPosition {
  x: number;
  y: number;
}

export interface AnnotationSize {
  width: number;
  height: number;
}

export interface AnnotationTextStyle {
  color: string;
  backgroundColor: string;
  fontSize: number; // pixels
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
}

export interface AnnotationRegion {
  id: string;
  startMs: number;
  endMs: number;
  type: AnnotationType;
  content: string; // Legacy - still used for current type
  textContent?: string; // Separate storage for text
  imageContent?: string; // Separate storage for image data URL
  position: AnnotationPosition;
  size: AnnotationSize;
  style: AnnotationTextStyle;
  zIndex: number;
  figureData?: FigureData;
}

export const DEFAULT_ANNOTATION_POSITION: AnnotationPosition = {
  x: 50,
  y: 50,
};

export const DEFAULT_ANNOTATION_SIZE: AnnotationSize = {
  width: 30,
  height: 20,
};

export const DEFAULT_ANNOTATION_STYLE: AnnotationTextStyle = {
  color: '#ffffff',
  backgroundColor: 'transparent',
  fontSize: 32,
  fontFamily: 'Inter',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'center',
};

export const DEFAULT_FIGURE_DATA: FigureData = {
  arrowDirection: 'right',
  color: '#34B27B',
  strokeWidth: 4,
};



export interface CropRegion {
  x: number; 
  y: number; 
  width: number; 
  height: number; 
}

export const DEFAULT_CROP_REGION: CropRegion = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
  1: 1.25,
  2: 1.5,
  3: 1.8,
  4: 2.2,
  5: 3.5,
  6: 5.0,
};

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
  return {
    cx: clamp(focus.cx, 0, 1),
    cy: clamp(focus.cy, 0, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

export interface VideoEditorEffects {
  motionBlurEnabled: boolean;
  blurBgEnabled: boolean;
  shadowIntensity: number;
  borderRadius: number;
  padding: number;
}

export interface VideoEditorBackground {
  type: 'image' | 'color' | 'gradient';
  value: string;
  customImages: string[];
  selectedColor: string;
  selectedGradient: string;
}

export interface VideoEditorExport {
  format: ExportFormat;
  quality: ExportQuality;
  gifFrameRate: GifFrameRate;
  gifLoop: boolean;
  gifSizePreset: GifSizePreset;
}

export interface VideoEditorRegions {
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  cropRegion: CropRegion;
}

export interface VideoEditorUI {
  activeAccordionItems: string[];
  activeBackgroundTab: 'image' | 'color' | 'gradient';
}

export interface VideoEditorSettings {
  version: number;
  lastUpdated: string;
  effects: VideoEditorEffects;
  background: VideoEditorBackground;
  export: VideoEditorExport;
  regions: VideoEditorRegions;
  ui: VideoEditorUI;
}

export const DEFAULT_VIDEO_EDITOR_EFFECTS: VideoEditorEffects = {
  motionBlurEnabled: false,
  blurBgEnabled: false,
  shadowIntensity: 0,
  borderRadius: 0,
  padding: 50,
};

export const DEFAULT_VIDEO_EDITOR_BACKGROUND: VideoEditorBackground = {
  type: 'image',
  value: 'wallpapers/wallpaper1.jpg',
  customImages: [],
  selectedColor: '#ADADAD',
  selectedGradient: 'linear-gradient(111.6deg, rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%)',
};

export const DEFAULT_VIDEO_EDITOR_EXPORT: VideoEditorExport = {
  format: 'mp4',
  quality: 'good',
  gifFrameRate: 15,
  gifLoop: true,
  gifSizePreset: 'medium',
};

export const DEFAULT_VIDEO_EDITOR_REGIONS: VideoEditorRegions = {
  zoomRegions: [],
  trimRegions: [],
  cropRegion: DEFAULT_CROP_REGION,
};

export const DEFAULT_VIDEO_EDITOR_UI: VideoEditorUI = {
  activeAccordionItems: ['effects', 'background'],
  activeBackgroundTab: 'image',
};

export const DEFAULT_VIDEO_EDITOR_SETTINGS: VideoEditorSettings = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  effects: DEFAULT_VIDEO_EDITOR_EFFECTS,
  background: DEFAULT_VIDEO_EDITOR_BACKGROUND,
  export: DEFAULT_VIDEO_EDITOR_EXPORT,
  regions: DEFAULT_VIDEO_EDITOR_REGIONS,
  ui: DEFAULT_VIDEO_EDITOR_UI,
};

export const SETTINGS_STORAGE_KEY = 'openscreen_video_editor_settings';
