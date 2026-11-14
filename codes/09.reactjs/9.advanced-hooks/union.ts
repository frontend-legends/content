// types-only
// Глава 9.09 — «useState или useReducer»: состояние-объединение по status делает невозможное сочетание непредставимым.
// run: tsc (через node run.mjs 09.reactjs/9.advanced-hooks)
type Task = { id: number; done: boolean };

type TasksState =
  | { status: 'idle' | 'loading'; tasks: Task[] }
  | { status: 'error'; tasks: Task[]; error: Error };

type TasksAction =
  | { type: 'load' }
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'failed'; error: Error };

export const failed: TasksState = { status: 'error', tasks: [], error: new Error('boom') };

// «загрузка завершена и ошибка одновременно» не компилируется
// @ts-expect-error
export const impossible: TasksState = { status: 'idle', tasks: [], error: new Error('boom') };

// ошибка без поля error — тоже
// @ts-expect-error
export const noError: TasksState = { status: 'error', tasks: [] };

export function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  switch (action.type) {
    case 'load':
      return { status: 'loading', tasks: state.tasks };
    case 'loaded':
      return { status: 'idle', tasks: action.tasks }; // action сужен: tasks есть
    case 'failed':
      return { status: 'error', tasks: state.tasks, error: action.error };
  }
}

// switch по type сужает действие: в чужой ветке поля нет
export function narrow(action: TasksAction) {
  if (action.type === 'load') {
    // @ts-expect-error
    return action.tasks;
  }
  return null;
}

// error читается только после проверки status
export function message(state: TasksState) {
  // @ts-expect-error
  state.error;
  return state.status === 'error' ? state.error.message : null;
}
