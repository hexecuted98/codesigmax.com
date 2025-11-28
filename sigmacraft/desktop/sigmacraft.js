import * as THREE from 'three';
import {
    PointerLockControls
} from 'three/addons/controls/PointerLockControls.js';
const textureLoader = new THREE.TextureLoader();
const textures = {
    grass_top: textureLoader.load('textures/grass_block_top.png'),
    grass_side: textureLoader.load('textures/grass_block_side.png'),
    grass_bottom: textureLoader.load('textures/grass_block_bottom.png'),
    dirt: textureLoader.load('textures/dirt.png'),
    stone: textureLoader.load('textures/stone.png'),
    wood: textureLoader.load('textures/wood.png'),
    leaf: textureLoader.load('textures/leaf.png'),
    bedrock: textureLoader.load('textures/stone.png')
};
Object.values(textures).forEach(texture => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
});
const materials = {
    grass: [new THREE.MeshLambertMaterial({
        map: textures.grass_side
    }), new THREE.MeshLambertMaterial({
        map: textures.grass_side
    }), new THREE.MeshLambertMaterial({
        map: textures.grass_top
    }), new THREE.MeshLambertMaterial({
        map: textures.grass_bottom
    }), new THREE.MeshLambertMaterial({
        map: textures.grass_side
    }), new THREE.MeshLambertMaterial({
        map: textures.grass_side
    })],
    dirt: new THREE.MeshLambertMaterial({
        map: textures.dirt
    }),
    stone: new THREE.MeshLambertMaterial({
        map: textures.stone
    }),
    wood: new THREE.MeshLambertMaterial({
        map: textures.wood
    }),
    leaf: new THREE.MeshLambertMaterial({
        map: textures.leaf,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    }),
    bedrock: new THREE.MeshLambertMaterial({
        map: textures.stone
    })
};
const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAF: 5,
    BEDROCK: 6
};
class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map();
        this.worldSize = 32;
        this.chunkSize = 16;
        this.chunks = new Map();
        this.renderDistance = 2;
        this.playerChunkX = 0;
        this.playerChunkZ = 0;
        this.geometryPool = new Map();
        this.initGeometryPool();
    }
    initGeometryPool() {
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        boxGeometry.computeBoundingSphere();
        this.geometryPool.set('box', boxGeometry);
    }
    getKey(x, y, z) {
        return `${x},${y},${z}`;
    }
    getChunkKey(x, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        return `${chunkX},${chunkZ}`;
    }
    updatePlayerPosition(playerX, playerZ) {
        const newChunkX = Math.floor(playerX / this.chunkSize);
        const newChunkZ = Math.floor(playerZ / this.chunkSize);
        if (newChunkX !== this.playerChunkX || newChunkZ !== this.playerChunkZ) {
            this.playerChunkX = newChunkX;
            this.playerChunkZ = newChunkZ;
            this.updateVisibleChunks();
        }
    }
    updateVisibleChunks() {
        const visibleChunks = new Set();
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const chunkX = this.playerChunkX + x;
                const chunkZ = this.playerChunkZ + z;
                const chunkKey = `${chunkX},${chunkZ}`;
                visibleChunks.add(chunkKey);
                if (!this.chunks.has(chunkKey)) {
                    this.generateChunk(chunkX, chunkZ);
                }
            }
        }
        this.cleanupDistantChunks(visibleChunks);
    }
    cleanupDistantChunks(visibleChunks) {
        const blocksToRemove = [];
        for (let [key, mesh] of this.blocks) {
            const [x, y, z] = key.split(',').map(Number);
            const chunkKey = this.getChunkKey(x, z);
            if (!visibleChunks.has(chunkKey)) {
                blocksToRemove.push({
                    key,
                    mesh
                });
            }
        }
        blocksToRemove.forEach(({
            key,
            mesh
        }) => {
            this.scene.remove(mesh);
            this.blocks.delete(key);
        });
        for (let [chunkKey] of this.chunks) {
            if (!visibleChunks.has(chunkKey)) {
                this.chunks.delete(chunkKey);
            }
        }
    }
    generateChunk(chunkX, chunkZ) {
        const startX = chunkX * this.chunkSize;
        const startZ = chunkZ * this.chunkSize;
        const endX = startX + this.chunkSize;
        const endZ = startZ + this.chunkSize;
        const chunkBlocks = [];
        for (let x = startX; x < endX; x++) {
            for (let z = startZ; z < endZ; z++) {
                let h = Math.floor(Math.sin(x / 7) * 3 + Math.cos(z / 10) * 3) + 2;
                this.addBlockToChunk(x, h, z, BLOCK.GRASS, chunkBlocks);
                for (let d = 1; d <= 3; d++) {
                    this.addBlockToChunk(x, h - d, z, BLOCK.DIRT, chunkBlocks);
                }
                this.addBlockToChunk(x, h - 4, z, BLOCK.STONE, chunkBlocks);
                if (Math.abs(chunkX) <= 1 && Math.abs(chunkZ) <= 1) {
                    this.addBlockToChunk(x, -10, z, BLOCK.BEDROCK, chunkBlocks);
                }
            }
        }
        if (Math.abs(chunkX) <= 1 && Math.abs(chunkZ) <= 1) {
            const getTerrainHeight = (x, z) => {
                return Math.floor(Math.sin(x / 7) * 3 + Math.cos(z / 10) * 3) + 2;
            };
            const tree1X = startX + 5;
            const tree1Z = startZ + 5;
            const tree1Y = getTerrainHeight(tree1X, tree1Z) + 1;
            const tree2X = startX - 5;
            const tree2Z = startZ - 5;
            const tree2Y = getTerrainHeight(tree2X, tree2Z) + 1;
            const tree3X = startX + 8;
            const tree3Z = startZ - 8;
            const tree3Y = getTerrainHeight(tree3X, tree3Z) + 1;
            this.createTree(tree1X, tree1Y, tree1Z, chunkBlocks);
            this.createTree(tree2X, tree2Y, tree2Z, chunkBlocks);
            this.createTree(tree3X, tree3Y, tree3Z, chunkBlocks);
        }
        this.finalizeChunk(chunkX, chunkZ, chunkBlocks);
    }
    setRenderDistance(distance) {
        this.renderDistance = Math.max(1, Math.min(8, distance));
        this.updateVisibleChunks();
        const renderDistanceValue = document.getElementById('render-distance-value');
        if (renderDistanceValue) {
            renderDistanceValue.textContent = this.renderDistance;
        }
    }
    addBlockToChunk(x, y, z, type, chunkBlocks) {
        const key = this.getKey(x, y, z);
        if (!this.blocks.has(key)) {
            chunkBlocks.push({
                x,
                y,
                z,
                type
            });
        }
    }
    finalizeChunk(chunkX, chunkZ, chunkBlocks) {
        const chunkKey = `${chunkX},${chunkZ}`;
        chunkBlocks.forEach(blockData => {
            this.addBlock(blockData.x, blockData.y, blockData.z, blockData.type);
        });
        this.chunks.set(chunkKey, chunkBlocks.length);
    }
    createTree(x, y, z, chunkBlocks = null) {
        const groundKey = this.getKey(x, y - 1, z);
        if (!this.blocks.has(groundKey) && chunkBlocks) {
            const hasGround = chunkBlocks.some(block => block.x === x && block.y === y - 1 && block.z === z);
            if (!hasGround) {
                return;
            }
        }
        const treeBlocks = [];
        for (let i = 0; i < 5; i++) {
            treeBlocks.push({
                x,
                y: y + i,
                z,
                type: BLOCK.WOOD
            });
        }
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = 3; ly <= 5; ly++) {
                    if (lx === 0 && lz === 0 && ly < 5) continue;
                    if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly - 4) <= 3) {
                        if (Math.random() > 0.3) {
                            treeBlocks.push({
                                x: x + lx,
                                y: y + ly,
                                z: z + lz,
                                type: BLOCK.LEAF
                            });
                        }
                    }
                }
            }
        }
        if (chunkBlocks) {
            treeBlocks.forEach(block => chunkBlocks.push(block));
        } else {
            treeBlocks.forEach(block => this.addBlock(block.x, block.y, block.z, block.type));
        }
    }
    addBlock(x, y, z, type) {
        const key = this.getKey(x, y, z);
        if (this.blocks.has(key) || type === BLOCK.AIR) return;
        let material = materials.stone;
        let isMultiMaterial = false;
        switch (type) {
            case BLOCK.GRASS:
                material = materials.grass;
                isMultiMaterial = true;
                break;
            case BLOCK.DIRT:
                material = materials.dirt;
                break;
            case BLOCK.STONE:
                material = materials.stone;
                break;
            case BLOCK.WOOD:
                material = materials.wood;
                break;
            case BLOCK.LEAF:
                material = materials.leaf;
                break;
            case BLOCK.BEDROCK:
                material = materials.bedrock;
                break;
        }
        const geometry = this.geometryPool.get('box');
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.userData = {
            isBlock: true,
            type: type
        };
        this.scene.add(mesh);
        this.blocks.set(key, mesh);
    }
    removeBlock(mesh) {
        const key = this.getKey(mesh.position.x, mesh.position.y, mesh.position.z);
        this.scene.remove(mesh);
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => {
                    if (mat !== materials.leaf && mat.dispose) {
                        let materialInUse = false;
                        for (let [_, otherMesh] of this.blocks) {
                            const otherMat = otherMesh.material;
                            if (Array.isArray(otherMat)) {
                                if (otherMat.includes(mat)) {
                                    materialInUse = true;
                                    break;
                                }
                            } else if (otherMat === mat) {
                                materialInUse = true;
                                break;
                            }
                        }
                        if (!materialInUse) {
                            mat.dispose();
                        }
                    }
                });
            } else if (mesh.material !== materials.leaf) {
                let materialInUse = false;
                for (let [_, otherMesh] of this.blocks) {
                    if (otherMesh.material === mesh.material && otherMesh !== mesh) {
                        materialInUse = true;
                        break;
                    }
                }
                if (!materialInUse && mesh.material.dispose) {
                    mesh.material.dispose();
                }
            }
        }
        this.blocks.delete(key);
    }
    getBlock(x, y, z) {
        return this.blocks.get(this.getKey(x, y, z));
    }
}
class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;
        this.controls = new PointerLockControls(camera, domElement);
        this.height = 1.8;
        this.width = 0.6;
        this.speed = 6.0;
        this.runSpeed = 10.0;
        this.jumpForce = 10.0;
        this.gravity = 28.0;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onGround = false;
        this.playerBox = new THREE.Box3();
        this.blockBox = new THREE.Box3();
        this.tempVector = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isSprinting = false;
        this.selectedBlock = BLOCK.GRASS;
        this.initInput();
    }
    initInput() {
        const onKeyDown = (e) => {
            switch (e.code) {
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'ShiftLeft':
                    this.isSprinting = true;
                    break;
                case 'Space':
                    if (this.onGround) {
                        this.velocity.y = this.jumpForce;
                        this.onGround = false;
                    }
                    break;
                case 'Digit1':
                    this.selectBlock(1, BLOCK.GRASS);
                    break;
                case 'Digit2':
                    this.selectBlock(2, BLOCK.DIRT);
                    break;
                case 'Digit3':
                    this.selectBlock(3, BLOCK.STONE);
                    break;
                case 'Digit4':
                    this.selectBlock(4, BLOCK.WOOD);
                    break;
                case 'Digit5':
                    this.selectBlock(5, BLOCK.LEAF);
                    break;
                case 'Equal':
                case 'NumpadAdd':
                    this.world.setRenderDistance(this.world.renderDistance + 1);
                    e.preventDefault();
                    break;
                case 'Minus':
                case 'NumpadSubtract':
                    this.world.setRenderDistance(this.world.renderDistance - 1);
                    e.preventDefault();
                    break;
            }
        };
        const onKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'KeyD':
                    this.moveRight = false;
                    break;
                case 'ShiftLeft':
                    this.isSprinting = false;
                    break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('keydown', (e) => {
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }
    selectBlock(slot, type) {
        this.selectedBlock = type;
        document.querySelectorAll('.slot').forEach(el => el.classList.remove('active'));
        const slotEl = document.getElementById(`slot-${slot}`);
        if (slotEl) {
            slotEl.classList.add('active');
        }
    }
    checkCollision(position) {
        const min = this.tempVector.set(position.x - this.width / 2, position.y - this.height + 0.2, position.z - this.width / 2);
        const max = new THREE.Vector3(position.x + this.width / 2, position.y + 0.2, position.z + this.width / 2);
        this.playerBox.set(min, max);
        const minX = Math.floor(min.x);
        const maxX = Math.floor(max.x);
        const minY = Math.floor(min.y);
        const maxY = Math.floor(max.y);
        const minZ = Math.floor(min.z);
        const maxZ = Math.floor(max.z);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = this.world.getBlock(x, y, z);
                    if (block) {
                        this.blockBox.min.set(x - 0.5, y - 0.5, z - 0.5);
                        this.blockBox.max.set(x + 0.5, y + 0.5, z + 0.5);
                        if (this.playerBox.intersectsBox(this.blockBox)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    update(delta) {
        if (!this.controls.isLocked) return;
        const clampedDelta = Math.min(delta, 1 / 30);
        const currentSpeed = this.isSprinting ? this.runSpeed : this.speed;
        this.velocity.x -= this.velocity.x * 10.0 * clampedDelta;
        this.velocity.z -= this.velocity.z * 10.0 * clampedDelta;
        this.velocity.y -= this.gravity * clampedDelta;
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.world.updatePlayerPosition(this.camera.position.x, this.camera.position.z);
        if (this.direction.lengthSq() > 0) {
            this.direction.normalize();
        }
        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * currentSpeed * 10.0 * clampedDelta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * currentSpeed * 10.0 * clampedDelta;
        }
        const originalPos = this.camera.position.clone();
        this.controls.moveRight(-this.velocity.x * clampedDelta);
        if (this.checkCollision(this.camera.position)) {
            this.camera.position.copy(originalPos);
            this.velocity.x = 0;
        }
        this.controls.moveForward(-this.velocity.z * clampedDelta);
        if (this.checkCollision(this.camera.position)) {
            this.camera.position.copy(originalPos);
            this.velocity.z = 0;
        }
        const originalY = this.camera.position.y;
        this.camera.position.y += this.velocity.y * clampedDelta;
        if (this.checkCollision(this.camera.position)) {
            this.camera.position.y = originalY;
            if (this.velocity.y < 0) {
                this.onGround = true;
            }
            this.velocity.y = 0;
        } else {
            this.onGround = false;
        }
        if (this.camera.position.y < -50) {
            this.camera.position.set(0, 20, 0);
            this.velocity.set(0, 0, 0);
        }
        if (Math.random() < 0.1) {
            const px = Math.round(this.camera.position.x);
            const py = Math.round(this.camera.position.y);
            const pz = Math.round(this.camera.position.z);
            const debugPos = document.getElementById('debug-pos');
            if (debugPos) debugPos.innerText = `Pos: ${px}, ${py}, ${pz}`;
            const chunkX = Math.floor(px / this.world.chunkSize);
            const chunkZ = Math.floor(pz / this.world.chunkSize);
            const debugChunk = document.getElementById('debug-chunk');
            if (debugChunk) debugChunk.innerText = `Chunk: ${chunkX}, ${chunkZ} | Render: ${this.world.renderDistance} chunks`;
        }
    }
}
let scene, camera, renderer, player, world;
let raycaster;
let prevTime = performance.now();
let frameCount = 0,
    lastFpsTime = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 80);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 10, 0);
    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
        precision: "mediump"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(50, 100, 50);
    sun.castShadow = false;
    scene.add(sun);
    world = new World(scene);
    player = new Player(camera, document.body, world);
    raycaster = new THREE.Raycaster();
    raycaster.far = 6;
    world.updatePlayerPosition(0, 0);
    setupEvents();
    animate();
}

function setupEvents() {
    const btn = document.getElementById('start-btn');
    const overlay = document.getElementById('overlay');
    if (btn) {
        btn.addEventListener('click', () => player.controls.lock());
    }
    player.controls.addEventListener('lock', () => {
        if (overlay) overlay.style.display = 'none';
    });
    player.controls.addEventListener('unlock', () => {
        if (overlay) {
            overlay.style.display = 'flex';
            const heading = overlay.querySelector('h1');
            const text = overlay.querySelector('p');
            if (heading) heading.innerText = "PAUSED";
            if (text) text.innerText = "Klik untuk lanjut";
        }
    });
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }, 250);
    });
    document.addEventListener('mousedown', (e) => {
        if (!player.controls.isLocked) return;
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(scene.children, false);
        const hit = intersects.find(i => i.object.userData.isBlock);
        if (hit) {
            if (e.button === 0) {
                world.removeBlock(hit.object);
            } else if (e.button === 2) {
                const p = hit.point.add(hit.face.normal.multiplyScalar(0.5));
                const x = Math.floor(p.x);
                const y = Math.floor(p.y);
                const z = Math.floor(p.z);
                const newBlockBox = new THREE.Box3(new THREE.Vector3(x - 0.45, y - 0.45, z - 0.45), new THREE.Vector3(x + 0.45, y + 0.45, z + 0.45));
                const playerPos = player.camera.position;
                const playerBox = new THREE.Box3(new THREE.Vector3(playerPos.x - player.width / 2, playerPos.y - player.height + 0.2, playerPos.z - player.width / 2), new THREE.Vector3(playerPos.x + player.width / 2, playerPos.y + 0.2, playerPos.z + player.width / 2));
                if (!newBlockBox.intersectsBox(playerBox)) {
                    world.addBlock(x, y, z, player.selectedBlock);
                }
            }
        }
        e.preventDefault();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;
    frameCount++;
    if (time > lastFpsTime + 1000) {
        const debugFps = document.getElementById('debug-fps');
        if (debugFps) debugFps.innerText = "FPS: " + frameCount;
        frameCount = 0;
        lastFpsTime = time;
    }
    player.update(delta);
    renderer.render(scene, camera);
}
init();