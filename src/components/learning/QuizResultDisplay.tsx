import React from 'react';
import { GeminiEvaluationResult } from '../../types';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';


interface QuizResultDisplayProps {
  result: GeminiEvaluationResult;
}

const QuizResultDisplay: React.FC<QuizResultDisplayProps> = ({ result }) => {

  const renderStars = (score: number) => {
    const totalStars = 10;
    const filledStars = Math.round(score); 
    return (
      <div className="flex">
        {[...Array(totalStars)].map((_, i) =>
          i < filledStars ? (
            <StarSolid key={i} className="h-5 w-5 text-yellow-400" />
          ) : (
            <StarOutline key={i} className="h-5 w-5 text-yellow-400" />
          )
        )}
      </div>
    );
  };
  
  return (
    <div className="mt-4 p-4 border border-primary-500/30 dark:border-primary-500/50 rounded-lg bg-primary-50/50 dark:bg-neutral-800/50 shadow-sm">
      <h4 className="text-lg font-semibold mb-2 text-primary-700 dark:text-primary-300">AI评估：</h4>
      <div className="mb-3">
        <strong className="text-neutral-800 dark:text-neutral-100">分数：</strong>
        <div className="flex items-center space-x-2">
           {renderStars(result.score)} <span className="ml-2 text-neutral-700 dark:text-neutral-200">({result.score}/10)</span>
        </div>
      </div>
      <div className="mb-3">
        <strong className="text-neutral-800 dark:text-neutral-100">解释：</strong>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{result.explanation}</p>
      </div>
      <div>
        <strong className="text-neutral-800 dark:text-neutral-100">对您答案的反馈：</strong>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{result.feedback}</p>
      </div>
    </div>
  );
};

export default QuizResultDisplay;