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

// Schema for parsing logs from Elasticsearch
const SnoopyLogSchema = z.object({
  timestamp: z.string(),
  cwd: z.string().optional().nullable(),
  working_dir: z.string().optional().nullable(),
  command: z.string().optional().nullable(),
  full_command: z.string().optional().nullable(),
  user: z.string().optional().nullable(),
  uid: z.string().optional().nullable(),
  sid: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
}).transform((data) => ({
  ts: new Date(data.timestamp),
  user: data.user || data.uid || 'unknown_user',
  command: data.command || data.full_command || 'echo "UNKNOWN COMMAND"',
  cwd: data.cwd || data.working_dir || '/',
  sid: data.sid || data.session_id || 'unknown_session',
}));

type SnoopyLog = z.infer<typeof SnoopyLogSchema>;

// --- Configuration ---
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
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
      _source: ["timestamp", "cwd", "working_dir", "command", "full_command", "user", "uid", "sid", "session_id"],
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
  const logsByTimestamp = new Map<string, SnoopyLog[]>();

  for (const log of logs) {
    const timestampKey = log.ts.toISOString().slice(0, 19); // Group by second
    if (!logsByTimestamp.has(timestampKey)) {
      logsByTimestamp.set(timestampKey, []);
    }
    logsByTimestamp.get(timestampKey)!.push(log);
  }

  const filteredLogs: SnoopyLog[] = [];
  for (const group of logsByTimestamp.values()) {
    if (group.length === 1) {
      filteredLogs.push(group[0]);
      continue;
    }
    const realCommands = group.filter(log =>
      !NOISE_COMMAND_PATTERNS.some(pattern => pattern.test(log.command))
    );
    if (realCommands.length > 0) {
      filteredLogs.push(...realCommands);
    }
  }
  return filteredLogs;
}

function groupAndProcessLogs(
  logs: SnoopyLog[],
  groupBy: 'user' | 'session',
  timeMode: 'fixed' | 'real'
) {
  logs.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const groupingKey = groupBy === 'user' ? 'user' : 'sid';

  const groups = logs.reduce((acc, log) => {
    const key = log[groupingKey];
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

      if (timeMode === 'real' && index < groupLogs.length - 1) {
        const nextLog = groupLogs[index + 1];
        processedLog.sleep_until_next_ms = nextLog.ts.getTime() - log.ts.getTime();
      }

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

    const { indexNames, groupBy, filterNoise, timeMode } = validation.data;
    const client = new Client({
        node: ELASTICSEARCH_NODE,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
    const responseData: Record<string, any> = {};

    for (const indexName of indexNames) {
      try {
        const rawLogs = await fetchAllLogs(client, indexName);

        let validatedLogs = rawLogs
          .map(log => SnoopyLogSchema.safeParse(log))
          .filter(result => result.success)
          .map(result => (result as { success: true; data: SnoopyLog }).data);

        if (filterNoise) {
          validatedLogs = filterNoiseCommands(validatedLogs);
        }

        if (validatedLogs.length === 0) {
            responseData[indexName] = { status: 'success', groups: {} };
            continue;
        }

        const processedGroups = groupAndProcessLogs(validatedLogs, groupBy, timeMode);

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
