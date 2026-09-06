import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { getLocalDateString, parseLocalDate, getNextPendingRepeatDate } from '../utils/date'
import type { Todo } from '../../electron/types'

export type { Todo } from '../../electron/types'

// 优先级配置
export const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: '紧急', color: '#ff4d4f' },
  2: { label: '较高', color: '#fa8c16' },
  3: { label: '普通', color: '#1890ff' }
}

// 预设颜色
export const COLORS = [
  '#1890ff', // 蓝色
  '#52c41a', // 绿色
  '#faad14', // 黄色
  '#ff4d4f', // 红色
  '#722ed1', // 紫色
  '#eb2f96', // 粉色
  '#fa8c16', // 橙色
  '#13c2c2'  // 青色
]

// 随机颜色
export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const hasUnsavedChanges = ref(false)
  const persistenceError = ref('')
  
  // 标题关键词搜索状态
  const searchQuery = ref('')

  const todayTodos = computed(() => {
    const today = getLocalDateString(new Date())
    return todos.value.filter(t => t.date === today)
  })

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  async function loadTodos() {
    try {
      const result = await window.electronAPI.getAllTodos()
      todos.value = result.data || []
      persistenceError.value = result.success ? '' : result.error || '待办数据无法安全加载'
      hasUnsavedChanges.value = false
    } catch (error) {
      persistenceError.value = error instanceof Error ? error.message : '加载待办失败'
    }
  }

  async function saveTodos(): Promise<boolean> {
    hasUnsavedChanges.value = true
    try {
      // toRaw() 返回原始对象，去除 Vue 响应式代理，避免循环引用且无需深拷贝
      const todosToSave = toRaw(todos.value)
      const result = await window.electronAPI.saveTodos(todosToSave)
      if (!result.success) {
        persistenceError.value = result.error || '待办保存失败'
        return false
      }
      hasUnsavedChanges.value = false
      persistenceError.value = ''
      return true
    } catch (error) {
      persistenceError.value = error instanceof Error ? error.message : '待办保存失败'
      return false
    }
  }

  async function retrySaveTodos(): Promise<boolean> {
    return saveTodos()
  }

  async function addTodo(title: string, date: string, color: string = '#1890ff', tag?: string, remindTime?: string, repeat?: 'daily' | 'weekly' | 'monthly' | null, priority?: 1 | 2 | 3) {
    const todo: Todo = {
      id: generateId(),
      title,
      completed: false,
      color,
      date,
      tag,
      remindTime,
      repeat,
      priority: priority || 3,
      createdAt: new Date().toISOString(),
      repeatAnchorDay: repeat === 'monthly' ? parseLocalDate(date).getDate() : undefined
    }
    todos.value.push(todo)
    const saved = await saveTodos()
    return { todo, saved }
  }

  async function updateTodo(id: string, updates: Partial<Todo>): Promise<boolean> {
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      const previous = todos.value[index]
      const updated = { ...previous, ...updates }
      if (updated.repeat === 'monthly' && (updates.date !== undefined || previous.repeat !== 'monthly' || !updated.repeatAnchorDay)) {
        updated.repeatAnchorDay = parseLocalDate(updated.date).getDate()
      } else if (updated.repeat !== 'monthly') {
        delete updated.repeatAnchorDay
      }
      todos.value[index] = updated
      return saveTodos()
    }
    return false
  }

  async function deleteTodo(id: string) {
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      todos.value.splice(index, 1)
      await saveTodos()
    }
  }

  async function toggleTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      // 完成重复任务时派生下一次实例；generatedFromId 保证反复切换不会重复派生
      if (todo.completed && todo.repeat && !todos.value.some(item => item.generatedFromId === todo.id)) {
        const repeatAnchorDay = todo.repeat === 'monthly'
          ? todo.repeatAnchorDay || parseLocalDate(todo.date).getDate()
          : undefined
        const nextDate = getNextPendingRepeatDate(todo.date, todo.repeat, repeatAnchorDay)
        const newTodo: Todo = {
          ...todo,
          id: generateId(),
          date: nextDate,
          completed: false,
          createdAt: new Date().toISOString(),
          generatedFromId: todo.id,
          repeatAnchorDay
        }
        todos.value.push(newTodo)
      }
      await saveTodos()
    }
  }

  function getTodosByDateRange(startDate: string, endDate: string) {
    return todos.value.filter(t => t.date >= startDate && t.date <= endDate)
  }

  function getTodosByDate(date: string) {
    return todos.value.filter(t => t.date === date)
  }

  // 按标题关键词搜索
  function applySearch(todoList: Todo[]): Todo[] {
    if (!searchQuery.value) return todoList
    return todoList.filter(todo => todo.title.includes(searchQuery.value))
  }

  return {
    todos,
    hasUnsavedChanges,
    persistenceError,
    todayTodos,
    searchQuery,
    applySearch,
    loadTodos,
    retrySaveTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    getTodosByDate,
    getTodosByDateRange
  }
})
