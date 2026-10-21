// Generated from manifest.json and plugin.js; edit those source files.
// ===
// @name         blinko
// @author       honmaple
// @version      1.0.1
// @description  Blinko 笔记，支持 Token 或账号登录、附件上传与预览。
// @icon         https://memos.libforest.com/favicon.ico
// @fields       [{"type":"text","name":"content","label":"记录你的灵感","value":"","isRequired":true},{"type":"attachment","name":"attachments"},{"name":""},{"type":"boolean","name":"isTop","label":"是否置顶","value":false},{"type":"boolean","name":"isShare","label":"是否公开","value":false}]
// @settings     [{"type":"string","name":"endpoint","label":"接入点","value":"","isRequired":true},{"type":"string","name":"username","label":"用户名","value":""},{"type":"password","name":"password","label":"密码","value":""},{"type":"password","name":"token","label":"Token","value":""}]
// ===

// @ts-check
/// <reference path="../../plugin-api.d.ts" />

(function() {
    'use strict';

    /** @typedef {{endpoint: string, token?: string, username?: string, password?: string}} Settings */
    /** @typedef {PluginContext<Settings>} Context */

    /** @param {Context} ctx */
    const endpoint = (ctx) => ctx.settings.endpoint.replace(/\/+$/, "");

    /** @param {unknown} value */
    const noteID = (value) => {
        const id = typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("INVALID_CONFIG: 无效的笔记 ID");
        return id;
    };

    /** @param {Context} ctx @param {string} path */
    const attachmentURL = (ctx, path) => {
        if (typeof path !== "string" || !path) throw new Error("INVALID_RESPONSE: 缺少附件路径");
        if (/^https?:\/\//i.test(path)) return path;
        if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) throw new Error("INVALID_RESPONSE: 无效的附件路径");
        return `${endpoint(ctx)}/${path.replace(/^\/+/, "")}`;
    };

    /** @param {Context} ctx @param {string} url @param {PluginFetchOptions} [options] */
    const request = (ctx, url, options) => {
        options = options || {};
        options.headers = options.headers || {};

        const token = ctx.store.get("token");
        if (token) {
            options.headers["Authorization"] = `Bearer ${token}`;
        }

        const resp = ctx.fetch(`${endpoint(ctx)}${url}`, options);
        if (resp.status < 200 || resp.status >= 300) {
            throw new Error(`请求错误: ${resp.status_text}`);
        }
        return resp;
    }

    /** @param {Context} ctx */
    const handleInit = (ctx) => {
        if (typeof ctx.settings.endpoint !== "string" || !/^https?:\/\/[^/?#@\s]+(?:\/[^?#\s]*)?$/i.test(ctx.settings.endpoint)) {
            throw new Error("接入点未设置");
        }
        for (const value of [ctx.settings.token, ctx.settings.username, ctx.settings.password]) {
            if (value != null && typeof value !== "string") throw new Error("INVALID_CONFIG: 认证配置必须是字符串");
        }
        if (!ctx.settings.token && Boolean(ctx.settings.username) !== Boolean(ctx.settings.password)) throw new Error("INVALID_CONFIG: 用户名和密码必须同时填写");
        ctx.store.set("token", "");
        if (ctx.settings.token) {
            ctx.store.set("token", ctx.settings.token);
            return;
        }
        if (ctx.settings.username && ctx.settings.password) {
            const resp = ctx.fetch(`${endpoint(ctx)}/api/v1/user/login`, {
                method: "POST",
                data: {
                    name: ctx.settings.username,
                    password: ctx.settings.password,
                },
            });
            if (resp.status < 200 || resp.status >= 300) {
                throw new Error(`登录错误: ${resp.status_text}`);
            }
            const token = resp.json()?.token;
            if (typeof token !== "string" || !token) throw new Error("UNAUTHENTICATED: 登录未返回 Token");
            ctx.store.set("token", token);
        }
    }

    /** @param {Context} ctx @param {any} data @returns {Memo} */
    const handleData = (ctx, data) => {
        if (!data || typeof data.content !== "string") throw new Error("INVALID_RESPONSE: 无效的笔记内容");
        const id = noteID(data.id);
        /** @type {Memo} */
        const result = {
            id: String(id),
            content: data.content,
            metadata: {
                id: data.id,
                isTop: data.isTop,
                isShare: data.isShare,
            },
            template: "markdown",
            created_at: new Date(data.createdAt),
            updated_at: new Date(data.updatedAt),
        };
        if (data.attachments && data.attachments.length > 0) {
            result.attachments = data.attachments.map(/** @param {any} r */ (r) => {
                return {
                    name: r.name,
                    size: Number(r.size || 0),
                    type: r.type,
                    path: attachmentURL(ctx, r.path),
                    metadata: {
                        id: r.id,
                        path: r.path,
                    },
                    created_at: new Date(r.createdAt),
                    updated_at: new Date(r.updatedAt),
                };
            });
        }
        return result;
    }

    /** @param {Context} ctx @param {RuntimeAttachment} attachment @param {any[]} [existing] */
    const handleUpload = (ctx, attachment, existing = []) => {
        const retained = existing.find((r) => attachmentURL(ctx, r.path) === attachment.path);
        if (retained) return { name: retained.name, path: retained.path, type: retained.type || "application/octet-stream", size: retained.size || 0 };
        const external = /^https?:\/\//i.test(attachment.path);
        const resp = request(ctx, external ? "/api/file/upload-by-url" : "/api/file/upload", {
            method: "POST",
            ...(external ? { data: { url: attachment.path } } : { formData: { "@file": attachment.path } }),
        });
        const result = resp.json();
        if (!result || typeof result.fileName !== "string" || typeof result.filePath !== "string" || !result.filePath || typeof result.type !== "string" || !Number.isFinite(Number(result.size)) || Number(result.size) < 0) {
            throw new Error("INVALID_RESPONSE: 无效的附件上传响应");
        }
        attachmentURL(ctx, result.filePath);
        return { name: result.fileName, path: result.filePath, type: result.type, size: Number(result.size) };
    };

    /** @param {RuntimeAttachment[]} attachments */
    const validateAttachments = (attachments) => {
        for (const attachment of attachments) {
            if (!attachment || typeof attachment.path !== "string" || !/^(?:attachment:[A-Za-z0-9]+$|https?:\/\/)/i.test(attachment.path)) {
                throw new Error("INVALID_CONFIG: 无效的附件引用");
            }
        }
    };

    /** @param {Context} ctx @param {PluginQuery} filter */
    const handleExplore = (ctx, filter) => {
        const pageSize = filter.page_size ?? 20;
        const offset = filter.offset ?? ((filter.page ?? 1) - 1) * pageSize;
        if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(offset) || offset < 0 || offset % pageSize !== 0) throw new Error("INVALID_CONFIG: 无效的分页参数");
        const token = ctx.store.get("token");
        const resp = request(ctx, !token ? "/api/v1/note/public-list" : "/api/v1/note/list", {
            method: "POST",
            data: {
                "page": offset / pageSize + 1,
                "size": pageSize,
                "type": 0,
                "isArchived": false,
            }
        });
        const rows = resp.json();
        if (!Array.isArray(rows)) throw new Error("INVALID_RESPONSE: 无效的笔记列表");
        return rows.map((r) => {
            return handleData(ctx, r);
        });
    };

    /** @param {Context} ctx @param {RuntimeMemo} form */
    const handleCreate = (ctx, form) => {
        const token = ctx.store.get("token");
        if (!token) {
            throw new Error("不支持的操作");
        }

        if (typeof form.content !== "string") throw new Error("INVALID_CONFIG: 笔记内容必须是字符串");
        /** @type {Record<string, unknown>} */
        const data = {
            type: 0,
            content: form.content,
        }
        if (form.metadata) {
            data.isTop = form.metadata.isTop || false;
            data.isShare = form.metadata.isShare || false;
        }
        const attachments = form.attachments || [];
        validateAttachments(attachments);
        data.attachments = attachments.map((r) => handleUpload(ctx, r));

        const resp = request(ctx, "/api/v1/note/upsert", {
            method: "POST",
            data: data
        })
        const detail = request(ctx, "/api/v1/note/detail", {
            method: "POST",
            data: {
                "id": noteID(resp.json()?.id),
            }
        });
        return handleData(ctx, detail.json());
    };

    /** @param {Context} ctx @param {RuntimeMemo} form */
    const handleUpdate = (ctx, form) => {
        const token = ctx.store.get("token");
        if (!token) {
            throw new Error("不支持的操作");
        }

        const id = noteID(form.id || form.metadata?.id);

        if (typeof form.content !== "string") throw new Error("INVALID_CONFIG: 笔记内容必须是字符串");
        const attachments = form.attachments || [];
        validateAttachments(attachments);
        const current = request(ctx, "/api/v1/note/detail", { method: "POST", data: { id } }).json();
        if (!current || noteID(current.id) !== id || !Array.isArray(current.attachments)) throw new Error("INVALID_RESPONSE: 无效的笔记详情");
        if (current.attachments.some(/** @param {any} r */ (r) => !attachments.some((a) => a.path === attachmentURL(ctx, r.path)))) {
            throw new Error("NOT_SUPPORTED: Blinko upsert 不支持解除附件关联，请在 Blinko 中移除附件");
        }
        const data = {
            id: id,
            type: 0,
            content: form.content,
            isTop: form.metadata?.isTop,
            isShare: form.metadata?.isShare,
            attachments: attachments.map((r) => handleUpload(ctx, r, current.attachments)),
        };

        const resp = request(ctx, "/api/v1/note/upsert", {
            method: "POST",
            data: data
        })

        const detail = request(ctx, "/api/v1/note/detail", {
            method: "POST",
            data: {
                "id": noteID(resp.json()?.id),
            }
        });
        return handleData(ctx, detail.json());
    };

    /** @param {Context} ctx @param {RuntimeMemo} form */
    const handleDelete = (ctx, form) => {
        const token = ctx.store.get("token");
        if (!token) {
            throw new Error("不支持的操作");
        }

        const id = noteID(form.id || form.metadata?.id);

        request(ctx, "/api/v1/note/batch-trash", {
            method: "POST",
            data: {
                ids: [id],
            }
        })
    };

    /** @type {RemotePlugin<Settings>} */
    const plugin = {
        preview(ctx, path) {
            /** @type {Record<string, string>} */
            const headers = {};
            const token = ctx.store.get("token");
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            return { url: path, headers };
        },
        init: handleInit,
        create: handleCreate,
        update: handleUpdate,
        delete: handleDelete,
        explore: handleExplore,
    };
    return plugin;
})();
