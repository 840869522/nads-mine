"use client";
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { BACK_IP_PORT } from '@/constants';
// import { MOCK_QUESTIONS } from '@/constants'; // 我们不再需要模拟数据

interface QuestionPayload {
  id: string | number; // ID可能是数字或字符串
  text: string;
  type: 'short-answer' | 'multiple-choice';
  options?: string[];
}

const AddQuestionPage: React.FC = () => {
  const [allQuestions, setAllQuestions] = useState<QuestionPayload[]>([]); // 初始为空数组
  const [questionText, setQuestionText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 新增: 在页面加载时从API获取问题列表
  useEffect(() => {
    fetch(`${BACK_IP_PORT}/api/questions`)
        .then(res => res.json())
        .then(data => setAllQuestions(data))
        .catch(err => console.error("获取初始问题列表失败:", err));
  }, []);

  // 已改造: 这个函数现在会调用后端API
  const handleAddSingleQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setStatusMessage({ type: 'error', message: '问题文本不能为空！' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${BACK_IP_PORT}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: questionText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '添加到数据库失败');
      }

      const createdQuestion = await response.json();
      setAllQuestions((prev) => [...prev, createdQuestion]);
      setStatusMessage({ type: 'success', message: `问题 "${createdQuestion.text}" 已成功存入数据库！` });
      setQuestionText('');
    } catch (err) {
      setStatusMessage({ type: 'error', message: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 未改动: 批量上传功能保持原样
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
    // ...批量上传的纯前端逻辑保持不变...
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const newQuestions: QuestionPayload[] = JSON.parse(content);
        if (!Array.isArray(newQuestions)) {
          throw new Error('JSON文件内容必须是一个数组。');
        }
        setAllQuestions((prev) => [...prev, ...newQuestions]);
        setStatusMessage({ type: 'success', message: `成功从文件导入 ${newQuestions.length} 个问题！` });
        setSelectedFile(null);
      } catch (err) {
        console.error('Failed to parse or process file:', err);
        setStatusMessage({ type: 'error', message: '文件解析失败，请确保它是格式正确的JSON数组。' });
      }
    };
    reader.readAsText(selectedFile);
  };

  // UI部分保持不变
  return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">题库管理</h1>
        <Card title="增加新问题">
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
                    disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '提交中...' : '确认添加'}
                </Button>
              </div>
            </div>
          </form>
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
        <Card title={`当前题库 (${allQuestions.length} 条)`}>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {allQuestions.map((q, index) => (
                <li key={q.id || index} className="p-2 border-b dark:border-neutral-700 text-sm">
                  <span className="font-mono text-xs mr-2 text-neutral-500">{q.id.toString()}</span>
                  <span className="text-neutral-800 dark:text-neutral-200">{q.text}</span>
                </li>
            ))}
          </ul>
        </Card>
      </div>
  );
};

export default AddQuestionPage;