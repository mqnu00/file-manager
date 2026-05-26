import { ref, watch } from 'vue'

const CYBER_CLASS = 'cyber'
const STORAGE_KEY = 'file-manager-theme'

const isCyber = ref(loadPreference())

function loadPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'cyber'
  } catch {}
  return true
}

function applyClass(cyber: boolean) {
  if (cyber) {
    document.documentElement.classList.add(CYBER_CLASS)
  } else {
    document.documentElement.classList.remove(CYBER_CLASS)
  }
}

export function useTheme() {
  watch(isCyber, (val) => {
    applyClass(val)
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'cyber' : 'light')
    } catch {}
  }, { immediate: true })

  function toggle() {
    isCyber.value = !isCyber.value
  }

  return { isCyber, toggle }
}