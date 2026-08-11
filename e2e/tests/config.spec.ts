import { test, expect } from '@playwright/test'

test.describe('配置页面（/config）', () => {
  test('表单回显 storageRoot 与保留天数', async ({ page }) => {
    await page.goto('/config')
    // storageRoot 回显 fixtures/storage 绝对路径
    await expect(page.getByPlaceholder('留空使用项目根目录')).toHaveValue(/e2e[\\/]fixtures[\\/]storage/)
    // 保留天数回显 30
    await expect(page.locator('.el-select')).toContainText('30 天')
  })

  test('修改保留天数并保存 → 成功提示', async ({ page }) => {
    await page.goto('/config')
    await page.locator('.el-select').click()
    await page.getByRole('option', { name: '14 天' }).click()
    await page.getByRole('button', { name: '保存配置' }).click()
    await expect(page.locator('.el-message').filter({ hasText: '配置已保存' })).toBeVisible()
  })

  test('修改后点重置 → 恢复为配置值', async ({ page }) => {
    await page.goto('/config')
    const storageInput = page.getByPlaceholder('留空使用项目根目录')
    await storageInput.fill('/tmp/xxx')
    await page.getByRole('button', { name: '重置' }).click()
    await expect(storageInput).toHaveValue(/e2e[\\/]fixtures[\\/]storage/)
  })
})
