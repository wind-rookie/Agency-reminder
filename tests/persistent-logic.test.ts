import { describe, it, expect } from 'vitest'
import { shouldBePersistent, findClosedTodoIds } from '../electron/persistent-logic'
import type { Todo } from '../electron/types'

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    title: '任务',
    completed: false,
    color: '#1890ff',
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('shouldBePersistent', () => {
  const enabled = { enabled: true, threshold: 2 as const }
  const disabled = { enabled: false, threshold: 2 as const }

  it('开关关闭时恒为 false', () => {
    expect(shouldBePersistent(makeTodo({ priority: 1 }), disabled)).toBe(false)
  })

  it('待办没有优先级时不触发', () => {
    expect(shouldBePersistent(makeTodo(), enabled)).toBe(false)
  })

  it('优先级小于门槛时触发', () => {
    expect(shouldBePersistent(makeTodo({ priority: 1 }), enabled)).toBe(true)
  })

  it('优先级等于门槛时触发（小于等于）', () => {
    expect(shouldBePersistent(makeTodo({ priority: 2 }), enabled)).toBe(true)
  })

  it('优先级大于门槛时不触发', () => {
    expect(shouldBePersistent(makeTodo({ priority: 3 }), enabled)).toBe(false)
  })

  it('门槛为 1 时仅 P1 触发', () => {
    const config = { enabled: true, threshold: 1 as const }
    expect(shouldBePersistent(makeTodo({ priority: 1 }), config)).toBe(true)
    expect(shouldBePersistent(makeTodo({ priority: 2 }), config)).toBe(false)
    expect(shouldBePersistent(makeTodo({ priority: 3 }), config)).toBe(false)
  })

  it('门槛为 3 时 P1/P2/P3 全部触发', () => {
    const config = { enabled: true, threshold: 3 as const }
    expect(shouldBePersistent(makeTodo({ priority: 1 }), config)).toBe(true)
    expect(shouldBePersistent(makeTodo({ priority: 2 }), config)).toBe(true)
    expect(shouldBePersistent(makeTodo({ priority: 3 }), config)).toBe(true)
  })
})

describe('findClosedTodoIds', () => {
  it('after 不是数组时返回空', () => {
    expect(findClosedTodoIds([makeTodo()], null)).toEqual([])
    expect(findClosedTodoIds([makeTodo()], {})).toEqual([])
    expect(findClosedTodoIds([makeTodo()], 'not-array')).toEqual([])
  })

  it('待办被删除时返回其 id', () => {
    const before = [makeTodo({ id: 'a' }), makeTodo({ id: 'b' })]
    const after = [makeTodo({ id: 'b' })]
    expect(findClosedTodoIds(before, after)).toEqual(['a'])
  })

  it('待办从未完成变为完成时返回其 id', () => {
    const before = [makeTodo({ id: 'a', completed: false })]
    const after = [makeTodo({ id: 'a', completed: true })]
    expect(findClosedTodoIds(before, after)).toEqual(['a'])
  })

  it('待办从完成变为未完成时不返回', () => {
    const before = [makeTodo({ id: 'a', completed: true })]
    const after = [makeTodo({ id: 'a', completed: false })]
    expect(findClosedTodoIds(before, after)).toEqual([])
  })

  it('待办未发生变化时不返回', () => {
    const before = [makeTodo({ id: 'a', completed: false })]
    const after = [makeTodo({ id: 'a', completed: false })]
    expect(findClosedTodoIds(before, after)).toEqual([])
  })

  it('删除与完成同时发生时全部返回', () => {
    const before = [
      makeTodo({ id: 'a', completed: false }),
      makeTodo({ id: 'b', completed: false }),
      makeTodo({ id: 'c', completed: true })
    ]
    const after = [makeTodo({ id: 'b', completed: true })]
    const result = findClosedTodoIds(before, after)
    expect(result.sort()).toEqual(['a', 'b', 'c'])
  })
})
