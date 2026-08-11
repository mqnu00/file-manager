import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from './app'

describe('插件静态资源 /plugins-assets（集成）', () => {
  it('存在插件的文件正常返回', async () => {
    const res = await request(app).get('/plugins-assets/test/README.md')
    expect(res.status).toBe(200)
    expect(res.text).toContain('file-manager-plugin-test')
  })

  it('不存在插件 → next（不返回文件内容）', async () => {
    const res = await request(app).get('/plugins-assets/no-such-plugin-xyz/README.md')
    // 无此插件 → next()，不会返回任意文件内容
    expect(res.text).not.toContain('file-manager-plugin-test')
  })

  it('路径穿越（../）被拦截，不返回越权文件', async () => {
    const res = await request(app).get('/plugins-assets/test/../../package.json')
    // 防护生效：不返回项目根 package.json 内容
    expect(res.text).not.toContain('"name": "file-manager"')
  })

  it('路径穿越（URL 编码 %2e%2e）不返回越权文件', async () => {
    const res = await request(app).get('/plugins-assets/test/..%2F..%2Fpackage.json')
    expect(res.text).not.toContain('"name": "file-manager"')
  })
})
