import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { migrateStorage } from './migrate-storage.js'
import { initAnalytics } from './analytics.js'
import { getAppSettings } from './app-settings.js'

migrateStorage()
initAnalytics({ optOut: getAppSettings().analyticsOptOut })

const app = createApp(App)

// Click outside directive
app.directive('click-outside', {
  beforeMount(el, binding) {
    el.clickOutsideEvent = function(event) {
      // Check if click is outside the element
      if (!(el === event.target || el.contains(event.target))) {
        // Check if click is on a sibling button (the trigger button)
        const parent = el.parentElement
        if (parent) {
          // Get all direct child buttons (siblings of the menu)
          const siblingButtons = Array.from(parent.children).filter(
            child => child !== el && child.tagName === 'BUTTON'
          )
          for (const button of siblingButtons) {
            if (button === event.target || button.contains(event.target)) {
              return // Don't close if clicking the trigger button
            }
          }
        }
        binding.value(event)
      }
    }
    // Add listener on next tick to avoid immediate closure when opening
    setTimeout(() => {
      document.addEventListener('click', el.clickOutsideEvent)
    }, 50)
  },
  unmounted(el) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('click', el.clickOutsideEvent)
    }
  }
})

app.mount('#app')
