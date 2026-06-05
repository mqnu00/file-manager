declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

import * as THREE from 'three'

declare global {
  interface Window {
    THREE: typeof THREE
  }
}
