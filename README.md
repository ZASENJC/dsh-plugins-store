# DSH插件商店

<p align="center">
  <a href="https://linux.do" aria-label="访问 LINUX DO">
    <img
      src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZjlhZjAwO2ZpbGwtb3BhY2l0eToxIi8+PC9zdmc+"
      alt="LINUX DO"
    />
  </a>
  <a href="https://dsh.aitreez.com/">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Fdsh.aitreez.com%2F&amp;up_message=online&amp;down_message=offline&amp;label=dsh.aitreez.com" alt="Website" />
  </a>
  <a href="https://github.com/ZASENJC/dsh-plugins-store/actions/workflows/sync-catalog.yml">
    <img src="https://github.com/ZASENJC/dsh-plugins-store/actions/workflows/sync-catalog.yml/badge.svg" alt="Sync catalog" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/ZASENJC/dsh-plugins-store" alt="License" />
  </a>
  <a href="https://astro.build/">
    <img src="https://img.shields.io/badge/Astro-built-BC52EE?logo=astro&amp;logoColor=white" alt="Astro" />
  </a>
</p>

自动收录并整理 GitHub [`dsh-plugin`](https://github.com/topics/dsh-plugin) Topic 项目，提供搜索、分类、排序和标签聚合浏览。

[访问 DSH-plugin store](https://dsh.aitreez.com/)

## 项目截图

![DSH插件商店首页](<https://img.qunq.de/file/1786712025014_FireShot Capture 027 - DSH插件商店（DSH-plugin store） - [dsh.aitreez.com].jpeg>)

![dsh-TUI 项目详情](<https://img.qunq.de/file/1786712021455_FireShot Capture 029 - dsh-TUI · DSH插件商店 - [dsh.aitreez.com].png>)

![coding-agent 标签页面](<https://img.qunq.de/file/1786712029405_FireShot Capture 028 - coding-agent 标签 · DSH插件商店 - [dsh.aitreez.com].jpeg>)

## 功能

- 自动收录公开的 `dsh-plugin` Topic 仓库
- 根据 GitHub Topics 识别项目类型和功能分类
- 支持名称、作者、描述和标签搜索
- 支持分类、项目类型和更新时间等筛选排序
- 提供项目详情、分类依据和同标签项目页面
- 显示“发现 → 识别 → 结构检查 → 实机验证”进度，并支持按当前验证状态筛选
- 每 30 分钟自动同步 GitHub 仓库数据
- 提供可安装的 DSH Web 插件，通过 `/store`、会话工具栏和设置页浏览同一目录，并在风险确认后支持一键安装

## 数据说明

项目分类优先使用仓库公开的 GitHub Topics，并与站内词典和词根规则比对。标签不足时，项目会保留为“其他”或“待识别”，不会根据名称强行推断。

收录仅表示仓库出现在 `dsh-plugin` Topic，不代表项目已经通过安装、兼容性、安全性或质量验证。本站不会下载、构建或执行第三方仓库代码；可选 DSH Web 插件只会在用户阅读风险提示并明确确认后发起安装。

当前仓库只消费并展示验证结果，不包含执行第三方代码的实机沙箱。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

默认访问地址：`http://localhost:4321/`。

构建 DSH Web 插件：

```bash
npm run build:plugin
npm pack ./packages/dsh-plugin-store
```

插件安装与卸载方式见 [`packages/dsh-plugin-store/README.md`](packages/dsh-plugin-store/README.md)。

重新同步目录时运行：

```bash
npm run sync
```

同步脚本支持读取 `GITHUB_TOKEN` 或 `GH_TOKEN`。未提供 Token 时会受到 GitHub API 的较低请求限额约束。

## 验证与构建

```bash
npm test
npm run build
```

推送到 `main` 后，GitHub Actions 会自动构建并部署 GitHub Pages。生产服务器每 30 分钟触发一次目录同步；同步、测试和构建成功后，静态站点会原子发布到生产服务器。

## 许可证

项目代码采用 [MIT License](LICENSE)，可自由使用、复制、修改和分发，但必须在软件副本或主要部分中保留原版权声明与许可声明。软件按原样提供，不附带任何明示或暗示的担保。
