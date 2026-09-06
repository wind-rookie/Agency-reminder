import chineseDays from 'chinese-days'

export type ChineseDayType = 'holiday' | 'makeup-workday' | 'weekend' | 'workday' | 'unavailable'

export interface ChineseDayInfo {
  date: string
  type: ChineseDayType
  name: string
  isHoliday: boolean
  isWorkday: boolean
  isWeekend: boolean
  isInLieu: boolean
  isSupportedYear: boolean
}

const supportedHolidayYears = new Map<number, boolean>()

export type RepeatType = 'daily' | 'weekly' | 'monthly'

/**
 * 获取本地日期字符串（YYYY-MM-DD），避免 toISOString 的 UTC 时区问题
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 将 YYYY-MM-DD 解析为本地零点的 Date，格式非法或日期不存在（如 2026-02-30）时抛错
 */
export function parseLocalDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) throw new Error(`无效日期：${dateStr}`)
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (getLocalDateString(date) !== dateStr) throw new Error(`无效日期：${dateStr}`)
  return date
}

/**
 * 按重复规则单步推进一次日期（不跳过已逾期日期）
 * monthly 以 repeatAnchorDay 为目标日，目标月天数不足时取该月最后一天
 */
export function getNextRepeatDate(dateStr: string, repeat: RepeatType, repeatAnchorDay?: number): string {
  const current = parseLocalDate(dateStr)

  if (repeat === 'daily') {
    current.setDate(current.getDate() + 1)
    return getLocalDateString(current)
  }
  if (repeat === 'weekly') {
    current.setDate(current.getDate() + 7)
    return getLocalDateString(current)
  }

  const anchorDay = repeatAnchorDay || current.getDate()
  const targetYear = current.getMonth() === 11 ? current.getFullYear() + 1 : current.getFullYear()
  const targetMonth = (current.getMonth() + 1) % 12
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  return getLocalDateString(new Date(targetYear, targetMonth, Math.min(anchorDay, lastDayOfTargetMonth)))
}

/**
 * 计算重复任务在 today 之后的第一个日期，逾期任务会连续推进直到落在未来
 * today 可注入，便于测试固定“当天”基准
 */
export function getNextPendingRepeatDate(
  dateStr: string,
  repeat: RepeatType,
  repeatAnchorDay?: number,
  today: string = getLocalDateString(new Date())
): string {
  // monthly 锚点日在循环外固定：否则月末截断（1/31 → 2/28）会让后续轮次误用 28 作为锚点
  const anchorDay = repeat === 'monthly'
    ? repeatAnchorDay || parseLocalDate(dateStr).getDate()
    : undefined

  let nextDate = dateStr
  do {
    nextDate = getNextRepeatDate(nextDate, repeat, anchorDay)
  } while (nextDate <= today)
  return nextDate
}

/**
 * 判断离线依赖是否包含指定年份的官方节假日安排
 */
export function hasChineseHolidayData(year: number): boolean {
  const cachedResult = supportedHolidayYears.get(year)
  if (cachedResult !== undefined) {
    return cachedResult
  }

  const hasData = Number.isInteger(year) && chineseDays.getHolidaysInRange(
    `${year}-01-01`,
    `${year}-12-31`,
    false
  ).length > 0
  supportedHolidayYears.set(year, hasData)
  return hasData
}

/**
 * 将 chinese-days 的中英文描述转换为页面使用的中文节日名称
 */
function getChineseHolidayName(description: string): string {
  const [, chineseName] = description.split(',')
  return chineseName || description
}

/**
 * 获取标准化的中国节假日信息；未收录年份不会按往年规律推算
 */
export function getChineseDayInfo(date: Date): ChineseDayInfo {
  const dateString = getLocalDateString(date)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const isSupportedYear = hasChineseHolidayData(date.getFullYear())

  if (!isSupportedYear) {
    return {
      date: dateString,
      type: 'unavailable',
      name: '',
      isHoliday: false,
      isWorkday: false,
      isWeekend,
      isInLieu: false,
      isSupportedYear: false
    }
  }

  const detail = chineseDays.getDayDetail(dateString)
  const hasHolidayDescription = detail.name.includes(',')

  if (detail.work && hasHolidayDescription) {
    return {
      date: dateString,
      type: 'makeup-workday',
      name: getChineseHolidayName(detail.name),
      isHoliday: false,
      isWorkday: true,
      isWeekend,
      isInLieu: false,
      isSupportedYear: true
    }
  }

  if (!detail.work && hasHolidayDescription) {
    return {
      date: dateString,
      type: 'holiday',
      name: getChineseHolidayName(detail.name),
      isHoliday: true,
      isWorkday: false,
      isWeekend,
      isInLieu: chineseDays.isInLieu(dateString),
      isSupportedYear: true
    }
  }

  return {
    date: dateString,
    type: isWeekend ? 'weekend' : 'workday',
    name: '',
    isHoliday: false,
    isWorkday: !isWeekend,
    isWeekend,
    isInLieu: false,
    isSupportedYear: true
  }
}
