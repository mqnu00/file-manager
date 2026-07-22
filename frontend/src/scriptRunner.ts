/**
 * 脚本测试器：通过 ctx 上下文执行动态脚本
 *
 * 触发方式：控制台中调用 __runScript()
 */

import type { ScriptContext } from '@/context'

const STYLE_ID = 'script-runner-style'

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .script-dialog .el-message-box__input {
      padding-top: 8px;
    }
    .script-dialog textarea {
      font-family: 'Courier New', Consolas, monospace !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
      min-height: 200px !important;
    }
  `
  document.head.appendChild(style)
}

function openScriptDialog(ctx: ScriptContext) {
  const { ElementPlus } = ctx

  ElementPlus.ElMessageBox.prompt('请输入要执行的脚本代码，可通过 ctx 访问公共资源', '脚本测试', {
    confirmButtonText: '运行 (Ctrl+Enter)',
    cancelButtonText: '关闭',
    inputType: 'textarea',
    inputPlaceholder: [
      '// ctx 可用资源:',
      '// ctx.Vue              Vue 核心',
      '// ctx.ElementPlus      Element Plus',
      '// ctx.stores.auth      认证状态',
      '// ctx.stores.file      文件浏览',
      '// ctx.api.xxx          API 调用',
      '// ctx.utils.xxx        工具函数',
      '',
      '// 示例:',
      'const info = await ctx.api.system.getSystemInfo()',
      'ctx.ElementPlus.ElMessage.success(info.os.platform)',
    ].join('\n'),
    customClass: 'script-dialog',
    distinguishCancelAndClose: true,
    inputValidator: (value: string) => {
      if (!value || !value.trim()) return '请输入代码'
      return true
    },
    beforeClose: async (action, instance, done) => {
      if (action !== 'confirm') {
        done()
        return
      }

      const code = (instance as any).inputValue?.trim()
      if (!code) {
        done()
        return
      }

      const start = performance.now()

      // 使用 Blob + import() 替代 new Function()，兼容 CSP 限制
      const wrappedCode = `export default async function(ctx) {\n${code}\n}`
      const blob = new Blob([wrappedCode], { type: 'text/javascript' })
      const url = URL.createObjectURL(blob)

      try {
        const mod = await import(/* @vite-ignore */ url)
        const result = await mod.default(ctx)
        URL.revokeObjectURL(url)
        const elapsed = (performance.now() - start).toFixed(0)
        done()

        if (result !== undefined) {
          const display =
            typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
          ElementPlus.ElMessageBox.alert(
            `<pre style="max-height:400px;overflow:auto;font-size:12px;margin:0;white-space:pre-wrap;word-break:break-all">${escapeHtml(display)}</pre>`,
            `执行成功 (${elapsed}ms)`,
            {
              dangerouslyUseHTMLString: true,
              confirmButtonText: '继续',
              customClass: 'script-dialog',
            },
          ).then(() => openScriptDialog(ctx))
        } else {
          ElementPlus.ElMessage.success(`执行完成 (${elapsed}ms)`)
          setTimeout(() => openScriptDialog(ctx), 300)
        }
      } catch (err: any) {
        URL.revokeObjectURL(url)
        const elapsed = (performance.now() - start).toFixed(0)
        done()

        const stack = err.stack || err.message || String(err)
        ElementPlus.ElMessageBox.alert(
          `<pre style="max-height:400px;overflow:auto;font-size:12px;margin:0;color:#f56c6c;white-space:pre-wrap;word-break:break-all">${escapeHtml(stack)}</pre>`,
          `执行失败 (${elapsed}ms)`,
          {
            dangerouslyUseHTMLString: true,
            confirmButtonText: '继续',
            customClass: 'script-dialog',
            type: 'error',
          },
        ).then(() => openScriptDialog(ctx))
      }
    },
  }).catch(() => {
    // 用户点击关闭/取消
  })
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, (c) => map[c] || c)
}

export function initScriptRunner(ctx: ScriptContext) {
  injectStyle()
  window.__runScript = () => {
    openScriptDialog(ctx)
  }
  console.log('[script-runner] 调用 __runScript() 打开代码执行框')
}
