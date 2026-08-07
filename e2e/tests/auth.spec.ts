import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const VALID_TOKEN = 'e2e-token-123'

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('输入令牌').fill(VALID_TOKEN)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.locator('.file-list')).toBeVisible()
}

test.describe('登录认证', () => {
  test('错误令牌显示错误提示', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('输入令牌').fill('wrong-token')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.locator('.login-error')).toContainText('令牌错误')
    // 仍停留在登录页
    await expect(page).toHaveURL(/\/login/)
  })

  test('空令牌提示输入', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.locator('.login-error')).toContainText('请输入令牌')
  })

  test('正确令牌登录进入主界面', async ({ page }) => {
    await login(page)
    // 文件列表可见且包含预置数据
    await expect(page.getByText('hello.txt')).toBeVisible()
    await expect(page.getByText('docs')).toBeVisible()
  })

  test('清除 session 后刷新回到登录页', async ({ page }) => {
    await login(page)
    await page.evaluate(() => localStorage.removeItem('session_token'))
    await page.reload()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByPlaceholder('输入令牌')).toBeVisible()
  })
})
