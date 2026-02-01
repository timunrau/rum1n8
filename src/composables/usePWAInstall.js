import { ref, onMounted } from 'vue'

export function isPWAInstalled() {
  if (typeof window === 'undefined') return false
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function usePWAInstall() {
  const deferredPrompt = ref(null)
  const showIOSModal = ref(false)

  const triggerInstall = () => {
    if (isIOS()) {
      showIOSModal.value = true
    } else if (deferredPrompt.value) {
      deferredPrompt.value.prompt()
    }
  }

  const closeIOSModal = () => {
    showIOSModal.value = false
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e
    })

    window.addEventListener('appinstalled', () => {
      deferredPrompt.value = null
    })
  })

  return {
    isPWAInstalled,
    isIOS,
    showIOSModal,
    triggerInstall,
    closeIOSModal
  }
}
