# DSH Plugin Store 插件

把 [DSH插件商店](https://dsh.aitreez.com/) 作为原生页面接入 DeepSeek Harness Web：

- 输入 `/store` 打开商店对话框
- 点击会话标题栏的插件图标打开同一对话框
- 通过“设置 → 插件 → 插件商店”长期浏览

插件沿用站点的发现边界，只提供搜索、筛选、详情、GitHub 外链和安装参考复制；不会下载、构建或执行第三方仓库代码。

## 本地构建与安装

在仓库根目录运行：

```sh
npm run build:plugin
npm pack ./packages/dsh-plugin-store
dsh plugin --profile web add ./dsh-plugin-store-0.1.0.tgz
```

重启 DSH Web 后刷新浏览器。卸载：

```sh
dsh plugin --profile web remove dsh-plugin-store
```

## 许可证

MIT
