import React from 'react';
import { MIN_TASK_CARD_DURATION_MINUTES, PIXELS_PER_MINUTE } from '../constants';
import { Task } from '../types';
import { calculatePriorityScore } from '../utils/scoreUtils';
import { formatMinutes, getRelativeDueDateText } from '../utils/dateUtils';
import { useI18n } from '../i18n';

export type TaskCardReviewStep = 'card' | 'duration' | 'score';

interface OnboardingTaskCardPreviewProps {
  task: Task;
  projectName?: string;
  maxTaskCapacityMinutes: number;
  highlightStep: TaskCardReviewStep;
}

const getMutedClass = (isMuted: boolean) => (
  isMuted ? 'opacity-20' : 'opacity-100'
);

export const OnboardingTaskCardPreview: React.FC<OnboardingTaskCardPreviewProps> = ({
  task,
  projectName,
  maxTaskCapacityMinutes,
  highlightStep,
}) => {
  const { language, t } = useI18n();
  const effectiveDuration = Math.max(task.duration, MIN_TASK_CARD_DURATION_MINUTES);
  const heightStyle = effectiveDuration * PIXELS_PER_MINUTE;
  const score = calculatePriorityScore(task.priority, task.dueDate);
  const scoreProgressPercent = Math.min(100, Math.max(0, (score / 45) * 100));
  const dueDateText = getRelativeDueDateText(task.dueDate, language);
  const isTooLong = maxTaskCapacityMinutes > 0 && task.duration > maxTaskCapacityMinutes;
  const muteMainContent = highlightStep === 'duration' || highlightStep === 'score';
  const muteScore = highlightStep === 'duration';
  const muteBorder = highlightStep === 'score';

  return (
    <div
      draggable={false}
      style={{ height: `${heightStyle}px` }}
      className={`pointer-events-none relative mb-3 flex w-56 flex-col bg-white p-3 text-black transition-[border-color,transform,opacity] duration-500 dark:bg-neutral-800 dark:text-neutral-100 ${
        muteBorder ? 'border border-neutral-300 dark:border-neutral-700' : 'border border-black dark:border-neutral-700'
      }`}
      aria-hidden="true"
    >
      <div className="flex h-full items-start justify-between gap-2">
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <h4 className={`line-clamp-2 break-words text-sm font-bold leading-tight transition-opacity duration-500 ${getMutedClass(muteMainContent)}`}>
            {task.title}
          </h4>
          <div className="mt-auto flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wider">
            {projectName && (
              <span className={`transition-opacity duration-500 ${getMutedClass(muteMainContent)}`}>
                {projectName}
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className={`duration-highlight transition-opacity duration-500 ${getMutedClass(muteMainContent)} ${isTooLong ? 'font-bold text-red-600 dark:text-red-400' : ''}`}>
                {formatMinutes(task.duration, language)}{dueDateText ? ` - ${dueDateText}` : ''}
              </span>
              <span
                className={`score-highlight ml-auto transition-opacity duration-500 ${getMutedClass(muteScore)}`}
                title={t('task.priorityScore')}
              >
                ★{score}
              </span>
            </div>
          </div>
        </div>
        <div className={`h-5 w-5 shrink-0 border border-neutral-200 transition-opacity duration-500 dark:border-neutral-700 ${getMutedClass(muteMainContent)}`} />
      </div>

      <div
        className={`score-highlight absolute bottom-0 left-0 h-1 bg-black transition-[opacity,width] duration-500 dark:bg-neutral-400 ${getMutedClass(muteScore)}`}
        style={{ width: `${scoreProgressPercent}%` }}
      />
    </div>
  );
};
