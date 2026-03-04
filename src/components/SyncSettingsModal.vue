<template>
  <ModalSheet :show="show" title="Sync Settings" data-testid="modal-sync-settings" @close="close">
    <div class="space-y-5">
      <!-- Provider selector -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-3">Sync Provider</label>
        <div class="flex gap-3">
          <button
            v-for="p in providers"
            :key="p.id"
            @click="selectProvider(p.id)"
            class="flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors duration-200"
            :class="selectedProvider === p.id
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
              : 'border-border-input text-text-secondary hover:bg-surface-hover'"
          >
            {{ p.name }}
          </button>
        </div>
      </div>

      <!-- Dynamic fields for selected provider -->
      <template v-if="selectedProvider && currentFields.length">
        <template v-for="field in currentFields" :key="field.key">
          <!-- Skip dev-only fields in production -->
          <template v-if="!field.devOnly || isDev">
            <!-- Skip fields with showIf that returns false -->
            <template v-if="!field.showIf || field.showIf(formSettings)">

              <!-- OAuth button (Google Drive) -->
              <div v-if="field.type === 'oauth-button'" class="space-y-3">
                <label class="block text-sm font-medium text-text-secondary">{{ field.label }}</label>

                <!-- Connected state -->
                <div v-if="oauthEmail" class="flex items-center justify-between p-3 rounded-xl bg-status-success-bg border border-status-success-border">
                  <div>
                    <p class="text-sm font-medium text-status-success-text">Connected</p>
                    <p class="text-xs text-status-success-text opacity-80">{{ oauthEmail }}</p>
                  </div>
                  <button
                    @click="disconnectOAuth"
                    class="text-xs px-3 py-1.5 rounded-lg border border-status-error-border text-status-error-text hover:bg-status-error-bg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                <!-- Not connected -->
                <div v-else>
                  <button
                    @click="signInWithGoogle"
                    :disabled="signingIn"
                    class="w-full px-4 py-3 rounded-xl border border-border-input text-text-primary font-medium hover:bg-surface-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg v-if="!signingIn" class="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {{ signingIn ? 'Signing in...' : 'Sign in with Google' }}
                  </button>
                  <p v-if="field.hint" class="text-xs text-text-muted mt-2">{{ field.hint }}</p>
                </div>
              </div>

              <!-- Checkbox field -->
              <div v-else-if="field.type === 'checkbox'" class="flex items-center space-x-2">
                <input
                  :id="`sync-field-${field.key}`"
                  v-model="formSettings[field.key]"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label :for="`sync-field-${field.key}`" class="text-sm font-medium text-text-secondary">
                  {{ field.label }}
                </label>
              </div>

              <!-- Text/URL/Password field -->
              <div v-else>
                <label :for="`sync-field-${field.key}`" class="block text-sm font-medium text-text-secondary mb-2">
                  {{ field.label }}
                </label>
                <input
                  :id="`sync-field-${field.key}`"
                  v-model="formSettings[field.key]"
                  :type="field.type"
                  :placeholder="field.placeholder || ''"
                  class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-overlay text-text-primary"
                />
                <p v-if="field.hint" class="text-xs text-text-muted mt-1">{{ field.hint }}</p>
              </div>
            </template>
          </template>
        </template>
      </template>

      <!-- Dev CORS note for WebDAV -->
      <div v-if="isDev && selectedProvider === 'webdav'" class="bg-status-info-bg border border-status-info-border rounded-lg p-4">
        <p class="text-sm text-status-info-text">
          <strong>Note:</strong> If you see a "CORS Error", enable the CORS proxy option above and run the proxy server.
        </p>
      </div>

      <!-- Dev proxy setup hint -->
      <div v-if="isDev && selectedProvider === 'webdav' && formSettings.useProxy" class="bg-status-warn-bg border border-status-warn-border rounded-lg p-3">
        <p class="text-xs text-status-warn-text">
          <strong>Setup:</strong> Run the proxy server with:<br/>
          <code class="bg-status-warn-bg px-2 py-1 rounded">NEXTCLOUD_URL={{ formSettings.url || 'YOUR_NEXTCLOUD_URL' }} npm run dev:proxy</code><br/>
          Or use <code class="bg-status-warn-bg px-2 py-1 rounded">npm run dev:all</code> to run both the app and proxy together.
        </p>
      </div>

      <!-- Status message -->
      <div v-if="status" class="p-3 rounded-lg" :class="status.type === 'success' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-error-bg text-status-error-text'">
        <p class="text-sm whitespace-pre-line">{{ status.message }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center">
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
    const selectedProvider = ref(getActiveProviderId() || 'webdav')
    const formSettings = ref({})
    const status = ref(null)
    const testingConnection = ref(false)
    const signingIn = ref(false)
    const oauthEmail = ref('')

    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    const currentFields = computed(() => {
      const provider = getProvider(selectedProvider.value)
      return provider ? provider.getSettingsFields() : []
    })

    const canTest = computed(() => {
      if (!selectedProvider.value) return false
      const provider = getProvider(selectedProvider.value)
      if (!provider) return false

      if (selectedProvider.value === 'gdrive') {
        return provider.isConfigured()
      }

      // For WebDAV, check required fields
      const fields = provider.getSettingsFields()
      return fields.filter(f => f.required).every(f => formSettings.value[f.key])
    })

    const canSave = computed(() => {
      if (!selectedProvider.value) return false
      const provider = getProvider(selectedProvider.value)
      if (!provider) return false

      if (selectedProvider.value === 'gdrive') {
        return provider.isConfigured()
      }

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
          // Initialize defaults
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

    function selectProvider(id) {
      selectedProvider.value = id
      status.value = null
      loadProviderSettings()
    }

    async function signInWithGoogle() {
      signingIn.value = true
      status.value = null
      try {
        const settings = await startOAuthFlow()
        oauthEmail.value = settings.email || ''
        status.value = { type: 'success', message: 'Connected to Google Drive!' }
      } catch (error) {
        if (error.message !== 'Sign-in window was closed') {
          status.value = { type: 'error', message: error.message }
        }
      } finally {
        signingIn.value = false
      }
    }

    function disconnectOAuth() {
      const provider = getProvider('gdrive')
      if (provider) {
        provider.clearSettings()
        oauthEmail.value = ''
        status.value = null
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

      // For non-OAuth providers, validate and save settings
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

        // Clean settings before saving
        const settingsToSave = {}
        fields.forEach(f => {
          if (f.type === 'oauth-button') return
          const val = formSettings.value[f.key]
          settingsToSave[f.key] = typeof val === 'string' ? val.trim() : val
        })
        provider.saveSettings(settingsToSave)
      }

      // Google Drive settings are already saved during OAuth flow

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

    // Load settings when modal opens
    watch(() => props.show, (val) => {
      if (val) {
        selectedProvider.value = getActiveProviderId() || 'webdav'
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
      selectProvider,
      signInWithGoogle,
      disconnectOAuth,
      testConnection,
      save,
      close
    }
  }
}
</script>
