import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(105, window.innerWidth / window.innerHeight, 0.1, 10000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

document.addEventListener('click', () => {
    controls.lock();
});

const loader = new THREE.TextureLoader();

function createGrassBlock() {
    //Grass Block Textures
    const sideTexture = loader.load('images/grass-block-side.png.png');
    const topTexture = loader.load('images/grass-block-top.png.png')
    sideTexture.magFilter = THREE.NearestFilter;
    topTexture.magFilter = THREE.NearestFilter;

//Grass Bloc Geometry
    const grassBlockGeometry = new THREE.BoxGeometry(1, 1, 1);

    const cubeMaterials = [
        new THREE.MeshBasicMaterial({map: sideTexture}),
        new THREE.MeshBasicMaterial({map: sideTexture}),
        new THREE.MeshBasicMaterial({map: topTexture}),
        new THREE.MeshBasicMaterial({map: topTexture}),
        new THREE.MeshBasicMaterial({map: sideTexture}),
        new THREE.MeshBasicMaterial({map: sideTexture})
    ]

    return new THREE.Mesh(grassBlockGeometry, cubeMaterials);
}

//World Generation && player spawn && render distance
const worldBorder = 5;
const renderDistance = 5;

function spawn() {
    camera.position.z = worldBorder/2;
    camera.position.y = 3;
    camera.position.x = worldBorder/2;
}

spawn();

function renderWorld() {
    for (let i = 0; i < worldBorder; i++) {
        const block = createGrassBlock();
        block.position.x = i;
        if (!i-camera.position.x > renderDistance) {
            scene.add(block);
        }
        for (let j = 0; j < worldBorder; j++) {
            const block = createGrassBlock();
            block.position.z = j;
            block.position.x = i;
            if (!j-camera.position.z > renderDistance) {
                scene.add(block);
            } else {
                break;
            }
        }
    }
}

const pressedKeys = {};

document.addEventListener('keydown', (e) => {
    pressedKeys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    pressedKeys[e.key] = false;
});

function animate(time) {

    const moveSpeed = 0.1;
    const shiftMoveSpeed = 0.025;

    if (pressedKeys['w']) controls.moveForward(moveSpeed);
    if (pressedKeys['s']) controls.moveForward(-moveSpeed);
    if (pressedKeys['d']) controls.moveRight(moveSpeed);
    if (pressedKeys['a']) controls.moveRight(-moveSpeed);

    if (pressedKeys[' ']) camera.position.y += moveSpeed;
    if (pressedKeys['Shift']) camera.position.y -= moveSpeed;

    renderer.render(scene, camera);
}
renderWorld();
renderer.setAnimationLoop(animate);