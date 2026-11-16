<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import AppIcon from './AppIcon.vue'
import ClockWidget from './ClockWidget.vue'
import type { AppView, DisplayFace, DisplayWidget, HomeWidgetPlacement, LauncherLayout, PanelInfo, PlacementMode, PreviewMode } from './types'
import { DEFAULT_LAUNCHER, accentColor } from './types'

const props = defineProps<{
  panel: PanelInfo
  mode: PreviewMode
  hdmiOn: boolean
  usbOn: boolean
  ip: string
  brightness: number
  rotate: number
  appView: AppView
  complications: DisplayWidget[]
  face: DisplayFace
  placementMode: PlacementMode
  placements: HomeWidgetPlacement[]
  clockPosition: { x: number; y: number; scale: number }
  apps: DisplayWidget[]
  launcher?: LauncherLayout
  detailId: string
}>()

const emit = defineEmits<{
  'update:mode': [value: PreviewMode]
  'update:detailId': [value: string]
  'update:appView': [value: AppView]
  moveWidget: [id: string, patch: Partial<HomeWidgetPlacement>]
  moveClock: [point: { x: number; y: number }]
}>()

const appPage = ref(0)
const dragX = ref(0)
const launcher = computed(() => props.launcher || DEFAULT_LAUNCHER)
const pageSize = computed(() => props.appView === 'list'
  ? Math.max(1, launcher.value.listRows)
  : Math.max(1, launcher.value.iconColumns * launcher.value.iconRows))
const appPageCount = computed(() => Math.max(1, Math.ceil(props.apps.length / pageSize.value)))
const pagedApps = computed(() => {
  const start = appPage.value * pageSize.value
  return props.apps.slice(start, start + pageSize.value)
})
const iconGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${launcher.value.iconColumns}, ${launcher.value.iconSize}px)`,
  gap: '10px',
}))
const iconOrbStyle = computed(() => ({
  width: `${launcher.value.iconSize}px`,
  height: `${launcher.value.iconSize}px`,
}))
const now = ref(new Date())
let clockTimer: number | null = null
const clock = computed(() => `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`)
const date = computed(() => now.value.toLocaleDateString('en-GB', {
  weekday: 'short',
  day: 'numeric',
}).toUpperCase())
const orientedWidth = computed(() => props.rotate === 90 || props.rotate === 270 ? props.panel.height : props.panel.width)
const orientedHeight = computed(() => props.rotate === 90 || props.rotate === 270 ? props.panel.width : props.panel.height)
const previewStyle = computed(() => ({
  width: `${orientedWidth.value}px`,
  height: `${orientedHeight.value}px`,
  borderRadius: props.panel.shape === 'round' ? '50%' : '18px',
  opacity: String(0.45 + (Math.min(100, Math.max(5, props.brightness)) / 100) * 0.55),
  backgroundColor: props.face.background,
}))
const dragVisual = shallowRef<{ id: string; x: number; y: number } | null>(null)
const detail = computed(() => props.apps.find((item) => item.id === props.detailId) || props.complications.find((item) => item.id === props.detailId))
const placedWidgets = computed(() => props.complications.map((widget, index) => {
  const placement = props.placements.find((item) => item.id === widget.id)
  const slot = props.face.slots.find((item) => item.id === placement?.slot) || props.face.slots[index % Math.max(1, props.face.slots.length)]
  let x = slot?.x ?? 50
  let y = slot?.y ?? 78
  if (props.placementMode === 'grid') {
    x = ((Math.min(props.face.columns - 1, placement?.column ?? index % props.face.columns) + 0.5) / props.face.columns) * 100
    y = ((Math.min(props.face.rows - 1, placement?.row ?? Math.floor(index / props.face.columns)) + 0.5) / props.face.rows) * 100
  } else if (props.placementMode === 'free') {
    x = placement?.x ?? 50
    y = placement?.y ?? 78
  }
  if (dragVisual.value?.id === widget.id) {
    x = dragVisual.value.x
    y = dragVisual.value.y
  }
  return { widget, x, y, scale: placement?.scale ?? 1 }
}))

type DragTarget = { id: string | null; pointerId: number; startX: number; startY: number; x: number; y: number }
let dragTarget: DragTarget | null = null

function accent(widget: DisplayWidget) {
  return accentColor(widget.accent)
}

function onPointerDown(event: PointerEvent) {
  dragX.value = event.clientX
}

function onPointerUp(event: PointerEvent) {
  const dx = event.clientX - dragX.value
  if (dx > 36 && props.mode === 'home') {
    appPage.value = 0
    emit('update:mode', 'apps')
  } else if (dx < -36 && props.mode === 'detail') {
    emit('update:mode', 'apps')
  } else if (dx < -36 && props.mode === 'apps') {
    if (appPage.value + 1 < appPageCount.value)
      appPage.value += 1
  } else if (dx > 36 && props.mode === 'apps') {
    if (appPage.value > 0)
      appPage.value -= 1
    else
      emit('update:mode', 'home')
  }
}

function openApp(id: string) {
  emit('update:detailId', id)
  emit('update:mode', 'detail')
}

function setAppView(value: AppView) {
  emit('update:appView', value)
}

function moveWidget(id: string, event: PointerEvent, drag: DragTarget) {
  const preview = (event.currentTarget as HTMLElement).closest('.display-preview') as HTMLElement | null
  if (!preview) return
  const rect = preview.getBoundingClientRect()
  const x = Math.max(10, Math.min(90, drag.x + (event.clientX - drag.startX) / rect.width * 100))
  const y = Math.max(10, Math.min(90, drag.y + (event.clientY - drag.startY) / rect.height * 100))
  if (props.placementMode === 'free') emit('moveWidget', id, { x: Math.round(x), y: Math.round(y) })
  if (props.placementMode !== 'free') dragVisual.value = { id, x, y }
}

function moveClock(event: PointerEvent, drag: DragTarget) {
  const preview = (event.currentTarget as HTMLElement).closest('.display-preview') as HTMLElement | null
  if (!preview) return
  const rect = preview.getBoundingClientRect()
  emit('moveClock', {
    x: Math.round(Math.max(10, Math.min(90, drag.x + (event.clientX - drag.startX) / rect.width * 100))),
    y: Math.round(Math.max(10, Math.min(90, drag.y + (event.clientY - drag.startY) / rect.height * 100))),
  })
}

function captureWidget(id: string, x: number, y: number, event: PointerEvent) {
  dragTarget = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x, y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function captureClock(event: PointerEvent) {
  dragTarget = { id: null, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: props.clockPosition.x, y: props.clockPosition.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function dragMove(event: PointerEvent) {
  const drag = dragTarget
  if (!drag || event.pointerId !== drag.pointerId) return
  if (drag.id === null) moveClock(event, drag)
  else moveWidget(drag.id, event, drag)
}

function endDrag(event: PointerEvent) {
  if (dragTarget?.pointerId !== event.pointerId) return
  dragMove(event)
  if (dragTarget.id && props.placementMode === 'grid' && dragVisual.value) {
    const { x, y } = dragVisual.value
    emit('moveWidget', dragTarget.id, {
      column: Math.min(props.face.columns - 1, Math.floor(x / 100 * props.face.columns)),
      row: Math.min(props.face.rows - 1, Math.floor(y / 100 * props.face.rows)),
    })
  }
  if (dragTarget.id && props.placementMode === 'fixed' && dragVisual.value) {
    const { x, y } = dragVisual.value
    const nearest = props.face.slots.reduce<typeof props.face.slots[number] | undefined>((best, slot) => {
      if (!best) return slot
      const distance = (slot.x - x) ** 2 + (slot.y - y) ** 2
      const bestDistance = (best.x - x) ** 2 + (best.y - y) ** 2
      return distance < bestDistance ? slot : best
    }, undefined)
    if (nearest) emit('moveWidget', dragTarget.id, { slot: nearest.id })
  }
  dragVisual.value = null
  dragTarget = null
}

watch(appPageCount, (count) => {
  if (appPage.value >= count)
    appPage.value = Math.max(0, count - 1)
})

onMounted(() => {
  clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer !== null)
    window.clearInterval(clockTimer)
})
</script>

<template>
  <div
    class="display-preview"
    :class="{ lock: props.hdmiOn, round: props.panel.shape === 'round' }"
    :style="previewStyle"
    role="img"
    :aria-label="`${props.panel.width}x${props.panel.height}`"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <div v-if="props.mode === 'home'" class="preview-home">
      <ClockWidget
        :time="clock"
        :seconds="now.getSeconds()"
        :date="date"
        :dial="props.face.dial"
        :panel-width="orientedWidth"
        :panel-height="orientedHeight"
        :x="props.clockPosition.x"
        :y="props.clockPosition.y"
        :scale="props.clockPosition.scale"
        @pointerdown.stop="captureClock"
        @pointermove.stop="dragMove"
        @pointerup.stop="endDrag"
        @pointercancel.stop="endDrag"
      />
      <div v-if="placedWidgets.length" class="orbs">
        <span
          v-for="item in placedWidgets"
          :key="item.widget.id"
          class="home-orb"
          :style="{ color: accent(item.widget), borderColor: accent(item.widget), left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.scale})` }"
          @pointerdown.stop="captureWidget(item.widget.id, item.x, item.y, $event)"
          @pointermove.stop="dragMove"
          @pointerup.stop="endDrag"
          @pointercancel.stop="endDrag"
        >
          <AppIcon v-if="item.widget.slots.includes('complication') && item.widget.icon" :name="item.widget.icon" :accent="accent(item.widget)" />
          <span v-else>{{ item.widget.slots.includes('complication') ? (item.widget.preview || widget.glyph) : item.widget.title.slice(0, 5) }}</span>
        </span>
      </div>
    </div>
    <div
      v-else-if="props.mode === 'apps'"
      class="preview-apps"
      :class="props.appView"
      :style="props.appView === 'icons' ? iconGridStyle : undefined"
    >
      <button
        v-for="widget in pagedApps"
        :key="widget.id"
        type="button"
        class="app"
        :class="props.appView"
        @click.stop="openApp(widget.id)"
      >
        <span class="orb" :style="props.appView === 'icons' ? iconOrbStyle : undefined">
          <AppIcon :name="widget.icon || widget.id" :accent="accent(widget)" />
        </span>
        <span v-if="props.appView === 'list'" class="label">{{ widget.title }}</span>
      </button>
    </div>
    <div v-else class="preview-detail">
      <span class="orb">
        <AppIcon v-if="detail" :name="detail.icon || detail.id" :accent="accent(detail)" />
      </span>
      <strong>{{ detail?.title || props.detailId }}</strong>
      <template v-if="props.detailId === 'settings'">
        <span>{{ props.brightness }}%</span>
        <div class="view-pills">
          <button type="button" :class="{ on: props.appView === 'icons' }" @click="setAppView('icons')">图标</button>
          <button type="button" :class="{ on: props.appView === 'list' }" @click="setAppView('list')">列表</button>
        </div>
      </template>
    </div>
  </div>
</template>
