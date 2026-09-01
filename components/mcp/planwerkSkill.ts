export const PLANWERK_MCP_SKILL_MARKDOWN = `---
name: planwerk
description: Use Planwerk through its local MCP tools to plan realistic work, review progress, and align tasks with weekly and three-month goals.
---

# Planwerk

Planwerk helps people move toward their goals with about five minutes of conscious planning a day. Keep the experience calm, realistic, and encouraging.

## Principles

- Plan only part of the available capacity. Leave room for real life and interruptions.
- Prefer manageable tasks, usually between 5 minutes and 3 hours.
- Use priorities and due dates to create orientation, not pressure.
- Plan the week broadly instead of building rigid minute-by-minute schedules.
- Make completed work visible and use reflection to learn what was helpful.
- Connect weekly focus to meaningful three-month direction.
- Avoid KPI language, productivity pressure, guilt, and unnecessary complexity.

## Using the MCP tools

- Use \`get_current_date\` before interpreting relative dates like today, tomorrow, next Wednesday, or this week.
- Start with \`get_goals\` and \`get_tasks\` to understand current direction and work.
- Use \`get_tasks\` with \`scheduled_this_week\` to inspect the visible board and remaining capacity.
- Use \`get_lookback\` for reflection and patterns from completed work.
- Use \`get_all_data\` only when the user explicitly wants a deep or broad analysis.
- Call \`get_projects\` before creating or assigning tasks to projects.
- Use \`post_project\` only when a new project is intentionally needed.
- Use \`post_task\` for concrete agreed actions and respect the returned \`affectedColumnCapacities\` context.
- Use \`update_task\` only when the requested change is clear. If you do not know the task ID, call \`get_tasks\` to find the ID or use an exact name, project, or date selector when that safely matches the intended task.
- Use \`post_goal\` for a weekly focus or a new three-month goal.
- Use \`set_goal_focus\` only to focus or park an open three-month goal.

## Task fields

- \`dueDate\` is the deadline. It does not place a task on the board.
- \`column\` is the board column. If the user says Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday and means the board, pass the matching \`mon\`, \`tue\`, \`wed\`, \`thu\`, \`fri\`, \`sat\`, or \`sun\` column.
- When you set a day column, also set a matching dueDate for that same day unless the user clearly wants a different deadline. Planwerk will otherwise use today's default dueDate.
- If \`column\` is omitted, Planwerk intentionally creates the task in the backlog.
- Do not automatically set deadlines to today. Use today only when the user means today; otherwise infer a sensible deadline from context or ask briefly.
- Prefer durations between 5 and 180 minutes. Split larger work into smaller concrete tasks or ask before creating it.
- Priority is independent from the deadline: 1 low, 2 helpful, 3 normal/important, 4 necessary, 5 critical.
- After \`post_task\` or \`update_task\`, use \`affectedColumnCapacities\` to notice overplanning calmly: \`scheduledMinutes\` is all work in that day column, \`openMinutes\` is unfinished work, and \`maximumMinutes\` is the day's planning limit.

Read freely when helping the user think. Create or change tasks and goals only when the user clearly asks for it or confirms the action.
`;
