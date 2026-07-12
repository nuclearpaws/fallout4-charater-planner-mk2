<script setup lang="ts">
import { computed, ref } from 'vue'
import InfoDialog from '~/components/ui/InfoDialog.vue'
import SpecialChartCell from '~/components/special/SpecialChartCell.vue'
import { specialStatDescriptions, stats, type Perk, type Stat } from '~/data/catalog'
import { effectiveStat, type Build } from '~/utils/planner'
import { perkIconPath, statHeaderIconPath } from '~/utils/perk-icons'

const props = defineProps<{
  build: Build
  search: string
  chartPerks: Perk[]
  expansionPerks: Perk[]
  pointsLeft: number
  plannedFinalLevel: number
  availableLevelUps: number
  selectedPerkCount: number
  selectionStatus: string
  expandedPerkId: string | null
}>()

const emit = defineEmits<{
  'update:search': [search: string]
  'update:expandedPerkId': [id: string | null]
  changeStat: [stat: Stat, direction: number]
  changeRank: [perk: Perk, direction: number]
  setRank: [perk: Perk, rank: number]
}>()

const tiers = Array.from({ length: 10 }, (_, index) => index + 1)
const infoPerk = ref<Perk | null>(null)
const infoStat = ref<Stat | null>(null)
const searchModel = computed({
  get: () => props.search,
  set: (value: string) => emit('update:search', value)
})

function perkAt(stat: Stat, tier: number) {
  return props.chartPerks.find((perk) => perk.stat.name === stat && perk.stat.value === tier)
}

function isSearchMatch(perk: Perk) {
  return !props.search || perk.name.toLocaleLowerCase().includes(props.search.toLocaleLowerCase())
}

function isOutOfReach(perk: Perk) {
  return effectiveStat(props.build, perk.stat.name) < perk.stat.value
}

function nextRank(perk: Perk) {
  const selected = props.build.selectedRanks[perk.id] ?? 0
  return perk.ranks[selected]
}

function openPerkInfo(perk: Perk) { infoPerk.value = perk }
function openStatInfo(stat: Stat) { infoStat.value = stat }
</script>

<template>
  <section class="tab-panel perks-panel">
    <div class="panel-heading"><div><h2>Perks</h2><p>Choose perk ranks, bobbleheads, and the You're SPECIAL book.</p></div></div>
    <p v-if="selectionStatus" class="selection-status">{{ selectionStatus }}</p>
    <section class="perks-card">
      <div class="perks-card-header">
        <div class="perk-toolbar">
          <div class="perk-search" role="search" aria-label="Perk search">
            <label>Search perks<input v-model="searchModel" placeholder="Rifleman, Sneak, Medic..."></label>
          </div>
          <section class="perk-planning-summary" aria-label="Perk planning summary">
            <span><small>Level-up picks</small><b>{{ plannedFinalLevel }} / {{ availableLevelUps }}</b></span>
            <span><small>Perk families</small><b>{{ selectedPerkCount }}</b></span>
          </section>
        </div>
      </div>
      <div class="perks-card-body">
        <div class="perk-chart" aria-label="Fallout 4 SPECIAL perk chart">
          <SpecialChartCell v-for="stat in stats" :key="`${stat}-header`" as="div" class="chart-header" :title="stat" :subtext="`Base: ${build.stats[stat]} / Effective: ${effectiveStat(build, stat)}`" :image-src="statHeaderIconPath(stat)" :image-alt="`${stat} column`" :aria-label="`${stat} perk column. Starting value ${build.stats[stat]}, effective value ${effectiveStat(build, stat)}.`">
            <template #title-action><button :aria-label="`Show ${stat} details`" @click.stop="openStatInfo(stat)">i</button></template>
            <template #controls><div class="special-toggle-row"><button class="toggle-button" :class="{ active: build.bobbleheads[stat] }" :aria-pressed="build.bobbleheads[stat]" @click.stop="build.bobbleheads[stat] = !build.bobbleheads[stat]">Bobblehead</button><button class="book-toggle" :class="{ active: build.bookStat === stat }" :aria-pressed="build.bookStat === stat" @click.stop="build.bookStat = build.bookStat === stat ? null : stat">Book +1</button></div></template>
          </SpecialChartCell>
          <template v-for="tier in tiers" :key="tier">
            <template v-for="stat in stats" :key="`${tier}-${stat}`">
              <SpecialChartCell v-if="perkAt(stat, tier)" class="chart-cell" :class="{ selected: build.selectedRanks[perkAt(stat, tier)!.id], dimmed: !isSearchMatch(perkAt(stat, tier)!), unreachable: isOutOfReach(perkAt(stat, tier)!) }" :title="perkAt(stat, tier)!.name" :subtext="nextRank(perkAt(stat, tier)!) ? `Next: level ${nextRank(perkAt(stat, tier)!)!.level}` : 'All ranks selected'" :image-src="perkIconPath(perkAt(stat, tier)!)" :image-alt="perkAt(stat, tier)!.name" :aria-label="`${perkAt(stat, tier)!.name}. Left click adds a rank; Control-left click selects all ranks; right click removes a rank; Control-right click clears all ranks.`" role="button" tabindex="0" @click="emit('setRank', perkAt(stat, tier)!, $event.ctrlKey ? perkAt(stat, tier)!.ranks.length : (build.selectedRanks[perkAt(stat, tier)!.id] ?? 0) + 1)" @contextmenu.prevent="emit('setRank', perkAt(stat, tier)!, $event.ctrlKey ? 0 : (build.selectedRanks[perkAt(stat, tier)!.id] ?? 0) - 1)" @keydown.enter="emit('changeRank', perkAt(stat, tier)!, 1)" @keydown.space.prevent="emit('changeRank', perkAt(stat, tier)!, 1)">
                <template #title-action><button :aria-label="`Show ${perkAt(stat, tier)!.name} rank details`" @click.stop="openPerkInfo(perkAt(stat, tier)!)" @contextmenu.stop>i</button></template>
                <template #controls><div class="cell-rank-controls"><button :disabled="!(build.selectedRanks[perkAt(stat, tier)!.id] ?? 0)" :aria-label="`Remove ${perkAt(stat, tier)!.name} rank`" @click.stop="emit('changeRank', perkAt(stat, tier)!, -1)" @contextmenu.stop>−</button><strong>{{ build.selectedRanks[perkAt(stat, tier)!.id] ?? 0 }}/{{ perkAt(stat, tier)!.ranks.length }}</strong><button :aria-label="`Add ${perkAt(stat, tier)!.name} rank`" @click.stop="emit('changeRank', perkAt(stat, tier)!, 1)" @contextmenu.stop>+</button></div></template>
              </SpecialChartCell>
              <div v-else class="chart-cell missing" aria-hidden="true"></div>
            </template>
          </template>
        </div>
        <section v-if="expansionPerks.length" class="expansion-perks"><h2>Expansion perks</h2><p class="hint">These supplied DLC perks do not have a panel in the base-game chart.</p><div v-for="perk in expansionPerks" :key="perk.id" class="expansion-perk" :class="{ selected: build.selectedRanks[perk.id] }"><span><b>{{ perk.name }}</b><button class="info-button" :aria-label="`Show ${perk.name} rank details`" @click="openPerkInfo(perk)">i</button><small>{{ perk.stat.name }} {{ perk.stat.value }} · {{ nextRank(perk) ? `next at level ${nextRank(perk)!.level}` : 'all ranks selected' }}</small></span><div class="cell-rank-controls"><button :disabled="!(build.selectedRanks[perk.id] ?? 0)" :aria-label="`Remove ${perk.name} rank`" @click="emit('changeRank', perk, -1)">−</button><strong>{{ build.selectedRanks[perk.id] ?? 0 }}/{{ perk.ranks.length }}</strong><button :aria-label="`Add ${perk.name} rank`" @click="emit('changeRank', perk, 1)">+</button></div></div></section>
      </div>
    </section>
    <InfoDialog v-if="infoPerk" :title="infoPerk.name" :subtitle="`${infoPerk.stat.name} ${infoPerk.stat.value}`" @close="infoPerk = null">
      <ol class="rank-info-list"><li v-for="rank in infoPerk.ranks" :key="rank.rank" :class="{ active: rank.rank <= (build.selectedRanks[infoPerk.id] ?? 0) }"><b>Rank {{ rank.rank }} · level {{ rank.level }}</b><p>{{ rank.description }}</p><small>{{ rank.dlc }}</small></li></ol>
    </InfoDialog>
    <InfoDialog v-if="infoStat" :title="infoStat" subtitle="SPECIAL stat" @close="infoStat = null">
      <p>{{ specialStatDescriptions[infoStat] }}</p>
    </InfoDialog>
  </section>
</template>
