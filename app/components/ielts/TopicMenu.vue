<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Icon from './Icon.vue'
const props = defineProps<{ open: boolean; selected: string; topics: { id: string; name: string }[]; busy?: boolean }>()
const emit = defineEmits<{ toggle: []; close: []; select: [string] }>()
const wrap = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
function outside(event: PointerEvent) {
  if (props.open && !wrap.value?.contains(event.target as Node)) emit('close')
}
function key(event: KeyboardEvent) {
  if (!props.open) return
  const buttons = Array.from(wrap.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || [])
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    trigger.value?.focus()
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      index < 0
        ? event.key === 'ArrowDown'
          ? 0
          : buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
}
watch(
  () => props.open,
  async open => {
    if (!open && wrap.value?.contains(document.activeElement)) {
      await nextTick()
      trigger.value?.focus({ preventScroll: true })
    }
  }
)
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  if (props.open) emit('close')
})
</script>
<template>
  <div ref="wrap" class="header-link-wrap topic-menu" :class="{ open }" @keydown="key">
    <button
      ref="trigger"
      class="icon-button header-link-button"
      aria-label="选择主题"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="topic-orb-menu"
      @click="emit('toggle')"
    >
      <Icon name="topics" />
    </button>
    <div id="topic-orb-menu" class="lk-menu" role="menu" aria-label="主题" :aria-hidden="!open" :inert="!open">
      <div class="lk-orbs">
        <button
          v-for="(topic, index) in topics"
          :key="topic.id"
          :class="['lk-o', `lk-o${index + 1}`]"
          :style="{ '--x': '0px', '--y': 52 + index * 46 + 'px', '--delay': index * 0.05 + 's' }"
          role="menuitemradio"
          :aria-label="topic.name"
          :aria-checked="selected === topic.id"
          :disabled="busy"
          @click="emit('select', topic.id)"
        >
          <span>{{ topic.name }}</span>
        </button>
      </div>
    </div>
    <Teleport to="body"
      ><Transition name="orb-mask"
        ><div
          v-if="open"
          class="topic-orb-backdrop"
          aria-hidden="true"
          @pointerdown.prevent="emit('close')" /></Transition
    ></Teleport>
  </div>
</template>
