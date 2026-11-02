// https://nuxt.com/docs/api/configuration/nuxt-config
//@ts-ignore
import { resolve } from 'pathe'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { execSync } from 'child_process'
import { defineNuxtConfig } from 'nuxt/config'

let latestCommitHash = ''
let latestCommitTime = ''
try {
  latestCommitHash = execSync('git rev-parse --short HEAD').toString().trim()
  latestCommitTime = execSync('git log -1 --format=%ci').toString().trim()
} catch (e) {
  latestCommitHash = 'unknown'
  latestCommitTime = 'unknown'
}

const siteOrigin = (process.env.ORIGIN || 'https://7u717.github.io').replace(/\/$/, '')

function normalizeBaseURL(baseURL: string = '/') {
  if (!baseURL) return '/'

  let normalizedBaseURL = baseURL.trim()

  if (!normalizedBaseURL.startsWith('/')) {
    normalizedBaseURL = `/${normalizedBaseURL}`
  }
  if (!normalizedBaseURL.endsWith('/')) {
    normalizedBaseURL = `${normalizedBaseURL}/`
  }

  return normalizedBaseURL.replace(/\/{2,}/g, '/')
}

function withBaseURL(path: string, baseURL: string) {
  if (!path.startsWith('/')) return path
  if (baseURL === '/') return path
  if (path === '/') return baseURL
  return `${baseURL.slice(0, -1)}${path}`
}

function toSiteURL(path: string, baseURL: string) {
  return new URL(withBaseURL(path, baseURL), siteOrigin).toString()
}

const appBaseURL = normalizeBaseURL(process.env.NUXT_APP_BASE_URL || '/')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  app: {
    baseURL: appBaseURL,
    // keepalive: true,
    head: {
      title: 'IELTS · 每天一点', // default fallback title
      htmlAttrs: {
        lang: 'zh-CN',
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0c0d0f' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'IELTS' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: withBaseURL('/icons/icon-192.png', appBaseURL) },
        { rel: 'apple-touch-icon', href: withBaseURL('/icons/apple-touch-icon.png', appBaseURL) },
        { rel: 'manifest', href: withBaseURL('/manifest.json', appBaseURL) },
      ],
    },
  },
  // ssr: false,
  routeRules: {
    '/words': { ssr: false },
    '/practice-words/**': { ssr: false },
    '/articles': { ssr: false },
    '/setting': { ssr: false },




  },
  vite: {
    plugins: [
      Components({
        resolvers: [
          IconsResolver({
            prefix: 'Icon',
          }),
        ],
      }),
      Icons({
        autoInstall: true,
      }),
    ],
  },
  hooks: {
    'pages:extend'(pages) {
      // Keep the existing word practice engine, remove unrelated public routes.
      const allowed = ['/', '/words', '/setting', '/practice-words/:id()']
      for (let i = pages.length - 1; i >= 0; i--) {
        if (!allowed.includes(pages[i].path)) pages.splice(i, 1)
      }
    },
  },
  // 模块
  modules: ['@pinia/nuxt', '@unocss/nuxt', 'unplugin-icons/nuxt', '@vue-macros/nuxt', '@nuxtjs/i18n', '@nuxt/image'],
  macros: {
    betterDefine: false,
  },
  // i18n 配置
  i18n: {
    locales: [{ code: 'zh', language: 'zh-CN', file: 'zh.json', name: '中文' }],
    detectBrowserLanguage: false,
    defaultLocale: 'zh',
    // langDir:'app/i18n/',
    strategy: 'no_prefix',
  },
  // CSS
  css: ['~/assets/css/main.scss', '~/assets/css/ielts.scss'],
  // 别名配置
  alias: {
    '@': resolve(__dirname, 'app'),
  },
  // 自动导入配置
  imports: {
    dirs: ['app/composables/**', 'app/utils/**'],
  },
  // 组件自动导入目录
  components: [
    { path: 'components', pathPrefix: false },
    { path: 'app/components', pathPrefix: false },
  ],
  // 运行时配置
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost/',
      origin: process.env.ORIGIN || 'https://7u717.github.io',
      host: process.env.HOST || '7u717.github.io',
      passwordRsaPublicKey: process.env.VITE_PASSWORD_RSA_PUBLIC_KEY || '',
      latestCommitHash: latestCommitHash + (process.env.NODE_ENV === 'production' ? '' : ' (dev)'),
      latestCommitTime: latestCommitTime,
    },
  },
  // 构建配置
  build: {
    transpile: ['vue-virtual-scroller', 'vxe-table'],
  },
  // 实验性功能
  experimental: {
    payloadExtraction: false, // 禁用 payload 提取，减少构建体积
  },
  // TypeScript 配置
  typescript: {
    strict: false,
    typeCheck: false, // 构建时不进行类型检查，加快构建速度
    tsConfig: {
      compilerOptions: {
        types: ['vue-macros/macros-global'],
        allowImportingTsExtensions: true,
      },
    },
  },
  devServer: {
    port: 5567,
  },
  nitro: {
    prerender: {
      routes: ['/', '/words', ...['environment', 'education', 'technology', 'society', 'health', 'economy'].map(t => '/practice-words/ielts-' + t)],
      ignore: [withBaseURL('/manifest.json', appBaseURL)],
    },
    devProxy: {
      '/baidu': {
        target: 'https://api.fanyi.baidu.com/api/trans/vip/translate',
        changeOrigin: true,
      },
    },
  },
})
