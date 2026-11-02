export const MAX_IMPORTED_TASKS = 100;
export const MAX_TASK_TITLE_LENGTH = 200;

const introductoryLine = /^(here (are|is)|these (are|is)|the following|to do this|for example|in summary|note that|you can|we should|this (is|means|will)|i (want|need|think)|we (want|need|think))\b/i;
const normalizeTitle = (value) => value.replace(/\s+/g, ' ').trim();

export function parseSmartPaste(input) {
  const source = String(input || '');
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const candidates = [];
  const warnings = [];
  let inCodeBlock = false;
  let skippedCode = false;
  let sawNestedItem = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^```|^~~~/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      skippedCode = true;
      continue;
    }
    if (inCodeBlock || !trimmed) continue;

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    const listItem = rawLine.match(/^(\s*)(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)(.+)$/);
    if (listItem) {
      const nested = Boolean(listItem[1].length);
      sawNestedItem ||= nested;
      candidates.push({ title: normalizeTitle(listItem[2]), review: nested });
      continue;
    }
    if (heading) {
      candidates.push({ title: normalizeTitle(heading[1]), review: false });
      continue;
    }
    if (/^(phase|step)\s+\d+\s*:/i.test(trimmed)) {
      candidates.push({ title: normalizeTitle(trimmed), review: false });
      continue;
    }

    const words = trimmed.split(/\s+/);
    if (trimmed.length <= 120 && words.length <= 14 && !introductoryLine.test(trimmed)) {
      candidates.push({
        title: normalizeTitle(trimmed),
        review: /[,;.!?]|\b(because|therefore|so that|which means)\b/i.test(trimmed),
      });
    } else {
      warnings.push(`Skipped text that looks descriptive rather than like a task: “${trimmed.slice(0, 72)}${trimmed.length > 72 ? '…' : ''}”`);
    }
  }

  const seen = new Map();
  const tasks = candidates.slice(0, MAX_IMPORTED_TASKS).map((candidate, index) => {
    const duplicateKey = candidate.title.toLocaleLowerCase();
    const duplicateOf = seen.get(duplicateKey);
    if (duplicateOf === undefined) seen.set(duplicateKey, index);
    return {
      id: `paste-${index}`,
      title: candidate.title,
      selected: true,
      review: candidate.review,
      duplicateOf,
    };
  });

  if (candidates.length > MAX_IMPORTED_TASKS) {
    warnings.push(`Only the first ${MAX_IMPORTED_TASKS} detected tasks are shown. Split the text into smaller imports.`);
  }
  if (skippedCode) warnings.push('Code blocks were skipped to avoid importing code as tasks.');
  if (sawNestedItem) warnings.push('Indented list items may be subtasks. Review them before importing.');
  if (!tasks.length && source.trim()) warnings.push('No task-like lines were detected. Use one task per line or a supported list format.');

  return { tasks, warnings, detectedCount: candidates.length };
}

export function formatTasksForCopy(tasks, format, projectName) {
  const title = (task) => String(task.title || '').replace(/\s+/g, ' ').trim();
  if (format === 'markdown') {
    return tasks.map((task) => `- [${task.status === 'done' ? 'x' : ' '}] ${title(task)}`).join('\n');
  }
  if (format === 'detailed') {
    const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', in_progress: 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High' };
    const ordered = projectName
      ? ['todo', 'in_progress', 'review', 'done'].flatMap((status) => tasks.filter((task) => (task.status === 'in-progress' ? 'in_progress' : task.status) === status))
      : tasks;
    let activeStatus = null;
    const lines = projectName ? [`Project: ${projectName}`, ''] : [];
    ordered.forEach((task, index) => {
      const normalizedStatus = task.status === 'in-progress' ? 'in_progress' : task.status;
      if (projectName && normalizedStatus !== activeStatus) {
        activeStatus = normalizedStatus;
        if (index) lines.push('');
        lines.push(statusLabels[normalizedStatus] || 'To Do');
      }
      lines.push(`${index + 1}. ${title(task)}`);
      lines.push(`Status: ${statusLabels[normalizedStatus] || 'To Do'}`);
      lines.push(`Priority: ${priorityLabels[task.priority] || 'Medium'}`);
    });
    return lines.join('\n');
  }
  return tasks.map((task, index) => `${index + 1}. ${title(task)}`).join('\n');
}
