import { NextResponse } from 'next/server';
import { z } from 'zod';
import axios, { AxiosRequestConfig } from 'axios';
import url from 'url';
import { Client } from '@elastic/elasticsearch';

// --- Zod Schema for incoming request validation ---
const ExecuteRequestSchema = z.object({
  targetHost: z.string(),
  targetPort: z.number(),
  cwd: z.string(),
  command: z.string(),
  indexName: z.string(), // Added for fallback logging
});

// --- Proxy Configuration ---
const proxyUrl = process.env.HTTP_PROXY || 'http://localhost:3128';
const proxyUrlParts = url.parse(proxyUrl);

// --- API Route Handler ---
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ExecuteRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request body", details: validation.error.flatten() }, { status: 400 });
    }

    const { targetHost, targetPort, cwd, command, indexName } = validation.data;
    const agentUrl = `http://${targetHost}:${targetPort}/execute`;

    const axiosConfig: AxiosRequestConfig = {
      proxy: {
        protocol: proxyUrlParts.protocol || 'http',
        host: proxyUrlParts.hostname || 'localhost',
        port: Number(proxyUrlParts.port) || 3128,
      }
    };

    try {
      const response = await axios.post(
        agentUrl,
        { cwd, command },
        axiosConfig
      );

      return NextResponse.json(response.data, { status: response.status });

    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        // This block catches network errors where there's no response from the agent
        // (e.g., connection refused, timeout, proxy error).
        console.log(`Agent at ${agentUrl} is unreachable. Writing fallback log to Elasticsearch index [${indexName}].`);

        // --- Fallback Logic: Write to Elasticsearch ---
        try {
            const esClient = new Client({
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

            const randomSid = Math.floor(100 + Math.random() * 900).toString();
            const logDocument = {
                uid: "0",
                user: "0",
                sid: randomSid,
                session_id: randomSid,
                tty: "/dev/pts/0",
                cwd: cwd,
                working_dir: cwd,
                filename: command.split(' ')[0] || '',
                command: command,
                full_command: command,
                from: "snoopy",
                timestamp: new Date().toISOString(),
                scene_id: indexName,
                message: `{"uid":"0","sid":"${randomSid}","tty":"/dev/pts/0","cwd":"${cwd}","filename":"${command.split(' ')[0] || ''}","command":"${command}"}`
            };

            await esClient.index({
                index: indexName,
                body: logDocument,
            });

            // Return a success-like response to the frontend to not break the playback flow
            return NextResponse.json({
                status: "fallback",
                message: `Agent was unreachable. Command was logged to Elasticsearch as a fallback.`,
                stdout: `[Fallback] Agent at ${targetHost}:${targetPort} was unreachable.`,
                stderr: "",
            }, { status: 200 });

        } catch (esError: any) {
            console.error(`Fallback failed: Could not write to Elasticsearch.`, esError);
            // If the fallback fails, we must return an error.
            return NextResponse.json({ error: "Agent unreachable and fallback logging failed.", details: esError.message }, { status: 500 });
        }
      }

      // If it's a different kind of Axios error (e.g., 4xx, 5xx from the agent), forward it
      if (axios.isAxiosError(error) && error.response) {
          return NextResponse.json(error.response.data, { status: error.response.status });
      }

      // For non-axios errors
      throw error;
    }

  } catch (error: any) {
    console.error("An unexpected error occurred in execute-command API:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
