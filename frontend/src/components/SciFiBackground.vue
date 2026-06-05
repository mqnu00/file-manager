<template>
  <canvas ref="canvasRef" class="sci-fi-bg"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type * as ThreeType from 'three'

const THREE = window.THREE

const canvasRef = ref<HTMLCanvasElement>()
let animationId: number = 0
let scene: ThreeType.Scene
let camera: ThreeType.PerspectiveCamera
let renderer: ThreeType.WebGLRenderer
let starField: ThreeType.Points
let grid: ThreeType.Group
let orbs: ThreeType.Mesh<ThreeType.SphereGeometry, ThreeType.MeshBasicMaterial>[]

const ORB_COUNT = 5

onMounted(() => {
  const canvas = canvasRef.value!
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(devicePixelRatio)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 2.5, 8)
  camera.lookAt(0, 2.5, -3)

  createStarField()
  createGrid()
  createOrbs()
  createLightBeams()

  window.addEventListener('resize', onResize)
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  renderer.dispose()
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
})

function createStarField() {
  const geometry = new THREE.BufferGeometry()
  const count = 1200
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * 30
    positions[i3 + 1] = (Math.random() - 0.5) * 20
    positions[i3 + 2] = -Math.random() * 15 - 2

    const colorChoice = Math.random()
    if (colorChoice < 0.3) {
      colors[i3] = 0.0; colors[i3 + 1] = 0.94; colors[i3 + 2] = 1.0   // cyan
    } else if (colorChoice < 0.5) {
      colors[i3] = 1.0; colors[i3 + 1] = 0.0; colors[i3 + 2] = 1.0    // magenta
    } else if (colorChoice < 0.65) {
      colors[i3] = 0.3; colors[i3 + 1] = 0.5; colors[i3 + 2] = 1.0    // blue
    } else {
      colors[i3] = 0.9; colors[i3 + 1] = 0.9; colors[i3 + 2] = 1.0    // white
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8
  })

  starField = new THREE.Points(geometry, material)
  scene.add(starField)
}

function createGrid() {
  grid = new THREE.Group()

  const gridHelper = new THREE.PolarGridHelper(12, 40, 20, 256, 0x00f0ff, 0x00f0ff)
  gridHelper.position.z = -6
  gridHelper.rotation.x = -Math.PI / 2
  gridHelper.children.forEach(child => {
    if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
      const mat = child.material as ThreeType.LineBasicMaterial
      mat.transparent = true
      mat.opacity = 0.15
      mat.blending = THREE.AdditiveBlending
      mat.depthWrite = false
    }
  })
  grid.add(gridHelper)

  scene.add(grid)
}

function createOrbs() {
  orbs = []
  const orbGeometry = new THREE.SphereGeometry(0.08, 16, 16)

  for (let i = 0; i < ORB_COUNT; i++) {
    const hue = i < ORB_COUNT / 2 ? 0x00f0ff : 0xff00ff
    const material = new THREE.MeshBasicMaterial({
      color: hue,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const orb = new THREE.Mesh(orbGeometry, material)

    orb.position.x = (Math.random() - 0.5) * 6
    orb.position.y = (Math.random() - 0.5) * 3
    orb.position.z = -Math.random() * 4 - 2

    orb.userData = {
      speedX: (Math.random() - 0.5) * 0.004,
      speedY: (Math.random() - 0.5) * 0.003,
      speedZ: (Math.random() - 0.5) * 0.002,
      amplitude: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2
    }

    scene.add(orb)
    orbs.push(orb)
  }
}

function createLightBeams() {
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.CylinderGeometry(0.01, 0.01, 10, 8)
    const material = new THREE.MeshBasicMaterial({
      color: i === 0 ? 0x00f0ff : i === 1 ? 0xff00ff : 0x3355ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const beam = new THREE.Mesh(geometry, material)
    beam.position.x = (i - 1) * 3
    beam.position.y = 5
    beam.position.z = -3
    beam.userData = { index: i }
    scene.add(beam)
  }
}

let time = 0
function animate() {
  animationId = requestAnimationFrame(animate)
  time += 0.005

  starField.rotation.y += 0.0001
  starField.rotation.x += 0.00005
  starField.position.z += 0.003
  if (starField.position.z > 10) starField.position.z = -5

  grid.rotation.z += 0.0003

  for (const orb of orbs) {
    orb.position.x += orb.userData.speedX
    orb.position.y += Math.sin(time * 2 + orb.userData.phase) * orb.userData.amplitude * 0.003
    orb.position.z += orb.userData.speedZ
    if (orb.position.x > 4) orb.userData.speedX = -Math.abs(orb.userData.speedX)
    if (orb.position.x < -4) orb.userData.speedX = Math.abs(orb.userData.speedX)
    if (orb.position.z > 2) orb.userData.speedZ = -Math.abs(orb.userData.speedZ)
    if (orb.position.z < -6) orb.userData.speedZ = Math.abs(orb.userData.speedZ)
  }

  scene.children.forEach((child) => {
    if (child.userData && child.userData.index !== undefined) {
      const beam = child as ThreeType.Mesh
      const mat = beam.material as ThreeType.MeshBasicMaterial
      beam.rotation.z += 0.002 + child.userData.index * 0.001
      mat.opacity = 0.05 + Math.sin(time * 1.5 + child.userData.index) * 0.03
    }
  })

  renderer.render(scene, camera)
}

function onResize() {
  const canvas = canvasRef.value!
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
</script>

<style scoped>
.sci-fi-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>