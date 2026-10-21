// Generated from manifest.json and plugin.js; edit those source files.
// ===
// @name         siyuan
// @author       honmaple
// @version      1.0.0
// @description  思源笔记：一条记录对应指定笔记本中的一篇文档，支持 Markdown、资源上传与预览。
// @icon
// @fields       [{"type":"string","name":"title","label":"文档标题","value":"","isRequired":true},{"type":"markdown","name":"content","label":"Markdown 内容","value":""},{"type":"attachment","name":"attachments"}]
// @settings     [{"type":"string","name":"endpoint","label":"接入点","value":"","isRequired":true},{"type":"string","name":"notebook","label":"笔记本 ID","value":"","isRequired":true},{"type":"password","name":"token","label":"API Token","value":""}]
// ===

// @ts-check
/// <reference path="../../plugin-api.d.ts" />

(function () {
    "use strict";

    /** @typedef {{endpoint: string, notebook: string, token?: string}} Settings */
    /** @typedef {PluginContext<Settings>} Context */
    /** @param {Context} ctx */
    const endpoint = (ctx) => ctx.settings.endpoint.replace(/\/+$/, "");
    /** @param {unknown} value */
    const id = (value) => {
        if (typeof value !== "string" || !/^\d{14}-[a-z0-9]{7}$/.test(value)) {
            throw new Error("INVALID_CONFIG: 无效的思源 ID");
        }
        return value;
    };
    /** @param {Context} ctx @returns {Record<string, string>} */
    const headers = (ctx) => ctx.settings.token ? { Authorization: `Token ${ctx.settings.token}` } : {};
    /** @param {Context} ctx @param {string} path @param {PluginFetchOptions} options */
    const request = (ctx, path, options) => {
        const response = ctx.fetch(endpoint(ctx) + path, { ...options, method: "POST", headers: headers(ctx) });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`REMOTE_ERROR: 思源请求失败（HTTP ${response.status}）`);
        }
        const result = response.json();
        if (!result || result.code !== 0) {
            throw new Error("REMOTE_ERROR: 思源未成功完成操作，请检查权限、笔记本状态及请求内容");
        }
        return result.data;
    };
    /** @param {Context} ctx @param {string} path @param {Record<string, unknown>} data */
    const api = (ctx, path, data) => request(ctx, path, { data });
    /** @param {unknown} value */
    const date = (value) => {
        if (typeof value !== "string" || !/^\d{14}$/.test(value)) throw new Error("INVALID_RESPONSE: 无效的思源时间");
        const result = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)), Number(value.slice(8, 10)), Number(value.slice(10, 12)), Number(value.slice(12, 14)));
        if (!Number.isFinite(result.getTime())) throw new Error("INVALID_RESPONSE: 无效的思源时间");
        return result;
    };
    /** @param {Context} ctx @param {any} row */
    const document = (ctx, row) => {
        if (!row || row.box !== ctx.settings.notebook || typeof row.content !== "string" || typeof row.path !== "string") {
            throw new Error("INVALID_RESPONSE: 无效的思源文档");
        }
        id(row.id);
        return row;
    };
    /** @param {Context} ctx @param {string} documentID */
    const find = (ctx, documentID) => {
        const rows = api(ctx, "/api/query/sql", { stmt: `SELECT id, box, path, content, created, updated FROM blocks WHERE type = 'd' AND box = '${id(ctx.settings.notebook)}' AND id = '${id(documentID)}' LIMIT 1` });
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error("NOT_FOUND: 当前笔记本中未找到文档");
        return document(ctx, rows[0]);
    };
    /** @param {Context} ctx @param {string} value */
    const assetPath = (ctx, value) => {
        const prefix = endpoint(ctx) + "/";
        if (value.startsWith(prefix)) value = value.slice(prefix.length);
        if (!value.startsWith("assets/")) return "";
        const path = decodeURIComponent(value);
        if (/[\\?#\x00-\x1f]/.test(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
            throw new Error("INVALID_RESPONSE: 无效的思源资源路径");
        }
        return path;
    };
    /** @param {string} path */
    const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
    /** @param {string} path */
    const mime = (path) => {
        const extension = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
        /** @type {Record<string, string>} */
        const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", pdf: "application/pdf", mp3: "audio/mpeg", mp4: "video/mp4" };
        return types[extension] || "application/octet-stream";
    };
    const assetLinks = /!?\[[^\]\n]*\]\(<?((?:assets\/|https?:\/\/)[^)\s>]+)>?(?:\s+"[^"]*")?\)/g;
    /** @param {Context} ctx @param {any} row @returns {Memo} */
    const read = (ctx, row) => {
        document(ctx, row);
        const exported = api(ctx, "/api/export/exportMdContent", { id: row.id });
        if (!exported || typeof exported.content !== "string") throw new Error("INVALID_RESPONSE: 缺少文档 Markdown");
        /** @type {Attachment[]} */
        const attachments = [];
        const seen = new Set();
        for (const match of exported.content.matchAll(assetLinks)) {
            const path = assetPath(ctx, match[1]);
            if (!path || seen.has(path)) continue;
            seen.add(path);
            attachments.push({ path: `${endpoint(ctx)}/${encodePath(path)}`, name: path.split("/").pop(), type: mime(path) });
        }
        return {
            id: row.id, title: row.content, content: exported.content, template: "markdown",
            metadata: { id: row.id, title: row.content }, attachments,
            created_at: date(row.created || row.id.slice(0, 14)), updated_at: date(row.updated),
        };
    };
    /** @param {Context} ctx @param {RuntimeAttachment[]} attachments */
    const validateAttachments = (ctx, attachments) => {
        for (const attachment of attachments) {
            if (!attachment || typeof attachment.path !== "string" || (!/^attachment:[A-Za-z0-9]+$/.test(attachment.path) && !/^https?:\/\//i.test(attachment.path))) {
                throw new Error("INVALID_CONFIG: 无效的附件引用");
            }
            assetPath(ctx, attachment.path);
        }
    };
    /** @param {Context} ctx @param {RuntimeMemo} memo */
    const content = (ctx, memo) => {
        if (typeof memo.content !== "string") throw new Error("INVALID_CONFIG: 文档内容必须是 Markdown");
        const attachments = memo.attachments || [];
        validateAttachments(ctx, attachments);
        /** @type {Map<string, {path: string, name: string}>} */
        const selected = new Map();
        for (const attachment of attachments) {
            let path = attachment.path;
            let name = "";
            if (path.startsWith("attachment:")) {
                const result = request(ctx, "/api/asset/upload", { formData: { assetsDirPath: "/assets/", "@file[]": path } });
                if (!result || result.errFiles?.length || result.failedFiles?.length) throw new Error("REMOTE_ERROR: 思源资源上传失败");
                const uploaded = result.succFiles?.[0] || Object.entries(result.succMap || {}).map(([name, path]) => ({ name, path }))[0];
                if (!uploaded || typeof uploaded.path !== "string" || typeof uploaded.name !== "string") throw new Error("INVALID_RESPONSE: 缺少上传后的资源路径");
                path = encodePath(uploaded.path);
                name = uploaded.name;
                if (!assetPath(ctx, path)) throw new Error("INVALID_RESPONSE: 无效的上传资源路径");
            }
            const local = assetPath(ctx, path);
            const key = local || path;
            selected.set(key, { path: local ? encodePath(local) : path, name: name || (local || path).split("/").pop() || "attachment" });
        }
        const found = new Set();
        const markdown = memo.content.replace(assetLinks, (match, href) => {
            const path = assetPath(ctx, href);
            if (!path) return match;
            if (!selected.has(path)) return "";
            found.add(path);
            return match;
        });
        const added = [];
        for (const [key, attachment] of selected) {
            if (found.has(key) || markdown.includes(`](${attachment.path})`)) continue;
            const label = attachment.name.replace(/[\\[\]]/g, "\\$&");
            added.push(`${mime(attachment.path).startsWith("image/") ? "!" : ""}[${label}](${attachment.path})`);
        }
        return added.length ? markdown + "\n\n" + added.join("\n\n") : markdown;
    };
    /** @param {RuntimeMemo} memo @param {string} [fallback] */
    const title = (memo, fallback = "") => {
        const value = memo.metadata?.title ?? memo.title ?? fallback;
        if (typeof value !== "string" || !value.trim() || /[\/\\\r\n\x00]/.test(value) || value === "." || value === "..") {
            throw new Error("INVALID_CONFIG: 标题不能为空或包含路径分隔符");
        }
        return value.trim();
    };

    /** @type {RemotePlugin<Settings>} */
    const plugin = {
        init(ctx) {
            if (typeof ctx.settings.endpoint !== "string" || !/^https?:\/\/[^/?#@\s]+(?:\/[^?#\s]*)?$/i.test(ctx.settings.endpoint)) throw new Error("INVALID_CONFIG: 接入点必须是 HTTP(S) 地址");
            id(ctx.settings.notebook);
            if (ctx.settings.token != null && typeof ctx.settings.token !== "string") throw new Error("INVALID_CONFIG: API Token 必须是字符串");
        },
        explore(ctx, query) {
            const size = query.page_size ?? 20;
            const offset = query.offset ?? ((query.page ?? 1) - 1) * size;
            if (!Number.isSafeInteger(size) || size < 1 || size > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("INVALID_CONFIG: 无效的分页参数（每页 1–100 条）");
            const rows = api(ctx, "/api/query/sql", { stmt: `SELECT id, box, path, content, created, updated FROM blocks WHERE type = 'd' AND box = '${id(ctx.settings.notebook)}' ORDER BY updated DESC, id DESC LIMIT ${size} OFFSET ${offset}` });
            if (!Array.isArray(rows)) throw new Error("INVALID_RESPONSE: 无效的文档列表");
            return rows.map((row) => read(ctx, row));
        },
        create(ctx, memo) {
            const name = title(memo);
            const markdown = content(ctx, memo);
            const documentID = id(api(ctx, "/api/filetree/createDocWithMd", { notebook: ctx.settings.notebook, path: "/" + name, markdown }));
            api(ctx, "/api/sqlite/flushTransaction", {});
            return read(ctx, find(ctx, documentID));
        },
        update(ctx, memo) {
            const documentID = id(memo.id || memo.metadata?.id);
            const row = find(ctx, documentID);
            const name = title(memo, row.content);
            const markdown = content(ctx, memo);
            api(ctx, "/api/block/updateBlock", { id: documentID, dataType: "markdown", data: markdown });
            if (name !== row.content) api(ctx, "/api/filetree/renameDoc", { notebook: ctx.settings.notebook, path: row.path, title: name });
            api(ctx, "/api/sqlite/flushTransaction", {});
            return read(ctx, find(ctx, documentID));
        },
        delete(ctx, memo) {
            const row = find(ctx, id(memo.id || memo.metadata?.id));
            api(ctx, "/api/filetree/removeDoc", { notebook: ctx.settings.notebook, path: row.path });
        },
        preview(ctx, path) {
            return { url: path, headers: headers(ctx) };
        },
    };
    return plugin;
})();
