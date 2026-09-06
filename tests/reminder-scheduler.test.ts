import { describe, it, expect, vi } from 'vitest'
import { createReminderScheduler } from '../electron/reminder-scheduler'
import { getLocalDateString } from '../src/utils/date'
import type { Todo } from '../electron/types'

vi.mock('electron', () => ({
  powerMonitor: { on: vi.fn(), removeListener: vi.fn() }
}))

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    title: '任务',
    completed: false,
    color: '#1890ff',
    date: getLocalDateString(new Date()),
    remindTime: '00:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createDeps(overrides: Record<string, unknown> = {}) {
  const deps = {
    getTodos: () => [] as Todo[],
    getNotificationPosition: () => 'bottom-right' as const,
    showNotification: vi.fn().mockResolvedValue({ success: true }),
    getPersistentConfig: () => ({ enabled: true, threshold: 2 as const, moveEnabled: true, moveDelay: 30 }),
    getRemindedIds: () => [],
    saveRemindedIds: vi.fn(),
    onError: vi.fn(),
    ...overrides
  }
  return deps
}

describe('reminder-scheduler 持久弹窗判断', () => {
  it('配置开启且优先级达标时，showNotification 收到 persistent:true 和 todoId', async () => {
    const todo = makeTodo({ id: 'abc', priority: 1 })
    const showNotification = vi.fn().mockResolvedValue({ success: true })
    const deps = createDeps({
      getTodos: () => [todo],
      getPersistentConfig: () => ({ enabled: true, threshold: 2 as const }),
      showNotification
    })
    const scheduler = createReminderScheduler(deps)
    await scheduler.checkReminders()

    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      persistent: true,
      todoId: 'abc'
    }))
  })

  it('配置关闭时 persistent 为 false', async () => {
    const todo = makeTodo({ id: 'abc', priority: 1 })
    const showNotification = vi.fn().mockResolvedValue({ success: true })
    const deps = createDeps({
      getTodos: () => [todo],
      getPersistentConfig: () => ({ enabled: false, threshold: 2 as const }),
      showNotification
    })
    const scheduler = createReminderScheduler(deps)
    await scheduler.checkReminders()

    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      persistent: false,
      todoId: 'abc'
    }))
  })

  it('优先级不达标时 persistent 为 false', async () => {
    const todo = makeTodo({ id: 'abc', priority: 3 })
    const showNotification = vi.fn().mockResolvedValue({ success: true })
    const deps = createDeps({
      getTodos: () => [todo],
      getPersistentConfig: () => ({ enabled: true, threshold: 2 as const }),
      showNotification
    })
    const scheduler = createReminderScheduler(deps)
    await scheduler.checkReminders()

    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      persistent: false,
      todoId: 'abc'
    }))
  })

  it('已提醒过的待办不会重复触发', async () => {
    const todo = makeTodo({ id: 'abc', priority: 1 })
    const remindKey = `${todo.id}-${todo.date}-${todo.remindTime}`
    const showNotification = vi.fn().mockResolvedValue({ success: true })
    const deps = createDeps({
      getTodos: () => [todo],
      getRemindedIds: () => [remindKey],
      showNotification
    })
    const scheduler = createReminderScheduler(deps)
    await scheduler.checkReminders()

    expect(showNotification).not.toHaveBeenCalled()
  })
})
