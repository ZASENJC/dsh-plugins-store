# DSH Plugin Store 插件

把 [DSH 插件市场](https://dsh.aitreez.com/) 作为原生页面接入 DeepSeek Harness Web：

- 输入 `/store` 打开商店对话框
- 点击会话标题栏的插件图标打开同一对话框
- 通过“设置 → 插件 → 插件市场”长期浏览
- README 明确识别出的安全 DSH/npm 安装命令可进入一键安装；GitHub 命令在有当前验证时会自动固定到 SHA
- 验证状态与网页版同步展示，包括“安全复核中”和“需重新验证”的具体原因
- 在项目卡片点击“安装”，仅对目录提供的可执行安装计划显示风险确认并安装到 Web profile
- 安装失败时可点击“交给 AGENT 分析”，把脱敏错误信息发送到新建的 DSH 会话
- 从商店网页的插件详情页跳转到本机 DSH，并继续同一套风险确认流程

插件提供搜索、筛选、详情、GitHub 外链和安装参考复制。原生市场只访问主站 `https://dsh.aitreez.com/catalog.json`。目录同步会从项目 README 的安装章节提取明确的 DSH 或 npm 安装命令：普通 `npm install`/`pnpm add` 会转换为固定的 DSH npm 安装参数；跨仓库、shell 管道、重定向和多命令不会进入本机 host 的一键安装链路。安装完成后需要重启 DSH Web 才会生效。

目录收录不是安全审查。第三方插件会在 DSH 进程权限范围内运行，安装前应自行审阅仓库来源和代码。

## 一键安装

```sh
dsh plugin --profile web add github:ZASENJC/dsh-plugins-store#path:packages/dsh-plugin-store
```

重启 DSH Web 后刷新浏览器。

## 本地构建与安装

在仓库根目录运行：

```sh
npm run build:plugin
npm pack ./packages/dsh-plugin-store
dsh plugin --profile web add ./dsh-plugin-store-0.1.0.tgz
```

卸载：

```sh
dsh plugin --profile web remove dsh-plugin-store
```

## 许可证

MIT
