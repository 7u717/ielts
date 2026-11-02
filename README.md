# IELTS · 每天一点

个人雅思词汇学习应用，基于 [TypeWords](https://github.com/zyronon/TypeWords)（GPL-3.0）。

六个精选话题（环境、教育、科技、社会、健康、经济），144 个词条；这是起步词库，不是官方完整词表。保留 TypeWords 的打字、听写、错词和 FSRS 间隔复习引擎。手机优先，SF Pro / PingFang SC，支持添加到主屏幕，无账号、广告或分析脚本。

## 开发

Node.js 24，pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认开发端口 5567。

```sh
NUXT_APP_BASE_URL=/ielts/ ORIGIN=https://7u717.github.io pnpm generate
```

静态产物在 `.output/public`。GitHub Pages 的 Source 设置为 **GitHub Actions**，推送到 `master` 后自动部署：

https://7u717.github.io/ielts/

## 数据

学习进度在同一浏览器、同一域名的 IndexedDB 中；更新不清空已有数据。沿用原存储键和版本，不改动已有词典进度、错词、FSRS 或历史备份。切换话题时单独归档未完成练习。旧词库数据保留用于兼容已有记录，不在新应用中展示。不同设备、浏览器或域名的数据不会自动迁移，请在「偏好 → 导出学习备份」备份。iOS 独立主屏幕应用的存储可能与 Safari 分开，不承诺自动迁移。

词义为话题精选，部分音标和例句沿用仓库原词库。发音使用浏览器/系统英语语音，iPhone 需要先进行用户交互；离线语音取决于系统已下载的声音。网页缓存只保留访问过的公开资源，不承诺首次使用即可完整离线。

## 许可

继承 TypeWords 的 GPL-3.0，参见 [LICENSE](LICENSE)。
