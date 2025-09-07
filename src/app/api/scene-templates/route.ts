import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SCENE_DIR = path.join(process.cwd(), 'app', 'scenario', 'manage', 'scene');

export async function GET() {
    try {
        // 确保目录存在
        try {
            await fs.access(SCENE_DIR);
        } catch {
            return NextResponse.json([]);
        }

        // 读取目录中的所有 JSON 文件
        const files = await fs.readdir(SCENE_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        // 读取每个 JSON 文件的内容
        const templates = await Promise.all(
            jsonFiles.map(async (fileName) => {
                try {
                    const filePath = path.join(SCENE_DIR, fileName);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    
                    return {
                        fileName,
                        topology_json: data
                    };
                } catch (error) {
                    console.error(`读取文件 ${fileName} 失败:`, error);
                    return null;
                }
            })
        );

        // 过滤掉读取失败的文件
        const validTemplates = templates.filter(template => template !== null);

        return NextResponse.json(validTemplates);

    } catch (error) {
        console.error('读取预置场景模板失败:', error);
        return NextResponse.json(
            { message: '读取预置场景模板失败' },
            { status: 500 }
        );
    }
}
