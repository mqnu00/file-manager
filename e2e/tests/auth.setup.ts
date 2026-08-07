import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 登录一次并保存 storageState，供需要认证的 spec（files）复用，
// 避免多次登录触发后端 express-rate-limit（5 次/分钟）
setup('登录并保存会话', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('输入令牌').fill('e2e-token-123')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.locator('.file-list')).toBeVisible()
  await page.context().storageState({
    path: path.join(__dirname, '..', '.auth', 'user.json'),
  })
})
