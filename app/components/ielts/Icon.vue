<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  learn: 'M4 5h6a2 2 0 0 1 2 2v13a4 4 0 0 0-4-2H4V5Zm16 0h-6a2 2 0 0 0-2 2m8-2v13h-4a4 4 0 0 0-4 2',
  wrong: 'M7 3.5h10v17l-5-3-5 3v-17Z',
  review: 'M4 8a8 8 0 1 1 0 8M4 3v5h5m3-1v5l3 2',
  topics: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  settings: 'M3 7h18M3 17h18M9 4v6m6 4v6',
  detail: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6',
  headphones:
    'M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v8H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm16 0h-3v8h3a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1Z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  bookmark: 'M7 3.5h10v17l-5-3-5 3v-17Z',
  pen: 'm15 4 5 5M4 20l4-1 12-12a2 2 0 0 0-4-4L4 15v5Z',
  profile: 'M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm-4 13v-1c0-7 16-7 16 0v1',
  back: 'm14 5-7 7 7 7',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'm9 5 7 7-7 7',
  down: 'm7 10 5 5 5-5',
  check: 'm5 12 4 4L19 6',
  sound: 'M11 4 6 8H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  keyboard:
    'M3 6h18v12H3V6Zm3 3h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01M8 15h8',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'm9 5 10 7-10 7V5Z',
  remove: 'M5 12h14',
  export: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
}
</script>
<template>
  <svg
    class="iue-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.45"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.more" />
  </svg>
</template>
