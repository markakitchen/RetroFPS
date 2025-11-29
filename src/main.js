import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import { Sound } from './audio.js';
import * as Shaders from './shaders.js';

// --- CSS INJECTION ---
const style = document.createElement('style');
style.innerHTML = `
    #ui { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 30px; box-sizing: border-box; z-index: 2; background: radial-gradient(circle, transparent 60%, rgba(0, 0, 0, 0.4) 100%); box-shadow: inset 0 0 50px rgba(0,0,0,0.5); }
    #ui::before { content: " "; display: block; position: absolute; top: 0; left: 0; bottom: 0; right: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%); background-size: 100% 4px; z-index: -1; pointer-events: none; }
    #damage-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; box-shadow: inset 0 0 0 0 rgba(255, 0, 0, 0); transition: box-shadow 0.1s; z-index: 1; }
    #powerup-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; box-shadow: inset 0 0 0 0 rgba(255, 215, 0, 0); transition: box-shadow 0.5s; z-index: 1; }
    #fade-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; background: #000; opacity: 0; transition: opacity 1s; z-index: 5; }
    #crosshair { position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%230f0" stroke-width="2" style="filter: drop-shadow(0 0 2px %230f0);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>'); transform: translate(-50%, -50%); opacity: 0.9; }
    .hud-text { color: #0f0; font-size: 28px; font-weight: bold; text-shadow: 0 0 10px #0f0, 0 0 20px #0f0; font-family: 'Consolas', monospace; background: rgba(0, 20, 0, 0.6); padding: 5px 10px; border: 1px solid #0f0; border-radius: 4px; }
    .hud-row { display: flex; justify-content: space-between; width: 100%; align-items: flex-end; }
    #status-bar { display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; }
    .status-icon { display: none; color: #fff; font-family: Impact; font-size: 24px; padding: 5px 15px; border-radius: 5px; text-shadow: 0 0 5px #fff; }
    #overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; color: white; pointer-events: auto; cursor: pointer; flex-direction: column; z-index: 10; }
    h1 { font-family: Impact, sans-serif; font-size: 70px; margin: 0; color: #fff; text-shadow: 0 0 20px #0f0; letter-spacing: 8px; font-style: italic; }
    .highscore { color: #ffaa00; font-size: 24px; margin-top: 20px; font-family: 'Courier New', monospace; letter-spacing: 2px; }
`;
document.head.appendChild(style);

// --- UI HTML ---
document.querySelector('#app').innerHTML = `
    <div id="damage-overlay"></div>
    <div id="powerup-overlay"></div>
    <div id="fade-overlay"></div>
    <div id="ui">
        <div class="hud-row" style="align-items: flex-start;">
            <div class="hud-text">SHIELD: <span id="hp">100</span>%</div>
            <div id="status-bar">
                <div id="status-quad" class="status-icon" style="background:#80f; box-shadow:0 0 10px #80f;">QUAD x4</div>
                <div id="status-haste" class="status-icon" style="background:#08f; box-shadow:0 0 10px #08f;">HASTE</div>
                <div id="status-invul" class="status-icon" style="background:#fc0; box-shadow:0 0 10px #fc0;">INVULN</div>
            </div>
            <canvas id="minimap" width="150" height="150" style="border: 2px solid #0f0; background: #000; opacity: 0.9; box-shadow: 0 0 10px #050;"></canvas>
        </div>
        <div id="crosshair"></div>
        <div class="hud-row">
            <div class="hud-text">DEPTH: <span id="level-num">1</span></div>
            <div class="hud-text">AMMO: <span id="ammo">INF</span></div>
            <div class="hud-text">SYS: <span id="weapon">BLASTER</span></div>
        </div>
    </div>
    <div id="overlay">
        <h1 id="title-text">NEON MAZE</h1>
        <p id="sub-text" style="font-size: 20px; margin-top: 10px; color: #0f0; text-shadow: 0 0 5px #0f0;">CLICK TO DEPLOY</p>
        <div class="highscore">BEST RUN: LEVEL <span id="best-score">1</span></div>
        <p style="color:#888; font-size: 14px; margin-top: 30px;">WASD Move | 1-5 Weapons | Scroll to Swap</p>
    </div>
`;

// --- GAME LOGIC ---
let MAP_SIZE = 32; 
const CELL_SIZE = 12;
const SPEED = 50.0; 

let camera, scene, renderer, controls, composer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
let gunGroup, muzzleLight;
let bossActive = false;

// ASSETS STATE
let loadedModels = { enemy: null, enemyAnims: [] };
let mixers = []; // Animation mixers
let minimapCtx; // Cache for minimap context

let currentLevel = 1;
let bestLevel = parseInt(localStorage.getItem('retroMazeBest') || '1');
document.getElementById('best-score').innerText = bestLevel;

let isTransitioning = false;
const mapData = []; 
const levelMeshes = []; 
let projectiles = [];
let particles = [];
let decals = [];
let enemies = [];
let pickups = [];
let barrels = [];
let portal = null; 
let raycaster; 
let screenShake = 0;

const WEAPONS = [
    { name: "BLASTER", type: 'bullet', delay: 150, speed: 200, dmg: 35, ammo: -1, color: 0xffff00, scale: 0.5 }, 
    { name: "SHOTGUN", type: 'spread', delay: 800, speed: 200, dmg: 25, ammo: 20, color: 0xffaa00, scale: 0.3 },
    { name: "CHAINGUN", type: 'chaingun', delay: 90, speed: 220, dmg: 12, ammo: 100, color: 0x00ffff, scale: 0.4 },
    { name: "ROCKET", type: 'rocket', delay: 1000, speed: 70, dmg: 100, ammo: 10, color: 0xff4400, scale: 1.0 }, 
    { name: "BFG 9000", type: 'bfg', delay: 1500, speed: 40, dmg: 999, ammo: 5, color: 0x00ff00, scale: 2.5 }
];

const player = { 
    hp: 100, weaponIdx: 0, lastShot: 0,
    powerups: { quad: 0, haste: 0, invul: 0 }
};

// --- ASSET GENERATORS (PROCEDURAL) ---
function createNoiseTexture(colorHex) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = colorHex; ctx.fillRect(0,0,256,256);
    for(let i=0; i<10000; i++) {
        ctx.fillStyle = Math.random()>0.5 ? `rgba(255,255,255,0.05)` : `rgba(0,0,0,0.1)`;
        ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 2; ctx.strokeRect(10,10,236,236); ctx.strokeRect(50,50,156,156);
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createDecalTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32,32,0, 32,32,32);
    grad.addColorStop(0, "rgba(0,0,0,0.9)");
    grad.addColorStop(0.3, "rgba(20,20,20,0.8)");
    grad.addColorStop(0.6, "rgba(50,50,50,0.4)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(canvas);
}

const wallTex = createNoiseTexture('#444455');
const floorTex = createNoiseTexture('#111111');
const decalTex = createDecalTexture();

const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.5, roughness: 0.2, metalness: 0.6, color: 0x888899 });
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: 0.2, roughness: 0.8, metalness: 0.2 });
const decalMatBase = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });

init();

async function init() {
    // FIX: Cache Minimap Context immediately
    const mmCanvas = document.getElementById('minimap');
    if (mmCanvas) {
        minimapCtx = mmCanvas.getContext('2d');
        minimapCtx.imageSmoothingEnabled = false;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    scene.fog = new THREE.FogExp2(0x020202, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 
    camera.position.set(0, 4, 0); 

    raycaster = new THREE.Raycaster();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);
    
    const light = new THREE.SpotLight(0xffffff, 100, 100, 0.8, 0.5, 1);
    light.position.set(0,0,0); light.target.position.set(0,0,-1);
    camera.add(light); camera.add(light.target);

    // Gun
    gunGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.z = -0.5; gunGroup.add(body);
    const barrelGeo = new THREE.BoxGeometry(0.1, 0.1, 2.1);
    const barrelMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat); barrel.position.y = 0.25; barrel.position.z = -0.5; gunGroup.add(barrel);
    muzzleLight = new THREE.PointLight(0xffff00, 0, 15); muzzleLight.position.set(0, 0.25, -1.6); gunGroup.add(muzzleLight);
    gunGroup.position.set(0.4, -0.4, -0.5); camera.add(gunGroup); scene.add(camera);

    // --- ASYNC LOAD ASSETS ---
    console.log("Starting Asset Load...");
    await loadAssets(); // Wait for model before making level
    console.log("Assets Ready. Generating Dungeon...");
    
    generateDungeon();

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.5;
    document.querySelector('#app').appendChild(renderer.domElement); 

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2; bloomPass.strength = 1.0; bloomPass.radius = 0.5;
    composer = new EffectComposer(renderer); composer.addPass(renderScene); composer.addPass(bloomPass);

    controls = new PointerLockControls(camera, document.body);
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => { 
        if(player.hp <= 0) resetGame();
        
        try {
            Sound.init();
        } catch(e) { console.warn("Audio failed to init", e); }
        
        controls.lock(); 
    });
    controls.addEventListener('lock', () => overlay.style.display = 'none');
    controls.addEventListener('unlock', () => {
        if(player.hp > 0) overlay.style.display = 'flex';
    });

    document.addEventListener('wheel', (e) => {
        if(!controls.isLocked) return;
        if(e.deltaY > 0) player.weaponIdx = (player.weaponIdx + 1) % WEAPONS.length;
        else player.weaponIdx = (player.weaponIdx - 1 + WEAPONS.length) % WEAPONS.length;
        switchWeapon(player.weaponIdx);
    });

    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': moveRight = true; break;
            case 'Digit1': switchWeapon(0); break;
            case 'Digit2': switchWeapon(1); break;
            case 'Digit3': switchWeapon(2); break;
            case 'Digit4': switchWeapon(3); break;
            case 'Digit5': switchWeapon(4); break;
        }
    };
    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': moveRight = false; break;
        }
    };
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', () => player.trigger = true);
    document.addEventListener('mouseup', () => player.trigger = false);
    window.addEventListener('resize', onWindowResize);

    prevTime = performance.now();
    animate();
}

function loadAssets() {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        console.log("Attempting to load: /models/enemy.glb");
        loader.load('/models/enemy.glb', (gltf) => {
            loadedModels.enemy = gltf.scene;
            loadedModels.enemyAnims = gltf.animations;
            console.log("SUCCESS: Enemy model loaded with animations:", gltf.animations.length);
            resolve();
        }, undefined, (error) => {
            console.error("FAILED: Could not load model. Using fallback.", error);
            console.warn("Verify file exists at public/models/enemy.glb");
            resolve(); // Resolve anyway to let game start with fallback
        });
    });
}

function switchWeapon(idx) {
    player.weaponIdx = idx;
    const w = WEAPONS[idx];
    document.getElementById('weapon').innerText = w.name;
    document.getElementById('ammo').innerText = w.ammo === -1 ? 'INF' : w.ammo;
    
    // Gun color override if Quad
    if(player.powerups.quad > 0) {
        gunGroup.children[1].material.color.setHex(0x8800ff);
        muzzleLight.color.setHex(0x8800ff);
    } else {
        gunGroup.children[1].material.color.setHex(w.color);
        muzzleLight.color.setHex(w.color);
    }
}

function addTrauma(amount) { screenShake = Math.min(1.0, screenShake + amount); }

function triggerDamageEffect() {
    addTrauma(0.5);
    const ov = document.getElementById('damage-overlay');
    ov.style.boxShadow = "inset 0 0 150px 50px rgba(255, 0, 0, 0.5)";
    setTimeout(() => ov.style.boxShadow = "inset 0 0 0 0 rgba(255,0,0,0)", 200);
}

function triggerFade() {
    const ov = document.getElementById('fade-overlay');
    ov.style.opacity = 1;
    setTimeout(() => ov.style.opacity = 0, 1500);
}

function gameOver() {
    if(currentLevel > bestLevel) {
        bestLevel = currentLevel;
        localStorage.setItem('retroMazeBest', bestLevel);
        document.getElementById('best-score').innerText = bestLevel;
    }
    document.exitPointerLock();
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('title-text').innerText = "CRITICAL FAILURE";
    document.getElementById('title-text').style.color = "#f00";
    document.getElementById('sub-text').innerText = "CLICK TO REBOOT SYSTEM";
}

function resetGame() {
    player.hp = 100;
    player.powerups = { quad: 0, haste: 0, invul: 0 };
    currentLevel = 1;
    WEAPONS[1].ammo = 20; WEAPONS[2].ammo = 100; WEAPONS[3].ammo = 10; WEAPONS[4].ammo = 5;
    document.getElementById('hp').innerText = 100;
    document.getElementById('level-num').innerText = 1;
    document.getElementById('title-text').innerText = "NEON MAZE";
    document.getElementById('title-text').style.color = "#fff";
    document.getElementById('sub-text').innerText = "CLICK TO DEPLOY";
    generateDungeon();
}

function nextLevel() {
    if(isTransitioning) return;
    isTransitioning = true;
    Sound.warp();
    triggerFade();
    setTimeout(() => {
        currentLevel++;
        document.getElementById('level-num').innerText = currentLevel;
        generateDungeon();
        isTransitioning = false;
    }, 1000);
}

function applyBiome() {
    let fogColor = 0x020202;
    let wallColor = 0x888899;
    let density = 0.02;
    if (currentLevel >= 7) { fogColor = 0x220000; wallColor = 0x442222; density = 0.04; } 
    else if (currentLevel >= 4) { fogColor = 0x001100; wallColor = 0x445544; density = 0.035; }
    scene.background.setHex(fogColor); scene.fog.color.setHex(fogColor); scene.fog.density = density;
    wallMat.color.setHex(wallColor);
}

function generateDungeon() {
    applyBiome();
    levelMeshes.forEach(m => scene.remove(m)); levelMeshes.length = 0; 
    pickups.forEach(p => scene.remove(p)); pickups = [];
    barrels.forEach(b => scene.remove(b)); barrels = [];
    enemies.forEach(e => scene.remove(e)); enemies = [];
    decals.forEach(d => scene.remove(d.mesh)); decals = [];
    // Clear mixers for old enemies (though we usually clear enemies on level gen anyway)
    mixers = []; 
    if(portal) { scene.remove(portal); portal = null; }

    bossActive = (currentLevel % 5 === 0);
    MAP_SIZE = bossActive ? 40 : Math.min(60, 32 + currentLevel * 2);

    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * CELL_SIZE, MAP_SIZE * CELL_SIZE);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2; scene.add(floor); levelMeshes.push(floor);
    const ceil = new THREE.Mesh(floorGeo, wallMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = CELL_SIZE; scene.add(ceil); levelMeshes.push(ceil);
    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);

    for(let x=0; x<MAP_SIZE; x++) { mapData[x] = []; for(let z=0; z<MAP_SIZE; z++) mapData[x][z] = 1; }

    if (bossActive) {
        const margin = 2;
        for(let x=margin; x<MAP_SIZE-margin; x++) for(let z=margin; z<MAP_SIZE-margin; z++) mapData[x][z] = 0;
        camera.position.set(0, 4, (MAP_SIZE/2 - 5) * CELL_SIZE);
        spawnEnemy(0, (-MAP_SIZE/2 + 5) * CELL_SIZE, 'boss'); 
        spawnPickup(10 * CELL_SIZE, 0, 'health'); spawnPickup(-10 * CELL_SIZE, 0, 'quad'); 
    } else {
        const rooms = []; const roomCount = 10 + Math.floor(currentLevel/2); 
        const minSize = 4, maxSize = 8;
        for(let i=0; i<roomCount; i++) {
            const w = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const h = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const x = Math.floor(Math.random() * (MAP_SIZE - w - 2)) + 1;
            const z = Math.floor(Math.random() * (MAP_SIZE - h - 2)) + 1;
            for(let rx=x; rx<x+w; rx++) for(let rz=z; rz<z+h; rz++) mapData[rx][rz] = 0;
            const cx = (x + w/2 - MAP_SIZE/2) * CELL_SIZE;
            const cz = (z + h/2 - MAP_SIZE/2) * CELL_SIZE;

            if(i===0) { camera.position.set(cx, 4, cz); }
            else if (i === roomCount - 1) { spawnPortal(cx, cz); }
            else {
                if(Math.random() > 0.3) {
                    const r = Math.random();
                    let type = 'drone';
                    if(r < 0.3) type = 'swarmer'; else if(r > 0.8) type = 'goliath';
                    spawnEnemy(cx, cz, type);
                    if(type === 'swarmer') { spawnEnemy(cx+5, cz, 'swarmer'); spawnEnemy(cx-5, cz, 'swarmer'); }
                }
                if(Math.random() > 0.5) {
                    // Powerup chance
                    const r = Math.random();
                    let type = r < 0.3 ? 'health' : (r < 0.6 ? 'ammo' : (r < 0.8 ? 'rocket_ammo' : 'quad'));
                    if(r > 0.95) type = 'invul';
                    else if (r > 0.9) type = 'haste';
                    spawnPickup(cx + (Math.random()-0.5)*10, cz + (Math.random()-0.5)*10, type);
                }
                if(Math.random() > 0.7) spawnBarrel(cx + (Math.random()-0.5)*15, cz + (Math.random()-0.5)*15);
            }
            if(rooms.length > 0) {
                const prev = rooms[rooms.length-1];
                const px = Math.floor(prev.x + prev.w/2), pz = Math.floor(prev.z + prev.h/2);
                const nx = Math.floor(x + w/2), nz = Math.floor(z + h/2);
                for(let cx=Math.min(px,nx); cx<=Math.max(px,nx); cx++) mapData[cx][pz] = 0;
                for(let cz=Math.min(pz,nz); cz<=Math.max(pz,nz); cz++) mapData[nx][cz] = 0;
            }
            rooms.push({x, z, w, h});
        }
    }

    for (let x = 0; x < MAP_SIZE; x++) {
        for (let z = 0; z < MAP_SIZE; z++) {
            if (mapData[x][z] === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set((x - MAP_SIZE/2) * CELL_SIZE, CELL_SIZE/2, (z - MAP_SIZE/2) * CELL_SIZE);
                scene.add(wall); levelMeshes.push(wall);
                if(!bossActive && Math.random() < 0.2) {
                    const stripGeo = new THREE.BoxGeometry(CELL_SIZE+0.1, 0.5, CELL_SIZE+0.1);
                    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                    const strip = new THREE.Mesh(stripGeo, stripMat);
                    strip.position.copy(wall.position); strip.position.y = Math.random() * CELL_SIZE; scene.add(strip);
                }
            }
        }
    }
}

function spawnPortal(x, z) {
    const geo = new THREE.TorusGeometry(3, 0.5, 16, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
    portal = new THREE.Mesh(geo, mat); portal.position.set(x, 4, z);
    const light = new THREE.PointLight(0x0088ff, 5, 20); portal.add(light);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 16, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    portal.add(inner); scene.add(portal);
}

function spawnPickup(x, z, type) {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    let color = 0xffffff;
    if(type === 'health') color = 0xff0000;
    else if(type.includes('ammo')) color = 0x0000ff;
    else if(type === 'quad') color = 0x8800ff; // Purple
    else if(type === 'invul') color = 0xffcc00; // Gold
    else if(type === 'haste') color = 0x0088ff; // Blue

    const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2, z);
    mesh.userData = { type: type };
    
    // Add Light for Powerups
    if(type === 'quad' || type === 'invul' || type === 'haste') {
        const light = new THREE.PointLight(color, 2, 10);
        mesh.add(light);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 16), new THREE.MeshBasicMaterial({color: color}));
        mesh.add(ring);
    }

    scene.add(mesh); pickups.push(mesh);
}

function spawnBarrel(x, z) {
    const geo = new THREE.CylinderGeometry(2, 2, 5, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x228822, roughness: 0.5 });
    const barrel = new THREE.Mesh(geo, mat); barrel.position.set(x, 2.5, z);
    barrel.userData = { hp: 1, type: 'barrel' };
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    lid.position.y = 2.5; barrel.add(lid); scene.add(barrel); barrels.push(barrel);
}

function spawnEnemy(x, z, type='drone') {
    const group = new THREE.Group();
    group.userData = { hp: 60, type: type };
    
    const createShaderMat = (vShader, fShader) => new THREE.ShaderMaterial({ vertexShader: vShader, fragmentShader: fShader, uniforms: Shaders.globalUniforms });

    // ASSET CHECK: Only apply to 'drone' for now
    if (type === 'drone' && loadedModels.enemy) {
        // Clone model with SkeletonUtils to preserve animations
        const model = SkeletonUtils.clone(loadedModels.enemy);
        model.scale.set(2, 2, 2); 
        
        // FIX 1: Prevent frustum culling issues - FORCE RENDERING ALWAYS
        model.traverse((child) => {
            if (child.isMesh) {
                child.frustumCulled = false;
                // NEW: Render both sides and handle materials robustly
                if(child.material) {
                     if(Array.isArray(child.material)) {
                         child.material.forEach(m => m.side = THREE.DoubleSide);
                     } else {
                         child.material.side = THREE.DoubleSide;
                     }
                }
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Force update of bounding volumes just in case
                child.geometry.computeBoundingSphere();
            }
        });
        
        group.add(model);
        
        // Setup Mixer
        const mixer = new THREE.AnimationMixer(model);
        if (loadedModels.enemyAnims.length > 0) {
            // FIX 2: Ensure we play the animation and it loops
            const action = mixer.clipAction(loadedModels.enemyAnims[0]);
            action.play();
        } else {
            console.warn("No animations found in enemy model");
        }
        group.userData.mixer = mixer;
        mixers.push(mixer);

        group.position.set(x, 2, z); // Lifted from 0 to 2
    } else {
        // Fallback Procedural
        if(type === 'boss') {
            group.userData.hp = 3000; group.userData.speed = 15;
            const bodyGeo = new THREE.DodecahedronGeometry(4, 0);
            const bodyMat = createShaderMat(Shaders.vShader, Shaders.fShaderChaos);
            const body = new THREE.Mesh(bodyGeo, bodyMat); group.add(body);
            const eyeGeo = new THREE.SphereGeometry(1.5, 16, 16);
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00ff00, emissiveIntensity: 5.0 });
            const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.z = 2.5; group.add(eye);
            group.position.set(x, 8, z);
        } else if(type === 'swarmer') {
            group.userData.hp = 30 + (currentLevel * 5); group.userData.speed = 25;
            const bodyGeo = new THREE.TetrahedronGeometry(1.2, 2); 
            const bodyMat = createShaderMat(Shaders.vShader, Shaders.fShaderMagma);
            const body = new THREE.Mesh(bodyGeo, bodyMat); group.add(body);
            group.position.set(x, 1.5, z);
        } else if (type === 'goliath') {
            group.userData.hp = 200 + (currentLevel * 20); group.userData.speed = 8;
            const bodyGeo = new THREE.BoxGeometry(3, 4, 3);
            const bodyMat = createShaderMat(Shaders.vShader, Shaders.fShaderShield);
            const body = new THREE.Mesh(bodyGeo, bodyMat); group.add(body);
            const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3), new THREE.MeshStandardMaterial({color: 0x222222}));
            turret.rotation.x = Math.PI/2; turret.position.z = 1.5; group.add(turret);
            group.position.set(x, 3, z);
        } else {
            // Drone (Procedural Fallback)
            group.userData.hp = 60 + (currentLevel * 10); group.userData.speed = 18;
            const bodyGeo = new THREE.OctahedronGeometry(1.5, 0);
            const bodyMat = createShaderMat(Shaders.vShader, Shaders.fShaderDigital);
            const body = new THREE.Mesh(bodyGeo, bodyMat); group.add(body);
            const eyeGeo = new THREE.SphereGeometry(0.5, 16, 16);
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffaa00, emissiveIntensity: 2.0 });
            const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.z = 0.8; eye.scale.set(1, 1, 0.5); group.add(eye);
            const ring1Geo = new THREE.TorusGeometry(2.2, 0.1, 8, 24);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.2 });
            const ring1 = new THREE.Mesh(ring1Geo, ringMat); group.add(ring1);
            const ring2Geo = new THREE.TorusGeometry(1.8, 0.15, 8, 24);
            const ring2 = new THREE.Mesh(ring2Geo, ringMat); group.add(ring2);
            group.position.set(x, 4, z);
        }
    }

    const light = new THREE.PointLight(type==='boss'?0x00ff00:(type==='swarmer'?0xff0000:(type==='goliath'?0x8800ff:0xffaa00)), 1.5, 10); 
    group.add(light); scene.add(group); enemies.push(group);
}

function createDecal(point, normal, size=3) {
    if(decals.length > 50) { const old = decals.shift(); scene.remove(old.mesh); }
    const mat = decalMatBase.clone();
    const orient = new THREE.Euler();
    const rotation = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) rotation.lookAt(point, point.clone().add(normal), new THREE.Vector3(1, 0, 0));
    else rotation.lookAt(point, point.clone().add(normal), up);
    orient.setFromRotationMatrix(rotation);
    const decalGeo = new DecalGeometry(levelMeshes[0], point, orient, new THREE.Vector3(size, size, size));
    const m = new THREE.Mesh(decalGeo, mat); scene.add(m); decals.push({ mesh: m, life: 5.0 });
}

function fireWeapon() {
    const now = performance.now();
    const w = WEAPONS[player.weaponIdx];
    if (now - player.lastShot < w.delay) return;
    if (w.ammo === 0) { Sound.noAmmo(); player.lastShot = now; return; }
    if (w.ammo > 0) { w.ammo--; document.getElementById('ammo').innerText = w.ammo; }
    
    player.lastShot = now; Sound.shoot(w.type);
    camera.rotation.x += 0.02; gunGroup.position.z += 0.4;
    
    addTrauma(w.type === 'rocket' || w.type === 'bfg' ? 0.3 : 0.05);
    muzzleLight.intensity = 8.0; setTimeout(() => muzzleLight.intensity = 0, 50);

    const pellets = w.type === 'spread' ? 6 : 1;
    for(let i=0; i<pellets; i++) {
        const geo = new THREE.SphereGeometry(w.scale);
        const mat = new THREE.MeshBasicMaterial({ color: w.color });
        const bullet = new THREE.Mesh(geo, mat);
        bullet.position.copy(camera.position);
        const pLight = new THREE.PointLight(w.color, 3, 20); bullet.add(pLight);
        
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        if (w.type === 'spread') {
            dir.x += (Math.random() - 0.5) * 0.15; dir.y += (Math.random() - 0.5) * 0.15; dir.z += (Math.random() - 0.5) * 0.15; dir.normalize();
        }
        bullet.position.add(dir.clone().multiplyScalar(2));
        bullet.userData = { velocity: dir.multiplyScalar(w.speed), type: w.type, dmg: w.dmg, lastPos: bullet.position.clone() };
        scene.add(bullet); projectiles.push(bullet);
    }
}

function spawnParticles(pos, color, count=5) {
    for(let i=0; i<count; i++) {
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*15, (Math.random()-0.5)*15), life: 1.0 };
        scene.add(p); particles.push(p);
    }
}

function checkWall(x, z) {
    const gridX = Math.round((x / CELL_SIZE) + MAP_SIZE/2);
    const gridZ = Math.round((z / CELL_SIZE) + MAP_SIZE/2);
    if (gridX >= 0 && gridX < MAP_SIZE && gridZ >= 0 && gridZ < MAP_SIZE) return mapData[gridX][gridZ] === 1;
    return false;
}

function drawMinimap() {
    // FIX: Add safety check for ctx
    if (!minimapCtx) return;
    const ctx = minimapCtx;

    const w = 150, h = 150;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
    const cellSize = w / MAP_SIZE;
    ctx.fillStyle = '#242';
    for(let x=0; x<MAP_SIZE; x++) {
        for(let z=0; z<MAP_SIZE; z++) if(mapData[x][z] === 1) ctx.fillRect(x*cellSize, z*cellSize, cellSize, cellSize);
    }
    const px = (camera.position.x / CELL_SIZE + MAP_SIZE/2) * cellSize;
    const pz = (camera.position.z / CELL_SIZE + MAP_SIZE/2) * cellSize;
    ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(px, pz, 3, 0, Math.PI*2); ctx.fill();
    enemies.forEach(e => {
        const ex = (e.position.x / CELL_SIZE + MAP_SIZE/2) * cellSize;
        const ez = (e.position.z / CELL_SIZE + MAP_SIZE/2) * cellSize;
        ctx.fillStyle = e.userData.type === 'boss' ? '#fff' : (e.userData.type === 'goliath' ? '#f0f' : (e.userData.type === 'swarmer' ? '#f00' : '#fa0'));
        ctx.fillRect(ex-1, ez-1, 2, 2);
    });
    if(portal) {
        const pox = (portal.position.x / CELL_SIZE + MAP_SIZE/2) * cellSize;
        const poz = (portal.position.z / CELL_SIZE + MAP_SIZE/2) * cellSize;
        ctx.fillStyle = '#0ff'; ctx.fillRect(pox-2, poz-2, 4, 4);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    // CLAMPED DELTA TIME
    const delta = Math.min(0.1, (time - prevTime) / 1000); 
    prevTime = time;
    
    Shaders.globalUniforms.uTime.value = time * 0.001;

    // UPDATE MIXERS (Animations)
    mixers.forEach(mixer => mixer.update(delta));

    // --- POWERUP LOGIC ---
    if(player.powerups.quad > 0) {
        player.powerups.quad -= delta;
        if(player.powerups.quad <= 0) { document.getElementById('status-quad').style.display = 'none'; switchWeapon(player.weaponIdx); } // Reset gun color
        else document.getElementById('status-quad').style.display = 'block';
    }
    if(player.powerups.haste > 0) {
        player.powerups.haste -= delta;
        if(player.powerups.haste <= 0) document.getElementById('status-haste').style.display = 'none';
        else document.getElementById('status-haste').style.display = 'block';
    }
    if(player.powerups.invul > 0) {
        player.powerups.invul -= delta;
        if(player.powerups.invul <= 0) { 
            document.getElementById('status-invul').style.display = 'none'; 
            document.getElementById('powerup-overlay').style.boxShadow = "inset 0 0 0 0 rgba(255, 215, 0, 0)";
        }
        else {
            document.getElementById('status-invul').style.display = 'block';
            document.getElementById('powerup-overlay').style.boxShadow = "inset 0 0 50px 20px rgba(255, 215, 0, 0.3)";
        }
    }

    if(screenShake > 0) {
        screenShake = Math.max(0, screenShake - delta);
        const shakeAmount = screenShake * screenShake;
        camera.rotation.z = (Math.random()-0.5) * shakeAmount * 0.5; 
    }

    if (controls && controls.isLocked && !isTransitioning && player.hp > 0) {
        const speedMult = player.powerups.haste > 0 ? 1.5 : 1.0;
        const moveDist = SPEED * speedMult * delta;
        const forward = new THREE.Vector3(); const right = new THREE.Vector3();
        camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
        right.crossVectors(forward, camera.up).normalize();

        const velocity = new THREE.Vector3();
        if (moveForward) velocity.add(forward); if (moveBackward) velocity.sub(forward);
        if (moveRight) velocity.add(right); if (moveLeft) velocity.sub(right);
        velocity.normalize().multiplyScalar(moveDist);

        const oldPos = camera.position.clone();
        camera.position.x += velocity.x;
        if (checkWall(camera.position.x, camera.position.z)) camera.position.x = oldPos.x;
        const afterXPos = camera.position.clone();
        camera.position.z += velocity.z;
        if (checkWall(camera.position.x, camera.position.z)) camera.position.z = afterXPos.z;

        if (player.trigger) fireWeapon();
        
        gunGroup.position.z += ( -0.5 - gunGroup.position.z ) * 10 * delta;
        if (velocity.lengthSq() > 0) {
                     gunGroup.position.y = -0.4 + Math.sin(time * (0.015 * speedMult)) * 0.02;
                     gunGroup.rotation.z = Math.sin(time * 0.01) * 0.05;
                }
    }

    if(portal) {
        portal.rotation.y += delta;
        portal.children[1].rotation.x += delta * 2;
        if(camera.position.distanceTo(portal.position) < 3) nextLevel();
    }

    for(let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.rotation.y += delta; p.position.y = 2 + Math.sin(time * 0.005) * 0.5;
        if(p.position.distanceTo(camera.position) < 4) {
            Sound.pickup();
            if(p.userData.type === 'health') { player.hp = Math.min(100, player.hp + 25); document.getElementById('hp').innerText = Math.floor(player.hp); }
            else if (p.userData.type === 'quad') { Sound.powerup(); player.powerups.quad = 30; switchWeapon(player.weaponIdx); }
            else if (p.userData.type === 'haste') { Sound.powerup(); player.powerups.haste = 30; }
            else if (p.userData.type === 'invul') { Sound.powerup(); player.powerups.invul = 30; }
            else { WEAPONS[1].ammo += 10; WEAPONS[3].ammo += 2; WEAPONS[2].ammo += 20; }
            scene.remove(p); pickups.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const b = projectiles[i];
        const prevPos = b.position.clone();
        b.position.add(b.userData.velocity.clone().multiplyScalar(delta));
        if(b.userData.type === 'rocket' || b.userData.type === 'bfg') {
            b.rotation.x += delta * 5; b.rotation.y += delta * 5; spawnParticles(b.position, 0x888888, 1);
        }
        if (b.position.distanceTo(camera.position) > 200) { scene.remove(b); projectiles.splice(i, 1); continue; }
        
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const hitSize = e.userData.type === 'boss' ? 8.0 : (e.userData.type === 'goliath' ? 5.0 : 3.5);
            if (b.position.distanceTo(e.position) < hitSize) {
                e.userData.hp -= b.userData.dmg;
                
                // FIX 4: Check children length or userData to prevent crash on procedural animation
                if(!e.userData.mixer && e.children[0]) { 
                    e.children[0].material.emissiveIntensity = 5.0; 
                    setTimeout(()=> { if(e&&e.children[0]) e.children[0].material.emissiveIntensity = 0 }, 50); 
                } else if (e.userData.mixer) {
                     // Flash the skinned mesh if possible, or just spawn particles
                     // Skinned meshes have children that are meshes
                     e.traverse(c => {
                         if(c.isMesh && c.material) {
                             const oldEmissive = c.material.emissive ? c.material.emissive.getHex() : 0;
                             if(c.material.emissive) c.material.emissive.setHex(0xffffff);
                             setTimeout(() => { if(c && c.material && c.material.emissive) c.material.emissive.setHex(oldEmissive) }, 50);
                         }
                     });
                }

                Sound.hit(); 
                // Color based on Quad
                const hitColor = player.powerups.quad > 0 ? 0x8800ff : WEAPONS[player.weaponIdx].color;
                spawnParticles(b.position, hitColor, 5);
                
                if (e.userData.hp <= 0) { 
                    if(e.userData.type === 'boss') spawnPortal(e.position.x, e.position.z);
                    
                    // Remove mixer if exists
                    if(e.userData.mixer) {
                        const mIdx = mixers.indexOf(e.userData.mixer);
                        if(mIdx !== -1) mixers.splice(mIdx, 1);
                    }

                    scene.remove(e); enemies.splice(j, 1); 
                    spawnParticles(e.position, 0xff0000, 15); spawnParticles(e.position, 0x555555, 10);
                    Sound.explode(); addTrauma(0.2);
                }
                scene.remove(b); projectiles.splice(i, 1); hit = true; break;
            }
        }
        if(!hit) {
            for(let k = barrels.length - 1; k >= 0; k--) {
                const bar = barrels[k];
                if(b.position.distanceTo(bar.position) < 3) {
                    Sound.explode(); spawnParticles(bar.position, 0x00ff00, 30); spawnParticles(bar.position, 0xffaa00, 20);
                    addTrauma(0.4); 
                    scene.remove(bar); barrels.splice(k, 1);
                    scene.remove(b); projectiles.splice(i, 1); hit = true; break;
                }
            }
        }
        if (!hit) {
            const inWall = checkWall(b.position.x, b.position.z);
            const outY = b.position.y < 0 || b.position.y > CELL_SIZE;
            if (inWall || outY) {
                const direction = b.position.clone().sub(prevPos).normalize();
                raycaster.set(prevPos, direction); raycaster.far = b.position.distanceTo(prevPos) + 1.0;
                const intersects = raycaster.intersectObjects(levelMeshes);
                if (intersects.length > 0) {
                    createDecal(intersects[0].point, intersects[0].face.normal);
                    spawnParticles(intersects[0].point, 0xffff00, 5);
                } else spawnParticles(b.position, 0xffff00, 5);
                Sound.hit();
                scene.remove(b); projectiles.splice(i, 1);
            }
        }
    }

    for(let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.userData.life -= delta * 2; p.scale.setScalar(p.userData.life);
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    for(let i = decals.length - 1; i >= 0; i--) {
        const d = decals[i];
        d.life -= delta;
        d.mesh.material.opacity = d.life / 5.0; 
        if (d.life <= 0) { scene.remove(d.mesh); decals.splice(i, 1); }
    }

    enemies.forEach(e => {
        const dist = e.position.distanceTo(camera.position);
        const dir = new THREE.Vector3().subVectors(camera.position, e.position).normalize();
        
        if (e.userData.type === 'drone' && e.userData.mixer === undefined) {
            // Procedural animation for drone fallback
            e.position.y = 4 + Math.sin(time * 0.003) * 0.5;
            if(e.children[2]) { e.children[2].rotation.y += delta * 2; }
            if(e.children[3]) e.children[3].rotation.x += delta * 3;
            // FIX 5: Guard access to children[1] for procedural animation
            if(e.children[1] && e.children[1].material) e.children[1].material.emissiveIntensity = 2.0 + Math.sin(time * 10) * 0.5;
            if (dist < 60 && dist > 5) {
                e.position.add(dir.multiplyScalar(e.userData.speed * delta)); 
                e.lookAt(camera.position);
            }
        } else if (e.userData.type === 'swarmer') {
            e.lookAt(camera.position);
            if (dist > 2) e.position.add(dir.multiplyScalar(e.userData.speed * delta));
            e.rotation.z = Math.sin(time * 20) * 0.2; 
        } else if (e.userData.type === 'boss') {
            if (dist > 20) { e.position.add(dir.multiplyScalar(e.userData.speed * delta)); e.lookAt(camera.position); }
            e.position.y = 8 + Math.sin(time * 0.001) * 0.5;
            if(Math.random() < 0.02) {
                Sound.shoot('bfg');
                const bfg = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial({color: 0x00ff00}));
                bfg.position.copy(e.position);
                bfg.userData = { velocity: dir.multiplyScalar(30), type: 'bfg', dmg: 20 };
                scene.add(bfg); projectiles.push(bfg);
            }
        } else if (e.userData.type === 'goliath') {
            if (dist > 15) { e.position.add(dir.multiplyScalar(e.userData.speed * delta)); e.lookAt(camera.position); }
            e.position.y = 3 + Math.sin(time * 0.001) * 0.2;
        } else if (e.userData.mixer) {
            // Animated Model Logic
            if (dist < 60 && dist > 2) {
                e.position.add(dir.multiplyScalar(e.userData.speed * delta)); 
                e.lookAt(camera.position);
            }
        }

        if(dist < 3 && player.hp > 0 && player.powerups.invul <= 0) {
            player.hp -= (e.userData.type === 'boss' ? 5.0 : 0.5); 
            if(player.hp <= 0) { player.hp = 0; gameOver(); }
            document.getElementById('hp').innerText = Math.floor(player.hp);
            triggerDamageEffect();
        }
    });

    drawMinimap();
    composer.render();
}