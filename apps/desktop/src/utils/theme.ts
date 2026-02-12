export const THEME_ATTRIBUTE = 'data-theme';

export type ThemeMode = 'light' | 'dark';

export const setTheme = (theme: ThemeMode) => {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
};

export const setThemeFromDarkMode = (darkMode: boolean) => {
  setTheme(darkMode ? 'dark' : 'light');
};

export const initializeTheme = () => {
  const savedTheme = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return;
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
};
