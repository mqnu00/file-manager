import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 本项目通过 storageState 复用 setup 项目保存的登录会话，无需再登录

async function openHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.file-list')).toBeVisible()
}

/** 按名称精确选中文件行（避免 docs 与 docs.zip 等子串误匹配） */
async function selectRow(page: Page, name: string): Promise<void> {
  const row = page.locator('.el-table__row').filter({
    has: page.locator('.file-name-text', { hasText: new RegExp(`^${name}$`) }),
  })
  await row.locator('.el-checkbox').click()
}

test.describe('后台任务（移动/压缩）', () => {
  test('压缩文件夹：生成 zip 并出现在列表', async ({ page }) => {
    await openHome(page)
    await selectRow(page, 'docs')
    await page.locator('.bulk-actions').getByRole('button', { name: '压缩' }).click()

    // 小目录压缩瞬间完成，SSE complete 可能早于订阅建立，自动刷新不可靠；
    // 轮询手动刷新直到 docs.zip 出现（zip 写入被压缩目录的父目录）
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: '刷新' }).click()
      if (await page.locator('.file-name-text').filter({ hasText: 'docs.zip' }).isVisible()) break
      await page.waitForTimeout(500)
    }
    await expect(page.locator('.file-name-text').filter({ hasText: 'docs.zip' })).toBeVisible()
  })

  test('移动文件夹到 docs：源消失且目标出现', async ({ page }) => {
    await openHome(page)
    await selectRow(page, 'empty')
    await page.locator('.bulk-actions').getByRole('button', { name: '移动' }).click()

    // 移动对话框 → 打开路径选择树
    const moveDialog = page.locator('.el-dialog', { hasText: /移动 \(\d+ 项\)/ })
    await expect(moveDialog).toBeVisible()
    await page.locator('.path-selector .el-input').click()

    // 树对话框中选择 docs 文件夹
    const treeDialog = page.locator('.el-dialog', { hasText: '选择目标文件夹' })
    await expect(treeDialog).toBeVisible()
    const docsNode = treeDialog.locator('.el-tree-node__content').filter({ hasText: 'docs' })
    await expect(docsNode).toBeVisible()
    await docsNode.click()
    await treeDialog.getByRole('button', { name: '确定' }).click()

    // 确认移动（启动后台任务）
    await moveDialog.getByRole('button', { name: '确定' }).click()

    // 任务执行完成后：进入 docs 看到 empty 已移入
    await page.locator('.file-name-text').filter({ hasText: 'docs' }).first().click()
    await expect(page.locator('.file-name-text').filter({ hasText: 'empty' })).toBeVisible()

    // 返回根目录：empty 已从原位置消失
    await page.locator('.breadcrumb-home').click()
    await expect(page.locator('.file-name-text').filter({ hasText: 'empty' })).toHaveCount(0)
  })
})
