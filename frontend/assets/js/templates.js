/* ============================================================
   SHABLONLAR — har bir sahifa HTML qaytaradi (hash-router chaqiradi)
   ============================================================ */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ICON = {
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  ig:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  edu:'<svg viewBox="0 0 24 24"><path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  erp:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v8M13 17h8"/></svg>',
  bot:'<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/></svg>',
  content:'<svg viewBox="0 0 24 24"><path d="M4 5h12M4 10h16M4 15h10M4 20h14"/><circle cx="19" cy="5" r="2"/></svg>',
  site:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 13h5M8 16h8"/></svg>',
  design:'<svg viewBox="0 0 24 24"><path d="m4 20 4-1 10-10-3-3L5 16z"/><path d="m13 7 3 3M15 4l2-2 3 3-2 2"/></svg>',
  link:'<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  ai:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>'
};
const catBadge = c => `<span class="badge ${CATS[c].badge}"><i></i>${CATS[c].dot}</span>`;
const illoTheme = i => ['red','yellow','cream'][i%3];
const figure = (p,i,cls='') => p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : IL.draw(p.illo, illoTheme(i));

function pcard(p,i,wide){
  return `<a class="pcard rv ${wide?'wide':''}" href="#loyiha-${p.slug}" data-cat="${p.cat}">
    <div class="fig">${figure(p,i)}${catBadge(p.cat)}</div>
    <div class="body"><div class="tl">${esc(p.tagline)}</div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
      <div class="stack">${p.stack.slice(0,4).map(s=>`<span>${esc(s)}</span>`).join('')}</div>
      <div class="more">Batafsil ${ICON.arrow}</div></div></a>`;
}
function shead(idx,h,lede,center){return `<div class="shead ${center?'center':''}"><span class="idx">${idx}</span><h2>${h}</h2>${lede?`<p class="lede">${lede}</p>`:''}</div>`}
function offerCard(o,i){
  return `<article class="offer rv"><div class="big">${String(i+1).padStart(2,'0')}</div><div class="ic">${ICON[o.icon]||ICON.chat}</div><h3>${esc(o.title)}</h3>
    <dl><div><dt>Muammo</dt><dd>${esc(o.problem)}</dd></div><div><dt>AI yechim</dt><dd>${esc(o.solution)}</dd></div></dl>
    <div class="ex">Misol: ${o.example.map(([t,s])=>`<a href="#loyiha-${s}">${esc(t)}</a>`).join(' ')}</div>
    <a class="btn btn-y btn-sm" href="#taklif" data-offer="${o.key}">Shu yechim kerak ${ICON.arrow}</a></article>`;
}
function postCard(p,feat){
  return `<a class="post rv ${feat?'feat':''}" href="#blog-${p.slug}"><div class="meta"><span>${fmtDate(p.date)}</span><i></i><span>${esc(p.read)}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><div class="tags">${p.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></a>`;
}
function fmtDate(d){const m=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];const [y,mo,da]=d.split('-');return `${+da} ${m[+mo-1]} ${y}`}
function crumbs(items){return `<nav class="crumbs" aria-label="Yo'l">${items.map((it,i)=>it[1]?`<a href="${it[1]}">${esc(it[0])}</a>${i<items.length-1?'<span>/</span>':''}`:`<strong>${esc(it[0])}</strong>`).join('')}</nav>`}

/* ---------------- BOSH SAHIFA ---------------- */
function tplHome(){
  const mq = a => a.map(x=>`<span>${esc(x)}</span>`).join('');
  const mq1=['Python','FastAPI','PostgreSQL','Redis','AI integratsiya','Telegram botlar','Multi-tenant SaaS','Meta webhooks','Xavfsizlik audit','Docker'];
  const mq2=['Savdo','Ta\'lim','Marketing','CRM / ERP','Instagram','EdTech','No-code','Claude','Gemini','Next.js'];
  return `
<section class="sec hero" data-theme="maroon" id="top">
  <div class="hero__giant" aria-hidden="true">JAMOLXON</div>
  <canvas id="badge" tabindex="0" aria-label="Ipga osilgan shaxsiy beyjik. Sichqoncha yoki barmoq bilan sudrang; Enter yoki Probel bosilsa tebranadi."></canvas>
  <div class="hero__txt">
    <div class="hero__tag rv"><i></i>Python Backend Developer · AI Solutions</div>
    <h1><span class="l"><span>Backend quraman.</span></span><span class="l"><span><em>AI</em> bilan biznes</span></span><span class="l"><span>muammolarini yechaman.</span></span></h1>
    <p class="lede rv">Men Jamolxon — Python backend dasturchi va Promtchi asoschisi. Web saytlar, Telegram botlar, CRM/ERP tizimlar, integratsiyalar, web dizayn va AI agentlar — g'oyadan ishga tushirishgacha, bitta jamoada.</p>
    <div class="hero__cta rv"><a class="btn btn-y" href="#taklif">${ICON.send} Loyiha taklif qilish</a><a class="btn btn-o" href="#s-xizmatlar"><span>Xizmatlar<span class="hide-sm">ni ko'rish</span></span></a></div>
  </div>
  <div class="hero__stage" id="stage">
    <div class="hero__hint" aria-hidden="true"><i></i>beyjikni sudrang ↕</div>
  </div>
  <div class="hero__facts">${FACTS.map(f=>`<div class="rv"><b data-count="${f.n}" data-suffix="${esc(f.suf)}">${f.n}${esc(f.suf)}</b><span>${esc(f.t)}</span></div>`).join('')}</div>
</section>
<div class="mqwrap" aria-hidden="true"><div class="mq"><div class="mq__t">${mq(mq1)}${mq(mq1)}</div></div></div>

<section class="sec" data-theme="red" id="xizmatlar">
  <div class="wrap">
    ${shead('01 · Xizmatlar','Nima <span class="outl">quraman</span>','Olti yo\'nalish — har biri alohida: nima kiradi, kimga, qanday ishlaymiz, misollar. Kartani oching.')}
    <div class="svcs">${SERVICES.map(svcCard).join('')}</div>
  </div>
</section>

<section class="sec" data-theme="maroon" id="yechimlar">
  <div class="wrap">
    ${shead('02 · AI sohalarda','AI sizning sohangizda <span class="acc">nima beradi</span>','Xizmatlar umumiy; bu yerda — aniq misollar: soha → muammo → AI yechim → ishlayotgan loyiha. «Shu yechim kerak» ni bossangiz, forma tayyor bo\'ladi.')}
    <div class="offers">${OFFERS.map(offerCard).join('')}</div>
    <div class="offers__cta rv"><p>Sohangiz ro'yxatda yo'qmi? Muammoni yozing — 24 soat ichida AI yechim taklifini qaytaraman.</p><a class="btn btn-y" href="#taklif">Muammoni yozish ${ICON.arrow}</a></div>
  </div>
</section>

<section class="sec" data-theme="yellow" id="loyihalar">
  <div class="wrap">
    ${shead('03 · Loyihalar','Ishlar — <span class="outl">to\'rt toifada</span>','Real ishlayotganlar, menejer sifatida boshqarganlarim, o\'zim uchun qilganlarim va sotuvdagi tayyor yechimlar. Har kartada qisqa ma\'lumot, ichida — to\'liq.')}
    <div class="tabs" id="tabs"><button class="tab on" data-f="all">Barchasi <b>${PROJECTS.length}</b></button>${Object.keys(CATS).map(c=>`<button class="tab" data-f="${c}">${CATS[c].label} <b>${PROJECTS.filter(p=>p.cat===c).length}</b></button>`).join('')}</div>
    <div class="pgrid" id="pgrid">${PROJECTS.map((p,i)=>pcard(p,i)).join('')}</div>
    <div class="pgrid__more"><a class="btn btn-m" href="#loyihalar">Toifalar bo'yicha katalog ${ICON.arrow}</a></div>
  </div>
</section>

<section class="sec" data-theme="maroon" id="jarayon">
  <div class="wrap">
    ${shead('04 · Jarayon','Bu odam bilan <span class="acc">ishlash qanday?</span>','Besh bosqich. Har birining oxirida siz aniq nimadir olasiz — va\'da emas, artefakt.')}
    <div class="steps" id="steps"><div class="bar" id="stepbar"></div>${STEPS.map((s,i)=>`<div class="step rv"><div class="n">${i+1}</div><h3>${esc(s.h)}</h3><p>${esc(s.d)}</p><div class="get"><b>Siz olasiz</b>${esc(s.get)}</div></div>`).join('')}</div>
  </div>
</section>

<section class="sec" data-theme="cream" id="blog">
  <div class="wrap">
    ${shead('05 · Blog','Tajribadan <span class="outl-acc">yozuvlar</span>','AI, backend va avtomatlashtirish haqida — real loyihalardan olingan saboqlar.')}
    <div class="posts">${POSTS.slice(0,3).map((p,i)=>postCard(p,i===0)).join('')}</div>
    <div class="pgrid__more"><a class="btn btn-m" href="#blog">Barcha yozuvlar ${ICON.arrow}</a></div>
  </div>
</section>

<section class="sec" data-theme="red" id="taklif-cta">
  <div class="wrap band">
    <div><h2>Loyiha bormi? <span class="outl">Yozing.</span></h2><p class="lede">Telegram, email yoki telefon — qaysi biri qulay bo'lsa. Yoki shu yerda formani to'ldiring: 24 soat ichida javob beraman.</p><div class="hero__cta" style="margin-top:30px"><a class="btn btn-y" href="#taklif">${ICON.send} Taklif yozish</a><a class="btn btn-o" href="${CONTACT.tgUrl}" target="_blank" rel="noopener">Telegram @${CONTACT.tg}</a></div></div>
    <div class="band__box rv"><b>Birinchi suhbatdan keyin siz olasiz</b><ul>
      <li><i>${ICON.check}</i>Muammoning texnik tahlili va AI yechim varianti</li>
      <li><i>${ICON.check}</i>MVP chegarasi: nima birinchi, nima keyin</li>
      <li><i>${ICON.check}</i>Bosqichlar, muddat va narx oralig'i</li>
      <li><i>${ICON.check}</i>Mavjud tayyor yechim bo'lsa — demo havolasi</li></ul></div>
  </div>
</section>
<div class="mqwrap" aria-hidden="true"><div class="mq red"><div class="mq__t">${mq(mq2)}${mq(mq2)}</div></div></div>`;
}

/* ---------------- LOYIHALAR KATALOGI ---------------- */
function tplProjects(){
  return `<section class="sec" data-theme="yellow" style="padding-top:120px"><div class="wrap">
    ${crumbs([['Bosh sahifa','#'],['Loyihalar']])}
    ${shead('Loyihalar','Barcha ishlar — <span class="outl">toifalar bo\'yicha</span>','Har toifa nima ekanini aniq yozdim: real ishlayotgan tizimni konsept bilan aralashtirmayman.')}
    ${Object.keys(CATS).map(c=>{const list=PROJECTS.filter(p=>p.cat===c);return `<div class="pgroup" id="cat-${c}"><div class="pgroup__h">${catBadge(c)}<h3>${esc(CATS[c].label)}</h3><p>${esc(CATS[c].desc)}</p></div><div class="pgrid">${list.map((p,i)=>pcard(p,i)).join('')}</div></div>`}).join('')}
  </div></section>`;
}

/* ---------------- LOYIHA SAHIFASI ---------------- */
function tplProject(slug){
  const i=PROJECTS.findIndex(p=>p.slug===slug); if(i<0) return tplNotFound();
  const p=PROJECTS[i], prev=PROJECTS[(i-1+PROJECTS.length)%PROJECTS.length], next=PROJECTS[(i+1)%PROJECTS.length];
  const themes=['maroon','red','maroon','maroon']; const theme = p.cat==='sale'?'red':'maroon';
  return `<section class="sec" data-theme="${theme}"><div class="wrap">
    ${crumbs([['Bosh sahifa','#'],['Loyihalar','#loyihalar'],[p.title]])}
    <div class="pd__hero" style="padding-top:0">
      <div><div>${catBadge(p.cat)}</div><h1>${esc(p.title)}</h1><div class="tl">${esc(p.tagline)}</div>
        <div class="pd__meta">${p.year?`<span class="chip">${esc(p.year)}</span>`:''}<span class="chip">${esc(CATS[p.cat].label)}</span><span class="chip">Rolim: ${esc(p.role)}</span></div>
        <div class="pd__links">${p.links.map(l=>`<a class="btn btn-y" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}<a class="btn btn-o" href="#taklif" data-offer="${p.cat==='sale'?'sale:'+p.slug:''}">${p.cat==='sale'?'Shu yechimni so\'rash':'Shunga o\'xshash loyiha kerak'}</a></div>
      </div>
      <div class="pd__fig rv">${figure(p,i)}</div>
    </div>
    <div class="pd__body">
      <div>${p.sections.map(s=>`<div class="pd__sec rv"><h3>${esc(s.h)}</h3>${s.p.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`).join('')}
        <div class="pd__sec rv"><h3>Shunga o'xshash tizim kerakmi?</h3><p>Shu loyihadagi yadro — ${esc(p.stack.slice(0,3).join(', '))} — sizning sohangizga ham moslashadi. Muammoni yozing, 24 soat ichida yechim taklifini qaytaraman.</p><a class="btn btn-y" href="#taklif">${ICON.send} Taklif yozish</a></div>
      </div>
      <aside class="pd__side">
        <div class="pd__box"><b>Texnologiyalar</b><div class="stack">${p.stack.map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>
        <div class="pd__box res"><b>Natija</b><ul>${p.results.map(r=>`<li>— ${esc(r)}</li>`).join('')}</ul></div>
        <div class="pd__box"><b>Rolim</b><p>${esc(p.role)}</p></div>
      </aside>
    </div>
    <div class="pd__nav"><a href="#loyiha-${prev.slug}"><small>← Oldingi</small><b>${esc(prev.title)}</b></a><a class="next" href="#loyiha-${next.slug}"><small>Keyingi →</small><b>${esc(next.title)}</b></a></div>
  </div></section>`;
}

/* ---------------- BLOG ---------------- */
function tplBlog(){
  return `<section class="sec" data-theme="cream" style="padding-top:120px"><div class="wrap">
    ${crumbs([['Bosh sahifa','#'],['Blog']])}
    ${shead('Blog','Tajribadan <span class="outl-acc">yozuvlar</span>','Real loyihalardan: nima ishladi, nima ishlamadi, qanday qilib to\'g\'riladim.')}
    <div class="posts">${POSTS.map((p,i)=>postCard(p,i===0)).join('')}</div>
  </div></section>`;
}
function tplPost(slug){
  const i=POSTS.findIndex(p=>p.slug===slug); if(i<0) return tplNotFound();
  const p=POSTS[i], next=POSTS[(i+1)%POSTS.length];
  return `<section class="sec" data-theme="cream"><div class="article" style="padding-top:0">
    ${crumbs([['Bosh sahifa','#'],['Blog','#blog'],[p.title]])}
    <div>${p.tags.map(t=>`<span class="chip">${esc(t)}</span> `).join('')}</div>
    <h1>${esc(p.title)}</h1><div class="meta"><span>Jamolxon</span><i></i><span>${fmtDate(p.date)}</span><i></i><span>${esc(p.read)}</span></div>
    ${p.body}
    <div class="cta"><p>Keyingi yozuv: ${esc(next.title)}</p><a class="btn btn-y" href="#blog-${next.slug}">O'qish ${ICON.arrow}</a></div>
  </div></section>`;
}

/* ---------------- TAKLIF ---------------- */
function tplTaklif(){
    return `<section class="sec" data-theme="yellow"><div class="wrap tak" style="padding-top:0">
    <div>${crumbs([['Bosh sahifa','#'],['Taklif']])}
      <h1>Loyiha taklif <span class="outl">qiling</span></h1>
      <p class="lede">Qisqacha yozing: soha, muammo, kutayotgan natija. Texnik tilda bo'lishi shart emas — men tarjima qilaman. 24 soat ichida javob beraman.</p>
      <div class="tak__how">
        <div><i>1</i><div><b>Formani to'ldirasiz</b>yoki Telegram'da yozasiz — qaysi qulay bo'lsa.</div></div>
        <div><i>2</i><div><b>Men tahlil qilaman</b>muammo, mavjud tizimlar, AI qayerda foyda beradi.</div></div>
        <div><i>3</i><div><b>Taklif olasiz</b>yechim varianti, bosqichlar, muddat va narx oralig'i.</div></div>
      </div>
      <div class="tak__ch" id="channels">
        <a href="${CONTACT.tgUrl}" target="_blank" rel="noopener"><span>@${CONTACT.tg}</span><small>Telegram</small></a>
        <a href="${CONTACT.ghUrl}" target="_blank" rel="noopener"><span>${CONTACT.gh}</span><small>GitHub</small></a>
        <a href="${CONTACT.igUrl}" target="_blank" rel="noopener"><span>${CONTACT.ig}</span><small>Instagram</small></a>
        <a href="#" data-mail><span>email</span><small>Email</small></a>
        <a href="#" data-tel><span>telefon</span><small>Telefon</small></a>
      </div>
    </div>
    <form class="form" id="takform" novalidate>
      <h2>Taklif formasi</h2>
      <div class="row"><label><span>Ismingiz <em>*</em></span><input name="name" required autocomplete="name" placeholder="Ism Familiya"></label><label>Kompaniya<input name="company" autocomplete="organization" placeholder="Kompaniya nomi (ixtiyoriy)"></label></div>
      <div class="row"><label>Nima kerak<select name="industry">${SERVICES.map(x=>`<option>${esc(x.title)}</option>`).join('')}<option>Boshqa / aniq emas</option></select></label><label>Sohangiz<input name="sphere" placeholder="masalan: savdo, ta'lim, qurilish"></label></div>
      <label><span>Loyiha haqida <em>*</em></span><textarea name="about" required placeholder="Qanday muammo bor? Hozir qanday hal qilinadi? Qanday natija kutyapsiz? Mavjud tizimlar (CRM, sayt, bot)?"></textarea></label>
      <div class="row"><label>Byudjet oralig'i<select name="budget"><option>Hali aniq emas</option><option>$500 — $1 500</option><option>$1 500 — $5 000</option><option>$5 000 — $15 000</option><option>$15 000+</option></select></label><label>Muddat<select name="deadline"><option>Shoshilinch emas</option><option>1 oy ichida</option><option>2–3 oy</option><option>Aniq sana bor</option></select></label></div>
      <fieldset><legend>Aloqa — kamida bittasi <em>*</em></legend>
        <div class="row3"><label>Telegram<input name="tg" placeholder="@username"></label><label>Email<input name="email" type="email" autocomplete="email" placeholder="siz@kompaniya.uz"></label><label>Telefon<input name="phone" type="tel" autocomplete="tel" placeholder="+998 90 000 00 00"></label></div>
      </fieldset>
      <fieldset><legend>Qaysi yo'l bilan bog'lanay?</legend><div class="radios"><label><input type="radio" name="pref" value="Telegram" checked>Telegram</label><label><input type="radio" name="pref" value="Email">Email</label><label><input type="radio" name="pref" value="Telefon">Telefon</label><label><input type="radio" name="pref" value="Farqi yo'q">Farqi yo'q</label></div></fieldset>
      <div class="actions"><button class="btn btn-y" type="submit">${ICON.send} Yuborish</button><span class="err" id="takerr"></span></div>
      <div class="out" id="takout"></div>
    </form>
  </div></section>`;
}

/* ---------------- XIZMATLAR ---------------- */
function svcCard(sv,i){
  return `<a class="svc rv" href="#xizmat-${sv.slug}"><div class="svc__top"><span class="svc__n">${String(i+1).padStart(2,'0')}</span><span class="svc__ic">${ICON[sv.icon]||ICON.site}</span></div>
    <h3>${esc(sv.title)}</h3><p>${esc(sv.short)}</p>
    <ul>${sv.includes.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <div class="svc__ex">${sv.examples.map(sl=>{const pr=PROJECTS.find(p=>p.slug===sl);return pr?`<span>${esc(pr.title)}</span>`:''}).join('')}</div>
    <div class="more">Batafsil va misollar ${ICON.arrow}</div></a>`;
}
function tplService(slug){
  const i=SERVICES.findIndex(x=>x.slug===slug); if(i<0) return tplNotFound();
  const sv=SERVICES[i], prev=SERVICES[(i-1+SERVICES.length)%SERVICES.length], next=SERVICES[(i+1)%SERVICES.length];
  const exs=sv.examples.map(sl=>PROJECTS.find(p=>p.slug===sl)).filter(Boolean);
  return `<section class="sec" data-theme="red"><div class="wrap">
    ${crumbs([['Bosh sahifa','#'],['Xizmatlar','#s-xizmatlar'],[sv.title]])}
    <div class="pd__hero" style="padding-top:0">
      <div><span class="badge b-live"><i></i>Xizmat ${String(i+1).padStart(2,'0')}</span><h1>${esc(sv.title)}</h1><div class="tl">${esc(sv.short)}</div>
        <div class="pd__links"><a class="btn btn-y" href="#taklif" data-offer="svc:${sv.slug}">${ICON.send} Shu xizmatni so'rash</a><a class="btn btn-o" href="${CONTACT.tgUrl}" target="_blank" rel="noopener">Telegram'da yozish</a></div></div>
      <div class="pd__fig rv">${IL.draw(sv.illo,'maroon')}</div>
    </div>
    <div class="pd__body">
      <div>
        <div class="pd__sec rv"><h3>Nima kiradi</h3><ul>${sv.includes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="pd__sec rv"><h3>Kimga kerak</h3><ul>${sv.who.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="pd__sec rv"><h3>Qanday ishlaymiz</h3><ol class="svc__steps">${sv.process.map((x,k)=>`<li><span>${k+1}</span>${esc(x)}</li>`).join('')}</ol></div>
        ${sv.faq.length?`<div class="pd__sec rv"><h3>Tez-tez so'raladi</h3>${sv.faq.map(([q,a])=>`<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`:''}
        <div class="pd__sec rv"><h3>Shu xizmat kerakmi?</h3><p>Qisqacha yozing: nima bor, nima kerak, qachon. 24 soat ichida yechim varianti, bosqichlar va narx oralig'ini qaytaraman.</p><a class="btn btn-y" href="#taklif" data-offer="svc:${sv.slug}">${ICON.send} Taklif yozish</a></div>
      </div>
      <aside class="pd__side">
        <div class="pd__box res"><b>Muddat</b><p style="font-weight:600">${esc(sv.timeline)}</p><p style="margin-top:8px;opacity:.75;font-size:13.5px">Aniq narx va muddat — texnik topshiriqdan keyin, yozma.</p></div>
        <div class="pd__box"><b>Texnologiyalar</b><div class="stack">${sv.stack.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
      </aside>
    </div>
    ${exs.length?`<div class="pgroup" style="margin-top:clamp(48px,6vw,96px)"><div class="pgroup__h"><h3>Misollar — ${esc(sv.title)}</h3><p>Shu xizmat doirasida qilingan real ishlar</p></div><div class="pgrid">${exs.map((p,k)=>pcard(p,k)).join('')}</div></div>`:''}
    <div class="pd__nav"><a href="#xizmat-${prev.slug}"><small>← Oldingi xizmat</small><b>${esc(prev.title)}</b></a><a class="next" href="#xizmat-${next.slug}"><small>Keyingi xizmat →</small><b>${esc(next.title)}</b></a></div>
  </div></section>`;
}

function tplNotFound(){return `<section class="sec" data-theme="maroon" style="min-height:70vh;display:grid;place-items:center"><div class="wrap" style="text-align:center"><h2>Sahifa topilmadi</h2><p class="lede" style="margin:18px auto 28px">Havola eskirgan bo'lishi mumkin.</p><a class="btn btn-y" href="#">Bosh sahifaga</a></div></section>`}
