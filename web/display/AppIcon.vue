<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = defineProps<{
  name: string
  accent?: string
}>()

const LUCIDE_BY_WIDGET: Record<string, string> = {
  settings: 'Settings',
  hdmi: 'HdmiPort',
  usb: 'Usb',
  net: 'Network',
  stream: 'MonitorPlay',
  stick: 'Pointer',
  clock: 'Clock',
}

const Icon = computed<Component | undefined>(() => {
  const icons = window.OneKVMPluginUI?.v1.icons
  if (!icons)
    return undefined
  const key = LUCIDE_BY_WIDGET[props.name] ?? 'Circle'
  return (icons[key] ?? icons.Circle) as Component | undefined
})
</script>

<template>
  <component
    v-if="Icon"
    :is="Icon"
    class="app-icon"
    :size="22"
    :color="accent || 'currentColor'"
    :stroke-width="1.8"
    aria-hidden="true"
  />
</template>
