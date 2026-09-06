<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import type { Todo } from '../stores/todo'
import { getRandomColor } from '../stores/todo'

const props = defineProps<{
  editingTodo?: Todo | null
}>()

const emit = defineEmits<{
  close: []
  add: [todo: { title: string; color: string; tag?: string; remindTime?: string; repeat?: 'daily' | 'weekly' | 'monthly' | null; priority?: 1 | 2 | 3 }]
  update: [todo: { title: string; color: string; tag?: string; remindTime?: string; repeat?: 'daily' | 'weekly' | 'monthly' | null; priority?: 1 | 2 | 3 }]
}>()

const title = ref('')
const color = ref('#1890ff')
const tag = ref('')
const remindTime = ref('')
const repeat = ref<'daily' | 'weekly' | 'monthly' | null>(null)
const priority = ref<1 | 2 | 3>(3)  // 默认 普通
const tags = ref<string[]>(['需求', 'Bug', '临时活'])

const priorityOptions = [
  { value: 1, label: '紧急', desc: '紧急任务', color: '#ff4d4f' },
  { value: 2, label: '较高', desc: '较重要任务', color: '#fa8c16' },
  { value: 3, label: '普通', desc: '普通任务', color: '#1890ff' }
] as const

const isEditing = computed(() => !!props.editingTodo)

async function loadTags() {
  const result = await window.electronAPI.getTags?.()
  if (result?.success && result.data && result.data.length > 0) {
    tags.value = result.data
  }
}

watch(() => props.editingTodo, (todo) => {
  if (todo) {
    title.value = todo.title
    color.value = todo.color
    tag.value = todo.tag || ''
    remindTime.value = todo.remindTime || ''
    repeat.value = todo.repeat || null
    priority.value = todo.priority || 3
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  title.value = ''
  color.value = getRandomColor()
  tag.value = ''
  remindTime.value = ''
  repeat.value = null
  priority.value = 3
}

function handleSubmit() {
  if (!title.value.trim()) return
  
  const todoData = {
    title: title.value.trim(),
    color: color.value,
    tag: tag.value || undefined,
    remindTime: remindTime.value || undefined,
    repeat: repeat.value,
    priority: priority.value
  }
  
  if (isEditing.value) {
    emit('update', todoData)
  } else {
    emit('add', todoData)
  }
  resetForm()
}

function handleClose() {
  resetForm()
  emit('close')
}

onMounted(async () => {
  // 组件挂载时加载标签
  await loadTags()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <input 
            v-model="title" 
            type="text" 
            class="input content-input" 
            placeholder="输入待办内容..."
            autofocus
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">优先级</label>
          <div class="priority-options">
            <button 
              v-for="opt in priorityOptions"
              :key="opt.value"
              type="button"
              class="priority-btn"
              :class="{ active: priority === opt.value }"
              :style="priority === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}"
              @click="priority = opt.value"
              :title="opt.desc"
            >{{ opt.label }}</button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">分类标签</label>
          <div class="tag-options">
            <button 
              type="button"
              class="tag-btn"
              :class="{ active: tag === '' }"
              @click="tag = ''"
            >无</button>
            <button 
              v-for="t in tags"
              :key="t"
              type="button"
              class="tag-btn"
              :class="{ active: tag === t }"
              @click="tag = t"
            >{{ t }}</button>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">提醒时间</label>
            <div class="time-input-wrapper">
              <input 
                v-model="remindTime" 
                type="time" 
                class="input time-input"
              />
            </div>
          </div>
          
          <div class="form-group half">
            <label class="form-label">重复</label>
            <select v-model="repeat" class="input select">
              <option :value="null">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="handleClose">取消</button>
          <button type="submit" class="btn btn-primary">{{ isEditing ? '保存' : '添加' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group.half {
  flex: 1;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.input {
  width: 100%;
}

.content-input {
  font-size: 15px;
  padding: 12px;
}

.select {
  cursor: pointer;
}

.tag-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tag-btn:hover {
  border-color: var(--primary-color);
}

.tag-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.priority-options {
  display: flex;
  gap: 8px;
}

.priority-btn {
  padding: 6px 14px;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.priority-btn:hover {
  border-color: var(--primary-color);
}

.priority-btn.active {
  color: white;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.time-input-wrapper {
  position: relative;
}

.time-input {
  cursor: pointer;
}

.time-input::-webkit-calendar-picker-indicator {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}
</style>
