<script setup lang="ts">
const props = withDefaults(defineProps<{
  type?: 'success' | 'info' | 'warning' | 'error'
}>(), {
  type: 'info'
})
</script>

<template>
  <div class="alert-message" :class="`alert-${props.type}`" role="alert">
    <slot />
  </div>
</template>
