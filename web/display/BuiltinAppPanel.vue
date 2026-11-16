<script setup lang="ts">
import { NSwitch } from 'naive-ui'

import AppIcon from './AppIcon.vue'

const props = defineProps<{
  id: string
  title: string
  hint: string
  accent: string
  inHome: boolean
  inApps: boolean
  canHome: boolean
  canApps: boolean
  homeLabel: string
  appsLabel: string
}>()

const emit = defineEmits<{
  'update:inHome': [value: boolean]
  'update:inApps': [value: boolean]
}>()
</script>

<template>
  <article class="builtin-app">
    <div class="builtin-app-icon" :style="{ color: props.accent, borderColor: props.accent }">
      <AppIcon :name="props.id" :accent="props.accent" />
    </div>
    <div class="builtin-app-copy">
      <strong>{{ props.title }}</strong>
      <p>{{ props.hint }}</p>
    </div>
    <label class="builtin-app-switch">
      <span>{{ props.homeLabel }}</span>
      <NSwitch :value="props.inHome" :disabled="!props.canHome" size="small" @update:value="emit('update:inHome', $event)" />
    </label>
    <label class="builtin-app-switch">
      <span>{{ props.appsLabel }}</span>
      <NSwitch :value="props.inApps" :disabled="!props.canApps" size="small" @update:value="emit('update:inApps', $event)" />
    </label>
  </article>
</template>
