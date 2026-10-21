# Maple Note Plugins

English | [简体中文](README.zh-CN.md)

Connect Maple Note to remote note services. Plugins run on the Maple Note server to browse, create, update, and delete remote notes, as well as upload and preview attachments.

## Installation

In Maple Note’s remote plugin manager, add the direct URL to this repository’s `index.json` as a plugin source. Install a plugin, then create a remote service using it and enter the required settings.

You can also install a plugin individually using a direct URL to its JavaScript file below. Use a URL that returns the JSON or JavaScript content directly, such as a repository’s Raw file URL, rather than its file browsing page.

| Plugin | Distribution file | Integration notes |
| --- | --- | --- |
| Memos | [usememos/usememos.js](usememos/usememos.js) | Targets Memos v0.24.2 |
| Blinko | [blinko/blinko.js](blinko/blinko.js) | Supports token or username/password authentication |
| SiYuan | [siyuan/siyuan.js](siyuan/siyuan.js) | Each note maps to a document in the configured notebook |

The plugin index is [index.json](index.json). Script paths are relative to the index directory. Preserve this directory structure when hosting the repository as static files. The remote service endpoint must be reachable from the Maple Note server.

## Configuration

### Memos

- `endpoint`: Memos service URL.
- `token`: Access token. Leave it empty to browse notes the instance makes publicly accessible. Creating, updating, and deleting notes require a token.

Supports local attachment uploads and external attachments. Local uploads require a Maple Note server with JSON attachment upload support. Updates replace the attachment list; an empty list removes all attachment associations. Deleting a note archives it rather than permanently deleting it.

### Blinko

- `endpoint`: Blinko service URL.
- `token`: Access token. Takes precedence over username/password authentication.
- `username`, `password`: Provide both when using account credentials instead of a token.

Without credentials, you can browse notes the service makes publicly accessible. Supports local attachment uploads, importing attachments from URLs, and reusing existing attachments during updates. The integrated upsert API does not remove existing attachment associations, so attempts to remove them return an error; manage removal in Blinko. Deleting a note moves it to the recycle bin.

### SiYuan

- `endpoint`: SiYuan kernel service URL.
- `notebook`: Notebook ID.
- `token`: SiYuan API token. Leave it empty if the kernel does not require authentication.

Supports paginated document browsing, Markdown editing, asset uploads, and authenticated previews. Listing documents relies on the SQL API and is unavailable in publishing mode.

Updating replaces the document body and may regenerate child block IDs. SiYuan-specific block structures are not guaranteed to survive a Markdown round trip unchanged. Deleting uses SiYuan’s native document deletion API and may also delete child documents; a dedicated notebook is recommended. Removing an attachment removes its reference from the document without deleting the shared asset.

## Updates and Feedback

Check for and install plugin updates through Maple Note’s remote plugin manager. Plugin versions appear in the JavaScript file headers and are maintained independently of remote service versions.

When reporting an issue, include the plugin name and version, Maple Note version, remote service version, reproduction steps, and error message. Blinko and SiYuan have passed tests using mocked APIs but have not yet been verified against live instances.
