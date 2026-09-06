<template>
  <div class="notification-wrapper">
    <div class="notification-card" :class="{ persistent }" @click="closeNotification" @mouseenter="notifyHover(true)" @mouseleave="notifyHover(false)">
      <!-- 持久弹窗顶部强调条 -->
      <div v-if="persistent" class="persistent-bar"></div>

      <!-- 关闭按钮 -->
      <button class="close-btn" @click.stop="closeNotification" title="关闭">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- 持久弹窗角标 -->
      <span v-if="persistent" class="persistent-pin" title="持久弹窗·需手动关闭">📌</span>
      
      <!-- 图标区域 -->
      <div class="icon-container">
        <span class="icon-emoji">🐈‍⬛</span>
      </div>
      
      <!-- 内容区域 -->
      <div class="content">
        <div v-if="title" class="content-title">{{ title }}</div>
        <div class="content-body">{{ body || appBranding.notificationTitle }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { appBranding } from '../config/branding'

const title = ref('')
const body = ref('')
const persistent = ref(false)

function closeNotification() {
  window.close()
}

function notifyHover(hovering: boolean) {
  window.electronAPI?.notifyHoverChange?.(hovering)
}

onMounted(() => {
  window.electronAPI?.onNotificationData?.((data: { title: string; body: string; persistent?: boolean }) => {
    title.value = data.title
    body.value = data.body
    persistent.value = data.persistent === true
  })
})

onUnmounted(() => {
  window.electronAPI?.removeNotificationDataListeners?.()
})
</script>

<style scoped>
/* 强制页面背景透明 */
:global(html),
:global(body),
:global(#app) {
  background: transparent !important;
  margin: 0;
  padding: 0;
}

.notification-wrapper {
  width: 100%;
  height: 100%;
  padding: 4px;
  background: transparent;
  box-sizing: border-box;
}

/* 方案C样式 + 方案A动画 */
.notification-card {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;

  /* C: 天空水晶渐变 */
  background: linear-gradient(135deg, #ecfeff 0%, #e0f2fe 50%, #eff6ff 100%);
  border: 1.5px solid rgba(6, 182, 212, 0.25);
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255,255,255,0.8);

  /* A: 右侧滑入动画 */
  animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  transition: all 0.2s ease;
}

/* A: 光晕流动 */
.notification-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 60%);
  animation: shimmer 3s ease-in-out infinite;
  pointer-events: none;
}

.notification-card:hover {
  transform: scale(1.02);
  border-color: rgba(6, 182, 212, 0.5);
  box-shadow: 0 6px 24px rgba(6, 182, 212, 0.15);
}

/* A: 右侧滑入 */
@keyframes slideInRight {
  0% { transform: translateX(100px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* A: 光晕流动 */
@keyframes shimmer {
  0%, 100% { transform: translate(-30%, -30%); }
  50% { transform: translate(10%, 10%); }
}

/* 关闭按钮 - C风格 */
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(6, 182, 212, 0.15);
  background: rgba(6, 182, 212, 0.08);
  color: #0891b2;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(6, 182, 212, 0.15);
  color: #0e7490;
  transform: rotate(90deg);
}

/* C: 图标容器 + A: 弹跳动画 */
.icon-container {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #67e8f9 0%, #7dd3fc 100%);
  animation: iconBounce 2s ease-in-out infinite;
}

.icon-emoji {
  font-size: 22px;
  line-height: 1;
}

/* A: 图标弹跳 */
@keyframes iconBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* C: 内容区域 */
.content {
  flex: 1;
  min-width: 0;
  padding-right: 20px;
}

.content-title {
  font-size: 12px;
  font-weight: 700;
  color: #0e7490;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.content-body {
  font-size: 14px;
  font-weight: 600;
  color: #164e63;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 持久弹窗视觉：边框加粗换色 + 顶部强调条 + 图钉角标 */
.notification-card.persistent {
  border: 2.5px solid rgba(245, 158, 11, 0.7);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.notification-card.persistent:hover {
  border-color: rgba(245, 158, 11, 0.9);
  box-shadow: 0 6px 24px rgba(245, 158, 11, 0.25);
}

.persistent-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #f59e0b, #f97316);
  z-index: 9;
}

.persistent-pin {
  position: absolute;
  top: 9px;
  right: 36px;
  font-size: 12px;
  line-height: 1;
  z-index: 10;
  cursor: default;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}
</style>
