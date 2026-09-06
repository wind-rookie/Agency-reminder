import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import { ALLOWED_EXTERNAL_ORIGINS, CONFIG_READ_KEYS, CONFIG_WRITE_KEYS, createStoreValueValidators, type ShortcutConfigKey } from './ipc-security'
import type { OperationResult, StorageSelectionResult, Todo } from './types'
import { createReminderScheduler, type NotificationPosition } from './reminder-scheduler'
import { createDataStore } from './data-store'
import { createMainWindow as createManagedMainWindow, registerWindowControlIpcHandlers } from './window-manager'
import { registerSettingsIpcHandlers } from './settings-ipc'
import { createNotificationWindow, registerNotificationIpcHandler } from './notification-window'
import { findClosedTodoIds } from './persistent-logic'
import { registerStorageIpcHandlers } from './storage-ipc'
import { registerBackgroundIpcHandlers } from './background-ipc'
import { registerExternalLinkIpcHandler } from './external-link-ipc'
import { appBranding } from '../src/config/branding'

// 单实例锁：必须在 app.whenReady() 之前调用，防止生产环境多实例并发写入覆盖数据
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// 条件日志：仅开发环境输出
function log(...args: unknown[]) {
  if (!app.isPackaged) console.log(...args)
}
function logError(...args: unknown[]) {
  console.error(...args)
}

// 读取版本号（延迟读取，在 app ready 后使用）
let appVersion = '1.0.0'
function loadAppVersion() {
  try {
    const pkgPath = app.isPackaged
      ? join(process.resourcesPath, 'app.asar', 'package.json')
      : join(__dirname, '../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    appVersion = pkg.version || '1.0.0'
  } catch {
    // 保留默认值
  }
}

// 默认 store 用于保存设置路径（始终在默认位置）
const defaultStore = new Store({ name: 'remind-config' })

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let reminderScheduler: ReturnType<typeof createReminderScheduler> | null = null

async function chooseTargetConflict(): Promise<'cancel' | 'use-target' | 'overwrite'> {
  if (!mainWindow) throw new Error('主窗口未初始化，无法确认目标目录冲突')
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '目标目录已有数据',
    message: '所选目录已经包含待办、标签或背景数据。',
    detail: '默认不会覆盖。你可以使用目标目录中的数据，或先备份目标文件再用当前数据覆盖。',
    buttons: ['取消迁移', '使用目标数据', '备份后覆盖'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  if (choice.response === 1) return 'use-target'
  if (choice.response === 2) return 'overwrite'
  return 'cancel'
}

async function confirmUseTarget(): Promise<boolean> {
  if (!mainWindow) throw new Error('主窗口未初始化，无法确认使用目标目录数据')
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '确认使用目标目录数据',
    message: '切换后将显示目标目录中的待办、标签和背景。',
    detail: '当前目录中的数据不会自动合并或删除。确认切换后，应用将重新加载目标目录数据。',
    buttons: ['取消', '确认切换'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  return confirmation.response === 1
}

async function confirmProtectedMigration(reason: string): Promise<boolean> {
  if (!mainWindow) throw new Error(reason)
  const protectionChoice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '当前数据处于保护状态',
    message: '当前目录存在无法自动恢复的数据文件。',
    detail: `${reason}\n\n损坏原件不会被删除。继续迁移只会写入当前已成功读取到的待办和标签。`,
    buttons: ['取消迁移', '确认迁移已恢复的数据'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  return protectionChoice.response === 1
}

const dataStore = createDataStore({
  getUserDataPath: () => app.getPath('userData'),
  store: defaultStore,
  chooseTargetConflict,
  confirmUseTarget,
  confirmProtectedMigration,
  log,
  logError
})

const STORE_VALUE_VALIDATORS = createStoreValueValidators()

async function migrateStorage(customPath: string): Promise<OperationResult<StorageSelectionResult>> {
  try {
    return await dataStore.migrateStorage(customPath)
  } catch (error) {
    return { success: false, error: `迁移失败：${getErrorMessage(error)}` }
  }
}

function assertMainWindowSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('拒绝来自非主窗口的 IPC 请求')
  }
}

function getShortcutHandler(key: ShortcutConfigKey): () => void {
  if (key === 'quickAddKey') {
    return () => {
      log('快速添加快捷键被触发')
      mainWindow?.show()
      mainWindow?.focus()
      mainWindow?.webContents.send('quick-add-todo')
    }
  }

  return () => {
    log('窗口切换快捷键被触发')
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  }
}

function registerShortcut(key: ShortcutConfigKey, accelerator: unknown): boolean {
  if (typeof accelerator !== 'string' || !accelerator.trim()) return false
  try {
    return globalShortcut.register(accelerator, getShortcutHandler(key))
  } catch (error) {
    logError(`注册${key}失败:`, error)
    return false
  }
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const notificationWindowController = createNotificationWindow({
  isDev,
  preloadPath: join(__dirname, 'preload.js'),
  developmentUrl: 'http://localhost:5173/#/notification',
  productionIndexPath: join(__dirname, '../dist/index.html'),
  getReferenceBounds: () => mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null,
  logError: message => logError(message)
})

registerNotificationIpcHandler({
  assertMainWindowSender,
  showNotificationWindow: notificationWindowController.showNotificationWindow
})

// 待办完成/删除后关闭对应持久弹窗
function closePersistentWindowsForChanges(before: Todo[], after: unknown) {
  for (const id of findClosedTodoIds(before, after)) {
    notificationWindowController.closePersistentWindow(id)
  }
}

function createMainWindow() {
  mainWindow = createManagedMainWindow({
    isDev,
    appVersion,
    preloadPath: join(__dirname, 'preload.js'),
    developmentUrl: 'http://localhost:5173',
    productionIndexPath: join(__dirname, '../dist/index.html'),
    getMinimizeToTray: () => defaultStore.get('minimizeToTray') as boolean,
    hasUnsavedChanges: dataStore.hasUnsavedChanges,
    isQuitting: () => isQuitting,
    setQuitting: value => { isQuitting = value }
  })
  mainWindow.on('closed', () => {
    // 主窗口真正关闭（非最小化到托盘）时，清理所有持久弹窗，避免应用残留后台
    notificationWindowController.closeAllPersistentWindows()
  })
}

function createTray() {
  const iconPath = isDev 
    ? join(__dirname, '../favicon.ico')
    : join(process.resourcesPath, 'app.asar/../favicon.ico')
  
  let icon = nativeImage.createFromPath(iconPath)
  // 如果 ico 加载失败，尝试备用路径
  if (icon.isEmpty()) {
    const fallback = join(__dirname, '../favicon.ico')
    icon = nativeImage.createFromPath(fallback)
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => {
      // 退出时需要真正关闭，而不是最小化到托盘
      isQuitting = true
      app.quit()
    }}
  ])

  tray.setToolTip(appBranding.displayName)
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    mainWindow?.show()
  })
}

app.whenReady().then(async () => {
  // 加载版本号
  loadAppVersion()
  
  // 检查是否首次启动（需要选择存储位置）
  const hasSelectedStoragePath = defaultStore.get('hasSelectedStoragePath') as boolean | undefined
  let customPath = defaultStore.get('storagePath') as string | undefined
  
  log('应用启动, 存储路径:', customPath || '默认')
  
  // 使用自定义路径初始化数据存储
  dataStore.initialize(customPath)
  
  log('初始化完成, 待办数量:', dataStore.getTodos().length)
  
  createMainWindow()
  createTray()
  reminderScheduler?.start()
  
  // 首次启动时，在应用界面显示后弹出目录选择对话框
  if (!hasSelectedStoragePath) {
    log('首次启动，等待界面显示后弹出存储位置选择对话框')
    // 等待主窗口显示后再弹出对话框
    setTimeout(async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory'],
        title: '选择数据存储位置',
        defaultPath: app.getPath('documents'),
        buttonLabel: '选择此文件夹'
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        customPath = result.filePaths[0]
        log('用户选择的存储路径:', customPath)

        const migrationResult = await migrateStorage(customPath)
        if (migrationResult.success && migrationResult.data) {
          defaultStore.set('hasSelectedStoragePath', true)
          mainWindow?.webContents.send('storage-path-selected', migrationResult.data.path)
          if (migrationResult.data.reloadRequired) {
            mainWindow?.reload()
          }
        } else if (!migrationResult.canceled) {
          defaultStore.set('hasSelectedStoragePath', false)
          await dialog.showMessageBox(mainWindow!, {
            type: 'error',
            title: '迁移失败',
            message: migrationResult.error || '无法迁移到所选目录',
            buttons: ['知道了']
          })
        }
      } else {
        log('用户取消选择，使用默认路径')
        defaultStore.set('hasSelectedStoragePath', true)
      }
    }, 500)
  }
  
  // 注册全局快捷键（从 defaultStore 读取）
  const failedShortcuts: string[] = []
  let quickAddKey = defaultStore.get('quickAddKey') as string
  if (!quickAddKey) {
    quickAddKey = 'Ctrl+Shift+T'
    defaultStore.set('quickAddKey', quickAddKey)
  }
  log('注册快速添加快捷键:', quickAddKey)
  
  if (!registerShortcut('quickAddKey', quickAddKey)) {
    logError('注册快速添加快捷键失败:', quickAddKey)
    failedShortcuts.push(`快速添加：${quickAddKey}`)
  }

  let toggleMainKey = defaultStore.get('toggleMainKey') as string
  if (!toggleMainKey) {
    toggleMainKey = 'Ctrl+Shift+F'
    defaultStore.set('toggleMainKey', toggleMainKey)
  }
  log('注册窗口切换快捷键:', toggleMainKey)
  
  if (!registerShortcut('toggleMainKey', toggleMainKey)) {
    logError('注册窗口切换快捷键失败:', toggleMainKey)
    failedShortcuts.push(`显示/隐藏主窗口：${toggleMainKey}`)
  }

  if (failedShortcuts.length > 0 && mainWindow) {
    void dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '快捷键注册失败',
      message: '以下全局快捷键当前不可用：',
      detail: `${failedShortcuts.join('\n')}\n\n可能已被其他程序占用，请在设置中修改。`,
      buttons: ['知道了']
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  reminderScheduler?.stop()
  globalShortcut.unregisterAll()
})

// IPC handlers
registerSettingsIpcHandlers({
  store: defaultStore,
  getMainWindow: () => mainWindow,
  assertMainWindowSender,
  storeValueValidators: STORE_VALUE_VALIDATORS,
  configReadKeys: CONFIG_READ_KEYS,
  configWriteKeys: CONFIG_WRITE_KEYS,
  registerShortcut,
  getErrorMessage,
  log,
  logError
})

async function selectStoragePathForIpc(): Promise<OperationResult<StorageSelectionResult>> {
  try {
    if (!mainWindow) {
      return { success: false, error: '主窗口未初始化' } satisfies OperationResult<StorageSelectionResult>
    }

    log('打开存储目录选择对话框')
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择数据存储目录'
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const customPath = result.filePaths[0]
      log('用户选择的新存储路径:', customPath)
      return migrateStorage(customPath)
    }
    return { success: false, canceled: true } satisfies OperationResult<StorageSelectionResult>
  } catch (error) {
    const message = `选择目录失败：${getErrorMessage(error)}`
    logError(message)
    return { success: false, error: message } satisfies OperationResult<StorageSelectionResult>
  }
}

registerStorageIpcHandlers({
  assertMainWindowSender,
  getTodos: dataStore.getTodos,
  getTodoPersistenceError: dataStore.getTodoPersistenceError,
  saveTodos: (todos: unknown) => {
    const before = dataStore.getTodos()
    const result = dataStore.saveTodos(todos)
    if (result.success) {
      closePersistentWindowsForChanges(before, todos)
    }
    return result
  },
  selectStoragePath: selectStoragePathForIpc,
  getStorageInfo: dataStore.getStorageInfo,
  getTags: dataStore.getTags,
  saveTags: dataStore.saveTags,
  log
})

registerExternalLinkIpcHandler({
  assertMainWindowSender,
  allowedOrigins: ALLOWED_EXTERNAL_ORIGINS,
  logError,
  getErrorMessage
})

registerWindowControlIpcHandlers({
  getMainWindow: () => mainWindow,
  assertMainWindowSender
})

reminderScheduler = createReminderScheduler({
  getTodos: dataStore.getTodos,
  getNotificationPosition: () => defaultStore.get('notificationPosition') as NotificationPosition | undefined,
  showNotification: options => notificationWindowController.showNotificationWindow(options),
  getPersistentConfig: () => {
    const raw = defaultStore.get('persistentPriorityThreshold')
    const threshold = raw === 2 || raw === 3 ? raw : 1
    const rawDelay = defaultStore.get('persistentMoveDelay')
    const moveEnabledRaw = defaultStore.get('persistentMoveEnabled')
    return {
      enabled: Boolean(defaultStore.get('persistentNotification')),
      threshold: threshold as 1 | 2 | 3,
      moveEnabled: moveEnabledRaw === undefined ? true : Boolean(moveEnabledRaw),
      moveDelay: typeof rawDelay === 'number' ? rawDelay : 30
    }
  },
  getRemindedIds: () => defaultStore.get('remindedIds'),
  saveRemindedIds: keys => defaultStore.set('remindedIds', keys),
  onError: error => logError('主进程检查提醒失败:', error)
})

registerBackgroundIpcHandlers({
  assertMainWindowSender,
  getBgImagePath: dataStore.getBgImagePath,
  writeFileAtomically: dataStore.writeFileAtomically,
  store: defaultStore,
  log,
  logError,
  getErrorMessage
})
