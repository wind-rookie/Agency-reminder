<script setup lang="ts">
import type { Todo } from '../stores/todo'
import { PRIORITY_CONFIG as priorityConfig } from '../stores/todo'

defineProps<{
  todo: Todo
}>()

const emit = defineEmits<{
  toggle: [id: string]
  edit: [todo: Todo]
  delete: [id: string]
}>()

function formatTime(time?: string): string {
  if (!time) return ''
  const [hour, minute] = time.split(':')
  return `${hour}:${minute}`
}
</script>

<template>
  <div class="todo-item" :class="{ completed: todo.completed, 'completed-enter-active': todo.completed, 'completed-leave-active': todo.completed }">
    <input 
      type="checkbox" 
      class="checkbox" 
      :checked="todo.completed"
      @change="emit('toggle', todo.id)"
    />
    <span 
      v-if="todo.priority" 
      class="priority-tag"
      :style="{ backgroundColor: priorityConfig[todo.priority]?.color || '#1890ff' }"
    >{{ priorityConfig[todo.priority]?.label || '普通' }}</span>
    <span class="color-tag" :style="{ backgroundColor: todo.color }"></span>
    <span class="tag-label" v-if="todo.tag">{{ todo.tag }}</span>
    <div class="todo-content">
      <div class="todo-title">{{ todo.title }}</div>
    </div>
    <div class="todo-time" v-if="todo.remindTime">
      {{ formatTime(todo.remindTime) }}
      <span v-if="todo.repeat" class="repeat-icon">↻</span>
    </div>
    <div class="todo-actions">
      <button class="icon-btn" @click="emit('edit', todo)" title="编辑">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="icon-btn" @click="emit('delete', todo.id)" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.todo-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  transition: all 0.2s;
  gap: 8px;
}

/* 有背景图时的透明效果 */
:global(.has-bg-image) .todo-item {
  background: rgba(var(--bg-color-rgb), var(--ui-opacity));
}

.todo-item:hover {
  box-shadow: var(--shadow);
}

.todo-item.completed {
  opacity: 0.6;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
}

.checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary-color);
  flex-shrink: 0;
}

.color-tag {
  width: 4px;
  height: 20px;
  border-radius: 2px;
  flex-shrink: 0;
}

.priority-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  flex-shrink: 0;
}

.tag-label {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-secondary);
  border-radius: 4px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.todo-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.todo-title {
  font-size: 14px;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-time {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.repeat-icon {
  font-size: 10px;
}

.todo-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.todo-item:hover .todo-actions {
  opacity: 1;
}

.icon-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-secondary);
  color: var(--primary-color);
}
</style>
