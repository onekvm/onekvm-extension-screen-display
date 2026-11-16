<script setup lang="ts">
import { computed } from 'vue'
import clock0 from './assets/clock-0.png'
import clock1 from './assets/clock-1.png'
import clock2 from './assets/clock-2.png'
import clock3 from './assets/clock-3.png'
import clock4 from './assets/clock-4.png'
import clock5 from './assets/clock-5.png'
import clock6 from './assets/clock-6.png'
import clock7 from './assets/clock-7.png'
import clock8 from './assets/clock-8.png'
import clock9 from './assets/clock-9.png'
import colon from './assets/clock-colon.png'
import ticks from './assets/ticks.png'

const props = defineProps<{
  time: string
  seconds: number
  date: string
  dial: 'ticks' | 'plain'
  panelWidth: number
  panelHeight: number
  x: number
  y: number
  scale: number
}>()
const images = [clock0, clock1, clock2, clock3, clock4, clock5, clock6, clock7, clock8, clock9, colon]
const size = computed(() => Math.min(props.panelWidth, props.panelHeight) * props.scale)
const pip = computed(() => {
  const pipSize = Math.max(2, 6 * props.scale)
  const angle = props.seconds * Math.PI / 30
  const radius = size.value / 2 - 4 * props.scale
  return {
    width: `${pipSize}px`, height: `${pipSize}px`,
    left: `${size.value / 2 + radius * Math.sin(angle) - pipSize / 2}px`,
    top: `${size.value / 2 - radius * Math.cos(angle) - pipSize / 2}px`,
  }
})
const digits = computed(() => {
  const chars = props.time.split('')
  const widths = chars.map((char) => (char === ':' ? 19 : 34) * props.scale)
  const total = widths.reduce((sum, width) => sum + width, 0)
  let offset = 0
  return chars.map((char, index) => {
    const left = size.value / 2 - total / 2 + offset - (char === ':' ? 22 : 15) * props.scale
    offset += widths[index]
    return { src: images[char === ':' ? 10 : Number(char)], left }
  })
})
</script>

<template>
  <div class="preview-clock" :style="{ left: `${x}%`, top: `${y}%`, width: `${size}px`, height: `${size}px` }">
    <img v-if="dial === 'ticks'" class="clock-dial" :src="ticks" alt="" draggable="false" />
    <span v-if="dial === 'ticks'" class="clock-pip" :style="pip" aria-hidden="true" />
    <span class="clock-date" :style="{ top: `${size / 2 - 38 * scale}px` }">{{ date }}</span>
    <img v-for="(digit, index) in digits" :key="index" class="clock-digit" :src="digit.src" alt="" draggable="false" :style="{ left: `${digit.left}px`, top: `${size / 2 - 20 * scale}px`, width: `${64 * scale}px`, height: `${64 * scale}px` }" />
  </div>
</template>
