import { onMounted, onUnmounted } from 'vue'

const LIGHT_THEME_COLOR = '#ffffff'
const DARK_THEME_COLOR = '#000000' // Pure OLED black

export function useColorScheme() {
  let mediaQuery = null

  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
    }
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
}
