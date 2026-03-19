const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const versionType = args[0] || 'patch' // patch, minor, major

const packageJsonPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

const [major, minor, patch] = pkg.version.split('.').map(Number)

let newVersion
switch (versionType) {
  case 'major':
    newVersion = `${major + 1}.0.0`
    break
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`
    break
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`
    break
}

pkg.version = newVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2))

console.log(`📦 版本已更新到 v${newVersion}`)

// 生成 changelog
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')
const date = new Date().toISOString().split('T')[0]

let changelog = ''
if (fs.existsSync(changelogPath)) {
  changelog = fs.readFileSync(changelogPath, 'utf-8')
}

const newEntry = `## v${newVersion} (${date})\n\n- 更新\n\n${changelog}`
fs.writeFileSync(changelogPath, newEntry)

console.log('📝 CHANGELOG.md 已更新')

// Git 操作
try {
  execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' })
  execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit' })
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' })
  console.log('✅ Git 提交和标签已创建')
} catch (e) {
  console.log('⚠️  Git 操作跳过（可能不在 git 仓库中）')
}

console.log(`\n🎉 发布完成！v${newVersion}`)
