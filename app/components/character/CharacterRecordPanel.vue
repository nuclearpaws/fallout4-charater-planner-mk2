<script setup lang="ts">
import { ref } from 'vue'
import InfoDialog from '~/components/ui/InfoDialog.vue'
import { specialStatDescriptions, stats, type Stat } from '~/data/catalog'
import type { Build } from '~/utils/planner'

defineProps<{ build: Build; nameIsVoiced: boolean; pointsLeft: number }>()
const emit = defineEmits<{ continue: []; updateTargetLevel: [event: Event]; changeStat: [stat: Stat, direction: number, event: MouseEvent]; setStat: [stat: Stat, event: Event] }>()
const infoStat = ref<Stat | null>(null)
</script>

<template>
  <section class="tab-panel character-panel">
    <div class="panel-heading"><div><h2>Character record</h2><p>Set your identity and starting SPECIAL before choosing perks.</p></div><button class="primary" @click="emit('continue')">Continue to SPECIAL &amp; perks</button></div>
    <div class="character-fields">
      <label class="build-title-field">Build title<input v-model="build.name" maxlength="80"></label>
      <div class="character-detail-row">
        <section class="gender-selector" aria-labelledby="gender-selector-title">
          <h3 id="gender-selector-title">Character gender</h3>
          <div class="button-group" role="group" aria-label="Character gender">
            <button type="button" :class="{ active: build.gender === 'female' }" :aria-pressed="build.gender === 'female'" @click="build.gender = 'female'">Female</button>
            <button type="button" :class="{ active: build.gender === 'male' }" :aria-pressed="build.gender === 'male'" @click="build.gender = 'male'">Male</button>
          </div>
        </section>
        <label>Character name<input v-model="build.characterName" maxlength="80" placeholder="Nora, Nate, or anyone"><span v-if="build.characterName" class="hint" :class="{ valid: nameIsVoiced }">{{ nameIsVoiced ? 'Codsworth recognizes this name.' : 'Custom name: Codsworth may not say it.' }}</span></label>
        <label>Target level<input :value="build.targetLevel" type="number" min="1" max="999" inputmode="numeric" @change="emit('updateTargetLevel', $event)"><span class="hint">Perk and required SPECIAL increases must fit by this level.</span></label>
      </div>
    </div>

    <section class="special-registration" aria-labelledby="special-registration-title">
      <div class="special-registration-heading">
        <div>
          <h3 id="special-registration-title">Starting SPECIAL</h3>
          <p>Assign your 21 starting points. Every stat starts at 1 and can be raised to 10.</p>
        </div>
        <strong :class="{ danger: pointsLeft < 0 }">{{ pointsLeft }} points left</strong>
      </div>
      <div class="special-registration-list">
        <div v-for="stat in stats" :key="stat" class="special-registration-row">
          <span class="special-stat-name">{{ stat }}<button class="info-button" :aria-label="`Show ${stat} details`" @click="infoStat = stat">i</button></span>
          <span class="special-pips" :aria-label="`${build.stats[stat]} out of 10 ${stat}`">
            <i v-for="pip in 10" :key="pip" :class="{ filled: pip <= build.stats[stat] }" aria-hidden="true"></i>
          </span>
          <span class="special-stat-controls">
            <button :aria-label="`Lower ${stat}`" :disabled="build.stats[stat] <= 1" @click="emit('changeStat', stat, -1, $event)">−</button>
            <input :value="build.stats[stat]" type="number" min="1" max="10" inputmode="numeric" :aria-label="`${stat} starting value`" @change="emit('setStat', stat, $event)">
            <button :aria-label="`Raise ${stat}`" :disabled="build.stats[stat] >= 10 || pointsLeft <= 0" @click="emit('changeStat', stat, 1, $event)">+</button>
          </span>
        </div>
      </div>
    </section>
    <InfoDialog v-if="infoStat" :title="infoStat" subtitle="SPECIAL stat" @close="infoStat = null">
      <p>{{ specialStatDescriptions[infoStat] }}</p>
    </InfoDialog>
  </section>
</template>
