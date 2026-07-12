<script setup lang="ts">
type PlannerTab = 'character' | 'perks' | 'plan' | 'stats' | 'console'

defineProps<{ activeTab: PlannerTab; selectedPerkCount: number }>()
const emit = defineEmits<{ 'update:activeTab': [tab: PlannerTab] }>()
</script>

<template>
  <nav class="planner-tabs" aria-label="Build planner sections">
    <button :class="{ active: activeTab === 'character' }" @click="emit('update:activeTab', 'character')">1. Character</button>
    <button :class="{ active: activeTab === 'perks' }" @click="emit('update:activeTab', 'perks')">2. Perks</button>
    <button :class="{ active: activeTab === 'plan' }" @click="emit('update:activeTab', 'plan')">3. Build plan <span v-if="selectedPerkCount">{{ selectedPerkCount }}</span></button>
    <button :class="{ active: activeTab === 'stats' }" @click="emit('update:activeTab', 'stats')">4. Stats</button>
    <button :class="{ active: activeTab === 'console' }" @click="emit('update:activeTab', 'console')">5. Console</button>
  </nav>
</template>
