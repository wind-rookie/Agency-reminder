import { describe, it, expect } from 'vitest'
import {
  getLocalDateString,
  parseLocalDate,
  getNextRepeatDate,
  getNextPendingRepeatDate
} from '../src/utils/date'

describe('getLocalDateString', () => {
  it('跨月', () => {
    expect(getLocalDateString(new Date(2026, 0, 31))).toBe('2026-01-31')
    expect(getLocalDateString(new Date(2026, 1, 1))).toBe('2026-02-01')
  })
  it('跨年', () => {
    expect(getLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(getLocalDateString(new Date(2027, 0, 1))).toBe('2027-01-01')
  })
  it('单位数月日补零', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(getLocalDateString(new Date(2026, 8, 9))).toBe('2026-09-09')
  })
  it('闰年 2 月 29 日', () => {
    expect(getLocalDateString(new Date(2024, 1, 29))).toBe('2024-02-29')
  })
})

describe('parseLocalDate', () => {
  it('解析为本地零点，不受 UTC 偏移影响', () => {
    const date = parseLocalDate('2026-03-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(0)
  })
  it('格式非法时抛错', () => {
    expect(() => parseLocalDate('2026-3-15')).toThrow('无效日期')
    expect(() => parseLocalDate('2026/03/15')).toThrow('无效日期')
    expect(() => parseLocalDate('')).toThrow('无效日期')
  })
  it('日期不存在时抛错而非静默进位', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow('无效日期')
    expect(() => parseLocalDate('2026-13-01')).toThrow('无效日期')
    expect(() => parseLocalDate('2025-02-29')).toThrow('无效日期')
  })
  it('闰年 2 月 29 日合法', () => {
    expect(getLocalDateString(parseLocalDate('2024-02-29'))).toBe('2024-02-29')
  })
})

describe('getNextRepeatDate (单步推进)', () => {
  describe('daily', () => {
    it('普通日期 +1 天', () => {
      expect(getNextRepeatDate('2026-01-15', 'daily')).toBe('2026-01-16')
    })
    it('月末跨月：1月31日 +1 天 = 2月1日', () => {
      expect(getNextRepeatDate('2026-01-31', 'daily')).toBe('2026-02-01')
    })
    it('年末跨年：12月31日 +1 天 = 1月1日', () => {
      expect(getNextRepeatDate('2026-12-31', 'daily')).toBe('2027-01-01')
    })
    it('闰年 2月28日 +1 天 = 2月29日', () => {
      expect(getNextRepeatDate('2024-02-28', 'daily')).toBe('2024-02-29')
    })
    it('闰年 2月29日 +1 天 = 3月1日', () => {
      expect(getNextRepeatDate('2024-02-29', 'daily')).toBe('2024-03-01')
    })
  })

  describe('weekly', () => {
    it('普通日期 +7 天', () => {
      expect(getNextRepeatDate('2026-01-15', 'weekly')).toBe('2026-01-22')
    })
    it('跨月：1月28日 +7 天 = 2月4日', () => {
      expect(getNextRepeatDate('2026-01-28', 'weekly')).toBe('2026-02-04')
    })
    it('跨年：12月28日 +7 天 = 1月4日', () => {
      expect(getNextRepeatDate('2026-12-28', 'weekly')).toBe('2027-01-04')
    })
  })

  describe('monthly', () => {
    it('1月31日 → 2月末 (28日)', () => {
      expect(getNextRepeatDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    })
    it('闰年 1月31日 → 2月29日', () => {
      expect(getNextRepeatDate('2024-01-31', 'monthly', 31)).toBe('2024-02-29')
    })
    it('3月31日 → 4月30日', () => {
      expect(getNextRepeatDate('2026-03-31', 'monthly', 31)).toBe('2026-04-30')
    })
    it('anchorDay 小于目标月天数时保持原日：1月15日 → 2月15日', () => {
      expect(getNextRepeatDate('2026-01-15', 'monthly', 15)).toBe('2026-02-15')
    })
    it('无 anchorDay 时使用当前日期的日：1月20日 → 2月20日', () => {
      expect(getNextRepeatDate('2026-01-20', 'monthly')).toBe('2026-02-20')
    })
    it('11月30日 → 12月30日', () => {
      expect(getNextRepeatDate('2026-11-30', 'monthly', 30)).toBe('2026-12-30')
    })
    it('12月31日 → 翌年1月31日', () => {
      expect(getNextRepeatDate('2026-12-31', 'monthly', 31)).toBe('2027-01-31')
    })
  })
})

describe('getNextPendingRepeatDate (逾期补发循环)', () => {
  // 注入固定的 today，避免用例结果随运行日期漂移
  const TODAY = '2026-05-20'

  it('逾期 daily 任务推进到今天之后的第一天', () => {
    expect(getNextPendingRepeatDate('2020-01-01', 'daily', undefined, TODAY)).toBe('2026-05-21')
  })

  it('逾期 weekly 任务落在今天之后且保持星期对齐', () => {
    const result = getNextPendingRepeatDate('2026-05-06', 'weekly', undefined, TODAY)
    expect(result).toBe('2026-05-27')
    // 与原始日期相差整周
    const diffDays = (parseLocalDate(result).getTime() - parseLocalDate('2026-05-06').getTime()) / 86400000
    expect(diffDays % 7).toBe(0)
  })

  it('逾期 monthly 任务保持 anchorDay 不变', () => {
    expect(getNextPendingRepeatDate('2026-01-15', 'monthly', 15, TODAY)).toBe('2026-06-15')
  })

  it('未逾期任务只推进一步', () => {
    expect(getNextPendingRepeatDate('2026-05-25', 'daily', undefined, TODAY)).toBe('2026-05-26')
  })

  it('日期等于 today 时仍会推进（不返回今天）', () => {
    expect(getNextPendingRepeatDate(TODAY, 'daily', undefined, TODAY)).toBe('2026-05-21')
  })

  it('anchorDay=31 连续跨越短月后不被月末截断污染', () => {
    // 若锚点日在循环内被重算，2月截断到 28 后 3 月会错误地停在 28
    expect(getNextPendingRepeatDate('2026-01-31', 'monthly', 31, '2026-03-15')).toBe('2026-03-31')
  })

  it('anchorDay=31 落在 4 月时取该月最后一天', () => {
    expect(getNextPendingRepeatDate('2026-01-31', 'monthly', 31, '2026-04-15')).toBe('2026-04-30')
  })

  it('默认使用系统当天时返回未来日期', () => {
    const result = getNextPendingRepeatDate('2020-01-01', 'daily')
    expect(result > getLocalDateString(new Date())).toBe(true)
  })
})
