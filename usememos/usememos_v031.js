// Generated from manifest.json and plugin.js; edit those source files.
// ===
// @name         usememos_v031
// @author       honmaple
// @version      1.0.0
// @description  Memos v0.31.0 API 插件；支持访问 Token、附件上传与预览及 SPACE 可见性。
// @icon
// @fields       [{"type":"text","name":"content","label":"记录你的灵感","value":"","isRequired":true},{"type":"attachment","name":"attachments"},{"name":""},{"type":"boolean","name":"pinned","label":"是否置顶","value":false},{"type":"option","name":"visibility","label":"可见性","value":"PRIVATE","options":[{"label":"私有","value":"PRIVATE"},{"label":"登录可见","value":"PROTECTED"},{"label":"公开","value":"PUBLIC"},{"label":"空间","value":"SPACE"}]},{"type":"string","name":"space","label":"空间 ID（spaces/ID，SPACE 可见性需要）","value":""}]
// @settings     [{"type":"string","name":"endpoint","label":"接入点","value":"","isRequired":true},{"type":"password","name":"token","label":"访问 Token","value":""}]
// ===

// @ts-check
/// <reference path="../../plugin-api.d.ts" />

(function () {
    "use strict";

    /** @typedef {{endpoint: string, token?: string}} Settings */
    /** @typedef {PluginContext<Settings>} Context */

    /** @param {Context} ctx */
    const endpoint = (ctx) => ctx.settings.endpoint.replace(/\/+$/, "");

    /** @param {Context} ctx */
    const token = (ctx) => ctx.settings.token || "";

    /** @param {Context} ctx */
    const requireAuth = (ctx) => {
        if (!token(ctx)) throw new Error("UNAUTHENTICATED: 请配置访问 Token");
    };

    /** @param {Context} ctx @param {string} path @param {PluginFetchOptions} [options] */
    const request = (ctx, path, options = {}) => {
        const headers = { ...options.headers };
        if (token(ctx)) headers.Authorization = `Bearer ${token(ctx)}`;
        const resp = ctx.fetch(`${endpoint(ctx)}${path}`, { ...options, headers });
        if (resp.status < 200 || resp.status >= 300) {
            const code = resp.status === 401 ? "UNAUTHENTICATED"
                : resp.status === 403 ? "PERMISSION_DENIED"
                : resp.status === 404 ? "NOT_FOUND"
                : resp.status === 429 ? "RATE_LIMITED" : "REMOTE_ERROR";
            // Do not include credentials, URL query strings or response bodies.
            throw new Error(`${code}: 远程请求失败（HTTP ${resp.status}）`);
        }
        return resp;
    };

    /** @param {unknown} value */
    const date = (value) => {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
            throw new Error("INVALID_RESPONSE: 缺少 RFC3339 时间字段");
        }
        const result = new Date(value);
        if (!Number.isFinite(result.getTime())) throw new Error("INVALID_RESPONSE: 时间格式错误");
        return result;
    };

    /** @param {unknown} value @param {"memos" | "attachments"} kind */
    const resourceName = (value, kind) => {
        if (typeof value !== "string" || !new RegExp(`^${kind}/[A-Za-z0-9_-]+$`).test(value)) {
            throw new Error(`INVALID_RESPONSE: 无效的 ${kind} 标识`);
        }
        return value;
    };

    /** @param {Context} ctx @param {any} data @returns {Memo} */
    const toMemo = (ctx, data) => {
        if (!data || typeof data.content !== "string") throw new Error("INVALID_RESPONSE: 无效的 Memo");
        const id = resourceName(data.name, "memos");
        if (data.pinned != null && typeof data.pinned !== "boolean") throw new Error("INVALID_RESPONSE: 无效的置顶状态");
        if (data.visibility != null && !["PRIVATE", "PROTECTED", "PUBLIC", "SPACE"].includes(data.visibility)) throw new Error("INVALID_RESPONSE: 无效的可见性");
        if (data.attachments != null && !Array.isArray(data.attachments)) throw new Error("INVALID_RESPONSE: 无效的附件列表");
        return {
            id,
            content: data.content,
            template: "markdown",
            // Keep metadata.id for records saved by the original plugin.
            metadata: { id, pinned: data.pinned ?? false, visibility: data.visibility ?? "PRIVATE", space: data.space ?? "" },
            created_at: date(data.createTime),
            updated_at: date(data.updateTime),
            attachments: (data.attachments || []).map(/** @param {any} r @returns {Attachment} */ (r) => {
                const name = resourceName(r.name, "attachments");
                if (typeof r.filename !== "string") throw new Error("INVALID_RESPONSE: 缺少附件名称");
                const size = Number(r.size ?? 0);
                if (!Number.isSafeInteger(size) || size < 0) throw new Error("INVALID_RESPONSE: 无效的附件大小");
                if (r.externalLink != null && (typeof r.externalLink !== "string" || (r.externalLink !== "" && !/^https?:\/\//i.test(r.externalLink)))) {
                    throw new Error("INVALID_RESPONSE: 无效的外链附件地址");
                }
                return {
                    name: r.filename,
                    path: r.externalLink || `${endpoint(ctx)}/file/${name}/${encodeURIComponent(r.filename)}`,
                    type: r.type || "",
                    size,
                    // An attachment may only be reused on the same endpoint.
                    metadata: { attachment_name: name, endpoint: endpoint(ctx) },
                };
            }),
        };
    };

    /** @param {Context} ctx @param {RuntimeAttachment} attachment */
    const existingAttachment = (ctx, attachment) => {
        const prefix = `${endpoint(ctx)}/file/attachments/`;
        if (!attachment.path.startsWith(prefix)) return "";
        const id = attachment.path.slice(prefix.length).split("/")[0];
        return resourceName(`attachments/${id}`, "attachments");
    };

    /** @param {Context} ctx @param {RuntimeAttachment[]} attachments */
    const validateAttachments = (ctx, attachments) => {
        for (const attachment of attachments) {
            if (!attachment || typeof attachment.path !== "string") {
                throw new Error("INVALID_CONFIG: 无效的附件地址");
            }
            if (existingAttachment(ctx, attachment)) continue;
            if (!/^https?:\/\//i.test(attachment.path) && !/^attachment:[A-Za-z0-9]+$/.test(attachment.path)) {
                throw new Error("INVALID_CONFIG: 无效的附件引用");
            }
        }
    };

    /** @param {Context} ctx @param {RuntimeAttachment[]} attachments */
    const attachments = (ctx, attachments) => {
        validateAttachments(ctx, attachments);
        return attachments.map((attachment) => {
            const name = existingAttachment(ctx, attachment);
            if (name) return { name };
            /** @type {Record<string, unknown>} */
            const data = { filename: "attachment", type: "application/octet-stream" };
            if (/^https?:\/\//i.test(attachment.path)) {
                data.externalLink = attachment.path;
            } else {
                data["@content"] = attachment.path;
            }
            const result = request(ctx, "/api/v1/attachments", { method: "POST", data }).json();
            return { name: resourceName(result?.name, "attachments") };
        });
    };

    /** @param {unknown} value */
    const visibility = (value) => {
        // Accept old stored numeric values using the visibility enum mapping.
        const result = typeof value === "number" ? ["", "PRIVATE", "PROTECTED", "PUBLIC", "SPACE"][value] : value ?? "PRIVATE";
        if (result !== "PRIVATE" && result !== "PROTECTED" && result !== "PUBLIC" && result !== "SPACE") {
            throw new Error("INVALID_CONFIG: 无效的可见性");
        }
        return result;
    };

    /** @param {Context} ctx @param {RuntimeMemo} memo @param {boolean} updating */
    const memoData = (ctx, memo, updating) => {
        const meta = memo.metadata || {};
        if (typeof memo.content !== "string" || (meta.pinned != null && typeof meta.pinned !== "boolean")) {
            throw new Error("INVALID_CONFIG: 无效的 Memo 内容或置顶状态");
        }
        /** @type {Record<string, unknown>} */
        const data = { content: memo.content };
        if (!updating || meta.pinned != null) data.pinned = meta.pinned ?? false;
        if (!updating || meta.visibility != null) data.visibility = visibility(meta.visibility);
        if (meta.space != null) {
            if (typeof meta.space !== "string" || (meta.space !== "" && !/^spaces\/[A-Za-z0-9_-]+$/.test(meta.space))) throw new Error("INVALID_CONFIG: 无效的空间 ID，应为 spaces/ID");
            if (updating || meta.space) data.space = meta.space;
        }
        if (!updating && data.visibility === "SPACE" && !data.space) throw new Error("INVALID_CONFIG: SPACE 可见性需要填写空间 ID");
        if (memo.attachments != null) validateAttachments(ctx, memo.attachments);
        if (memo.attachments != null) data.attachments = attachments(ctx, memo.attachments);
        return data;
    };

    /** @param {RuntimeMemo} memo */
    const memoId = (memo) => resourceName(memo.id || memo.metadata?.id, "memos");

    /** @type {RemotePlugin<Settings>} */
    const plugin = {
        init(ctx) {
            if (typeof ctx.settings.endpoint !== "string" || !/^https?:\/\/[^/?#@\s]+(?:\/[^?#\s]*)?$/i.test(ctx.settings.endpoint)) {
                throw new Error("INVALID_CONFIG: 接入点必须是无查询参数的 HTTP(S) 地址");
            }
            if (ctx.settings.token != null && typeof ctx.settings.token !== "string") throw new Error("INVALID_CONFIG: Token 必须是字符串");
        },
        preview(ctx, path) {
            /** @type {Record<string, string>} */
            const headers = {};
            if (token(ctx)) headers.Authorization = `Bearer ${token(ctx)}`;
            return { url: path, headers };
        },
        explore(ctx, query) {
            const pageSize = query.page_size ?? 20;
            const offset = query.offset ?? ((query.page ?? 1) - 1) * pageSize;
            if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000 || !Number.isSafeInteger(offset) || offset < 0 || offset % pageSize !== 0) {
                throw new Error("INVALID_CONFIG: 无效的分页参数");
            }
            const page = offset / pageSize + 1;
            const key = `memos.pages.${pageSize}`;
            /** @type {Record<string, string>} */
            const cursors = offset === 0 ? { 1: "" } : JSON.parse(ctx.store.get(key) || '{"1":""}');
            // The host uses page numbers. Follow opaque API cursors without decoding them.
            let start = 1;
            for (const key of Object.keys(cursors)) {
                const known = Number(key);
                if (known > start && known <= page) start = known;
            }
            if (page - start >= 100) throw new Error("NOT_SUPPORTED: 跳页需要回放过多请求，请从第一页顺序读取");
            for (let current = start; current <= page; current++) {
                const result = request(ctx, "/api/v1/memos", {
                    queryParams: { pageSize: String(pageSize), pageToken: cursors[current], state: "NORMAL", orderBy: "pinned desc, create_time desc" },
                }).json();
                if (!result || !Array.isArray(result.memos ?? [])) throw new Error("INVALID_RESPONSE: 无效的 Memo 列表");
                const next = result.nextPageToken ?? "";
                if (typeof next !== "string" || (next && next === cursors[current])) throw new Error("INVALID_RESPONSE: 无效的分页游标");
                if (next) cursors[current + 1] = next;
                ctx.store.set(key, JSON.stringify(cursors));
                if (current === page) return (result.memos || []).map(/** @param {any} m */ (m) => toMemo(ctx, m));
                if (!next) return [];
            }
            return [];
        },
        create(ctx, memo) {
            requireAuth(ctx);
            const data = memoData(ctx, memo, false);
            const response = request(ctx, "/api/v1/memos", { method: "POST", data });
            ctx.store.reset();
            return toMemo(ctx, response.json());
        },
        update(ctx, memo) {
            requireAuth(ctx);
            const id = memoId(memo);
            const data = memoData(ctx, memo, true);
            const response = request(ctx, `/api/v1/${id}`, {
                method: "PATCH",
                queryParams: { updateMask: Object.keys(data).join(",") },
                data: { ...data, name: id },
            });
            ctx.store.reset();
            return toMemo(ctx, response.json());
        },
        delete(ctx, memo) {
            requireAuth(ctx);
            const id = memoId(memo);
            // Preserve the original plugin's archive semantics; do not hard-delete.
            request(ctx, `/api/v1/${id}`, {
                method: "PATCH",
                queryParams: { updateMask: "state" },
                data: { name: id, state: "ARCHIVED" },
            });
            ctx.store.reset();
        },
    };
    return plugin;
})();
