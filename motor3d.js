/* motor3d.js — 3D Brake Drum + Speedometer + Charts + Table */
(function(){
"use strict";
const S=window.SIM;
S.renderPills(document.getElementById('pills'));

// Sliders
const slider=document.getElementById('load-slider');
const loadDisp=document.getElementById('load-val');
const rheoSlider=document.getElementById('rheostat-slider');
const rheoDisp=document.getElementById('rheostat-val');

function onSlider(){S.load=+slider.value;loadDisp.textContent=S.load+'%';updateTrack();}
slider.addEventListener('input',onSlider);slider.addEventListener('change',onSlider);
function updateTrack(){slider.style.background=`linear-gradient(90deg,#4facfe ${S.load}%,#151a2a ${S.load}%)`;}
updateTrack();

function onRheo(){S.Rh=+rheoSlider.value;rheoDisp.textContent=S.Rh+'Ω';updateRheoTrack();}
rheoSlider.addEventListener('input',onRheo);rheoSlider.addEventListener('change',onRheo);
function updateRheoTrack(){const p=(S.Rh/200)*100;rheoSlider.style.background=`linear-gradient(90deg,#a78bfa ${p}%,#151a2a ${p}%)`;}
updateRheoTrack();

// Gauge refs
const gIl=document.getElementById('g-il'),gIa=document.getElementById('g-ia'),
      gS1=document.getElementById('g-s1'),gS2=document.getElementById('g-s2'),
      gSpd=document.getElementById('g-speed'),gT=document.getElementById('g-torque'),
      gP=document.getElementById('g-pout'),gE=document.getElementById('g-eff');

// === CHARTS ===
function autoScale(arr,key,pad){
  if(!arr.length)return{min:0,max:100};
  let mn=Infinity,mx=-Infinity;
  arr.forEach(p=>{const v=p[key||'y'];if(v<mn)mn=v;if(v>mx)mx=v;});
  const range=mx-mn||1;
  const margin=range*(pad||0.15);
  return{min:Math.max(0,Math.floor(mn-margin)),max:Math.ceil(mx+margin)};
}

// Chart 1: Torque vs Speed
const tsCtx=document.getElementById('chart-ts').getContext('2d');
let tsData=[];
const tsChart=new Chart(tsCtx,{type:'line',data:{datasets:[
  {label:'Speed N (RPM)',data:[],borderColor:'#34d399',backgroundColor:'#34d39920',fill:true,tension:.3,borderWidth:2,pointRadius:3,pointBackgroundColor:'#34d399'}
]},options:{
  responsive:true,maintainAspectRatio:false,animation:{duration:200},
  scales:{
    x:{type:'linear',title:{display:true,text:'Torque T (N·m)',color:'#94a3b8',font:{family:'Outfit'}},ticks:{color:'#64748b'},grid:{color:'#1f264033'},min:0},
    y:{title:{display:true,text:'Speed N (RPM)',color:'#34d399',font:{family:'Outfit'}},ticks:{color:'#34d399',stepSize:10},grid:{color:'#1f264033'}}
  },
  plugins:{legend:{labels:{color:'#e2e8f0',font:{family:'Outfit',size:11}}}}
}});

// Chart 2: Output vs Efficiency
const peCtx=document.getElementById('chart-pe').getContext('2d');
let peData=[];
const peChart=new Chart(peCtx,{type:'line',data:{datasets:[
  {label:'Efficiency η (%)',data:[],borderColor:'#a78bfa',backgroundColor:'#a78bfa20',fill:true,tension:.3,borderWidth:2,pointRadius:3,pointBackgroundColor:'#a78bfa'}
]},options:{
  responsive:true,maintainAspectRatio:false,animation:{duration:200},
  scales:{
    x:{type:'linear',title:{display:true,text:'Output Power (W)',color:'#94a3b8',font:{family:'Outfit'}},ticks:{color:'#64748b'},grid:{color:'#1f264033'},min:0},
    y:{title:{display:true,text:'Efficiency (%)',color:'#a78bfa',font:{family:'Outfit'}},ticks:{color:'#a78bfa',stepSize:5},grid:{color:'#1f264033'}}
  },
  plugins:{legend:{labels:{color:'#e2e8f0',font:{family:'Outfit',size:11}}}}
}});

// Chart 3: Load vs Speed & Current
const lscCtx=document.getElementById('chart-lsc').getContext('2d');
let lscSpdData=[],lscCurData=[];
const lscChart=new Chart(lscCtx,{type:'line',data:{datasets:[
  {label:'Speed (RPM)',data:[],borderColor:'#34d399',tension:.3,borderWidth:2,pointRadius:3,yAxisID:'yL',pointBackgroundColor:'#34d399'},
  {label:'Line Current (A)',data:[],borderColor:'#4facfe',tension:.3,borderWidth:2,pointRadius:3,yAxisID:'yR',pointBackgroundColor:'#4facfe'}
]},options:{
  responsive:true,maintainAspectRatio:false,animation:{duration:200},
  scales:{
    x:{type:'linear',title:{display:true,text:'Load (%)',color:'#94a3b8',font:{family:'Outfit'}},ticks:{color:'#64748b'},grid:{color:'#1f264033'},min:0,max:100},
    yL:{position:'left',title:{display:true,text:'Speed (RPM)',color:'#34d399',font:{family:'Outfit'}},ticks:{color:'#34d399',stepSize:10},grid:{color:'#1f264033'}},
    yR:{position:'right',title:{display:true,text:'Current (A)',color:'#4facfe',font:{family:'Outfit'}},ticks:{color:'#4facfe'},grid:{display:false}}
  },
  plugins:{legend:{labels:{color:'#e2e8f0',font:{family:'Outfit',size:11}}}}
}});

// Table
const obsBody=document.getElementById('obs-body');
let tableEntries=[];

function updateAllCharts(st){
  if(st.T<0.005&&st.pct<0.01)return;
  const xT=+st.T.toFixed(2),yN=Math.round(st.N);
  const xP=Math.round(st.Pout),yE=+st.eff.toFixed(1);
  const xL=Math.round(st.pct*100);

  // Upsert helper
  function ups(arr,xv,yv,thr){
    const ex=arr.find(p=>Math.abs(p.x-xv)<thr);
    if(ex){ex.x=xv;ex.y=yv;}else{arr.push({x:xv,y:yv});arr.sort((a,b)=>a.x-b.x);}
  }
  ups(tsData,xT,yN,0.15);
  if(xP>1)ups(peData,xP,yE,25);
  ups(lscSpdData,xL,yN,2);
  ups(lscCurData,xL,+st.Il.toFixed(2),2);

  // Auto-scale Y axes
  const tsS=autoScale(tsData,'y',0.05);
  tsChart.options.scales.y.min=tsS.min;tsChart.options.scales.y.max=tsS.max;
  tsChart.data.datasets[0].data=[...tsData];tsChart.update();

  if(peData.length>0){
    const peS=autoScale(peData,'y',0.1);
    peChart.options.scales.y.min=peS.min;peChart.options.scales.y.max=peS.max;
    peChart.data.datasets[0].data=[...peData];peChart.update();
  }

  const lsS=autoScale(lscSpdData,'y',0.05);
  lscChart.options.scales.yL.min=lsS.min;lscChart.options.scales.yL.max=lsS.max;
  const lcS=autoScale(lscCurData,'y',0.1);
  lscChart.options.scales.yR.min=lcS.min;lscChart.options.scales.yR.max=lcS.max;
  lscChart.data.datasets[0].data=[...lscSpdData];
  lscChart.data.datasets[1].data=[...lscCurData];
  lscChart.update();

  // Update table
  const key=xL;
  let row=tableEntries.find(e=>e.load===key);
  if(!row){row={load:key};tableEntries.push(row);tableEntries.sort((a,b)=>a.load-b.load);}
  row.s1=st.S1.toFixed(2);row.s2=st.S2.toFixed(2);row.t=st.T.toFixed(2);
  row.n=Math.round(st.N);row.il=st.Il.toFixed(2);row.pout=st.Pout.toFixed(1);row.eff=st.eff.toFixed(1);
  obsBody.innerHTML=tableEntries.map(e=>`<tr><td>${e.load}</td><td>${e.s1}</td><td>${e.s2}</td><td>${e.t}</td><td>${e.n}</td><td>${e.il}</td><td>${e.pout}</td><td>${e.eff}</td></tr>`).join('');
}

// === 3D SCENE ===
const container=document.getElementById('three-container');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x0a0d14,.012);
const camera=new THREE.PerspectiveCamera(40,1,.1,200);
camera.position.set(8,6,10);

const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;controls.target.set(0,1.5,0);controls.update();

// Lights
scene.add(new THREE.AmbientLight(0x445566,.5));
const dl=new THREE.DirectionalLight(0xffffff,.9);dl.position.set(6,10,6);dl.castShadow=true;
dl.shadow.mapSize.set(1024,1024);scene.add(dl);
const pl2=new THREE.PointLight(0x4facfe,.4,25);pl2.position.set(-4,5,3);scene.add(pl2);

// Ground
const gnd=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x0d1117,roughness:.95}));
gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;scene.add(gnd);

// Base plate
const base=new THREE.Mesh(new THREE.BoxGeometry(10,.2,4),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.3,roughness:.6}));
base.position.set(0,.1,0);base.receiveShadow=true;scene.add(base);

// Motor body
const motorMat=new THREE.MeshStandardMaterial({color:0x2a3a5c,metalness:.65,roughness:.3});
const motorBody=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,3,32),motorMat);
motorBody.rotation.z=Math.PI/2;motorBody.position.set(-2,1.8,0);motorBody.castShadow=true;scene.add(motorBody);

// Motor end caps
const capMat=new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.8,roughness:.15});
[-3.5,-.5].forEach(x=>{
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,.12,32),capMat);
  cap.rotation.z=Math.PI/2;cap.position.set(x,1.8,0);scene.add(cap);
});

// Terminal box
const termBox=new THREE.Mesh(new THREE.BoxGeometry(.9,.35,.6),new THREE.MeshStandardMaterial({color:0x334155,metalness:.5,roughness:.4}));
termBox.position.set(-2,3.2,0);scene.add(termBox);
[-0.15,0.15].forEach(z=>{
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.2,8),new THREE.MeshStandardMaterial({color:0xfbbf24,metalness:.9}));
  post.position.set(-2,3.45,z);scene.add(post);
});

// Nameplate
const namePlate=new THREE.Mesh(new THREE.PlaneGeometry(.7,.4),new THREE.MeshStandardMaterial({color:0xd4d4d8,metalness:.3,roughness:.7}));
namePlate.position.set(-2,2.2,1.31);scene.add(namePlate);

// Cooling fins
for(let i=0;i<8;i++){
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.05,2.2,.15),new THREE.MeshStandardMaterial({color:0x334155,metalness:.5,roughness:.4}));
  const angle=(i/8)*Math.PI*2;
  fin.position.set(-2+Math.cos(angle)*1.2,1.8,Math.sin(angle)*1.2);
  fin.rotation.y=angle;scene.add(fin);
}

// Shaft (rotating group)
const rotGroup=new THREE.Group();
const shaftMat=new THREE.MeshStandardMaterial({color:0x94a3b8,metalness:.9,roughness:.1});
const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,6,16),shaftMat);
shaft.rotation.z=Math.PI/2;shaft.position.set(1,1.8,0);shaft.castShadow=true;
rotGroup.add(shaft);

// Brake drum
const drumMat=new THREE.MeshStandardMaterial({color:0x475569,metalness:.55,roughness:.35});
const drum=new THREE.Mesh(new THREE.CylinderGeometry(1,.95,1,32),drumMat);
drum.rotation.z=Math.PI/2;drum.position.set(2.5,1.8,0);drum.castShadow=true;
rotGroup.add(drum);

// Drum end rings
const ringMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:.7,roughness:.2});
[2,3].forEach(x=>{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.06,8,32),ringMat);
  ring.position.set(x,1.8,0);ring.rotation.y=Math.PI/2;rotGroup.add(ring);
});

// Shaft key
const key=new THREE.Mesh(new THREE.BoxGeometry(.06,.15,.06),shaftMat);
key.position.set(2.5,1.93,0);rotGroup.add(key);
scene.add(rotGroup);

// Brake belt
const beltMat=new THREE.MeshStandardMaterial({color:0x92400e,metalness:.25,roughness:.75});
const belt=new THREE.Mesh(new THREE.TorusGeometry(1.05,.08,12,48),beltMat);
belt.position.set(2.5,1.8,0);belt.rotation.y=Math.PI/2;scene.add(belt);

// Spring balance assemblies
function makeSpring(x,z,color){
  const g=new THREE.Group();
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.4,8),new THREE.MeshStandardMaterial({color:0x94a3b8,metalness:.8,roughness:.15}));
  post.position.set(0,.8,0);g.add(post);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.3,1.2,.18),new THREE.MeshStandardMaterial({color:color,metalness:.35,roughness:.5}));
  body.position.set(0,1.4,0);g.add(body);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.22,.8),new THREE.MeshStandardMaterial({color:0xffffff,metalness:.1,roughness:.8}));
  face.position.set(0,1.4,.1);g.add(face);
  const hook=new THREE.Mesh(new THREE.TorusGeometry(.06,.02,6,12),new THREE.MeshStandardMaterial({color:0xd1d5db,metalness:.7}));
  hook.position.set(0,.15,0);g.add(hook);
  g.position.set(x,0,z);scene.add(g);
  return g;
}
const spring1=makeSpring(2.5,2,0xef4444);
const spring2=makeSpring(2.5,-2,0x3b82f6);

// Ropes
function makeRope(from,to){
  const pts=[new THREE.Vector3(from.x,from.y,from.z),new THREE.Vector3(to.x,to.y,to.z)];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({color:0xd97706,linewidth:2});
  const ln=new THREE.Line(geo,mat);scene.add(ln);
  return{line:ln,geo,update(f,t){
    const a=geo.attributes.position.array;
    a[0]=f.x;a[1]=f.y;a[2]=f.z;a[3]=t.x;a[4]=t.y;a[5]=t.z;
    geo.attributes.position.needsUpdate=true;
  }};
}
const rope1=makeRope({x:2.5,y:1.8,z:1.5},{x:2.5,y:1.8,z:1.05});
const rope2=makeRope({x:2.5,y:1.8,z:-1.5},{x:2.5,y:1.8,z:-1.05});

// === SPEEDOMETER (Canvas-textured 3D Gauge) ===
const speedoCanvas=document.createElement('canvas');
speedoCanvas.width=256;speedoCanvas.height=256;
const sctx=speedoCanvas.getContext('2d');
const speedoTex=new THREE.CanvasTexture(speedoCanvas);

function drawSpeedoFace(rpm){
  const c=sctx,w=256,h=256,cx=128,cy=128,r=110;
  c.clearRect(0,0,w,h);
  // Background
  c.fillStyle='#0f172a';c.beginPath();c.arc(cx,cy,r+10,0,Math.PI*2);c.fill();
  // Outer ring
  c.strokeStyle='#334155';c.lineWidth=4;c.beginPath();c.arc(cx,cy,r+8,0,Math.PI*2);c.stroke();
  // Colored arcs: green(0-900), yellow(900-1200), red(1200-1800)
  const startA=Math.PI*0.75, endA=Math.PI*2.25, range=endA-startA;
  [[0,.5,'#22c55e'],[.5,.67,'#eab308'],[.67,1,'#ef4444']].forEach(([s,e,col])=>{
    c.strokeStyle=col;c.lineWidth=8;c.beginPath();
    c.arc(cx,cy,r-6,startA+s*range,startA+e*range);c.stroke();
  });
  // Tick marks and numbers
  const maxRPM=1800;
  for(let i=0;i<=18;i++){
    const frac=i/18, ang=startA+frac*range;
    const cos=Math.cos(ang),sin=Math.sin(ang);
    const inner=i%3===0?r-22:r-16, outer=r-8;
    c.strokeStyle=i%3===0?'#e2e8f0':'#64748b';c.lineWidth=i%3===0?2:1;
    c.beginPath();c.moveTo(cx+cos*inner,cy+sin*inner);c.lineTo(cx+cos*outer,cy+sin*outer);c.stroke();
    if(i%3===0){
      c.fillStyle='#e2e8f0';c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(Math.round(frac*maxRPM),cx+cos*(r-34),cy+sin*(r-34));
    }
  }
  // RPM label
  c.fillStyle='#94a3b8';c.font='bold 11px sans-serif';c.textAlign='center';
  c.fillText('RPM',cx,cy+35);
  // Digital readout
  c.fillStyle='#34d399';c.font='bold 20px monospace';c.fillText(Math.round(rpm),cx,cy+55);
  // Needle
  const nFrac=Math.min(rpm/maxRPM,1), nAng=startA+nFrac*range;
  c.save();c.translate(cx,cy);c.rotate(nAng);
  c.fillStyle='#ef4444';c.beginPath();c.moveTo(0,-3);c.lineTo(r-30,0);c.lineTo(0,3);c.fill();
  c.restore();
  // Center cap
  c.fillStyle='#d4d4d8';c.beginPath();c.arc(cx,cy,8,0,Math.PI*2);c.fill();
  speedoTex.needsUpdate=true;
}
drawSpeedoFace(1500);

const speedoGroup=new THREE.Group();
// Stand
const sPost=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,3,12),new THREE.MeshStandardMaterial({color:0x334155,metalness:.6,roughness:.3}));
sPost.position.set(0,1.5,0);speedoGroup.add(sPost);
// Gauge housing
const housing=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,.15,32),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.7,roughness:.2}));
housing.position.set(0,3.2,0);housing.rotation.x=Math.PI/5;speedoGroup.add(housing);
// Gauge face with canvas texture
const gaugeFace=new THREE.Mesh(new THREE.CircleGeometry(1.05,32),new THREE.MeshBasicMaterial({map:speedoTex}));
gaugeFace.position.set(0,3.22,.09);gaugeFace.rotation.x=Math.PI/5;speedoGroup.add(gaugeFace);
// Glowing rim
const rim=new THREE.Mesh(new THREE.TorusGeometry(1.08,.05,8,48),new THREE.MeshStandardMaterial({color:0x34d399,metalness:.8,roughness:.2,emissive:0x34d399,emissiveIntensity:.4}));
rim.position.set(0,3.22,.09);rim.rotation.x=Math.PI/5;speedoGroup.add(rim);
// Label "SPEED" plate
const labelPlate=new THREE.Mesh(new THREE.PlaneGeometry(1,.25),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.2,roughness:.8}));
labelPlate.position.set(0,2.5,.05);speedoGroup.add(labelPlate);

speedoGroup.position.set(-4.8,0,2);
scene.add(speedoGroup);

// === HTML Overlay Speedometer (always visible in corner) ===
const overlayDiv=document.createElement('div');
overlayDiv.id='speedo-overlay';
overlayDiv.style.cssText='position:absolute;bottom:12px;left:12px;width:160px;height:160px;pointer-events:none;z-index:10;';
const overlayCanvas=document.createElement('canvas');
overlayCanvas.width=200;overlayCanvas.height=200;
overlayCanvas.style.cssText='width:160px;height:160px;';
overlayDiv.appendChild(overlayCanvas);
container.appendChild(overlayDiv);
const octx=overlayCanvas.getContext('2d');

function drawOverlayGauge(rpm){
  const c=octx,w=200,h=200,cx=100,cy=100,r=85;
  c.clearRect(0,0,w,h);
  // Glass bg
  c.fillStyle='rgba(15,23,42,0.85)';c.beginPath();c.arc(cx,cy,r+10,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(79,172,254,0.3)';c.lineWidth=2;c.beginPath();c.arc(cx,cy,r+8,0,Math.PI*2);c.stroke();
  // Arcs
  const sa=Math.PI*0.75,ea=Math.PI*2.25,rng=ea-sa;
  [[0,.5,'#22c55e'],[.5,.67,'#eab308'],[.67,1,'#ef4444']].forEach(([s,e,col])=>{
    c.strokeStyle=col;c.lineWidth=6;c.beginPath();c.arc(cx,cy,r-4,sa+s*rng,sa+e*rng);c.stroke();
  });
  // Ticks & numbers
  for(let i=0;i<=18;i++){
    const f=i/18,ang=sa+f*rng,cos=Math.cos(ang),sin=Math.sin(ang);
    const inn=i%3===0?r-18:r-12,out=r-5;
    c.strokeStyle=i%3===0?'#e2e8f0':'#64748b';c.lineWidth=i%3===0?2:1;
    c.beginPath();c.moveTo(cx+cos*inn,cy+sin*inn);c.lineTo(cx+cos*out,cy+sin*out);c.stroke();
    if(i%3===0){
      c.fillStyle='#e2e8f0';c.font='bold 10px sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(Math.round(f*1800),cx+cos*(r-28),cy+sin*(r-28));
    }
  }
  c.fillStyle='#94a3b8';c.font='bold 9px sans-serif';c.textAlign='center';
  c.fillText('RPM',cx,cy+25);
  c.fillStyle='#34d399';c.font='bold 18px monospace';c.fillText(Math.round(rpm),cx,cy+45);
  // Needle
  const nf=Math.min(rpm/1800,1),na=sa+nf*rng;
  c.save();c.translate(cx,cy);c.rotate(na);
  c.fillStyle='#ef4444';c.beginPath();c.moveTo(0,-2.5);c.lineTo(r-25,0);c.lineTo(0,2.5);c.fill();
  c.restore();
  c.fillStyle='#d4d4d8';c.beginPath();c.arc(cx,cy,6,0,Math.PI*2);c.fill();
}

// Resize
function resize(){
  const r=container.getBoundingClientRect();
  renderer.setSize(r.width,r.height);
  camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
}
resize();window.addEventListener('resize',resize);

// Animation
let last=performance.now();
let prevCL=-1;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.05);last=now;

  const sv=+slider.value;
  if(sv!==S.load){S.load=sv;loadDisp.textContent=S.load+'%';updateTrack();}
  const rv=+rheoSlider.value;
  if(rv!==S.Rh){S.Rh=rv;rheoDisp.textContent=S.Rh+'Ω';updateRheoTrack();}

  const st=S.calc(S.load);

  // Rotate shaft
  const rotSpd=(st.N/60)*Math.PI*2;
  rotGroup.rotation.x+=rotSpd*dt*.04;

  // Belt tightening
  const tightness=1-st.pct*.05;
  belt.scale.set(1,1,tightness);
  belt.material.color.setHex(st.pct>.6?0xb91c1c:0x92400e);

  // Spring balance displacement
  spring1.position.y=-st.pct*.5;
  spring2.position.y=st.pct*.2;

  // Update ropes
  rope1.update({x:2.5,y:1.8-st.pct*.5+.15,z:1.8},{x:2.5,y:1.8,z:1.05});
  rope2.update({x:2.5,y:1.8+st.pct*.2+.15,z:-1.8},{x:2.5,y:1.8,z:-1.05});

  // Update speedometer displays
  drawSpeedoFace(st.N);
  drawOverlayGauge(st.N);
  // Rim color changes with speed
  const nFrac=Math.min(st.N/(S.N0*1.3),1);
  const hue=nFrac>.7?0xef4444:(nFrac>.4?0xf5a623:0x34d399);
  rim.material.color.setHex(hue);rim.material.emissive.setHex(hue);

  // Gauges
  gIl.textContent=st.Il.toFixed(2);gIa.textContent=st.Ia.toFixed(2);
  gS1.textContent=st.S1.toFixed(2);gS2.textContent=st.S2.toFixed(2);
  gSpd.textContent=Math.round(st.N);gT.textContent=st.T.toFixed(2);
  gP.textContent=st.Pout.toFixed(1);gE.textContent=st.eff.toFixed(1);

  // Chart + table updates
  if(Math.abs(S.load-prevCL)>=2||prevCL<0){updateAllCharts(st);prevCL=S.load;}

  controls.update();
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

})();
