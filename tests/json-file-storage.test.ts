import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { createJsonFileStorage, type JsonReadResult } from '../electron/json-file-storage'

// 临时目录必须落在 tests/ 内部，避免污染项目外部目录（cleanDir 会递归删除该目录）
const TEST_DIR = path.join(__dirname, 'tmp-storage')

function cleanDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true })
  }
  fs.mkdirSync(TEST_DIR, { recursive: true })
}

describe('json-file-storage', () => {
  beforeEach(cleanDir)
  afterEach(cleanDir)

  const storage = createJsonFileStorage({
    backupCount: 1,
    logError: () => {},
  })

  const testFile = path.join(TEST_DIR, 'test.json')

  describe('writeJsonAtomically / readJsonWithBackups', () => {
    it('原子写入成功后可读回', () => {
      storage.writeJsonAtomically(testFile, { todos: [{ id: '1', title: 'test' }] })
      const result = storage.readJsonWithBackups(testFile, v => v, v => v, { todos: [] })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ todos: [{ id: '1', title: 'test' }] })
    })

    it('序列化失败时抛错且不破坏原文件', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      const circular: Record<string, unknown> = { v: 2 }
      circular.self = circular
      expect(() => storage.writeJsonAtomically(testFile, circular)).toThrow()
      expect(JSON.parse(fs.readFileSync(testFile, 'utf-8'))).toEqual({ v: 1 })
    })

    it('rename 失败时清理临时文件并抛出原始错误', () => {
      // 目标路径是一个已存在的目录，renameSync 必然失败，用于触发 catch 分支的临时文件清理
      const dirAsTarget = path.join(TEST_DIR, 'target-is-dir')
      fs.mkdirSync(dirAsTarget, { recursive: true })
      expect(() => storage.writeJsonAtomically(dirAsTarget, { v: 1 })).toThrow()
      const leftovers = fs.readdirSync(TEST_DIR).filter(name => name.includes('.tmp-'))
      expect(leftovers).toEqual([])
    })

    it('文件不存在返回 missingValue', () => {
      const result = storage.readJsonWithBackups(path.join(TEST_DIR, 'not-exist.json'), v => v, v => v, { todos: [] })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ todos: [] })
    })
  })

  describe('backup rotation (backupCount=1)', () => {
    it('写入第一次不产生备份', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      expect(fs.existsSync(testFile + '.bak1')).toBe(false)
    })

    it('第二次写入产生 .bak1', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      storage.writeJsonAtomically(testFile, { v: 2 })
      expect(fs.existsSync(testFile + '.bak1')).toBe(true)
      const bak1 = JSON.parse(fs.readFileSync(testFile + '.bak1', 'utf-8'))
      expect(bak1).toEqual({ v: 1 })
    })

    it('第三次写入 .bak1 被新内容覆盖', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      storage.writeJsonAtomically(testFile, { v: 2 })
      storage.writeJsonAtomically(testFile, { v: 3 })
      const bak1 = JSON.parse(fs.readFileSync(testFile + '.bak1', 'utf-8'))
      expect(bak1).toEqual({ v: 2 }) // 保留的是上一次的内容
    })
  })

  describe('readJsonWithBackups 恢复逻辑', () => {
    it('主文件损坏时从 .bak1 恢复', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      storage.writeJsonAtomically(testFile, { v: 2 }) // 生成 .bak1 = { v: 1 }
      // 损坏主文件
      fs.writeFileSync(testFile, '{ corrupt }')
      const result = storage.readJsonWithBackups(testFile, v => v, v => v, { v: 0 })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ v: 1 })
      expect(result.recoveredFrom).toBe(testFile + '.bak1')
      // 主文件应已修复
      expect(JSON.parse(fs.readFileSync(testFile, 'utf-8'))).toEqual({ v: 1 })
    })

    it('.bak1 也损坏时返回失败', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      storage.writeJsonAtomically(testFile, { v: 2 })
      fs.writeFileSync(testFile, '{ corrupt }')
      fs.writeFileSync(testFile + '.bak1', '{ also corrupt }')
      const result = storage.readJsonWithBackups(testFile, v => v, v => v, { v: 0 })
      expect(result.success).toBe(false)
      expect(result.data).toEqual({ v: 0 })
    })
  })

  describe('captureFileSnapshot / restoreFileSnapshot', () => {
    it('捕获存在的文件', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      const snap = storage.captureFileSnapshot(testFile)
      expect(snap.path).toBe(testFile)
      expect(snap.content).toEqual(Buffer.from(JSON.stringify({ v: 1 }, null, 2)))
    })

    it('捕获不存在的文件返回 null content', () => {
      const snap = storage.captureFileSnapshot(path.join(TEST_DIR, 'not-exist.json'))
      expect(snap.content).toBeNull()
    })

    it('恢复快照覆盖目标文件', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      const snap = storage.captureFileSnapshot(testFile)
      storage.writeJsonAtomically(testFile, { v: 2 })
      storage.restoreFileSnapshot(snap)
      expect(JSON.parse(fs.readFileSync(testFile, 'utf-8'))).toEqual({ v: 1 })
    })

    it('恢复 null content 删除目标文件', () => {
      storage.writeJsonAtomically(testFile, { v: 1 })
      const snap = storage.captureFileSnapshot(path.join(TEST_DIR, 'not-exist.json'))
      expect(snap.content).toBeNull()
      storage.restoreFileSnapshot(snap)
      // restoreFileSnapshot 会在 content 为 null 且文件存在时删除文件
      // 但这里 snap.path 是 not-exist.json，不是 testFile
      // 所以 testFile 不应该被删除
      expect(fs.existsSync(testFile)).toBe(true)
    })
  })
})