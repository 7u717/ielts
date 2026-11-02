# 雅思

个人雅思词汇应用，沿用 [iue](https://github.com/7u717/iue) 的单色界面系统：纯黑、系统 SF / PingFang 字体、细线圆环、悬浮胶囊导航与底部 sheet。iPhone 390px 优先，支持安全区与添加到主屏幕，无登录、广告和网络字体。

六个话题、144 个精选词条（起步词库，不代表官方完整考纲）。学习引擎基于 [TypeWords](https://github.com/zyronon/TypeWords)，保留打字、听写、错词与 FSRS 间隔复习。

## 使用

右上角主题图标展开竖向圆按钮菜单，再点图标或空白处收回。点首页圆环开始或继续；环下切换学习 / 打字 / 听写。底部图标和左右滑动切换学习、错词、复习。学习页点单词切换释义并唤起键盘，长按发音，左滑跳过；输入正确后自动继续。错词列表左滑移出，详情和备份在 sheet 中。

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

沿用已有 IndexedDB / localStorage 键和版本，不重置词典进度、错词、FSRS、统计或笔记。不同主题、打字 / 听写 / 复习任务使用新增的 `ielts-session:*` 归档键；旧模式 `0` 和旧缓存仍兼容。首次手势提示仅新增 `ielts-gesture-hint-v1`。备份包含原导出内容及新增的任务归档。

记录只在此浏览器/域名内保存，换设备或清理浏览器前请导出；iOS 主屏幕应用与 Safari 的存储可能分开。网页缓存不清理 IndexedDB，也不承诺首次使用即可完整离线。系统语音能否离线发音取决于设备已安装的声音。

## 移动回归检查

用独立浏览器上下文测试，不读取真实用户记录。

```sh
npm install --prefix /tmp/ielts-browser playwright
PLAYWRIGHT_MODULE=/tmp/ielts-browser/node_modules/playwright \
  node scripts/verify-mobile.cjs
```

设置 `CHROMIUM_BIN` 指定浏览器（默认 `/usr/bin/chromium`），`IELTS_TEST_URL` 指定开发或静态站点地址，`IELTS_SCREENSHOTS` 指定截图目录。检查导航/拖动、sheet、原生 input 事件、自动学习与 FSRS、旧记录恢复、模式归档、错词移除及导出。测试模拟系统语音，不能替代 iPhone 真机音频检查。

## 许可

保留 TypeWords 的 GPL-3.0，参见 [LICENSE](LICENSE)。部分音标、例句沿用原词库；界面参考 iue，头像复用用户公开的 iue 资源。
