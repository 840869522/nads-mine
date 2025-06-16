"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { Question, GeminiEvaluationResult } from '@/types';
import QuestionDisplay from '@/components/learning/QuestionDisplay';
import QuizResultDisplay from '@/components/learning/QuizResultDisplay';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import { getScoreAndExplanation } from '@/services/geminiService';

// --- 分页逻辑开始 ---
const QUESTIONS_PER_PAGE = 5; // 定义每页显示的问题数量
// --- 分页逻辑结束 ---

const LearningPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [evaluationResults, setEvaluationResults] = useState<Record<string, GeminiEvaluationResult | null>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/questions').then(res => res.json()).then(setQuestions);
  }, []);

  // --- 分页逻辑开始 ---
  const [currentPage, setCurrentPage] = useState(0); // 新增 state 用于跟踪当前页码 (0-indexed)

  // 计算总页数
  const pageCount = Math.ceil(questions.length / QUESTIONS_PER_PAGE);

  // 根据当前页码，从总问题列表中切片出当前页要显示的问题
  const currentQuestions = questions.slice(
      currentPage * QUESTIONS_PER_PAGE,
      (currentPage + 1) * QUESTIONS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < pageCount - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };
  // --- 分页逻辑结束 ---

  const handleAnswerSubmit = useCallback(async (questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    setLoadingStates(prev => ({ ...prev, [questionId]: true }));
    setGlobalError(null);
    try {
      const originalQuestion = questions.find(q => q.id === questionId)!;
      const result = await getScoreAndExplanation(originalQuestion, answer);
      setEvaluationResults(prev => ({ ...prev, [questionId]: result }));
    } catch (e) {
      console.error("Gemini API error:", e);
      const errorMessage = e instanceof Error ? `问题"${questions.find(q => q.id === questionId)?.text}"未能从AI获取评估。错误: ${e.message}` : `问题"${questions.find(q => q.id === questionId)?.text}"未能从AI获取评估。`;
      setGlobalError(errorMessage);
      setEvaluationResults(prev => ({ ...prev, [questionId]: null }));
    }
    setLoadingStates(prev => ({ ...prev, [questionId]: false }));
  }, [questions]);

  const restartQuiz = () => {
    setUserAnswers({});
    setEvaluationResults({});
    setLoadingStates({});
    setQuizFinished(false);
    setGlobalError(null);
    setCurrentPage(0); // 重置时也要重置页码
  }

  // 计算所有问题是否都已作答
  const allQuestionsAnswered = Object.keys(userAnswers).length === questions.length;


  // 结果页面逻辑
  if (quizFinished) {
    return (
        <Card title="测验结果">
          {questions.map(q => (
              <div key={q.id} className="mb-6 p-4 border dark:border-neutral-700 rounded-lg">
                <h3 className="font-semibold text-lg mb-1">{q.text}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  {`您的答案: ${userAnswers[q.id] || "未作答"}`}
                </p>
                {evaluationResults[q.id] && <QuizResultDisplay result={evaluationResults[q.id]!} />}
                {evaluationResults[q.id] === null && <Alert type="error" message={"未能从AI获取评估。"}/>}
              </div>
          ))}
          <Button onClick={restartQuiz} variant="primary">重新开始测验</Button>
        </Card>
    );
  }

  // 主要渲染逻辑，现在 .map() 遍历的是 currentQuestions
  return (
      <div>
        <h1 className="text-3xl font-bold mb-6 text-neutral-800 dark:text-neutral-100">学习模块：测验时间！</h1>
        {globalError && <Alert type="error" message={globalError} onClose={() => setGlobalError(null)} className="mb-4" />}

        <div className="space-y-6">
          {currentQuestions.map((question) => { // <-- 注意这里
            const isLoading = loadingStates[question.id];
            const result = evaluationResults[question.id];
            const userAnswer = userAnswers[question.id];

            // 计算当前问题在总列表中的序号
            const globalIndex = questions.findIndex(q => q.id === question.id);

            return (
                <Card key={question.id} title={`问题 ${globalIndex + 1} / ${questions.length}`}>
                  <QuestionDisplay
                      question={question}
                      onAnswerSubmit={handleAnswerSubmit}
                      userAnswer={userAnswer}
                      isSubmitted={!!userAnswer}
                      isSubmitting={Object.values(loadingStates).some(s => s)}
                  />
                  {isLoading && <div className="my-4"><Spinner /> <p className="text-center text-sm">AI评估中...</p></div>}

                  {result && !isLoading && (
                      <div className="mt-4">
                        <QuizResultDisplay result={result} />
                      </div>
                  )}
                  {result === null && !isLoading && (
                      <Alert type="warning" message="无法获取AI评估，请检查API Key或网络后重试。" className="mt-4" />
                  )}
                </Card>
            );
          })}
        </div>

        {/* --- 分页逻辑开始 --- */}
        {/* 分页和完成按钮的控制区域 */}
        <div className="mt-8 flex justify-between items-center">
          <Button onClick={handlePreviousPage} disabled={currentPage === 0}>
            上一页
          </Button>

          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            第 {currentPage + 1} / {pageCount} 页
          </span>

          {currentPage < pageCount - 1 ? (
              <Button onClick={handleNextPage}>
                下一页
              </Button>
          ) : (
              <Button
                  onClick={() => setQuizFinished(true)}
                  disabled={!allQuestionsAnswered || Object.values(loadingStates).some(s => s)}
                  variant="primary"
              >
                {allQuestionsAnswered ? "完成测验" : "请先完成所有问题"}
              </Button>
          )}
        </div>
        {/* --- 分页逻辑结束 --- */}

      </div>
  );
};

export default LearningPage;
