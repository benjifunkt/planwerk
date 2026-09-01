import { COLUMNS } from '../../constants';
import { ColumnId, Goal, Priority, Project, Task, WeeklyGoal } from '../../types';
import type { ResolvedLanguage } from '../../i18n';

type DefineWithAiPromptContext = {
  language: ResolvedLanguage;
  locale: string;
  toneInstruction: string;
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  tasks: Task[];
  projects: Project[];
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_OPEN_TASKS_IN_AI_PROMPT = 20;
const HIGH_PRIORITY_FOR_AI_PROMPT = Priority.Necessary;

const COLUMN_ORDER = COLUMNS.reduce<Record<ColumnId, number>>((acc, column, index) => {
  acc[column.id] = index;
  return acc;
}, {} as Record<ColumnId, number>);

const parseISODateAtLocalNoon = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateString);
  return new Date(year, month - 1, day, 12);
};

const formatTimestampDate = (timestamp: number, locale: string): string => (
  new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(timestamp))
);

const formatISODate = (dateString: string | null, locale: string): string | null => (
  dateString ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseISODateAtLocalNoon(dateString)) : null
);

const getStartOfLocalDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getTaskDueTime = (task: Task): number | null => (
  task.dueDate ? parseISODateAtLocalNoon(task.dueDate).getTime() : null
);

const getGoalRelatedProjectIds = (
  projects: Project[],
  openThreeMonthGoals: Goal[],
  openWeeklyGoals: WeeklyGoal[]
): Set<string> => {
  const currentGoalText = [...openThreeMonthGoals, ...openWeeklyGoals]
    .map(goal => goal.title)
    .join(' ')
    .toLocaleLowerCase();

  return new Set(
    projects
      .filter(project => {
        const projectName = project.name.trim().toLocaleLowerCase();
        return projectName.length > 0 && currentGoalText.includes(projectName);
      })
      .map(project => project.id)
  );
};

export const filterRelevantOpenTasks = (
  tasks: Task[],
  relatedProjectIds: Set<string>,
  now: number = Date.now()
): Task[] => {
  const seenTaskIds = new Set<string>();
  const today = getStartOfLocalDay(new Date(now)).getTime();
  const soonestRelevantDueDate = today + TWO_WEEKS_MS;
  const isDueSoon = (task: Task) => {
    const dueTime = getTaskDueTime(task);
    return dueTime != null && dueTime <= soonestRelevantDueDate;
  };
  const isProjectRelated = (task: Task) => (
    task.projectId != null && relatedProjectIds.has(task.projectId)
  );
  const getSortableDueTime = (task: Task) => {
    const dueTime = getTaskDueTime(task);
    return dueTime == null ? Number.MAX_SAFE_INTEGER : Math.max(dueTime, today);
  };
  const getRelevanceScore = (task: Task) => (
    (isDueSoon(task) ? 1000 : 0)
    + (task.priority >= HIGH_PRIORITY_FOR_AI_PROMPT ? 800 : 0)
    + (isProjectRelated(task) ? 200 : 0)
    + (task.priority * 10)
  );

  return tasks
    .filter(task => {
      if (task.isDone || seenTaskIds.has(task.id)) return false;
      seenTaskIds.add(task.id);
      return true;
    })
    .sort((a, b) => {
      const relevanceDelta = getRelevanceScore(b) - getRelevanceScore(a);
      if (relevanceDelta !== 0) return relevanceDelta;

      const aDueTime = getSortableDueTime(a);
      const bDueTime = getSortableDueTime(b);
      if (aDueTime !== bDueTime) return aDueTime - bDueTime;

      if (a.priority !== b.priority) return b.priority - a.priority;

      const projectRelatedDelta = Number(!isProjectRelated(a)) - Number(!isProjectRelated(b));
      if (projectRelatedDelta !== 0) return projectRelatedDelta;

      const columnDelta = (COLUMN_ORDER[a.status] ?? Number.MAX_SAFE_INTEGER) - (COLUMN_ORDER[b.status] ?? Number.MAX_SAFE_INTEGER);
      if (columnDelta !== 0) return columnDelta;
      return a.orderIndex - b.orderIndex;
    })
    .slice(0, MAX_OPEN_TASKS_IN_AI_PROMPT);
};

export const buildDefineWithAiPrompt = ({
  language,
  locale,
  toneInstruction,
  goals,
  weeklyGoals,
  tasks,
  projects,
}: DefineWithAiPromptContext): string => {
  const projectNameById = new Map(projects.map(project => [project.id, project.name]));
  const labels = language === 'de'
    ? {
      noProject: 'Kein Projekt',
      noDueDate: 'kein Fälligkeitsdatum',
      duration: 'Dauer',
      minutes: 'Min.',
      priority: 'Prio',
      project: 'Projekt',
      dueDate: 'Fällig am',
      completedAt: 'Erledigt am',
      focused: 'Fokussiert',
      parked: 'Geparkt',
      noWeeklyGoal: 'Aktuell ist kein Wochenziel definiert.',
      noThreeMonthGoal: 'Aktuell ist keine Drei-Monats-Richtung definiert.',
      noCompletedWeeklyGoals: 'Bisher wurden keine Wochenziele erreicht.',
      noCompletedThreeMonthGoals: 'Bisher wurden keine Drei-Monats-Richtungen erreicht.',
      noOpenTasks: 'Bisher wurden keine passenden Aufgaben gefunden.',
      noCompletedTasks: 'In den letzten 14 Tagen wurden keine Aufgaben erledigt.',
    }
    : {
      noProject: 'No project',
      noDueDate: 'no due date',
      duration: 'Duration',
      minutes: 'min',
      priority: 'Prio',
      project: 'Project',
      dueDate: 'Due',
      completedAt: 'Completed',
      focused: 'Focused',
      parked: 'Parked',
      noWeeklyGoal: 'No weekly goal is currently defined.',
      noThreeMonthGoal: 'No 3-month direction is currently defined.',
      noCompletedWeeklyGoals: 'No weekly goals have been reached yet.',
      noCompletedThreeMonthGoals: 'No 3-month directions have been reached yet.',
      noOpenTasks: 'No relevant open tasks were found.',
      noCompletedTasks: 'No tasks were completed in the last 14 days.',
    };

  const getProjectName = (projectId: string | null): string => (
    projectId ? projectNameById.get(projectId) || labels.noProject : labels.noProject
  );

  const formatOpenTask = (task: Task): string => (
    `- ${task.title} - ${labels.duration} ${task.duration} ${labels.minutes} - ${labels.priority} ${task.priority} - ${labels.project} ${getProjectName(task.projectId)} - ${labels.dueDate} ${formatISODate(task.dueDate, locale) || labels.noDueDate}`
  );

  const formatCompletedTask = (task: Task): string => (
    `- ${task.title} - ${labels.duration} ${task.duration} ${labels.minutes} - ${labels.priority} ${task.priority} - ${labels.project} ${getProjectName(task.projectId)} - ${labels.completedAt} ${formatTimestampDate(task.completedAt ?? task.updatedAt, locale)}`
  );

  const openWeeklyGoals = weeklyGoals
    .filter(goal => goal.completedAt == null)
    .sort((a, b) => a.createdAt - b.createdAt);
  const completedWeeklyGoals = weeklyGoals
    .filter(goal => goal.completedAt != null)
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
  const openThreeMonthGoals = goals
    .filter(goal => goal.completedAt == null)
    .sort((a, b) => {
      if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  const completedThreeMonthGoals = goals
    .filter(goal => goal.completedAt != null)
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
  const relatedProjectIds = getGoalRelatedProjectIds(projects, openThreeMonthGoals, openWeeklyGoals);
  const relevantOpenTasks = filterRelevantOpenTasks(tasks, relatedProjectIds);
  const twoWeeksAgo = Date.now() - TWO_WEEKS_MS;
  const recentlyCompletedTasks = tasks
    .filter(task => task.isDone && task.completedAt != null && task.completedAt >= twoWeeksAgo)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const hasCurrentGoals = openThreeMonthGoals.length > 0 || openWeeklyGoals.length > 0;

  const sections: string[] = [];

  if (language === 'de') {
    const goalFeedbackRequest = hasCurrentGoals
      ? `1. Einen kurzen ersten Eindruck zum Gesamtbild und knappes Feedback zu meinen aktuellen Zielen.
   Prüfe, ob sie hilfreich, zu vage, eher Aufgaben, zu groß, zu klein oder Platzhalter sind. Wenn sinnvoll, schlage bessere Formulierungen vor.`
      : `1. Einen kurzen ersten Eindruck zum Gesamtbild.
   Versuche aus Aufgaben, Projekten und bisher erledigter Arbeit zu erkennen, welche Richtung gerade sinnvoll sein könnte.`;

    sections.push(`Ich nutze eine App, die mir helfen soll, bewusster meine Tage und Wochen zu planen. Es geht nicht um KPI, OKR oder Projektmanagement, sondern um eine klare, menschliche Richtung.

Bitte hilf mir auf Basis von allem, was du über mich weißt, und dem folgenden Kontext aus der App.

Heute ist der ${formatTimestampDate(Date.now(), locale)}.

Es geht um zwei Ebenen:
1. Eine Richtung für die nächsten 3 Monate:
   Was soll in 3 Monaten spürbar anders sein?
2. Ein optionales Wochenziel:
   Woran möchte ich diese Woche bewusst arbeiten?

Wichtig:
- Ziele müssen nicht perfekt messbar sein.
- Ziele sollen konkret, realistisch, menschlich formuliert und spürbar überprüfbar sein.
- Ziele sollen Richtung geben, nicht Druck erzeugen.
- Bitte keine KPI-, OKR-, Consulting- oder Projektmanagement-Sprache.
- Formuliere eher wie ein guter Freund, der mir hilft, mich zu sortieren.
- Nimm dir bewusst Zeit und denke gründlich nach, bevor du antwortest.
- Schau vor allem auf das Gesamtbild aus Zielen, Aufgaben, Projekten und erledigter Arbeit.
- Bestehende Ziele sind Kontext, keine Grenze. Schlage auch andere Richtungen vor, wenn sie sinnvoller wirken.
- Pro Ziel maximal 2 Sätze.
- Wochenziele: 6-14 Wörter, ideal ca. 10 Wörter.
- Drei-Monats-Richtungen: 10-22 Wörter, ideal ca. 16 Wörter.
- Keine langen Bulletlisten unter einzelnen Zielen.
- Keine separaten Abschnitte zu Kennzahlen oder Erfolgsmessung.
- Starte ohne lange Einleitung mit einem kurzen ersten Eindruck in maximal 2 Sätzen.
- Antworte kompakt genug, dass ich die Antwort in wenigen Minuten lesen kann.

Bitte liefere:
${goalFeedbackRequest}

2. Genau 5 Vorschläge für eine Richtung für die nächsten 3 Monate.
   Je 10-22 Wörter, ideal ca. 16 Wörter. Formuliere sie so, dass ich am Ende spüren kann, ob ich ihr näher gekommen bin.

3. Genau 3 Vorschläge für ein optionales Wochenziel für diese Woche.
   Je 6-14 Wörter, ideal ca. 10 Wörter. Kurz, konkret und menschlich. Das Wochenziel muss nicht direkt von der Drei-Monats-Richtung abhängen.

4. Genau 5 kurze Gegenfragen.
   Die Fragen sollen mir helfen, zu entscheiden, welches Ziel gerade wirklich passt.
   Beziehe dich dabei, soweit vorhanden, konkret auf meine aktuellen und zuletzt erreichten Ziele sowie auf offene Aufgaben, die gerade vor mir liegen.

Kontext aus der App:`);

    sections.push(`Aktuelle Drei-Monats-Ziele:
${openThreeMonthGoals.length > 0 ? openThreeMonthGoals.map(goal => `- ${goal.title} - ${goal.isFocused ? labels.focused : labels.parked}`).join('\n') : `- ${labels.noThreeMonthGoal}`}`);

    sections.push(`Aktuelle Wochenziele:
${openWeeklyGoals.length > 0 ? openWeeklyGoals.map(goal => `- ${goal.title}`).join('\n') : `- ${labels.noWeeklyGoal}`}`);

    sections.push(`Bisher erreichte Drei-Monats-Ziele:
${completedThreeMonthGoals.length > 0 ? completedThreeMonthGoals.map(goal => `- ${goal.title} - erreicht am ${formatTimestampDate(goal.completedAt ?? goal.updatedAt, locale)}`).join('\n') : `- ${labels.noCompletedThreeMonthGoals}`}`);

    sections.push(`Bisher erreichte Wochenziele:
${completedWeeklyGoals.length > 0 ? completedWeeklyGoals.map(goal => `- ${goal.title} - erreicht am ${formatTimestampDate(goal.completedAt ?? goal.updatedAt, locale)}`).join('\n') : `- ${labels.noCompletedWeeklyGoals}`}`);

    sections.push(`Offene Aufgaben:
${relevantOpenTasks.length > 0 ? relevantOpenTasks.map(formatOpenTask).join('\n') : `- ${labels.noOpenTasks}`}`);

    sections.push(`Erledigte Aufgaben der letzten 14 Tage:
${recentlyCompletedTasks.length > 0 ? recentlyCompletedTasks.map(formatCompletedTask).join('\n') : `- ${labels.noCompletedTasks}`}`);

    sections.push(toneInstruction);

    return sections.join('\n\n');
  }

  const goalFeedbackRequest = hasCurrentGoals
    ? `1. A brief first impression of the overall picture and concise feedback on my current goals.
   Check whether they are helpful, too vague, more like tasks, too big, too small, or placeholders. If useful, suggest better wording.`
    : `1. A brief first impression of the overall picture.
   Use the tasks, projects, and recently completed work to infer which direction might make sense right now.`;

  sections.push(`I use an app that helps me plan my days and weeks more deliberately. This is not about KPIs, OKRs, or project management; it is about finding a clear, human direction.

Please help me based on everything you know about me and the following context from the app.

Today is ${formatTimestampDate(Date.now(), locale)}.

There are two levels:
1. A direction for the next 3 months:
   What should feel noticeably different in 3 months?
2. An optional weekly goal:
   What do I want to work on deliberately this week?

Important:
- Goals do not need to be perfectly measurable.
- Goals should sound concrete, realistic, humanly worded, and noticeably checkable.
- Goals should create direction, not pressure.
- Please avoid KPI, OKR, consulting, and project management language.
- Write more like a good friend helping me sort myself out.
- Take your time and think carefully before answering.
- Focus especially on the overall picture from goals, tasks, projects, and completed work.
- Existing goals are context, not a boundary. Suggest different directions too if they seem more useful.
- Maximum 2 sentences per goal.
- Weekly goals: 6-14 words, ideally around 10 words.
- 3-month directions: 10-22 words, ideally around 16 words.
- No long bullet lists under individual goals.
- No separate sections about metrics or success measurement.
- Start without a long introduction, with a brief first impression in no more than 2 sentences.
- Keep the answer compact enough that I can read it in a few minutes.

Please provide:
${goalFeedbackRequest}

2. Exactly 5 suggestions for a direction for the next 3 months.
   10-22 words each, ideally around 16 words. Phrase them so I can later feel whether I moved closer to them.

3. Exactly 3 suggestions for an optional weekly goal for this week.
   6-14 words each, ideally around 10 words. Short, concrete, and human. The weekly goal does not need to directly depend on the 3-month direction.

4. Exactly 5 short follow-up questions.
   The questions should help me decide which goal truly fits right now.
   Where available, refer specifically to my current and most recently reached goals, as well as open tasks that currently lie ahead.

App context:`);

  sections.push(`Current 3-month goals:
${openThreeMonthGoals.length > 0 ? openThreeMonthGoals.map(goal => `- ${goal.title} - ${goal.isFocused ? labels.focused : labels.parked}`).join('\n') : `- ${labels.noThreeMonthGoal}`}`);

  sections.push(`Current weekly goals:
${openWeeklyGoals.length > 0 ? openWeeklyGoals.map(goal => `- ${goal.title}`).join('\n') : `- ${labels.noWeeklyGoal}`}`);

  sections.push(`Previously reached 3-month goals:
${completedThreeMonthGoals.length > 0 ? completedThreeMonthGoals.map(goal => `- ${goal.title} - reached on ${formatTimestampDate(goal.completedAt ?? goal.updatedAt, locale)}`).join('\n') : `- ${labels.noCompletedThreeMonthGoals}`}`);

  sections.push(`Previously reached weekly goals:
${completedWeeklyGoals.length > 0 ? completedWeeklyGoals.map(goal => `- ${goal.title} - reached on ${formatTimestampDate(goal.completedAt ?? goal.updatedAt, locale)}`).join('\n') : `- ${labels.noCompletedWeeklyGoals}`}`);

  sections.push(`Open tasks:
${relevantOpenTasks.length > 0 ? relevantOpenTasks.map(formatOpenTask).join('\n') : `- ${labels.noOpenTasks}`}`);

  sections.push(`Tasks completed in the last 14 days:
${recentlyCompletedTasks.length > 0 ? recentlyCompletedTasks.map(formatCompletedTask).join('\n') : `- ${labels.noCompletedTasks}`}`);

  sections.push(toneInstruction);

  return sections.join('\n\n');
};
