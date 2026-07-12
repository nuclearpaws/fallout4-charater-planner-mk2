<script setup lang="ts">
import type { SavedBuild } from '~/utils/build-validation'

defineProps<{ confirmationKind: 'unsaved' | 'delete' | null; activeSavedBuild: SavedBuild | null; deleteBuild: SavedBuild | null }>()
const emit = defineEmits<{ save: []; discard: []; cancel: [] }>()
</script>

<template>
  <div v-if="confirmationKind" class="confirmation-backdrop" role="presentation">
    <section class="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <template v-if="confirmationKind === 'unsaved'"><h2 id="confirmation-title">Save changes first?</h2><p>Your current build has unsaved changes. Save them before continuing, discard them, or cancel this action.</p><div><button class="primary" @click="emit('save')">Save changes</button><button @click="emit('discard')">Discard changes</button><button @click="emit('cancel')">Cancel</button></div></template>
      <template v-else><h2 id="confirmation-title">Delete local build?</h2><p><b>{{ deleteBuild?.build.name || activeSavedBuild?.build.name || 'This build' }}</b> will be permanently removed from this browser. This cannot be undone.</p><div><button class="danger-button" @click="emit('discard')">Delete build</button><button @click="emit('cancel')">Cancel</button></div></template>
    </section>
  </div>
</template>
