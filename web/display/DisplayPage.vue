<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NAlert, NButton, NDropdown, NSelect, NSlider, NSwitch, NTabPane, NTabs } from 'naive-ui'

import DisplayPreview from './DisplayPreview.vue'
import ScreenLayerToolbar, { type ScreenToolbarState } from './ScreenLayerToolbar.vue'
import WidgetList, { type WidgetListItem } from './WidgetList.vue'
import { detectLocale, translate, type MessageKey } from './i18n'
import {
  CLOCK_WIDGET_ID,
  DEFAULT_LAUNCHER,
  DEFAULT_LAYOUT,
  DEFAULT_PANEL,
  BUILTIN_FACES,
  accentColor,
  hasSetting,
  normalizeRotate,
  parseLauncher,
  parseLayout,
  parsePanel,
  parsePluginApps,
  parseContributedWidgets,
  parseFaces,
  settingKeys,
  type DisplayWidget,
  type DisplayFace,
  type HomeWidgetPlacement,
  type PlacementMode,
  type LauncherLayout,
  type PageHost,
  type PanelInfo,
  type PreviewMode,
  type ScreenLayout,
  type Settings,
  type SettingsSchema,
} from './types'

const props = defineProps<{ host: PageHost }>()

const locale = ref(detectLocale())
const pageError = ref('')
const pageNoticeKey = ref<MessageKey | ''>('')
const noPanel = ref(false)
const panel = ref<PanelInfo>({ ...DEFAULT_PANEL })
const enabled = ref(true)
const transition = ref('slide')
const brightness = ref(100)
const rotate = ref<0 | 90 | 180 | 270>(0)
const layout = ref<ScreenLayout>(parseLayout(''))
const mode = ref<PreviewMode>('home')
const detailId = ref('')
const selectedId = ref(CLOCK_WIDGET_ID)
const plugins = ref<DisplayWidget[]>([])
const widgets = ref<DisplayWidget[]>([])
const contributedWidgets = ref<DisplayWidget[]>([])
const faces = ref<DisplayFace[]>([...BUILTIN_FACES])
const launcher = ref<LauncherLayout>({ ...DEFAULT_LAUNCHER })
const hdmiOn = ref(false)
const usbOn = ref(false)
const ip = ref('--.--.--.--')
const dirty = ref(false)
const valid = ref(true)
let unregisterSettings: (() => void) | null = null
let localeObserver: MutationObserver | null = null
let baseline = ''

const t = (key: MessageKey, values: Record<string, string | number> = {}) => translate(locale.value, key, values)
const schema = computed<SettingsSchema | undefined>(() => props.host.extension.value.settings_schema)
const pageNotice = computed(() => pageNoticeKey.value ? t(pageNoticeKey.value) : '')
const catalog = computed(() => {
  const byId = new Map<string, DisplayWidget>()
  for (const widget of [...plugins.value, ...widgets.value, ...contributedWidgets.value])
    byId.set(widget.id, widget)
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
})
const catalogApps = computed(() => catalog.value.filter((widget) => widget.slots.includes('app') || widget.slots.length === 0))
const homeWidgetCatalog = computed(() => catalog.value.filter((widget) => widget.slots.includes('complication')))
const widgetById = computed(() => {
  const map = new Map(catalog.value.map((widget) => [widget.id, widget]))
  return map
})
const previewComplications = computed(() => layout.value.home_widgets
  .map((placement) => placement.id)
  .map((id) => widgetById.value.get(id))
  .filter((widget): widget is DisplayWidget => Boolean(widget?.slots.includes('complication'))))
const selectedFace = computed(() => faces.value.find((face) => face.id === layout.value.face) || BUILTIN_FACES[0])
const faceOptions = computed(() => faces.value.map((face) => ({ label: face.title, value: face.id })))
const modeOptions = computed(() => selectedFace.value.modes.map((mode) => ({
  label: t(mode === 'fixed' ? 'fixedMode' : mode === 'grid' ? 'gridMode' : 'freeMode'), value: mode,
  disabled: mode === 'fixed' && layout.value.home_widgets.length > selectedFace.value.slots.length,
})))
const selectedPlacement = computed(() => layout.value.home_widgets.find((item) => item.id === selectedId.value))
const slotOptions = computed(() => selectedFace.value.slots.map((slot) => ({ label: slot.id, value: slot.id })))
const previewApps = computed(() => {
  const hidden = new Set(layout.value.apps_hidden)
  const ordered: string[] = []
  const seen = new Set<string>()
  const saved = layout.value.apps.length
    ? layout.value.apps
    : catalogApps.value.map((widget) => widget.id)
  for (const id of saved) {
    if (hidden.has(id) || seen.has(id) || !widgetById.value.has(id))
      continue
    seen.add(id)
    ordered.push(id)
  }
  for (const widget of catalogApps.value) {
    if (hidden.has(widget.id) || seen.has(widget.id))
      continue
    seen.add(widget.id)
    ordered.push(widget.id)
  }
  return ordered
    .map((id) => widgetById.value.get(id))
    .filter((widget): widget is DisplayWidget => Boolean(widget))
})
const currentSlot = computed<'complications' | 'apps'>(() => mode.value === 'home' ? 'complications' : 'apps')
function listItem(widget: DisplayWidget, type: 'complicationType' | 'appType'): WidgetListItem {
  return {
    id: widget.id,
    name: widget.title,
    type,
    icon: widget.icon || widget.id,
    accent: accentColor(widget.accent),
    hidden: false,
    pinned: false,
    selected: selectedId.value === widget.id,
    preview: widget.slots.includes('complication') && !widget.icon ? widget.preview || widget.glyph : undefined,
  }
}

const pageItems = computed<WidgetListItem[]>(() => {
  if (mode.value === 'home') {
    return [
      {
        id: CLOCK_WIDGET_ID,
        name: t('clock'),
        type: 'clockType',
        icon: 'clock',
        accent: '#f4f0e6',
        hidden: false,
        pinned: true,
        selected: selectedId.value === CLOCK_WIDGET_ID,
      },
      ...previewComplications.value.map((widget) => listItem(widget, 'complicationType')),
    ]
  }
  return previewApps.value.map((widget) => listItem(widget, 'appType'))
})
const visibleOnPage = computed(() => pageItems.value.length)
const toolbarState = computed<ScreenToolbarState>(() => {
  const ids = pageItems.value.map((item) => item.id)
  const index = ids.indexOf(selectedId.value)
  const item = pageItems.value[index]
  const clock = mode.value === 'home' && selectedId.value === CLOCK_WIDGET_ID
  const placement = mode.value === 'home' ? selectedPlacement.value : undefined
  const canPosition = clock || Boolean(placement && layout.value.mode === 'free')
  return {
    count: ids.length,
    name: item?.name || '',
    type: item ? t(item.type as MessageKey) : '',
    x: Math.round(clock ? layout.value.clock.x : placement?.x ?? 50),
    y: Math.round(clock ? layout.value.clock.y : placement?.y ?? 50),
    scale: Math.round((clock ? layout.value.clock.scale : placement?.scale ?? 1) * 100),
    showGeometry: mode.value === 'home',
    canPosition,
    canScale: clock || Boolean(placement),
    canRemove: Boolean(item && !item.pinned),
    canMoveUp: Boolean(item && !item.pinned && index > (mode.value === 'home' ? 1 : 0)),
    canMoveDown: Boolean(item && !item.pinned && index < ids.length - 1),
  }
})
function slotIds(slot: 'complications' | 'apps'): string[] {
  if (slot === 'apps')
    return previewApps.value.map((widget) => widget.id)
  return layout.value.home_widgets.map((item) => item.id)
}

const addWidgetOptions = computed(() => {
  const slot = currentSlot.value
  if (slot === 'complications' && layout.value.mode === 'fixed' && layout.value.home_widgets.length >= selectedFace.value.slots.length)
    return []
  const present = new Set(slotIds(slot))
  const pool = slot === 'apps' ? catalogApps.value : homeWidgetCatalog.value.filter((widget) =>
    !widget.placement || widget.placement.includes(layout.value.mode))
  return pool
    .filter((widget) => !present.has(widget.id))
    .map((widget) => ({ label: widget.title, key: widget.id }))
})
const panelMeta = computed(() => t('panelMeta', {
  width: panel.value.width,
  height: panel.value.height,
  shape: t(panel.value.shape === 'round' ? 'round' : 'rect'),
  device: panel.value.device,
}))
const transitionOptions = computed(() => [
  { label: t('slide'), value: 'slide' },
  { label: t('fade'), value: 'fade' },
])
const rotationOptions = computed(() => [
  { label: t('rotation0'), value: 0 },
  { label: t('rotation90'), value: 90 },
  { label: t('rotation180'), value: 180 },
  { label: t('rotation270'), value: 270 },
])
const showEnable = computed(() => hasSetting(schema.value, 'service_enabled'))
const showTransition = computed(() => hasSetting(schema.value, 'transition'))
const showBrightness = computed(() => hasSetting(schema.value, 'brightness'))
const showRotate = computed(() => hasSetting(schema.value, 'rotate'))

function collectAll(): Settings {
  return {
    service_enabled: enabled.value,
    transition: transition.value,
    transition_ms: 280,
    layout_json: JSON.stringify(layout.value),
    brightness: brightness.value,
    rotate: rotate.value,
    app_view: layout.value.app_view,
  }
}

function collectSettings(): Settings {
  const all = collectAll()
  const out: Settings = {}
  for (const key of settingKeys(schema.value)) {
    if (Object.prototype.hasOwnProperty.call(all, key))
      out[key] = all[key]
  }
  return out
}

function snapshot() {
  return JSON.stringify(collectSettings())
}

function applySettings(settings: Settings) {
  enabled.value = settings.service_enabled !== false
  transition.value = String(settings.transition || 'slide')
  const nextBrightness = Number(settings.brightness)
  brightness.value = Number.isFinite(nextBrightness) ? Math.min(100, Math.max(5, nextBrightness)) : 100
  rotate.value = normalizeRotate(settings.rotate)
  layout.value = parseLayout(settings.layout_json)
  panel.value = parsePanel(settings.panel_json)
  if (settings.app_view === 'list' || settings.app_view === 'icons')
    layout.value = { ...layout.value, app_view: settings.app_view }
  plugins.value = parsePluginApps(settings.apps_json)
  contributedWidgets.value = parseContributedWidgets(settings.widgets_json)
  faces.value = parseFaces(settings.faces_json)
  launcher.value = parseLauncher(settings.launcher_json)
  baseline = snapshot()
  dirty.value = false
}

function markDirty() {
  dirty.value = snapshot() !== baseline
}

function setSlot(id: string, slot: 'complications' | 'apps', on: boolean) {
  const widget = widgetById.value.get(id)
  if (!widget || (slot === 'apps' ? !widget.slots.includes('app') : !widget.slots.includes('complication'))) return
  if (slot === 'apps') {
    const hidden = layout.value.apps_hidden.filter((item) => item !== id)
    const apps = slotIds('apps').filter((item) => item !== id)
    if (on)
      apps.push(id)
    else
      hidden.push(id)
    layout.value = { ...layout.value, apps, apps_hidden: hidden }
    markDirty()
    return
  }
  const next = slotIds(slot).filter((item) => item !== id)
  if (on)
    next.push(id)
  const placements = layout.value.home_widgets.filter((item) => item.id !== id)
  if (on) {
    const freeSlot = selectedFace.value.slots.find((item) => !placements.some((entry) => entry.slot === item.id))
    placements.push({ id, slot: freeSlot?.id, column: placements.length % selectedFace.value.columns,
      row: Math.floor(placements.length / selectedFace.value.columns), x: freeSlot?.x ?? 50, y: freeSlot?.y ?? 78 })
  }
  layout.value = { ...layout.value, [slot]: next, home_widgets: placements }
  markDirty()
}

function setFace(id: string) {
  const face = faces.value.find((item) => item.id === id)
  if (!face) return
  const mode = face.defaultMode === 'fixed' && layout.value.home_widgets.length > face.slots.length
    ? (face.modes.find((item) => item !== 'fixed') || 'fixed') : face.defaultMode
  const home_widgets = mode === 'fixed'
    ? layout.value.home_widgets.map((item, index) => ({ ...item, slot: face.slots[index]?.id }))
    : layout.value.home_widgets
  layout.value = { ...layout.value, face: id, mode, home_widgets }
  markDirty()
}

function setMode(mode: PlacementMode) {
  if (!selectedFace.value.modes.includes(mode)) return
  if (mode === 'fixed' && layout.value.home_widgets.length > selectedFace.value.slots.length) return
  layout.value = { ...layout.value, mode, home_widgets: mode === 'fixed'
    ? layout.value.home_widgets.map((item, index) => ({ ...item, slot: selectedFace.value.slots[index]?.id }))
    : layout.value.home_widgets }
  markDirty()
}

function updatePlacement(patch: Partial<HomeWidgetPlacement>) {
  const previous = selectedPlacement.value
  const targetColumn = patch.column ?? previous?.column
  const targetRow = patch.row ?? previous?.row
  const next = layout.value.home_widgets.map((item) => {
    if (item.id === selectedId.value) return { ...item, ...patch }
    if (patch.slot !== undefined && item.slot === patch.slot) return { ...item, slot: previous?.slot }
    if ((patch.column !== undefined || patch.row !== undefined) && item.column === targetColumn && item.row === targetRow)
      return { ...item, column: previous?.column, row: previous?.row }
    return item
  })
  layout.value = { ...layout.value, home_widgets: next }
  markDirty()
}

function moveWidget(id: string, patch: Partial<HomeWidgetPlacement>) {
  selectedId.value = id
  updatePlacement(patch)
}

function moveClock(point: Partial<ScreenLayout['clock']>) {
  selectedId.value = CLOCK_WIDGET_ID
  layout.value = { ...layout.value, clock: { ...layout.value.clock, ...point } }
  markDirty()
}

function addWidget(key: string | number) {
  const id = String(key)
  if (!widgetById.value.has(id))
    return
  setSlot(id, currentSlot.value, true)
  selectedId.value = id
}

function toggleWidget(id: string) {
  if (id === CLOCK_WIDGET_ID)
    return
  const slot = currentSlot.value
  setSlot(id, slot, !slotIds(slot).includes(id))
  selectedId.value = id
}

function selectWidget(id: string) {
  selectedId.value = id
  if (id !== CLOCK_WIDGET_ID && mode.value !== 'home')
    detailId.value = id
}

function reorderWidget(source: string, target: string, before: boolean) {
  const slot = currentSlot.value
  const present = slotIds(slot)
  const ids = present.filter((id) => id !== source)
  if (!present.includes(source))
    return
  let index = ids.indexOf(target)
  if (index < 0)
    return
  if (!before)
    index += 1
  ids.splice(index, 0, source)
  layout.value = { ...layout.value, [slot]: ids,
    home_widgets: slot === 'complications' ? ids.flatMap((id) => layout.value.home_widgets.filter((item) => item.id === id)) : layout.value.home_widgets }
  markDirty()
}

function updateToolbar(field: 'x' | 'y' | 'scale', value: number) {
  if (field === 'scale' ? !toolbarState.value.canScale : !toolbarState.value.canPosition) return
  const patch = field === 'scale' ? { scale: value / 100 } : { [field]: value }
  if (selectedId.value === CLOCK_WIDGET_ID) moveClock(patch)
  else updatePlacement(patch)
}

function runToolbarAction(action: 'center-x' | 'center-y' | 'move-up' | 'move-down' | 'remove') {
  const id = selectedId.value
  if (action === 'center-x' || action === 'center-y') {
    if (toolbarState.value.canPosition) updateToolbar(action === 'center-x' ? 'x' : 'y', 50)
    return
  }
  if (action === 'remove') {
    if (!toolbarState.value.canRemove) return
    setSlot(id, currentSlot.value, false)
    selectedId.value = mode.value === 'home' ? CLOCK_WIDGET_ID : (previewApps.value[0]?.id || '')
    return
  }
  const ids = slotIds(currentSlot.value)
  const index = ids.indexOf(id)
  const next = index + (action === 'move-up' ? -1 : 1)
  if (index < 0 || next < 0 || next >= ids.length) return
  if (action === 'move-up' && !toolbarState.value.canMoveUp) return
  if (action === 'move-down' && !toolbarState.value.canMoveDown) return
  reorderWidget(id, ids[next], action === 'move-up')
}

function runCanvasAction(key: string | number) {
  if (key !== 'restore')
    return
  layout.value = {
    face: DEFAULT_LAYOUT.face,
    mode: DEFAULT_LAYOUT.mode,
    clock: { ...DEFAULT_LAYOUT.clock },
    home_widgets: [],
    complications: [...DEFAULT_LAYOUT.complications],
    apps: [...DEFAULT_LAYOUT.apps],
    apps_hidden: [],
    app_view: layout.value.app_view,
  }
  selectedId.value = mode.value === 'home' ? CLOCK_WIDGET_ID : (layout.value.apps[0] || '')
  pageError.value = ''
  pageNoticeKey.value = 'restoredDefault'
  markDirty()
}

onMounted(async () => {
  localeObserver = new MutationObserver(() => { locale.value = detectLocale() })
  localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  applySettings(props.host.extension.value.settings || {})
  try {
    const status = await props.host.getStatus() as { hdmi_connected?: boolean; network?: { ip?: string } }
    hdmiOn.value = Boolean(status.hdmi_connected)
    if (status.network?.ip)
      ip.value = status.network.ip
  } catch {
    /* preview still works */
  }
  try {
    const info = await props.host.invoke<{ ok?: boolean; width?: number; height?: number; bpp?: number; shape?: string; device?: string; error?: string }>('info')
    if (!info?.ok) {
      noPanel.value = true
    } else {
      panel.value = {
        width: Number(info.width) || DEFAULT_PANEL.width,
        height: Number(info.height) || DEFAULT_PANEL.height,
        bpp: Number(info.bpp) || 16,
        shape: info.shape === 'rect' ? 'rect' : 'round',
        device: info.device || '/dev/fb0',
      }
      noPanel.value = false
    }
  } catch {
    noPanel.value = true
  }
  if (noPanel.value) return
  try {
    const listed = await props.host.invoke<{ widgets?: DisplayWidget[] }>('list')
    widgets.value = listed.widgets || []
  } catch {
    widgets.value = []
  }
  unregisterSettings = props.host.registerSettings({
    dirty,
    valid,
    collect: collectSettings,
    reset: applySettings,
  })
})

watch([enabled, transition, brightness, rotate, layout], markDirty, { deep: true })
watch(catalog, (items) => {
  if (!items.length) return
  const byId = new Map(items.map((item) => [item.id, item]))
  const home_widgets = layout.value.home_widgets.filter((placement) => {
    const widget = byId.get(placement.id)
    return !widget || widget.slots.includes('complication')
  })
  if (home_widgets.length === layout.value.home_widgets.length) return
  layout.value = {
    ...layout.value,
    home_widgets,
    complications: home_widgets.map((placement) => placement.id),
  }
  if (selectedId.value !== CLOCK_WIDGET_ID && !home_widgets.some((placement) => placement.id === selectedId.value))
    selectedId.value = CLOCK_WIDGET_ID
  markDirty()
})

onBeforeUnmount(() => {
  localeObserver?.disconnect()
  unregisterSettings?.()
})
</script>

<template>
  <div class="screen-display-page">
    <NAlert v-if="pageError" type="error" :show-icon="false" closable @close="pageError = ''">
      {{ pageError }}
    </NAlert>
    <NAlert v-if="pageNotice" type="success" :show-icon="false" closable @close="pageNoticeKey = ''">
      {{ pageNotice }}
    </NAlert>
    <NAlert v-if="noPanel" type="warning" :show-icon="false">
      {{ t('noPanel') }}
    </NAlert>

    <NTabs v-if="!noPanel" type="line" animated class="display-page-tabs">
      <NTabPane name="designer" :tab="t('designerTab')" display-directive="show">
        <section class="preview-card">
          <header class="section-head">
            <div>
              <h1>{{ t('title') }}</h1>
              <p>{{ t('previewHint') }}</p>
              <p class="meta">{{ panelMeta }}</p>
            </div>
          </header>
          <div class="canvas-workspace">
            <div class="canvas-column">
              <div class="face-controls" v-if="mode === 'home'">
                <label><span>{{ t('face') }}</span><NSelect :value="layout.face" :options="faceOptions" @update:value="setFace(String($event))" /></label>
                <label><span>{{ t('placement') }}</span><NSelect :value="layout.mode" :options="modeOptions" @update:value="setMode($event as PlacementMode)" /></label>
              </div>
              <div class="canvas-stage">
                <div
                  class="display-shell"
                  :class="{ disabled: !enabled }"
                >
                  <DisplayPreview
                    :panel="panel"
                    :mode="mode"
                    :hdmi-on="hdmiOn"
                    :usb-on="usbOn"
                    :ip="ip"
                    :brightness="brightness"
                    :rotate="rotate"
                    :app-view="layout.app_view"
                    :complications="previewComplications"
                    :face="selectedFace"
                    :placement-mode="layout.mode"
                    :placements="layout.home_widgets"
                    :clock-position="layout.clock"
                    :apps="previewApps"
                    :launcher="launcher"
                    :detail-id="detailId"
                    @update:detail-id="detailId = $event; selectedId = $event"
                    @update:app-view="layout.app_view = $event; markDirty()"
                    @move-widget="moveWidget"
                    @move-clock="moveClock"
                  />
                </div>
              </div>
              <ScreenLayerToolbar
                :state="toolbarState"
                :labels="{
                  empty: t('toolbarEmpty'), select: t('toolbarSelect'), size: t('toolbarSize'),
                  centerX: t('centerHorizontal'), centerY: t('centerVertical'),
                  moveUp: t('moveUp'), moveDown: t('moveDown'), remove: t('removeWidget'),
                }"
                @update="updateToolbar"
                @action="runToolbarAction"
              />
              <div v-if="selectedPlacement && layout.mode !== 'free'" class="widget-inspector">
                <div class="placement-controls">
                  <label v-if="layout.mode === 'fixed'"><span>{{ t('slot') }}</span><NSelect :value="selectedPlacement.slot" :options="slotOptions" @update:value="updatePlacement({ slot: String($event) })" /></label>
                  <template v-else-if="layout.mode === 'grid'">
                    <label><span>{{ t('column') }}</span><NSlider :value="selectedPlacement.column ?? 0" :min="0" :max="selectedFace.columns - 1" :step="1" @update:value="updatePlacement({ column: $event })" /></label>
                    <label><span>{{ t('row') }}</span><NSlider :value="selectedPlacement.row ?? 0" :min="0" :max="selectedFace.rows - 1" :step="1" @update:value="updatePlacement({ row: $event })" /></label>
                  </template>
                </div>
              </div>
            </div>
            <aside class="canvas-layers">
              <header class="panel-head">
                <div>
                  <h2>{{ t('layers') }}</h2>
                  <p>{{ t('widgetsOnPage', { count: visibleOnPage }) }}</p>
                </div>
                <div class="add-widget-host">
                  <NButton size="small" quaternary @click="runCanvasAction('restore')">
                    {{ t('restoreDefault') }}
                  </NButton>
                  <NDropdown
                    trigger="click"
                    placement="bottom-end"
                    :options="addWidgetOptions"
                    :disabled="!addWidgetOptions.length"
                    @select="addWidget"
                  >
                    <NButton size="small" secondary :disabled="!addWidgetOptions.length">
                      {{ t('addWidget') }}
                    </NButton>
                  </NDropdown>
                </div>
              </header>
              <p v-if="!homeWidgetCatalog.length" class="widget-list-empty">{{ t('noHomeWidgets') }}</p>
              <WidgetList
                :items="pageItems"
                :labels="{
                  empty: t('selectHint'),
                  showWidget: t('showWidget'),
                  hideWidget: t('hideWidget'),
                  clockType: t('clockType'),
                  complicationType: t('complicationType'),
                  appType: t('appType'),
                }"
                @select="selectWidget"
                @toggle="toggleWidget"
                @reorder="reorderWidget"
              />
            </aside>
          </div>
        </section>
      </NTabPane>

      <NTabPane name="settings" :tab="t('settingsTab')" display-directive="show">
        <section class="settings-card">
          <label v-if="showEnable" class="toggle">
            <span>{{ t('enable') }}</span>
            <NSwitch v-model:value="enabled" />
          </label>
          <label v-if="showBrightness" class="field">
            <span>{{ t('brightness') }} · {{ brightness }}%</span>
            <NSlider v-model:value="brightness" :min="5" :max="100" :step="5" />
          </label>
          <label v-if="showRotate" class="field">
            <span>{{ t('direction') }}</span>
            <NSelect :value="rotate" :options="rotationOptions" @update:value="rotate = normalizeRotate($event)" />
          </label>
          <label v-if="showTransition" class="field">
            <span>{{ t('transition') }}</span>
            <NSelect v-model:value="transition" :options="transitionOptions" />
          </label>
        </section>
      </NTabPane>
    </NTabs>
  </div>
</template>
