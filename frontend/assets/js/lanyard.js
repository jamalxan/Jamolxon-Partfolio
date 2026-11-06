/* ============================================================
   LANYARD BEYJIK v2 (moslashtirilgan) — Three.js
   Zanjir: langar → tasma (10 bo'g'in) → qattiq metall ilgak → ip (3 bo'g'in) → karta teshigi
   - karta: T (teshik) va B (pastki nuqta) qattiq tayoq; ushlanganda kinematik (kursorga aniq qotadi)
   - ip: faqat cho'zilganda tortadi; langar–T: so'ndirilgan prujina (otilmaydi)
   - sudrashda rezina chegara: pastga/chetga tortish mumkin, qarshilik oshib boradi
   Palitra: krem karta, maroon tasma, sariq/qizil belgilar. Rasm: AVATAR_PHOTO.
   ============================================================ */
import * as THREE from './three-lite.js';

const Lanyard = (()=>{
  const CONFIG = {
    name:'JAMOLXON', initials:'JX', handle:'@jamalxon',
    bio:"Python backend dasturchi. Web saytlar, Telegram botlar, CRM/ERP, integratsiyalar va AI agentlar — g'oyadan ishga tushirishgacha, bitta jamoada.",
    email:'', location:"Toshkent, O'zbekiston", strapText:'JAMOLXON'
  };
  /* o'lchamlar */
  const CARD_W=2.75, CARD_H=3.85, CARD_D=0.035, CARD_R=0.12, HOLE_FROM_TOP=0.33, HOLE_Y_LOCAL=CARD_H/2-HOLE_FROM_TOP, HOLE_TO_BOTTOM=CARD_H-HOLE_FROM_TOP;
  const ANCHOR=new THREE.Vector3(0,3.75,0), VIEW_TOP=3.1;
  const NU=10, SEG_U=0.148, CLIP_LEN=0.30, NC=3, SEG_C=0.22, ROPE_LEN=NU*SEG_U+CLIP_LEN+NC*SEG_C;
  const GRAVITY=-26, H=1/120, ITER=12, DAMP=0.996, SWING_DAMP=0.012, ROPE_VDAMP=0.992;
  const K_ROPE=600, C_ROPE=36, SAG=-2*GRAVITY/K_ROPE, STRETCH=ROPE_LEN*1.0, MAXV=20, K_FACE=14, C_TWIST=1.8, K_DRIVE=2.2;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let started=false, canvasEl=null, stageEl=null, visible=true, io=null, renderer, scene, camera, card, front, back, body, hitPad, frontTex, backTex, strapTex, strap, cord, clip, clipA, clipB, userPhoto=null;
  const ctaSel='.hero__badgecta';

  /* ---------- karta teksturasi ---------- */
  const TEX_W=2048, TEX_H=Math.round(2048*CARD_H/CARD_W); // yuqori aniqlik: yaqinlashtirganda ham tiniq
  const frontCanvas=document.createElement('canvas'); frontCanvas.width=TEX_W; frontCanvas.height=TEX_H;
  const backCanvas=document.createElement('canvas'); backCanvas.width=TEX_W; backCanvas.height=TEX_H;
  const rr=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()};
  const wrapLines=(c,text,maxW)=>{const words=text.split(' '),lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(c.measureText(t).width>maxW&&line){lines.push(line);line=w}else line=t}if(line)lines.push(line);return lines};
  const spaced=(c,text,x,y,ls)=>{for(const ch of text){c.fillText(ch,x,y);x+=c.measureText(ch).width+ls}return x};
  function drawPlaceholder(c,w,h){
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#4a070c');g.addColorStop(1,'#250104');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.save();c.filter=`blur(${14*w/1024}px)`;c.globalAlpha=.5;for(let k=0;k<2;k++){const bx=k?w*.66:w*.12;for(let i=0;i<6;i++){c.fillStyle=i%2?'#CDF73D':'#FFF1DC';c.fillRect(bx,h*.18+i*h*.11,w*.24,h*.06)}}c.restore();
    c.fillStyle='#150103';c.beginPath();c.ellipse(w*.5,h*.44,w*.115,h*.19,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(w*.08,h);c.bezierCurveTo(w*.14,h*.7,w*.34,h*.66,w*.5,h*.66);c.bezierCurveTo(w*.66,h*.66,w*.86,h*.7,w*.92,h);c.closePath();c.fill();
    const v=c.createRadialGradient(w*.5,h*.45,h*.1,w*.5,h*.5,h*.9);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');c.fillStyle=v;c.fillRect(0,0,w,h);
  }
  function drawFront(){
    const c=frontCanvas.getContext('2d'),W=TEX_W,H=TEX_H,k=W/431;c.clearRect(0,0,W,H);
    const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#FFF1DC');bg.addColorStop(.6,'#F8E7CF');bg.addColorStop(1,'#F1DCBE');c.fillStyle=bg;c.fillRect(0,0,W,H);
    const PH=Math.round(300*k);c.save();c.beginPath();c.rect(0,0,W,PH);c.clip();
    if(userPhoto){const s=Math.max(W/userPhoto.width,PH/userPhoto.height),iw=userPhoto.width*s,ih=userPhoto.height*s;c.imageSmoothingQuality='high';c.filter='grayscale(1) contrast(1.06)';c.drawImage(userPhoto,(W-iw)/2,(PH-ih)/2*.6,iw,ih);c.filter='none'}else drawPlaceholder(c,W,PH);
    c.restore();
    const gl=c.createLinearGradient(0,0,W,H);gl.addColorStop(0,'rgba(255,255,255,.10)');gl.addColorStop(.45,'rgba(255,255,255,0)');gl.addColorStop(1,'rgba(255,255,255,.08)');c.fillStyle=gl;c.fillRect(0,0,W,H);
    const ax=90*k,ay=298*k,ar=52*k;c.fillStyle='#F1DCBE';c.beginPath();c.arc(ax,ay,ar+8*k,0,Math.PI*2);c.fill();c.fillStyle='#250104';c.beginPath();c.arc(ax,ay,ar,0,Math.PI*2);c.fill();
    c.strokeStyle='rgba(205,247,61,.28)';c.lineWidth=2*W/1024;for(let i=1;i<7;i++){c.beginPath();c.arc(ax,ay,ar*(.2+i*.11),Math.PI*.15*i,Math.PI*(1.2+.1*i));c.stroke()}
    c.fillStyle='#CDF73D';c.font=`800 ${22*k}px Unbounded`;c.textAlign='center';c.textBaseline='middle';c.fillText(CONFIG.initials,ax,ay+1);c.textAlign='left';c.textBaseline='alphabetic';
    const ix=380*k,iy=325*k,is=26*k;c.fillStyle='#D71A06';rr(c,ix,iy,is,is,3*k);c.fill();c.strokeStyle='#fff';c.lineWidth=2.4*k;c.lineCap='round';c.lineJoin='round';
    c.beginPath();c.moveTo(ix+8*k,iy+18*k);c.lineTo(ix+18*k,iy+8*k);c.moveTo(ix+10*k,iy+8*k);c.lineTo(ix+18*k,iy+8*k);c.lineTo(ix+18*k,iy+16*k);c.stroke();
    c.fillStyle='#250104';c.font=`800 ${17*k}px Unbounded`;const endX=spaced(c,CONFIG.name,21*k,398*k,1.2*k);
    const bx=endX+10*k,by=392*k;c.fillStyle='#D71A06';c.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=(i%2?6.2:7.4)*k;c.lineTo(bx+Math.cos(a)*r,by+Math.sin(a)*r)}c.closePath();c.fill();
    c.strokeStyle='#CDF73D';c.lineWidth=1.6*k;c.beginPath();c.moveTo(bx-3*k,by);c.lineTo(bx-.6*k,by+2.6*k);c.lineTo(bx+3.4*k,by-2.4*k);c.stroke();
    c.fillStyle='#D71A06';c.font=`600 ${10.5*k}px Inter`;c.fillText(CONFIG.handle+'  ·  Python Backend · AI',21*k,414*k);
    c.fillStyle='#5a2b25';c.font=`400 ${10.6*k}px Inter`;wrapLines(c,CONFIG.bio,385*k).slice(0,5).forEach((l,i)=>c.fillText(l,21*k,(450+i*18)*k));
    c.fillStyle='#7a3d35';c.font=`500 ${9.5*k}px Inter`;c.fillText(CONFIG.email||'',21*k,584*k);
    c.textAlign='right';c.fillText(CONFIG.location,410*k,584*k);
    const lw=c.measureText(CONFIG.location).width,px=410*k-lw-11*k,py=579*k;c.textAlign='left';c.strokeStyle='#7a3d35';c.lineWidth=1.2*k;
    c.beginPath();c.arc(px,py-1.5*k,3.6*k,Math.PI,0);c.lineTo(px,py+5*k);c.closePath();c.stroke();c.beginPath();c.arc(px,py-1.5*k,1.2*k,0,Math.PI*2);c.stroke();
  }
  function drawBack(){
    const c=backCanvas.getContext('2d'),W=TEX_W,H=TEX_H;const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#FFF1DC');bg.addColorStop(1,'#F1DCBE');c.fillStyle=bg;c.fillRect(0,0,W,H);
    c.strokeStyle='rgba(215,26,6,.12)';c.lineWidth=3*W/1024;for(let i=1;i<14;i++){c.beginPath();c.arc(W/2,H*.52,i*34*W/1024,0,Math.PI*2);c.stroke()}
    c.fillStyle='#250104';c.font=`900 ${150*W/1024}px Unbounded`;c.textAlign='center';c.textBaseline='middle';c.fillText(CONFIG.initials,W/2,H*.52);
    c.fillStyle='#7a3d35';c.font=`600 ${30*W/1024}px Inter`;c.fillText(CONFIG.handle,W/2,H*.88);
    c.fillStyle='#D71A06';c.font=`700 ${26*W/1024}px Unbounded`;c.fillText('jamolxon.uz',W/2,H*.2);
  }
  const strapCanvas=document.createElement('canvas');strapCanvas.width=256;strapCanvas.height=2048;
  function drawStrap(){const c=strapCanvas.getContext('2d');c.fillStyle='#250104';c.fillRect(0,0,256,2048);c.save();c.translate(128,1024);c.rotate(Math.PI/2);c.fillStyle='#CDF73D';c.font='900 108px Unbounded';c.textAlign='center';c.textBaseline='middle';c.fillText(CONFIG.strapText,0,0);c.restore()}

  /* ---------- geometriya ---------- */
  function roundedShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const sw=.2,sh=.055,hy=HOLE_Y_LOCAL,hole=new THREE.Path();hole.absarc(-sw/2+sh/2,hy,sh/2,Math.PI/2,Math.PI*1.5,false);hole.absarc(sw/2-sh/2,hy,sh/2,Math.PI*1.5,Math.PI/2,false);s.holes.push(hole);return s}
  function remapUV(geo){const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+CARD_W/2)/CARD_W,(p.getY(i)+CARD_H/2)/CARD_H);uv.needsUpdate=true;return geo}
  function makeRibbon(samples,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((samples+1)*2*3),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array((samples+1)*2*2),2));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((samples+1)*2*3),3));const idx=[];for(let i=0;i<samples;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}g.setIndex(idx);const m=new THREE.Mesh(g,mat);m.frustumCulled=false;scene.add(m);return{mesh:m,samples}}
  const TILE=1.55,_t=new THREE.Vector3(),_n=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion(),_z=new THREE.Vector3(0,0,1);
  function updateRibbon(rb,pts,width,twistFrom,twistTo,startV){const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal'),P=rb.mesh.geometry.attributes.position,U=rb.mesh.geometry.attributes.uv,N=rb.mesh.geometry.attributes.normal;let len=0,px=0,py=0,pz=0;
    for(let i=0;i<=rb.samples;i++){const f=i/rb.samples,p=curve.getPoint(f);curve.getTangent(f,_t);if(i)len+=Math.hypot(p.x-px,p.y-py,p.z-pz);px=p.x;py=p.y;pz=p.z;_q.setFromAxisAngle(_t,twistFrom+(twistTo-twistFrom)*f);_n.copy(_z).applyQuaternion(_q);_s.crossVectors(_t,_n).normalize().multiplyScalar(width/2);
      P.setXYZ(i*2,p.x-_s.x,p.y-_s.y,p.z-_s.z);P.setXYZ(i*2+1,p.x+_s.x,p.y+_s.y,p.z+_s.z);N.setXYZ(i*2,_n.x,_n.y,_n.z);N.setXYZ(i*2+1,_n.x,_n.y,_n.z);const v=startV-len/TILE;U.setXY(i*2,1,v);U.setXY(i*2+1,0,v)}
    P.needsUpdate=U.needsUpdate=N.needsUpdate=true}
  function makeTube(samples,radial,radius,mat){const g=new THREE.BufferGeometry(),n=(samples+1)*(radial+1);g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));const idx=[];for(let i=0;i<samples;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=a+radial+1;idx.push(a,b,a+1,b,b+1,a+1)}g.setIndex(idx);const m=new THREE.Mesh(g,mat);m.frustumCulled=false;scene.add(m);return{mesh:m,samples,radial,radius}}
  const _tp=new THREE.Vector3(),_tg=new THREE.Vector3(),_tn=new THREE.Vector3(),_tb=new THREE.Vector3();
  function updateTube(tb,pts){const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal'),P=tb.mesh.geometry.attributes.position,N=tb.mesh.geometry.attributes.normal;
    for(let i=0;i<=tb.samples;i++){const f=i/tb.samples;curve.getPoint(f,_tp);curve.getTangent(f,_tg).normalize();
      if(i===0){_tn.set(0,0,1).cross(_tg);if(_tn.lengthSq()<1e-6)_tn.set(1,0,0).cross(_tg);_tn.normalize()}else _tn.addScaledVector(_tg,-_tn.dot(_tg)).normalize();
      _tb.crossVectors(_tg,_tn);
      for(let j=0;j<=tb.radial;j++){const th=j/tb.radial*Math.PI*2,cs=Math.cos(th),sn=Math.sin(th),k=i*(tb.radial+1)+j;const nx=_tn.x*cs+_tb.x*sn,ny=_tn.y*cs+_tb.y*sn,nz=_tn.z*cs+_tb.z*sn;P.setXYZ(k,_tp.x+nx*tb.radius,_tp.y+ny*tb.radius,_tp.z+nz*tb.radius);N.setXYZ(k,nx,ny,nz)}}
    P.needsUpdate=N.needsUpdate=true}

  /* ---------- fizika ---------- */
  const NP=NU+NC+2; const P=[],Pp=[];for(let i=0;i<NP;i++){P.push(new THREE.Vector3());Pp.push(new THREE.Vector3())}
  const LINK=[];for(let i=0;i<NP-1;i++)LINK.push(i<NU?SEG_U:(i===NU?CLIP_LEN:SEG_C));
  const T=()=>P[NP-1],Tp=()=>Pp[NP-1];const B=new THREE.Vector3(),Bp=new THREE.Vector3();
  let ang=0,twist=0,twistV=0,tilt=0,tiltV=0,strapTw=0,strapTwV=0;const vS=new THREE.Vector3();
  const drag={on:false,lx:0,ly:0,ang:0,ro:new THREE.Vector3(),rd:new THREE.Vector3(0,0,-1)};
  const AX_X=new THREE.Vector3(1,0,0),AX_Y=new THREE.Vector3(0,1,0),AX_Z=new THREE.Vector3(0,0,1),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_off=new THREE.Vector3(),_ax=new THREE.Vector3();
  function cardQuat(out,a,tw,ti){out.setFromAxisAngle(AX_Z,a);_q2.setFromAxisAngle(AX_Y,tw);_q3.setFromAxisAngle(AX_X,ti);return out.multiply(_q2).multiply(_q3)}
  const wrapPi=a=>Math.atan2(Math.sin(a),Math.cos(a)),clamp=(v,a,b)=>v<a?a:v>b?b:v;
  function resetPose(intro){const th=intro?1.15:0,dir=new THREE.Vector3(Math.sin(th),-Math.cos(th),0);let L=0;for(let i=0;i<NP;i++){P[i].copy(ANCHOR).addScaledVector(dir,L);if(i<NP-1)L+=LINK[i]}
    B.copy(T()).addScaledVector(dir,HOLE_TO_BOTTOM);twist=intro?2.4:0;twistV=0;tilt=0;tiltV=0;strapTw=0;strapTwV=0;vS.set(0,0,0);for(let i=0;i<NP;i++)Pp[i].copy(P[i]);Bp.copy(B);ang=Math.atan2(B.x-T().x,-(B.y-T().y))}
  function solveDist(a,b,ia,ib,L){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-6,w=ia+ib;if(!w)return;const f=(d-L)/d/w;a.x+=dx*f*ia;a.y+=dy*f*ia;b.x-=dx*f*ib;b.y-=dy*f*ib}
  function solveLink(i){const a=P[i],b=P[i+1],ia=i===0?0:1,ib=(i+1===NP-1)?0:1,L=LINK[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-6;if(i!==NU&&d<=L)return;const w=ia+ib;if(!w)return;const f=(d-L)/d/w;a.x+=dx*f*ia;a.y+=dy*f*ia;b.x-=dx*f*ib;b.y-=dy*f*ib}
  function pushApart(a,b,ia,ib,L,k){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-6;if(d>=L)return;const w=ia+ib;if(!w)return;const f=(d-L)/d/w*k;a.x+=dx*f*ia;a.y+=dy*f*ia;b.x-=dx*f*ib;b.y-=dy*f*ib}
  function capVel(p,pp,max){const dx=p.x-pp.x,dy=p.y-pp.y,d=Math.hypot(dx,dy);if(d>max){pp.x=p.x-dx*max/d;pp.y=p.y-dy*max/d}}
  function step(dt){
    const g=GRAVITY*dt*dt;
    if(drag.on){
      twistV+=(-70*twist-16.7*twistV)*dt;twist+=twistV*dt;tiltV+=(-70*tilt-16.7*tiltV)*dt;tilt+=tiltV*dt;
      cardQuat(_q,drag.ang,twist,tilt);_off.set(drag.lx,drag.ly,0).applyQuaternion(_q);Tp().copy(T());
      if(Math.abs(drag.rd.z)>1e-6){const t=(_off.z-drag.ro.z)/drag.rd.z;let tx=drag.ro.x+drag.rd.x*t-_off.x,ty=drag.ro.y+drag.rd.y*t-_off.y;
        const dx=tx-ANCHOR.x,dy=ty-ANCHOR.y,d=Math.hypot(dx,dy);
        if(d>ROPE_LEN){const over=d-ROPE_LEN,dn=ROPE_LEN+STRETCH*(1-Math.exp(-over/STRETCH));tx=ANCHOR.x+dx*dn/d;ty=ANCHOR.y+dy*dn/d;
          const gx=tx+_off.x,gy=ty+_off.y,want=Math.atan2(ANCHOR.y-gy,ANCHOR.x-gx)-Math.atan2(-drag.ly,-drag.lx);drag.ang+=wrapPi(want-drag.ang)*Math.min(1,dt*6*Math.min(1,over/STRETCH))}
        T().set(tx,ty,0)}
      ang=drag.ang;Bp.copy(B);B.set(T().x+Math.sin(ang)*HOLE_TO_BOTTOM,T().y-Math.cos(ang)*HOLE_TO_BOTTOM,0);
    }else{
      const vTx=(T().x-Tp().x)*DAMP,vTy=(T().y-Tp().y)*DAMP,vBx=(B.x-Bp.x)*DAMP,vBy=(B.y-Bp.y)*DAMP,rx=(vBx-vTx)*SWING_DAMP,ry=(vBy-vTy)*SWING_DAMP;
      Tp().copy(T());Bp.copy(B);T().x+=vTx+rx;T().y+=vTy+ry+g;B.x+=vBx-rx;B.y+=vBy-ry+g;
      const dx=T().x-ANCHOR.x,dy=T().y-ANCHOR.y,d=Math.hypot(dx,dy);
      if(d>ROPE_LEN){const nx=dx/d,ny=dy/d,vr=((T().x-Tp().x)*nx+(T().y-Tp().y)*ny)/dt,a=-K_ROPE*(d-ROPE_LEN)-C_ROPE*vr;T().x+=nx*a*dt*dt;T().y+=ny*a*dt*dt}
      for(let k=0;k<3;k++)solveDist(T(),B,1,1,HOLE_TO_BOTTOM);capVel(T(),Tp(),MAXV*dt);capVel(B,Bp,MAXV*dt);ang=Math.atan2(B.x-T().x,-(B.y-T().y));
    }
    const kS=Math.min(1,dt*25);vS.x+=((T().x-Tp().x)/dt-vS.x)*kS;vS.y+=((T().y-Tp().y)/dt-vS.y)*kS;
    if(!drag.on){twistV+=(-K_FACE*Math.sin(twist)-C_TWIST*twistV+K_DRIVE*vS.x*Math.cos(twist))*dt;twist+=twistV*dt;const tiltT=clamp(-vS.y*.04,-.3,.3);tiltV+=(40*(tiltT-tilt)-9*tiltV)*dt;tilt+=tiltV*dt}
    const stT=clamp(.12*wrapPi(twist)+.035*vS.x,-.4,.4);strapTwV+=(30*(stT-strapTw)-8*strapTwV)*dt;strapTw+=strapTwV*dt;
    for(let i=1;i<NP-1;i++){const p=P[i],pp=Pp[i],vx=(p.x-pp.x)*ROPE_VDAMP,vy=(p.y-pp.y)*ROPE_VDAMP;pp.copy(p);p.x+=vx;p.y+=vy+g}
    for(let it=0;it<ITER;it++){P[0].copy(ANCHOR);for(let i=0;i<NP-1;i++)solveLink(i);for(let i=NP-2;i>=0;i--)solveLink(i);
      for(let i=0;i<=NU-2;i++)pushApart(P[i],P[i+2],i?1:0,1,SEG_U*1.8,.5);
      pushApart(P[NU-1],P[NU+1],1,1,(SEG_U+CLIP_LEN)*.85,.5);pushApart(P[NU],P[NU+2],1,1,(CLIP_LEN+SEG_C)*.85,.5);pushApart(P[NU+1],P[NU+3],1,1,SEG_C*1.8,.5);pushApart(P[NU+2],P[NP-1],1,0,SEG_C*1.8,.5);
      for(let i=NP-2;i>=NU;i--){const a=P[i],b=P[i+1],L=LINK[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-6;if(i===NU||d>L){const f=(d-L)/d;a.x+=dx*f;a.y+=dy*f}}}
  }

  /* ---------- kamera / o'lcham (hero bo'limi o'lchamiga qarab) ---------- */
  function resize(){if(!stageEl||!canvasEl)return;
    const r=canvasEl.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),aspect=w/h;renderer.setPixelRatio(Math.min(devicePixelRatio,3));renderer.setSize(w,h,false);camera.aspect=aspect;
    // karta "ustuni" (.hero__stage): tinch holat shu ustun markazida; canvas esa butun hero bo'ylab — karta matn orqasidan o'ta oladi
    const col=stageEl.querySelector('.hero__stage')||stageEl,cr=col.getBoundingClientRect();
    // masshtab ustun (stage) balandligidan olinadi; canvas undan katta bo'lsa (tor ekran) — karta pastga tortilganda matn orqasiga o'tadi
    const tanH=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),sh=Math.max(1,Math.min(cr.height||h,h));let visS=sh<420?6.1:(sh<600?6.6:7.4);const needW=CARD_W/.62,colAspect=Math.max(.2,cr.width)/sh;if(visS*colAspect<needW)visS=needW/colAspect;
    const stacked=h-sh>40;if(stacked)visS*=1.1;const unit=visS/sh,visH=h*unit,offTop=Math.max(0,cr.top-r.top),visW=visH*aspect,fx=((cr.left+cr.width/2)-r.left)/w;
    camera.position.z=visH/2/tanH;camera.near=Math.max(.1,camera.position.z-14);camera.far=camera.position.z+14;const drop=stacked?Math.min(58,sh*.2):0;camera.position.y=VIEW_TOP+(offTop+drop)*unit-visH/2;camera.position.x=-(fx-.5)*visW;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const cta=stageEl.querySelector(ctaSel);if(cta){const rb=new THREE.Vector3(0,ANCHOR.y-ROPE_LEN-SAG-HOLE_TO_BOTTOM,0).project(camera);const ch=cta.offsetHeight||52,top=Math.min((1-rb.y)/2*h+18,Math.min(h,innerHeight)-ch-28)-(cr.top-r.top);cta.style.top=Math.round(top)+'px';cta.style.left=Math.round((rb.x+1)/2*w-(cr.left-r.left))+'px'}}

  /* ---------- kiritish ---------- */
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
  function setRay(e){const r=canvasEl.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera)}
  function hitCard(e){setRay(e);return ray.intersectObjects([hitPad,front,back,body],false)[0]}
  function release(e){if(!drag.on)return;drag.on=false;const vx=clamp(vS.x,-MAXV,MAXV),vy=clamp(vS.y,-MAXV,MAXV);Tp().set(T().x-vx*H,T().y-vy*H,0);Bp.set(B.x-vx*H,B.y-vy*H,0);twistV+=clamp(vx*.8,-10,10);tiltV+=clamp(-vy*.12,-4,4);
    canvasEl.classList.remove('grabbing');if(e&&e.pointerId!==undefined){try{canvasEl.releasePointerCapture(e.pointerId)}catch(_){}}}
  function bind(c){
    c.addEventListener('pointermove',e=>{if(drag.on){setRay(e);drag.ro.copy(ray.ray.origin);drag.rd.copy(ray.ray.direction);return}c.classList.toggle('grab',!!hitCard(e))});
    c.addEventListener('pointerdown',e=>{if(drag.on)return;const h=hitCard(e);if(!h)return;const local=card.worldToLocal(h.point.clone());drag.lx=clamp(local.x,-CARD_W/2,CARD_W/2);drag.ly=clamp(local.y,-HOLE_TO_BOTTOM,HOLE_FROM_TOP);drag.ang=ang;drag.ro.copy(ray.ray.origin);drag.rd.copy(ray.ray.direction);drag.on=true;twistV=0;tiltV=0;vS.set(0,0,0);try{c.setPointerCapture(e.pointerId)}catch(_){}c.classList.add('grabbing');c.classList.remove('grab')});
    c.addEventListener('touchmove',e=>{if(drag.on)e.preventDefault()},{passive:false});
    c.addEventListener('pointerup',release);c.addEventListener('pointercancel',release);c.addEventListener('lostpointercapture',release);addEventListener('blur',()=>release());
    c.addEventListener('keydown',e=>{if(drag.on)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();nudge()}});
  }
  function nudge(k){k=k||(Math.random()<.5?-1:1)*.07;Tp().x-=k*.6;Bp.x-=k;twistV+=k*40}

  /* ---------- sikl ---------- */
  const clock=new THREE.Clock();let acc=0,breezeAt=6;let strapPts=[],cordPts=[];
  function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(!visible)return;acc+=dt;while(acc>=H){step(H);acc-=H}
    if(!reduce&&!drag.on){breezeAt-=dt;if(breezeAt<=0){nudge((Math.random()<.5?-1:1)*(.012+Math.random()*.015));breezeAt=7+Math.random()*6}}
    cardQuat(card.quaternion,ang,twist,tilt);card.position.copy(T());
    updateRibbon(strap,strapPts,.24,0,strapTw,0);
    _ax.subVectors(P[NU+1],P[NU]).normalize();clip.position.copy(P[NU]);clip.quaternion.setFromAxisAngle(AX_Z,Math.atan2(_ax.x,-_ax.y));clipA.rotation.y=strapTw;clipB.rotation.y=twist;
    updateTube(cord,cordPts);renderer.render(scene,camera)}
  function observe(stage){if(io)io.disconnect();io=new IntersectionObserver(en=>{visible=en[0].isIntersecting},{threshold:0});io.observe(stage)}

  function init(canvas,photo,email){
    if(started){if(canvasEl&&canvas!==canvasEl)canvas.replaceWith(canvasEl);stageEl=canvasEl.parentElement;resize();observe(stageEl);const cta=stageEl.querySelector(ctaSel);if(cta)requestAnimationFrame(()=>cta.classList.add('show'));return}
    started=true;canvasEl=canvas;stageEl=canvas.parentElement;CONFIG.email=email||'';
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,3));renderer.outputEncoding=THREE.sRGBEncoding;renderer.setClearColor(0x000000,0);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(25,1,.1,100);camera.position.set(0,0,14);
    scene.add(new THREE.HemisphereLight(0xffffff,0x4a070c,.7));const key=new THREE.DirectionalLight(0xffffff,.5);key.position.set(2,4,8);scene.add(key);const rim=new THREE.DirectionalLight(0xffffff,.35);rim.position.set(-5,2,-6);scene.add(rim);
    frontTex=new THREE.CanvasTexture(frontCanvas);backTex=new THREE.CanvasTexture(backCanvas);[frontTex,backTex].forEach(t=>{t.encoding=THREE.sRGBEncoding;t.anisotropy=renderer.capabilities.getMaxAnisotropy()});
    const shape=roundedShape(CARD_W,CARD_H,CARD_R);card=new THREE.Group();scene.add(card);
    front=new THREE.Mesh(remapUV(new THREE.ShapeGeometry(shape,12)),new THREE.MeshStandardMaterial({map:frontTex,roughness:.55,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));front.position.z=CARD_D/2+.004;
    back=new THREE.Mesh(remapUV(new THREE.ShapeGeometry(shape,12)),new THREE.MeshStandardMaterial({map:backTex,roughness:.6,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));back.rotation.y=Math.PI;back.position.z=-CARD_D/2-.004;
    const bodyGeo=new THREE.ExtrudeGeometry(shape,{depth:CARD_D,bevelEnabled:false,curveSegments:12});bodyGeo.translate(0,0,-CARD_D/2);body=new THREE.Mesh(bodyGeo,new THREE.MeshStandardMaterial({color:0xE8D3B8,roughness:.4}));
    card.add(body,front,back);[front,back,body].forEach(m=>m.position.y-=HOLE_Y_LOCAL);
    hitPad=new THREE.Mesh(new THREE.PlaneGeometry(CARD_W+.3,CARD_H+.3),new THREE.MeshBasicMaterial({visible:false}));hitPad.position.y=-HOLE_Y_LOCAL;card.add(hitPad);
    strapTex=new THREE.CanvasTexture(strapCanvas);strapTex.wrapS=strapTex.wrapT=THREE.RepeatWrapping;strapTex.encoding=THREE.sRGBEncoding;strapTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
    strap=makeRibbon(44,new THREE.MeshStandardMaterial({map:strapTex,roughness:.85,side:THREE.DoubleSide}));
    cord=makeTube(28,8,.022,new THREE.MeshStandardMaterial({color:0x250104,roughness:.75}));
    const metal=new THREE.MeshStandardMaterial({color:0x2a2a2a,metalness:.85,roughness:.28});clip=new THREE.Group();clipA=new THREE.Group();clipB=new THREE.Group();clip.add(clipA,clipB);scene.add(clip);
    const fold=new THREE.Mesh(new THREE.BoxGeometry(.27,.07,.045),new THREE.MeshStandardMaterial({color:0x1a0103,roughness:.8}));fold.position.y=.02;const ring=new THREE.Mesh(new THREE.TorusGeometry(.1,.026,16,48),metal);ring.scale.set(1,1.25,1);ring.position.y=-.09;clipA.add(fold,ring);
    const swivel=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.09,16),metal);swivel.position.y=-.225;const knob=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),metal);knob.position.y=-.3;clipB.add(swivel,knob);
    strapPts=[];for(let i=0;i<=NU;i++)strapPts.push(P[i]);cordPts=[P[NU+1],P[NU+2],P[NU+3],P[NP-1]];
    bind(canvas);addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(()=>resize()).observe(stageEl);observe(stageEl);
    const go=()=>{drawFront();drawBack();drawStrap();frontTex.needsUpdate=backTex.needsUpdate=strapTex.needsUpdate=true;resize();resetPose(!reduce);const cta=stageEl.querySelector(ctaSel);if(cta)requestAnimationFrame(()=>cta.classList.add('show'));frame();canvas.dispatchEvent(new Event('lanyard:ready'))};
    const fonts=document.fonts?Promise.all([document.fonts.load('400 40px Inter'),document.fonts.load('600 40px Inter'),document.fonts.load('800 40px Unbounded'),document.fonts.load('900 40px Unbounded')]):Promise.resolve();
    const photoP=photo?new Promise(res=>{const img=new Image();if(/^https?:/.test(photo))img.crossOrigin='anonymous';img.onload=()=>{userPhoto=img;res()};img.onerror=()=>res();img.src=photo}):Promise.resolve();
    Promise.race([Promise.all([fonts,photoP]),new Promise(r=>setTimeout(r,1800))]).finally(go);
  }
  return {init,nudge};
})();
export default Lanyard;
