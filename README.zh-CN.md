# Maple Note 远程插件

[English](README.md) | 简体中文

为 Maple Note 提供远程笔记服务接入。插件在 Maple Note 服务端运行，用于浏览、创建、更新、删除远程笔记，以及上传和预览附件。

## 安装

在 Maple Note 的远程插件管理中添加本仓库的 `index.json` 直链作为插件源，选择需要的插件安装，再创建使用该插件的远程服务并填写配置。

也可以使用下表中的 JS 文件直链单独安装。使用能够直接返回 JSON 或 JavaScript 内容的地址，例如仓库文件的 Raw 链接；不要使用仓库文件浏览页面的链接。

| 插件 | 分发文件 | 接入说明 |
| --- | --- | --- |
| Memos | [usememos/usememos.js](usememos/usememos.js) | 面向 Memos v0.24.2 |
| Blinko | [blinko/blinko.js](blinko/blinko.js) | 支持 Token 或账号密码登录 |
| 思源笔记 | [siyuan/siyuan.js](siyuan/siyuan.js) | 一条记录对应指定笔记本中的一篇文档 |

插件索引为 [index.json](index.json)，脚本路径相对于索引所在目录。将本仓库作为静态文件发布时，应保留目录结构。远程服务的接入点必须能从 Maple Note 服务端访问。

## 配置

### Memos

- `endpoint`：Memos 服务地址。
- `token`：访问 Token；可留空以浏览实例允许公开访问的笔记，创建、更新和删除需要 Token。

支持本地附件上传和外链附件，需使用支持 JSON 附件上传的 Maple Note 服务端。更新时附件为完整快照，清空附件列表会解除关联。删除笔记执行归档，不永久删除。

### Blinko

- `endpoint`：Blinko 服务地址。
- `token`：访问 Token，优先于账号密码。
- `username`、`password`：不使用 Token 时填写，二者必须同时提供。

不提供认证信息时可浏览远端允许公开访问的笔记。支持本地附件上传、外链附件导入和更新时复用已有附件。当前接入的 upsert 接口不支持解除已有附件关联，移除附件会返回错误，需要在 Blinko 中处理。删除笔记将其移入回收站。

### 思源笔记

- `endpoint`：思源内核服务地址。
- `notebook`：笔记本 ID。
- `token`：思源 API Token；内核无需认证时可留空。

支持文档分页浏览、Markdown 编辑、资源上传和认证预览。列表依赖 SQL API，不适用于发布模式。

更新会替换文档正文，可能重新生成子块 ID，思源特有块结构不能保证无损往返。删除使用思源原生文档删除接口，可能同时删除子文档，建议使用单独的笔记本。移除附件只移除正文引用，不删除共享资源。

## 更新与反馈

通过 Maple Note 的远程插件管理检查并安装插件更新。插件版本可在 JS 文件头部查看；插件版本与远程服务版本分别维护。

反馈问题时，请提供插件名称及版本、Maple Note 版本、远程服务版本、操作步骤和错误信息。Blinko 与思源目前已通过模拟 API 测试，尚未完成真实实例验证。
