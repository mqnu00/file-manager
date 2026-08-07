import { test, expect } from '@playwright/test'

test.describe('安全防护', () => {
  test('未登录访问首页重定向到登录页', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByPlaceholder('输入令牌')).toBeVisible()
  })

  test('未登录 API 请求返回 401', async ({ request }) => {
    const res = await request.get('/api/files')
    expect(res.status()).toBe(401)
  })

  test('无效 token 的 API 请求返回 401', async ({ request }) => {
    const res = await request.get('/api/files', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('路径穿越被拒绝', async ({ request }) => {
    const res = await request.get('/api/files', {
      params: { path: '../' },
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status()).toBe(401)
  })
})
