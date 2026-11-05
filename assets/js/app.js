/* ============================================================
   ILOVA — hash-router, animatsiyalar, nav, forma
   ============================================================ */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const app = document.getElementById('app');
let pendingOffer = null; // "Shu yechim kerak" dan kelganda sohani oldindan tanlash

/* ---------- kontaktlar: spam-botlardan JS orqali ---------- */
const MAIL = CONTACT.mailParts.join('@'), TEL = CONTACT.telParts.join('');
const TEL_FMT = CONTACT.telParts.join(' ');
function wireContacts(root){
  root.querySelectorAll('[data-mail]').forEach(a=>{a.href='mailto:'+MAIL;a.removeAttribute('data-mail');a.querySelector('span').textContent=MAIL});
  root.querySelectorAll('[data-tel]').forEach(a=>{a.href='tel:'+TEL;a.removeAttribute('data-tel');a.querySelector('span').textContent=TEL_FMT});
}

/* ---------- router ---------- */
function route(){
  const h = decodeURIComponent(location.hash.replace(/^#\/?/,''));
  let view='home', arg=null, section=null;
  if(h.startsWith('s-')){section=h.slice(2)}
  else if(h==='loyihalar'){view='projects'}
  else if(h.startsWith('loyiha-')){view='project';arg=h.slice(7)}
  else if(h.startsWith('xizmat-')){view='service';arg=h.slice(7)}
  else if(h==='blog'){view='blog'}
  else if(h.startsWith('blog-')){view='post';arg=h.slice(5)}
  else if(h==='taklif'){view='taklif'}
  else if(h && h!=='top'){view='404'}
  return {view,arg,section};
}
let current=null;
function render(){
  const r=route();
  const key=r.view+':'+r.arg;
  if(key!==current){
    if(window.ScrollTrigger){ScrollTrigger.getAll().forEach(t=>t.kill())}
    const html = {home:tplHome, projects:tplProjects, project:()=>tplProject(r.arg), service:()=>tplService(r.arg), blog:tplBlog, post:()=>tplPost(r.arg), taklif:tplTaklif, '404':tplNotFound}[r.view]();
    app.innerHTML=html; current=key;
    wireContacts(app);
    document.title = titleFor(r);
    if(r.view==='home'){Lanyard.init(document.getElementById('badge'), AVATAR_PHOTO, MAIL); wireTabs()}
    if(r.view==='taklif'){wireForm()}
    if(!r.section){const de=document.documentElement;de.style.scrollBehavior='auto';window.scrollTo(0,0);requestAnimationFrame(()=>{window.scrollTo(0,0);de.style.scrollBehavior=''})}
    requestAnimationFrame(()=>{fitGiants();animate(r.view); if(window.ScrollTrigger) ScrollTrigger.refresh(); if(r.section) setTimeout(()=>scrollToSection(r.section,true),60)});
  } else if(r.section){scrollToSection(r.section)}
  setActive(r);
  closeMenu();
}
function scrollToSection(id,instant){const el=document.getElementById(id);if(!el)return;const y=el.getBoundingClientRect().top+scrollY-10;const de=document.documentElement;if(instant||reduce){de.style.scrollBehavior='auto';window.scrollTo(0,y);de.style.scrollBehavior=''}else window.scrollTo({top:y,behavior:'smooth'})}
function titleFor(r){
  const base='Jamolxon — Python Backend Developer | AI yechimlar';
  if(r.view==='project'){const p=PROJECTS.find(p=>p.slug===r.arg);return p?`${p.title} — ${base}`:base}
  if(r.view==='service'){const p=SERVICES.find(p=>p.slug===r.arg);return p?`${p.title} — Jamolxon`:base}
  if(r.view==='post'){const p=POSTS.find(p=>p.slug===r.arg);return p?`${p.title} — Jamolxon`:base}
  return {projects:'Loyihalar — Jamolxon',blog:'Blog — Jamolxon',taklif:'Loyiha taklif qilish — Jamolxon'}[r.view]||base;
}
function setActive(r){
  const map={home:'',projects:'loyihalar',project:'loyihalar',service:'s-xizmatlar',blog:'blog',post:'blog',taklif:'taklif'};
  let k=map[r.view]||''; if(r.view==='home'&&r.section==='yechimlar')k='s-yechimlar'; if(r.view==='home'&&r.section==='xizmatlar')k='s-xizmatlar'; if(r.view==='home'&&r.section==='loyihalar')k='loyihalar';
  document.querySelectorAll('.nav ul a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+k));
}
addEventListener('hashchange',render);
// "Shu yechim kerak" tugmalari: sohani eslab qolamiz
document.addEventListener('click',e=>{const a=e.target.closest('[data-offer]');if(a){pendingOffer=a.dataset.offer||null}
  const samePage=e.target.closest('a[href="#"]'); if(samePage&&location.hash===''){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}});

/* ---------- loyiha filtri (bosh sahifa) ---------- */
function wireTabs(){
  const tabs=document.getElementById('tabs'); if(!tabs) return;
  tabs.addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;
    tabs.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===b));
    const f=b.dataset.f; const cards=[...document.querySelectorAll('#pgrid .pcard')];
    cards.forEach(c=>{const show=f==='all'||c.dataset.cat===f;c.style.display=show?'':'none'});
    if(window.gsap&&!reduce){gsap.fromTo(cards.filter(c=>c.style.display!=='none'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,stagger:.05,ease:'power3.out',overwrite:true})}
    if(window.ScrollTrigger) ScrollTrigger.refresh();
  });
}

/* ---------- taklif formasi ---------- */
const SUBMIT_ENDPOINT = null; // o'z hostingingizda: 'https://jamolxon.uz/api/taklif' — JSON POST qabul qiluvchi endpoint (masalan portfolio bot backend'i)
function wireForm(){
  const f=document.getElementById('takform'); if(!f) return;
  // oldindan tanlangan soha
  if(pendingOffer){const sel=f.industry;const idx=sl=>SERVICES.findIndex(x=>x.slug===sl);
    const map={aloqa:idx('ai-agentlar'),smm:idx('integratsiyalar'),talim:idx('ai-agentlar'),biznes:idx('crm-erp'),bot:idx('telegram-botlar'),kontent:idx('ai-agentlar')};
    if(pendingOffer in map){sel.selectedIndex=map[pendingOffer];const sph={aloqa:'savdo / xizmat',smm:'Instagram / SMM',talim:"ta'lim",biznes:'CRM / ERP',bot:'',kontent:'kontent / marketing'}[pendingOffer];if(sph)f.sphere.value=sph}
    if(pendingOffer.startsWith('svc:')){const k=idx(pendingOffer.slice(4));if(k>=0)sel.selectedIndex=k}
    if(pendingOffer.startsWith('sale:')){const p=PROJECTS.find(p=>p.slug===pendingOffer.slice(5));sel.selectedIndex=SERVICES.length;if(p)f.about.value=`Tayyor yechim kerak: ${p.title}. `}
    pendingOffer=null}
  // qoralama (brauzerda) — yo'qolib ketmasin
  try{const d=JSON.parse(localStorage.getItem('taklif-draft')||'null');if(d){for(const k in d){if(f[k]&&f[k].type!=='radio')f[k].value=d[k]}}}catch(e){}
  f.addEventListener('input',()=>{try{const o={};['name','company','sphere','about','tg','email','phone'].forEach(k=>o[k]=f[k].value);localStorage.setItem('taklif-draft',JSON.stringify(o))}catch(e){}});
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const err=document.getElementById('takerr'), out=document.getElementById('takout');
    const v=k=>String(f[k].value||'').trim();
    err.textContent='';
    if(!v('name')||!v('about')){err.textContent='Ism va loyiha tavsifi majburiy.';return}
    if(!v('tg')&&!v('email')&&!v('phone')){err.textContent='Kamida bitta aloqa usulini yozing.';return}
    if(v('email')&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))){err.textContent='Email noto\'g\'ri ko\'rinadi.';return}
    const pref=f.querySelector('input[name=pref]:checked').value;
    const data={name:v('name'),company:v('company'),industry:v('industry'),sphere:v('sphere'),about:v('about'),budget:v('budget'),deadline:v('deadline'),tg:v('tg'),email:v('email'),phone:v('phone'),pref,ts:new Date().toISOString()};
    const msg=`Salom, Jamolxon! Loyiha taklifi.\nIsm: ${data.name}\nKompaniya: ${data.company||'—'}\nNima kerak: ${data.industry}\nSoha: ${data.sphere||'—'}\nLoyiha: ${data.about}\nByudjet: ${data.budget}\nMuddat: ${data.deadline}\nAloqa: ${[data.tg&&'Telegram '+data.tg,data.email&&'Email '+data.email,data.phone&&'Tel '+data.phone].filter(Boolean).join(' · ')}\nQulay yo'l: ${data.pref}`;
    let sent=false;
    if(SUBMIT_ENDPOINT){try{const r=await fetch(SUBMIT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});sent=r.ok}catch(e){sent=false}}
    let copied=false; try{await navigator.clipboard.writeText(msg);copied=true}catch(e){}
    const mailto='mailto:'+MAIL+'?subject='+encodeURIComponent('Loyiha taklifi — '+data.name)+'&body='+encodeURIComponent(msg);
    out.className='out show';
    out.innerHTML=`<b>${sent?'Taklif qabul qilindi — 24 soat ichida javob beraman.':'Taklif tayyor.'}</b>
      <span>${copied?'Matn buferga nusxalandi. ':''}${sent?'Qo\'shimcha ':''}Yuborish uchun qulay yo'lni tanlang:</span>
      <div class="acts"><a class="btn btn-m btn-sm" href="${CONTACT.tgUrl}" target="_blank" rel="noopener">Telegram'da yuborish ↗</a><a class="btn btn-m btn-sm" href="${mailto}">Email orqali</a><button class="btn btn-r btn-sm" type="button" id="copybtn">${copied?'Nusxalandi ✓':'Nusxalash'}</button></div>
      <pre>${msg.replace(/</g,'&lt;')}</pre>`;
    document.getElementById('copybtn').addEventListener('click',async ev=>{try{await navigator.clipboard.writeText(msg);ev.target.textContent='Nusxalandi ✓'}catch(e){ev.target.textContent='Matnni qo\'lda belgilang'}});
    try{localStorage.removeItem('taklif-draft')}catch(e){}
    out.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest'});
  });
}

/* ---------- nav, menyu, progress, kursor ---------- */
const nav=document.querySelector('.nav'), menu=document.getElementById('menu'), burger=document.getElementById('burger');
function closeMenu(){menu.classList.remove('open');burger.setAttribute('aria-expanded','false')}
burger.addEventListener('click',()=>{const o=!menu.classList.contains('open');menu.classList.toggle('open',o);burger.setAttribute('aria-expanded',String(o))});
menu.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
let lastY=0;
addEventListener('scroll',()=>{const y=scrollY;nav.classList.toggle('hidden',y>lastY&&y>160&&!menu.classList.contains('open'));lastY=y;
  const h=document.documentElement;const p=h.scrollHeight>h.clientHeight?y/(h.scrollHeight-h.clientHeight):0;document.getElementById('progress').style.transform=`scaleX(${p})`},{passive:true});
document.getElementById('year').textContent=new Date().getFullYear();
/* footer ism — harflarga bo'lamiz */
(function(){const g=document.getElementById('giant');const txt=g.textContent.trim();g.innerHTML=[...txt].map(ch=>`<span data-l="${ch}">${ch}</span>`).join('');})();
/* "Hozir quryapman:" — yozilib-o'chiriladigan satr */
(function(){const el=document.getElementById('typed');const items=['AI avto-javob tizimi','Telegram buyurtma boti','multi-tenant CRM','Instagram → CRM integratsiya','AI agentlar zanjiri','yangi web sayt'];
  if(reduce){el.textContent=items[0];return}
  let i=0,ch=0,del=false;(function tick(){const w=items[i];el.textContent=w.slice(0,ch);let d=del?45:85;
    if(!del&&ch===w.length){del=true;d=1600}else if(del&&ch===0){del=false;i=(i+1)%items.length;d=300}else{ch+=del?-1:1}
    setTimeout(tick,d)})()})();
/* ulkan ism — har doim kenglikka sig'adi */
function fitGiants(){document.querySelectorAll('.foot .giant,.hero__giant').forEach(el=>{
  const parent=el.parentElement, ps=getComputedStyle(parent);
  const avail=parent.clientWidth-parseFloat(ps.paddingLeft)-parseFloat(ps.paddingRight);
  if(avail<50) return;
  el.style.fontSize='100px'; // o'lchash uchun ma'lum o'lcham
  const spans=el.querySelectorAll('span');
  const w=spans.length?[...spans].reduce((a,sp)=>a+sp.offsetWidth,0):el.scrollWidth; // transform'larga bog'liq emas
  if(!w) return;
  const max=el.classList.contains('giant')?260:320;
  el.style.fontSize=Math.min(max,Math.floor(100*avail/w*0.97))+'px';
})}
addEventListener('resize',fitGiants); addEventListener('load',fitGiants);
if(document.fonts){document.fonts.ready.then(fitGiants);document.fonts.addEventListener('loadingdone',fitGiants);document.fonts.load('900 100px Unbounded').then(fitGiants).catch(()=>{})}
setTimeout(fitGiants,400); setTimeout(fitGiants,1500);
if(window.ResizeObserver){new ResizeObserver(fitGiants).observe(document.querySelector('.foot'))}
wireContacts(document.querySelector('.foot'));
if(!coarse){const c=document.querySelector('.cursor');let cx=innerWidth/2,cy=innerHeight/2,tx=cx,ty=cy;
  addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY});
  (function loop(){cx+=(tx-cx)*.22;cy+=(ty-cy)*.22;c.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;requestAnimationFrame(loop)})();
  document.addEventListener('mouseover',e=>{c.classList.toggle('big',!!e.target.closest('a,button,.tab'))});}

/* ---------- animatsiyalar (GSAP) ---------- */
function animate(view){
  if(!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  if(reduce) return;
  const rv=gsap.utils.toArray('#app .rv').filter(el=>!el.closest('.hero'));
  if(rv.length){gsap.set(rv,{opacity:0,y:34});ScrollTrigger.batch(rv,{start:'top 90%',onEnter:b=>gsap.to(b,{opacity:1,y:0,duration:.9,stagger:.07,ease:'power3.out',overwrite:true})})}
  // bo'lim kirib kelganda ichidagi kontent yengil ko'tariladi (ustma-ust kartalar hissi)
  gsap.utils.toArray('#app .sec').forEach(sec=>{if(sec.classList.contains('hero'))return;const inner=sec.firstElementChild;if(!inner)return;gsap.fromTo(inner,{y:56},{y:0,ease:'none',scrollTrigger:{trigger:sec,start:'top bottom',end:'top 45%',scrub:true}})});
  gsap.utils.toArray('#app .shead h2, #app .article h1, #app .pd__hero h1, #app .tak h1').forEach(h=>{gsap.from(h,{yPercent:28,opacity:0,duration:1,ease:'power4.out',scrollTrigger:{trigger:h,start:'top 88%'}})});
  gsap.utils.toArray('#app [data-count]').forEach(el=>{const end=+el.dataset.count,suf=el.dataset.suffix||'',o={v:0};
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>gsap.to(o,{v:end,duration:1.4,ease:'power2.out',onUpdate:()=>{el.textContent=Math.round(o.v)+suf}})})});
  if(view==='home'){
    gsap.set('.hero h1 .l span',{yPercent:110});gsap.set('.hero .rv',{opacity:0,y:24});gsap.set('.hero__giant',{xPercent:-6,opacity:0});
    gsap.timeline({defaults:{ease:'power3.out'}})
      .to('.hero__giant',{xPercent:0,opacity:1,duration:1.4},0)
      .to('.hero h1 .l span',{yPercent:0,duration:1,stagger:.1},.3)
      .to('.hero .rv',{opacity:1,y:0,duration:.8,stagger:.08},.7);
    if(!coarse){document.querySelector('.hero').addEventListener('mousemove',e=>{const x=(e.clientX/innerWidth-.5)*2,y=(e.clientY/innerHeight-.5)*2;gsap.to('.hero__giant',{x:x*-24,y:y*-10,duration:1,ease:'power2.out'});gsap.to('.hero__txt',{x:x*6,y:y*4,duration:1,ease:'power2.out'})})}
    // skrollda avatar sochiladi, ulkan ism parallaks
    gsap.to('.hero__giant',{yPercent:30,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
    gsap.to('#stepbar',{scaleX:1,ease:'none',scrollTrigger:{trigger:'#steps',start:'top 70%',end:'bottom 60%',scrub:true}});
    gsap.utils.toArray('.pillar').forEach((p,i)=>{gsap.to(p,{yPercent:-6*(i%2?1:-1),ease:'none',scrollTrigger:{trigger:p,start:'top bottom',end:'bottom top',scrub:true}})});
  }
  if(view==='project'){gsap.from('.pd__fig',{rotate:8,scale:.9,opacity:0,duration:1.2,ease:'expo.out',delay:.1})}
  footerName();
}

/* ---------- footer ism animatsiyasi ---------- */
function footerName(){
  const letters=gsap.utils.toArray('#giant span'); if(!letters.length) return;
  gsap.killTweensOf(letters); gsap.set(letters,{clearProps:'all'});
  // 1) skrollda harflar tushib keladi
  gsap.from(letters,{yPercent:120,rotate:()=>gsap.utils.random(-14,14),opacity:0,duration:1.1,ease:'back.out(1.5)',stagger:.07,
    scrollTrigger:{trigger:'.foot',start:'top 85%'},
    onComplete(){
      // 2) doimiy yengil to'lqin
      gsap.to(letters,{yPercent:-6,duration:1.3,ease:'sine.inOut',stagger:{each:.14,repeat:-1,yoyo:true}});
      // 3) rang oqimi: sariq → krem, harfma-harf
      gsap.to(letters,{color:'#FFF1DC',duration:.5,ease:'power1.inOut',stagger:{each:.09,repeat:-1,yoyo:true,repeatDelay:2.2}});
    }});
  // 4) kursor: harf sakraydi va buriladi
  letters.forEach(l=>{l.onmouseenter=()=>gsap.to(l,{scale:1.14,rotate:gsap.utils.random(-7,7),duration:.35,ease:'back.out(2)',overwrite:'auto'});
    l.onmouseleave=()=>gsap.to(l,{scale:1,rotate:0,duration:.6,ease:'elastic.out(1,.5)',overwrite:'auto'})});
  // 5) butun so'z skrollda sekin siljiydi (parallaks)
  gsap.fromTo('#giant',{xPercent:-3},{xPercent:0,ease:'none',scrollTrigger:{trigger:'.foot',start:'top bottom',end:'bottom bottom',scrub:true}});
}
render();
