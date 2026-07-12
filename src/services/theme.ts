const THEME_KEY = 'theme'

export type ThemePreference = 'light' | 'dark' | 'system'

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** Stamps data-theme on <html> so CSS variables switch immediately, no reload needed. */
export function applyTheme(pref: ThemePreference): void {
  if (pref === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', pref)
}

export function setThemePreference(pref: ThemePreference): void {
  if (pref === 'system') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, pref)
  applyTheme(pref)
}
