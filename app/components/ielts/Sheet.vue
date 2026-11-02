<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let previous: HTMLElement | null = null
watch(() => props.open, async open => {
  await nextTick()
  if (open) {
    previous = document.activeElement as HTMLElement
    dialog.value?.showModal()
  } else {
    dialog.value?.close()
    previous?.focus()
  }
})
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <dialog ref="dialog" class="ielts-sheet" @cancel.prevent="emit('close')" @click="e => { if (e.target === dialog) emit('close') }">
    <div class="sheet-head"><h2>{{ title }}</h2><button aria-label="关闭" @click="emit('close')">×</button></div>
    <slot />
  </dialog>
</template>
