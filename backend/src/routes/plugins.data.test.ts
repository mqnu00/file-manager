import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import app from '../app'
import { createSession } from '../middleware/auth'
import { updateConfig } from '../config'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-plugins-data-'))
process.env.FILE_MANAGER_PLUGIN_DATA_DIR = tmp

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  // 注册一个"仅配置层面"的已知插件（无需真实安装包），使 isKnownPlugin 通过
  updateConfig({ plugins: { 'test-plugin': { enabled: true, source: 'npm' } } })
})

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('插件数据目录 API', () => {
  it('未认证 → 401', async () => {
    const res = await request(app).get('/api/plugins/test-plugin/data')
    expect(res.status).toBe(401)
  })

  it('未知插件 → 404', async () => {
    const res = await request(app).get('/api/plugins/does-not-exist/data').set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  it('PUT / GET / DELETE 往返', async () => {
    const base = '/api/plugins/test-plugin/data'
    let res = await request(app).put(`${base}/k1`).set('Authorization', authHeader).send({ a: 1 })
    expect(res.status).toBe(200)

    res = await request(app).get(`${base}/k1`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.value).toEqual({ a: 1 })

    res = await request(app).get(base).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ k1: { a: 1 } })

    res = await request(app).delete(`${base}/k1`).set('Authorization', authHeader)
    expect(res.status).toBe(200)

    res = await request(app).get(`${base}/k1`).set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  // 注：非法键（含路径分隔符 / "." / ".."）的校验在 storage 层单测覆盖；
  // 经 HTTP 时 Express 会先归一化路径段，多段键无法到达处理器，故此处不测 400。
})
