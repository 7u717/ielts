# 雅思

个人雅思词汇应用，沿用 [iue](https://github.com/7u717/iue) 的单色界面系统：纯黑／浅灰双外观、系统 SF / PingFang 字体、细线圆环、悬浮胶囊导航与底部 sheet。iPhone 390px 优先，支持安全区与添加到主屏幕，外观跟随系统且不改写已有设置，无登录、广告和网络字体。

六个话题、144 个精选词条（起步词库，不代表官方完整考纲）。学习引擎基于 [TypeWords](https://github.com/zyronon/TypeWords)，保留打字、听写、错词与 FSRS 间隔复习。

## 使用

首页仅保留本话题主圆环与底部单一胶囊。胶囊依次为学习、打字、听写、词表、错词、复习，支持拖动滑动指示；页面左右滑动仍切换学习／错词／复习。主环随本话题已学进度变化，点击打开轻玻璃浮层，用已学与 FSRS 到期待复习的真实比例绘制细条，不显示数字，点播放开始或继续。

话题切换只在右上角六个圆形图标菜单：叶子、书、芯片、人群、心跳、折线，当前话题为反色实心圆；仅当前话题或长按／键盘聚焦时显示标签，长按不误切换，点图标或空白收回，保留错落弹簧动画。左上头像偏好只显示每日新词与自动发音；悬浮面板左右底部留 12px，支持阻尼下拉关闭。

学习单词按实际字体宽度保持单行与至少 32px 左右留白，整组位于约屏幕 39%；例句 15px 居中、最多两行，点按看全文。例句优先原词条，缺少时使用只读原创示例，不写入词库或学习记录，也不在打字／听写遮词阶段显示。首次三个词显示会淡出的图形滑动提示（仅本次访问计数，不更改原存储键）。单词点按释义、长按松手发音、左滑跟手跳过，短拖回弹。右上学习工具仅轻微压暗背景，不模糊单词。详情书签／笔图标分别操作收藏和笔记。

词表每行显示英文与右侧 40% 淡色中文，统一行高，滚动顶部渐隐；点词发音并原位展开，长按进入详情。错词列表支持左滑移出。打字／听写保持无框下划线与光标、错字轻抖和触感、正确自动换词及完成光晕。

概览、偏好、单词详情与学习工具沿用白色 6%／浅色 55% 的轻玻璃、24px 模糊及顶部细高光；面板背景只轻微模糊。深浅外观跟随系统，不重写任何已有学习设置。

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

沿用已有 IndexedDB / localStorage 键和版本，不重置词典进度、错词、FSRS、统计或笔记。不同主题、打字 / 听写 / 复习任务使用新增的 `ielts-session:*` 归档键；旧模式 `0` 和旧缓存仍兼容。保留旧 `ielts-gesture-hint-v1`，本轮提示不写入持久存储。原备份逻辑保留，包含原导出内容及新增的任务归档；本次仅隐藏其界面入口。

记录只在此浏览器/域名内保存；iOS 主屏幕应用与 Safari 的存储可能分开。网页缓存不清理 IndexedDB，也不承诺首次使用即可完整离线。发音优先使用 HTTPS 有道英式音频，失败回退 en-GB 系统语音。首次用户交互同步解锁同一个音频元素和系统语音；回到前台后等待下一次手势重新解锁。系统语音能否离线发音取决于设备已安装的声音。

## 移动回归检查

用独立浏览器上下文测试，不读取真实用户记录。

```sh
npm install --prefix /tmp/ielts-browser playwright
PLAYWRIGHT_MODULE=/tmp/ielts-browser/node_modules/playwright \
  node scripts/verify-mobile.cjs
```

设置 `CHROMIUM_BIN` 指定浏览器（默认 `/usr/bin/chromium`），`IELTS_TEST_URL` 指定开发或静态站点地址，`IELTS_SCREENSHOTS` 指定截图目录。检查导航/拖动、sheet、原生 input 事件、自动学习与 FSRS、旧记录恢复、模式归档、错词移除和精简偏好。

`node scripts/verify-pronunciation.mjs` 检查手势限制、媒体失败回退与取消竞态。`scripts/verify-preferences-audio.cjs` 使用 Chromium 真实媒体播放和本地 WAV 夹具，验证点击、长按、自动发音、偏好和旧记录。`node scripts/verify-examples.mjs` 检查 144 个词条的只读示例覆盖。

`scripts/verify-graphic-home.cjs` 检查深浅 390px 单一胶囊、话题图标／长按、已学与到期真实进度、两行例句、前三次提示、无模糊工具菜单及等高词表，保存六类截图。旧视觉脚本保留供历史布局对照；当前首页以此脚本为准。测试不确认有道当时的外网可用性，也不能替代 iPhone 真机音频检查。

## 许可

保留 TypeWords 的 GPL-3.0，参见 [LICENSE](LICENSE)。部分音标、例句沿用原词库；界面参考 iue，头像复用用户公开的 iue 资源。
