import { NextResponse } from 'next/server';
import { Client } from '@elastic/elasticsearch';
import { z } from 'zod';

// --- Zod Schemas for Validation ---

// Schema for incoming request body
const PlaybackRequestSchema = z.object({
    indexNames: z.array(z.string()).min(1),
    groupBy: z.enum(['user', 'session']),
    filterNoise: z.boolean(),
    timeMode: z.enum(['fixed', 'real']),
    fixedIntervalSeconds: z.number().default(1),
});

type PlaybackRequest = z.infer<typeof PlaybackRequestSchema>;

const SnoopyLogSchema = z.object({
    timestamp: z.string(),
    cwd: z.string().optional().nullable(),
    command: z.string().optional().nullable(),
    filename: z.string().optional().nullable(),
    user: z.string().optional().nullable(),
    uid: z.string().optional().nullable(),
    sid: z.string().optional().nullable(),
    pid: z.string().optional().nullable(),
    ppid: z.string().optional().nullable(),
    tty: z.string().optional().nullable(),
    '@timestamp': z.string().optional().nullable(),
    log_timestamp: z.string().optional().nullable(),
}).transform((data, ctx) => { // 使用 ctx 来添加自定义错误
    // 防御性检查：确保 timestamp 是一个非空字符串
    if (typeof data.timestamp !== 'string' || data.timestamp.trim() === '') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Timestamp is not a valid string or is empty.",
        });
        return z.NEVER; // 告诉 Zod 停止处理此条目
    }

    let date;
    const originalTimestamp = data.timestamp;

    // 规范化：空格→T；+0800→+08:00
    const normalize = (s: string) =>
        s.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

    // 尝试1：直接解析（先做规范化以兼容 +0800）
    date = new Date(normalize(originalTimestamp));

    // 尝试2：如果直接解析失败，尝试备用时间戳字段
    if (isNaN(date.getTime())) {
        const alt = (data['@timestamp'] || data.log_timestamp || '').toString();
        if (alt) {
            date = new Date(normalize(alt));
        }
    }

    // 尝试3：仍失败则退化为仅取 "YYYY-MM-DD HH:MM:SS"
    if (isNaN(date.getTime())) {
        const s =
            originalTimestamp ||
            (data['@timestamp'] as string) ||
            (data.log_timestamp as string) ||
            '';
        const match = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
        if (match) {
            date = new Date(`${match[1]}T${match[2]}`);
        }
    }

    // 最终检查和调试日志
    if (isNaN(date.getTime())) {
        // 关键的调试步骤：在服务端打印出有问题的原始数据
        console.error(`[DEBUG] Failed to parse timestamp. Original value: "${originalTimestamp}"`);

        // 向 Zod 添加一个更清晰的错误，而不是直接抛出异常
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_date,
            message: `Invalid time value for timestamp: "${originalTimestamp}"`,
        });
        return z.NEVER; // 告诉 Zod 放弃此条目
    }

    return {
        ts: date,
        user: data.user || data.uid || 'unknown_user',
        command: (data.command || '').trim(),
        filename: (data.filename || '').trim(),
        cwd: data.cwd || '/',
        sid: data.sid || 'unknown_session',
        pid: data.pid || '',
        ppid: data.ppid || '',
        tty: data.tty || '',
    };
});

type SnoopyLog = z.infer<typeof SnoopyLogSchema>;

// --- Configuration ---
const NOISE_COMMAND_PATTERNS = [
    /^uname/,
    /^file -b/,
    /^groups$/,
    /^dircolors/,
    /^arch$/,
    /^captoinfo/,
];

// --- Helper Functions ---

async function fetchAllLogs(client: Client, indexName: string) {
    const allLogs: any[] = [];
    try {
        const scrollSearch = client.helpers.scrollSearch({
            index: indexName,
            size: 1000,
            query: { match: { "from": "snoopy" } },
            _source: [
                "timestamp",
                "@timestamp",
                "log_timestamp",
                "cwd",
                "command",
                "filename",
                "user",
                "uid",
                "sid",
                "pid",
                "ppid",
                "tty",
            ],
        });
        for await (const result of scrollSearch) {
            allLogs.push(...result.documents);
        }
        return allLogs;
    } catch (error: any) {
        if (error.meta && error.meta.statusCode === 404) {
            console.warn(`Index [${indexName}] not found.`);
            return []; // Return empty array if index is not found
        }
        console.error(`Error fetching from Elasticsearch for index [${indexName}]:`, error.message);
        throw error; // Re-throw other errors
    }
}

function filterNoiseCommands(logs: SnoopyLog[]): SnoopyLog[] {
    // 先过滤掉 ppid 和 sid 都存在但不一致的记录
    const step1 = logs.filter(log => {
        const sid = (log.sid || '').toString();
        const ppid = (log.ppid || '').toString();
        if (sid && ppid && sid !== ppid) return false;
        return true;
    });

    // 按秒分组
    const logsByTimestamp = new Map<string, SnoopyLog[]>();
    for (const log of step1) {
        const timestampKey = log.ts.toISOString().slice(0, 19); // Group by second
        if (!logsByTimestamp.has(timestampKey)) {
            logsByTimestamp.set(timestampKey, []);
        }
        logsByTimestamp.get(timestampKey)!.push(log);
    }

    // 每组统一噪声过滤（无论该组只有一条还是多条）
    const filteredLogs: SnoopyLog[] = [];
    for (const group of logsByTimestamp.values()) {
        const realCommands = group.filter(log => {
            const text = `${log.command || ''} ${log.filename || ''}`.trim();
            return !NOISE_COMMAND_PATTERNS.some(pattern => pattern.test(text));
        });
        if (realCommands.length > 0) {
            filteredLogs.push(...realCommands);
        }
    }
    return filteredLogs;
}

function groupAndProcessLogs(
    logs: SnoopyLog[],
    requestBody: PlaybackRequest
) {
    const { groupBy, timeMode, fixedIntervalSeconds } = requestBody;
    logs.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    const groupingKey = groupBy === 'user' ? 'user' : 'sid';

    const groups = logs.reduce((acc, log) => {
        const key = (log as any)[groupingKey];
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
    }, {} as Record<string, SnoopyLog[]>);

    const processedGroups: Record<string, any[]> = {};

    for (const key in groups) {
        const groupLogs = groups[key];
        processedGroups[key] = groupLogs.map((log, index) => {
            const processedLog: any = {
                ts: log.ts.toISOString(),
                cwd: log.cwd,
                command: log.command,
            };

            let sleepMs = 0; // Default to 0 for the last command
            if (index < groupLogs.length - 1) { // If not the last command
                if (timeMode === 'real') {
                    const nextLog = groupLogs[index + 1];
                    sleepMs = nextLog.ts.getTime() - log.ts.getTime();
                } else { // timeMode === 'fixed'
                    sleepMs = fixedIntervalSeconds * 1000;
                }
            }
            processedLog.sleep_until_next_ms = sleepMs;

            return processedLog;
        });
    }

    return processedGroups;
}


// --- API Route Handler ---

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = PlaybackRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid request body", details: validation.error.flatten() }, { status: 400 });
        }

        const requestBody = validation.data;

        // Use the exact client options provided by the user for compatibility.
        const client = new Client({
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

        const responseData: Record<string, any> = {};

        for (const indexName of requestBody.indexNames) {
            try {
                const rawLogs = await fetchAllLogs(client, indexName);

                let validatedLogs = rawLogs
                    .map(log => SnoopyLogSchema.safeParse(log))
                    .filter(result => result.success)
                    .map(result => (result as { success: true; data: SnoopyLog }).data);

                if (requestBody.filterNoise) {
                    validatedLogs = filterNoiseCommands(validatedLogs);
                }

                if (validatedLogs.length === 0) {
                    responseData[indexName] = { status: 'success', groups: {} };
                    continue;
                }

                const processedGroups = groupAndProcessLogs(validatedLogs, requestBody);

                responseData[indexName] = { status: 'success', groups: processedGroups };

            } catch (error: any) {
                console.error(`Failed to process index ${indexName}:`, error);
                responseData[indexName] = { status: 'error', message: error.message || 'An unknown error occurred' };
            }
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("An unexpected error occurred in playback-commands API:", error);
        return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
    }
}
