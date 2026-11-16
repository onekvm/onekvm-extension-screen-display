export const CLOCK_WIDGET_ID = 'clock'
export type PreviewMode = 'home' | 'apps' | 'detail'
export type PanelShape = 'round' | 'rect'
export type AppView = 'icons' | 'list'
export type PlacementMode = 'fixed' | 'grid' | 'free'
export type SettingValue = string | number | boolean | null
export type Settings = Record<string, SettingValue>

export interface DisplayWidget {
  id: string
  source: string
  title: string
  glyph: string
  icon: string
  subtitle: string
  accent: string
  on: boolean
  slots: string[]
  order: number
  builtin: boolean
  placement?: PlacementMode[]
  preview?: string
}

export interface FaceSlot { id: string; x: number; y: number }
export interface DisplayFace {
  id: string
  title: string
  dial: 'ticks' | 'plain'
  background: string
  modes: PlacementMode[]
  defaultMode: PlacementMode
  columns: number
  rows: number
  slots: FaceSlot[]
}

export interface HomeWidgetPlacement {
  id: string
  scale?: number
  slot?: string
  column?: number
  row?: number
  x?: number
  y?: number
}

export interface ScreenLayout {
  face: string
  mode: PlacementMode
  clock: { x: number; y: number; scale: number }
  home_widgets: HomeWidgetPlacement[]
  complications: string[]
  apps: string[]
  apps_hidden: string[]
  app_view: AppView
}

export interface PanelInfo {
  width: number
  height: number
  bpp: number
  shape: PanelShape
  device: string
}

export interface SettingsSchema {
  type?: string
  additionalProperties?: boolean
  required?: string[]
  properties?: Record<string, unknown>
}

export interface PageHost {
  apiVersion: 1
  extension: Readonly<{ value: {
    id?: string
    settings: Settings
    settings_schema?: SettingsSchema
  } }>
  getStatus: () => Promise<unknown>
  invoke: <T = unknown>(method: string, payload?: unknown) => Promise<T>
  registerSettings: (adapter: {
    dirty: Readonly<{ value: boolean }>
    valid: Readonly<{ value: boolean }>
    collect: () => Settings
    reset: (settings: Settings) => void
  }) => () => void
}

export const DEFAULT_LAYOUT: ScreenLayout = {
  face: 'screen-display/classic',
  mode: 'fixed',
  clock: { x: 50, y: 50, scale: 1 },
  home_widgets: [],
  complications: [],
  apps: [],
  apps_hidden: [],
  app_view: 'icons',
}

export const BUILTIN_FACES: DisplayFace[] = [
  {
    id: 'screen-display/classic', title: 'Classic', dial: 'ticks', background: '#000000',
    modes: ['fixed', 'grid', 'free'], defaultMode: 'fixed', columns: 4, rows: 4,
    slots: [
      { id: 'bottom-left', x: 34, y: 88 },
      { id: 'bottom-center', x: 50, y: 88 },
      { id: 'bottom-right', x: 66, y: 88 },
    ],
  },
  {
    id: 'screen-display/minimal', title: 'Minimal', dial: 'plain', background: '#05080c',
    modes: ['grid', 'free'], defaultMode: 'grid', columns: 4, rows: 4, slots: [],
  },
]

interface Contribution { id?: unknown; data?: unknown }

function contributionArray(raw: unknown): Contribution[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

const modes: PlacementMode[] = ['fixed', 'grid', 'free']
const validColor = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
export function accentColor(value: string): string {
  if (value === 'amber') return '#ffb000'
  if (value === 'cyan') return '#6ee7ff'
  if (value === 'violet') return '#c4b5fd'
  return validColor(value, '#f4f0e6')
}
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback

export function parseFaces(raw: unknown): DisplayFace[] {
  const faces = [...BUILTIN_FACES]
  for (const item of contributionArray(raw)) {
    if (typeof item.id !== 'string' || !item.id.includes('/') || !item.data || typeof item.data !== 'object') continue
    const data = item.data as Record<string, unknown>
    const supported = Array.isArray(data.modes) ? data.modes.filter((mode): mode is PlacementMode => modes.includes(mode as PlacementMode)) : []
    if (!supported.length) continue
    const slotNames = new Set<string>()
    const slots = Array.isArray(data.slots) ? data.slots.flatMap((value): FaceSlot[] => {
      if (!value || typeof value !== 'object') return []
      const slot = value as Record<string, unknown>
      if (typeof slot.id !== 'string' || !/^[a-z0-9_-]{1,31}$/.test(slot.id) || slotNames.has(slot.id)) return []
      slotNames.add(slot.id)
      return [{ id: slot.id, x: bounded(slot.x, 50, 0, 100), y: bounded(slot.y, 50, 0, 100) }]
    }) : []
    const validModes = supported.filter((mode) => mode !== 'fixed' || slots.length > 0)
    if (!validModes.length) continue
    faces.push({
      id: item.id,
      title: typeof data.title === 'string' ? data.title.slice(0, 64) : item.id,
      dial: data.dial === 'plain' ? 'plain' : 'ticks',
      background: validColor(data.background, '#000000'),
      modes: validModes,
      defaultMode: validModes.includes(data.default_mode as PlacementMode) ? data.default_mode as PlacementMode : validModes[0],
      columns: Math.floor(bounded((data.grid as Record<string, unknown> | undefined)?.columns, 4, 1, 8)),
      rows: Math.floor(bounded((data.grid as Record<string, unknown> | undefined)?.rows, 4, 1, 8)),
      slots,
    })
  }
  return faces.filter((face) => face.modes.length > 0)
}

export function parseContributedWidgets(raw: unknown): DisplayWidget[] {
  return contributionArray(raw).flatMap((item): DisplayWidget[] => {
    if (typeof item.id !== 'string' || !item.id.includes('/') || !item.data || typeof item.data !== 'object') return []
    const data = item.data as Record<string, unknown>
    const placement = Array.isArray(data.placement) ? data.placement.filter((mode): mode is PlacementMode => modes.includes(mode as PlacementMode)) : modes
    if (!placement.length) return []
    return [{
      id: item.id, source: item.id.split('/')[0],
      title: typeof data.title === 'string' ? data.title.slice(0, 64) : item.id,
      glyph: typeof data.glyph === 'string' ? data.glyph.slice(0, 2) : '•',
      icon: typeof data.icon === 'string' ? data.icon : '',
      subtitle: typeof data.preview === 'string' ? data.preview.slice(0, 24) : '',
      preview: typeof data.preview === 'string' ? data.preview.slice(0, 24) : undefined,
      accent: validColor(data.accent, '#f4f0e6'), on: true,
      slots: ['complication'], placement, order: 50, builtin: false,
    }]
  })
}

export function parsePluginApps(raw: unknown): DisplayWidget[] {
  const text = typeof raw === 'string' ? raw : ''
  if (!text.trim())
    return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed))
      return []
    const widgets: DisplayWidget[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (!item || typeof item !== 'object')
        continue
      const rec = item as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id : ''
      if (!id || seen.has(id))
        continue
      seen.add(id)
      const slots = Array.isArray(rec.slots)
        ? rec.slots.filter((slot): slot is string => typeof slot === 'string')
        : ['app']
      widgets.push({
        id,
        source: typeof rec.source === 'string' ? rec.source : 'plugin',
        title: typeof rec.title === 'string' && rec.title ? rec.title : id,
        glyph: typeof rec.glyph === 'string' ? rec.glyph : id.slice(0, 1),
        icon: typeof rec.icon === 'string' && rec.icon ? rec.icon.replace(/\.png$/, '') : id,
        subtitle: typeof rec.subtitle === 'string' ? rec.subtitle : id,
        accent: typeof rec.accent === 'string' ? rec.accent : 'ink',
        on: rec.on !== false,
        slots: slots.length ? slots : ['app'],
        order: typeof rec.order === 'number' ? rec.order : 50,
        builtin: false,
      })
    }
    return widgets.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  } catch {
    return []
  }
}

export const FALLBACK_SETTING_KEYS = [
  'service_enabled',
  'transition',
  'transition_ms',
  'layout_json',
  'brightness',
] as const

export function settingKeys(schema?: SettingsSchema): string[] {
  const names = Object.keys(schema?.properties || {})
  return names.length ? names : [...FALLBACK_SETTING_KEYS]
}

export function hasSetting(schema: SettingsSchema | undefined, name: string): boolean {
  return settingKeys(schema).includes(name)
}

export function normalizeRotate(value: unknown): 0 | 90 | 180 | 270 {
  const n = Number(value)
  if (n === 90 || n === 180 || n === 270)
    return n
  return 0
}

export interface LauncherLayout {
  iconColumns: number
  iconRows: number
  iconSize: number
  listRows: number
}

export const DEFAULT_LAUNCHER: LauncherLayout = {
  iconColumns: 3,
  iconRows: 3,
  iconSize: 52,
  listRows: 4,
}

export function parseLauncher(raw: unknown): LauncherLayout {
  const next = { ...DEFAULT_LAUNCHER }
  const text = typeof raw === 'string' ? raw : ''
  if (!text.trim())
    return next
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const columns = Number(parsed.icon_columns)
    const rows = Number(parsed.icon_rows)
    const size = Number(parsed.icon_size)
    const listRows = Number(parsed.list_rows)
    if (columns >= 1 && columns <= 5)
      next.iconColumns = Math.floor(columns)
    if (rows >= 1 && rows <= 5)
      next.iconRows = Math.floor(rows)
    if (size >= 24 && size <= 96)
      next.iconSize = Math.floor(size)
    if (listRows >= 1 && listRows <= 8)
      next.listRows = Math.floor(listRows)
  } catch {
    /* keep defaults */
  }
  return next
}

export const DEFAULT_PANEL: PanelInfo = {
  width: 240,
  height: 240,
  bpp: 16,
  shape: 'round',
  device: '/dev/fb0',
}

export function parsePanel(raw: unknown): PanelInfo {
  if (typeof raw !== 'string') return { ...DEFAULT_PANEL }
  try {
    const value = JSON.parse(raw) as Partial<PanelInfo>
    return {
      width: bounded(value.width, DEFAULT_PANEL.width, 64, 4096),
      height: bounded(value.height, DEFAULT_PANEL.height, 64, 4096),
      bpp: bounded(value.bpp, 16, 1, 32),
      shape: value.shape === 'rect' ? 'rect' : 'round',
      device: typeof value.device === 'string' ? value.device : DEFAULT_PANEL.device,
    }
  } catch { return { ...DEFAULT_PANEL } }
}

export function parseLayout(raw: unknown): ScreenLayout {
  if (typeof raw !== 'string' || !raw.trim())
    return { ...DEFAULT_LAYOUT, home_widgets: [], complications: [], apps: [], apps_hidden: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<ScreenLayout>
    const complications = Array.isArray(parsed.complications)
      ? parsed.complications.filter((id): id is string => typeof id === 'string')
      : [...DEFAULT_LAYOUT.complications]
    const apps = Array.isArray(parsed.apps)
      ? parsed.apps.filter((id): id is string => typeof id === 'string')
      : [...DEFAULT_LAYOUT.apps]
    const apps_hidden = Array.isArray(parsed.apps_hidden)
      ? parsed.apps_hidden.filter((id): id is string => typeof id === 'string')
      : []
    const app_view = parsed.app_view === 'list' ? 'list' : 'icons'
    const home_widgets = Array.isArray(parsed.home_widgets)
      ? parsed.home_widgets.flatMap((entry): HomeWidgetPlacement[] => {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return []
        return [{ id: entry.id,
          slot: typeof entry.slot === 'string' ? entry.slot : undefined,
          column: bounded(entry.column, 0, 0, 7), row: bounded(entry.row, 0, 0, 7),
          x: bounded(entry.x, 50, 0, 100), y: bounded(entry.y, 88, 0, 100),
          scale: bounded(entry.scale, 1, 0.5, 1.5),
        }]
      })
      : complications.map((id, index) => ({ id, slot: BUILTIN_FACES[0].slots[index % 3].id, x: 34 + index * 16, y: 88 }))
    const clock = parsed.clock && typeof parsed.clock === 'object' ? parsed.clock : DEFAULT_LAYOUT.clock
    return {
      face: typeof parsed.face === 'string' ? parsed.face : DEFAULT_LAYOUT.face,
      mode: modes.includes(parsed.mode as PlacementMode) ? parsed.mode as PlacementMode : DEFAULT_LAYOUT.mode,
      clock: { x: bounded(clock.x, 50, 10, 90), y: bounded(clock.y, 50, 10, 90), scale: bounded(clock.scale, 1, 0.5, 1.5) },
      home_widgets, complications, apps, apps_hidden, app_view,
    }
  } catch {
    return { ...DEFAULT_LAYOUT, home_widgets: [], complications: [], apps: [], apps_hidden: [] }
  }
}
