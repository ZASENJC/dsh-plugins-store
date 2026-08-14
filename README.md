# DSH插件商店

自动收录并整理 GitHub [`dsh-plugin`](https://github.com/topics/dsh-plugin) Topic 项目，提供搜索、分类、排序和标签聚合浏览。

[访问 DSH-plugin store](https://dsh.aitreez.com/)

## 功能

- 自动收录公开的 `dsh-plugin` Topic 仓库
- 根据 GitHub Topics 识别项目类型和功能分类
- 支持名称、作者、描述和标签搜索
- 支持分类、项目类型和更新时间等筛选排序
- 提供项目详情、分类依据和同标签项目页面
- 每 30 分钟自动同步 GitHub 仓库数据

## 数据说明

项目分类优先使用仓库公开的 GitHub Topics，并与站内词典和词根规则比对。标签不足时，项目会保留为“其他”或“待识别”，不会根据名称强行推断。

收录仅表示仓库出现在 `dsh-plugin` Topic，不代表项目已经通过安装、兼容性、安全性或质量验证。本站不会下载、构建或执行第三方仓库代码。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

默认访问地址：`http://localhost:4321/`。

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
