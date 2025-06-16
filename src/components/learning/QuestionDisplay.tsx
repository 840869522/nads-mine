import React, { useState } from 'react';
import { Question } from '../../types';
import Button from '../ui/Button';

interface QuestionDisplayProps {
  question: Question;
  onAnswerSubmit: (questionId: string, answer: string) => void;
  userAnswer?: string;
  isSubmitted: boolean;
  isSubmitting?: boolean; // Added isSubmitting prop
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ question, onAnswerSubmit, userAnswer, isSubmitted, isSubmitting }) => {
  const [currentAnswer, setCurrentAnswer] = useState<string>(userAnswer || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAnswer.trim()) {
      onAnswerSubmit(question.id, currentAnswer);
    }
  };

  const questionText = question.text;
  const questionOptions = question.options;


  return (
    <div className="p-2">
      <p className="text-xl font-medium mb-4 text-neutral-800 dark:text-neutral-100">{questionText}</p>
      <form onSubmit={handleSubmit}>
        {question.type === 'multiple-choice' && questionOptions && (
          <div className="space-y-3 mb-4">
            {questionOptions.map((optionText, index) => (
              <label key={index} className="flex items-center space-x-3 p-3 border dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name={question.id}
                  value={optionText} // Use the Chinese option text as value
                  checked={currentAnswer === optionText}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  disabled={isSubmitted || isSubmitting}
                  className="form-radio h-5 w-5 text-primary-600 dark:text-primary-500 border-neutral-300 dark:border-neutral-600 focus:ring-primary-500"
                />
                <span className="text-neutral-700 dark:text-neutral-200">{optionText}</span>
              </label>
            ))}
          </div>
        )}
        {question.type === 'short-answer' && (
          <textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isSubmitted || isSubmitting}
            rows={4}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 mb-4"
            placeholder="在此输入您的答案..."
          />
        )}
        {!isSubmitted && (
          <Button type="submit" disabled={!currentAnswer.trim() || isSubmitting}>
            {isSubmitting ? "评估中..." : "提交答案"}
          </Button>
        )}
         {isSubmitted && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">您的答案已提交。请查看下方评估或继续。</p>
        )}
      </form>
    </div>
  );
};

export default QuestionDisplay;