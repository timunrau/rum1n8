<template>
  <div>
    <label class="block text-sm font-medium text-text-secondary mb-2">
      {{ label }}
    </label>
    <div v-if="collections.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="collection in collections"
        :key="collection.id"
        type="button"
        @click="toggle(collection.id)"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150"
        :class="isSelected(collection.id)
          ? 'bg-blue-600 text-white border border-blue-600'
          : 'bg-transparent text-text-secondary border border-border-input hover:bg-surface-hover'"
      >
        {{ collection.name }}
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
  methods: {
    isSelected(id) {
      return this.modelValue.includes(id)
    },
    toggle(id) {
      const updated = this.isSelected(id)
        ? this.modelValue.filter((v) => v !== id)
        : [...this.modelValue, id]
      this.$emit('update:modelValue', updated)
    },
  },
}
</script>
