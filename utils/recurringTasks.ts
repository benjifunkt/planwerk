import { RecurringTemplate, ReflectionValue, Task } from '../types';
import { calculateInitialNextGenDate, getLocalISODateWithOffset } from './dateUtils';

export const RECURRING_TASK_TIMER_MAX_DELAY_MS = 24 * 60 * 60 * 1000;

type CreateRecurringTasksUpdateOptions = {
  tasks: Task[];
  templates: RecurringTemplate[];
  now?: number;
  createId: (generatedIndex: number, template: RecurringTemplate) => string;
};

type RecurringTasksUpdate = {
  tasks: Task[];
  templates: RecurringTemplate[];
  hasChanges: boolean;
};

const getNextGenerationDate = (template: RecurringTemplate): number => {
  const date = new Date(template.nextGenerationDate);

  if (template.recurrenceType === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (template.recurrenceType === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (template.recurrenceType === 'biweekly') {
    date.setDate(date.getDate() + 14);
  } else if (template.recurrenceType === 'monthly') {
    const targetDay = template.dayOfMonth || 1;
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(targetDay, lastDay));
  }

  return date.getTime();
};

export const createRecurringTasksUpdate = ({
  tasks,
  templates,
  now = Date.now(),
  createId,
}: CreateRecurringTasksUpdateOptions): RecurringTasksUpdate => {
  let hasChanges = false;
  let generatedIndex = 0;
  const newTasks = [...tasks];

  const newTemplates = templates.map(template => {
    const currentTemplate = { ...template };

    if (!currentTemplate.nextGenerationDate) {
      currentTemplate.recurrenceType = currentTemplate.recurrenceType || 'weekly';
      currentTemplate.dayOfWeek = currentTemplate.dayOfWeek || 1;
      currentTemplate.timeOfDay = currentTemplate.timeOfDay || '09:00';
      currentTemplate.nextGenerationDate = calculateInitialNextGenDate(
        currentTemplate.recurrenceType,
        currentTemplate.dayOfWeek,
        currentTemplate.dayOfMonth,
        currentTemplate.timeOfDay
      );
      hasChanges = true;
    }

    while (currentTemplate.nextGenerationDate <= now) {
      const dueDate = currentTemplate.dueDateOffsetDays != null
        ? getLocalISODateWithOffset(
          currentTemplate.dueDateOffsetDays,
          new Date(currentTemplate.nextGenerationDate)
        )
        : null;

      newTasks.push({
        id: `task_${createId(generatedIndex, currentTemplate)}`,
        title: currentTemplate.title,
        duration: currentTemplate.duration,
        priority: currentTemplate.priority,
        projectId: currentTemplate.projectId,
        dueDate,
        status: 'backlog',
        isDone: false,
        reflectionValue: ReflectionValue.Unreflected,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        reflectedAt: null,
        orderIndex: 0,
      });
      generatedIndex += 1;
      hasChanges = true;

      currentTemplate.nextGenerationDate = getNextGenerationDate(currentTemplate);
    }

    return currentTemplate;
  });

  return hasChanges
    ? { tasks: newTasks, templates: newTemplates, hasChanges }
    : { tasks, templates, hasChanges };
};

export const getNextRecurringGenerationDelay = (
  templates: RecurringTemplate[],
  now = Date.now(),
  maxDelayMs = RECURRING_TASK_TIMER_MAX_DELAY_MS
): number | null => {
  const generationDates = templates
    .map(template => template.nextGenerationDate)
    .filter(date => Number.isFinite(date));

  if (generationDates.length === 0) return null;

  const nextGenerationDate = Math.min(...generationDates);
  return Math.min(Math.max(0, nextGenerationDate - now), maxDelayMs);
};
