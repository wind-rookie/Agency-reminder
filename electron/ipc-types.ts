import type { OperationResult, StorageSelectionResult, Todo } from './types'

export type { OperationResult, StorageSelectionResult, Todo } from './types'

/** 存储配置键的联合类型（只读）——用于 getConfig/setConfig */
export type ConfigReadKey = 'storagePath' | 'quickAddKey' | 'toggleMainKey'

/** 存储配置键的联合类型（可写）——用于 getConfig/setConfig */
export type ConfigWriteKey = 'quickAddKey' | 'toggleMainKey'

/** electron-store 存储键（用于 getStore/setStore，范围更广） */
export type StoreReadKey = ConfigReadKey
  | 'darkMode'
  | 'alwaysOnTop'
  | 'minimizeToTray'
  | 'autoLaunch'
  | 'notificationPosition'
  | 'filterSearchQuery'
  | 'currentTheme'
  | 'bgSize'
  | 'uiTransparency'
  | 'bgOpacity'
  | 'todayBtnPosition'
  | 'persistentNotification'
  | 'persistentPriorityThreshold'
  | 'persistentMoveEnabled'
  | 'persistentMoveDelay'

export type StoreWriteKey = ConfigWriteKey
  | 'darkMode'
  | 'alwaysOnTop'
  | 'minimizeToTray'
  | 'autoLaunch'
  | 'notificationPosition'
  | 'filterSearchQuery'
  | 'currentTheme'
  | 'bgSize'
  | 'uiTransparency'
  | 'bgOpacity'
  | 'todayBtnPosition'
  | 'persistentNotification'
  | 'persistentPriorityThreshold'
  | 'persistentMoveEnabled'
  | 'persistentMoveDelay'

/** 通知弹窗位置 */
export type NotificationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** IPC 渲染进程调用主进程的接口（contextBridge 暴露给 window.electronAPI） */
export interface ElectronAPI {
  // Store (electron-store)
  getStore: (key: StoreReadKey) => Promise<unknown>
  setStore: (key: StoreWriteKey, value: unknown) => Promise<OperationResult>

  // Config (存储路径等)
  getConfig: (key: ConfigReadKey) => Promise<unknown>
  setConfig: (key: ConfigWriteKey, value: unknown) => Promise<OperationResult>

  // Todos
  getAllTodos: () => Promise<OperationResult<Todo[]>>
  saveTodos: (todos: Todo[]) => Promise<OperationResult>

  // Window
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>
  minimizeToTray: (flag: boolean) => Promise<boolean>
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>

  // Tags
  getTags: () => Promise<OperationResult<string[]>>
  saveTags: (tags: string[]) => Promise<OperationResult>

  // Background Image
  saveBgImage: (imageData: string) => Promise<string | null>
  getBgImage: () => Promise<string | null>
  deleteBgImage: () => Promise<OperationResult>

  // Notification
  showNotification: (options: { title: string; body: string; position?: NotificationPosition }) => Promise<OperationResult>
  notifyHoverChange: (hovering: boolean) => void

  // Storage
  selectStoragePath: () => Promise<OperationResult<StorageSelectionResult>>
  getStorageInfo: () => Promise<{ dataPath: string; tagsPath: string }>

  // System
  openExternal: (url: string) => Promise<OperationResult>
  setAutoLaunch: (flag: boolean) => Promise<boolean>

  // Events
  onQuickAddTodo: (callback: () => void) => void
  removeQuickAddTodoListener: (callback: () => void) => void
  onNotificationData: (callback: (data: { title: string; body: string; persistent?: boolean }) => void) => void
  removeNotificationDataListeners: () => void
}

/** 通知窗口专用的最小 IPC 接口 */
export interface NotificationElectronAPI {
  onNotificationData: (callback: (data: { title: string; body: string; persistent?: boolean }) => void) => void
  removeNotificationDataListeners: () => void
  notifyHoverChange: (hovering: boolean) => void
}