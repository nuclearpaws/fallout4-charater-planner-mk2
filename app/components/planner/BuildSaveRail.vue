<script setup lang="ts">
import type { SavedBuild } from '~/utils/build-validation'

defineProps<{
  activeSavedBuild: SavedBuild | null
  savedBuilds: SavedBuild[]
  isDirty: boolean
  saveStatus: { message: string; error: boolean } | null
  importError: string
}>()

const emit = defineEmits<{
  save: []
  saveAsNew: []
  newBuild: []
  deleteBuild: [id: string]
  exportJson: []
  importJson: [event: Event]
  loadBuild: [id: string]
}>()
</script>

<template>
  <aside class="build-rail">
    <section class="build-rail-top" aria-label="Current build controls">
      <span class="current-build">
        <b>{{ activeSavedBuild?.build.name || 'New unsaved build' }}</b>
        <small :class="{ dirty: isDirty }">{{ isDirty ? 'Unsaved changes' : activeSavedBuild ? `Saved ${new Date(activeSavedBuild.updatedAt).toLocaleTimeString()}` : 'Not saved locally' }}</small>
      </span>
      <button class="primary" :disabled="Boolean(activeSavedBuild) && !isDirty" @click="emit('save')">{{ activeSavedBuild ? 'Save changes' : 'Save locally' }}</button>
      <button @click="emit('saveAsNew')">Save as new</button>
      <button @click="emit('newBuild')">New build</button>
      <p v-if="saveStatus" class="save-status" :class="{ error: saveStatus.error }">{{ saveStatus.message }}</p>
    </section>

    <section class="saved-build-list" aria-label="Local builds">
      <h2>Local builds</h2>
      <ul v-if="savedBuilds.length">
        <li v-for="item in savedBuilds" :key="item.id" :class="{ active: activeSavedBuild?.id === item.id }">
          <button class="saved-build-link" @click="emit('loadBuild', item.id)">
            <b>{{ item.build.name || 'Untitled build' }}</b>
            <small>Updated {{ new Date(item.updatedAt).toLocaleString() }}</small>
          </button>
          <button class="icon-button danger-icon" :aria-label="`Delete ${item.build.name || 'Untitled build'}`" @click="emit('deleteBuild', item.id)">×</button>
        </li>
      </ul>
      <p v-else class="empty">No saved builds yet.</p>
    </section>

    <section class="build-rail-bottom" aria-label="Build import and export controls">
      <button @click="emit('exportJson')">Download JSON</button>
      <label class="file-button">Upload JSON<input type="file" accept="application/json" @change="emit('importJson', $event)"></label>
      <p v-if="importError" class="error">{{ importError }}</p>
    </section>
  </aside>
</template>
