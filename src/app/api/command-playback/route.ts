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

const RequestSchema = z.object({
    index: z.string(),
    groupBy: z.enum(["user", "session"]).default("session"),
    filterNoise: z.boolean().default(false),
});

const NOISE_COMMAND_PATTERNS = [
    /^uname/,
    /^file -b/,
    /^groups$/,
    /^dircolors/,
];

const SnoopyLogSchema = z
    .object({
        timestamp: z.string(),
        cwd: z.string().optional().nullable(),
        working_dir: z.string().optional().nullable(),
        command: z.string().optional().nullable(),
        full_command: z.string().optional().nullable(),
        user: z.string().optional().nullable(),
        uid: z.string().optional().nullable(),
        sid: z.string().optional().nullable(),
        session_id: z.string().optional().nullable(),
    })
    .transform((data) => ({
        ts: new Date(data.timestamp),
        user: data.user || data.uid || "unknown_user",
        command: data.command || data.full_command || 'echo "UNKNOWN COMMAND"',
        cwd: data.cwd || data.working_dir || "/",
        sid: data.sid || data.session_id || "unknown_session",
    }));

async function fetchAllLogs(index: string) {
    const allLogs: any[] = [];
    const scrollSearch = es.helpers.scrollSearch({
        index,
        size: 1000,
        query: { match: { from: "snoopy" } },
        _source: [
            "timestamp",
            "cwd",
            "working_dir",
            "command",
            "full_command",
            "user",
            "uid",
            "sid",
            "session_id",
        ],
    });
    for await (const result of scrollSearch) {
        allLogs.push(...result.documents);
    }
    return allLogs;
}

function filterNoiseCommands(logs: any[]) {
    const logsByTimestamp = new Map<string, any[]>();
    for (const log of logs) {
        const timestampKey = log.ts.toISOString().slice(0, 19);
        if (!logsByTimestamp.has(timestampKey)) {
            logsByTimestamp.set(timestampKey, []);
        }
        logsByTimestamp.get(timestampKey)!.push(log);
    }
    const filteredLogs: any[] = [];
    for (const [, group] of logsByTimestamp.entries()) {
        if (group.length === 1) {
            filteredLogs.push(group[0]);
            continue;
        }
        const realCommands = group.filter(
            (log) => !NOISE_COMMAND_PATTERNS.some((pattern) => pattern.test(log.command))
        );
        if (realCommands.length > 0) {
            filteredLogs.push(...realCommands);
        }
    }
    return filteredLogs;
}

export async function GET(req: NextRequest) {
    const parse = RequestSchema.safeParse({
        index: req.nextUrl.searchParams.get("index"),
        groupBy: (req.nextUrl.searchParams.get("groupBy") as any) || "session",
        filterNoise: req.nextUrl.searchParams.get("filterNoise") === "true",
    });

    if (!parse.success) {
        return NextResponse.json({ ok: false, error: parse.error.flatten() }, { status: 400 });
    }

    const { index, groupBy, filterNoise } = parse.data;

    let rawLogs = await fetchAllLogs(index);
    if (!rawLogs || rawLogs.length === 0) {
        return NextResponse.json({ groups: [] });
    }

    let validatedLogs = rawLogs
        .map((log) => SnoopyLogSchema.safeParse(log))
        .filter((result) => result.success)
        .map((result) => result.data);

    if (filterNoise) {
        validatedLogs = filterNoiseCommands(validatedLogs);
    }

    validatedLogs.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    const groupingKey = groupBy === "user" ? "user" : "sid";
    const groups: Record<string, any[]> = {};
    for (const log of validatedLogs) {
        const key = log[groupingKey];
        if (!groups[key]) groups[key] = [];
        groups[key].push({
            timestamp: log.ts.toISOString(),
            command: log.command,
            cwd: log.cwd,
            user: log.user,
            sid: log.sid,
        });
    }

    return NextResponse.json({
        groups: Object.entries(groups).map(([key, logs]) => ({ key, logs })),
    });
}

