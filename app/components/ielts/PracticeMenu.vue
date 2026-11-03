<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { haptic } from '@/core/ielts/ui'
const emit = defineEmits<{ keyboard: []; preferences: [] }>()
const open = ref(false)
const wrap = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const actions = [
  { id: 'keyboard', label: '打开键盘', name: '键盘', icon: 'keyboard' },
  { id: 'preferences', label: '偏好设置', name: '偏好', icon: 'settings' },
] as const
function close() {
  open.value = false
  trigger.value?.focus({ preventScroll: true })
}
function choose(id: 'keyboard' | 'preferences') {
  close()
  if (id === 'keyboard') emit('keyboard')
  else emit('preferences')
}
function outside(event: PointerEvent) {
  if (open.value && !wrap.value?.contains(event.target as Node)) close()
}
function key(event: KeyboardEvent) {
  if (!open.value) return
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    const items = Array.from(wrap.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      index < 0
        ? event.key === 'ArrowDown'
          ? 0
          : items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', key, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', key, true)
})
</script>
<template>
  <div ref="wrap" class="header-link-wrap study-menu" :class="{ open }">
    <button
      ref="trigger"
      class="icon-button header-link-button"
      aria-label="学习工具"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="study-orb-menu"
      @pointerdown="haptic()"
      @click="open = !open"
    >
      <Icon name="topics" />
    </button>
    <div id="study-orb-menu" class="lk-menu" role="menu" aria-label="学习工具" :aria-hidden="!open" :inert="!open">
      <div class="lk-orbs">
        <button
          v-for="(action, index) in actions"
          :key="action.id"
          class="lk-o"
          role="menuitem"
          :aria-label="action.label"
          :style="{ '--x': '0px', '--y': 52 + index * 46 + 'px', '--delay': index * 0.03 + 's' }"
          @click="choose(action.id)"
        >
          <Icon :name="action.icon" />
        </button>
      </div>
    </div>
    <Teleport to="body"
      ><Transition name="orb-mask"
        ><div v-if="open" class="topic-orb-backdrop" aria-hidden="true" @pointerdown.prevent="close" /></Transition
    ></Teleport>
  </div>
</template>
