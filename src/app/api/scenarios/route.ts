import {NextRequest, NextResponse} from 'next/server';
import fs from 'fs/promises';
import path from 'path';
const SCENARIOS_DIR = path.join(process.cwd(), 'saved_scenarios');

export async function POST(request: Request) {
    try {
        // 1. 从请求体中解构出所有字段
        const { name, description, createdAt, topology } = await request.json();

        // 2. 更新验证逻辑
        if (!name || !topology || !topology.nodes || !topology.edges) {
            return NextResponse.json(
                { message: '数据格式无效，缺少场景名称或拓扑数据' },
                { status: 400 }
            );
        }

        // 3. (可选) 清理名称，用于生成安全的文件名
        const sanitizedName = name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
        const fileName = `${sanitizedName}_${Date.now()}.json`;

        const dirPath = path.join(process.cwd(), 'saved_scenarios');
        const filePath = path.join(dirPath, fileName);

        // 4. 将包含元数据的完整对象保存起来
        const dataToSave = {
            name,
            description,
            createdAt,
            topology,
        };

        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));

        console.log(`场景已成功保存到: ${filePath}`);
        return NextResponse.json(
            { message: '场景已成功保存到服务器', filePath },
            { status: 201 }
        );

    } catch (error) {
        console.error('保存场景时出错:', error);
        return NextResponse.json(
            { message: '服务器内部错误' },
            { status: 500 }
        );
    }
}
// --- 新增的 GET 方法 ---
export async function GET() {
    try {
        // 确保目录存在，如果不存在则返回空数组
        try {
            await fs.access(SCENARIOS_DIR);
        } catch {
            console.log("场景目录不存在，返回空列表。");
            return NextResponse.json([]);
        }

        const fileNames = await fs.readdir(SCENARIOS_DIR);
        const scenarioFiles = fileNames.filter(file => file.endsWith('.json'));

        const scenariosData = await Promise.all(
            scenarioFiles.map(async (fileName) => {
                const filePath = path.join(SCENARIOS_DIR, fileName);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(fileContent);

                // 构造返回给前端的数据结构
                return {
                    id: fileName, // 使用文件名作为唯一ID
                    name: data.name,
                    description: data.description,
                    uploadDate: data.createdAt, // 使用文件中的创建日期
                    nodeCount: data.topology.nodes.length,
                };
            })
        );

        return NextResponse.json(scenariosData);

    } catch (error) {
        console.error('获取场景列表时出错:', error);
        return NextResponse.json({ message: '服务器内部错误，获取列表失败' }, { status: 500 });
    }
}
// --- 新增的 DELETE 方法 ---
export async function DELETE(request: NextRequest) {
    try {
        // 1. 从请求的 URL 中获取查询参数 'id'
        const scenarioId = request.nextUrl.searchParams.get('id');

        if (!scenarioId) {
            return NextResponse.json({ message: '缺少场景 ID' }, { status: 400 });
        }

        // 2. 构造文件的完整路径
        const filePath = path.join(SCENARIOS_DIR, scenarioId);

        // 安全性检查：确保文件路径没有跳出预期的目录
        if (path.dirname(filePath) !== SCENARIOS_DIR) {
            return NextResponse.json({ message: '无效的文件路径' }, { status: 400 });
        }

        // 3. 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json({ message: '找不到要删除的场景文件' }, { status: 404 });
        }

        // 4. 执行删除操作
        await fs.unlink(filePath);

        console.log(`场景文件已删除: ${filePath}`);

        // 5. 返回成功的响应
        return NextResponse.json({ message: '场景已成功删除' }, { status: 200 });

    } catch (error) {
        console.error('删除场景时出错:', error);
        return NextResponse.json({ message: '服务器内部错误，删除失败' }, { status: 500 });
    }
}