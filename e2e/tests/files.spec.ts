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
    await page.getByRole('button', { name: /新建文件夹/ }).click()
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
})
