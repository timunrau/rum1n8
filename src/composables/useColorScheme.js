import { ref, onMounted, onUnmounted } from 'vue'

const LIGHT_THEME_COLOR = '#f3ede2'
const DARK_THEME_COLOR = '#1a1510'

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
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
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
