<script setup lang="ts">
import { perks, stats, voicedNames, type Perk, type Stat } from '~/data/catalog'
import { emptyBuild, effectiveStat, finalPlannedLevel, initialPointBudget, normalizePriority, optimize, spentPoints, toMarkdown, visiblePerks, type Build } from '~/utils/planner'

interface SavedBuild { id: string; createdAt: string; updatedAt: string; build: Build }
interface LegacySavedBuild { id: string; savedAt?: string; createdAt?: string; updatedAt?: string; build: Build }
type PendingAction = { type: 'load'; id: string } | { type: 'new' } | { type: 'delete' } | { type: 'import'; build: Build }
const storageKey = 'fallout-4-planner-builds'
const build = ref<Build>(emptyBuild())
const savedBuilds = ref<SavedBuild[]>([])
const search = ref('')
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragOverEnd = ref(false)
const importError = ref('')
const selectionStatus = ref('')
const expandedPerkId = ref<string | null>(null)
const activeTab = ref<'character' | 'perks' | 'plan'>('character')
const selectedSavedId = ref('')
const activeSavedBuildId = ref<string | null>(null)
const saveStatus = ref<{ message: string; error: boolean } | null>(null)
const savedSnapshot = ref(JSON.stringify(emptyBuild()))
const pendingAction = ref<PendingAction | null>(null)
const confirmationKind = ref<'unsaved' | 'delete' | null>(null)
const tiers = Array.from({ length: 10 }, (_, index) => index + 1)
const statColumns = Object.fromEntries(stats.map((stat, index) => [stat, index + 1])) as Record<Stat, number>
const perksById = new Map(perks.map((perk) => [perk.id, perk]))
const iconNameOverrides: Record<string, string> = {
  Rifleman: 'RifleMan',
  Pickpocket: 'PickPocket',
  Lifegiver: 'LifeGiver',
  'Black Widow': 'LadyKiller',
  Aquaboy: 'AquaBoy',
  Aquagirl: 'AquaBoy',
  'Pary Girl': 'PartyBoy',
  'Action Girl': 'ActionBoy',
  'Mr Sandman': 'MrSandman'
}

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
const plannedFinalLevel = computed(() => plan.value.at(-1)?.level ?? 1)
const bobbleheadRequirements = computed(() => {
  const needed = new Set(plan.value.filter((item) => item.type === 'bobblehead').flatMap((item) => item.perkId ? [item.perkId] : []))
  return needed
})
const isDirty = computed(() => JSON.stringify(build.value) !== savedSnapshot.value)
const activeSavedBuild = computed(() => savedBuilds.value.find((item) => item.id === activeSavedBuildId.value) ?? null)

function perkAt(stat: Stat, tier: number) {
  return chartPerks.value.find((perk) => perk.stat.name === stat && perk.stat.value === tier)
}

function iconPath(perk: Perk) {
  const iconName = iconNameOverrides[perk.name] ?? perk.name.replaceAll(/[^A-Za-z0-9]/g, '')
  return `/images/perkicons/${perk.stat.value}.${statColumns[perk.stat.name]}.${iconName}.png`
}

function headerIconPath(stat: Stat) {
  return `/images/perkicons/0.${statColumns[stat]}.${stat}.png`
}

function isSearchMatch(perk: Perk) {
  return !search.value || perk.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
}

function nextRank(perk: Perk) {
  const selected = build.value.selectedRanks[perk.id] ?? 0
  return perk.ranks[selected]
}

function changeStat(stat: Stat, direction: number) {
  const value = build.value.stats[stat]
  if (direction > 0 && (value >= 10 || pointsLeft.value <= 0)) return
  if (direction < 0 && value <= 1) return
  build.value.stats[stat] += direction
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

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function cloneBuild(value: Build) {
  return JSON.parse(JSON.stringify(value)) as Build
}

function normalizeBuild(value: unknown): Build | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<Build>
  if (raw.version !== 1 || !raw.stats || !raw.selectedRanks || !raw.priority || (raw.gender !== 'female' && raw.gender !== 'male')) return null
  const normalized = emptyBuild()
  normalized.name = typeof raw.name === 'string' ? raw.name.slice(0, 80) : normalized.name
  normalized.characterName = typeof raw.characterName === 'string' ? raw.characterName.slice(0, 80) : ''
  normalized.gender = raw.gender
  const targetLevel = raw.targetLevel
  normalized.targetLevel = typeof targetLevel === 'number' && Number.isInteger(targetLevel) && targetLevel >= 1 && targetLevel <= 999 ? targetLevel : 60
  for (const stat of stats) {
    const statValue = raw.stats[stat]
    if (!Number.isInteger(statValue) || statValue < 1 || statValue > 10) return null
    normalized.stats[stat] = statValue
    normalized.bobbleheads[stat] = Boolean(raw.bobbleheads?.[stat])
  }
  normalized.bookStat = raw.bookStat && stats.includes(raw.bookStat) ? raw.bookStat : null
  for (const [id, rank] of Object.entries(raw.selectedRanks)) {
    const perk = perksById.get(id)
    if (!perk || perk.gender && perk.gender !== normalized.gender || !Number.isInteger(rank) || rank < 1 || rank > perk.ranks.length) continue
    normalized.selectedRanks[id] = rank
  }
  const selected = new Set(Object.keys(normalized.selectedRanks))
  normalized.priority = raw.priority.filter((id): id is string => typeof id === 'string' && selected.has(id))
  return normalized
}

function buildId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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

function loadSelectedBuild() {
  const saved = savedBuilds.value.find((item) => item.id === selectedSavedId.value)
  if (!saved || saved.id === activeSavedBuildId.value) return
  requestAction({ type: 'load', id: saved.id })
}

function startNewBuild() {
  build.value = emptyBuild()
  activeSavedBuildId.value = null
  selectedSavedId.value = ''
  savedSnapshot.value = JSON.stringify(build.value)
  saveStatus.value = { message: 'Started a new unsaved build.', error: false }
}

function deleteActiveBuild() {
  const activeId = activeSavedBuildId.value
  if (!activeId) return
  try {
    persistSavedBuilds(savedBuilds.value.filter((item) => item.id !== activeId))
    startNewBuild()
    saveStatus.value = { message: 'Deleted the local build.', error: false }
  } catch {
    saveStatus.value = { message: 'Could not delete the local build. Check browser storage permissions.', error: true }
  }
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
  if (action.type === 'new') startNewBuild()
  if (action.type === 'delete') deleteActiveBuild()
  if (action.type === 'import') {
    build.value = cloneBuild(action.build)
    activeSavedBuildId.value = null
    selectedSavedId.value = ''
    savedSnapshot.value = ''
    saveStatus.value = { message: 'Loaded build from JSON. Save it locally to keep it.', error: false }
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
  selectedSavedId.value = activeSavedBuildId.value ?? ''
  pendingAction.value = null
  confirmationKind.value = null
}

function exportJson() {
  download(`${safeName()}.json`, JSON.stringify(build.value, null, 2), 'application/json')
}

function exportMarkdown() {
  download(`${safeName()}.md`, toMarkdown(build.value, perks), 'text/markdown')
}

function safeName() {
  return (build.value.name || 'fallout-4-build').toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function importJson(event: Event) {
  importError.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const candidate = normalizeBuild(JSON.parse(await file.text()))
    if (!candidate) throw new Error('Unsupported build file')
    requestAction({ type: 'import', build: candidate })
  } catch {
    importError.value = 'That file is not a compatible planner build.'
  }
  ;(event.target as HTMLInputElement).value = ''
}

onMounted(() => {
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
})

watch(() => build.value.gender, (gender) => {
  for (const perk of perks) {
    if (perk.gender && perk.gender !== gender) {
      delete build.value.selectedRanks[perk.id]
      build.value.priority = build.value.priority.filter((id) => id !== perk.id)
    }
  }
  if (expandedPerkId.value && !visiblePerks(perks, gender).some((perk) => perk.id === expandedPerkId.value)) expandedPerkId.value = null
})
</script>

<template>
  <main>
    <header class="masthead">
      <p class="eyebrow">VAULT-TEC PERSONAL TERMINAL</p>
      <h1>Fallout 4 build planner</h1>
      <p>Set your starting SPECIAL, choose your perks, and receive a legal level-by-level route.</p>
    </header>

    <div class="planner-workspace">
      <aside class="build-rail">
        <section class="global-build-controls" aria-label="Build save and load controls">
      <span class="current-build"><b>{{ activeSavedBuild?.build.name || 'New unsaved build' }}</b><small :class="{ dirty: isDirty }">{{ isDirty ? 'Unsaved changes' : activeSavedBuild ? `Saved ${new Date(activeSavedBuild.updatedAt).toLocaleTimeString()}` : 'Not saved locally' }}</small></span>
      <button class="primary" :disabled="Boolean(activeSavedBuild) && !isDirty" @click="saveBuild()">{{ activeSavedBuild ? 'Save changes' : 'Save locally' }}</button>
      <button @click="saveBuild(true)">Save as new</button>
      <button @click="requestAction({ type: 'new' })">New build</button>
      <button :disabled="!activeSavedBuild" @click="requestAction({ type: 'delete' })">Delete</button>
      <button @click="exportJson">Download JSON</button>
      <label class="file-button">Upload JSON<input type="file" accept="application/json" @change="importJson"></label>
      <label class="saved-build-select">Local builds<select v-model="selectedSavedId" :disabled="!savedBuilds.length" @change="loadSelectedBuild"><option value="">{{ savedBuilds.length ? 'Choose a saved build' : 'No saved builds' }}</option><option v-for="item in savedBuilds" :key="item.id" :value="item.id">{{ item.build.name || 'Untitled build' }} · updated {{ new Date(item.updatedAt).toLocaleString() }}</option></select></label>
      <p v-if="importError" class="error">{{ importError }}</p><p v-if="saveStatus" class="save-status" :class="{ error: saveStatus.error }">{{ saveStatus.message }}</p>
        </section>
      </aside>

      <section class="planner-content">

        <nav class="planner-tabs" aria-label="Build planner sections">
      <button :class="{ active: activeTab === 'character' }" @click="activeTab = 'character'">1. Character</button>
      <button :class="{ active: activeTab === 'perks' }" @click="activeTab = 'perks'">2. SPECIAL &amp; perks</button>
      <button :class="{ active: activeTab === 'plan' }" @click="activeTab = 'plan'">3. Build plan <span v-if="prioritizedPerks.length">{{ prioritizedPerks.length }}</span></button>
        </nav>

        <section v-if="activeTab === 'character'" class="tab-panel character-panel">
      <div class="panel-heading"><div><h2>Character record</h2><p>Set the details that determine gender-specific perk availability.</p></div><button class="primary" @click="activeTab = 'perks'">Continue to SPECIAL &amp; perks</button></div>
      <div class="character-fields">
        <label>Build title<input v-model="build.name" maxlength="80"></label>
        <label>Character name<input v-model="build.characterName" maxlength="80" placeholder="Nora, Nate, or anyone"><span v-if="build.characterName" class="hint" :class="{ valid: nameIsVoiced }">{{ nameIsVoiced ? 'Codsworth recognizes this name.' : 'Custom name: Codsworth may not say it.' }}</span></label>
        <label>Target level<input :value="build.targetLevel" type="number" min="1" max="999" inputmode="numeric" @change="updateTargetLevel"><span class="hint">Perk and required SPECIAL increases must fit by this level.</span></label>
      </div>
      <fieldset class="gender"><legend>Character gender</legend><label><input v-model="build.gender" type="radio" value="female"> Female</label><label><input v-model="build.gender" type="radio" value="male"> Male</label></fieldset>
        </section>

        <section v-if="activeTab === 'perks'" class="tab-panel perks-panel">
      <section class="perk-area">
        <div class="toolbar"><label>Search perks<input v-model="search" placeholder="Rifleman, Sneak, Medic..."></label><span :class="{ danger: pointsLeft < 0 }">{{ pointsLeft }} SPECIAL points left</span><span>Plan ends level {{ plannedFinalLevel }} / {{ build.targetLevel }}</span><span>{{ prioritizedPerks.length }} perk families selected</span></div>
        <p class="chart-help">Use the seven header panels to set starting SPECIAL. Spend 21 points above the base value of 1.</p>
        <p v-if="selectionStatus" class="selection-status">{{ selectionStatus }}</p>
        <div class="perk-chart" aria-label="Fallout 4 SPECIAL perk chart">
          <div v-for="stat in stats" :key="`${stat}-header`" class="chart-header" :aria-label="`${stat}. Left click raises the stat; right click lowers it.`" role="button" tabindex="0" @click="changeStat(stat, 1)" @contextmenu.prevent="changeStat(stat, -1)" @keydown.enter="changeStat(stat, 1)" @keydown.space.prevent="changeStat(stat, 1)"><img :src="headerIconPath(stat)" :alt="`${stat} column`"><div class="special-chart-controls"><b>{{ stat }}</b><span>effective {{ effectiveStat(build, stat) }}</span><div class="special-stepper"><button :aria-label="`Lower ${stat}`" @click.stop="changeStat(stat, -1)">−</button><strong>{{ build.stats[stat] }}</strong><button :aria-label="`Raise ${stat}`" @click.stop="changeStat(stat, 1)">+</button></div><label @click.stop><input v-model="build.bobbleheads[stat]" type="checkbox"> Bobblehead</label><button class="book-toggle" :class="{ active: build.bookStat === stat }" :aria-pressed="build.bookStat === stat" @click.stop="build.bookStat = build.bookStat === stat ? null : stat">You're SPECIAL +1</button></div></div>
          <template v-for="tier in tiers" :key="tier">
            <template v-for="stat in stats" :key="`${tier}-${stat}`">
              <article v-if="perkAt(stat, tier)" class="chart-cell" :class="{ selected: build.selectedRanks[perkAt(stat, tier)!.id], dimmed: !isSearchMatch(perkAt(stat, tier)!) }" :aria-label="`${perkAt(stat, tier)!.name}. Left click adds a rank; Control-left click selects all ranks; right click removes a rank; Control-right click clears all ranks.`" role="button" tabindex="0" @click="setRank(perkAt(stat, tier)!, $event.ctrlKey ? perkAt(stat, tier)!.ranks.length : (build.selectedRanks[perkAt(stat, tier)!.id] ?? 0) + 1)" @contextmenu.prevent="setRank(perkAt(stat, tier)!, $event.ctrlKey ? 0 : (build.selectedRanks[perkAt(stat, tier)!.id] ?? 0) - 1)" @keydown.enter="changeRank(perkAt(stat, tier)!, 1)" @keydown.space.prevent="changeRank(perkAt(stat, tier)!, 1)">
                <img :src="iconPath(perkAt(stat, tier)!)" :alt="perkAt(stat, tier)!.name">
                <div class="cell-controls"><div class="cell-title"><span>{{ perkAt(stat, tier)!.name }}</span><button :aria-label="`Show ${perkAt(stat, tier)!.name} rank details`" @click.stop="expandedPerkId = expandedPerkId === perkAt(stat, tier)!.id ? null : perkAt(stat, tier)!.id" @contextmenu.stop>i</button></div><span class="cell-level">{{ nextRank(perkAt(stat, tier)!) ? `Next: level ${nextRank(perkAt(stat, tier)!)!.level}` : 'All ranks selected' }}</span><div class="cell-rank-controls"><button :disabled="!(build.selectedRanks[perkAt(stat, tier)!.id] ?? 0)" :aria-label="`Remove ${perkAt(stat, tier)!.name} rank`" @click.stop="changeRank(perkAt(stat, tier)!, -1)" @contextmenu.stop>−</button><strong>{{ build.selectedRanks[perkAt(stat, tier)!.id] ?? 0 }}/{{ perkAt(stat, tier)!.ranks.length }}</strong><button :aria-label="`Add ${perkAt(stat, tier)!.name} rank`" @click.stop="changeRank(perkAt(stat, tier)!, 1)" @contextmenu.stop>+</button></div></div>
                <div v-if="expandedPerkId === perkAt(stat, tier)!.id" class="cell-details" @click.stop @contextmenu.prevent.stop><div><b>{{ perkAt(stat, tier)!.name }}</b><button aria-label="Close rank details" @click="expandedPerkId = null">×</button></div><ol><li v-for="rank in perkAt(stat, tier)!.ranks" :key="rank.rank" :class="{ active: rank.rank <= (build.selectedRanks[perkAt(stat, tier)!.id] ?? 0) }"><b>Rank {{ rank.rank }} · level {{ rank.level }}</b><br>{{ rank.description }}</li></ol></div>
              </article>
              <div v-else class="chart-cell missing" aria-hidden="true"></div>
            </template>
          </template>
        </div>
        <section v-if="expansionPerks.length" class="expansion-perks"><h2>Expansion perks</h2><p class="hint">These supplied DLC perks do not have a panel in the base-game chart.</p><div v-for="perk in expansionPerks" :key="perk.id" class="expansion-perk" :class="{ selected: build.selectedRanks[perk.id] }"><span><b>{{ perk.name }}</b><small>{{ perk.stat.name }} {{ perk.stat.value }} · {{ nextRank(perk) ? `next at level ${nextRank(perk)!.level}` : 'all ranks selected' }}</small></span><div class="cell-rank-controls"><button :disabled="!(build.selectedRanks[perk.id] ?? 0)" :aria-label="`Remove ${perk.name} rank`" @click="changeRank(perk, -1)">−</button><strong>{{ build.selectedRanks[perk.id] ?? 0 }}/{{ perk.ranks.length }}</strong><button :aria-label="`Add ${perk.name} rank`" @click="changeRank(perk, 1)">+</button></div></div></section>
      </section>
        </section>

        <section v-if="activeTab === 'plan'" class="tab-panel plan-panel">
      <div class="panel-heading"><div><h2>Build plan</h2><p>Order your selected perk families, then follow the generated level route.</p></div><button class="primary" :disabled="!plan.length" @click="exportMarkdown">Download play guide (.md)</button></div>
      <div class="plan-workspace">
        <section><h2>Perk priority</h2><p class="hint">Drag a perk to its insertion marker, or use arrows. Its selected ranks follow this order.</p><ol v-if="prioritizedPerks.length" class="priority-list" @dragover.prevent><template v-for="(perk, index) in prioritizedPerks" :key="perk.id"><li v-if="draggedId && dragOverId === perk.id && draggedId !== perk.id" class="drag-placeholder">Drop at priority {{ index + 1 }}</li><li class="priority-item" :class="{ dragging: draggedId === perk.id, 'drop-target': dragOverId === perk.id }" draggable="true" @dragstart="startPriorityDrag(perk.id, $event)" @dragenter.prevent="setPriorityDropTarget(perk.id)" @dragover.prevent @drop="dropPriority(perk.id)" @dragend="endPriorityDrag"><span><b>{{ index + 1 }}. {{ perk.name }}</b><small v-if="bobbleheadRequirements.has(perk.id)">Needs {{ perk.stat.name }} Bobblehead</small></span><span><button :disabled="index === 0" @click="movePriority(perk.id, -1)">↑</button><button :disabled="index === prioritizedPerks.length - 1" @click="movePriority(perk.id, 1)">↓</button></span></li></template><li v-if="draggedId" class="drag-placeholder end" :class="{ active: dragOverEnd }" @dragenter.prevent="setPriorityDropEnd" @dragover.prevent @drop="dropPriorityAtEnd">Drop at the end</li></ol><p v-else class="empty">Choose perk ranks in the SPECIAL &amp; perks tab.</p></section>
        <section class="plan"><h2>Optimized route</h2><p class="hint">Priorities are honored where game requirements allow.</p><ol v-if="plan.length" class="plan-list"><li v-for="(action, index) in plan" :key="`${action.level}-${action.label}-${index}`" :class="action.type"><b>{{ action.type === 'bobblehead' ? `Before level ${action.level}` : `Level ${action.level}` }}</b><span>{{ action.label }}</span><small v-if="action.requiredLevel" class="plan-requirement">Requires level {{ action.requiredLevel }}<em v-if="action.perkRank && action.perkRank > 1 && action.level > action.requiredLevel">+{{ action.level - action.requiredLevel }} levels late</em></small><small>{{ action.detail }}</small></li></ol><p v-else-if="planError" class="error">{{ planError }}</p><p v-else class="empty">Choose perk ranks to create a route.</p></section>
      </div>
        </section>
      </section>
    </div>

    <div v-if="confirmationKind" class="confirmation-backdrop" role="presentation">
      <section class="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <template v-if="confirmationKind === 'unsaved'"><h2 id="confirmation-title">Save changes first?</h2><p>Your current build has unsaved changes. Save them before continuing, discard them, or cancel this action.</p><div><button class="primary" @click="continueAfterSaving">Save changes</button><button @click="discardAndContinue">Discard changes</button><button @click="cancelPendingAction">Cancel</button></div></template>
        <template v-else><h2 id="confirmation-title">Delete local build?</h2><p><b>{{ activeSavedBuild?.build.name || 'This build' }}</b> will be permanently removed from this browser. This cannot be undone.</p><div><button class="danger-button" @click="discardAndContinue">Delete build</button><button @click="cancelPendingAction">Cancel</button></div></template>
      </section>
    </div>
  </main>
</template>
