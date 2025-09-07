import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SCENE_DIR = path.join(process.cwd(), 'app', 'scenario', 'manage', 'scene');

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const scenarioId = params.id;
        
        if (!scenarioId) {
            return NextResponse.json({ message: '缺少场景 ID' }, { status: 400 });
        }

        // 从请求体中读取拓扑数据和场景名称
        const { topologyData, scenarioName } = await request.json();

        if (!topologyData) {
            return NextResponse.json({ message: '场景拓扑数据为空，无法导出' }, { status: 400 });
        }

        // 确保 scene 目录存在
        await fs.mkdir(SCENE_DIR, { recursive: true });

        // 生成预置场景文件名（使用场景名称）
        const sanitizedScenarioName = (scenarioName || `scenario_${scenarioId}`)
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_') // 替换非法字符为下划线
            .replace(/_{2,}/g, '_') // 将多个连续下划线替换为单个下划线
            .replace(/^_|_$/g, ''); // 移除开头和结尾的下划线
        
        const fileName = `${sanitizedScenarioName}.json`;
        const sceneFilePath = path.join(SCENE_DIR, fileName);

        // 创建预置场景格式的数据（只包含 edges 和 nodes）
        const presetSceneData = {
            edges: topologyData.edges || [],
            nodes: topologyData.nodes || []
        };

        // 调试信息
        console.log('当前工作目录:', process.cwd());
        console.log('目标目录:', SCENE_DIR);
        console.log('文件路径:', sceneFilePath);
        
        // 检查目录是否存在
        try {
            await fs.access(SCENE_DIR);
            console.log('目录已存在');
        } catch {
            console.log('目录不存在，正在创建...');
            await fs.mkdir(SCENE_DIR, { recursive: true });
            console.log('目录创建完成');
        }

        // 写入预置场景文件
        await fs.writeFile(sceneFilePath, JSON.stringify(presetSceneData, null, 0));

        console.log(`场景已导出为预置场景文件: ${sceneFilePath}`);
        
        // 验证文件是否真的被创建
        try {
            const stats = await fs.stat(sceneFilePath);
            console.log('文件创建成功，大小:', stats.size, '字节');
        } catch (error) {
            console.error('文件创建验证失败:', error);
        }

        return NextResponse.json({
            message: '场景已成功导出为预置场景文件',
            file_name: fileName,
            file_path: sceneFilePath
        });

    } catch (error) {
        console.error('导出场景时出错:', error);
        return NextResponse.json(
            { message: '服务器内部错误，导出失败' },
            { status: 500 }
        );
    }
}
