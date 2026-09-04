// src/theme.css
var theme_default = `/* \u521D\u97F3\u672A\u6765\u4E3B\u9898\u6837\u5F0F\u3002\u5360\u4F4D\u7B26 __MIKU_DEFAULT_BG_URL__ / __MIKU_LOGO_URL__ \u7531
   frontend.ts \u8BFB\u5165\u672C\u6587\u4EF6\u540E replace \u6CE8\u5165\u771F\u5B9E URL\uFF08\u4FDD\u6301\u5E38\u91CF\u552F\u4E00\u6765\u6E90\uFF09\u3002 */
html.hatsune-miku {
  /* \u539F\u751F\u63A7\u4EF6\uFF08\u5A92\u4F53\u64AD\u653E\u6761/\u8868\u5355/Chromium PDF \u67E5\u770B\u5668\uFF09\u81EA\u52A8\u5207\u6697\u8272 */
  color-scheme: dark;
  --miku-bg: url('__MIKU_DEFAULT_BG_URL__');
  /* \u521D\u97F3\u7279\u8272\u8272\u677F\uFF08\u53C2\u8003 DB_Hatsune-Miku-Theme\uFF09\uFF1A\u4E3B\u9752 #00f2ff / \u6B21\u9752\u7EFF #0abdc6 /
     \u4EAE\u9752 #00fff1 / \u8F85\u52A9\u84DD #03a9f4 / \u70B9\u7F00\u7C89 #e91e63 / \u5371\u9669\u7EA2 #f40303 */
  --miku-cyan: #00f2ff;
  --miku-teal: #0abdc6;
  --miku-blue: #03a9f4;
  --miku-pink: #e91e63;
  --app-bg: #040405;
  /* \u9762\u677F\u9ED1\u8272\u534A\u900F\u660E\u7A0B\u5EA6\uFF08alpha \u767E\u5206\u6BD4\uFF09\uFF0C\u53EF\u5728\u63D2\u4EF6\u4E3B\u9875\u914D\u7F6E\uFF0C\u9ED8\u8BA4 10% */
  --app-panel-opacity: 10%;
  --app-panel: rgb(0 0 0 / var(--app-panel-opacity));
  --app-panel-solid: #040405;
  --app-border: rgb(10 189 198 / 25%);
  --app-shadow: 0 2px 8px rgb(0 0 0 / 60%);
  --app-glow: 0 0 12px rgb(0 242 255 / 25%);
  --app-text: #dcddde;
  --app-text-dim: #6fb3c6;
  --app-text-bright: #ffffff;
  --app-accent: #00f2ff;
  --app-accent-bg: rgb(10 189 198 / 10%);
  --app-accent-bg-hover: rgb(10 189 198 / 16%);
  --app-accent-bg-subtle: rgb(10 189 198 / 7%);
  --app-accent-border: rgb(10 189 198 / 26%);
  --app-accent-border-light: rgb(10 189 198 / 18%);
  /* \u8F93\u5165\u63A7\u4EF6\u80CC\u666F = \u9762\u677F\u9ED1\u8272\u534A\u900F\u660E\u7A0B\u5EA6 + 20%\uFF08\u8DDF\u968F\u7528\u6237\u914D\u7F6E\uFF0C\u9ED8\u8BA4 10% + 20% = 30%\uFF09 */
  --app-input-bg: rgb(0 0 0 / calc(var(--app-panel-opacity) + 20%));
  --app-table-header-bg: rgb(10 189 198 / 7%);
  --app-table-header-border: rgb(10 189 198 / 20%);
  --app-table-row-hover: rgb(10 189 198 / 7%);
  --app-table-cell-border: rgb(10 189 198 / 9%);
  --app-blur: blur(0px);
  --app-text-shadow: none;
  --app-text-glow: 0 0 6px rgb(0 242 255 / 45%);
  --app-text-glow-hover: 0 0 12px rgb(0 242 255 / 70%);
  --app-checkbox-border: rgb(0 242 255 / 35%);
  --app-checkbox-shadow: 0 0 6px rgb(0 242 255 / 50%);
  --app-mask-bg: rgb(4 4 5 / 70%);
  --app-select-caret: #00f2ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgb(0 0 0 / 50%);
  --app-scrollbar-thumb: rgb(10 189 198 / 35%);
  --app-scrollbar-thumb-hover: rgb(0 242 255 / 50%);

  /* Element Plus \u4E3B\u9898\u53D8\u91CF\u8986\u76D6 */
  --el-color-primary-light-9: rgb(0 242 255 / 10%);
  --el-color-danger: #f40303;
}

/* ===== Element Plus \u7EC4\u4EF6\u6697\u8272\u8986\u76D6\uFF08\u79FB\u690D\u81EA\u4E3B\u9879\u76EE html.cyber\uFF0C\u8272\u503C\u9002\u914D\u672C\u4E3B\u9898\uFF09 ===== */

/* dialog \u88AB teleport \u5230 body\uFF0C\u6539\u7528 background-attachment: fixed \u628A body \u540C\u6B3E\u80CC\u666F\u5C42
   \u6309\u89C6\u53E3\u5750\u6807\u94FA\u5230 dialog \u4E0A\uFF0C\u900F\u51FA\u300Cbody \u80CC\u666F\u7684\u5BF9\u5E94\u4F4D\u7F6E\u300D\uFF1B\u6700\u9876\u5C42\u53E0\u4E00\u5C42 --app-panel
   \u534A\u900F\u660E\u9ED1\u4FDD\u8BC1\u6587\u5B57\u53EF\u8BFB\uFF0C\u4E0E el-select \u4E0B\u62C9\u9762\u677F / \u540E\u53F0\u4EFB\u52A1\u9762\u677F\u540C\u4E00\u5957\u89C6\u89C9\u3002 */
html.hatsune-miku .el-dialog {
  --el-dialog-bg-color: var(--app-bg);
  --el-dialog-box-shadow: var(--app-glow), 0 8px 32px rgb(0 0 0 / 40%);

  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  background-color: var(--app-bg);
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* dialog \u8FDB\u51FA\u573A\u9ED8\u8BA4\u5BF9 .el-overlay-dialog \u505A translateY\uFF08transform\uFF09\uFF0Ctransform \u4F1A\u8BA9
   background-attachment: fixed \u7684\u955C\u50CF\u80CC\u666F\u76F8\u5BF9\u52A8\u753B\u5BB9\u5668\u91CD\u5B9A\u4F4D\u5E76\u9010\u5E27\u91CD\u7ED8\uFF0C\u8868\u73B0\u540C
   el-select \u4E0B\u62C9\uFF1A\u6253\u5F00\u77AC\u95F4\u80CC\u666F\u5148\u9519\u4F4D\u518D\u5BF9\u9F50\u3002\u8FD9\u91CC\u8986\u76D6\u4E3A\u7EAF\u6DE1\u5165\u6DE1\u51FA\u3001\u53BB\u6389 transform\u3002 */
html.hatsune-miku .dialog-fade-enter-active .el-overlay-dialog {
  animation: miku-dialog-fade-in var(--el-transition-duration) !important;
}

html.hatsune-miku .dialog-fade-leave-active .el-overlay-dialog {
  animation: miku-dialog-fade-out var(--el-transition-duration) !important;
}

@keyframes miku-dialog-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes miku-dialog-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

html.hatsune-miku .el-dialog__header {
  border-bottom: 1px solid var(--app-border) !important;
  padding: 16px 20px !important;
}

html.hatsune-miku .el-dialog__title {
  color: var(--app-accent) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 8px rgb(0 242 255 / 30%);
}

html.hatsune-miku .el-dialog__body {
  color: var(--app-text) !important;
  padding: 20px !important;
}

html.hatsune-miku .el-dialog__footer {
  border-top: 1px solid var(--app-border) !important;
  padding: 12px 20px !important;
}

html.hatsune-miku .el-dialog__headerbtn .el-dialog__close {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-dialog__headerbtn .el-dialog__close:hover {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button {
  --el-button-text-color: var(--app-accent);
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--app-border);
  --el-button-hover-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgb(10 189 198 / 14%);
  --el-button-hover-border-color: var(--app-accent);
  --el-button-active-text-color: var(--app-accent);
  --el-button-active-bg-color: rgb(10 189 198 / 20%);
  --el-button-active-border-color: var(--app-accent);

  border-radius: 6px !important;
  font-weight: 500 !important;
}

html.hatsune-miku .el-button--default {
  background: transparent !important;
  border-color: var(--app-border) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--default:hover {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 10px rgb(10 189 198 / 25%);
}

html.hatsune-miku .el-button--primary {
  --el-button-bg-color: rgb(0 242 255 / 15%);
  --el-button-border-color: var(--app-accent);
  --el-button-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgb(0 242 255 / 25%);
  --el-button-hover-border-color: var(--app-accent);

  background: rgb(0 242 255 / 15%) !important;
  border-color: var(--app-accent) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--primary:hover {
  box-shadow: 0 0 16px rgb(0 242 255 / 30%);
}

html.hatsune-miku .el-button--success {
  --el-button-bg-color: rgb(0 255 100 / 12%);
  --el-button-border-color: rgb(0 255 100 / 40%);

  background: rgb(0 255 100 / 12%) !important;
  border-color: rgb(0 255 100 / 40%) !important;
  color: #00ff64 !important;
}

html.hatsune-miku .el-button--danger {
  --el-button-bg-color: rgb(244 3 3 / 12%);
  --el-button-border-color: rgb(244 3 3 / 40%);

  background: rgb(244 3 3 / 12%) !important;
  border-color: rgb(244 3 3 / 40%) !important;
  color: #f40303 !important;
}

html.hatsune-miku .el-button--danger:hover {
  box-shadow: 0 0 12px rgb(244 3 3 / 25%);
}

html.hatsune-miku .el-button--warning {
  --el-button-bg-color: rgb(255 160 0 / 12%);
  --el-button-border-color: rgb(255 160 0 / 40%);

  background: rgb(255 160 0 / 12%) !important;
  border-color: rgb(255 160 0 / 40%) !important;
  color: #ffa000 !important;
}

html.hatsune-miku .el-input__wrapper {
  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

html.hatsune-miku .el-input__wrapper:hover {
  border-color: rgb(10 189 198 / 50%) !important;
}

html.hatsune-miku .el-input__inner {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-input__inner::placeholder {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-message {
  /* \u80CC\u666F\u900F\u660E\u5EA6 = \u9762\u677F\u8BBE\u7F6E + 20%\uFF08\u590D\u7528 --app-input-bg\uFF09\uFF0C\u6A21\u7CCA\u5EA6\u8DDF\u968F\u8BBE\u7F6E */
  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 8px !important;
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
}

html.hatsune-miku .el-message--primary {
  --el-message-bg-color: rgb(0 242 255 / 10%);
  --el-message-border-color: rgb(0 242 255 / 30%);
  --el-message-text-color: var(--app-accent);
}

html.hatsune-miku .el-message--success {
  --el-message-bg-color: rgb(0 255 100 / 10%);
  --el-message-border-color: rgb(0 255 100 / 30%);
  --el-message-text-color: #00ff64;
}

html.hatsune-miku .el-message--warning {
  --el-message-bg-color: rgb(255 160 0 / 10%);
  --el-message-border-color: rgb(255 160 0 / 30%);
  --el-message-text-color: #ffa000;
}

html.hatsune-miku .el-message--error {
  --el-message-bg-color: rgb(244 3 3 / 10%);
  --el-message-border-color: rgb(244 3 3 / 30%);
  --el-message-text-color: #f40303;
}

html.hatsune-miku .el-message--info {
  --el-message-bg-color: rgb(10 189 198 / 10%);
  --el-message-border-color: var(--app-border);
  --el-message-text-color: var(--app-text);
}

html.hatsune-miku .el-message-box {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
}

html.hatsune-miku .el-message-box__title {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-message-box__message {
  color: var(--app-text) !important;
}

html.hatsune-miku .el-message-box__headerbtn .el-message-box__close {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-progress-bar__outer {
  background: rgb(10 189 198 / 8%) !important;
  border-radius: 4px !important;
}

html.hatsune-miku .el-progress-bar__inner {
  background: linear-gradient(90deg, #00f2ff, #03a9f4) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 8px rgb(0 242 255 / 40%);
}

html.hatsune-miku .el-tree {
  background: transparent !important;
  color: var(--app-text) !important;
}

html.hatsune-miku .el-tree-node__content:hover {
  background: var(--app-accent-bg-hover) !important;
}

html.hatsune-miku .el-tree-node:focus > .el-tree-node__content {
  background-color: var(--app-accent-bg-hover) !important;
}

html.hatsune-miku .el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
  background: var(--app-accent-bg-hover) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-tree-node__expand-icon {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-tree-node__expand-icon.is-leaf {
  color: transparent !important;
}

/* el-select \u89E6\u53D1\u5668 */
html.hatsune-miku .el-select__wrapper {
  background: var(--app-input-bg) !important;
  box-shadow: 0 0 0 1px var(--app-border) inset !important;
}

html.hatsune-miku .el-select__wrapper:hover {
  box-shadow: 0 0 0 1px rgb(10 189 198 / 50%) inset !important;
}

html.hatsune-miku .el-select__wrapper.is-focused {
  box-shadow: 0 0 0 1px var(--app-accent) inset !important;
}

/* el-select \u5185\u5BB9\u6587\u5B57 */
html.hatsune-miku .el-select__placeholder {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-select__selected-item {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-select__caret {
  color: var(--app-accent) !important;
}

/* el-select \u4E0B\u62C9\u83DC\u5355\uFF08EP 2.4+ \u65B0\u7ED3\u6784\uFF09\uFF1A\u5916\u90E8 popper\uFF08.el-select__popper.el-popper\uFF09
   \u662F\u88AB teleport \u5230 body \u7684\u72EC\u7ACB\u5143\u7D20\uFF0C\u5185\u90E8 .el-select-dropdown \u53EA\u662F\u900F\u660E\u5BB9\u5668\uFF0C\u4E4B\u524D\u628A
   \u78E8\u7802\u6253\u5728\u5B83\u4E0A\u9762\u53EA\u4F1A\u900F\u51FA popper \u81EA\u8EAB\u7684\u767D\u8272\u5E95\uFF08--el-bg-color-overlay\uFF09\uFF0C\u770B\u4E0D\u5230\u78E8\u7802\u3002
   \u8FD9\u91CC\u6539\u7528 background-attachment: fixed \u628A body \u540C\u6B3E\u80CC\u666F\u5C42\u6309\u89C6\u53E3\u5750\u6807\u94FA\u5230 popper \u4E0A\uFF0C
   \u8BA9\u4E0B\u62C9\u9762\u677F\u900F\u51FA\u300Cbody \u80CC\u666F\u7684\u5BF9\u5E94\u4F4D\u7F6E\u300D\uFF1B\u6700\u9876\u5C42\u53E0\u4E00\u5C42 --app-panel \u534A\u900F\u660E\u9ED1\u4FDD\u8BC1\u6587\u5B57
   \u53EF\u8BFB\uFF0C\u5E76\u7EE7\u7EED\u590D\u7528\u300C\u9762\u677F\u9ED1\u8272\u534A\u900F\u660E\u7A0B\u5EA6\u300D\u8BBE\u7F6E\u3002 */
html.hatsune-miku .el-select__popper.el-popper {
  border: 1px solid var(--app-border) !important;
  box-shadow: var(--app-glow), var(--app-shadow);
  background-color: var(--app-bg);
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* \u4E0B\u62C9\u5C55\u5F00\u52A8\u753B\u9ED8\u8BA4\u662F scaleY \u7F29\u653E\uFF08transform\uFF09\u3002transform \u4F1A\u8BA9 background-attachment:
   fixed \u7684\u955C\u50CF\u80CC\u666F\u76F8\u5BF9 popper \u91CD\u65B0\u5B9A\u4F4D\uFF0C\u5E76\u5728\u52A8\u753B\u6BCF\u4E00\u5E27\u91CD\u7ED8\uFF0C\u8868\u73B0\u4E3A\u300C\u6253\u5F00\u65F6\u56FE\u7247\u5148\u9519\u4F4D
   \u518D\u5BF9\u9F50\u3001\u6BCF\u6B21\u4E0B\u62C9\u90FD\u8981\u91CD\u65B0\u8BA1\u7B97\u300D\u3002\u8FD9\u91CC\u6539\u6210\u7EAF\u6DE1\u5165\u3001\u53BB\u6389 transform\uFF0C\u8BA9 fixed \u80CC\u666F\u59CB\u7EC8
   \u951A\u5B9A\u89C6\u53E3\u3001\u53EA\u5149\u6805\u5316\u4E00\u6B21\u3002 */
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-enter-active,
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-leave-active {
  opacity: 1 !important;
  transition: opacity var(--el-transition-duration) var(--el-transition-function-fast-bezier) !important;
  transform: none !important;
}

html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-enter-from,
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-leave-to {
  opacity: 0 !important;
  transform: none !important;
}

/* popper \u7BAD\u5934\u5E95\u8272/\u8FB9\u6846\u8DDF\u968F\u4E3B\u9898\uFF0C\u907F\u514D\u51FA\u73B0\u767D\u8272\u4E09\u89D2 */
html.hatsune-miku .el-select__popper.el-popper .el-popper__arrow::before {
  background: var(--app-panel) !important;
  border-color: var(--app-border) !important;
}

html.hatsune-miku .el-select-dropdown__item {
  color: var(--app-text) !important;
}

html.hatsune-miku .el-select-dropdown__item.is-hovering {
  background: var(--app-accent-bg-hover) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-select-dropdown__item.is-selected {
  color: var(--app-accent) !important;
  font-weight: 600;
}

/* el-tooltip\uFF1A\u4E0E el-select \u4E0B\u62C9\u9762\u677F\u4E00\u81F4\uFF0C\u7528 background-attachment: fixed \u900F\u51FA
   body \u80CC\u666F\u5BF9\u5E94\u4F4D\u7F6E\u3002tooltip popper \u9ED8\u8BA4\u7528 transform\uFF08translate3d\uFF09\u5B9A\u4F4D\uFF0C\u4F1A\u8BA9 fixed
   \u9000\u5316\u4E3A\u76F8\u5BF9\u5143\u7D20\u5B9A\u4F4D\uFF0C\u6545\u7531 frontend.ts \u7684 setupTooltipFixedBackground \u628A transform
   \u6362\u7B97\u6210 left/top \u540E\u518D\u751F\u6548\u3002 */
html.hatsune-miku .el-tooltip.el-popper {
  border: 1px solid var(--app-border) !important;
  box-shadow: var(--app-glow), var(--app-shadow);
  color: var(--app-text-bright) !important;
  background-color: var(--app-bg);
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

html.hatsune-miku .el-tooltip.el-popper .el-popper__arrow::before {
  background: var(--app-panel) !important;
  border-color: var(--app-border) !important;
}

html.hatsune-miku .el-loading-spinner .circular {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-loading-spinner .el-loading-text {
  color: var(--app-text) !important;
}

html.hatsune-miku ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

html.hatsune-miku ::-webkit-scrollbar-track {
  background: rgb(0 0 0 / 50%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb {
  background: rgb(10 189 198 / 35%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb:hover {
  background: rgb(0 242 255 / 50%);
}

/* el-card\uFF08\u7CFB\u7EDF\u4FE1\u606F\u9875\u5361\u7247\uFF09\uFF1A\u80CC\u666F\u534A\u900F\u660E\u7A0B\u5EA6 = \u9762\u677F\u8BBE\u7F6E + 20%\uFF08\u590D\u7528 --app-input-bg\uFF09\uFF0C
   \u6A21\u7CCA\u5EA6\u8DDF\u968F\u9762\u677F\u8BBE\u7F6E */
html.hatsune-miku .el-card {
  --el-card-bg-color: var(--app-input-bg);

  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
}

/* el-divider \u5206\u5272\u7EBF */
html.hatsune-miku .el-divider {
  border-color: var(--app-border) !important;
}

html.hatsune-miku .el-divider__text {
  background: var(--app-panel-solid) !important;
  color: var(--app-text-dim) !important;
}

/* el-input-number \u6570\u5B57\u8F93\u5165\u6846 */
html.hatsune-miku .el-input-number .el-input-number__decrease,
html.hatsune-miku .el-input-number .el-input-number__increase {
  background: var(--app-input-bg) !important;
  border-color: var(--app-border) !important;
  color: var(--app-text) !important;
}

html.hatsune-miku .el-input-number .el-input-number__decrease:hover,
html.hatsune-miku .el-input-number .el-input-number__increase:hover {
  color: var(--app-accent) !important;
}

/* el-slider \u6ED1\u5757\uFF08\u63D2\u4EF6\u4E3B\u9875\u9762\u677F\u900F\u660E\u5EA6\u914D\u7F6E\uFF09 */
html.hatsune-miku .el-slider__runway {
  background: rgb(10 189 198 / 20%) !important;
}

html.hatsune-miku .el-slider__bar {
  background: linear-gradient(90deg, #00f2ff, #03a9f4) !important;
}

html.hatsune-miku .el-slider__button {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 6px rgb(0 242 255 / 50%) !important;
}

html.hatsune-miku .el-slider__stop {
  background: rgb(10 189 198 / 30%) !important;
}

/* el-tag \u6807\u7B7E */
html.hatsune-miku .el-tag--primary {
  --el-tag-bg-color: rgb(0 242 255 / 12%);
  --el-tag-border-color: rgb(0 242 255 / 40%);
  --el-tag-text-color: var(--app-accent);
}

html.hatsune-miku .el-tag--danger {
  --el-tag-bg-color: rgb(244 3 3 / 12%);
  --el-tag-border-color: rgb(244 3 3 / 40%);
  --el-tag-text-color: #f40303;
}

html.hatsune-miku .el-tag--info {
  --el-tag-bg-color: rgb(10 189 198 / 12%);
  --el-tag-border-color: rgb(10 189 198 / 35%);
  --el-tag-text-color: var(--app-accent);
}

html.hatsune-miku .el-tag--success {
  --el-tag-bg-color: rgb(0 255 100 / 12%);
  --el-tag-border-color: rgb(0 255 100 / 40%);
  --el-tag-text-color: #00ff64;
}

html.hatsune-miku .el-tag--warning {
  --el-tag-bg-color: rgb(255 165 0 / 12%);
  --el-tag-border-color: rgb(255 165 0 / 40%);
  --el-tag-text-color: #ffa500;
}

/* el-tabs */
html.hatsune-miku .el-tabs__item {
  color: var(--app-text) !important;
}

html.hatsune-miku .el-tabs__item:hover,
html.hatsune-miku .el-tabs__item.is-active {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-tabs__item.is-disabled {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-tabs__active-bar {
  background-color: var(--app-accent) !important;
}

html.hatsune-miku .el-tabs__nav-wrap::after {
  background-color: var(--app-border) !important;
}

/* el-pagination */
html.hatsune-miku .el-pagination {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: var(--app-text);
  --el-pagination-button-bg-color: var(--app-panel-solid);
  --el-pagination-button-color: var(--app-text);
  --el-pagination-hover-color: var(--app-accent);
}

html.hatsune-miku .el-pagination .el-pager li {
  background: var(--app-panel-solid) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--app-border) !important;
}

html.hatsune-miku .el-pagination .el-pager li.is-active {
  background: var(--app-accent-bg) !important;
  color: var(--app-accent) !important;
  border-color: var(--app-accent) !important;
}

html.hatsune-miku .el-pagination .btn-prev,
html.hatsune-miku .el-pagination .btn-next {
  background: var(--app-panel-solid) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--app-border) !important;
}

/* el-table */
html.hatsune-miku .el-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--app-panel);
  --el-table-header-text-color: var(--app-text);
  --el-table-text-color: var(--app-text);
  --el-table-border-color: var(--app-border);
  --el-table-row-hover-bg-color: var(--app-accent-bg);
  --el-table-current-row-bg-color: var(--app-accent-bg);
  --el-table-expanded-cell-bg-color: transparent;
}

html.hatsune-miku .el-table th.el-table__cell {
  background: var(--app-panel) !important;
  color: var(--app-text) !important;
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table td.el-table__cell {
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell {
  background: rgb(0 0 0 / 45%) !important;
}

html.hatsune-miku .el-table__empty-text {
  color: var(--app-text-dim) !important;
}

/* el-table \u9009\u4E2D\u884C\uFF08\u521D\u97F3\u70B9\u7F00\u7C89\uFF0C\u53C2\u8003 DB \u4E3B\u9898 mention \u9AD8\u4EAE #E91E63\uFF09 */
html.hatsune-miku .el-table__row.current > td {
  background: rgb(233 30 99 / 14%) !important;
}

html.hatsune-miku .el-table__row.current > td .cell {
  color: #ff5c8a !important;
}

/* el-loading mask \u5168\u5C40\u52A0\u8F7D\u906E\u7F69 */
html.hatsune-miku .el-loading-mask {
  background: var(--app-mask-bg) !important;
}

/* el-form-item \u8868\u5355\u6807\u7B7E */
html.hatsune-miku .el-form-item__label {
  color: var(--app-text) !important;
}

/* el-button text \u6587\u5B57\u6309\u94AE */
html.hatsune-miku .el-button--text {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--text:hover {
  color: var(--app-accent) !important;
  text-shadow: var(--app-text-glow-hover);
}

html.hatsune-miku .el-button.is-text:not(.is-disabled):hover {
  background-color: var(--app-accent-bg-hover) !important;
}

/* \u6D4F\u89C8\u5668\u81EA\u52A8\u586B\u5145\u80CC\u666F\u8986\u76D6 */
html.hatsune-miku input:-webkit-autofill,
html.hatsune-miku input:-webkit-autofill:hover,
html.hatsune-miku input:-webkit-autofill:focus {
  box-shadow: 0 0 0 1000px var(--app-input-bg) inset !important;
  -webkit-text-fill-color: var(--app-text-bright) !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* \u63D2\u4EF6\u641C\u7D22\u7ED3\u679C\u5217\u8868\u9879\uFF1A\u80CC\u666F\u534A\u900F\u660E\u7A0B\u5EA6 = \u9762\u677F\u8BBE\u7F6E + 20%\uFF08\u590D\u7528 --app-input-bg\uFF09\uFF0C
   \u6A21\u7CCA\u5EA6\u8DDF\u968F\u9762\u677F\u8BBE\u7F6E\uFF1B\u8986\u76D6 PluginView \u91CC\u9ED8\u8BA4\u7684\u5B9E\u8272 var(--app-bg) */
html.hatsune-miku .search-result-item {
  background: var(--app-input-bg) !important;
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
}

/* \u540E\u53F0\u4EFB\u52A1\u9762\u677F\uFF1A\u7528 background-attachment: fixed \u900F\u51FA body \u80CC\u666F\u5BF9\u5E94\u4F4D\u7F6E\u3002
   \u8986\u76D6\u5916\u5C42 .task-panel \u5BB9\u5668\uFF08\u542B\u5B50\u5143\u7D20\u95F4 gap\uFF09\u53CA header/empty/badge/card \u5B50\u5143\u7D20\uFF0C
   \u66FF\u6362 TaskPanel \u91CC scoped \u7684\u5B9E\u8272 var(--app-panel-solid) \u4E0E .task-card \u7684 blur\u3002 */
html.hatsune-miku .task-panel,
html.hatsune-miku .task-panel__header,
html.hatsune-miku .task-panel__empty,
html.hatsune-miku .task-badge,
html.hatsune-miku .task-card {
  background-color: var(--app-bg) !important;
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg) !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
  background-repeat: no-repeat !important;
  backdrop-filter: none !important;
}

/* \u5361\u7247\u8FDB\u51FA\u573A\u52A8\u753B\u9ED8\u8BA4 translateX\uFF08transform\uFF09\u4F1A\u8BA9 fixed \u80CC\u666F\u76F8\u5BF9\u5361\u7247\u91CD\u5B9A\u4F4D\u3001
   \u9519\u4F4D\u540E\u518D\u5BF9\u9F50\uFF0C\u53BB\u6389 transform\uFF0C\u53EA\u4FDD\u7559\u6DE1\u5165\u6DE1\u51FA\u3002 */
html.hatsune-miku .task-item-enter-from,
html.hatsune-miku .task-item-leave-to {
  transform: none !important;
}

/* \u6574\u4F53\u80CC\u666F\u56FE\uFF1A\u9ED8\u8BA4\u4F7F\u7528 --miku-bg\uFF0C\u7528\u6237\u5728\u63D2\u4EF6\u4E3B\u9875\u5207\u6362\u540E\u4EE5 html \u5185\u8054\u53D8\u91CF\u8986\u76D6\uFF1B
   \u6DF1\u8272\u534A\u900F\u660E\u6E10\u53D8\u53E0\u52A0\u4FDD\u8BC1\u524D\u666F\u6587\u5B57\u53EF\u8BFB\u6027 */
html.hatsune-miku body {
  background-color: var(--app-bg);
  /* \u9876\u90E8\u9752\u8272\u6C1B\u56F4\u5149\u6655\uFF08\u521D\u97F3\u9713\u8679\u611F\uFF0C\u53C2\u8003 DB \u4E3B\u9898 box-shadow glow\uFF09+ \u6DF1\u8272\u538B\u6697\u5C42 + \u80CC\u666F\u56FE */
  background-image:
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* \u767B\u5F55\u5361\u7247\uFF1Alogo \u663E\u793A\u5728"\u6587\u4EF6\u7BA1\u7406\u5668"\u6807\u9898\u4E0A\u65B9\uFF0C\u6309\u539F\u59CB\u6BD4\u4F8B\uFF082000\xD7857\uFF0C\u900F\u660E\u80CC\u666F PNG\uFF09\u81EA\u52A8\u7F29\u653E */
html.hatsune-miku .login-header::before {
  content: '';
  display: block;
  width: 240px;
  aspect-ratio: 2000 / 857;
  margin: 0 auto 14px;
  background-color: transparent;
  background-image: url('__MIKU_LOGO_URL__');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
`;

// src/page.css
var page_default = "/* \u521D\u97F3\u672A\u6765\u4E3B\u9898\u63D2\u4EF6\u4E3B\u9875\u6837\u5F0F\uFF08\u8DDF\u968F\u5F53\u524D\u4E3B\u9898\u53D8\u91CF\uFF0C\u4EFB\u4F55\u4E3B\u9898\u4E0B\u5747\u53EF\u6E32\u67D3\uFF09\u3002 */\n.miku-bg-container {\n  height: 100vh;\n  box-sizing: border-box;\n  display: flex;\n  align-items: flex-start;\n  justify-content: center;\n  padding: 60px 0;\n}\n.miku-bg-card {\n  width: 760px;\n  max-height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  background: var(--app-panel);\n  border: 1px solid var(--app-border);\n  border-radius: 12px;\n  box-shadow: var(--app-glow), var(--app-shadow);\n  backdrop-filter: var(--app-blur);\n}\n.miku-bg-card-header {\n  flex-shrink: 0;\n  padding: 10px 0 0 10px;\n}\n.miku-bg-card-body {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  padding: 20px 36px;\n}\n.miku-bg-card .back-btn {\n  color: var(--app-text-dim);\n  padding: 4px 8px;\n}\n.miku-bg-title {\n  margin: 0;\n  font-size: 20px;\n  color: var(--app-text-bright);\n}\n.miku-bg-header {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-bottom: 4px;\n}\n.miku-bg-sub {\n  font-size: 13px;\n  color: var(--app-text-dim);\n  margin: 4px 0 0;\n}\n.miku-bg-divider {\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--app-text-bright);\n}\n.miku-bg-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));\n  gap: 12px;\n  margin-top: 12px;\n}\n.miku-bg-item {\n  border: 2px solid var(--app-border);\n  border-radius: 8px;\n  overflow: hidden;\n  cursor: pointer;\n  background: var(--app-bg);\n  transition:\n    border-color 0.2s,\n    box-shadow 0.2s;\n}\n.miku-bg-item:hover {\n  border-color: var(--app-accent);\n}\n.miku-bg-item.active {\n  border-color: var(--app-accent);\n  box-shadow: var(--app-glow);\n}\n.miku-bg-thumb {\n  width: 100%;\n  height: 120px;\n  object-fit: cover;\n  display: block;\n}\n.miku-bg-name {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 4px;\n  font-size: 12px;\n  color: var(--app-text-dim);\n  padding: 4px 8px;\n}\n.miku-bg-name span {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.miku-bg-item.active .miku-bg-name {\n  color: var(--app-accent);\n}\n.miku-bg-upload {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 12px;\n}\n.miku-bg-upload-tip {\n  font-size: 12px;\n  color: var(--app-text-dim);\n}\n.miku-config-row {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 12px;\n}\n.miku-config-label {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 13px;\n  color: var(--app-text);\n}\n.miku-config-value {\n  color: var(--app-accent);\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n}\n.miku-config-slider {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n.miku-config-slider .el-slider {\n  flex: 1;\n}\n.miku-config-save {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-top: 16px;\n}\n.miku-tag-preview {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  margin-top: 12px;\n}\n.miku-message-preview {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  margin-top: 12px;\n}\n";

// src/backgrounds.ts
var API_BASE = true ? "/file-manager/plugins/hatsune-miku-theme/assets" : "/api/hatsune-miku-theme";
var LOGO_URL = true ? "/file-manager/plugins/hatsune-miku-theme/assets/logo.png" : `${API_BASE}/logo`;
var STORAGE_KEY_BG = "hatsune-miku-theme-bg";
var BUILTIN_BG_FILES = ["f3DwR01P.png", "o_1dmto233h1ap1grj1kn511qn1oim1o.jpg"];
var DEFAULT_BG_ID = BUILTIN_BG_FILES[0];
function builtinFallback() {
  return BUILTIN_BG_FILES.map((f) => ({
    id: f,
    label: f,
    url: `${API_BASE}/bg/${f}`,
    builtin: true
  }));
}
function findBackground(bgs, id) {
  return bgs.find((b) => b.id === id) ?? bgs[0];
}
function currentBackgroundId(bgs) {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY_BG);
  } catch {
  }
  return findBackground(bgs, stored).id;
}
function applyBackground(id, bgs) {
  const bg = findBackground(bgs, id);
  try {
    localStorage.setItem(STORAGE_KEY_BG, bg.id);
  } catch {
  }
  if (bg.id === DEFAULT_BG_ID) {
    document.documentElement.style.removeProperty("--miku-bg");
  } else {
    document.documentElement.style.setProperty("--miku-bg", `url('${bg.url}')`);
  }
}

// src/panel-settings.ts
var STORAGE_KEY_PANEL_OPACITY = "hatsune-miku-theme-panel-opacity";
var DEFAULT_PANEL_OPACITY = 10;
var STORAGE_KEY_PANEL_BLUR = "hatsune-miku-theme-panel-blur";
var DEFAULT_PANEL_BLUR = 0;
function currentPanelOpacity() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_OPACITY);
  } catch {
  }
  const n = stored === null ? Number.NaN : Number(stored);
  if (Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.round(n)));
  }
  return DEFAULT_PANEL_OPACITY;
}
var PANEL_SETTINGS_STYLE_ID = "hatsune-miku-panel-settings";
function previewPanelSettings(opacity, blur) {
  const o = Math.min(100, Math.max(0, Math.round(opacity)));
  const b = Math.min(30, Math.max(0, Math.round(blur)));
  const decls = [];
  if (o !== DEFAULT_PANEL_OPACITY) decls.push(`--app-panel-opacity: ${o}%`);
  if (b !== DEFAULT_PANEL_BLUR) decls.push(`--app-blur: blur(${b}px)`);
  let style = document.getElementById(PANEL_SETTINGS_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = PANEL_SETTINGS_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = decls.length > 0 ? `html.hatsune-miku { ${decls.join("; ")} }` : "";
}
function savePanelOpacity(opacity) {
  const value = Math.min(100, Math.max(0, Math.round(opacity)));
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_OPACITY, String(value));
  } catch {
  }
}
function currentPanelBlur() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_BLUR);
  } catch {
  }
  const n = stored === null ? Number.NaN : Number(stored);
  if (Number.isFinite(n)) {
    return Math.min(30, Math.max(0, Math.round(n)));
  }
  return DEFAULT_PANEL_BLUR;
}
function savePanelBlur(px) {
  const value = Math.min(30, Math.max(0, Math.round(px)));
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_BLUR, String(value));
  } catch {
  }
}

// src/tooltip-fixed-background.ts
function setupTooltipFixedBackground() {
  const observers = /* @__PURE__ */ new WeakMap();
  const activeObservers = /* @__PURE__ */ new Set();
  const sync = (el) => {
    const t = el.style.transform;
    if (!t) return;
    const rect = el.getBoundingClientRect();
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.right = "";
    el.style.bottom = "";
    el.style.transform = "";
  };
  const attach = (el) => {
    if (observers.has(el)) return;
    const node = el;
    sync(node);
    const observer = new MutationObserver(() => sync(node));
    observer.observe(node, { attributes: true, attributeFilter: ["style"] });
    observers.set(el, observer);
    activeObservers.add(observer);
  };
  const detach = (el) => {
    const observer = observers.get(el);
    observer?.disconnect();
    if (observer) activeObservers.delete(observer);
    observers.delete(el);
  };
  const scan = (root) => {
    root.querySelectorAll(".el-tooltip.el-popper").forEach((el) => attach(el));
  };
  const rootObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.classList.contains("el-tooltip") && node.classList.contains("el-popper")) {
          attach(node);
        }
        scan(node);
      }
      for (const node of Array.from(mutation.removedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.classList.contains("el-tooltip") && node.classList.contains("el-popper")) {
          detach(node);
        }
        node.querySelectorAll(".el-tooltip.el-popper").forEach((el) => detach(el));
      }
    }
  });
  activeObservers.add(rootObserver);
  rootObserver.observe(document.body, { childList: true, subtree: true });
  scan(document.body);
  return () => {
    for (const observer of activeObservers) {
      observer.disconnect();
    }
    activeObservers.clear();
  };
}

// src/background-view.ts
function createBackgroundView(ctx, deps) {
  const { h, ref, defineComponent, onUnmounted } = ctx.Vue;
  const { ElButton, ElDivider, ElMessage, ElMessageBox, ElSlider, ElTag } = ctx.ElementPlus;
  const { backgrounds, refreshBackgrounds } = deps;
  return defineComponent({
    name: "HatsuneMikuThemeView",
    setup() {
      const selectedId = ref(currentBackgroundId(backgrounds.value));
      const uploading = ref(false);
      const fileInputRef = ref(null);
      const panelOpacity = ref(currentPanelOpacity());
      const panelBlur = ref(currentPanelBlur());
      const savedOpacity = ref(panelOpacity.value);
      const savedBlur = ref(panelBlur.value);
      function select(id) {
        applyBackground(id, backgrounds.value);
        selectedId.value = id;
        ElMessage.success("\u80CC\u666F\u56FE\u5DF2\u5207\u6362");
      }
      async function handleFileChange(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        uploading.value = true;
        try {
          const res = await ctx.api.instance.post("/hatsune-miku-theme/backgrounds", formData);
          const uploaded = res.data;
          ElMessage.success("\u80CC\u666F\u56FE\u5DF2\u4E0A\u4F20");
          await refreshBackgrounds();
          if (uploaded?.id) {
            applyBackground(uploaded.id, backgrounds.value);
            selectedId.value = uploaded.id;
          }
        } catch (err) {
          const msg = err && typeof err === "object" && "response" in err ? err.response?.data?.error ?? "\u4E0A\u4F20\u5931\u8D25" : "\u4E0A\u4F20\u5931\u8D25";
          ElMessage.error(msg);
        } finally {
          uploading.value = false;
        }
      }
      async function confirmDelete(bg) {
        try {
          await ElMessageBox.confirm(`\u786E\u5B9A\u5220\u9664\u80CC\u666F\u56FE "${bg.label}" \u5417\uFF1F`, "\u5220\u9664\u786E\u8BA4", {
            confirmButtonText: "\u5220\u9664",
            cancelButtonText: "\u53D6\u6D88",
            type: "warning"
          });
        } catch {
          return;
        }
        try {
          await ctx.api.instance.delete(
            `/hatsune-miku-theme/backgrounds/${encodeURIComponent(bg.id)}`
          );
          ElMessage.success("\u80CC\u666F\u56FE\u5DF2\u5220\u9664");
          if (selectedId.value === bg.id) {
            applyBackground(DEFAULT_BG_ID, backgrounds.value);
            selectedId.value = DEFAULT_BG_ID;
          }
          await refreshBackgrounds();
        } catch {
          ElMessage.error("\u5220\u9664\u5931\u8D25");
        }
      }
      function savePanelSettings() {
        savePanelOpacity(panelOpacity.value);
        savePanelBlur(panelBlur.value);
        savedOpacity.value = panelOpacity.value;
        savedBlur.value = panelBlur.value;
        ElMessage.success("\u9762\u677F\u6548\u679C\u5DF2\u4FDD\u5B58");
      }
      onUnmounted(() => {
        previewPanelSettings(savedOpacity.value, savedBlur.value);
      });
      return () => {
        const children = [];
        children.push(
          h("div", { class: "miku-bg-card-header" }, [
            h(
              ElButton,
              { text: true, class: "back-btn", onClick: () => window.history.back() },
              () => "\u2190 \u8FD4\u56DE"
            )
          ])
        );
        const m = [];
        m.push(
          h("div", { class: "miku-bg-header" }, [
            h("h3", { class: "miku-bg-title" }, "\u521D\u97F3\u672A\u6765\u4E3B\u9898")
          ])
        );
        m.push(
          h(
            "p",
            { class: "miku-bg-sub" },
            "\u9009\u62E9\u4E3B\u754C\u9762\u80CC\u666F\u56FE\uFF0C\u5207\u6362\u540E\u7ACB\u5373\u751F\u6548\u5E76\u81EA\u52A8\u4FDD\u5B58\u3002\u53EF\u4E0A\u4F20\u81EA\u5B9A\u4E49\u80CC\u666F\u56FE\u3002"
          )
        );
        m.push(
          h(
            ElDivider,
            { contentPosition: "left" },
            () => h("span", { class: "miku-bg-divider" }, "\u80CC\u666F\u56FE")
          )
        );
        const items = backgrounds.value.map((bg) => {
          const active = bg.id === selectedId.value;
          const name = h("div", { class: "miku-bg-name" }, [
            h("span", bg.label),
            bg.builtin ? null : h(
              ElButton,
              {
                size: "small",
                text: true,
                type: "danger",
                onClick: (e) => {
                  e.stopPropagation();
                  confirmDelete(bg);
                }
              },
              () => "\u5220\u9664"
            )
          ]);
          return h(
            "div",
            {
              class: ["miku-bg-item", active ? "active" : ""],
              onClick: () => select(bg.id)
            },
            [
              h("img", { class: "miku-bg-thumb", src: bg.url, alt: bg.label, loading: "lazy" }),
              name
            ]
          );
        });
        m.push(h("div", { class: "miku-bg-grid" }, items));
        m.push(
          h("div", { class: "miku-bg-upload" }, [
            h("input", {
              ref: fileInputRef,
              type: "file",
              accept: "image/*",
              style: { display: "none" },
              onChange: handleFileChange
            }),
            h(
              ElButton,
              {
                type: "primary",
                loading: uploading.value,
                onClick: () => fileInputRef.value?.click()
              },
              () => "\u4E0A\u4F20\u80CC\u666F\u56FE"
            ),
            h("span", { class: "miku-bg-upload-tip" }, "\u652F\u6301 png / jpg / webp / gif\uFF0C\u6700\u5927 10MB")
          ])
        );
        const hasChanges = panelOpacity.value !== savedOpacity.value || panelBlur.value !== savedBlur.value;
        m.push(
          h(
            ElDivider,
            { contentPosition: "left" },
            () => h("span", { class: "miku-bg-divider" }, "\u9762\u677F\u6548\u679C")
          )
        );
        m.push(
          h("div", { class: "miku-config-row" }, [
            h("div", { class: "miku-config-label" }, [
              h("span", "\u9762\u677F\u9ED1\u8272\u534A\u900F\u660E\u7A0B\u5EA6"),
              h("span", { class: "miku-config-value" }, `${panelOpacity.value}%`)
            ]),
            h("div", { class: "miku-config-slider" }, [
              h(ElSlider, {
                min: 0,
                max: 100,
                modelValue: panelOpacity.value,
                "onUpdate:modelValue": (v) => {
                  const value = Array.isArray(v) ? v[0] : v;
                  panelOpacity.value = value;
                  previewPanelSettings(value, panelBlur.value);
                }
              }),
              h(
                ElButton,
                {
                  size: "small",
                  text: true,
                  disabled: panelOpacity.value === DEFAULT_PANEL_OPACITY,
                  onClick: () => {
                    panelOpacity.value = DEFAULT_PANEL_OPACITY;
                    previewPanelSettings(DEFAULT_PANEL_OPACITY, panelBlur.value);
                  }
                },
                () => "\u91CD\u7F6E\u9ED8\u8BA4"
              )
            ]),
            h(
              "p",
              { class: "miku-bg-upload-tip" },
              "\u6570\u503C\u8D8A\u5927\u9762\u677F\u8D8A\u4E0D\u900F\u660E\uFF0C\u9ED8\u8BA4 10%\uFF0C\u62D6\u52A8\u5B9E\u65F6\u9884\u89C8\uFF0C\u70B9\u51FB\u4E0B\u65B9\u300C\u4FDD\u5B58\u9762\u677F\u6548\u679C\u300D\u540E\u751F\u6548\u3002"
            )
          ])
        );
        m.push(
          h("div", { class: "miku-config-row" }, [
            h("div", { class: "miku-config-label" }, [
              h("span", "\u9762\u677F\u80CC\u666F\u6A21\u7CCA\u5EA6"),
              h(
                "span",
                { class: "miku-config-value" },
                panelBlur.value === 0 ? "\u65E0\u6A21\u7CCA" : `${panelBlur.value}px`
              )
            ]),
            h("div", { class: "miku-config-slider" }, [
              h(ElSlider, {
                min: 0,
                max: 30,
                modelValue: panelBlur.value,
                "onUpdate:modelValue": (v) => {
                  const value = Array.isArray(v) ? v[0] : v;
                  panelBlur.value = value;
                  previewPanelSettings(panelOpacity.value, value);
                }
              }),
              h(
                ElButton,
                {
                  size: "small",
                  text: true,
                  disabled: panelBlur.value === DEFAULT_PANEL_BLUR,
                  onClick: () => {
                    panelBlur.value = DEFAULT_PANEL_BLUR;
                    previewPanelSettings(panelOpacity.value, DEFAULT_PANEL_BLUR);
                  }
                },
                () => "\u91CD\u7F6E\u9ED8\u8BA4"
              )
            ]),
            h(
              "p",
              { class: "miku-bg-upload-tip" },
              "\u6570\u503C\u8D8A\u5927\u80CC\u666F\u8D8A\u6A21\u7CCA\uFF0C\u9ED8\u8BA4 0px\uFF0C\u62D6\u52A8\u5B9E\u65F6\u9884\u89C8\uFF0C\u70B9\u51FB\u4E0B\u65B9\u300C\u4FDD\u5B58\u9762\u677F\u6548\u679C\u300D\u540E\u751F\u6548\u3002"
            )
          ])
        );
        m.push(
          h("div", { class: "miku-config-save" }, [
            h(
              ElButton,
              {
                type: "primary",
                disabled: !hasChanges,
                onClick: savePanelSettings
              },
              () => "\u4FDD\u5B58\u9762\u677F\u6548\u679C"
            ),
            h(
              "span",
              { class: "miku-bg-upload-tip" },
              hasChanges ? "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u70B9\u51FB\u4FDD\u5B58\u540E\u771F\u6B63\u751F\u6548" : "\u5F53\u524D\u5DF2\u4FDD\u5B58\uFF0C\u65E0\u672A\u4FDD\u5B58\u4FEE\u6539"
            )
          ])
        );
        m.push(
          h(
            ElDivider,
            { contentPosition: "left" },
            () => h("span", { class: "miku-bg-divider" }, "\u6807\u7B7E\u9884\u89C8")
          )
        );
        m.push(
          h("div", { class: "miku-tag-preview" }, [
            h(ElTag, { type: "primary" }, () => "primary"),
            h(ElTag, { type: "success" }, () => "success"),
            h(ElTag, { type: "info" }, () => "info"),
            h(ElTag, { type: "warning" }, () => "warning"),
            h(ElTag, { type: "danger" }, () => "danger")
          ])
        );
        m.push(
          h(
            ElDivider,
            { contentPosition: "left" },
            () => h("span", { class: "miku-bg-divider" }, "\u6D88\u606F\u9884\u89C8")
          )
        );
        m.push(
          h("div", { class: "miku-message-preview" }, [
            h(
              ElButton,
              {
                size: "small",
                type: "primary",
                onClick: () => ElMessage({ type: "primary", message: "primary \u6D88\u606F" })
              },
              () => "primary"
            ),
            h(
              ElButton,
              { size: "small", type: "success", onClick: () => ElMessage.success("success \u6D88\u606F") },
              () => "success"
            ),
            h(
              ElButton,
              { size: "small", type: "info", onClick: () => ElMessage.info("info \u6D88\u606F") },
              () => "info"
            ),
            h(
              ElButton,
              { size: "small", type: "warning", onClick: () => ElMessage.warning("warning \u6D88\u606F") },
              () => "warning"
            ),
            h(
              ElButton,
              { size: "small", type: "danger", onClick: () => ElMessage.error("error \u6D88\u606F") },
              () => "error"
            )
          ])
        );
        children.push(h("div", { class: "miku-bg-card-body" }, m));
        return h("div", { class: "miku-bg-container" }, [
          h("div", { class: "miku-bg-card" }, children)
        ]);
      };
    }
  });
}

// src/frontend.ts
var THEME_CSS = theme_default.replace(/__MIKU_DEFAULT_BG_URL__/g, `${API_BASE}/bg/${DEFAULT_BG_ID}`).replace(/__MIKU_LOGO_URL__/g, LOGO_URL);
var PAGE_STYLE_ID = "hatsune-miku-theme-page-styles";
function injectPageStyles() {
  if (document.getElementById(PAGE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PAGE_STYLE_ID;
  style.textContent = page_default;
  document.head.appendChild(style);
}
var install = async (ctx) => {
  const { ref } = ctx.Vue;
  ctx.composables.useTheme().registerTheme({
    name: "hatsune-miku",
    label: "\u521D\u97F3\u672A\u6765",
    className: "hatsune-miku",
    css: THEME_CSS
  });
  injectPageStyles();
  const teardownTooltip = setupTooltipFixedBackground();
  const backgrounds = ref(builtinFallback());
  async function refreshBackgrounds() {
    try {
      const res = await ctx.api.instance.get("/hatsune-miku-theme/backgrounds");
      const list = res.data?.backgrounds;
      if (Array.isArray(list) && list.length > 0) {
        backgrounds.value = list;
      }
    } catch {
    }
  }
  await refreshBackgrounds();
  applyBackground(currentBackgroundId(backgrounds.value), backgrounds.value);
  previewPanelSettings(currentPanelOpacity(), currentPanelBlur());
  const BackgroundView = createBackgroundView(ctx, { backgrounds, refreshBackgrounds });
  ctx.router.addRoute({
    path: "/plugin/hatsune-miku-theme",
    component: BackgroundView,
    meta: { requiresAuth: true }
  });
  console.log(
    '[Hatsune Miku Theme] Frontend loaded \u2014 theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme'
  );
  return () => {
    document.getElementById(PAGE_STYLE_ID)?.remove();
    teardownTooltip();
  };
};
export {
  install
};
