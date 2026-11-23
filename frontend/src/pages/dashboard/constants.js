import {
  Home, CheckSquare, FolderKanban, Columns3, CalendarDays, BarChart3, Activity, ListTodo,
} from 'lucide-react';

export const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];
export const NAV = [
  ['Overview', Home], ['My Day', CheckSquare], ['My Tasks', ListTodo], ['Projects', FolderKanban], ['Boards', Columns3], ['Calendar', CalendarDays],
];
export const NAV_HINT = {
  Overview: 'Your board and stats for all work', 'My Day': 'A short list of what to do today', 'My Tasks': 'Every task, sorted by date',
  Projects: 'Group related tasks into spaces', Boards: 'Drag tasks across To Do, In Progress, Review and Done', Calendar: 'See tasks by due date',
  Reports: 'Weekly progress and focus time', Settings: 'Timezone, reminders and preferences',
};
export const SIDEBAR_FOOTER_NAV = [['Reports', BarChart3], ['Settings', Activity]];
