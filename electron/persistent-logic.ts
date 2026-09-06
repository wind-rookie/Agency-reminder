import type { Todo } from './types'

export interface PersistentNotificationConfig {
  enabled: boolean
  threshold: 1 | 2 | 3
  moveEnabled: boolean
  moveDelay: number
}

/** 判断待办是否触发持久弹窗：开启且优先级达到门槛（越小越紧急） */
export function shouldBePersistent(todo: Todo, config: Pick<PersistentNotificationConfig, 'enabled' | 'threshold'>): boolean {
  return config.enabled
    && typeof todo.priority === 'number'
    && todo.priority <= config.threshold
}

/** 计算保存后需要关闭持久弹窗的 todoId（被删除，或从未完成变为完成） */
export function findClosedTodoIds(before: Todo[], after: unknown): string[] {
  if (!Array.isArray(after)) return []
  const afterById = new Map<string, Todo>()
  for (const item of after) {
    if (item && typeof item === 'object' && typeof (item as Todo).id === 'string') {
      afterById.set((item as Todo).id, item as Todo)
    }
  }
  const closed: string[] = []
  for (const todo of before) {
    const afterTodo = afterById.get(todo.id)
    if (!afterTodo || (!todo.completed && afterTodo.completed)) {
      closed.push(todo.id)
    }
  }
  return closed
}
