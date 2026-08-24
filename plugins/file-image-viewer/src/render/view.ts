/**
 * 纯展示层：把 ViewerVM（状态 + 回调）渲染为视图节点。
 * 只做 h() 组装，不包含业务逻辑；事件委托给 vm.handlers 与 vm.view。
 */

import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'
import type { ViewerVM } from '../types'
import { ZOOM_STEP } from '../constants'

export function renderViewer(ctx: FrontendPluginContext, vm: ViewerVM) {
  const { h } = ctx.Vue
  const { ElTag, ElButton, ElAlert } = ctx.ElementPlus
  const api = ctx.api.fileIO

  const fmtSize = () => ctx.utils.formatSize(vm.file.size)

  /** 元数据文本：分辨率 · DPI · 位深度（未知项省略） */
  const metaText = () => {
    const w = vm.source.meta.value.width ?? vm.view.naturalW.value
    const hh = vm.source.meta.value.height ?? vm.view.naturalH.value
    const parts: string[] = []
    if (w && hh) parts.push(`${w} × ${hh}`)
    if (vm.source.meta.value.dpi) parts.push(`${vm.source.meta.value.dpi} DPI`)
    if (vm.source.meta.value.bitDepth) parts.push(`${vm.source.meta.value.bitDepth}-bit`)
    return parts.join(' · ')
  }

  const toolbar = h('div', { class: 'fiv-bar' }, [
    h(
      ElTag,
      { size: 'small', type: 'info' },
      () => `${vm.file.name.toUpperCase()} · ${fmtSize()}`
    ),
    metaText() ? h('span', { class: 'fiv-meta' }, metaText()) : null,
    h('span', { style: { flex: 1 } }),
    h(
      ElButton,
      { size: 'small', disabled: !vm.nav.canPrev.value, onClick: vm.handlers.goPrev },
      () => '‹ 上一张'
    ),
    h(
      ElTag,
      { size: 'small', type: 'info' },
      () => `${vm.nav.images.value.length ? vm.nav.currentIndex.value + 1 : 0} / ${vm.nav.images.value.length}`
    ),
    h(
      ElButton,
      { size: 'small', disabled: !vm.nav.canNext.value, onClick: vm.handlers.goNext },
      () => '下一张 ›'
    ),
    vm.nav.images.value.length > 0
      ? h(ElButton, { size: 'small', onClick: vm.handlers.openGallery }, () => '图库')
      : null,
    h(
      ElButton,
      {
        size: 'small',
        type: vm.view.isFitActive() ? 'primary' : '',
        onClick: vm.view.fitToWindow,
      },
      () => '适应窗口'
    ),
    h(
      ElButton,
      { size: 'small', onClick: () => vm.view.applyZoom(-ZOOM_STEP) },
      () => '缩小'
    ),
    h(
      ElButton,
      { size: 'small', onClick: () => vm.view.applyZoom(ZOOM_STEP) },
      () => '放大'
    ),
    h(
      ElButton,
      {
        size: 'small',
        onClick: () => {
          vm.view.rotate.value = (vm.view.rotate.value + 90) % 360
        },
      },
      () => '旋转'
    ),
    h(
      'span',
      { class: 'fiv-zoom-info' },
      vm.view.isFitActive()
        ? `适应 ${vm.view.fitScale.value}% · ${vm.view.rotate.value}°`
        : `${Math.round(vm.view.scale.value * 100)}% · ${vm.view.rotate.value}°`
    ),
    h(ElButton, { size: 'small', onClick: vm.handlers.download }, () => '下载图片'),
  ])

  let node
  if (vm.source.error.value) {
    node = h('div', { class: 'fiv-viewer' }, [
      toolbar,
      h('div', { style: { height: '12px' } }),
      h(ElAlert, {
        type: 'error',
        showIcon: false,
        title: vm.source.error.value,
        closable: false,
      }),
      h('div', { style: { height: '12px' } }),
      h(ElButton, { size: 'small', onClick: vm.handlers.download }, () => '下载文件'),
    ])
  } else if (!vm.source.token.value) {
    node = h('div', { class: 'fiv-viewer' }, [
      toolbar,
      h('div', { class: 'fiv-loading' }, '加载图片地址中…'),
    ])
  } else {
    const transform = vm.view.getTransformStyle()
    node = h('div', { class: 'fiv-viewer' }, [
      toolbar,
      h(
        'div',
        {
          ref: vm.view.setupStageRef,
          class: 'fiv-stage fiv-stage-draggable',
        },
        [
          h('img', {
            class: 'fiv-zoom',
            src: api.streamUrl(vm.source.token.value),
            alt: vm.file.name,
            draggable: false,
            style: { transform },
            onLoad: vm.view.onImgLoad,
            onError: vm.handlers.onImageError,
          }),
        ]
      ),
    ])
  }

  return node
}
