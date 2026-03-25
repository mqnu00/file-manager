const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 启动开发模式...')

// 启动后端
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..', 'backend'),
  stdio: 'inherit',
  shell: true
})

// 等待后端启动后再启动前端
setTimeout(() => {
  console.log('🎨 启动前端...')
  
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit',
    shell: true
  })

  frontend.on('error', (err) => {
    console.error('前端启动失败:', err)
  })
}, 1000)

backend.on('error', (err) => {
  console.error('后端启动失败:', err)
})

// 处理进程退出
process.on('SIGINT', () => {
  backend.kill()
  process.exit()
})
