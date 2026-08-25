/**
 * el-tooltip 的 popper 默认用 transform（translate3d）定位，而 transform 会让
 * background-attachment: fixed 退化为相对元素定位，导致「body 背景镜像」错位。
 * 这里监听 tooltip popper，用 getBoundingClientRect 记录其实际视觉位置后改用
 * position: fixed 的 left/top 表达并清空 transform，使固定背景重新锚定视口
 * （el-select 下拉因 gpu-acceleration=false 无此问题）。
 *
 * @returns 清理函数（插件 teardown 调用）：断开全部观察器
 */
export function setupTooltipFixedBackground(): () => void {
  const observers = new WeakMap<Element, MutationObserver>()
  /** 全部活跃观察器（含 rootObserver），供 teardown 统一断开 */
  const activeObservers = new Set<MutationObserver>()

  const sync = (el: HTMLElement): void => {
    const t = el.style.transform
    if (!t) return

    // 记录 transform 生效时的实际视觉位置（视口坐标），然后改用 position: fixed
    // 的 left/top 表达同一位置并清掉 transform。这样既保持视觉位置不变，又避免
    // Popper.js 的 top/bottom + transform 同时存在导致 popper 被拉伸，同时让
    // background-attachment: fixed 重新锚定视口。
    const rect = el.getBoundingClientRect()
    el.style.position = 'fixed'
    el.style.left = `${rect.left}px`
    el.style.top = `${rect.top}px`
    el.style.right = ''
    el.style.bottom = ''
    el.style.transform = ''
  }

  const attach = (el: Element): void => {
    if (observers.has(el)) return
    const node = el as HTMLElement
    sync(node)
    const observer = new MutationObserver(() => sync(node))
    observer.observe(node, { attributes: true, attributeFilter: ['style'] })
    observers.set(el, observer)
    activeObservers.add(observer)
  }

  const detach = (el: Element): void => {
    const observer = observers.get(el)
    observer?.disconnect()
    if (observer) activeObservers.delete(observer)
    observers.delete(el)
  }

  const scan = (root: ParentNode): void => {
    root.querySelectorAll('.el-tooltip.el-popper').forEach((el) => attach(el))
  }

  const rootObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) continue
        if (node.classList.contains('el-tooltip') && node.classList.contains('el-popper')) {
          attach(node)
        }
        scan(node)
      }
      for (const node of Array.from(mutation.removedNodes)) {
        if (!(node instanceof Element)) continue
        if (node.classList.contains('el-tooltip') && node.classList.contains('el-popper')) {
          detach(node)
        }
        node.querySelectorAll('.el-tooltip.el-popper').forEach((el) => detach(el))
      }
    }
  })
  activeObservers.add(rootObserver)

  rootObserver.observe(document.body, { childList: true, subtree: true })
  scan(document.body)

  // teardown：断开全部观察器（插件卸载/重载时由平台调用）
  return () => {
    for (const observer of activeObservers) {
      observer.disconnect()
    }
    activeObservers.clear()
  }
}
