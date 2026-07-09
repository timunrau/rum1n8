<template>
  <div>
    <label class="block text-sm font-medium text-text-secondary mb-2">
      {{ label }}
    </label>
    <div v-if="collections.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="collection in displayCollections"
        :key="collection.id"
        type="button"
        @click="toggle(collection.id)"
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
        :class="isSelected(collection.id)
          ? 'bg-action text-action-text border border-action-border'
          : 'bg-transparent text-text-secondary border border-border-input hover:bg-surface-hover'"
      >
        {{ collection.displayName }}
      </button>
    </div>
    <p v-else class="text-sm text-text-muted">No collections yet. Create one to organize verses.</p>
  </div>
</template>

<script>
import {
  getCollectionAncestors,
  getCollectionPath,
  getDescendantCollections,
  normalizeVerseCollectionIds,
} from '../utils/collections.js'

export default {
  name: 'CollectionPicker',
  props: {
    collections: {
      type: Array,
      required: true,
    },
    modelValue: {
      type: Array,
      default: () => [],
    },
    label: {
      type: String,
      default: 'Collections',
    },
  },
  emits: ['update:modelValue'],
  computed: {
    selectedCollectionIds() {
      return this.normalizeSelection(this.modelValue)
    },
    displayCollections() {
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      })

      return this.collections
        .map((collection) => {
          return {
            ...collection,
            displayName: getCollectionPath(this.collections, collection.id),
          }
        })
        .sort((a, b) => {
          const nameComparison = collator.compare(a.displayName || '', b.displayName || '')
          if (nameComparison !== 0) return nameComparison

          return String(a.id || '').localeCompare(String(b.id || ''))
        })
    },
  },
  methods: {
    isSelected(id) {
      return this.selectedCollectionIds.includes(id)
    },
    normalizeSelection(collectionIds) {
      return normalizeVerseCollectionIds(this.collections, collectionIds)
    },
    toggle(id) {
      let updated = this.selectedCollectionIds.filter((value) => value !== id)

      if (!this.isSelected(id)) {
        const conflictingIds = new Set([
          ...getCollectionAncestors(this.collections, id).map(collection => String(collection.id)),
          ...getDescendantCollections(this.collections, id).map(collection => String(collection.id)),
        ])
        updated = updated.filter(value => !conflictingIds.has(String(value)))
        updated = this.normalizeSelection([...updated, id])
      }

      this.$emit('update:modelValue', updated)
    },
  },
}
</script>
