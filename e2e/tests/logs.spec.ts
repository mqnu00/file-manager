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
    await page.getByRole('button', { name: '搜索' }).click()

    // 筛选后：每一行都必须是 ERROR（数量不固定——测试运行期间可能产生其他 ERROR 日志，
    // 如插件加载失败、404 等，故不断言精确行数，只断言级别纯度）
    const rows = page.locator('.el-table__row')
    await expect(rows.first()).toBeVisible()
    await expect
      .poll(async () => (await rows.allTextContents()).every((t) => t.includes('ERROR')))
      .toBe(true)
    // 预置的 2 条 ERROR 必须存在
    await expect(rows.getByText('令牌错误: invalid')).toBeVisible()
    await expect(rows.getByText('删除失败: EACCES')).toBeVisible()
    // 非 ERROR 日志不得出现
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
