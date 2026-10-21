/* sim.js — Shared simulation engine for DC Shunt Motor Load Test */
(function(){
"use strict";

// Load params from sessionStorage or use defaults
function getParams(){
  try{
    const s=sessionStorage.getItem('motorParams');
    if(s) return JSON.parse(s);
  }catch(e){}
  return {Vs:220, Ra:0.5, Rf:220, N0:1500, R:0.1, Fuse:15};
}

const P=getParams();
window.SIM={
  params:P,
  Vs:P.Vs, Ra:P.Ra, Rf:P.Rf, N0:P.N0, R:P.R, Fuse:P.Fuse,
  If: P.Vs/P.Rf,
  load:0,
  Rh:0,  // Rheostat resistance (0 to 200 Ω)

  // Derived constants
  // Back-EMF constant: Eb0 ≈ Vs at no load, KbPhi = Eb0 / omega0
  get KbPhi(){ 
    const If = this.Vs / (this.Rf + this.Rh);
    const If0 = this.Vs / this.Rf;
    // Flux is proportional to field current
    const fluxRatio = If / If0;
    return (this.Vs / (this.N0*Math.PI/30)) * fluxRatio; 
  },

  calc: function(loadPct){
    const pct = loadPct/100;
    
    // Field current with rheostat
    const If = this.Vs / (this.Rf + this.Rh);
    const If0 = this.Vs / this.Rf;
    const fluxRatio = If / If0;

    // Spring balance readings (kg): S1 increases, S2 decreases with load
    const S1 = pct * 8;     // tight side (kg)
    const S2 = pct * 0.5;   // slack side (kg)
    const S1minusS2 = S1 - S2;

    // Torque: T = 9.81 × (S1 - S2) × R
    const T = 9.81 * S1minusS2 * this.R;

    // KbPhi for this field current
    const KbPhi0 = this.Vs / (this.N0*Math.PI/30);
    const KbPhi = KbPhi0 * fluxRatio;

    // Armature current from torque: T = KbPhi × Ia → Ia = T / KbPhi
    const Ia = KbPhi > 0.001 ? T / KbPhi : 0;

    // Line current
    const Il = If + Ia;

    // Back EMF
    const Eb = this.Vs - Ia * this.Ra;

    // Speed: N = Eb / KbPhi × (30/π)
    // With reduced flux, speed increases (speed is inversely proportional to flux)
    const N = KbPhi > 0.001 ? Math.max(50, (Eb / KbPhi) * (30/Math.PI)) : this.N0;

    // Powers
    const omega = N * Math.PI / 30;
    const Pout = T * omega;
    const Pin = this.Vs * Il;

    // Efficiency
    const eff = (Pin > 5 && pct > 0.01) ? Math.min((Pout/Pin)*100, 98) : 0;

    return { pct, S1, S2, T, Ia, If, Il, Eb, N, Pout, Pin, eff, Rh: this.Rh };
  },

  // Render parameter pills into a container
  renderPills: function(container){
    const pills = [
      `V = ${this.Vs}V`, `Ra = ${this.Ra}Ω`, `Rf = ${this.Rf}Ω`,
      `N₀ = ${this.N0} RPM`, `R = ${this.R}m`, `Fuse = ${this.Fuse}A`
    ];
    pills.forEach(t=>{
      const s=document.createElement('span');
      s.className='pill';s.textContent=t;
      container.appendChild(s);
    });
  }
};
})();
