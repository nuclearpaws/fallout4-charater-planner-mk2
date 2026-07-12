import { computed, onMounted, ref, type Ref } from 'vue'
import { emptyBuild, type Build } from '~/utils/planner'
import { cloneBuild, normalizeBuild, type LegacySavedBuild, type SavedBuild } from '~/utils/build-validation'

const storageKey = 'fallout-4-planner-builds'

export function useSavedBuilds(build: Ref<Build>) {
  const savedBuilds = ref<SavedBuild[]>([])
  const selectedSavedId = ref('')
  const activeSavedBuildId = ref<string | null>(null)
  const saveStatus = ref<{ message: string; error: boolean } | null>(null)
  const savedSnapshot = ref(JSON.stringify(emptyBuild()))

  const isDirty = computed(() => JSON.stringify(build.value) !== savedSnapshot.value)
  const activeSavedBuild = computed(() => savedBuilds.value.find((item) => item.id === activeSavedBuildId.value) ?? null)

  function persistSavedBuilds(nextSavedBuilds: SavedBuild[]) {
    localStorage.setItem(storageKey, JSON.stringify(nextSavedBuilds))
    savedBuilds.value = nextSavedBuilds
  }

  function saveBuild(asNew = false) {
    try {
      const snapshot = cloneBuild(build.value)
      const now = new Date().toISOString()
      const existingIndex = asNew ? -1 : savedBuilds.value.findIndex((item) => item.id === activeSavedBuildId.value)
      let nextSavedBuilds: SavedBuild[]
      let saved: SavedBuild
      if (existingIndex >= 0) {
        saved = { ...savedBuilds.value[existingIndex], updatedAt: now, build: snapshot }
        nextSavedBuilds = [...savedBuilds.value]
        nextSavedBuilds[existingIndex] = saved
      } else {
        saved = { id: buildId(), createdAt: now, updatedAt: now, build: snapshot }
        nextSavedBuilds = [saved, ...savedBuilds.value]
      }
      persistSavedBuilds(nextSavedBuilds)
      activeSavedBuildId.value = saved.id
      selectedSavedId.value = saved.id
      savedSnapshot.value = JSON.stringify(snapshot)
      saveStatus.value = { message: existingIndex >= 0 ? `Updated ${saved.build.name || 'build'}.` : `Saved ${saved.build.name || 'build'} locally.`, error: false }
      return true
    } catch {
      saveStatus.value = { message: 'Could not save locally. Check browser storage permissions.', error: true }
      return false
    }
  }

  function loadBuild(item: SavedBuild) {
    const normalized = normalizeBuild(item.build)
    if (!normalized) {
      saveStatus.value = { message: 'That local build is invalid and cannot be loaded.', error: true }
      return
    }
    build.value = normalized
    activeSavedBuildId.value = item.id
    selectedSavedId.value = item.id
    savedSnapshot.value = JSON.stringify(item.build)
    saveStatus.value = { message: `Loaded ${item.build.name || 'build'}.`, error: false }
  }

  function startNewBuild() {
    build.value = emptyBuild()
    activeSavedBuildId.value = null
    selectedSavedId.value = ''
    savedSnapshot.value = JSON.stringify(build.value)
    saveStatus.value = { message: 'Started a new unsaved build.', error: false }
  }

  function deleteBuild(id: string) {
    try {
      persistSavedBuilds(savedBuilds.value.filter((item) => item.id !== id))
      if (activeSavedBuildId.value === id) startNewBuild()
      else if (selectedSavedId.value === id) selectedSavedId.value = activeSavedBuildId.value ?? ''
      saveStatus.value = { message: 'Deleted the local build.', error: false }
    } catch {
      saveStatus.value = { message: 'Could not delete the local build. Check browser storage permissions.', error: true }
    }
  }

  function markImportedBuild() {
    activeSavedBuildId.value = null
    selectedSavedId.value = ''
    savedSnapshot.value = ''
    saveStatus.value = { message: 'Loaded build from JSON. Save it locally to keep it.', error: false }
  }

  function loadSavedBuilds() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as LegacySavedBuild[]
      if (Array.isArray(stored)) {
        const migrated = stored.flatMap((item) => {
          const build = normalizeBuild(item?.build)
          if (!item?.id || !build) return []
          return [{
            id: item.id,
            createdAt: item.createdAt ?? item.savedAt ?? new Date().toISOString(),
            updatedAt: item.updatedAt ?? item.savedAt ?? item.createdAt ?? new Date().toISOString(),
            build
          }]
        })
        savedBuilds.value = migrated
        if (JSON.stringify(stored) !== JSON.stringify(migrated)) persistSavedBuilds(migrated)
      }
    } catch {
      localStorage.removeItem(storageKey)
      saveStatus.value = { message: 'Saved builds could not be read and were cleared.', error: true }
    }
  }

  onMounted(loadSavedBuilds)

  return {
    savedBuilds,
    selectedSavedId,
    activeSavedBuildId,
    activeSavedBuild,
    saveStatus,
    savedSnapshot,
    isDirty,
    saveBuild,
    loadBuild,
    startNewBuild,
    deleteBuild,
    markImportedBuild
  }
}

function buildId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
