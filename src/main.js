
import * as THREE from 'three';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
<canvas id="scene"></canvas><div class="vignette"></div><div class="progress" id="progress"></div>
<header class="topbar"><div><div class="brand">MOTION<span>FIT</span></div><div class="subbrand">NEON RHYTHM ARENA · MVP</div></div>
<div class="stats"><div class="stat"><label>SCORE</label><strong id="score">00000</strong></div><div class="stat combo"><label>COMBO</label><strong id="combo">0×</strong></div><div class="stat time"><label>TIME</label><strong id="time">60</strong></div></div></header>
<canvas id="bodyMirror" width="640" height="480"></canvas><div id="movementEcho"></div><div class="gamehint">跟随光球节奏 · 左拳 / 右拳 · 坐姿节奏</div>
<div class="feedback" id="feedback">PERFECT!</div><div class="hitline">球进入圆圈时出拳 · 黄色准备 / 绿色出拳</div><div id="timingCue">等待光球</div>
<div class="bottom"><div class="leftpanel"><div class="cameraBox"><video id="camera" autoplay muted playsinline></video><canvas id="skeleton" width="430" height="290"></canvas><span class="cameraTitle" id="cameraTitle">CAMERA OFF</span></div><div class="status"><span class="dot" id="dot"></span><span id="status">等待开始</span></div></div><div class="instructions">左拳 <span class="key">J</span>　右拳 <span class="key">L</span><br>坐着玩 · 出拳后收手<br><span id="lastAction">准备就绪</span></div></div>
<div class="overlay" id="overlay"><div class="modal"><div class="eyebrow">YOUR BODY IS THE CONTROLLER</div><h1 id="modalTitle">MOVE. PUNCH.<br><span>LEVEL UP.</span></h1><p id="modalText">开启摄像头，用真实身体动作击中光球。坐着跟随音乐，交替出拳击中光球，挑战 60 秒节奏关卡。</p><div class="features"><span>🥊 左 / 右挥拳</span><span>🪑 坐姿游玩</span><span>⚡ 连击加分</span><span>🎵 Neon Pulse · 100 BPM</span></div><div class="actions"><button class="primary" id="cameraStart">📷 摄像头开始</button><button class="secondary" id="demoStart">⌨ 键盘试玩</button></div><p class="smallprint" id="modalNote">建议 Chrome / Edge 桌面浏览器，让肩膀、手肘和双手入镜。视频只在本机处理，不上传服务器。</p></div></div>`;

const $ = id => document.getElementById(id);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06091b); scene.fog = new THREE.FogExp2(0x080d25, .024);
const camera = new THREE.PerspectiveCamera(63, innerWidth / innerHeight, .1, 160); camera.position.set(0, 5.8, 17); camera.lookAt(0, 1, -10);
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.AmbientLight(0x6e9cbb, 1.15));
const lamp = new THREE.PointLight(0x26e6e3, 48, 42); lamp.position.set(-6, 7, 0); scene.add(lamp);
const lamp2 = new THREE.PointLight(0xab46ff, 48, 42); lamp2.position.set(6, 6, -12); scene.add(lamp2);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 100), new THREE.MeshStandardMaterial({ color: 0x0b1631, metalness: .65, roughness: .4 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -15; scene.add(floor);
const grid = new THREE.GridHelper(70, 42, 0x25a5bb, 0x153456); grid.position.y = .025; grid.position.z = -18; scene.add(grid);
for (let i = 0; i < 19; i++) { const z = 5 - i * 3.3; for (const s of [-1, 1]) { const pillar = new THREE.Mesh(new THREE.BoxGeometry(.22, 5.8, .22), new THREE.MeshStandardMaterial({ color: 0x132c57, emissive: i % 2 ? 0x361477 : 0x006c77, emissiveIntensity: .75 })); pillar.position.set(s * 7, 2.9, z); scene.add(pillar); const light = new THREE.Mesh(new THREE.BoxGeometry(.4, .09, .4), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xab56ff : 0x31ffee })); light.position.set(s * 7, 5.65, z); scene.add(light); } }
for (const x of [-3.2, 0, 3.2]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(.075, .025, 78), new THREE.MeshBasicMaterial({ color: x === 0 ? 0x268ba4 : 0x134c70 })); strip.position.set(x, .05, -21); scene.add(strip); }
const portalGroup = new THREE.Group(); for (let i = 0; i < 9; i++) { const arch = new THREE.Mesh(new THREE.TorusGeometry(6.9, .055, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x622bcc : 0x0c9ab8, transparent: true, opacity: .5 })); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(0, 2.3, -9 - i * 8); portalGroup.add(arch); } scene.add(portalGroup);
const laneXs = { left: -3.2, right: 3.2 };
const styles = { left: { color: 0x32f4e1, label: 'L' }, right: { color: 0xfc6be6, label: 'R' } };
let targets = [], particles = [];
function spawnTarget(type) {
    const style = styles[type]; const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.81, 1), new THREE.MeshStandardMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 1.8, roughness: .14, metalness: .15 })); mesh.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, .055, 8, 40), new THREE.MeshBasicMaterial({ color: style.color })); mesh.add(ring);
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = 128; labelCanvas.height = 128; const ctx = labelCanvas.getContext('2d'); ctx.fillStyle = '#091024'; ctx.beginPath(); ctx.arc(64, 64, 37, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 63px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(style.label, 64, 65); const tex = new THREE.CanvasTexture(labelCanvas); const icon = new THREE.Mesh(new THREE.PlaneGeometry(.93, .93), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); icon.position.z = .85; mesh.add(icon);
    mesh.position.set(laneXs[type], 2.7, -38); scene.add(mesh); targets.push({ type, mesh, hit: false, passed: false });
}
const HIT_Z = 5, SPAWN_Z = -38, SPEED = 14.5, HIT_WINDOW = 1.9, DURATION = 60;
const hitRings = {};
for(const side of ['left','right']){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.09,12,64),new THREE.MeshBasicMaterial({color:0x7398bb,transparent:true,opacity:.8,depthTest:false}));
 ring.position.set(laneXs[side],2.7,HIT_Z);ring.renderOrder=5;scene.add(ring);hitRings[side]=ring;
}
function updateTiming(){
 let nearest=null;
 for(const side of ['left','right']){
  const target=targets.filter(t=>!t.hit&&!t.passed&&t.type===side).sort((a,b)=>Math.abs(a.mesh.position.z-HIT_Z)-Math.abs(b.mesh.position.z-HIT_Z))[0];
  const gap=target?Math.abs(target.mesh.position.z-HIT_Z):Infinity;
  const color=gap< HIT_WINDOW?0x4dff81:gap<7?0xffd34d:0x7398bb;
  hitRings[side].material.color.setHex(color);
  hitRings[side].scale.setScalar(gap<HIT_WINDOW?1.12:1);
  if(target&&(!nearest||gap<Math.abs(nearest.mesh.position.z-HIT_Z)))nearest=target;
 }
 const cue=$('timingCue');
 if(!nearest){cue.textContent='等待光球';cue.dataset.state='wait';return;}
 const gap=Math.abs(nearest.mesh.position.z-HIT_Z),side=nearest.type==='left'?'左拳':'右拳';
 cue.dataset.state=gap<HIT_WINDOW?'hit':gap<7?'ready':'wait';
 cue.textContent=gap<.75?`现在！${side} · PERFECT`:gap<HIT_WINDOW?`现在出${side}！`:gap<7?`准备${side}…`:'等球进入击球圈';
}
let playing = false, score = 0, combo = 0, misses = 0, startAt = 0, lastFrame = performance.now(), nextBeat = 0, beatIndex = 0, mode = 'keyboard', cameraStream = null, pose = null, detectClock = 0, lastVideoTime = -1, rafId = null, lastMovement = { left: 0, right: 0 }, armState = { left: false, right: false }, feedbackTimer = null, audio = null;
const BEAT = .6; // 100 BPM
const beatSequence = ['left','right','left','right','left','left','right','right','left','right','right','left','right','left','left','right'];
let musicNodes = [];
function stopMusic(){for(const node of musicNodes){try{node.stop();}catch{}}musicNodes=[];}
let musicBuffer;
async function prepareMusic(){
 audio ??= new (window.AudioContext || window.webkitAudioContext)();
 await audio.resume();
 if(!musicBuffer){
  const response=await fetch(`${import.meta.env.BASE_URL}audio/neon-pulse-100bpm.wav`);
  if(!response.ok)throw Error('音乐加载失败');
  musicBuffer=await audio.decodeAudioData(await response.arrayBuffer());
 }
}
function startMusic(){
 stopMusic();
 const source=audio.createBufferSource(),gain=audio.createGain();
 source.buffer=musicBuffer;gain.gain.value=.65;source.connect(gain).connect(audio.destination);
 // First kick lands with the first note after its travel down the lane.
 const delay=Math.max(0,(HIT_Z-SPAWN_Z)/SPEED-(performance.now()-startAt)/1000);
 source.start(audio.currentTime+delay);musicNodes.push(source);
}
function sfx(type) { if (!audio) return; try { const t = audio.currentTime; const o = audio.createOscillator(); const g = audio.createGain(); o.type = type === 'hit' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(type === 'hit' ? 700 : 150, t); o.frequency.exponentialRampToValueAtTime(type === 'hit' ? 290 : 55, t + .12); g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g).connect(audio.destination); o.start(t); o.stop(t + .17); } catch { } }
function flash(label, good = true) { $('feedback').textContent = label; $('feedback').style.color = good ? '#ffffff' : '#ff839b'; $('feedback').classList.add('show'); clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => $('feedback').classList.remove('show'), 300); }
function burst(position, color) { for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.13, .13, .13), new THREE.MeshBasicMaterial({ color })); m.position.copy(position); m.userData.velocity = new THREE.Vector3((Math.random() - .5) * 9, (Math.random() - .1) * 6, (Math.random() - .5) * 6); scene.add(m); particles.push({ mesh: m, life: .45 }); } }
function action(type) {
    if (!playing) return; const now = performance.now(); if (now - lastMovement[type] < 200) return; lastMovement[type] = now; showMovement(type); $('lastAction').textContent = ({ left: '🥊 左拳', right: '🥊 右拳' })[type]; let match = null, best = 1e10; for (const t of targets) { if (t.hit || t.type !== type) continue; const diff = Math.abs(t.mesh.position.z - HIT_Z); if (diff < HIT_WINDOW && diff < best) { match = t; best = diff; } }
    if (match) { match.hit = true; let points = best < .75 ? 150 : 100; combo++; score += points + Math.min(combo, 20) * 10; burst(match.mesh.position, styles[type].color); scene.remove(match.mesh); match.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); flash(best < .75 ? 'PERFECT +' + points : 'GREAT +' + points); sfx('hit'); } else { flash('TOO EARLY / LATE', false); combo = 0; sfx('miss'); } updateStats();
}
let movementTimer;
function showMovement(type) {
    const echo = $('movementEcho');
    echo.textContent = ({ left: '🥊 左拳', right: '🥊 右拳' })[type];
    echo.className = 'active ' + type;
    clearTimeout(movementTimer); movementTimer = setTimeout(() => echo.className = '', 550);
}
function updateStats() { $('score').textContent = String(score).padStart(5, '0'); $('combo').textContent = combo + '×'; }
function setStatus(s, good = false) { $('status').textContent = s; $('dot').classList.toggle('good', good); }
function clearStage() { for (const t of targets) { scene.remove(t.mesh); t.mesh.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); } targets = []; for (const p of particles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); } particles = []; }
let startingGame=false;
async function beginGame(chosen) {
 if(startingGame||playing)return;
 startingGame=true;
 try{await prepareMusic();}catch(error){setStatus('音乐加载失败，请刷新重试');$('modalNote').textContent=error.message;startingGame=false;return;}
 startingGame=false;
 clearStage(); mode = chosen; score = 0; combo = 0; misses = 0; beatIndex = 0; nextBeat = 0; startAt = performance.now(); playing = true; lastMovement = { left: 0, right: 0 }; updateStats(); $('time').textContent = DURATION; $('overlay').classList.add('hidden'); setStatus(chosen === 'camera' ? '姿态识别运行中' : '键盘模式 · J / L', true); try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); startMusic(); } catch { } }
async function enableCamera() {
    const btn = $('cameraStart'); btn.disabled = true; btn.textContent = '正在打开摄像头…'; $('modalNote').classList.remove('error');
    try {
        if (!navigator.mediaDevices?.getUserMedia) throw Error('浏览器不支持摄像头，或当前页面不是 localhost / HTTPS。');
        cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
        const v = $('camera'); v.srcObject = cameraStream; await v.play(); $('cameraTitle').textContent = 'LOADING AI…'; btn.textContent = '正在加载姿态模型…';
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const opts = { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .55, minTrackingConfidence: .5 };
        try { pose = await PoseLandmarker.createFromOptions(vision, opts); } catch { opts.baseOptions.delegate = 'CPU'; pose = await PoseLandmarker.createFromOptions(vision, opts); }
        $('cameraTitle').textContent = 'AI POSE ACTIVE'; beginGame('camera');
    } catch (e) { $('modalNote').textContent = '摄像头启动失败：' + (e?.message || e) + '。可使用键盘试玩。'; $('modalNote').classList.add('error'); setStatus('摄像头不可用'); cameraStream?.getTracks().forEach(t => t.stop()); cameraStream = null; }
    finally { btn.disabled = false; btn.textContent = '📷 摄像头开始'; }
}
$('cameraStart').onclick = enableCamera;
$('demoStart').onclick = () => beginGame('keyboard');
document.addEventListener('keydown', e => { if (['KeyJ', 'KeyL', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.repeat) return; if (e.code === 'KeyJ' || e.code === 'ArrowLeft') action('left'); if (e.code === 'KeyL' || e.code === 'ArrowRight') action('right'); });
const mirror = $('bodyMirror'), mirrorContext = mirror.getContext('2d'), mirrorDraw = new DrawingUtils(mirrorContext);
const canvas = $('skeleton'), cctx = canvas.getContext('2d'), draw = new DrawingUtils(cctx);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angle(a, b, c) { const u = [a.x - b.x, a.y - b.y], v = [c.x - b.x, c.y - b.y]; const dot = u[0] * v[0] + u[1] * v[1]; return Math.acos(THREE.MathUtils.clamp(dot / (Math.hypot(...u) * Math.hypot(...v) + 1e-8), -1, 1)) * 180 / Math.PI; }
let prevWrist = { left: null, right: null }, prevTime = 0;
function readPose(landmarks, now) {
    const p = landmarks;
    if (!p || p.length < 33) return;
    const dt = prevTime ? Math.max((now - prevTime) / 1000, .016) : .05; prevTime = now;
    const shoulderWidth = dist(p[11], p[12]); const torso = Math.max(shoulderWidth * 1.2, .08);
    for (const [name, sh, el, wr] of [['left', 11, 13, 15], ['right', 12, 14, 16]]) {
        const valid = [sh, el, wr].every(i => (p[i].visibility ?? 1) > .45);
        if (!valid) { armState[name] = false; prevWrist[name] = null; continue; }
        const wrist = p[wr]; const prev = prevWrist[name]; const v = prev ? dist(wrist, prev) / dt : 0; prevWrist[name] = { x: wrist.x, y: wrist.y };
        const extension = dist(wrist, p[sh]) / torso; const elbow = angle(p[sh], p[el], wrist);
        const active = extension > .60 && elbow > 105 && wrist.y < p[sh].y + torso;
        // Require rising edge with meaningful motion, rather than a static extended arm.
        if (active && !armState[name] && v > .12) action(name);
        armState[name] = active;
    }

}
function processCamera(now) {
    if (mode !== 'camera' || !pose || !cameraStream || now - detectClock < 65) return;
    const v = $('camera'); if (v.readyState < 2 || v.currentTime === lastVideoTime) return;
    detectClock = now; lastVideoTime = v.currentTime;
    try {
        const result = pose.detectForVideo(v, now); cctx.clearRect(0, 0, canvas.width, canvas.height); mirrorContext.clearRect(0, 0, 640, 480); mirror.style.opacity = '0';
        if (result.landmarks.length) { const points = result.landmarks[0]; mirror.style.opacity = '.7'; mirrorDraw.drawConnectors(points, PoseLandmarker.POSE_CONNECTIONS, { color: '#28f4df', lineWidth: 5 }); mirrorDraw.drawLandmarks(points, { color: '#ffffff', radius: 4 }); draw.drawConnectors(points, PoseLandmarker.POSE_CONNECTIONS, { color: '#28f4df', lineWidth: 3 }); draw.drawLandmarks(points, { color: '#f9fbff', radius: 2.3 }); readPose(points, now); setStatus('已检测到人体 · 跟随节拍左右出拳', true); }
        else { prevTime = 0; setStatus('请让肩膀、手肘和双手入镜'); armState.left = false; armState.right = false; prevWrist.left = null; prevWrist.right = null; }
    } catch (e) { console.warn('Pose detection error', e); setStatus('姿态识别暂时失败'); }
}
function finish() {
    stopMusic();
    playing = false; $('overlay').classList.remove('hidden'); $('modalTitle').innerHTML = 'WORKOUT <span>DONE!</span>';
    $('modalText').textContent = `得分 ${score.toLocaleString()} · 漏掉 ${misses} 个目标。再挑战一次，刷新你的纪录！`;
    $('cameraStart').textContent = '📷 摄像头再来一次'; $('demoStart').textContent = '⌨ 键盘再来一次'; $('modalNote').textContent = '准备好后继续游戏。此版本不会储存摄像头画面。';
}
function animate(now) {
    requestAnimationFrame(animate); const dt = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
    portalGroup.children.forEach((p, i) => { p.rotation.z = Math.PI / 2 + Math.sin(now * .0005 + i) * .04; });
    if (playing) {
        const elapsed = (now - startAt) / 1000; const remain = Math.max(0, DURATION - elapsed); $('time').textContent = Math.ceil(remain); $('progress').style.width = (elapsed / DURATION * 100) + '%';
        // Spawn early enough for targets to travel from SPAWN_Z to HIT_Z.
        const travel = (HIT_Z - SPAWN_Z) / SPEED;
        while (nextBeat <= elapsed && nextBeat < DURATION - travel) { spawnTarget(beatSequence[beatIndex % beatSequence.length]); beatIndex++; nextBeat += BEAT; }
        for (const t of targets) {
            if (t.hit) continue; t.mesh.position.z += SPEED * dt;
            const gap=Math.abs(t.mesh.position.z-HIT_Z);
            const tint=t.passed?0x526078:gap<HIT_WINDOW?0x4dff81:gap<7?0xffd34d:styles[t.type].color;
            t.mesh.children[0].material.color.setHex(tint);t.mesh.children[0].material.emissive.setHex(tint);
            t.mesh.children[0].material.emissiveIntensity=gap<HIT_WINDOW?2.6:1.3;
            t.mesh.children[1].material.color.setHex(tint); t.mesh.rotation.z += dt * .7; t.mesh.children[1].scale.setScalar(1 + Math.sin(now * .009) * .1);
            if (t.mesh.position.z > HIT_Z + HIT_WINDOW && !t.passed) { t.passed = true; combo = 0; misses++; updateStats(); flash('MISS', false); }
        }
        for (const t of targets.filter(x => x.passed && x.mesh.position.z > 18)) { scene.remove(t.mesh); t.mesh.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); }
        targets = targets.filter(x => !x.hit && !(x.passed && x.mesh.position.z > 18));
        updateTiming();
        if (remain <= 0) finish();
        processCamera(now);
    }
    for (const p of particles) { p.life -= dt; p.mesh.position.addScaledVector(p.mesh.userData.velocity, dt); p.mesh.scale.setScalar(Math.max(0, p.life / .45)); }
    for (const p of particles.filter(x => x.life <= 0)) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
    particles = particles.filter(x => x.life > 0);
    renderer.render(scene, camera);
}
requestAnimationFrame(animate);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
addEventListener('beforeunload', () => { cameraStream?.getTracks().forEach(t => t.stop()); pose?.close(); });
