<script setup lang="ts">
import AlertMessage from '~/components/ui/AlertMessage.vue'
import type { Perk } from '~/data/catalog'
import type { PlanAction } from '~/utils/planner'

defineProps<{
  prioritizedPerks: Perk[]
  bobbleheadRequirements: Set<string>
  bookRequirements: Set<string>
  hasSpecialBook: boolean
  plan: PlanAction[]
  planError: string
  draggedId: string | null
  dragOverId: string | null
  dragOverEnd: boolean
}>()

const emit = defineEmits<{
  exportMarkdown: []
  movePriority: [id: string, direction: number]
  startPriorityDrag: [id: string, event: DragEvent]
  setPriorityDropTarget: [id: string]
  setPriorityDropEnd: []
  dropPriority: [id: string]
  dropPriorityAtEnd: []
  endPriorityDrag: []
}>()
</script>

<template>
  <section class="tab-panel plan-panel">
    <div class="panel-heading"><div><h2>Build plan</h2><p>Order your selected perk families, then follow the generated level route.</p></div><button class="primary" :disabled="!plan.length" @click="emit('exportMarkdown')">Download play guide (.md)</button></div>
    <AlertMessage v-if="!hasSpecialBook" type="warning">You're SPECIAL book is not assigned to any stat.</AlertMessage>
    <div class="plan-workspace">
      <section><h2>Perk priority</h2><p class="hint">Drag a perk to its insertion marker, or use arrows. Its selected ranks follow this order.</p><ol v-if="prioritizedPerks.length" class="priority-list" @dragover.prevent><template v-for="(perk, index) in prioritizedPerks" :key="perk.id"><li v-if="draggedId && dragOverId === perk.id && draggedId !== perk.id" class="drag-placeholder">Drop at priority {{ index + 1 }}</li><li class="priority-item" :class="{ dragging: draggedId === perk.id, 'drop-target': dragOverId === perk.id }" draggable="true" @dragstart="emit('startPriorityDrag', perk.id, $event)" @dragenter.prevent="emit('setPriorityDropTarget', perk.id)" @dragover.prevent @drop="emit('dropPriority', perk.id)" @dragend="emit('endPriorityDrag')"><span><b>{{ index + 1 }}. {{ perk.name }}</b><small v-if="bobbleheadRequirements.has(perk.id)">Needs {{ perk.stat.name }} Bobblehead</small><small v-if="bookRequirements.has(perk.id)">Needs You're SPECIAL book assigned to {{ perk.stat.name }}</small></span><span><button :disabled="index === 0" @click="emit('movePriority', perk.id, -1)">↑</button><button :disabled="index === prioritizedPerks.length - 1" @click="emit('movePriority', perk.id, 1)">↓</button></span></li></template><li v-if="draggedId" class="drag-placeholder end" :class="{ active: dragOverEnd }" @dragenter.prevent="emit('setPriorityDropEnd')" @dragover.prevent @drop="emit('dropPriorityAtEnd')">Drop at the end</li></ol><p v-else class="empty">Choose perk ranks in the Perks tab.</p></section>
      <section class="plan"><h2>Optimized route</h2><p class="hint">Priorities are honored where game requirements allow.</p><ol v-if="plan.length" class="plan-list"><li v-for="(action, index) in plan" :key="`${action.level}-${action.label}-${index}`" :class="action.type"><b>{{ action.type === 'bobblehead' || action.type === 'book' ? `Before level ${action.level}` : `Level ${action.level}` }}</b><span>{{ action.label }}</span><small v-if="action.requiredLevel" class="plan-requirement">Requires level {{ action.requiredLevel }}<em v-if="action.perkRank && action.perkRank > 1 && action.level > action.requiredLevel">+{{ action.level - action.requiredLevel }} levels late</em></small><small>{{ action.detail }}</small></li></ol><p v-else-if="planError" class="error">{{ planError }}</p><p v-else class="empty">Choose perk ranks to create a route.</p></section>
    </div>
  </section>
</template>
