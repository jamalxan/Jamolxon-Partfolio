/* ============================================================
   ILOVA — serverda tayyorlangan HTML ustiga animatsiyalar, nav, forma
   (progressive enhancement). Sahifalar orasida o'tish SPA kabi:
   keyingi sahifa HTML'i fetch qilinadi va <main> almashtiriladi.
   ============================================================ */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AVATAR_PHOTO, LEADS_ENDPOINT } from './config.js';

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const saveData = !!(navigator.connection && navigator.connection.saveData);
const app = document.getElementById('app');
const SITE = (() => { try { return JSON.parse(document.getElementById('site-data').textContent) } catch (e) { return {} } })();
let rendered = location.pathname + location.search; // <main> ichidagi sahifa
let prevPath = null; // forma uchun source_page

/* ---------- kontaktlar: spam-botlardan JS orqali ---------- */
const MAIL = (SITE.mail || []).join('@'), TEL = (SITE.tel || []).join('');
const TEL_FMT = (SITE.tel || []).join(' ');
function wireContacts(root){
  root.querySelectorAll('[data-mail]').forEach(a=>{a.href='mailto:'+MAIL;a.removeAttribute('data-mail');a.querySelector('span').textContent=MAIL});
  root.querySelectorAll('[data-tel]').forEach(a=>{a.href='tel:'+TEL;a.removeAttribute('data-tel');a.querySelector('span').textContent=TEL_FMT});
}

/* ---------- eski hash havolalar → yangi yo'llar (TZ 5) ---------- */
function legacyTarget(h){
  h = decodeURIComponent(h.replace(/^#\/?/, ''));
  if(h==='top') return '/';
  if(h==='loyihalar') return '/loyihalar/';
  if(h.startsWith('loyiha-')) return `/loyihalar/${h.slice(7)}/`;
  if(h.startsWith('xizmat-')) return `/xizmatlar/${h.slice(7)}/`;
  if(h==='blog') return '/blog/';
  if(h.startsWith('blog-')) return `/blog/${h.slice(5)}/`;
  if(h==='taklif') return '/taklif/';
  if(h.startsWith('s-')) return `/#${h.slice(2)}`;
  return null;
}

/* ---------- UTM: birinchi kirishda eslab qolamiz ---------- */
try{const q=new URLSearchParams(location.search),utm={};for(const [k,v] of q)if(k.startsWith('utm_'))utm[k]=v.slice(0,200);if(Object.keys(utm).length)sessionStorage.setItem('utm',JSON.stringify(utm))}catch(e){}

/* ---------- sahifaga kirish (birinchi yuklash va har SPA o'tish) ---------- */
function enter({section=null, initial=false}={}){
  const view=app.dataset.view||'home';
  if(!initial){ScrollTrigger.getAll().forEach(t=>t.kill())}
  wireContacts(app);
  if(view==='home'){startBadge(); wireTabs()}
  if(view==='taklif'){wireForm()}
  if(view==='projects'){const k=new URLSearchParams(location.search).get('kategoriya');if(k&&!section&&document.getElementById('cat-'+k))section='cat-'+k}
  if(!section){const de=document.documentElement;de.style.scrollBehavior='auto';window.scrollTo(0,0);requestAnimationFrame(()=>{window.scrollTo(0,0);de.style.scrollBehavior=''})}
  requestAnimationFrame(()=>{fitGiants();animate(view); ScrollTrigger.refresh(); if(section) setTimeout(()=>scrollToSection(section,true),60)});
  setActive(section);
  closeMenu();
}
function scrollToSection(id,instant){const el=document.getElementById(id);if(!el)return;const y=el.getBoundingClientRect().top+scrollY-10;const de=document.documentElement;if(instant||reduce){de.style.scrollBehavior='auto';window.scrollTo(0,y);de.style.scrollBehavior=''}else window.scrollTo({top:y,behavior:'smooth'})}
function setActive(section){
  const view=app.dataset.view;
  const map={home:'/',projects:'/loyihalar/',project:'/loyihalar/',service:'/#xizmatlar',blog:'/blog/',post:'/blog/','404':'/'};
  let k=map[view]||''; if(view==='home'&&section==='yechimlar')k='/#yechimlar'; if(view==='home'&&section==='xizmatlar')k='/#xizmatlar'; if(view==='home'&&section==='loyihalar')k='/loyihalar/';
  document.querySelectorAll('.nav ul a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===k));
}

/* ---------- SPA o'tish: HTML fetch → <main> + head almashtiriladi ---------- */
const HEAD_SEL='title,meta[name="description"],meta[name="robots"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]';
function swapHead(doc){
  document.head.querySelectorAll(HEAD_SEL).forEach(n=>n.remove());
  const anchor=document.head.querySelector('meta[name="viewport"]');
  let after=anchor;
  doc.head.querySelectorAll(HEAD_SEL).forEach(n=>{const c=document.importNode(n,true);after.after(c);after=c});
  document.title=doc.title;
}
let navSeq=0;
async function go(href,{push=true,replace=false}={}){
  const u=new URL(href,location.href);
  const key=u.pathname+u.search, section=u.hash?decodeURIComponent(u.hash.slice(1)):null;
  if(key===rendered){
    if(push&&u.href!==location.href) history.pushState(null,'',u.href); else if(replace) history.replaceState(null,'',u.href);
    if(section) scrollToSection(section); else window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
    setActive(section); closeMenu(); return;
  }
  const seq=++navSeq;
  let doc;
  try{
    const r=await fetch(key,{headers:{Accept:'text/html'},credentials:'same-origin'});
    if(!r.ok&&r.status!==404) throw new Error(String(r.status));
    doc=new DOMParser().parseFromString(await r.text(),'text/html');
    if(!doc.getElementById('app')) throw new Error('no main');
  }catch(e){location.href=u.href;return}
  if(seq!==navSeq) return; // keyinroq bosilgan havola ustun
  if(push) history.pushState(null,'',u.href); else if(replace) history.replaceState(null,'',u.href);
  prevPath=rendered.split('?')[0]; rendered=key;
  const main=doc.getElementById('app');
  swapHead(doc);
  app.dataset.view=main.dataset.view||'';
  app.innerHTML=main.innerHTML;
  app.style.visibility='';
  enter({section});
}
const SKIP_PATH=/^\/(api|preview|admin|media)\//, FILE_EXT=/\.(xml|txt|pdf|jpe?g|png|svg|webp|avif|zip)$/i;
document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  const a=e.target.closest('a[href]'); if(!a) return;
  const raw=a.getAttribute('href');
  if(raw==='#'){e.preventDefault();return} // hali ulanmagan kontakt havolasi
  if((a.target&&a.target!=='_self')||a.hasAttribute('download')||/^(mailto|tel):/i.test(raw)) return;
  if(raw.startsWith('#')){const t=legacyTarget(raw);e.preventDefault();if(t)go(t);else{history.pushState(null,'',raw);scrollToSection(raw.slice(1))}return}
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin||SKIP_PATH.test(u.pathname)||FILE_EXT.test(u.pathname)) return;
  e.preventDefault(); go(u.href);
});
addEventListener('popstate',()=>go(location.href,{push:false}));
addEventListener('hashchange',()=>{const t=location.pathname==='/'?legacyTarget(location.hash):null;if(t)go(t,{push:false,replace:true});else if(location.hash)scrollToSection(decodeURIComponent(location.hash.slice(1)))});

/* ---------- loyiha filtri (bosh sahifa) ---------- */
function wireTabs(){
  const tabs=document.getElementById('tabs'); if(!tabs) return;
  tabs.addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;
    tabs.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===b));
    const f=b.dataset.f; const cards=[...document.querySelectorAll('#pgrid .pcard')];
    cards.forEach(c=>{const show=f==='all'||c.dataset.cat===f;c.style.display=show?'':'none'});
    if(!reduce){gsap.fromTo(cards.filter(c=>c.style.display!=='none'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,stagger:.05,ease:'power3.out',overwrite:true})}
    ScrollTrigger.refresh();
  });
}

/* ---------- beyjik: Three.js alohida chunk, hero ko'ringanda idle paytda ---------- */
let Lanyard=null, lanyardLoading=false;
const idle=cb=>('requestIdleCallback' in window)?requestIdleCallback(cb,{timeout:1500}):setTimeout(cb,200);
function startBadge(){
  const canvas=document.getElementById('badge'); if(!canvas) return;
  const ph=app.querySelector('.hero__badgeph'), hide=()=>{if(ph)ph.classList.add('is-off')};
  if(reduce||saveData){const h=app.querySelector('.hero__hint');if(h)h.style.display='none';return} // statik beyjik qoladi
  if(Lanyard){Lanyard.init(canvas,AVATAR_PHOTO,MAIL);hide();return}
  canvas.addEventListener('lanyard:ready',hide,{once:true});
  if(lanyardLoading) return;
  const io=new IntersectionObserver(en=>{
    if(!en.some(x=>x.isIntersecting)) return;
    io.disconnect(); lanyardLoading=true;
    idle(()=>import('./lanyard.js').then(m=>{
      Lanyard=m.default; lanyardLoading=false;
      const c=document.getElementById('badge'); if(!c) return; // foydalanuvchi boshqa sahifaga o'tgan
      if(c!==canvas) c.addEventListener('lanyard:ready',()=>{const p=app.querySelector('.hero__badgeph');if(p)p.classList.add('is-off')},{once:true});
      Lanyard.init(c,AVATAR_PHOTO,MAIL);
    }).catch(()=>{lanyardLoading=false}));
  });
  io.observe(canvas.closest('.hero')||canvas);
}

/* ---------- taklif formasi → POST /api/v1/leads ---------- */
const CT_HINT={telegram:['@username','text','off'],email:['siz@kompaniya.uz','email','email'],phone:['+998 90 000 00 00','tel','tel']};
const OK_MSG="Rahmat, 2 soat ichida bog'lanaman";
function wireForm(){
  const f=document.getElementById('takform'); if(!f) return;
  const err=document.getElementById('takerr'), out=document.getElementById('takout');
  const openedAt=Date.now();
  const q=new URLSearchParams(location.search);
  // natija (JS'siz forma redirect'idan keyin ham)
  if(q.get('yuborildi')==='1') showOk(out,OK_MSG);
  if(q.get('xato')==='1') err.textContent="Taklif yuborilmadi. Ma'lumotlarni tekshirib, qayta urinib ko'ring yoki Telegram'da yozing.";
  // oldindan tanlangan xizmat ("Shu yechim kerak", "Shu xizmatni so'rash")
  const svc=q.get('xizmat'); if(svc&&[...f.service.options].some(o=>o.value===svc)) f.service.value=svc;
  const sale=q.get('tayyor'); if(sale){f.service.value='boshqa';const t=(SITE.sale||{})[sale];if(t&&!f.message.value)f.message.value=`Tayyor yechim kerak: ${t}. `}
  // qoralama (brauzerda) — yo'qolib ketmasin
  const DRAFT=['name','contact_value','message'];
  try{const d=JSON.parse(localStorage.getItem('taklif-draft')||'null');if(d){for(const k of DRAFT){if(d[k]&&!f[k].value)f[k].value=d[k]}if(d.contact_type&&f.querySelector(`input[name=contact_type][value="${d.contact_type}"]`))f.querySelector(`input[name=contact_type][value="${d.contact_type}"]`).checked=true}}catch(e){}
  const ctype=()=>(f.querySelector('input[name=contact_type]:checked')||{}).value||'telegram';
  const hint=()=>{const [ph,type,ac]=CT_HINT[ctype()]||CT_HINT.telegram;const i=f.contact_value;i.placeholder=ph;i.type=type;i.autocomplete=ac;i.inputMode=type==='tel'?'tel':(type==='email'?'email':'text')};
  hint();
  f.addEventListener('change',e=>{if(e.target.name==='contact_type')hint()});
  f.addEventListener('input',e=>{if(e.target.removeAttribute)e.target.removeAttribute('aria-invalid');try{const o={contact_type:ctype()};DRAFT.forEach(k=>o[k]=f[k].value);localStorage.setItem('taklif-draft',JSON.stringify(o))}catch(e){}});
  ensureTurnstile(f);
  const src=prevPath||(()=>{try{const r=new URL(document.referrer);return r.origin===location.origin?r.pathname:null}catch(e){return null}})();
  if(src&&src!=='/taklif/') f.source_page.value=src;
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const v=k=>String(f[k].value||'').trim();
    err.textContent=''; out.className='out'; out.innerHTML='';
    f.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
    const bad=(k,msg)=>{const el=f.elements[k];if(el&&el.setAttribute){el.setAttribute('aria-invalid','true');el.focus()}err.textContent=msg};
    if(v('name').length<2) return bad('name','Ismingizni yozing (kamida 2 belgi).');
    if(v('message').length<10) return bad('message','Loyiha haqida kamida 10 belgi yozing.');
    if(!v('contact_value')) return bad('contact_value','Aloqa ma\'lumotini yozing.');
    if(ctype()==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('contact_value'))) return bad('contact_value','Email noto\'g\'ri ko\'rinadi.');
    if(!f.consent.checked) return bad('consent','Ma\'lumotlarni qayta ishlashga rozilik bering.');
    let utm={};try{utm=JSON.parse(sessionStorage.getItem('utm')||'{}')}catch(e){}
    const tsEl=f.querySelector('.cf-turnstile');
    const token=(window.turnstile&&tsEl?window.turnstile.getResponse(tsEl):'')||(f.querySelector('[name="cf-turnstile-response"]')||{}).value||'';
    const data={name:v('name'),contact_type:ctype(),contact_value:v('contact_value'),service:v('service'),
      budget_range:v('budget_range')||null,deadline:v('deadline')||null,message:v('message'),consent:true,
      source_page:v('source_page')||'/taklif/',utm,website:f.website.value,elapsed_ms:Date.now()-openedAt,turnstile_token:token};
    const btn=f.querySelector('button[type=submit]'); btn.disabled=true;
    let r,res={};
    try{r=await fetch(LEADS_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data),credentials:'same-origin'});try{res=await r.json()}catch(e){}}
    catch(e){btn.disabled=false;err.textContent="Internet aloqasi yo'q. Qayta urinib ko'ring yoki Telegram'da yozing.";return}
    btn.disabled=false;
    if(r.status===201||r.ok){
      showOk(out,res.message||OK_MSG);
      try{localStorage.removeItem('taklif-draft')}catch(e){}
      f.reset(); hint(); if(window.turnstile&&tsEl) try{window.turnstile.reset(tsEl)}catch(e){}
      try{if(typeof window.gtag==='function')window.gtag('event','lead_submit',{service:data.service})}catch(e){}
      try{const id=(document.querySelector('meta[name="ym-id"]')||{}).content||window.YM_COUNTER_ID;if(typeof window.ym==='function'&&id)window.ym(Number(id),'reachGoal','lead_submit')}catch(e){}
      out.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest'});
      return;
    }
    if(window.turnstile&&tsEl) try{window.turnstile.reset(tsEl)}catch(e){}
    if(r.status===422&&Array.isArray(res.errors)){
      const msgs=[];let first=null;
      res.errors.forEach(x=>{const el=x.field&&f.elements[x.field];if(el&&el.setAttribute){el.setAttribute('aria-invalid','true');first=first||el}msgs.push(x.msg)});
      if(first&&first.focus)first.focus();
      err.textContent=msgs.filter(Boolean).join(' ')||'Ma\'lumotlarni tekshiring.';return;
    }
    if(r.status===429){err.textContent="Juda ko'p urinish. Birozdan keyin qayta yuboring yoki Telegram'da yozing.";return}
    err.textContent="Taklif yuborilmadi. Birozdan keyin qayta urinib ko'ring yoki Telegram'da yozing.";
  });
}
function showOk(out,msg){
  out.className='out show';
  out.innerHTML='';const b=document.createElement('b');b.textContent=msg;const s=document.createElement('span');s.textContent='Taklifingiz qabul qilindi. Shoshilinch bo\'lsa — Telegram\'da yozing.';
  const acts=document.createElement('div');acts.className='acts';acts.innerHTML=`<a class="btn btn-m btn-sm" target="_blank" rel="noopener">Telegram'da yozish ↗</a>`;acts.firstChild.href=SITE.tgUrl||'https://t.me/jamalxon';
  out.append(b,s,acts);
}
function ensureTurnstile(f){
  const el=f.querySelector('.cf-turnstile'); if(!el) return;
  if(window.turnstile){if(!el.childElementCount)try{window.turnstile.render(el)}catch(e){}return}
  if(!document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]')){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js';s.async=true;s.defer=true;document.head.appendChild(s)}
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
(function(){const g=document.getElementById('giant');if(g.querySelector('span'))return;const txt=g.textContent.trim();g.innerHTML=[...txt].map(ch=>`<span data-l="${ch}">${ch}</span>`).join('');})();
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
  // o'lchov alohida yashirin nusxada: footer layout'i o'zgarmaydi (ResizeObserver tebranmaydi), flex siqmaydi
  const cs=getComputedStyle(el), m=document.createElement('span');
  m.textContent=el.textContent.trim();
  m.style.cssText=`position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};letter-spacing:-.05em;font-size:100px`;
  if(el.classList.contains('hero__giant')) m.style.letterSpacing='-.06em';
  document.body.appendChild(m); const w=m.getBoundingClientRect().width; m.remove();
  if(!w) return;
  const max=el.classList.contains('giant')?260:320;
  const size=Math.min(max,Math.floor(100*avail/w*0.97))+'px';
  if(el.style.fontSize!==size) el.style.fontSize=size;
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
  if(reduce) return;
  const rv=gsap.utils.toArray('#app .rv').filter(el=>!el.closest('.hero'));
  if(rv.length){gsap.set(rv,{opacity:0,y:34});ScrollTrigger.batch(rv,{start:'top 90%',onEnter:b=>gsap.to(b,{opacity:1,y:0,duration:.9,stagger:.07,ease:'power3.out',overwrite:true})})}
  // bo'lim kirib kelganda ichidagi kontent yengil ko'tariladi (ustma-ust kartalar hissi)
  gsap.utils.toArray('#app .sec').forEach(sec=>{if(sec.classList.contains('hero'))return;const inner=sec.firstElementChild;if(!inner)return;gsap.fromTo(inner,{y:56},{y:0,ease:'none',scrollTrigger:{trigger:sec,start:'top bottom',end:'top 45%',scrub:true}})});
  gsap.utils.toArray('#app .shead h2, #app .shead h1, #app .article h1, #app .pd__hero h1, #app .tak h1').forEach(h=>{gsap.from(h,{yPercent:28,opacity:0,duration:1,ease:'power4.out',scrollTrigger:{trigger:h,start:'top 88%'}})});
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

/* ---------- start ---------- */
(function boot(){
  const legacy=location.pathname==='/'&&location.hash?legacyTarget(location.hash):null;
  if(legacy&&!legacy.startsWith('/#')&&legacy!=='/'){app.style.visibility='hidden';go(legacy,{push:false,replace:true});return}
  if(legacy){history.replaceState(null,'',legacy);rendered=location.pathname+location.search}
  const section=location.hash?decodeURIComponent(location.hash.slice(1)):null;
  enter({initial:true,section});
})();
