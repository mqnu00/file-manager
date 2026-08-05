<template>
  <el-select
    v-model="selected"
    class="version-select"
    filterable
    allow-create
    placeholder="版本"
    :loading="loading"
    @visible-change="(visible: boolean) => visible && loadVersions()"
  >
    <el-option
      v-for="v in versions"
      :key="v"
      :label="v === latest ? `v${v}（最新）` : `v${v}`"
      :value="v"
    />
  </el-select>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getPluginVersions } from '@/api/plugins'

const props = defineProps<{
  packageName: string
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const selected = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const versions = ref<string[]>([])
const latest = ref('')
const loading = ref(false)

/** 页面级缓存：同一包只请求一次版本列表 */
const versionsCache = new Map<string, string[]>()

async function loadVersions() {
  const cached = versionsCache.get(props.packageName)
  if (cached) {
    versions.value = cached
    return
  }
  loading.value = true
  try {
    const data = await getPluginVersions(props.packageName)
    versionsCache.set(props.packageName, data.versions)
    versions.value = data.versions
    latest.value = data.latest
  } catch {
    ElMessage.warning(`获取 "${props.packageName}" 版本列表失败，可手动输入版本`)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.version-select {
  width: 90px;
}
</style>
