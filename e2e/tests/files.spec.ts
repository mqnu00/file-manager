import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 本项目通过 storageState 复用 setup 项目保存的登录会话，无需再登录

/** 通过文件行首复选框选中文件（按名称定位所在行） */
async function selectRow(page: Page, name: string): Promise<void> {
  const row = page.locator('.el-table__row').filter({ hasText: name })
  await row.locator('.el-checkbox').click()
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.file-list')).toBeVisible()
}

test.describe('文件浏览与操作', () => {
  test('进入子目录并返回上级', async ({ page }) => {
    await openHome(page)
    // 点击文件夹名进入 docs
    await page.locator('.file-name-text').filter({ hasText: 'docs' }).click()
    await expect(page.getByText('readme.md')).toBeVisible()
    // 面包屑首页返回上级
    await page.locator('.breadcrumb-home').click()
    await expect(page.getByText('hello.txt')).toBeVisible()
  })

  test('新建文件夹并出现在列表', async ({ page }) => {
    await openHome(page)
    // 工具栏「新增」下拉按钮 → 选择「新增文件夹」
    await page.getByRole('button', { name: '新增' }).click()
    await page.getByText('新增文件夹').click()
    await page.getByPlaceholder('请输入文件夹名称').fill('e2e-folder')
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await expect(page.locator('.file-name-text').filter({ hasText: 'e2e-folder' })).toBeVisible()
  })

  test('右键重命名文件', async ({ page }) => {
    await openHome(page)
    // 右键 hello.txt 所在行
    const row = page.locator('.el-table__row').filter({ hasText: 'hello.txt' })
    await row.click({ button: 'right' })
    await page.locator('.context-menu-item').filter({ hasText: '重命名' }).click()
    // 重命名对话框输入新名
    await page.getByPlaceholder('请输入新名称').fill('renamed.txt')
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await expect(page.getByText('renamed.txt')).toBeVisible()
    await expect(page.getByText('hello.txt')).toHaveCount(0)
  })

  test('选中文件后批量删除', async ({ page }) => {
    await openHome(page)
    await selectRow(page, '中文文件.txt')
    // Toolbar 的删除按钮（批量操作区）
    await page.locator('.bulk-actions').getByRole('button', { name: '删除' }).click()
    // 确认弹窗内点击"删除"（限定在弹窗内，避免与 Toolbar 按钮冲突）
    await page.getByLabel('确认删除').getByRole('button', { name: '删除' }).click()
    await expect(page.getByText('中文文件.txt')).toHaveCount(0)
  })

  test('停留在子目录时刷新页面 → 刷新后回到根目录', async ({ page }) => {
    await openHome(page)
    await page.locator('.file-name-text').filter({ hasText: 'docs' }).click()
    await expect(page.getByText('readme.md')).toBeVisible()
    // 刷新：需求为刷新回到 storageRoot，docs 内容应消失、根目录文件可见
    await page.reload()
    await expect(page.getByText('readme.md')).toHaveCount(0)
    await expect(page.locator('.file-name-text').filter({ hasText: 'docs' })).toBeVisible()
  })

  test('停留在子目录时进入设置页再返回 → 返回后仍在该目录', async ({ page }) => {
    await openHome(page)
    await page.locator('.file-name-text').filter({ hasText: 'docs' }).click()
    await expect(page.getByText('readme.md')).toBeVisible()
    // 进入设置页：用户实际是点击工具栏（SPA 内跳转），主页会先卸载并写入路径记忆。
    // 这里用 pushState+popstate 模拟 SPA 内导航；不能用 page.goto（整页导航不触发主页卸载钩子）
    await page.evaluate(() => {
      history.pushState(history.state ?? null, '', '/config')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.locator('.config-card')).toBeVisible()
    // 设置页「返回」按钮回到主页
    await page.getByRole('button', { name: '返回', exact: true }).click()
    await expect(page.getByText('readme.md')).toBeVisible()
    // 清理：回到根目录
    await page.locator('.breadcrumb-home').click()
    await expect(page.getByText('readme.md')).toHaveCount(0)
  })
})
