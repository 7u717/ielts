# 雅思

个人雅思词汇应用，沿用 [iue](https://github.com/7u717/iue) 的单色界面系统：纯黑／浅灰双外观、系统 SF / PingFang 字体、细线圆环、悬浮胶囊导航与底部 sheet。iPhone 390px 优先，支持安全区与添加到主屏幕，外观跟随系统且不改写已有设置，无登录、广告和网络字体。

六个话题、144 个精选词条（起步词库，不代表官方完整考纲）。学习引擎基于 [TypeWords](https://github.com/zyronon/TypeWords)，保留打字、听写、错词与 FSRS 间隔复习。

## 使用

右上角主题图标展开竖向圆按钮菜单，再点图标或空白处收回。点首页圆环打开学习概览，数字收在玻璃浮层中，点播放图形开始或继续；环下图形胶囊切换学习 / 打字 / 听写，支持拖动指示。底部图标和左右滑动切换学习、错词、复习。学习页点单词发音、切换释义并唤起键盘，长按松手发音，左滑跳过；输入正确后自动继续。错词列表左滑移出，详情在 sheet 中。左上角头像打开偏好，只显示每日新词刻度和自动发音开关，拖动把手或点背景关闭。每日新词支持连续拖动与松手吸附；自动发音整行可点。主题词表默认只显示英文，点词发音并原位展开释义，再点收起，长按查看扩展详情；模式右侧列表图形统一打开当前词表。六个主题以紧凑 3×2 小弧显示，主环零进度仅保留细环，有进度才显示圆头与缓慢呼吸端点，小弧零进度没有端点，点按才短暂显示百分比。学习页右上圆点展开无文字标签的键盘和偏好工具，单词详情使用居中玻璃 sheet，书签与笔图标分别操作收藏和笔记。学习页左滑跟手，短拖回弹，完整左滑跳过；手势提示沿用原有一次性标记，进度显示在底部短线。

## 开发与发布

Node.js 24，pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认端口 5567，静态构建：

```sh
NUXT_APP_BASE_URL=/ielts/ ORIGIN=https://7u717.github.io pnpm generate
```

输出 `.output/public`。推送到 `master` 后 Actions 构建、部署并验证线上 HTML 与 PWA manifest：

https://7u717.github.io/ielts/

## 记录与兼容

沿用已有 IndexedDB / localStorage 键和版本，不重置词典进度、错词、FSRS、统计或笔记。不同主题、打字 / 听写 / 复习任务使用新增的 `ielts-session:*` 归档键；旧模式 `0` 和旧缓存仍兼容。首次手势提示仅新增 `ielts-gesture-hint-v1`。原备份逻辑保留，包含原导出内容及新增的任务归档；本次仅隐藏其界面入口。

记录只在此浏览器/域名内保存；iOS 主屏幕应用与 Safari 的存储可能分开。网页缓存不清理 IndexedDB，也不承诺首次使用即可完整离线。发音优先使用 HTTPS 有道英式音频，失败回退 en-GB 系统语音。首次用户交互同步解锁同一个音频元素和系统语音；回到前台后等待下一次手势重新解锁。系统语音能否离线发音取决于设备已安装的声音。

## 移动回归检查

用独立浏览器上下文测试，不读取真实用户记录。

```sh
npm install --prefix /tmp/ielts-browser playwright
PLAYWRIGHT_MODULE=/tmp/ielts-browser/node_modules/playwright \
  node scripts/verify-mobile.cjs
```

设置 `CHROMIUM_BIN` 指定浏览器（默认 `/usr/bin/chromium`），`IELTS_TEST_URL` 指定开发或静态站点地址，`IELTS_SCREENSHOTS` 指定截图目录。检查导航/拖动、sheet、原生 input 事件、自动学习与 FSRS、旧记录恢复、模式归档、错词移除和精简偏好。

`node scripts/verify-pronunciation.mjs` 检查手势限制、媒体失败回退和取消竞态。`scripts/verify-preferences-audio.cjs` 使用真实 Chromium 媒体播放和本地 WAV 网络夹具，验证点击、长按、自动发音、偏好及旧记录，并输出 390px 截图。`scripts/verify-sheet-polish.cjs` 检查词表点按/长按、原位详情、连续刻度拖动及吸附、整行开关并输出 390px 截图。`scripts/verify-study-polish.cjs` 检查首页轻量进度、词表把手、学习页亮度/布局、一次性提示、左拖跟手与回弹。`scripts/verify-detail-grid.cjs` 检查六主题网格、词表展开、工具菜单、居中详情、收藏/笔记持久化及回弹关闭。`scripts/verify-materials.cjs` 检查深浅两种 390px 外观、零／有进度圆环、概览、胶囊拖动、玻璃面板和阻尼关闭，并验证切换系统外观不写入学习记录。以上测试不能确认有道服务当时的可用性，也不能替代 iPhone 真机音频检查。

## 许可

保留 TypeWords 的 GPL-3.0，参见 [LICENSE](LICENSE)。部分音标、例句沿用原词库；界面参考 iue，头像复用用户公开的 iue 资源。
