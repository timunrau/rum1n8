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
      const byId = new Map(this.collections.map((collection) => [collection.id, collection]))
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      })

      return this.collections
        .map((collection) => {
          const parent = collection.parentId ? byId.get(collection.parentId) : null
          const displayName = parent
            ? `${parent.name} / ${collection.name}`
            : collection.name

          return {
            ...collection,
            displayName,
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
      const parentByChild = new Map(
        this.collections
          .filter((item) => item.parentId)
          .map((item) => [item.id, item.parentId])
      )
      const childrenByParent = new Map()

      for (const collection of this.collections) {
        if (!collection.parentId) continue
        const children = childrenByParent.get(collection.parentId) || []
        children.push(collection.id)
        childrenByParent.set(collection.parentId, children)
      }

      return (collectionIds || []).reduce((selected, id) => {
        const parentId = parentByChild.get(id)
        const childIds = childrenByParent.get(id) || []
        let next = selected.filter((value) => value !== id)

        if (parentId) {
          next = next.filter((value) => value !== parentId)
        } else if (childIds.length > 0) {
          next = next.filter((value) => !childIds.includes(value))
        }

        return [...next, id]
      }, [])
    },
    toggle(id) {
      const childIds = new Set(
        this.collections
          .filter((item) => item.parentId === id)
          .map((item) => item.id)
      )

      let updated = this.selectedCollectionIds.filter((value) => value !== id)

      if (!this.isSelected(id)) {
        const collection = this.collections.find((item) => item.id === id)
        if (collection?.parentId) {
          updated = updated.filter((value) => value !== collection.parentId)
        } else if (childIds.size > 0) {
          updated = updated.filter((value) => !childIds.has(value))
        }
        updated = [...updated, id]
      }

      this.$emit('update:modelValue', updated)
    },
  },
}
</script>
