import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { clearInstallPromptSnoozes } from '../ui-state.js'

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

export function isIOSSafari() {
  if (typeof navigator === 'undefined' || !isIOS()) return false
  const userAgent = navigator.userAgent || ''
  const isSafari = /Safari/i.test(userAgent)
  const isOtherIOSBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Chrome|Firefox)/i.test(userAgent)
  return isSafari && !isOtherIOSBrowser
}

export function isIOSNonSafari() {
  return isIOS() && !isIOSSafari()
}

export function usePWAInstall() {
  const deferredPrompt = ref(null)
  const showIOSModal = ref(false)
  const lastInstallOutcome = ref(null)

  const installPromptAvailable = computed(() => !!deferredPrompt.value)
  const isInstallActionable = computed(() => (
    !isPWAInstalled() && (isIOS() || installPromptAvailable.value)
  ))

  const triggerInstall = async () => {
    if (isPWAInstalled()) {
      lastInstallOutcome.value = 'unavailable'
      return 'unavailable'
    }

    if (isIOS()) {
      showIOSModal.value = true
      lastInstallOutcome.value = 'ios-guidance'
      return 'ios-guidance'
    }

    const promptEvent = deferredPrompt.value
    if (!promptEvent) {
      lastInstallOutcome.value = 'unavailable'
      return 'unavailable'
    }

    deferredPrompt.value = null

    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      const outcome = choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
      lastInstallOutcome.value = outcome
      return outcome
    } catch {
      lastInstallOutcome.value = 'unavailable'
      return 'unavailable'
    }
  }

  const closeIOSModal = () => {
    showIOSModal.value = false
  }

  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault()
    deferredPrompt.value = e
  }

  const handleAppInstalled = () => {
    deferredPrompt.value = null
    showIOSModal.value = false
    clearInstallPromptSnoozes()
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  })

  return {
    isPWAInstalled,
    isIOS,
    isIOSSafari,
    isIOSNonSafari,
    installPromptAvailable,
    isInstallActionable,
    lastInstallOutcome,
    showIOSModal,
    triggerInstall,
    closeIOSModal
  }
}
