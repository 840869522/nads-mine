// app/api/ingest-control/route.ts  (或 pages/api/ingest-control.ts，按你的项目结构放置)
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@elastic/elasticsearch";
import { z } from "zod";

const es = new Client({
    node: process.env.ES_NODE || "http://127.0.0.1:9200",
    auth:
        process.env.ES_USERNAME && process.env.ES_PASSWORD
            ? { username: process.env.ES_USERNAME, password: process.env.ES_PASSWORD }
            : undefined,
    headers: {
        accept: "application/vnd.elasticsearch+json; compatible-with=8",
        "content-type": "application/vnd.elasticsearch+json; compatible-with=8",
    },
});

// —— 仅用于前端兜底/过滤展示（不会影响后端计算）——
const DEFAULT_INCLUDE_FIELDS: Record<string, string[]> = {
    snoopy: [
        "timestamp",
        "unixtime",
        "scene_id",
        "from",
        "user",
        "session_id",
        "working_dir",
        "full_command",
        "message",
        "uid",
        "sid",
        "tty",
        "cwd",
        "filename",
        "command",
    ],
    zeek_conn: [
        "ts",
        "uid",
        "id.orig_h",
        "id.orig_p",
        "id.resp_h",
        "id.resp_p",
        "proto",
        "service",
        "duration",
        "orig_bytes",
        "resp_bytes",
        "conn_state",
        "local_orig",
        "local_resp",
        "missed_bytes",
        "history",
        "orig_pkts",
        "orig_ip_bytes",
        "resp_pkts",
        "resp_ip_bytes",
        "tunnel_parents",
        "scene_id",
        "from",
    ],
    sysdig: ["message", "scene_id", "from"],
};

const BodySchema = z.object({
    index: z.string().min(1),
    include: z
        .object({
            snoopy: z.array(z.string()).optional(),
            zeek_conn: z.array(z.string()).optional(),
            sysdig: z.array(z.string()).optional(),
        })
        .partial()
        .optional(),
    pause: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
    try {
        const index = req.nextUrl.searchParams.get("index");
        if (!index) {
            return NextResponse.json(
                { ok: false, error: "Missing 'index' query param" },
                { status: 400 }
            );
        }

        const pipelineId = `fields-${sanitizeId(index)}`;

        // 先尝试获取当前索引的 final_pipeline（仅用于信息展示，不作为强制前提）
        let currentFinal: string | undefined;
        try {
            const settings = (await es.indices.getSettings({
                index,
                name: "index.final_pipeline",
            })) as any;
            currentFinal = settings?.[index]?.settings?.index?.final_pipeline;
        } catch {
            // 索引不存在或没有权限等 → 不影响继续查询 pipeline
        }

        // 查询我们命名的 pipeline 定义（即使没被指向，也尝试读取）
        let pipe: any | undefined;
        try {
            const resp = (await es.ingest.getPipeline({ id: pipelineId })) as any;
            pipe = resp?.[pipelineId];
        } catch {
            // 可能 404
        }

        if (!pipe) {
            return NextResponse.json({
                ok: true,
                found: false,
                final_pipeline: currentFinal || null,
                paused: false,
                include: null,
                message: "pipeline not found; use defaults on UI",
            });
        }

        const processors: any[] = Array.isArray(pipe.processors) ? pipe.processors : [];
        const isDropOnly =
            processors.length > 0 &&
            processors.every((p) => p?.drop && p.drop.if === "true");

        if (isDropOnly) {
            return NextResponse.json({
                ok: true,
                found: true,
                final_pipeline: currentFinal || null,
                paused: true,
                include: null, // 暂停状态无法还原字段，交给前端用默认
                message: "pipeline is DROP-only (paused); UI should use defaults",
            });
        }

        // 找脚本处理器并读取 allowTop/allowNested
        const scriptProc = processors.find((p) => p?.script && p.script.params);
        const allowTop = scriptProc?.script?.params?.allowTop || {};
        const allowNested = scriptProc?.script?.params?.allowNested || {};

        // 反推 include（最小改动：仅支持两层 a 或 a.b）
        const include = invertAllowMapsToInclude(allowTop, allowNested);

        // 仅保留 UI 已知的字段（不会丢错，但能避免把不在树里的字段放进去造成“全选态判断异常”）
        const filteredInclude: Record<string, string[]> = {};
        for (const [src, arr] of Object.entries(include)) {
            const allowList = DEFAULT_INCLUDE_FIELDS[src] || [];
            filteredInclude[src] = arr.filter((f) => allowList.includes(f));
        }

        return NextResponse.json({
            ok: true,
            found: true,
            final_pipeline: currentFinal || null,
            paused: !!pipe?._meta?.paused || false,
            include: filteredInclude,
        });
    } catch (err: any) {
        const status = err?.statusCode || 500;
        return NextResponse.json(
            { ok: false, error: err?.message || "Unknown error", details: err?.meta?.body ?? undefined },
            { status }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { index, include, pause } = BodySchema.parse(body);

        const effectiveInclude: Record<string, string[]> = {
            snoopy: include?.snoopy ?? DEFAULT_INCLUDE_FIELDS.snoopy,
            zeek_conn: include?.zeek_conn ?? DEFAULT_INCLUDE_FIELDS.zeek_conn,
            sysdig: include?.sysdig ?? DEFAULT_INCLUDE_FIELDS.sysdig,
        };

        const { allowTop, allowNested } = buildAllowMaps(effectiveInclude);
        const pipelineId = `fields-${sanitizeId(index)}`;

        // 切换前的 final_pipeline
        const before = (await es.indices.getSettings({
            index,
            name: "index.final_pipeline",
        })) as any;
        const prevFinal: string | undefined =
            before?.[index]?.settings?.index?.final_pipeline;

        const processors: any[] = pause
            ? [{ drop: { if: "true" } }]
            : [
                {
                    script: {
                        lang: "painless",
                        params: { allowTop, allowNested },
                        source: painlessPruneScriptFixed,
                    },
                },
            ];

        await es.ingest.putPipeline({
            id: pipelineId,
            body: {
                description:
                    "Per-index field include (and optional pause). Auto-generated by Next.js API.",
                _meta: {
                    managed_by: "next-api",
                    index,
                    paused: !!pause,
                    updated_at: new Date().toISOString(),
                },
                processors,
                on_failure: pause
                    ? undefined
                    : [
                        {
                            set: {
                                field: "_ingest.error",
                                value: "{{ _ingest.on_failure_message }}",
                            },
                        },
                    ],
            },
        });

        await es.indices.putSettings({
            index,
            body: { index: { final_pipeline: pipelineId } },
        });

        // 清理旧 pipeline（无人引用且以 fields- 开头）
        if (prevFinal && prevFinal !== pipelineId && prevFinal.startsWith("fields-")) {
            try {
                const all = (await es.indices.getSettings({
                    index: "*",
                    name: "index.final_pipeline",
                })) as any;

                let stillUsed = false;
                for (const [idx, cfg] of Object.entries<any>(all)) {
                    const fp = cfg?.settings?.index?.final_pipeline;
                    if (fp === prevFinal) {
                        stillUsed = true;
                        break;
                    }
                }
                if (!stillUsed) {
                    await es.ingest.deletePipeline({ id: prevFinal });
                }
            } catch {
                // 忽略清理失败
            }
        }

        return NextResponse.json({
            ok: true,
            index,
            pipelineId,
            paused: !!pause,
            includeEffective: effectiveInclude,
            message: pause
                ? "Final pipeline 已设置为 DROP（暂停写入）。"
                : "Final pipeline 已设置为字段白名单裁剪脚本。",
        });
    } catch (err: any) {
        const status = err?.statusCode || 500;
        return NextResponse.json(
            { ok: false, error: err?.message || "Unknown error", details: err?.meta?.body ?? undefined },
            { status }
        );
    }
}

function sanitizeId(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 256);
}

function buildAllowMaps(include: Record<string, string[]>) {
    const allowTop: Record<string, string[]> = {};
    const allowNested: Record<string, Record<string, string[]>> = {};

    for (const [src, fields] of Object.entries(include)) {
        const tops = new Set<string>();
        const nested: Record<string, Set<string>> = {};

        for (const f of fields) {
            const parts = f.split(".");
            const top = parts[0];
            tops.add(top);
            if (parts.length >= 2) {
                const sub = parts[1];
                if (!nested[top]) nested[top] = new Set<string>();
                nested[top].add(sub);
            }
        }

        allowTop[src] = Array.from(tops);

        const nestedOut: Record<string, string[]> = {};
        for (const [top, subs] of Object.entries(nested)) {
            nestedOut[top] = Array.from(subs);
        }
        if (Object.keys(nestedOut).length > 0) {
            allowNested[src] = nestedOut;
        }
    }
    return { allowTop, allowNested };
}

function invertAllowMapsToInclude(
    allowTop: Record<string, string[]>,
    allowNested: Record<string, Record<string, string[]>>
): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [src, tops] of Object.entries(allowTop || {})) {
        const nestedMap = allowNested?.[src] || {};
        const list: string[] = [];
        for (const top of tops || []) {
            const subs = nestedMap?.[top];
            if (Array.isArray(subs) && subs.length > 0) {
                for (const sub of subs) list.push(`${top}.${sub}`);
            } else {
                list.push(top);
            }
        }
        out[src] = list;
    }
    return out;
}

// —— 更稳的 Painless（与前版一致）——
const painlessPruneScriptFixed = String.raw`
String src = null;
if (ctx.containsKey('log_type') && ctx.log_type != null) {
  src = ctx.log_type.toString();
} else if (ctx.containsKey('from') && ctx.from != null) {
  src = ctx.from.toString();
}
if ('zeek'.equals(src)) { src = 'zeek_conn'; }

def topList = params.allowTop != null ? params.allowTop.get(src) : null;
if (topList == null) return;

def keep = new HashSet(topList);
keep.add('@timestamp');

def keys = new ArrayList(ctx.keySet());
for (def k : keys) {
  if (k instanceof String && ((String)k).startsWith('_')) continue;
  if (!keep.contains(k)) { ctx.remove(k); }
}

def nestedMap = params.allowNested != null ? params.allowNested.get(src) : null;
if (nestedMap != null) {
  for (def e : nestedMap.entrySet()) {
    def top = e.getKey();
    def subs = new HashSet(e.getValue());
    if (ctx.containsKey(top) && ctx[top] instanceof Map) {
      def m = (Map) ctx[top];
      def subkeys = new ArrayList(m.keySet());
      for (def sk : subkeys) {
        if (!subs.contains(sk)) { m.remove(sk); }
      }
    }
  }
}
`;
