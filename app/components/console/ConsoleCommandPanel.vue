<script setup lang="ts">
import AlertMessage from '~/components/ui/AlertMessage.vue'
import type { Dlc } from '~/data/catalog'

defineProps<{
  commands: string
  error: string
  hasLoadOrderPlaceholders: boolean
  dlcs: Dlc[]
  loadOrder: Record<string, string>
}>()

const emit = defineEmits<{ updateLoadOrder: [dlc: string, value: string] }>()
</script>

<template>
  <section class="tab-panel console-panel">
    <div class="panel-heading"><div><h2>Console setup</h2><p>Preview a Fallout 4 console batch for setting this character's level, SPECIAL values, and selected perk ranks.</p></div></div>
    <AlertMessage v-if="hasLoadOrderPlaceholders" type="warning">Some DLC perk IDs contain <code>xx</code>. Replace <code>xx</code> with that DLC's load-order index before running the command.</AlertMessage>
    <AlertMessage v-if="error" type="error">{{ error }}</AlertMessage>
    <div class="console-workspace">
      <section class="console-config">
        <h2>DLC load order</h2>
        <p class="hint">Defaults match the usual DLC order. Change these if your plugin order differs.</p>
        <label v-for="dlc in dlcs" :key="dlc.name">{{ dlc.name }}<input :value="loadOrder[dlc.name]" maxlength="2" spellcheck="false" @input="emit('updateLoadOrder', dlc.name, ($event.target as HTMLInputElement).value)"></label>
      </section>
      <section class="console-preview">
        <h2>Command preview</h2>
        <textarea v-if="!error" class="console-command-preview" :value="commands" readonly spellcheck="false" aria-label="Console command preview"></textarea>
      </section>
    </div>
  </section>
</template>
