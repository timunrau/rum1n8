import { ref, onMounted, onUnmounted } from 'vue'

const LIGHT_THEME_COLOR = '#ffffff'
const DARK_THEME_COLOR = '#000000' // Pure OLED black

export function useColorScheme() {
  let mediaQuery = null
  const isDark = ref(false)

  function applyTheme(dark) {
    isDark.value = dark
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    const lightMeta = document.querySelector('meta[name="theme-color"][media*="light"]')
    const darkMeta = document.querySelector('meta[name="theme-color"][media*="dark"]')
    if (lightMeta) lightMeta.setAttribute('content', LIGHT_THEME_COLOR)
    if (darkMeta) darkMeta.setAttribute('content', DARK_THEME_COLOR)
    // Fallback for single meta tag
    const singleMeta = document.querySelector('meta[name="theme-color"]:not([media])')
    if (singleMeta) singleMeta.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
  }

  function onChange(e) {
    applyTheme(e.matches)
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    applyTheme(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', onChange)
    }
  })

  return { isDark }
}
