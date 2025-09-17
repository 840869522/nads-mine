import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Client } from '@elastic/elasticsearch';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import url from 'url';

// Zod Schema
const ExecuteRequestSchema = z.object({
    targetHost: z.string(),
    targetPort: z.number(),
    cwd: z.string(),
    command: z.string(),
    indexName: z.string(),
});
type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

// Proxy Config
const proxyUrl = process.env.HTTP_PROXY || 'http://localhost:3128';
const proxyUrlParts = url.parse(proxyUrl);

// Fallback Helper
async function writeFallbackLog(data: ExecuteRequest, reason: string) {
    console.log(`Fallback Triggered: ${reason}. Logging to ES index [${data.indexName}].`);
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
        const commandParts = data.command.split(' ');
        const logDocument = {
            uid: "0", user: "0", sid: randomSid, session_id: randomSid, tty: "/dev/pts/0",
            cwd: data.cwd, working_dir: data.cwd, filename: commandParts[0] || '',
            command: data.command, full_command: data.command, from: "snoopy",
            timestamp: new Date().toISOString(), scene_id: data.indexName,
            message: `{"uid":"0","sid":"${randomSid}","tty":"/dev/pts/0","cwd":"${data.cwd}","filename":"${commandParts[0] || ''}","command":"${data.command}"}`
        };

        await esClient.index({ index: data.indexName, body: logDocument });

        return NextResponse.json({
            status: "fallback",
            stdout: "", // Per user request, return no output on fallback
            stderr: "",
        }, { status: 200 });

    } catch (esError: any) {
        console.error(`Fallback logging to Elasticsearch failed:`, esError);
        return NextResponse.json({ error: "Agent unreachable and fallback logging also failed.", details: esError.message }, { status: 500 });
    }
}

// API Handler
export async function POST(request: Request) {
    let requestData: ExecuteRequest;
    try {
        requestData = ExecuteRequestSchema.parse(await request.json());
    } catch (e) {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { targetHost, targetPort, cwd, command } = requestData;
    const agentUrl = `http://${targetHost}:${targetPort}/execute`;

    const axiosConfig: AxiosRequestConfig = {
        proxy: {
            protocol: proxyUrlParts.protocol || 'http',
            host: proxyUrlParts.hostname || 'localhost',
            port: Number(proxyUrlParts.port) || 3128,
        },
        timeout: 10000,
        validateStatus: () => true, // IMPORTANT: Treat all status codes as success for manual handling
    };

    try {
        const response = await axios.post(agentUrl, { cwd, command }, axiosConfig);

        if (response.status >= 200 && response.status < 300) {
            return NextResponse.json(response.data);
        } else {
            // This handles HTTP errors like 404, 502 from proxy/agent
            return await writeFallbackLog(requestData, `Agent/Proxy returned status ${response.status}`);
        }
    } catch (error) {
        // This handles network errors (e.g., connection refused) where axios fails to get any response
        if (error instanceof AxiosError) {
            return await writeFallbackLog(requestData, `Network error: ${error.message}`);
        }
        // Handle other unexpected errors
        console.error("An unexpected non-axios error occurred:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}