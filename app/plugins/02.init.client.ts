//@ts-ignore
import VueVirtualScroller from 'vue-virtual-scroller'
import { ENV } from '@/core/config/env.ts'
import { withAppBaseURL } from '@/core/utils/base-url'

export default defineNuxtPlugin(async nuxtApp => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const register = () => navigator.serviceWorker.register(withAppBaseURL('/service-worker.js')).catch(console.error)
    if (document.readyState === 'complete') void register()
    else window.addEventListener('load', register, { once: true })
  }

  console.json = function (v: any, space = 0) {
    const json = JSON.stringify(
      v,
      (key, value) => {
        if (Array.isArray(value) && key !== 'nameList') {
          return `__ARRAY__${JSON.stringify(value)}`
        }
        return value
      },
      space
    )
      .replace(/"__ARRAY__(\[.*?\])"/g, (_, arr) => arr)
      // 专门处理 nameList，将其压缩成一行
      .replace(/"nameList": \[\s*([^\]]+)\s*\]/g, (match, content) => {
        // 移除数组内部的换行和多余空格，但保留字符串间的空格
        const compressed = content.replace(/\s*\n\s*/g, ' ').trim()
        return `"nameList": [${compressed}]`
      })

    console.log(json)
    return json
  }
  console.parse = function (v: any) {
    console.log(JSON.parse(v))
  }

  nuxtApp.vueApp.use(VueVirtualScroller)
})
