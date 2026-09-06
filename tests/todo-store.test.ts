import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '../src/stores/todo'
import { getLocalDateString } from '../src/utils/date'
import type { Todo } from '../electron/types'

// 记录每次 saveTodos 的入参，用于断言持久化行为
let savedPayloads: Todo[][] = []
let saveResult: { success: boolean; error?: string } = { success: true }

function stubElectronAPI() {
  savedPayloads = []
  saveResult = { success: true }
  vi.stubGlobal('window', {
    electronAPI: {
      getAllTodos: async () => ({ success: true, data: [] as Todo[] }),
      saveTodos: async (todos: Todo[]) => {
        savedPayloads.push(JSON.parse(JSON.stringify(todos)))
        return saveResult
      }
    }
  })
}

const TODAY = getLocalDateString(new Date())

describe('todo store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stubElectronAPI()
  })

  describe('toggleTodo 幂等性', () => {
    it('重复任务反复切换完成状态只派生一条下一次实例', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('每日站会', '2020-01-01', '#1890ff', undefined, undefined, 'daily')
      expect(store.todos.length).toBe(1)

      await store.toggleTodo(todo.id)
      expect(store.todos.length).toBe(2)
      const generated = store.todos.filter(t => t.generatedFromId === todo.id)
      expect(generated.length).toBe(1)

      // 取消完成 → 再次完成，不应再派生
      await store.toggleTodo(todo.id)
      expect(store.todos.find(t => t.id === todo.id)?.completed).toBe(false)
      expect(store.todos.length).toBe(2)

      await store.toggleTodo(todo.id)
      expect(store.todos.length).toBe(2)
      expect(store.todos.filter(t => t.generatedFromId === todo.id).length).toBe(1)
    })

    it('连续多轮切换后派生数量恒为 1', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('周报', '2020-01-01', '#1890ff', undefined, undefined, 'weekly')
      for (let i = 0; i < 6; i++) {
        await store.toggleTodo(todo.id)
      }
      expect(store.todos.filter(t => t.generatedFromId === todo.id).length).toBe(1)
      expect(store.todos.length).toBe(2)
    })

    it('非重复任务切换不派生新任务', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('一次性任务', '2020-01-01')
      await store.toggleTodo(todo.id)
      await store.toggleTodo(todo.id)
      await store.toggleTodo(todo.id)
      expect(store.todos.length).toBe(1)
    })

    it('派生任务本身完成时会继续派生下一条（各自独立计数）', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('每日站会', '2020-01-01', '#1890ff', undefined, undefined, 'daily')
      await store.toggleTodo(todo.id)
      const generated = store.todos.find(t => t.generatedFromId === todo.id)!

      await store.toggleTodo(generated.id)
      expect(store.todos.length).toBe(3)
      expect(store.todos.filter(t => t.generatedFromId === generated.id).length).toBe(1)
    })

    it('派生任务日期晚于今天且未完成', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('每日站会', '2020-01-01', '#1890ff', undefined, undefined, 'daily')
      await store.toggleTodo(todo.id)
      const generated = store.todos.find(t => t.generatedFromId === todo.id)!
      expect(generated.completed).toBe(false)
      expect(generated.date > TODAY).toBe(true)
    })

    it('切换不存在的 id 不产生任何变更', async () => {
      const store = useTodoStore()
      await store.addTodo('任务', '2026-01-01')
      const before = savedPayloads.length
      await store.toggleTodo('not-exist')
      expect(store.todos.length).toBe(1)
      expect(savedPayloads.length).toBe(before)
    })
  })

  describe('repeatAnchorDay 维护', () => {
    it('monthly 任务创建时按创建日期设置锚点日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('月结', '2026-01-31', '#1890ff', undefined, undefined, 'monthly')
      expect(todo.repeatAnchorDay).toBe(31)
    })

    it('非 monthly 任务不设置锚点日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('每日站会', '2026-01-31', '#1890ff', undefined, undefined, 'daily')
      expect(todo.repeatAnchorDay).toBeUndefined()
    })

    it('monthly 派生任务继承原锚点日而非被截断后的日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('月结', '2020-01-31', '#1890ff', undefined, undefined, 'monthly')
      await store.toggleTodo(todo.id)
      const generated = store.todos.find(t => t.generatedFromId === todo.id)!
      expect(generated.repeatAnchorDay).toBe(31)
    })

    it('从 monthly 改为 daily 时移除锚点日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('月结', '2026-01-31', '#1890ff', undefined, undefined, 'monthly')
      await store.updateTodo(todo.id, { repeat: 'daily' })
      expect(store.todos[0].repeatAnchorDay).toBeUndefined()
    })

    it('从 daily 改为 monthly 时按当前日期补齐锚点日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('任务', '2026-03-15', '#1890ff', undefined, undefined, 'daily')
      await store.updateTodo(todo.id, { repeat: 'monthly' })
      expect(store.todos[0].repeatAnchorDay).toBe(15)
    })

    it('monthly 任务改日期时同步更新锚点日', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('月结', '2026-01-10', '#1890ff', undefined, undefined, 'monthly')
      await store.updateTodo(todo.id, { date: '2026-01-28' })
      expect(store.todos[0].repeatAnchorDay).toBe(28)
    })
  })

  describe('持久化失败处理', () => {
    it('保存失败时记录错误并保持未保存标记', async () => {
      const store = useTodoStore()
      saveResult = { success: false, error: '磁盘只读' }
      const { saved } = await store.addTodo('任务', '2026-01-01')
      expect(saved).toBe(false)
      expect(store.persistenceError).toBe('磁盘只读')
      expect(store.hasUnsavedChanges).toBe(true)
    })

    it('重试成功后清除错误与未保存标记', async () => {
      const store = useTodoStore()
      saveResult = { success: false, error: '磁盘只读' }
      await store.addTodo('任务', '2026-01-01')
      saveResult = { success: true }
      expect(await store.retrySaveTodos()).toBe(true)
      expect(store.persistenceError).toBe('')
      expect(store.hasUnsavedChanges).toBe(false)
    })
  })

  describe('查询与搜索', () => {
    it('applySearch 按标题关键词过滤', async () => {
      const store = useTodoStore()
      await store.addTodo('修复登录 Bug', '2026-01-01')
      await store.addTodo('写周报', '2026-01-01')
      store.searchQuery = 'Bug'
      expect(store.applySearch(store.todos).map(t => t.title)).toEqual(['修复登录 Bug'])
    })

    it('searchQuery 为空时返回原列表', async () => {
      const store = useTodoStore()
      await store.addTodo('任务A', '2026-01-01')
      await store.addTodo('任务B', '2026-01-02')
      expect(store.applySearch(store.todos).length).toBe(2)
    })

    it('getTodosByDateRange 返回闭区间内的任务', async () => {
      const store = useTodoStore()
      await store.addTodo('A', '2026-01-01')
      await store.addTodo('B', '2026-01-05')
      await store.addTodo('C', '2026-01-10')
      expect(store.getTodosByDateRange('2026-01-01', '2026-01-05').map(t => t.title)).toEqual(['A', 'B'])
    })

    it('deleteTodo 移除指定任务并持久化', async () => {
      const store = useTodoStore()
      const { todo } = await store.addTodo('A', '2026-01-01')
      await store.addTodo('B', '2026-01-02')
      await store.deleteTodo(todo.id)
      expect(store.todos.map(t => t.title)).toEqual(['B'])
      expect(savedPayloads.at(-1)?.length).toBe(1)
    })
  })
})
