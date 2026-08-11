import { test, expect } from '@playwright/test'

test.describe('插件管理页面（/plugins）', () => {
  test('已安装列表显示 test 插件（启用 + 本地开发）', async ({ page }) => {
    await page.goto('/plugins')
    await expect(page.getByText('插件管理')).toBeVisible()
    const row = page.locator('.el-table__row').filter({ hasText: 'test' })
    await expect(row).toBeVisible()
    await expect(row.getByText('本地开发')).toBeVisible()
    // 启用态：操作列出现 重载/卸载（用按钮断言，避免 el-tag 过渡动画双标签干扰）
    await expect(row.getByRole('button', { name: '重载' })).toBeVisible()
  })

  test('卸载后状态变已禁用，重新加载恢复', async ({ page }) => {
    await page.goto('/plugins')
    const row = page.locator('.el-table__row').filter({ hasText: 'test' })

    // 若已是禁用态先加载，保证用例自洽
    if (await row.getByRole('button', { name: '加载' }).count()) {
      await row.getByRole('button', { name: '加载' }).click()
      await expect(row.getByRole('button', { name: '重载' })).toBeVisible()
    }

    // 卸载（确认弹窗）
    await row.getByRole('button', { name: '卸载' }).click()
    await page.getByLabel('确认卸载').getByRole('button', { name: '卸载' }).click()
    await expect(row.getByRole('button', { name: '加载' })).toBeVisible()

    // 重新加载恢复
    await row.getByRole('button', { name: '加载' }).click()
    await expect(row.getByRole('button', { name: '重载' })).toBeVisible()
  })
})
