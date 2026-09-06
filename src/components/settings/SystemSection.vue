<script setup lang="ts">
import { useSettingsStore, type NotificationPosition } from '../../stores/settings'
import type { OperationResult } from '../../../electron/ipc-types'
import SettingsSection from './SettingsSection.vue'
import SettingToggle from './SettingToggle.vue'

const settingsStore = useSettingsStore()

const emit = defineEmits<{
  toast: [payload: { message: string; type: 'success' | 'error' | 'info' }]
}>()

const positionOptions: { value: NotificationPosition; label: string }[] = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' }
]

const priorityThresholdOptions: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'P1 紧急' },
  { value: 2, label: 'P2 较高' },
  { value: 3, label: 'P3 普通' }
]

async function applySettingChange(action: () => Promise<OperationResult>) {
  const result = await action()
  if (!result.success) {
    emit('toast', { message: result.error || '设置保存失败', type: 'error' })
  }
}

async function applyDelayChange(value: number) {
  if (!Number.isFinite(value)) return
  const clamped = Math.min(600, Math.max(5, Math.round(value)))
  const result = await settingsStore.setPersistentMoveDelay(clamped)
  if (!result.success) {
    emit('toast', { message: result.error || '设置保存失败', type: 'error' })
  }
}
</script>

<template>
  <SettingsSection icon="⚙️" title="系统">
    <SettingToggle
      label="开机自启"
      desc="系统启动时自动运行"
      :checked="settingsStore.autoLaunch"
      @change="(v) => applySettingChange(() => settingsStore.setAutoLaunch(v))"
    />

    <!-- 通知位置 -->
    <div class="setting-card position-card">
      <div class="setting-info">
        <span class="setting-label">提醒弹窗位置</span>
        <span class="setting-desc">待办提醒弹窗在屏幕上的位置</span>
      </div>
      <div class="position-options">
        <button
          v-for="pos in positionOptions"
          :key="pos.value"
          class="position-btn"
          :class="{ active: settingsStore.notificationPosition === pos.value }"
          :title="pos.label"
          @click="applySettingChange(() => settingsStore.setNotificationPosition(pos.value))"
        >
          <div class="position-preview" :class="pos.value">
            <div class="preview-box"></div>
          </div>
        </button>
      </div>
    </div>

    <!-- 持久弹窗 -->
    <SettingToggle
      label="持久弹窗"
      desc="达到指定优先级的待办提醒不再自动关闭"
      :checked="settingsStore.persistentNotification"
      @change="(v) => applySettingChange(() => settingsStore.setPersistentNotification(v))"
    />

    <template v-if="settingsStore.persistentNotification">
      <div class="setting-card position-card">
        <div class="setting-info">
          <span class="setting-label">持久弹窗最低优先级</span>
          <span class="setting-desc">达到该级别及更紧急的待办会持久弹窗</span>
        </div>
        <div class="priority-threshold-options">
          <button
            v-for="opt in priorityThresholdOptions"
            :key="opt.value"
            class="priority-threshold-btn"
            :class="{ active: settingsStore.persistentPriorityThreshold === opt.value }"
            @click="applySettingChange(() => settingsStore.setPersistentPriorityThreshold(opt.value))"
          >{{ opt.label }}</button>
        </div>
      </div>

      <SettingToggle
        label="弹球移动"
        desc="停留超时后弹窗在屏幕内弹球移动"
        :checked="settingsStore.persistentMoveEnabled"
        @change="(v) => applySettingChange(() => settingsStore.setPersistentMoveEnabled(v))"
      />

      <div v-if="settingsStore.persistentMoveEnabled" class="setting-card">
        <div class="setting-info">
          <span class="setting-label">移动延迟（秒）</span>
          <span class="setting-desc">弹出后静止多久开始移动，范围 5-600 秒</span>
        </div>
        <input
          type="number"
          class="delay-input"
          :value="settingsStore.persistentMoveDelay"
          min="5"
          max="600"
          @change="(e) => applyDelayChange(Number((e.target as HTMLInputElement).value))"
        />
      </div>
    </template>
  </SettingsSection>
</template>

<style scoped>
.setting-card {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.setting-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1);
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
  display: block;
}

.setting-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

/* 通知位置选择样式 */
.position-card {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.position-options {
  display: flex;
  gap: 8px;
}

.position-btn {
  flex: 1;
  padding: 8px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.position-btn:hover {
  border-color: var(--primary-color);
}

.position-btn.active {
  border-color: var(--primary-color);
  background: rgba(74, 144, 226, 0.1);
}

.position-preview {
  width: 40px;
  height: 28px;
  background: var(--border-color);
  border-radius: 4px;
  position: relative;
  margin: 0 auto;
}

.position-preview .preview-box {
  width: 16px;
  height: 12px;
  background: var(--primary-color);
  border-radius: 2px;
  position: absolute;
}

.position-preview.top-left .preview-box {
  top: 4px;
  left: 4px;
}

.position-preview.top-right .preview-box {
  top: 4px;
  right: 4px;
}

.position-preview.bottom-left .preview-box {
  bottom: 4px;
  left: 4px;
}

.position-preview.bottom-right .preview-box {
  bottom: 4px;
  right: 4px;
}

/* 持久弹窗优先级选择 */
.priority-threshold-options {
  display: flex;
  gap: 8px;
}

.priority-threshold-btn {
  flex: 1;
  padding: 8px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
  transition: all 0.2s;
}

.priority-threshold-btn:hover {
  border-color: var(--primary-color);
}

.priority-threshold-btn.active {
  border-color: var(--primary-color);
  background: rgba(74, 144, 226, 0.1);
}

/* 移动延迟输入 */
.delay-input {
  width: 80px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  font-size: 14px;
  text-align: center;
}

.delay-input:focus {
  border-color: var(--primary-color);
  outline: none;
}
</style>
