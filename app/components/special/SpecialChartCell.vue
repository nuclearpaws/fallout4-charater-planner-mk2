<script setup lang="ts">
withDefaults(defineProps<{
  as?: 'article' | 'div'
  title: string
  subtext?: string
  imageSrc: string
  imageAlt: string
}>(), { as: 'article', subtext: '' })
</script>

<template>
  <component :is="as" class="special-chart-cell-shell">
    <img :src="imageSrc" :alt="imageAlt">
    <div class="special-chart-cell-overlay">
      <div class="special-chart-cell-title">
        <span>{{ title }}</span>
        <slot name="title-action" />
      </div>
      <span v-if="subtext" class="special-chart-cell-subtext">{{ subtext }}</span>
      <slot name="controls" />
    </div>
    <slot />
  </component>
</template>
