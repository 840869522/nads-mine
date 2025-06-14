import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { MOCK_QUESTIONS } from '../constants'; // 1. 导入 MOCK_QUESTIONS 作为初始数据源

// Question 类型，确保与你的 types 文件定义一致
interface QuestionPayload {
    id: string;
    text: string;
    type: 'short-answer' | 'multiple-choice';
    options?: string[];
}

const AddQuestionPage: React.FC = () => {
    // --- State 管理 ---
    const [allQuestions, setAllQuestions] = useState<QuestionPayload[]>(MOCK_QUESTIONS); // 2. 新增 state 来管理整个题库列表
    const [questionText, setQuestionText] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null); // 新增 state 用于存储上传的文件

    // --- 事件处理函数 ---

    // 3. 修改 handleSubmit，不再调用API，而是直接更新本地 state
    const handleAddSingleQuestion = (e: FormEvent) => {
        e.preventDefault();
        if (!questionText.trim()) {
            setStatusMessage({ type: 'error', message: '问题文本不能为空！' });
            return;
        }

        const newQuestion: QuestionPayload = {
            id: `q${Date.now()}`,
            text: questionText,
            type: 'short-answer',
        };

        // 直接更新 state
        setAllQuestions(prevQuestions => [...prevQuestions, newQuestion]);

        setStatusMessage({ type: 'success', message: `问题 "${newQuestion.text}" 添加成功！` });
        setQuestionText(''); // 成功后清空输入框
    };

    // 4. 新增文件选择和文件上传处理的函数
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleFileUpload = () => {
        if (!selectedFile) {
            setStatusMessage({ type: 'error', message: '请先选择一个文件！' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const newQuestions: QuestionPayload[] = JSON.parse(content);

                // 验证文件内容是否为数组
                if (!Array.isArray(newQuestions)) {
                    throw new Error("JSON文件内容必须是一个数组。");
                }

                // 更新 state，将新问题追加到现有列表
                setAllQuestions(prevQuestions => [...prevQuestions, ...newQuestions]);
                setStatusMessage({ type: 'success', message: `成功从文件导入 ${newQuestions.length} 个问题！` });
                setSelectedFile(null); // 清空文件选择
            } catch (err) {
                console.error("Failed to parse or process file:", err);
                setStatusMessage({ type: 'error', message: '文件解析失败，请确保它是格式正确的JSON数组。' });
            }
        };
        reader.readAsText(selectedFile);
    };


    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">题库管理</h1>

            {/* --- 增加问题的卡片 --- */}
            <Card title="增加新问题">
                {/* 手动添加 */}
                <form onSubmit={handleAddSingleQuestion} className="border-b dark:border-neutral-700 pb-6 mb-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="questionText" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                问题文本（手动添加）
                            </label>
                            <textarea
                                id="questionText"
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                rows={3}
                                className="w-full p-2 border rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-700"
                                placeholder="在此输入新的问题..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? '提交中...' : '确认添加'}
                            </Button>
                        </div>
                    </div>
                </form>

                {/* 5. 在 JSX 中增加文件上传的UI元素 */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="fileUpload" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            从文件批量导入（JSON格式）
                        </label>
                        <input
                            id="fileUpload"
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-700 file:text-primary-700 dark:file:text-primary-200 hover:file:bg-primary-100 dark:hover:file:bg-primary-600"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleFileUpload} disabled={!selectedFile}>
                            上传文件
                        </Button>
                    </div>
                </div>

                {statusMessage && (
                    <div className="mt-6">
                        <Alert type={statusMessage.type} message={statusMessage.message} onClose={() => setStatusMessage(null)} />
                    </div>
                )}
            </Card>

            {/* 6. 在 JSX 中增加展示当前题库列表的第二个 Card */}
            <Card title={`当前题库 (${allQuestions.length} 条)`}>
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {allQuestions.map((q, index) => (
                        <li key={q.id || index} className="p-2 border-b dark:border-neutral-700 text-sm">
                            <span className="font-mono text-xs mr-2 text-neutral-500">{q.id}</span>
                            <span className="text-neutral-800 dark:text-neutral-200">{q.text}</span>
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
};

export default AddQuestionPage;