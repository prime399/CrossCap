import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  VideoEditorSettings,
  VideoEditorEffects,
  VideoEditorBackground,
  VideoEditorExport,
  VideoEditorRegions,
  VideoEditorUI,
} from '@/components/video-editor/types';
import {
  DEFAULT_VIDEO_EDITOR_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from '@/components/video-editor/types';

type PartialSettings = {
  effects?: Partial<VideoEditorEffects>;
  background?: Partial<VideoEditorBackground>;
  export?: Partial<VideoEditorExport>;
  regions?: Partial<VideoEditorRegions>;
  ui?: Partial<VideoEditorUI>;
};

function migrateSettings(stored: unknown): VideoEditorSettings {
  if (!stored || typeof stored !== 'object') {
    return DEFAULT_VIDEO_EDITOR_SETTINGS;
  }

  const storedSettings = stored as Partial<VideoEditorSettings>;
  
  if (!storedSettings.version || storedSettings.version < 1) {
    return {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS,
      ...storedSettings,
      version: 1,
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    version: storedSettings.version || 1,
    lastUpdated: storedSettings.lastUpdated || new Date().toISOString(),
    effects: {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS.effects,
      ...storedSettings.effects,
    },
    background: {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS.background,
      ...storedSettings.background,
    },
    export: {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS.export,
      ...storedSettings.export,
    },
    regions: {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS.regions,
      ...storedSettings.regions,
    },
    ui: {
      ...DEFAULT_VIDEO_EDITOR_SETTINGS.ui,
      ...storedSettings.ui,
    },
  };
}

export function useSettingsPersistence() {
  const [settings, setSettings] = useState<VideoEditorSettings>(DEFAULT_VIDEO_EDITOR_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const settingsRef = useRef<VideoEditorSettings>(DEFAULT_VIDEO_EDITOR_SETTINGS);
  
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const migrated = migrateSettings(parsed);
        setSettings(migrated);
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  const saveToStorage = useCallback((newSettings: VideoEditorSettings) => {
    try {
      const settingsToSave = {
        ...newSettings,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Removing custom images to save space.');
        const trimmedSettings = {
          ...newSettings,
          background: {
            ...newSettings.background,
            customImages: [],
          },
          lastUpdated: new Date().toISOString(),
        };
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(trimmedSettings));
          setSettings(trimmedSettings);
        } catch (e) {
          console.error('Failed to save even without custom images:', e);
        }
      } else {
        console.error('Error saving settings to localStorage:', error);
      }
    }
  }, []);

  const updateSettings = useCallback((update: PartialSettings) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      
      if (update.effects) {
        newSettings.effects = { ...prev.effects, ...update.effects };
      }
      if (update.background) {
        newSettings.background = { ...prev.background, ...update.background };
      }
      if (update.export) {
        newSettings.export = { ...prev.export, ...update.export };
      }
      if (update.regions) {
        newSettings.regions = { ...prev.regions, ...update.regions };
      }
      if (update.ui) {
        newSettings.ui = { ...prev.ui, ...update.ui };
      }
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveToStorage(newSettings);
      }, 500);
      
      return newSettings;
    });
  }, [saveToStorage]);

  const updateEffects = useCallback((effects: Partial<VideoEditorEffects>) => {
    updateSettings({ effects });
  }, [updateSettings]);

  const updateBackground = useCallback((background: Partial<VideoEditorBackground>) => {
    updateSettings({ background });
  }, [updateSettings]);

  const updateExport = useCallback((exportSettings: Partial<VideoEditorExport>) => {
    updateSettings({ export: exportSettings });
  }, [updateSettings]);

  const updateRegions = useCallback((regions: Partial<VideoEditorRegions>) => {
    updateSettings({ regions });
  }, [updateSettings]);

  const updateUI = useCallback((ui: Partial<VideoEditorUI>) => {
    updateSettings({ ui });
  }, [updateSettings]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_VIDEO_EDITOR_SETTINGS);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_VIDEO_EDITOR_SETTINGS));
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveToStorage(settingsRef.current);
      }
    };
  }, [saveToStorage]);

  return {
    settings,
    isLoaded,
    updateSettings,
    updateEffects,
    updateBackground,
    updateExport,
    updateRegions,
    updateUI,
    resetSettings,
  };
}

export function useEffectsSettings() {
  const { settings, updateEffects, isLoaded } = useSettingsPersistence();
  return { effects: settings.effects, updateEffects, isLoaded };
}

export function useBackgroundSettings() {
  const { settings, updateBackground, isLoaded } = useSettingsPersistence();
  return { background: settings.background, updateBackground, isLoaded };
}

export function useExportSettings() {
  const { settings, updateExport, isLoaded } = useSettingsPersistence();
  return { export: settings.export, updateExport, isLoaded };
}

export function useRegionsSettings() {
  const { settings, updateRegions, isLoaded } = useSettingsPersistence();
  return { regions: settings.regions, updateRegions, isLoaded };
}

export function useUISettings() {
  const { settings, updateUI, isLoaded } = useSettingsPersistence();
  return { ui: settings.ui, updateUI, isLoaded };
}
