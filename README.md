# 雅思

个人雅思词汇应用，沿用 [iue](https://github.com/7u717/iue) 的单色界面系统：纯黑／浅灰双外观、系统 SF / PingFang 字体、细线圆环、悬浮胶囊导航与底部 sheet。iPhone 390px 优先，支持安全区与添加到主屏幕，外观跟随系统且不改写已有设置，无登录、广告和网络字体。

六个话题、144 个精选词条（起步词库，不代表官方完整考纲）。学习引擎基于 [TypeWords](https://github.com/zyronon/TypeWords)，保留打字、听写、错词与 FSRS 间隔复习。

## 使用

首页仅保留本话题主圆环与底部四枚裸图标，用弹簧滑动小点标示当前项。导航为学习、词表、错词、复习，打字／听写及学习模式选择收进底部学习图标点开的轻菜单，支持拖动滑动指示；页面左右滑动仍切换学习／错词／复习。首页与展开态的主题进度使用单一环轨，首页额外用一条无底环的细弧呈现今日实际新词进度，以亮度区分本话题已学／FSRS 到期待复习弧段，从 12 点顺时针弹簧画出并轻微呼吸，不绘制孤立端点。点击后原位放大成圆形玻璃盘，盘内收成一条 278px、2px 圆头环轨，已学／待复习沿同一轨道以亮度区分，弧线随圆盘缩放且不从零重画；只有话题名、进度弧与播放按钮，无数字或矩形卡片；圆盘本身无底色，仅在单环周围保留柔和光晕；点外部或下滑缩回，点播放开始或继续。

话题切换只在右上角六个圆形图标菜单：叶子、书、芯片、人群、心跳、折线，当前话题为反色实心圆；仅当前话题或长按／键盘聚焦时显示标签，长按不误切换，点图标或空白收回，保留错落弹簧动画。左上头像偏好只显示每日新词与自动发音，每日新词使用细轨和圆形拇指、拖动浮动数值与吸附触感，兼容旧档位；悬浮面板左右底部留 12px，支持阻尼下拉关闭。

学习单词按实际字体宽度保持单行与至少 32px 左右留白，整组位于扣除标题／键盘后的可视区域垂直中心；例句 15px 居中、最多两行，点按看全文。例句优先原词条，缺少时使用只读原创示例，不写入词库或学习记录，也不在打字／听写遮词阶段显示。移除底部滑动图形提示。鼠标通过 click、触摸通过松手打开始终相同的详情，兼容 click 去重，并将单词指针捕获留在单词本身，避免卡片容器吞掉 click；释义点按打开可下滑／点外关闭的详情，点词同时发音；长按松手发音，卡片左右跟手位移与轻旋转，过阈值轻震；右滑认识、左滑记为再看，松手飞出并让下一词缩放淡入，短拖弹簧回弹。底部拇指区两个 64px 图形按钮提供同等操作，按下缩放 0.92 并轻震，移除后方模糊轮廓，下一词保持位置柔和淡入，不渲染第二组文字、底色方块或底边线，沿用既有认识／错词判定，不更改存储格式。右上学习工具仅轻微压暗背景，不模糊单词。详情书签／笔图标分别操作收藏和笔记。

词表使用与偏好一致的悬浮玻璃，左右底部各留 12px；释义紧随英文下方，统一留白、无分割线，顶部渐隐。词表后隐约保留主环轮廓，仅淡出背景主题文字以免形成光团。词表行按压 0.98 倍并轻微高亮，进入错落间隔 20ms，已有已认识／简单词以极小圆点表示。点词发音并打开含例句与发音图形的轻浮层，点外关闭；把手下拉关闭词表。错词列表支持左滑移出；空态上移到屏幕约 42%，细线对勾进入时描画，不显示“全部错词”标签和无效播放按钮。本组 0.5px 进度线固定于标题下，再收窄两侧各 32px；不绘制底轨，仅画已学亮段并弹簧推进。打字／听写保持无框下划线与光标、错字轻抖和触感、正确自动换词及完成光晕。

概览、偏好、词表与单词详情沿用白色 3.5%／浅色 32% 的轻玻璃、30px 模糊与 180% 饱和度及顶部细高光；面板背景只轻微模糊。所有浮层统一轻微变暗遮罩（深色 8%、浅色 6%）；任意浮层打开时 dock 淡出下沉，关闭后弹簧返回。深浅外观跟随系统，不重写任何已有学习设置。

零进度圆盘也保留清晰单底环，有进度时叠加真实已学／待复习弧，不伪造完成量。圆盘主题名置于弧心，播放按钮距主题名下沿 24px。主动点开的详情会显示内容，即使当前是遮词练习；保留原有查看答案的错词判定。详情优先原词条音标，缺少时用只读英式 IPA 补充，不回写词库。

首页每次进入时，已有进度弧从零以弹簧曲线描绘；零进度以 12 秒光晕呼吸，透明度只在 10%–12.5% 之间变化，并尊重减少动态效果。

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

`scripts/verify-graphic-home.cjs` 检查深浅 390px 单一胶囊、话题图标／长按、双进度弧、原位圆盘／下滑、标题进度线、点击详情／下滑、居中空态、两行例句、前三次提示、无模糊工具菜单及等高词表，保存六类截图。`scripts/verify-zero-touch.cjs` 以未学习的全新浏览器检查零进度双底环、圆盘 24px 间距、30px 半透明玻璃、圆拇指、真实触摸／无兼容 click 打开音标例句详情，并输出六类深浅截图。旧视觉脚本保留供历史布局对照；当前首页以此脚本为准。测试不确认有道当时的外网可用性，也不能替代 iPhone 真机音频检查。

`scripts/verify-card-gestures.cjs` 检查 390px 深浅四项导航、头像模式选择、鼠标／触摸／释义详情、透明进度底轨、44px 工具、轻旋转、阈值触感、双向判定与替代按钮，以及 20ms 词表入场。

`scripts/verify-aura-spacing.cjs` 检查真实描弧起止值、弹簧曲线、零进度呼吸透明度范围、透明圆盘及光晕、所有浮层同色遮罩、居中学习内容与底部按钮布局与无残影切词，并保存深浅 390px 截图。

## 许可

保留 TypeWords 的 GPL-3.0，参见 [LICENSE](LICENSE)。部分音标、例句沿用原词库；界面参考 iue，头像复用用户公开的 iue 资源。

词表行在指针按下时即缩放至 98% 并触发 vibrate(8)，滚动／取消会复位，键盘激活也保留轻震。`scripts/verify-card-gestures.cjs` 同时检查单轨圆盘、无模糊残影、当前词随拖动位移和词表按下反馈。

学习卡片及所有子元素统一禁选文字与 iOS 长按菜单；屏幕左右 20px 边缘渐隐，移除卡片内裁切，拖动不再产生选区或硬切字母。单词详情单独使用 40px 玻璃模糊、4px 背景模糊及深／浅 20%／12% 遮罩；打开期间隐藏后方认识／再看按钮，关闭恢复，例句中英文均居中。相关回归检查覆盖选区为空、渐隐、弹窗开关的按钮可见性及例句对齐。

头像偏好严格只有每日新词和自动发音：6px 圆角滑轨、20px 弹簧拇指，跨档轻震，沿用原有自定义目标与存储；模式入口改在 dock 的学习图标内。英文单词、例句与测宽统一使用 -apple-system / SF Pro 系统字体。

学习内容独立于底部操作键居中，发音／详情点击区 52px。拖动整组内容时横移最多 24px、轻旋转与渐隐，短拖弹簧复位，阈值与认识／再看记录逻辑沿用；今日细弧只读取本话题现有 statistics 中本地当日的新词数／每日目标，不写入新存储键，零进度不画假弧。

今日进度为零时仍有极淡起点，完成一组后读取已有当日统计描弧；所有进度状态都用 12 秒慢呼吸光晕。词表去掉标题，每行左侧用空心／半实心／实心小点读取现有学习与 FSRS 掌握程度，点击仍发音并复用学习页 Sheet 的玻璃详情、音标、例句和下滑关闭。切词用 blur(6px) 到清晰、上移 8px 的弹簧入场，主题菜单六圆依次间隔 30ms。

第 21 轮：dock 去掉胶囊材质，仅保留四个图标及下方 5px 弹簧滑动圆点；浅色展开圆环取消局部 backdrop 模糊以去除灰盘。词表行高 92px、掌握点 8px，按住 440ms 即轻震并打开同款详情，发音仍留在用户点击／松手手势内。学习页发音／详情点击区 60px，按压 0.94，单词本身继续兼容鼠标与触摸打开详情。

Round 22: bottom 再看／认识 use bare 28px icons inside unchanged 64px targets, press to 0.9 with haptics. Daily arc renders at 2px while its dash lengths scale with the circle with higher theme contrast. Study and vocabulary details record the source word position and spring-scale from it; other sheets retain their existing transitions. Word-list translations use the foreground color at 60% opacity. No persistence schema or progress changes.

Round 23: bare home/study header triggers press to 0.9 with haptics; existing circular menus remain. The 2px header line reads today’s saved new words plus distinct completed new words in the current session, avoids counting repeated phases twice, and writes no progress. Word-list typography is 17px/13px with 6px mastery dots. The daily ring has a faint 1px track at zero as well as its real progress arc.

Round 24: mastery markers are solid 6px dots at 20% / 55% / 100% opacity for new / learning / known. The daily line has a faint 2px track even at zero. Active topic circles keep their solid fill with no adjacent visible label; accessible names and other menu interactions remain. Detail audio, bookmark and note buttons have 44px targets. Storage and study records are unchanged.

Round 25: study keyboard/settings tools use bare 20px icons in 44px targets, staggered by 30ms with the theme menu’s spring, retaining outside-tap dismissal. The word-list sheet uses translucent 32px frosted glass; rows press to 0.97 with the existing vibrate(8). Word changes use a stationary soft fade while swipe gestures remain. No storage or learning-record changes.

Round 26: study header is explicitly borderless, with only the 2px daily track 6px below it. Solid 6px mastery dots use clearer 50% / 75% / 100% contrast. Study translations/examples are brighter and more spaced; sound/detail actions have 44px targets, press scaling and pointer-down haptics. Light home hides the inner track and places today’s arc on the main radius; SVG pathLength preserves its true progress ratio. No storage or study-record changes.
