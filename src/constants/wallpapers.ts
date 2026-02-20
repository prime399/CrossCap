export const WALLPAPER_COUNT = 18;

export const WALLPAPER_PATHS = Array.from(
	{ length: WALLPAPER_COUNT },
	(_, i) => `/wallpapers/wallpaper${i + 1}.jpg`,
);

export const WALLPAPER_RELATIVE = Array.from(
	{ length: WALLPAPER_COUNT },
	(_, i) => `wallpapers/wallpaper${i + 1}.jpg`,
);
