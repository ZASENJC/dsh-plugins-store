# DSH Plugin Store 插件

把 [DSH 插件市场](https://dsh.aitreez.com/) 作为原生页面接入 DeepSeek Harness Web：

- 输入 `/store` 打开商店对话框
- 点击会话标题栏的插件图标打开同一对话框
- 通过“设置 → 插件 → 插件市场”长期浏览
- 在项目卡片点击“安装”，阅读风险提示并勾选确认后安装到 Web profile
- 从商店网页的插件详情页跳转到本机 DSH，并继续同一套风险确认流程

插件提供搜索、筛选、详情、GitHub 外链和安装参考复制。只有用户在风险弹窗中明确确认后，host 才会使用固定参数执行 `dsh plugin --profile web add github:<owner>/<repo>`；安装完成后需要重启 DSH Web 才会生效。

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
