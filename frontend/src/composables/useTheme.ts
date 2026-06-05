import { ref, watch } from 'vue'
import {
  STORAGE_KEY_THEME,
  THEME_CLASS_CYBER,
  THEME_VALUE_CYBER,
  THEME_VALUE_LIGHT,
} from '@/constants'

const isCyber = ref(loadPreference())

function loadPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME)
    if (stored !== null) return stored === THEME_VALUE_CYBER
  } catch {
    // localStorage not available, use default
  }
  return true
}

function applyClass(cyber: boolean) {
  if (cyber) {
    document.documentElement.classList.add(THEME_CLASS_CYBER)
  } else {
    document.documentElement.classList.remove(THEME_CLASS_CYBER)
  }
}

export function useTheme() {
  watch(
    isCyber,
    (val) => {
      applyClass(val)
      try {
        localStorage.setItem(STORAGE_KEY_THEME, val ? THEME_VALUE_CYBER : THEME_VALUE_LIGHT)
      } catch {
        // localStorage not available, skip persisting
      }
    },
    { immediate: true }
  )

  function toggle() {
    isCyber.value = !isCyber.value
  }

  return { isCyber, toggle }
}
