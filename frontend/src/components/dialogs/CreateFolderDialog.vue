<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    title="新建文件夹"
    width="300px"
  >
    <el-input
      :model-value="folderName"
      @update:model-value="$emit('update:folder-name', $event)"
      placeholder="请输入文件夹名称"
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
