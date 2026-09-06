export type ShortcutConfigKey = 'quickAddKey' | 'toggleMainKey'

export const CONFIG_READ_KEYS = new Set(['storagePath', 'quickAddKey', 'toggleMainKey'])
export const CONFIG_WRITE_KEYS = new Set<string>(['quickAddKey', 'toggleMainKey'])

// 当前没有允许打开的外部站点，默认拒绝所有外部 URL。
export const ALLOWED_EXTERNAL_ORIGINS = new Set<string>()

export function createStoreValueValidators(): Record<string, (value: unknown) => boolean> {
  return {
    darkMode: value => typeof value === 'boolean',
    alwaysOnTop: value => typeof value === 'boolean',
    minimizeToTray: value => typeof value === 'boolean',
    autoLaunch: value => typeof value === 'boolean',
    notificationPosition: value => ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(String(value)),
    filterSearchQuery: value => typeof value === 'string',
    currentTheme: value => typeof value === 'string',
    bgSize: value => ['cover', 'contain', '100% 100%'].includes(String(value)),
    uiTransparency: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
    // 旧配置键只用于从历史版本迁移；新代码统一写入 uiTransparency。
    bgOpacity: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
    todayBtnPosition: value => {
      if (!value || typeof value !== 'object') return false
      const position = value as { right?: unknown; bottom?: unknown }
      return typeof position.right === 'number' && Number.isFinite(position.right)
        && typeof position.bottom === 'number' && Number.isFinite(position.bottom)
        && position.right >= 0 && position.bottom >= 0
    },
    persistentNotification: value => typeof value === 'boolean',
    persistentPriorityThreshold: value => [1, 2, 3].includes(value as number),
    persistentMoveEnabled: value => typeof value === 'boolean',
    persistentMoveDelay: value => typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 600
  }
}
