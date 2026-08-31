import { test, expect } from '@playwright/test'

test.describe('日志页面（/logs）', () => {
  test('进入 /logs 显示当日日志表格与分页', async ({ page }) => {
    await page.goto('/logs')
    await expect(page.getByText('操作日志')).toBeVisible()
    await expect(page.getByText('用户进入文件列表')).toBeVisible()
    await expect(page.getByText('删除失败: EACCES')).toBeVisible()
    await expect(page.locator('.el-pagination')).toBeVisible()
  })

  test('级别筛选 ERROR → 只显示错误日志', async ({ page }) => {
    await page.goto('/logs')
    // el-select 的占位文案不是原生 placeholder，点击"级别"文本打开下拉
    await page.locator('.filter-bar').getByText('级别').click()
    await page.getByRole('option', { name: 'ERROR' }).click()
    // 等待下拉选项关闭
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '搜索' }).click()
    // 等待表格更新
    await page.waitForTimeout(500)
    // 预置日志中 ERROR 2 条（筛选后应只显示 ERROR）
    const rows = page.locator('.el-table__row')
    await expect(rows).toHaveCount(2)
    await expect(rows.getByText('ERROR')).toHaveCount(2)
    await expect(page.getByText('用户进入文件列表')).toHaveCount(0)
  })

  test('关键词搜索过滤日志', async ({ page }) => {
    await page.goto('/logs')
    await page.getByPlaceholder('关键词搜索').fill('report')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByText('下载了 report.pdf')).toBeVisible()
    await expect(page.getByText('用户进入文件列表')).toHaveCount(0)
  })
})
