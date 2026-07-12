<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Build } from '~/utils/planner'
import { derivedPlayerStats } from '~/utils/player-stats'

const props = defineProps<{ build: Build }>()
const derived = computed(() => derivedPlayerStats(props.build))
const activeHpPoint = ref<{ level: number; hitPoints: number; x: number; y: number } | null>(null)
const hpChart = computed(() => {
  const rows = derived.value.hitPointsByLevel
  const width = 760
  const height = 240
  const padding = 64
  const minHp = Math.min(...rows.map((row) => row.hitPoints))
  const maxHp = Math.max(...rows.map((row) => row.hitPoints))
  const hpRange = Math.max(1, maxHp - minHp)
  const levelRange = Math.max(1, rows.length - 1)
  const points = rows.map((row, index) => {
    const x = padding + (index / levelRange) * (width - padding * 2)
    const y = height - padding - ((row.hitPoints - minHp) / hpRange) * (height - padding * 2)
    return { ...row, x, y }
  })
  return {
    width,
    height,
    padding,
    plotRight: width - padding,
    plotBottom: height - padding,
    minHp,
    maxHp,
    start: rows[0],
    end: rows.at(-1),
    points,
    linePoints: points.map((point) => `${point.x},${point.y}`).join(' '),
    areaPoints: `${padding},${height - padding} ${points.map((point) => `${point.x},${point.y}`).join(' ')} ${width - padding},${height - padding}`,
    markers: points.filter((_, index) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 8)) === 0)
  }
})

function updateHpTooltip(event: PointerEvent) {
  const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const x = ((event.clientX - box.left) / box.width) * hpChart.value.width
  const levelRange = Math.max(1, hpChart.value.points.length - 1)
  const plotWidth = hpChart.value.width - hpChart.value.padding * 2
  const index = Math.max(0, Math.min(hpChart.value.points.length - 1, Math.round(((x - hpChart.value.padding) / plotWidth) * levelRange)))
  activeHpPoint.value = hpChart.value.points[index]
}
</script>

<template>
  <section class="tab-panel player-stats-panel">
    <div class="panel-heading"><div><h2>Player stats</h2><p>Derived character math from effective SPECIAL values, including bobbleheads and the You're SPECIAL book.</p></div></div>
    <div class="stats-workspace">
      <section class="effective-special-card">
        <h2>Effective SPECIAL</h2>
        <div class="effective-special-list">
          <span v-for="(value, stat) in derived.effectiveStats" :key="stat"><small>{{ stat }}</small><b>{{ value }}</b></span>
        </div>
      </section>

      <section class="stats-summary-card">
        <h2>Misc derived stats</h2>
        <div class="derived-stat-grid">
          <span><small>Carry weight</small><b>{{ derived.carryWeight }}</b><em>200 + Strength × 10</em></span>
          <span><small>Action Points</small><b>{{ derived.actionPoints }}</b><em>60 + Agility × 10</em></span>
          <span><small>Max settlers</small><b>{{ derived.maxSettlers }}</b><em>10 + Charisma</em></span>
          <span><small>XP multiplier</small><b>{{ Math.round(derived.xpMultiplier * 100) }}%</b><em>+3% per Intelligence</em></span>
          <span><small>Melee damage</small><b>{{ Math.round(derived.meleeDamageMultiplier * 100) }}%</b><em>+10% per Strength</em></span>
        </div>
      </section>

      <div class="stats-right-column">
        <section class="speech-card">
          <h2>Speech checks</h2>
          <p class="hint">Approximate vanilla persuasion chance using Charisma against yellow, orange, and red check difficulties.</p>
          <div class="speech-check-list">
            <span v-for="check in derived.speechChecks" :key="check.label" :class="check.label.toLowerCase()"><b>{{ check.label }}</b><strong>{{ check.chance }}%</strong><small>Difficulty {{ check.difficulty }}</small></span>
          </div>
        </section>

        <section class="barter-card">
          <h2>Barter</h2>
          <p class="hint">Approximate vanilla price modifiers from effective Charisma before barter perks, magazines, chems, and gear.</p>
          <div class="barter-stat-list">
            <span><small>Buy prices</small><b>{{ Math.round(derived.buyPriceMultiplier * 100) }}%</b><em>Vendor cost vs item value</em></span>
            <span><small>Sell prices</small><b>{{ Math.round(derived.sellPriceMultiplier * 100) }}%</b><em>Vendor offer vs item value</em></span>
          </div>
        </section>
      </div>

      <section class="hp-card">
        <h2>Max HP by level</h2>
        <p class="hint">Assumes current effective Endurance for each listed level.</p>
        <div class="hp-chart" role="img" :aria-label="`Max hit points rise from ${hpChart.start?.hitPoints ?? 0} at level 1 to ${hpChart.end?.hitPoints ?? 0} at level ${hpChart.end?.level ?? 1}.`">
          <svg :viewBox="`0 0 ${hpChart.width} ${hpChart.height}`" focusable="false" @pointermove="updateHpTooltip" @pointerleave="activeHpPoint = null">
            <polygon class="hp-chart-area" :points="hpChart.areaPoints" />
            <polyline class="hp-chart-line" :points="hpChart.linePoints" />
            <g v-if="activeHpPoint" class="hp-chart-active-marker">
              <line :x1="activeHpPoint.x" y1="34" :x2="activeHpPoint.x" y2="206" />
              <circle :cx="activeHpPoint.x" :cy="activeHpPoint.y" r="6" />
            </g>
            <g v-for="marker in hpChart.markers" :key="marker.level" class="hp-chart-marker">
              <circle :cx="marker.x" :cy="marker.y" r="4" />
              <text :x="marker.x" :y="marker.y - 9">{{ marker.hitPoints }}</text>
            </g>
            <line class="hp-chart-axis" :x1="hpChart.padding" :y1="hpChart.plotBottom" :x2="hpChart.plotRight" :y2="hpChart.plotBottom" />
            <line class="hp-chart-axis" :x1="hpChart.padding" :y1="hpChart.padding" :x2="hpChart.padding" :y2="hpChart.plotBottom" />
            <text class="hp-chart-label" :x="hpChart.padding" y="228">Level 1</text>
            <text class="hp-chart-label end" :x="hpChart.plotRight" y="228">Level {{ hpChart.end?.level ?? 1 }}</text>
            <text class="hp-chart-label left" :x="hpChart.padding - 8" :y="hpChart.padding - 6">{{ hpChart.maxHp }} HP</text>
            <text class="hp-chart-label left" :x="hpChart.padding - 8" :y="hpChart.plotBottom">{{ hpChart.minHp }} HP</text>
          </svg>
          <div
            v-if="activeHpPoint"
            class="hp-chart-tooltip"
            :style="{ left: `${(activeHpPoint.x / hpChart.width) * 100}%`, top: `${(activeHpPoint.y / hpChart.height) * 100}%` }"
          >
            <small>Level {{ activeHpPoint.level }}</small>
            <b>{{ activeHpPoint.hitPoints }} HP</b>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
