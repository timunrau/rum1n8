<template>
  <ModalSheet :show="show" title="Sync" data-testid="modal-sync-settings" @close="close">
    <div class="space-y-5">
      <!-- Intro copy -->
      <p class="text-sm text-text-secondary -mt-1">
        Keep your verses safe and in sync across all your devices.
      </p>

      <!-- Google Drive hero (primary path) -->
      <div v-if="selectedProvider === 'gdrive'" class="space-y-3">
        <!-- Connected state -->
        <div v-if="oauthEmail" class="flex items-center justify-between p-3 rounded-xl bg-status-success-bg border border-status-success-border">
          <div class="min-w-0">
            <p class="text-sm font-medium text-status-success-text">Synced with Google Drive</p>
            <p class="text-xs text-status-success-text opacity-80 truncate">{{ oauthEmail }}</p>
          </div>
          <button
            @click="confirmDisconnect"
            class="text-xs px-3 py-1.5 rounded-lg border border-status-error-border text-status-error-text hover:bg-status-error-bg transition-colors shrink-0 ml-3"
            data-testid="sync-disconnect"
          >
            Disconnect
          </button>
        </div>

        <!-- Not connected -->
        <div v-else class="space-y-3">
          <button
            @click="signInWithGoogle"
            :disabled="signingIn"
            data-testid="sync-gdrive-signin"
            class="w-full px-4 py-3 rounded-xl border border-border-input text-text-primary font-medium hover:bg-surface-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg v-if="!signingIn" class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {{ signingIn ? 'Signing in…' : 'Continue with Google' }}
          </button>
          <p class="text-xs text-text-muted text-center">
            Your verses are stored in your own Google Drive. We never see them.
          </p>
        </div>
      </div>

      <!-- WebDAV advanced section -->
      <div v-if="selectedProvider === 'webdav'" class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs font-medium uppercase tracking-wide text-text-muted">WebDAV (advanced)</p>
          <button
            type="button"
            @click="switchToGoogle"
            class="text-xs text-blue-600 hover:underline"
          >
            Use Google Drive instead
          </button>
        </div>

        <template v-for="field in currentFields" :key="field.key">
          <template v-if="!field.devOnly || isDev">
            <template v-if="!field.showIf || field.showIf(formSettings)">
              <div v-if="field.type === 'checkbox'" class="flex items-center space-x-2">
                <input
                  :id="`sync-field-${field.key}`"
                  v-model="formSettings[field.key]"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-accent-warm"
                />
                <label :for="`sync-field-${field.key}`" class="text-sm font-medium text-text-secondary">
                  {{ field.label }}
                </label>
              </div>
              <div v-else>
                <label :for="`sync-field-${field.key}`" class="block text-sm font-medium text-text-secondary mb-2">
                  {{ field.label }}
                </label>
                <input
                  :id="`sync-field-${field.key}`"
                  v-model="formSettings[field.key]"
                  :type="field.type"
                  :placeholder="field.placeholder || ''"
                  class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
                />
                <p v-if="field.hint" class="text-xs text-text-muted mt-1">{{ field.hint }}</p>
              </div>
            </template>
          </template>
        </template>

        <!-- Dev CORS note for WebDAV -->
        <div v-if="isDev" class="bg-status-info-bg border border-status-info-border rounded-lg p-4">
          <p class="text-sm text-status-info-text">
            <strong>Note:</strong> If you see a "CORS Error", enable the CORS proxy option above and run the proxy server.
          </p>
        </div>
        <div v-if="isDev && formSettings.useProxy" class="bg-status-warn-bg border border-status-warn-border rounded-lg p-3">
          <p class="text-xs text-status-warn-text">
            <strong>Setup:</strong> Run the proxy server with:<br/>
            <code class="bg-status-warn-bg px-2 py-1 rounded">NEXTCLOUD_URL={{ formSettings.url || 'YOUR_NEXTCLOUD_URL' }} npm run dev:proxy</code><br/>
            Or use <code class="bg-status-warn-bg px-2 py-1 rounded">npm run dev:all</code> to run both the app and proxy together.
          </p>
        </div>
      </div>

      <!-- Status message -->
      <div v-if="status" class="p-3 rounded-lg" :class="status.type === 'success' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-error-bg text-status-error-text'">
        <p class="text-sm whitespace-pre-line">{{ status.message }}</p>
      </div>

      <!-- Advanced disclosure (when on gdrive) -->
      <div v-if="selectedProvider === 'gdrive'" class="pt-2 text-center">
        <button
          type="button"
          @click="switchToWebDAV"
          class="text-xs text-text-muted hover:text-text-secondary underline"
          data-testid="sync-advanced-toggle"
        >
          Use a different provider (advanced)
        </button>
      </div>
    </div>

    <template #footer>
      <div v-if="selectedProvider === 'webdav'" class="flex justify-between items-center">
        <button
          type="button"
          @click="testConnection"
          :disabled="testingConnection || !canTest"
          class="px-6 py-2.5 border border-border-input rounded-xl text-text-secondary hover:bg-surface-hover transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ testingConnection ? 'Testing...' : 'Test' }}
        </button>
        <div class="flex gap-3">
          <button
            type="button"
            @click="close"
            class="px-6 py-2.5 border border-border-input rounded-xl text-text-secondary hover:bg-surface-hover transition-colors duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="save"
            :disabled="!canSave"
            class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
      <div v-else class="flex justify-end">
        <button
          type="button"
          @click="close"
          class="px-6 py-2.5 border border-border-input rounded-xl text-text-secondary hover:bg-surface-hover transition-colors duration-200 font-medium"
        >
          Done
        </button>
      </div>
    </template>
  </ModalSheet>
</template>

<script>
import { ref, computed, watch } from 'vue'
import ModalSheet from './ModalSheet.vue'
import { getAllProviders, getProvider } from '../sync/providers/index.js'
import { getActiveProviderId, setActiveProviderId } from '../sync/sync-manager.js'
import { startOAuthFlow } from '../sync/providers/gdrive-provider.js'

export default {
  name: 'SyncSettingsModal',
  components: { ModalSheet },
  props: {
    show: { type: Boolean, required: true }
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const providers = getAllProviders()
    const selectedProvider = ref(getActiveProviderId() || 'gdrive')
    const formSettings = ref({})
    const status = ref(null)
    const testingConnection = ref(false)
    const signingIn = ref(false)
    const oauthEmail = ref('')

    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    const currentFields = computed(() => {
      const provider = getProvider(selectedProvider.value)
      if (!provider) return []
      // Filter out oauth-button fields since we render the Google UI separately
      return provider.getSettingsFields().filter(f => f.type !== 'oauth-button')
    })

    const canTest = computed(() => {
      if (selectedProvider.value !== 'webdav') return false
      const provider = getProvider('webdav')
      if (!provider) return false
      const fields = provider.getSettingsFields()
      return fields.filter(f => f.required).every(f => formSettings.value[f.key])
    })

    const canSave = computed(() => {
      if (selectedProvider.value !== 'webdav') return false
      const provider = getProvider('webdav')
      if (!provider) return false
      const fields = provider.getSettingsFields()
      return fields.filter(f => f.required).every(f => formSettings.value[f.key])
    })

    function loadProviderSettings() {
      const provider = getProvider(selectedProvider.value)
      if (!provider) return

      if (selectedProvider.value === 'gdrive') {
        const settings = provider.getSettings()
        oauthEmail.value = settings?.email || ''
        formSettings.value = {}
      } else {
        oauthEmail.value = ''
        const settings = provider.getSettings()
        if (settings) {
          formSettings.value = { ...settings }
        } else {
          const defaults = {}
          provider.getSettingsFields().forEach(f => {
            if (f.type === 'checkbox') defaults[f.key] = false
            else if (f.type === 'oauth-button') { /* skip */ }
            else defaults[f.key] = ''
          })
          if (selectedProvider.value === 'webdav') {
            defaults.proxyUrl = 'http://localhost:3001'
          }
          formSettings.value = defaults
        }
      }
    }

    function switchToWebDAV() {
      selectedProvider.value = 'webdav'
      status.value = null
      loadProviderSettings()
    }

    function switchToGoogle() {
      selectedProvider.value = 'gdrive'
      status.value = null
      loadProviderSettings()
    }

    async function signInWithGoogle() {
      signingIn.value = true
      status.value = null
      try {
        const settings = await startOAuthFlow()
        oauthEmail.value = settings.email || ''
        setActiveProviderId('gdrive')
        status.value = { type: 'success', message: `Connected as ${settings.email || 'Google account'}. Syncing\u2026` }
        setTimeout(() => {
          emit('saved')
          emit('close')
          status.value = null
        }, 1500)
      } catch (error) {
        if (error.message !== 'Sign-in window was closed') {
          status.value = { type: 'error', message: error.message }
        }
      } finally {
        signingIn.value = false
      }
    }

    function confirmDisconnect() {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Disconnect Google Drive? Your verses stay on this device, but they won\u2019t sync to Google Drive or your other devices anymore.')
        : true
      if (!ok) return
      const provider = getProvider('gdrive')
      if (provider) {
        provider.clearSettings()
        setActiveProviderId(null)
        oauthEmail.value = ''
        status.value = null
        emit('saved')
      }
    }

    async function testConnection() {
      testingConnection.value = true
      status.value = null

      try {
        const provider = getProvider(selectedProvider.value)
        const settings = selectedProvider.value === 'gdrive'
          ? provider.getSettings()
          : formSettings.value
        const result = await provider.testConnection(settings)

        if (result.success) {
          status.value = { type: 'success', message: 'Connection successful!' }
        } else {
          status.value = { type: 'error', message: `Connection failed: ${result.error || 'Unknown error'}` }
        }
      } catch (error) {
        status.value = { type: 'error', message: `Connection failed: ${error.message || 'Unknown error'}` }
      } finally {
        testingConnection.value = false
      }
    }

    function save() {
      const provider = getProvider(selectedProvider.value)
      if (!provider) return

      if (selectedProvider.value !== 'gdrive') {
        const fields = provider.getSettingsFields()
        const missing = fields.filter(f => f.required && !formSettings.value[f.key])
        if (missing.length) {
          status.value = {
            type: 'error',
            message: `Please fill in all required fields (${missing.map(f => f.label).join(', ')})`
          }
          return
        }

        const settingsToSave = {}
        fields.forEach(f => {
          if (f.type === 'oauth-button') return
          const val = formSettings.value[f.key]
          settingsToSave[f.key] = typeof val === 'string' ? val.trim() : val
        })
        provider.saveSettings(settingsToSave)
      }

      setActiveProviderId(selectedProvider.value)
      status.value = { type: 'success', message: 'Settings saved successfully!' }

      setTimeout(() => {
        emit('saved')
        emit('close')
        status.value = null
      }, 1000)
    }

    function close() {
      status.value = null
      emit('close')
    }

    watch(() => props.show, (val) => {
      if (val) {
        selectedProvider.value = getActiveProviderId() || 'gdrive'
        loadProviderSettings()
        status.value = null
      }
    })

    return {
      providers,
      selectedProvider,
      formSettings,
      currentFields,
      status,
      testingConnection,
      signingIn,
      oauthEmail,
      isDev,
      canTest,
      canSave,
      switchToWebDAV,
      switchToGoogle,
      signInWithGoogle,
      confirmDisconnect,
      testConnection,
      save,
      close
    }
  }
}
</script>
