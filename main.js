import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(105, window.innerWidth / window.innerHeight, 0.1, 10000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const coordinatesElement = document.getElementById('coords');

document.addEventListener('click', () => {
    controls.lock();
});

const loader = new THREE.TextureLoader();
const sideTexture = loader.load('images/grass-block-side.png.png');
const topTexture = loader.load('images/grass-block-top.png.png');

sideTexture.magFilter = THREE.NearestFilter;
topTexture.magFilter = THREE.NearestFilter;

const grassBlockGeometry = new THREE.BoxGeometry(1, 1, 1);
const grassBlockMaterials = [
    new THREE.MeshBasicMaterial({ map: sideTexture }),
    new THREE.MeshBasicMaterial({ map: sideTexture }),
    new THREE.MeshBasicMaterial({ map: topTexture }),
    new THREE.MeshBasicMaterial({ map: topTexture }),
    new THREE.MeshBasicMaterial({ map: sideTexture }),
    new THREE.MeshBasicMaterial({ map: sideTexture })
];
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function createGrassBlock(x, z, chunkKey, localX, localZ) {
    const block = new THREE.Mesh(grassBlockGeometry, grassBlockMaterials);
    block.position.set(x, 0, z);
    block.userData = {
        blockType: 'grass',
        chunkKey,
        localKey: `${localX},${localZ}`
    };
    return block;
}

const worldBorder = 3_000_000;
const halfWorldBorder = worldBorder / 2;
const renderDistance = 16;
const chunkSize = 16;
const player_height = 2;
const standingCameraY = player_height * 3 / 4;
const walkSpeedBlocksPerSecond = 4.317;
const sneakSpeedBlocksPerSecond = 1.295;
const verticalMoveSpeedBlocksPerSecond = 4.317;
const blockBreakRange = 4.5;
const renderDistanceInChunks = Math.ceil(renderDistance / chunkSize);
const loadedChunks = new Map();
const brokenBlocksByChunk = new Map();

function spawn() {
    camera.position.set(0, standingCameraY, 0);
    camera.rotation.set(0, Math.PI, 0);
}

function isInsideWorld(x, z) {
    return Math.abs(x) <= halfWorldBorder && Math.abs(z) <= halfWorldBorder;
}

function getChunkCoordinate(value) {
    return Math.floor(value / chunkSize);
}

function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

function getLocalBlockKey(localX, localZ) {
    return `${localX},${localZ}`;
}

function markBlockBroken(chunkKey, localKey) {
    if (!brokenBlocksByChunk.has(chunkKey)) {
        brokenBlocksByChunk.set(chunkKey, new Set());
    }

    brokenBlocksByChunk.get(chunkKey).add(localKey);
}

function isBlockBroken(chunkKey, localKey) {
    return brokenBlocksByChunk.has(chunkKey) && brokenBlocksByChunk.get(chunkKey).has(localKey);
}

function loadChunk(chunkX, chunkZ) {
    const chunkKey = getChunkKey(chunkX, chunkZ);

    if (loadedChunks.has(chunkKey)) {
        return;
    }

    const chunkGroup = new THREE.Group();
    const startX = chunkX * chunkSize;
    const startZ = chunkZ * chunkSize;

    for (let localX = 0; localX < chunkSize; localX++) {
        for (let localZ = 0; localZ < chunkSize; localZ++) {
            const worldX = startX + localX;
            const worldZ = startZ + localZ;
            const localKey = getLocalBlockKey(localX, localZ);

            if (!isInsideWorld(worldX, worldZ) || isBlockBroken(chunkKey, localKey)) {
                continue;
            }

            chunkGroup.add(createGrassBlock(worldX, worldZ, chunkKey, localX, localZ));
        }
    }

    loadedChunks.set(chunkKey, chunkGroup);
    scene.add(chunkGroup);
}

function unloadChunk(chunkKey) {
    const chunkGroup = loadedChunks.get(chunkKey);

    if (!chunkGroup) {
        return;
    }

    scene.remove(chunkGroup);
    loadedChunks.delete(chunkKey);
}

function updateVisibleChunks() {
    const playerChunkX = getChunkCoordinate(camera.position.x);
    const playerChunkZ = getChunkCoordinate(camera.position.z);
    const requiredChunks = new Set();

    for (let chunkOffsetX = -renderDistanceInChunks; chunkOffsetX <= renderDistanceInChunks; chunkOffsetX++) {
        for (let chunkOffsetZ = -renderDistanceInChunks; chunkOffsetZ <= renderDistanceInChunks; chunkOffsetZ++) {
            const chunkX = playerChunkX + chunkOffsetX;
            const chunkZ = playerChunkZ + chunkOffsetZ;
            const chunkKey = getChunkKey(chunkX, chunkZ);

            requiredChunks.add(chunkKey);
            loadChunk(chunkX, chunkZ);
        }
    }

    for (const chunkKey of loadedChunks.keys()) {
        if (!requiredChunks.has(chunkKey)) {
            unloadChunk(chunkKey);
        }
    }
}

function updateCoordinateDisplay() {
    const displayX = Math.round(camera.position.x);
    const displayY = Math.round(camera.position.y-player_height);
    const displayZ = Math.round(camera.position.z);

    coordinatesElement.textContent = `X: ${displayX}  Y: ${displayY}  Z: ${displayZ}`;
}

function getBreakableBlockInView() {
    raycaster.setFromCamera(screenCenter, camera);

    const intersections = raycaster.intersectObjects(scene.children, true);

    for (const intersection of intersections) {
        const block = intersection.object;

        if (block.userData.blockType !== 'grass') {
            continue;
        }

        if (camera.position.distanceTo(block.position) > blockBreakRange) {
            continue;
        }

        return block;
    }

    return null;
}

function breakTargetBlock() {
    if (!controls.isLocked) {
        return;
    }

    const block = getBreakableBlockInView();

    if (!block) {
        return;
    }

    const { chunkKey, localKey } = block.userData;
    markBlockBroken(chunkKey, localKey);
    block.parent.remove(block);
}

spawn();
updateVisibleChunks();
updateCoordinateDisplay();

const pressedKeys = {};
let isBreakingBlock = false;
let previousChunkX = getChunkCoordinate(camera.position.x);
let previousChunkZ = getChunkCoordinate(camera.position.z);
let lastFrameTime = 0;

document.addEventListener('keydown', (e) => {
    pressedKeys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    pressedKeys[e.code] = false;
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        isBreakingBlock = true;
        breakTargetBlock();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isBreakingBlock = false;
    }
});

window.addEventListener('blur', () => {
    Object.keys(pressedKeys).forEach((code) => {
        pressedKeys[code] = false;
    });
    isBreakingBlock = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(time) {
    const deltaSeconds = lastFrameTime === 0 ? 0 : (time - lastFrameTime) / 1000;
    lastFrameTime = time;
    const isSneaking = pressedKeys['ShiftLeft'] || pressedKeys['ShiftRight'];
    const horizontalMoveSpeed = (isSneaking ? sneakSpeedBlocksPerSecond : walkSpeedBlocksPerSecond) * deltaSeconds;
    const verticalMoveSpeed = verticalMoveSpeedBlocksPerSecond * deltaSeconds;

    if (pressedKeys['KeyW']) controls.moveForward(horizontalMoveSpeed);
    if (pressedKeys['KeyS']) controls.moveForward(-horizontalMoveSpeed);
    if (pressedKeys['KeyD']) controls.moveRight(horizontalMoveSpeed);
    if (pressedKeys['KeyA']) controls.moveRight(-horizontalMoveSpeed);

    if (pressedKeys['Space']) camera.position.y += verticalMoveSpeed;

    const wantsToMoveDown = isSneaking;
    if (wantsToMoveDown && camera.position.y > standingCameraY) {
        camera.position.y -= verticalMoveSpeed;
    }

    if (camera.position.y < standingCameraY) {
        camera.position.y = standingCameraY;
    }

    const currentChunkX = getChunkCoordinate(camera.position.x);
    const currentChunkZ = getChunkCoordinate(camera.position.z);

    if (currentChunkX !== previousChunkX || currentChunkZ !== previousChunkZ) {
        previousChunkX = currentChunkX;
        previousChunkZ = currentChunkZ;
        updateVisibleChunks();
    }

    if (isBreakingBlock) {
        breakTargetBlock();
    }

    updateCoordinateDisplay();

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
