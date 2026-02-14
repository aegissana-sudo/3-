import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89c1ff);
scene.fog = new THREE.Fog(0x89c1ff, 45, 220);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const overlay = document.getElementById('overlay');
const hud = {
  hp: document.getElementById('hp'),
  weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'),
  reserve: document.getElementById('reserve'),
  medkits: document.getElementById('medkits'),
  upgrade: document.getElementById('upgrade'),
};

document.addEventListener('contextmenu', (e) => e.preventDefault());

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x556677, 0.85);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(45, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = {
  size: 180,
  half: 90,
  gravity: 28,
};

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(world.size, 2, world.size),
  new THREE.MeshStandardMaterial({ color: 0x4f8f4f })
);
ground.receiveShadow = true;
ground.position.y = -1;
scene.add(ground);

const blockMat = new THREE.MeshStandardMaterial({ color: 0x8e7a64 });
const blocks = [];
for (let x = -80; x <= 80; x += 16) {
  for (let z = -80; z <= 80; z += 16) {
    if (Math.random() < 0.65) {
      const h = 2 + Math.floor(Math.random() * 4);
      const block = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), blockMat);
      block.position.set(x + Math.random() * 8 - 4, h * 0.5, z + Math.random() * 8 - 4);
      block.castShadow = true;
      block.receiveShadow = true;
      scene.add(block);
      blocks.push(block);
    }
  }
}

const buildings = [];
const chests = [];
const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0b7c6 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x724b35 });
const chestMat = new THREE.MeshStandardMaterial({ color: 0xb7891f });

function createBuilding(x, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  base.position.y = 0.75;
  g.add(base);

  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 0.7), wallMat);
  wall1.position.set(0, 4.2, -7.5);
  const wall2 = wall1.clone();
  wall2.position.z = 7.5;
  const wall3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7, 16), wallMat);
  wall3.position.set(-7.5, 4.2, 0);
  const wall4 = wall3.clone();
  wall4.position.x = 7.5;
  [wall1, wall2, wall3, wall4].forEach((w) => g.add(w));

  const roof = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1, 16.5), roofMat);
  roof.position.y = 8;
  g.add(roof);

  const doorHole = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 1), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  doorHole.position.set(0, 2.5, -7.3);
  g.add(doorHole);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.5), chestMat);
  chest.position.set(0, 1.8, 2.5);
  chest.userData = { opened: false };
  g.add(chest);
  chests.push(chest);

  g.position.set(x, 0, z);
  g.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  scene.add(g);
  buildings.push(g);
}

createBuilding(25, 25);
createBuilding(-34, 18);
createBuilding(32, -40);

const player = {
  pos: new THREE.Vector3(0, 4, 0),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  height: 1.8,
  radius: 0.65,
  speed: 8.5,
  sprint: 14,
  jump: 11,
  onGround: false,
  crouched: false,
  aiming: false,
  hp: 100,
  medkits: 1,
  dmgUpgrade: 1,
};

const playerModel = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0x355fa8 }));
const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf2c59b }));
head.position.y = 1.05;
playerModel.add(body, head);
playerModel.position.copy(player.pos);
scene.add(playerModel);

const weaponConfigs = {
  pistol: { name: 'Пистолет', magSize: 12, reserve: 48, fireRate: 0.26, damage: 20, spread: 0.006 },
  rifle: { name: 'Винтовка', magSize: 30, reserve: 90, fireRate: 0.1, damage: 12, spread: 0.012 },
};
const weapons = {
  pistol: { ...weaponConfigs.pistol, ammo: 12 },
  rifle: { ...weaponConfigs.rifle, ammo: 30 },
};
let currentWeapon = 'pistol';
let shootCooldown = 0;

const weaponModel = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.52), new THREE.MeshStandardMaterial({ color: 0x2b2e32 }));
gunBody.position.set(0.22, -0.19, -0.55);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0.22, -0.18, -0.84);
weaponModel.add(gunBody, barrel);
camera.add(weaponModel);
scene.add(camera);

const keys = {};
const monsters = [];
let spawnTimer = 0;

function makeHealthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.28, 1);
  sprite.userData = { canvas, texture };
  return sprite;
}

function updateBar(sprite, ratio) {
  const { canvas, texture } = sprite.userData;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#2a2a2a';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#2fd45f';
  c.fillRect(0, 0, canvas.width * Math.max(0, ratio), canvas.height);
  texture.needsUpdate = true;
}

function spawnMonster() {
  if (monsters.length > 12) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = 28 + Math.random() * 35;
  const x = player.pos.x + Math.cos(angle) * dist;
  const z = player.pos.z + Math.sin(angle) * dist;
  if (Math.abs(x) > world.half - 3 || Math.abs(z) > world.half - 3) return;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.1, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x973636 })
  );
  mesh.castShadow = true;
  mesh.position.set(x, 1.05, z);

  const bar = makeHealthBar();
  bar.position.set(0, 1.6, 0);
  mesh.add(bar);

  scene.add(mesh);
  monsters.push({ mesh, hp: 60, speed: 2.3 + Math.random() * 0.8, damageCd: 0, bar });
  updateBar(bar, 1);
}

function clampWorldPosition(v) {
  v.x = THREE.MathUtils.clamp(v.x, -world.half + 1, world.half - 1);
  v.z = THREE.MathUtils.clamp(v.z, -world.half + 1, world.half - 1);
}

function useMedkit() {
  if (player.medkits > 0 && player.hp < 100) {
    player.medkits -= 1;
    player.hp = Math.min(100, player.hp + 40);
  }
}

function reload() {
  const w = weapons[currentWeapon];
  const need = w.magSize - w.ammo;
  if (need <= 0 || w.reserve <= 0) return;
  const take = Math.min(need, w.reserve);
  w.ammo += take;
  w.reserve -= take;
}

function openNearbyChest() {
  chests.forEach((chest) => {
    const worldPos = chest.getWorldPosition(new THREE.Vector3());
    if (!chest.userData.opened && worldPos.distanceTo(player.pos) < 3.2) {
      chest.userData.opened = true;
      chest.material = new THREE.MeshStandardMaterial({ color: 0x555555 });
      const roll = Math.random();
      if (roll < 0.4) {
        weapons.pistol.reserve += 15;
        weapons.rifle.reserve += 35;
      } else if (roll < 0.75) {
        player.medkits += 1;
      } else {
        player.dmgUpgrade = Math.min(2.0, player.dmgUpgrade + 0.2);
      }
    }
  });
}

function shoot() {
  const w = weapons[currentWeapon];
  if (w.ammo <= 0) {
    reload();
    return;
  }
  w.ammo -= 1;
  shootCooldown = w.fireRate;

  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.x += (Math.random() - 0.5) * w.spread * (player.aiming ? 0.4 : 1);
  dir.y += (Math.random() - 0.5) * w.spread * (player.aiming ? 0.4 : 1);
  dir.z += (Math.random() - 0.5) * w.spread * 0.4;
  dir.normalize();
  ray.set(camera.position.clone(), dir);

  const hit = ray.intersectObjects(monsters.map((m) => m.mesh), false)[0];
  if (hit) {
    const m = monsters.find((mo) => mo.mesh === hit.object);
    if (m) {
      m.hp -= w.damage * player.dmgUpgrade;
      updateBar(m.bar, m.hp / 60);
    }
  }
}

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Digit1') currentWeapon = 'pistol';
  if (e.code === 'Digit2') currentWeapon = 'rifle';
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyF') useMedkit();
  if (e.code === 'CapsLock') player.crouched = !player.crouched;
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));

window.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
    overlay.style.display = 'none';
    return;
  }
  if (e.button === 0) player.aiming = true;
  if (e.button === 2 && shootCooldown <= 0) shoot();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) player.aiming = false;
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0018;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.3, 1.3);
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement) {
    overlay.style.display = 'flex';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function updatePlayer(dt) {
  const speed = keys.ShiftLeft || keys.ShiftRight ? player.sprint : player.speed;
  const move = new THREE.Vector3(
    Number(keys.KeyD) - Number(keys.KeyA),
    0,
    Number(keys.KeyS) - Number(keys.KeyW)
  );

  if (move.lengthSq() > 0) {
    move.normalize();
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const desired = new THREE.Vector3();
    desired.addScaledVector(right, move.x);
    desired.addScaledVector(forward, move.z);
    desired.normalize().multiplyScalar(speed * (player.crouched ? 0.5 : 1));
    player.vel.x = desired.x;
    player.vel.z = desired.z;
  } else {
    player.vel.x *= 0.82;
    player.vel.z *= 0.82;
  }

  player.height = THREE.MathUtils.lerp(player.height, player.crouched ? 1.2 : 1.8, dt * 10);
  if ((keys.Space || keys.Numpad0) && player.onGround) {
    player.vel.y = player.jump;
    player.onGround = false;
  }
  player.vel.y -= world.gravity * dt;

  player.pos.addScaledVector(player.vel, dt);
  clampWorldPosition(player.pos);

  const floorY = player.height * 0.5;
  if (player.pos.y <= floorY) {
    player.pos.y = floorY;
    player.vel.y = 0;
    player.onGround = true;
  }

  camera.position.copy(player.pos).add(new THREE.Vector3(0, player.height * 0.78, 0));
  const dist = player.aiming ? 1.2 : 3.6;
  const upOffset = player.aiming ? 0.3 : 1.0;
  const camOffset = new THREE.Vector3(0, upOffset, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  camera.position.add(camOffset);
  camera.lookAt(player.pos.x, player.pos.y + player.height * 0.6, player.pos.z);

  playerModel.position.set(player.pos.x, player.pos.y - player.height * 0.5 + 1.05, player.pos.z);
  playerModel.rotation.y = player.yaw;
  playerModel.scale.y = player.crouched ? 0.75 : 1;

  weaponModel.visible = player.aiming;
  weaponModel.position.set(player.aiming ? 0.12 : 0.18, -0.17, -0.48);
  weaponModel.rotation.y = player.aiming ? 0.03 : 0.15;

  openNearbyChest();
}

function updateMonsters(dt) {
  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    if (m.hp <= 0) {
      scene.remove(m.mesh);
      monsters.splice(i, 1);
      continue;
    }

    const toPlayer = player.pos.clone().sub(m.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 1.35) {
      toPlayer.normalize();
      m.mesh.position.addScaledVector(toPlayer, m.speed * dt);
    } else if (m.damageCd <= 0) {
      player.hp -= 8;
      m.damageCd = 1;
    }
    m.damageCd -= dt;
    m.mesh.lookAt(player.pos.x, m.mesh.position.y, player.pos.z);
  }
}

function updateHUD() {
  const w = weapons[currentWeapon];
  hud.hp.textContent = Math.max(0, Math.ceil(player.hp));
  hud.weapon.textContent = w.name;
  hud.ammo.textContent = `${w.ammo} / ${w.magSize}`;
  hud.reserve.textContent = `${w.reserve}`;
  hud.medkits.textContent = `${player.medkits} (F)`;
  hud.upgrade.textContent = `x${player.dmgUpgrade.toFixed(1)}`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  shootCooldown -= dt;
  spawnTimer += dt;

  if (spawnTimer > 5) {
    spawnMonster();
    spawnTimer = 0;
  }

  updatePlayer(dt);
  updateMonsters(dt);
  updateHUD();

  if (player.hp <= 0) {
    overlay.style.display = 'flex';
    overlay.innerHTML = '<h1>Вы проиграли</h1><p>Обнови страницу, чтобы начать заново.</p>';
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

updateHUD();
animate();
