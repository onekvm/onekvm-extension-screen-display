<script setup lang="ts">
import { Eye, EyeOff, GripVertical } from '@lucide/vue'
import AppIcon from './AppIcon.vue'

export interface WidgetListItem {
  id: string
  name: string
  type: string
  icon: string
  accent: string
  hidden: boolean
  pinned: boolean
  selected: boolean
  preview?: string
}

const props = defineProps<{ items: WidgetListItem[]; labels: Record<string, string> }>()
const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
  reorder: [source: string, target: string, before: boolean]
}>()

let dragging = ''

function dragStart(item: WidgetListItem, event: DragEvent) {
  if (item.pinned)
    return
  dragging = item.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.id)
  }
}

function drop(target: WidgetListItem, event: DragEvent) {
  event.preventDefault()
  if (!dragging || dragging === target.id || target.pinned)
    return
  const row = event.currentTarget as HTMLElement
  const before = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2
  emit('reorder', dragging, target.id, before)
  dragging = ''
}
</script>

<template>
  <ul v-if="props.items.length" class="widget-list">
    <li
      v-for="item in props.items"
      :key="item.id"
      class="widget-list-row"
      :class="{ selected: item.selected, pinned: item.pinned }"
      :draggable="!item.pinned"
      @click="emit('select', item.id)"
      @dragstart="dragStart(item, $event)"
      @dragover.prevent
      @drop="drop(item, $event)"
    >
      <button
        type="button"
        class="widget-list-eye"
        :disabled="item.pinned"
        :aria-label="item.hidden ? labels.showWidget : labels.hideWidget"
        @click.stop="emit('toggle', item.id)"
      >
        <EyeOff v-if="item.hidden" :size="17" aria-hidden="true" />
        <Eye v-else :size="17" aria-hidden="true" />
      </button>
      <div class="widget-list-content">
        <span class="widget-list-thumbnail" :class="{ 'is-clock': item.pinned }" :style="{ '--thumbnail-accent': item.accent }" aria-hidden="true">
          <span v-if="item.pinned" class="widget-list-clock"><i /><b>12</b></span>
          <span v-else-if="item.preview" class="widget-list-preview">{{ item.preview }}</span>
          <AppIcon v-else :name="item.icon || item.id" :accent="item.accent" />
        </span>
        <div class="widget-list-info">
          <strong>{{ item.name }}</strong>
          <small>{{ labels[item.type] || item.type }}</small>
        </div>
      </div>
      <GripVertical v-if="!item.pinned" class="widget-list-grip" :size="16" aria-hidden="true" />
    </li>
  </ul>
  <p v-else class="widget-list-empty">{{ labels.empty }}</p>
</template>
