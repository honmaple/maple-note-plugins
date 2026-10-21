# Maple Note Plugins

English | [简体中文](README.zh-CN.md)

Connect Maple Note to remote note services. Plugins run on the Maple Note server to browse, create, update, and delete remote notes, as well as upload and preview attachments.

## Installation

In Maple Note’s remote plugin manager, add the direct URL to this repository’s `index.json` as a plugin source. Install a plugin, then create a remote service using it and enter the required settings.

You can also install a plugin individually using a direct URL to its JavaScript file below. Use a URL that returns the JSON or JavaScript content directly, such as a repository’s Raw file URL, rather than its file browsing page.

| Plugin | Distribution file | Integration notes |
| --- | --- | --- |
| Memos | [usememos/usememos.js](usememos/usememos.js) | Targets Memos v0.24.2 |
| Memos v0.31.0 | [usememos/usememos_v031.js](usememos/usememos_v031.js) | Targets Memos v0.31.0; includes SPACE visibility |
| Blinko | [blinko/blinko.js](blinko/blinko.js) | Supports token or username/password authentication |
| SiYuan | [siyuan/siyuan.js](siyuan/siyuan.js) | Each note maps to a document in the configured notebook |

The plugin index is [index.json](index.json). Script paths are relative to the index directory. Preserve this directory structure when hosting the repository as static files. The remote service endpoint must be reachable from the Maple Note server.

## Service Comparison

| Service | Plugin | Target version | Required settings | Authentication | Core features |
| --- | --- | --- | --- | --- | --- |
| Memos | `usememos` | v0.24.2 | `endpoint` | Token | Note management, attachment uploads and reuse |
| Memos | `usememos_v031` | v0.31.0 | `endpoint` | Token | Note management, attachment uploads and reuse, SPACE visibility |
| Blinko | `blinko` | — | `endpoint` | Token or username/password | Note management, attachment uploads and reuse |
| SiYuan | `siyuan` | — | `endpoint`, `notebook` | API token | Document management, Markdown editing, asset uploads and previews |

### Memos

The two versions use separate plugins, with no version parameter. Tokens are optional for browsing publicly accessible notes; v0.31.0 requires public access to be enabled in Memos. Creating, updating, and deleting notes require a token. Deletion archives notes rather than permanently deleting them.

Supports local uploads and external attachments. Local uploads require a Maple Note server with JSON attachment upload support. Updates replace the full attachment list; an empty list removes all associations. When creating a note with SPACE visibility, set its space ID (`spaces/ID`) in the note form.

### Blinko

A token takes precedence over account credentials. Provide both `username/password` when using account authentication. Without credentials, only publicly accessible notes can be browsed. Deletion moves notes to the recycle bin.

Supports local uploads, imports from URLs, and attachment reuse. The current upsert API does not remove existing associations; removal returns an error and must be managed in Blinko.

### SiYuan

Each note maps to a document in the configured notebook. Tokens are optional if the kernel does not require authentication. Listing requires the SQL API and is unavailable in publishing mode.

Updates replace the document body, may regenerate child block IDs, and may not preserve SiYuan-specific block structures. Attachment removal deletes the document reference without deleting the shared asset. Native document deletion may also delete child documents; a dedicated notebook is recommended.

## Updates and Feedback

Check for and install plugin updates through Maple Note’s remote plugin manager. Plugin versions appear in the JavaScript file headers and are maintained independently of remote service versions.

When reporting an issue, include the plugin name and version, Maple Note version, remote service version, reproduction steps, and error message. Blinko and SiYuan have passed tests using mocked APIs but have not yet been verified against live instances.
