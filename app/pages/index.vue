<script setup lang="ts">
import BuildPlanPanel from '~/components/build-plan/BuildPlanPanel.vue'
import CharacterRecordPanel from '~/components/character/CharacterRecordPanel.vue'
import ConsoleCommandPanel from '~/components/console/ConsoleCommandPanel.vue'
import BuildSaveRail from '~/components/planner/BuildSaveRail.vue'
import ConfirmBuildActionDialog from '~/components/planner/ConfirmBuildActionDialog.vue'
import PlannerTabs from '~/components/planner/PlannerTabs.vue'
import SpecialPerkPanel from '~/components/special/SpecialPerkPanel.vue'
import PlayerStatsPanel from '~/components/stats/PlayerStatsPanel.vue'
import AlertMessage from '~/components/ui/AlertMessage.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBuildExport } from '~/composables/useBuildExport'
import { useSavedBuilds } from '~/composables/useSavedBuilds'
import { dlcs, perks, voicedNames, type Perk, type Stat } from '~/data/catalog'
import { decodeBuildHash, encodeBuildHash } from '~/utils/build-url'
import { toConsoleCommands } from '~/utils/console-commands'
import { emptyBuild, finalPlannedLevel, initialPointBudget, normalizePriority, optimize, spentPoints, visiblePerks, type Build } from '~/utils/planner'
import { cloneBuild } from '~/utils/build-validation'

type PendingAction = { type: 'load'; id: string } | { type: 'new' } | { type: 'delete'; id: string } | { type: 'import'; build: Build }

const build = ref<Build>(emptyBuild())
const search = ref('')
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragOverEnd = ref(false)
const selectionStatus = ref('')
const expandedPerkId = ref<string | null>(null)
const activeTab = ref<'character' | 'perks' | 'plan' | 'stats' | 'console'>('character')
const dlcLoadOrder = ref(Object.fromEntries(dlcs.map((dlc) => [dlc.name, dlc.id])) as Record<string, string>)
const pendingAction = ref<PendingAction | null>(null)
const confirmationKind = ref<'unsaved' | 'delete' | null>(null)

const {
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
} = useSavedBuilds(build)

const { importError, exportJson, exportMarkdown, importJson } = useBuildExport(build, (importedBuild) => requestAction({ type: 'import', build: importedBuild }))

const pointsLeft = computed(() => initialPointBudget - spentPoints(build.value))
const nameIsVoiced = computed(() => voicedNames.has(build.value.characterName.trim().toLocaleLowerCase()))
const filteredPerks = computed(() => perks.filter((perk) => {
  const matchesSearch = perk.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
  return matchesSearch && (!perk.gender || perk.gender === build.value.gender)
}))
const chartPerks = computed(() => filteredPerks.value.filter((perk) => perk.ranks.some((rank) => rank.dlc === 'Fallout 4')))
const expansionPerks = computed(() => filteredPerks.value.filter((perk) => !perk.ranks.some((rank) => rank.dlc === 'Fallout 4')))
const prioritizedPerks = computed(() => {
  const ids = normalizePriority(build.value, perks)
  const allowed = new Set(visiblePerks(perks, build.value.gender).map((perk) => perk.id))
  return ids.map((id) => perks.find((perk) => perk.id === id)!).filter((perk) => perk && allowed.has(perk.id))
})
const planResult = computed(() => {
  try {
    return { actions: optimize(build.value, perks), error: '' }
  } catch {
    return { actions: [], error: 'This build has invalid perk data. Load it again or remove and reselect the affected perk.' }
  }
})
const plan = computed(() => planResult.value.actions)
const planError = computed(() => planResult.value.error)
const plannedLevelUpCount = computed(() => Object.values(build.value.selectedRanks).reduce((total, rank) => total + rank, 0) + plan.value.filter((item) => item.type === 'stat').length)
const availableLevelUpCount = computed(() => Math.max(0, build.value.targetLevel - 1))
const bobbleheadRequirements = computed(() => new Set(plan.value.filter((item) => item.type === 'bobblehead').flatMap((item) => item.perkId ? [item.perkId] : [])))
const bookRequirements = computed(() => new Set(plan.value.filter((item) => item.type === 'book').flatMap((item) => item.perkId ? [item.perkId] : [])))
const unfilledLevelCount = computed(() => plan.value.filter((item) => item.type === 'empty').length)
const consoleCommandPreview = computed(() => {
  try {
    return { ...toConsoleCommands(build.value, perks, dlcLoadOrder.value), error: '' }
  } catch {
    return { commands: '', hasLoadOrderPlaceholders: false, error: 'Console commands could not be generated for this build.' }
  }
})
const pendingDeleteBuild = computed(() => {
  const action = pendingAction.value
  return action?.type === 'delete' ? savedBuilds.value.find((item) => item.id === action.id) ?? null : null
})

function changeStat(stat: Stat, direction: number, event?: MouseEvent) {
  const value = build.value.stats[stat]
  if (event?.ctrlKey) {
    build.value.stats[stat] = direction > 0 ? Math.min(10, value + pointsLeft.value) : 1
    return
  }
  if (direction > 0 && (value >= 10 || pointsLeft.value <= 0)) return
  if (direction < 0 && value <= 1) return
  build.value.stats[stat] += direction
}

function updateDlcLoadOrder(dlc: string, value: string) {
  dlcLoadOrder.value = { ...dlcLoadOrder.value, [dlc]: value.trim().slice(0, 2) }
}

function loadBuildFromUrlHash() {
  const urlBuild = decodeBuildHash(location.hash)
  if (!urlBuild) return false
  build.value = urlBuild
  activeSavedBuildId.value = null
  selectedSavedId.value = ''
  savedSnapshot.value = ''
  saveStatus.value = { message: 'Loaded build from URL.', error: false }
  return true
}

function syncBuildToUrlHash() {
  const nextHash = encodeBuildHash(build.value)
  if (location.hash.slice(1) === nextHash) return
  history.replaceState(null, '', `${location.pathname}${location.search}#${nextHash}`)
}

function setStat(stat: Stat, event: Event) {
  const input = event.target as HTMLInputElement
  const current = build.value.stats[stat]
  const requested = Math.min(10, Math.max(1, Math.floor(Number(input.value))))
  const next = Number.isFinite(requested) ? Math.min(requested, current + pointsLeft.value) : current
  build.value.stats[stat] = next
  input.value = String(next)
}

function changeRank(perk: Perk, direction: number) {
  const current = build.value.selectedRanks[perk.id] ?? 0
  setRank(perk, current + direction)
}

function setRank(perk: Perk, rank: number) {
  const current = build.value.selectedRanks[perk.id] ?? 0
  const next = Math.max(0, Math.min(perk.ranks.length, rank))
  if (next > current) {
    const candidate = cloneBuild(build.value)
    candidate.selectedRanks[perk.id] = next
    if (!candidate.priority.includes(perk.id)) candidate.priority.push(perk.id)
    try {
      const finalLevel = finalPlannedLevel(candidate, perks)
      if (finalLevel > candidate.targetLevel) {
        selectionStatus.value = `Cannot select ${perk.name} rank ${next}: this route reaches level ${finalLevel}, above your target level ${candidate.targetLevel}.`
        return
      }
    } catch {
      selectionStatus.value = `Cannot select ${perk.name}: its route could not be scheduled.`
      return
    }
  }
  if (next === 0) {
    delete build.value.selectedRanks[perk.id]
    build.value.priority = build.value.priority.filter((id) => id !== perk.id)
  } else {
    build.value.selectedRanks[perk.id] = next
    if (!build.value.priority.includes(perk.id)) build.value.priority.push(perk.id)
  }
  selectionStatus.value = ''
}

function updateTargetLevel(event: Event) {
  const requested = Number((event.target as HTMLInputElement).value)
  build.value.targetLevel = Number.isFinite(requested) ? Math.min(999, Math.max(1, Math.floor(requested))) : 60
}

function movePriority(id: string, direction: number) {
  const index = build.value.priority.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= build.value.priority.length) return
  const reordered = [...build.value.priority]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  build.value.priority = reordered
}

function startPriorityDrag(id: string, event: DragEvent) {
  draggedId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function setPriorityDropTarget(id: string) {
  if (draggedId.value && draggedId.value !== id) {
    dragOverId.value = id
    dragOverEnd.value = false
  }
}

function setPriorityDropEnd() {
  if (draggedId.value) {
    dragOverId.value = null
    dragOverEnd.value = true
  }
}

function endPriorityDrag() {
  draggedId.value = null
  dragOverId.value = null
  dragOverEnd.value = false
}

function dropPriority(targetId: string) {
  const sourceId = draggedId.value
  if (!sourceId || sourceId === targetId) {
    endPriorityDrag()
    return
  }
  const order = build.value.priority.filter((id) => id !== sourceId)
  order.splice(order.indexOf(targetId), 0, sourceId)
  build.value.priority = order
  endPriorityDrag()
}

function dropPriorityAtEnd() {
  const sourceId = draggedId.value
  if (!sourceId) return endPriorityDrag()
  const order = build.value.priority.filter((id) => id !== sourceId)
  order.push(sourceId)
  build.value.priority = order
  endPriorityDrag()
}

function requestLoadBuild(id: string) {
  selectedSavedId.value = id
  const saved = savedBuilds.value.find((item) => item.id === selectedSavedId.value)
  if (!saved || saved.id === activeSavedBuild.value?.id) return
  requestAction({ type: 'load', id: saved.id })
}

function requestAction(action: PendingAction) {
  if (action.type === 'delete') {
    pendingAction.value = action
    confirmationKind.value = 'delete'
  } else if (isDirty.value) {
    pendingAction.value = action
    confirmationKind.value = 'unsaved'
  } else {
    performAction(action)
  }
}

function performAction(action: PendingAction) {
  if (action.type === 'load') {
    const saved = savedBuilds.value.find((item) => item.id === action.id)
    if (saved) loadBuild(saved)
  }
  if (action.type === 'new') {
    startNewBuild()
    activeTab.value = 'character'
  }
  if (action.type === 'delete') deleteBuild(action.id)
  if (action.type === 'import') {
    build.value = cloneBuild(action.build)
    markImportedBuild()
  }
  pendingAction.value = null
  confirmationKind.value = null
}

function continueAfterSaving() {
  if (saveBuild() && pendingAction.value) performAction(pendingAction.value)
}

function discardAndContinue() {
  if (pendingAction.value) performAction(pendingAction.value)
}

function cancelPendingAction() {
  selectedSavedId.value = activeSavedBuild.value?.id ?? ''
  pendingAction.value = null
  confirmationKind.value = null
}

watch(() => build.value.gender, (gender) => {
  for (const perk of perks) {
    if (perk.gender && perk.gender !== gender) {
      delete build.value.selectedRanks[perk.id]
      build.value.priority = build.value.priority.filter((id) => id !== perk.id)
    }
  }
  if (expandedPerkId.value && !visiblePerks(perks, gender).some((perk) => perk.id === expandedPerkId.value)) expandedPerkId.value = null
})

watch(build, syncBuildToUrlHash, { deep: true })

onMounted(() => {
  loadBuildFromUrlHash()
  syncBuildToUrlHash()
  addEventListener('hashchange', loadBuildFromUrlHash)
})

onBeforeUnmount(() => removeEventListener('hashchange', loadBuildFromUrlHash))
</script>

<template>
  <main>
    <header class="masthead">
      <p class="eyebrow">VAULT-TEC PERSONAL TERMINAL</p>
      <h1>Fallout 4 build planner</h1>
      <p>Set your starting SPECIAL, choose your perks, and receive a legal level-by-level route.</p>
    </header>

    <div class="planner-workspace">
      <BuildSaveRail
        :active-saved-build="activeSavedBuild"
        :saved-builds="savedBuilds"
        :is-dirty="isDirty"
        :save-status="saveStatus"
        :import-error="importError"
        @save="saveBuild()"
        @save-as-new="saveBuild(true)"
        @new-build="requestAction({ type: 'new' })"
        @delete-build="(id) => requestAction({ type: 'delete', id })"
        @export-json="exportJson"
        @import-json="importJson"
        @load-build="requestLoadBuild"
      />

      <section class="planner-content">
        <PlannerTabs v-model:active-tab="activeTab" :selected-perk-count="prioritizedPerks.length" />

        <section v-if="pointsLeft !== 0 || !build.bookStat || unfilledLevelCount" class="global-alerts" aria-label="Build notices">
          <AlertMessage v-if="pointsLeft !== 0" type="error">Starting SPECIAL stats are not fully allocated.</AlertMessage>
          <AlertMessage v-if="!build.bookStat" type="warning">You're SPECIAL book is not assigned to any stat.</AlertMessage>
          <AlertMessage v-if="unfilledLevelCount" type="error">This route has {{ unfilledLevelCount }} unfilled level{{ unfilledLevelCount === 1 ? '' : 's' }}. Add more perk ranks or use those levels for SPECIAL increases.</AlertMessage>
        </section>

        <CharacterRecordPanel v-if="activeTab === 'character'" :build="build" :name-is-voiced="nameIsVoiced" :points-left="pointsLeft" @continue="activeTab = 'perks'" @update-target-level="updateTargetLevel" @change-stat="changeStat" @set-stat="setStat" />

        <SpecialPerkPanel
          v-if="activeTab === 'perks'"
          v-model:search="search"
          v-model:expanded-perk-id="expandedPerkId"
          :build="build"
          :chart-perks="chartPerks"
          :expansion-perks="expansionPerks"
          :points-left="pointsLeft"
          :planned-final-level="plannedLevelUpCount"
          :available-level-ups="availableLevelUpCount"
          :selected-perk-count="prioritizedPerks.length"
          :selection-status="selectionStatus"
          @change-stat="changeStat"
          @change-rank="changeRank"
          @set-rank="setRank"
        />

        <BuildPlanPanel
          v-if="activeTab === 'plan'"
          :prioritized-perks="prioritizedPerks"
          :bobblehead-requirements="bobbleheadRequirements"
          :book-requirements="bookRequirements"
          :plan="plan"
          :plan-error="planError"
          :dragged-id="draggedId"
          :drag-over-id="dragOverId"
          :drag-over-end="dragOverEnd"
          @export-markdown="exportMarkdown"
          @move-priority="movePriority"
          @start-priority-drag="startPriorityDrag"
          @set-priority-drop-target="setPriorityDropTarget"
          @set-priority-drop-end="setPriorityDropEnd"
          @drop-priority="dropPriority"
          @drop-priority-at-end="dropPriorityAtEnd"
          @end-priority-drag="endPriorityDrag"
        />

        <PlayerStatsPanel v-if="activeTab === 'stats'" :build="build" />

        <ConsoleCommandPanel
          v-if="activeTab === 'console'"
          :commands="consoleCommandPreview.commands"
          :error="consoleCommandPreview.error"
          :has-load-order-placeholders="consoleCommandPreview.hasLoadOrderPlaceholders"
          :dlcs="dlcs"
          :load-order="dlcLoadOrder"
          @update-load-order="updateDlcLoadOrder"
        />
      </section>
    </div>

    <ConfirmBuildActionDialog :confirmation-kind="confirmationKind" :active-saved-build="activeSavedBuild" :delete-build="pendingDeleteBuild" @save="continueAfterSaving" @discard="discardAndContinue" @cancel="cancelPendingAction" />
  </main>
</template>
