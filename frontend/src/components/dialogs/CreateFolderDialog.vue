<template>
  <el-dialog
    :model-value="modelValue"
    title="新建文件夹"
    width="300px"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <el-input
      :model-value="folderName"
      placeholder="请输入文件夹名称"
      @update:model-value="$emit('update:folder-name', $event)"
      @keyup.enter="$emit('confirm')"
    />
    <template #footer>
      <el-button @click="$emit('update:model-value', false)">取消</el-button>
      <el-button type="primary" @click="$emit('confirm')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  folderName: string
}>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:folder-name': [value: string]
  confirm: []
}>()
</script>
