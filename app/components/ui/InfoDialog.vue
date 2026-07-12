<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="info-dialog-backdrop" role="presentation" @click.self="emit('close')">
    <section class="info-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${title}-dialog-title`" tabindex="-1" @keydown.esc="emit('close')">
      <header>
        <div>
          <h2 :id="`${title}-dialog-title`">{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <button aria-label="Close dialog" @click="emit('close')">×</button>
      </header>
      <div class="info-dialog-body">
        <slot />
      </div>
    </section>
  </div>
</template>
