/* circuit.js — 2D Circuit canvas for DC Shunt Motor Load Test
   Draws: DPST switch → Fuse → Ammeter → 3-point starter → Motor (Armature ∥ Field+Rheostat)
          Voltmeter across supply, Brake drum + spring balances on shaft side
   Variable Rheostat with adjustable slider, animated current-flow particles */
(function(){
"use strict";
const S = window.SIM;
S.renderPills(document.getElementById('pills'));

// Sliders
const slider = document.getElementById('load-slider');
const loadDisp = document.getElementById('load-val');
const rheoSlider = document.getElementById('rheostat-slider');
const rheoDisp = document.getElementById('rheostat-val');

function onSlider(){ S.load=+slider.value; loadDisp.textContent=S.load+'%'; updateTrack(); }
slider.addEventListener('input',onSlider);
slider.addEventListener('change',onSlider);
function updateTrack(){ slider.style.background=`linear-gradient(90deg,#4facfe ${S.load}%,#151a2a ${S.load}%)`; }
updateTrack();

function onRheo(){ S.Rh=+rheoSlider.value; rheoDisp.textContent=S.Rh+'Ω'; updateRheoTrack(); }
rheoSlider.addEventListener('input',onRheo);
rheoSlider.addEventListener('change',onRheo);
function updateRheoTrack(){ const pct=(S.Rh/200)*100; rheoSlider.style.background=`linear-gradient(90deg,#a78bfa ${pct}%,#151a2a ${pct}%)`; }
updateRheoTrack();

// Gauge elements
const gIl=document.getElementById('g-il'), gIa=document.getElementById('g-ia'),
      gIf=document.getElementById('g-if'), gS1=document.getElementById('g-s1'),
      gS2=document.getElementById('g-s2'), gSpd=document.getElementById('g-speed'),
      gT=document.getElementById('g-torque'), gP=document.getElementById('g-pout'),
      gE=document.getElementById('g-eff');

// Auto-scale helper
function autoScale(arr,key,pad){
  if(!arr.length)return{min:0,max:100};
  let mn=Infinity,mx=-Infinity;
  arr.forEach(p=>{const v=p[key||'y'];if(v<mn)mn=v;if(v>mx)mx=v;});
  const range=mx-mn||1;
  const margin=range*(pad||0.15);
  return{min:Math.max(0,Math.floor(mn-margin)),max:Math.ceil(mx+margin)};
}

// Chart 1: Performance (Efficiency, Speed, Torque vs Output Power)
const chartCtx=document.getElementById('perf-chart').getContext('2d');
let chartPts={eff:[],spd:[],trq:[]};
const chartData={datasets:[
  {label:'Efficiency η (%)',data:[],borderColor:'#a78bfa',backgroundColor:'#a78bfa18',fill:true,tension:.35,borderWidth:2,pointRadius:3,pointBackgroundColor:'#a78bfa',yAxisID:'y'},
  {label:'Speed N (RPM)',data:[],borderColor:'#34d399',backgroundColor:'transparent',tension:.35,borderWidth:2,pointRadius:3,pointBackgroundColor:'#34d399',yAxisID:'y1'},
  {label:'Torque T (N·m)',data:[],borderColor:'#f5a623',backgroundColor:'transparent',tension:.35,borderWidth:2,pointRadius:3,pointBackgroundColor:'#f5a623',yAxisID:'y1'}
]};
const chart=new Chart(chartCtx,{type:'line',data:chartData,options:{
  responsive:true,maintainAspectRatio:false,animation:{duration:200},
  scales:{
    x:{type:'linear',title:{display:true,text:'Output Power (W)',color:'#94a3b8',font:{family:'Outfit'}},ticks:{color:'#64748b'},grid:{color:'#1f264033'},min:0},
    y:{position:'left',title:{display:true,text:'Efficiency (%)',color:'#a78bfa',font:{family:'Outfit'}},ticks:{color:'#a78bfa',stepSize:5},grid:{color:'#1f264033'}},
    y1:{position:'right',title:{display:true,text:'Speed / Torque',color:'#34d399',font:{family:'Outfit'}},ticks:{color:'#34d399'},grid:{display:false}}
  },
  plugins:{legend:{labels:{color:'#e2e8f0',font:{family:'Outfit',size:11}}}}
}});

// Chart 2: Load vs Speed & Torque
const lstCtx=document.getElementById('chart-lst').getContext('2d');
let lstSpdData=[],lstTrqData=[];
const lstChart=new Chart(lstCtx,{type:'line',data:{datasets:[
  {label:'Speed (RPM)',data:[],borderColor:'#34d399',tension:.3,borderWidth:2,pointRadius:3,yAxisID:'yL',pointBackgroundColor:'#34d399'},
  {label:'Torque (N·m)',data:[],borderColor:'#f5a623',tension:.3,borderWidth:2,pointRadius:3,yAxisID:'yR',pointBackgroundColor:'#f5a623'}
]},options:{
  responsive:true,maintainAspectRatio:false,animation:{duration:200},
  scales:{
    x:{type:'linear',title:{display:true,text:'Load (%)',color:'#94a3b8',font:{family:'Outfit'}},ticks:{color:'#64748b'},grid:{color:'#1f264033'},min:0,max:100},
    yL:{position:'left',title:{display:true,text:'Speed (RPM)',color:'#34d399',font:{family:'Outfit'}},ticks:{color:'#34d399',stepSize:10},grid:{color:'#1f264033'}},
    yR:{position:'right',title:{display:true,text:'Torque (N·m)',color:'#f5a623',font:{family:'Outfit'}},ticks:{color:'#f5a623'},grid:{display:false}}
  },
  plugins:{legend:{labels:{color:'#e2e8f0',font:{family:'Outfit',size:11}}}}
}});

// Table
const obsBody=document.getElementById('obs-body');
let tableEntries=[];

function updateChart(s){
  if(s.Pout<2)return;
  const x=Math.round(s.Pout);
  const xL=Math.round(s.pct*100);
  function upsert(arr,xv,yv,thr){
    const ex=arr.find(p=>Math.abs(p.x-xv)<thr);
    if(ex){ex.x=xv;ex.y=yv;}else{arr.push({x:xv,y:yv});arr.sort((a,b)=>a.x-b.x);}
  }
  upsert(chartPts.eff,x,+s.eff.toFixed(1),25);
  upsert(chartPts.spd,x,Math.round(s.N),25);
  upsert(chartPts.trq,x,+s.T.toFixed(2),25);
  
  // Auto-scale efficiency axis
  const effS=autoScale(chartPts.eff,'y',0.1);
  chart.options.scales.y.min=effS.min;chart.options.scales.y.max=effS.max;
  // Auto-scale speed/torque axis
  const allSpdTrq=[...chartPts.spd,...chartPts.trq];
  if(allSpdTrq.length>0){
    const stS=autoScale(allSpdTrq,'y',0.1);
    chart.options.scales.y1.min=stS.min;chart.options.scales.y1.max=stS.max;
  }
  
  chartData.datasets[0].data=[...chartPts.eff];
  chartData.datasets[1].data=[...chartPts.spd];
  chartData.datasets[2].data=[...chartPts.trq];
  chart.update();

  // Load vs Speed & Torque chart
  upsert(lstSpdData,xL,Math.round(s.N),2);
  upsert(lstTrqData,xL,+s.T.toFixed(2),2);
  const lsS=autoScale(lstSpdData,'y',0.05);
  lstChart.options.scales.yL.min=lsS.min;lstChart.options.scales.yL.max=lsS.max;
  const ltS=autoScale(lstTrqData,'y',0.1);
  lstChart.options.scales.yR.min=ltS.min;lstChart.options.scales.yR.max=ltS.max;
  lstChart.data.datasets[0].data=[...lstSpdData];
  lstChart.data.datasets[1].data=[...lstTrqData];
  lstChart.update();

  // Update table
  const key=xL;
  let row=tableEntries.find(e=>e.load===key);
  if(!row){row={load:key};tableEntries.push(row);tableEntries.sort((a,b)=>a.load-b.load);}
  row.s1=s.S1.toFixed(2);row.s2=s.S2.toFixed(2);row.t=s.T.toFixed(2);
  row.n=Math.round(s.N);row.il=s.Il.toFixed(2);row.pout=s.Pout.toFixed(1);row.eff=s.eff.toFixed(1);
  obsBody.innerHTML=tableEntries.map(e=>`<tr><td>${e.load}</td><td>${e.s1}</td><td>${e.s2}</td><td>${e.t}</td><td>${e.n}</td><td>${e.il}</td><td>${e.pout}</td><td>${e.eff}</td></tr>`).join('');
}

// Canvas setup
const canvas=document.getElementById('circuit-canvas');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){
  const r=canvas.parentElement.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio,2);
  canvas.width=r.width*dpr; canvas.height=r.height*dpr;
  W=r.width; H=r.height;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize(); window.addEventListener('resize',resize);

// Coordinate helper
function p(nx,ny){return{x:nx*W,y:ny*H};}

// Particle system
class Particle{
  constructor(path,speed,color){this.path=path;this.t=Math.random();this.speed=speed;this.color=color;}
  update(dt){this.t=(this.t+this.speed*dt)%1;}
  draw(){
    const pos=this.getPos();
    ctx.beginPath();ctx.arc(pos.x,pos.y,3,0,Math.PI*2);ctx.fillStyle=this.color;ctx.fill();
    ctx.beginPath();ctx.arc(pos.x,pos.y,5.5,0,Math.PI*2);ctx.fillStyle=this.color+'30';ctx.fill();
  }
  getPos(){
    const pts=this.path;const n=pts.length-1;const seg=Math.floor(this.t*n);const l=(this.t*n)-seg;
    const a=pts[Math.min(seg,n)],b=pts[Math.min(seg+1,n)];
    return{x:a.x+(b.x-a.x)*l, y:a.y+(b.y-a.y)*l};
  }
}

function mainPath(){
  return [p(.06,.78),p(.06,.18),p(.18,.18),p(.30,.18),p(.42,.18),p(.52,.18)];
}
function armPath(){
  return [p(.52,.18),p(.62,.18),p(.62,.38),p(.62,.68),p(.62,.82),p(.52,.82),p(.06,.82),p(.06,.78)];
}
function fldPath(){
  return [p(.52,.18),p(.48,.18),p(.48,.28),p(.48,.38),p(.48,.68),p(.48,.82),p(.52,.82)];
}

let mainParts=[], armParts=[], fldParts=[];
function initParticles(){
  mainParts=[];armParts=[];fldParts=[];
  for(let i=0;i<10;i++) mainParts.push(new Particle(mainPath(),.06,'#4facfe'));
  for(let i=0;i<8;i++) armParts.push(new Particle(armPath(),.05,'#f5a623'));
  for(let i=0;i<5;i++) fldParts.push(new Particle(fldPath(),.045,'#34d399'));
}
initParticles();

// Drawing helpers
function line(a,b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
function drawBox(cx,cy,w,h,label,color,sub){
  const x=cx-w/2,y=cy-h/2;
  ctx.fillStyle='#131825';ctx.strokeStyle=color;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.font='bold 11px Outfit';ctx.textAlign='center';
  ctx.fillText(label,cx,cy-(sub?5:0));
  if(sub){ctx.font='10px JetBrains Mono';ctx.fillStyle=color+'cc';ctx.fillText(sub,cx,cy+10);}
}
function drawCircle(cx,cy,r,label,color,val){
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.fillStyle='#131825';
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.font='bold 9px Outfit';ctx.textAlign='center';
  ctx.fillText(label,cx,cy-3);
  if(val!==undefined){ctx.font='9px JetBrains Mono';ctx.fillText(val,cx,cy+9);}
}
function drawSwitch(x,y,w,label,closed){
  ctx.strokeStyle='#94a3b8';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(x+w,y,3,0,Math.PI*2);ctx.stroke();
  if(closed){
    ctx.beginPath();ctx.moveTo(x+3,y);ctx.lineTo(x+w-3,y);ctx.stroke();
  } else {
    ctx.beginPath();ctx.moveTo(x+3,y);ctx.lineTo(x+w-3,y-12);ctx.stroke();
  }
  ctx.fillStyle='#94a3b8';ctx.font='8px Outfit';ctx.textAlign='center';ctx.fillText(label,x+w/2,y-14);
}

// Variable Rheostat drawing with zigzag and arrow
function drawVariableRheostat(cx,cy,w,h,color,rhVal){
  const x=cx-w/2,y=cy-h/2;
  ctx.fillStyle='#131825';ctx.strokeStyle=color;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();ctx.stroke();
  
  // Zigzag resistor symbol
  const zx=cx-w*0.35, zw=w*0.7, zy=cy;
  const teeth=6;const tW=zw/teeth;const tH=h*0.25;
  ctx.strokeStyle=color;ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(zx,zy);
  for(let i=0;i<teeth;i++){
    ctx.lineTo(zx+(i+0.25)*tW,zy-tH);
    ctx.lineTo(zx+(i+0.75)*tW,zy+tH);
  }
  ctx.lineTo(zx+zw,zy);
  ctx.stroke();
  
  // Arrow (variable indicator) — diagonal arrow through middle
  const arrowPct=Math.min(S.Rh/200,1);
  const ax=cx-w*0.15+arrowPct*w*0.3;
  const ay1=cy+h*0.4,ay2=cy-h*0.4;
  ctx.strokeStyle='#e2e8f0';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(ax-5,ay1);ctx.lineTo(ax+5,ay2);ctx.stroke();
  // Arrowhead
  ctx.beginPath();ctx.moveTo(ax+5,ay2);ctx.lineTo(ax+1,ay2+5);ctx.moveTo(ax+5,ay2);ctx.lineTo(ax+9,ay2+3);ctx.stroke();
  
  // Label
  ctx.fillStyle=color;ctx.font='bold 9px Outfit';ctx.textAlign='center';
  ctx.fillText('RHEOSTAT',cx,cy-h/2-4);
  ctx.font='9px JetBrains Mono';ctx.fillStyle='#e2e8f0';
  ctx.fillText(rhVal+'Ω',cx,cy+h/2+10);
}

function drawBrakeDrum(cx,cy,loadPct,state){
  const r=35;
  ctx.strokeStyle='#475569';ctx.lineWidth=2;ctx.fillStyle='#1e293b';
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#94a3b8';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(cx-r-20,cy);ctx.lineTo(cx-r,cy);ctx.stroke();
  const angle=performance.now()/1000*(state.N/60)*Math.PI*2*0.02;
  ctx.strokeStyle='#4facfe';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*r*.7,cy+Math.sin(angle)*r*.7);ctx.stroke();
  const beltColor=loadPct>.5?'#b91c1c':'#92400e';
  ctx.strokeStyle=beltColor;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy,r+4,-.3,Math.PI+.3);ctx.stroke();
  const s1y=cy-r-25;
  ctx.strokeStyle='#f87171';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx+r*.7,cy-r);ctx.lineTo(cx+r*.7+15,s1y);ctx.stroke();
  drawBox(cx+r*.7+15,s1y-12,38,18,'S₁','#f87171',state.S1.toFixed(2)+'kg');
  const s2y=cy+r+25;
  ctx.strokeStyle='#4facfe';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx+r*.7,cy+r);ctx.lineTo(cx+r*.7+15,s2y);ctx.stroke();
  drawBox(cx+r*.7+15,s2y+12,38,18,'S₂','#4facfe',state.S2.toFixed(2)+'kg');
  ctx.fillStyle='#64748b';ctx.font='9px Outfit';ctx.textAlign='center';
  ctx.fillText('Brake Drum',cx,cy+r+50);
}

function drawMotorSymbol(cx,cy,r){
  ctx.strokeStyle='#f5a623';ctx.lineWidth=2;ctx.fillStyle='#1a1510';
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f5a623';ctx.font='bold 13px Outfit';ctx.textAlign='center';
  ctx.fillText('M',cx,cy+5);
}

// Main draw
function draw(dt){
  ctx.clearRect(0,0,W,H);
  const state=S.calc(S.load);
  const pct=state.pct;
  const baseSpd=.035;

  const mainSpd=baseSpd+pct*.15;
  const armSpd=baseSpd+pct*.18;
  const fldSpd=baseSpd+.015;

  mainParts.forEach(p=>{p.path=mainPath();p.speed=mainSpd;p.update(dt);});
  armParts.forEach(p=>{p.path=armPath();p.speed=armSpd;p.update(dt);});
  fldParts.forEach(p=>{p.path=fldPath();p.speed=fldSpd;p.update(dt);});

  const tMain=10+Math.floor(pct*14);
  while(mainParts.length<tMain) mainParts.push(new Particle(mainPath(),mainSpd,'#4facfe'));
  while(mainParts.length>tMain&&mainParts.length>5) mainParts.pop();
  const tArm=8+Math.floor(pct*18);
  while(armParts.length<tArm) armParts.push(new Particle(armPath(),armSpd,'#f5a623'));
  while(armParts.length>tArm&&armParts.length>4) armParts.pop();

  // Draw wires — matching reference circuit layout
  ctx.strokeStyle='#334155';ctx.lineWidth=2;
  // Main top line: Supply+ up then right through components
  line(p(.06,.78),p(.06,.18)); line(p(.06,.18),p(.52,.18));
  // Bottom return line
  line(p(.06,.82),p(.52,.82));
  // Field branch (left of motor): junction down through rheostat & field
  line(p(.52,.18),p(.48,.18)); line(p(.48,.18),p(.48,.28));
  line(p(.48,.38),p(.48,.42)); line(p(.48,.64),p(.48,.82));
  // Armature branch (right of motor): junction right then down
  line(p(.52,.18),p(.62,.18)); line(p(.62,.18),p(.62,.38));
  line(p(.62,.64),p(.62,.82)); line(p(.62,.82),p(.52,.82));
  line(p(.48,.82),p(.52,.82));
  // Shaft line from motor to brake drum
  ctx.strokeStyle='#94a3b8';ctx.lineWidth=3;
  line(p(.55,.53),p(.78,.53));

  // Components
  // DC Supply
  drawBox(p(.06,.50).x,p(0,.50).y,50,70,'DC\nSUPPLY','#4facfe',S.Vs+'V');
  ctx.fillStyle='#34d399';ctx.font='bold 14px Outfit';ctx.textAlign='center';
  ctx.fillText('+',p(.06,.30).x,p(0,.30).y);
  ctx.fillStyle='#f87171';ctx.fillText('−',p(.06,.86).x,p(0,.86).y);

  // DPST Switch
  drawSwitch(p(.09,.18).x,p(0,.18).y,W*.05,'DPST',true);
  // Fuse
  drawBox(p(.20,.18).x,p(0,.18).y,36,18,'FUSE','#f87171',S.Fuse+'A');
  // Ammeter
  drawCircle(p(.30,.18).x,p(0,.18).y,14,'A','#4facfe',state.Il.toFixed(1)+'A');
  // 3-Point Starter
  drawBox(p(.42,.18).x,p(0,.18).y,48,22,'STARTER','#94a3b8','3-Point');

  // Voltmeter across supply
  ctx.strokeStyle='#334155';ctx.lineWidth=1;ctx.setLineDash([4,3]);
  line(p(.13,.30),p(.13,.45)); line(p(.13,.58),p(.13,.78));
  ctx.setLineDash([]);
  drawCircle(p(.13,.51).x,p(0,.51).y,14,'V','#00f2fe',S.Vs+'V');

  // Variable Rheostat in field branch (between starter and F1)
  drawVariableRheostat(p(.48,.33).x,p(0,.33).y,50,20,'#a78bfa',S.Rh);

  // Field Winding (left branch, below rheostat)
  drawBox(p(.48,.53).x,p(0,.53).y,44,40,'FIELD','#34d399','Rf='+S.Rf+'Ω');
  ctx.fillStyle='#34d399';ctx.font='8px Outfit';ctx.textAlign='center';
  ctx.fillText('F₁',p(.48,.40).x,p(0,.40).y);
  ctx.fillText('F₂',p(.48,.66).x,p(0,.66).y);
  ctx.fillStyle='#86efac';ctx.font='9px JetBrains Mono';
  ctx.fillText('If='+state.If.toFixed(2)+'A',p(.48,.72).x,p(0,.72).y);

  // Motor M (center between field and armature)
  drawMotorSymbol(p(.55,.53).x,p(0,.53).y,24);

  // Armature labels (right branch)
  ctx.fillStyle='#f5a623';ctx.font='8px Outfit';ctx.textAlign='center';
  ctx.fillText('A₁',p(.62,.40).x,p(0,.40).y);
  ctx.fillText('A₂',p(.62,.66).x,p(0,.66).y);
  ctx.fillStyle='#f5a623';ctx.font='9px JetBrains Mono';
  ctx.fillText('Ra='+S.Ra+'Ω',p(.62,.50).x,p(0,.50).y);
  ctx.fillText('Ia='+state.Ia.toFixed(2)+'A',p(.62,.56).x,p(0,.56).y);
  ctx.fillText('Eb='+state.Eb.toFixed(1)+'V',p(.62,.73).x,p(0,.73).y);

  // Junction labels
  ctx.fillStyle='#64748b';ctx.font='8px Outfit';ctx.textAlign='left';
  ctx.fillText('A',p(.525,.16).x,p(0,.16).y);
  ctx.fillText('B',p(.525,.80).x,p(0,.80).y);

  // Line current label
  ctx.fillStyle='#94a3b8';ctx.font='10px JetBrains Mono';ctx.textAlign='left';
  ctx.fillText('Il='+state.Il.toFixed(2)+'A',p(.32,.14).x,p(0,.14).y);

  // Brake Drum (right side) with S1, S2
  drawBrakeDrum(p(.85,.53).x,p(0,.53).y,pct,state);
  // Tachometer
  drawCircle(p(.78,.42).x,p(0,.42).y,12,'T','#a78bfa',Math.round(state.N)+'');

  // Draw particles
  mainParts.forEach(pt=>pt.draw());
  armParts.forEach(pt=>pt.draw());
  fldParts.forEach(pt=>pt.draw());

  // Update gauges
  gIl.textContent=state.Il.toFixed(2);
  gIa.textContent=state.Ia.toFixed(2);
  gIf.textContent=state.If.toFixed(2);
  gS1.textContent=state.S1.toFixed(2);
  gS2.textContent=state.S2.toFixed(2);
  gSpd.textContent=Math.round(state.N);
  gT.textContent=state.T.toFixed(2);
  gP.textContent=state.Pout.toFixed(1);
  gE.textContent=state.eff.toFixed(1);
}

// Animation
let last=performance.now();
let prevL=-1;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.05); last=now;
  const sv=+slider.value;
  if(sv!==S.load){S.load=sv;loadDisp.textContent=S.load+'%';updateTrack();}
  const rv=+rheoSlider.value;
  if(rv!==S.Rh){S.Rh=rv;rheoDisp.textContent=S.Rh+'Ω';updateRheoTrack();}
  draw(dt);
  const st=S.calc(S.load);
  if(Math.abs(S.load-prevL)>=2){updateChart(st);prevL=S.load;}
}
requestAnimationFrame(animate);

})();
