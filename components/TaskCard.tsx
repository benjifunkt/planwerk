import React from 'react';
import { Task } from '../types';
import { MIN_TASK_CARD_DURATION_MINUTES, PIXELS_PER_MINUTE } from '../constants';
import { calculatePriorityScore } from '../utils/scoreUtils';
import { formatMinutes, getRelativeDueDateText } from '../utils/dateUtils';
import { useI18n } from '../i18n';
import type { PendingTaskMove } from '../utils/taskColumnTransitions';

interface TaskCardProps {
  task: Task;
  onToggleDone: (id: string, isDone: boolean) => void;
  onEditTask: (task: Task) => void;
  projectName?: string;
  maxTaskCapacityMinutes: number;
  pendingMove?: PendingTaskMove;
}

const TaskCardComponent: React.FC<TaskCardProps> = ({ task, onToggleDone, onEditTask, projectName, maxTaskCapacityMinutes, pendingMove }) => {
  const { language, t } = useI18n();
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).classList.remove('opacity-50');
  };

  const effectiveDuration = Math.max(task.duration, MIN_TASK_CARD_DURATION_MINUTES);
  const heightStyle = effectiveDuration * PIXELS_PER_MINUTE;

  const score = calculatePriorityScore(task.priority, task.dueDate);
  const scoreProgressPercent = Math.min(100, Math.max(0, (score / 45) * 100));
  const dueDateText = getRelativeDueDateText(task.dueDate, language);
  const isTooLong = maxTaskCapacityMinutes > 0 && task.duration > maxTaskCapacityMinutes;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEditTask(task)}
      style={{ height: `${heightStyle}px` }}
      className={`
        relative flex flex-col p-3 mb-3 border border-black dark:border-neutral-700 bg-white dark:bg-neutral-800 text-black dark:text-neutral-100 cursor-pointer group transition-all duration-200
        ${task.isDone ? 'bg-neutral-100 dark:bg-neutral-900 border-dashed text-neutral-400 dark:text-neutral-500' : 'hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(80,80,80,1)]'}
      `}
    >
      <div className="flex items-start justify-between gap-2 h-full">
        <div className="flex-1 overflow-hidden flex flex-col h-full">
          <h4 className={`font-bold text-sm leading-tight break-words line-clamp-2 ${task.isDone ? 'line-through' : ''}`}>
            {task.title}
          </h4>
          {pendingMove && (
            <p className="mt-1 text-[10px] font-medium leading-tight text-neutral-400 dark:text-neutral-500">
              {t(
                pendingMove.targetColumn === 'done' ? 'task.movingToDone' : 'task.movingToBacklog',
                { count: pendingMove.remainingSeconds },
              )}
            </p>
          )}
          <div className="mt-auto flex flex-col gap-1 text-[10px] font-medium tracking-wider uppercase opacity-60">
            {projectName && <span>{projectName}</span>}
            <div className="flex items-center gap-3">
              <span className={isTooLong ? 'font-bold text-red-600 dark:text-red-400' : ''}>{formatMinutes(task.duration, language)}{dueDateText ? ` - ${dueDateText}` : ''}</span>
              <span className="ml-auto" title={t('task.priorityScore')}>★{score}</span>
            </div>
          </div>
        </div>

        <input
          type="checkbox"
          checked={task.isDone}
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
          }}
          onChange={(e) => {
            e.stopPropagation();
            onToggleDone(task.id, e.target.checked);
          }}
          className="w-5 h-5 mt-0.5 border-black dark:border-neutral-600 rounded-none cursor-pointer accent-black dark:accent-white shrink-0"
        />
      </div>

      {!task.isDone && (
        <div className="absolute left-0 bottom-0 h-1 bg-black dark:bg-neutral-400 transition-all" style={{ width: `${scoreProgressPercent}%` }} />
      )}
    </div>
  );
};

export const TaskCard = React.memo(TaskCardComponent);
