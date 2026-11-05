/* ============================================================
   ILLYUSTRATSIYALAR — kodda chizilgan SVG "mahsulot kadrlari".
   Real skrinshot bo'lsa, PROJECTS[i].image ga qo'ying — SVG o'rniga chiqadi.
   Hamma rasm 640×400, palitra: maroon / red / yellow / cream.
   ============================================================ */
const IL = (()=>{
  const M='#250104', R='#D71A06', Y='#CDF73D', C='#FFF1DC', M2='#3a0509';
  const pal = {
    red:   {bg:R, win:M, win2:M2, a:Y, b:C, txt:C},
    maroon:{bg:M, win:M2, win2:'#4a070c', a:Y, b:R, txt:C},
    yellow:{bg:Y, win:M, win2:M2, a:R, b:C, txt:C},
    cream: {bg:C, win:M, win2:M2, a:R, b:Y, txt:C}
  };
  const open = (p)=>`<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><rect width="640" height="400" fill="${p.bg}"/>`;
  const close = ()=>`</svg>`;
  // brauzer oynasi
  const win = (p,x,y,w,h,r=18)=>`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${p.win}"/><rect x="${x}" y="${y}" width="${w}" height="34" rx="${r}" fill="${p.win2}"/><rect x="${x}" y="${y+18}" width="${w}" height="16" fill="${p.win2}"/><circle cx="${x+20}" cy="${y+17}" r="5" fill="${p.a}"/><circle cx="${x+36}" cy="${y+17}" r="5" fill="${p.b}" opacity=".8"/><circle cx="${x+52}" cy="${y+17}" r="5" fill="${p.txt}" opacity=".35"/><rect x="${x+w/2-70}" y="${y+10}" width="140" height="14" rx="7" fill="${p.txt}" opacity=".12"/></g>`;
  // telefon
  const phone = (p,x,y,w,h)=>`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="34" fill="${p.win}"/><rect x="${x+8}" y="${y+8}" width="${w-16}" height="${h-16}" rx="28" fill="${p.win2}"/><rect x="${x+w/2-34}" y="${y+16}" width="68" height="10" rx="5" fill="${p.win}"/></g>`;
  const lines = (p,x,y,ws,gap=12,h=8,op=.35)=>ws.map((w,i)=>`<rect x="${x}" y="${y+i*gap}" width="${w}" height="${h}" rx="4" fill="${p.txt}" opacity="${op}"/>`).join('');
  const blob = (p,cx,cy,r,fill,op=1)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${op}"/>`;
  const sticker = (p,x,y,txt,fill,col,rot=-6)=>`<g transform="rotate(${rot} ${x} ${y})"><rect x="${x-10}" y="${y-18}" width="${txt.length*11+22}" height="34" rx="17" fill="${fill}"/><text x="${x+txt.length*5.5+1}" y="${y+5}" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-weight="700" font-size="14" fill="${col}">${txt}</text></g>`;

  const kinds = {
    /* Dashboard: panel, grafik, kartalar */
    dashboard(p){
      let s = win(p,60,50,520,320);
      // sidebar
      s += `<rect x="60" y="84" width="110" height="286" fill="${p.win2}" opacity=".6"/>` + lines(p,78,110,[70,54,64,48,60],22,9,.3);
      s += `<rect x="78" y="100" width="74" height="12" rx="6" fill="${p.a}"/>`;
      // KPI cards
      [[190,100],[316,100],[442,100]].forEach(([x,y],i)=>{s+=`<rect x="${x}" y="${y}" width="112" height="64" rx="12" fill="${p.win2}"/><rect x="${x+12}" y="${y+12}" width="44" height="7" rx="3" fill="${p.txt}" opacity=".35"/><rect x="${x+12}" y="${y+30}" width="${[70,52,80][i]}" height="16" rx="4" fill="${[p.a,p.b,p.a][i]}"/>`});
      // chart
      s += `<rect x="190" y="180" width="364" height="170" rx="14" fill="${p.win2}"/>`;
      const bars=[40,70,55,95,80,120,100,135,110,150];
      bars.forEach((h,i)=>{s+=`<rect class="il-bar" style="animation-delay:${i*.12}s" x="${210+i*34}" y="${330-h}" width="20" height="${h}" rx="6" fill="${i%3==2?p.b:p.a}" opacity="${i%3==2?.9:1}"/>`});
      s += `<polyline points="${bars.map((h,i)=>`${220+i*34},${310-h*.7}`).join(' ')}" fill="none" stroke="${p.txt}" stroke-width="3" opacity=".55" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += sticker(p,470,70,'Live',p.a,M,6);
      return open(p)+s+close();
    },
    /* Chat / bot: telefon, xabarlar */
    chat(p){
      let s = blob(p,520,90,90,p.a,.9)+blob(p,110,330,60,p.b,.8);
      s += phone(p,220,30,200,360);
      const msgs=[[1,120,'a'],[0,150,'t'],[1,90,'a'],[0,130,'t'],[1,150,'a']];
      let y=66;
      msgs.forEach(([me,w,k],i)=>{const x=me?408-w-0:236;s+=`<g class="il-float" style="animation-delay:${i*.4}s"><rect x="${x}" y="${y}" width="${w}" height="34" rx="14" fill="${me?p.a:p.txt}" opacity="${me?1:.22}"/>${me?`<rect x="${x+12}" y="${y+13}" width="${w-24}" height="8" rx="4" fill="${M}" opacity=".7"/>`:`<rect x="${x+12}" y="${y+13}" width="${w-24}" height="8" rx="4" fill="${p.txt}" opacity=".5"/>`}</g>`;y+=46});
      s += `<rect x="236" y="330" width="140" height="36" rx="18" fill="${p.txt}" opacity=".12"/><circle cx="392" cy="348" r="18" fill="${p.b}"/><path d="M386 348l10-6-2 6 2 6z" fill="${M}"/>`;
      s += sticker(p,60,70,'aiogram',p.a,M,-8)+sticker(p,470,320,'24/7',p.b,C,6);
      return open(p)+s+close();
    },
    /* Lug'at kartalari */
    cards(p){
      let s='';
      const cards=[[80,110,-8,p.b],[200,80,-3,p.txt],[330,60,3,p.a],[460,90,8,p.b]];
      cards.forEach(([x,y,r,f],i)=>{s+=`<g class="il-float" style="animation-delay:${i*.5}s" transform="rotate(${r} ${x+70} ${y+120})"><rect x="${x}" y="${y}" width="140" height="240" rx="20" fill="${f}" opacity="${f===p.txt?.9:1}"/><rect x="${x+20}" y="${y+28}" width="60" height="12" rx="6" fill="${M}" opacity=".6"/><rect x="${x+20}" y="${y+60}" width="100" height="26" rx="8" fill="${M}" opacity=".85"/><rect x="${x+20}" y="${y+100}" width="88" height="8" rx="4" fill="${M}" opacity=".35"/><rect x="${x+20}" y="${y+116}" width="70" height="8" rx="4" fill="${M}" opacity=".35"/><circle cx="${x+40}" cy="${y+200}" r="14" fill="${M}" opacity=".9"/><path d="M${x+33} ${y+200}l5 5 9-10" stroke="${f===p.a?p.a:C}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`});
      s += sticker(p,60,50,'14 rejim',p.a,M,-6)+sticker(p,470,350,'AI chat',M,C,5);
      return open(p)+s+close();
    },
    /* Imtihon: varaq + baho */
    exam(p){
      let s = `<rect x="90" y="40" width="300" height="340" rx="16" fill="${p.txt}"/>`+lines({txt:M},120,80,[200,240,180,230,210,160,220,190,240,170],20,8,.25);
      s += `<rect x="120" y="300" width="180" height="40" rx="10" fill="${p.a}" opacity=".9"/>`;
      // band score panel
      s += `<g class="il-float"><rect x="360" y="110" width="220" height="210" rx="18" fill="${p.win}"/><text x="470" y="180" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-weight="900" font-size="64" fill="${p.a}">7.5</text><rect x="390" y="200" width="160" height="8" rx="4" fill="${p.txt}" opacity=".25"/>`;
      ['TA','CC','LR','GRA'].forEach((k,i)=>{s+=`<rect x="${390+i*40}" y="${225}" width="30" height="${[60,50,70,45][i]}" rx="6" fill="${i==2?p.b:p.a}" class="il-bar" style="animation-delay:${i*.2}s" transform="translate(0 ${70-[60,50,70,45][i]})"/>`});
      s += `</g>`+sticker(p,60,360,'IELTS Writing',p.b,C,-4);
      return open(p)+s+close();
    },
    /* Sayt: hero + bloklar */
    site(p){
      let s = win(p,50,40,540,330);
      s += `<rect x="80" y="100" width="260" height="30" rx="8" fill="${p.txt}"/><rect x="80" y="140" width="200" height="30" rx="8" fill="${p.txt}"/><rect x="80" y="190" width="180" height="10" rx="5" fill="${p.txt}" opacity=".4"/><rect x="80" y="206" width="140" height="10" rx="5" fill="${p.txt}" opacity=".4"/><rect x="80" y="240" width="130" height="40" rx="20" fill="${p.a}"/>`;
      s += `<rect x="380" y="100" width="180" height="180" rx="18" fill="${p.a}" opacity=".9"/><circle cx="470" cy="190" r="50" fill="${p.win}"/><path d="M450 190l12 12 28-28" stroke="${p.a}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      [80,250,420].forEach((x,i)=>{s+=`<rect x="${x}" y="305" width="140" height="44" rx="10" fill="${p.win2}"/><rect x="${x+14}" y="${320}" width="80" height="8" rx="4" fill="${p.txt}" opacity=".4"/>`});
      s += sticker(p,470,60,'promtchi',M,C,6);
      return open(p)+s+close();
    },
    /* Brending: logotip belgisi + palitra */
    brand(p){
      let s = `<rect x="70" y="60" width="300" height="280" rx="24" fill="${p.win}"/>`;
      s += `<g class="il-spin"><path d="M220 110l70 80-70 80-70-80z" fill="${p.a}"/><circle cx="220" cy="190" r="26" fill="${p.win}"/></g>`;
      s += `<rect x="100" y="300" width="120" height="12" rx="6" fill="${p.txt}" opacity=".5"/>`;
      [[p.a,M],[p.b,M],[C,M],[M2,p.a]].forEach(([f,t],i)=>{s+=`<rect x="400" y="${70+i*68}" width="170" height="56" rx="14" fill="${f}"/><rect x="416" y="${90+i*68}" width="60" height="8" rx="4" fill="${t}" opacity=".6"/><rect x="416" y="${104+i*68}" width="36" height="8" rx="4" fill="${t}" opacity=".35"/>`});
      s += sticker(p,70,370,'27 slayd',p.b,C,-4);
      return open(p)+s+close();
    },
    /* 3D ofis: izometrik bloklar */
    office(p){
      const iso=(x,y,w,h,d,f1,f2,f3)=>`<g transform="translate(${x} ${y})"><path d="M0 0l${w} ${-w/2}l${d} ${d/2}l${-w} ${w/2}z" fill="${f1}"/><path d="M0 0v${h}l${d} ${d/2}v${-h}z" fill="${f2}"/><path d="M${d} ${d/2}v${h}l${w} ${-w/2}v${-h}z" fill="${f3}"/></g>`;
      let s = `<path d="M320 60l260 130-260 130L60 190z" fill="${p.win}"/>`;
      s += iso(150,180,70,60,40,p.a,M2,p.b)+iso(300,120,70,80,40,p.b,M2,p.a)+iso(400,190,70,50,40,C,M2,p.a)+iso(250,230,70,40,40,p.a,M2,C);
      ['Tadqiqot','Reja','Senariy','Tarjima'].forEach((t,i)=>{s+=`<g class="il-float" style="animation-delay:${i*.6}s">${sticker(p,[120,300,420,230][i],[150,95,165,210][i],t,M,C,0)}</g>`});
      s += `<path d="M190 150 Q300 60 330 95 M370 110 Q420 120 440 160 M440 200 Q360 230 300 215" stroke="${p.a}" stroke-width="3" fill="none" class="il-dash"/>`;
      return open(p)+s+close();
    },
    /* Do'kon: mahsulot kartasi + variantlar */
    shop(p){
      let s = win(p,60,40,520,330);
      s += `<rect x="90" y="100" width="200" height="240" rx="18" fill="${p.win2}"/><rect x="130" y="130" width="120" height="180" rx="22" fill="${p.a}"/><rect x="150" y="150" width="80" height="120" rx="8" fill="${M}" opacity=".85"/>`;
      s += `<rect x="320" y="110" width="220" height="22" rx="8" fill="${p.txt}"/><rect x="320" y="142" width="140" height="10" rx="5" fill="${p.txt}" opacity=".4"/>`;
      [p.a,p.b,C,p.txt].forEach((f,i)=>{s+=`<circle cx="${338+i*34}" cy="190" r="12" fill="${f}" opacity="${i==3?.4:1}"/>`});
      s += `<circle cx="338" cy="190" r="16" fill="none" stroke="${p.txt}" stroke-width="2"/>`;
      ['128','256','512'].forEach((t,i)=>{s+=`<rect x="${320+i*70}" y="215" width="60" height="30" rx="10" fill="${i==1?p.a:p.win2}"/><text x="${350+i*70}" y="235" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="12" fill="${i==1?M:p.txt}">${t}</text>`});
      s += `<rect x="320" y="270" width="110" height="26" rx="6" fill="${p.a}" opacity=".9"/><rect x="320" y="310" width="200" height="40" rx="20" fill="${p.b}"/><rect x="380" y="326" width="80" height="8" rx="4" fill="${C}" opacity=".9"/>`;
      return open(p)+s+close();
    },
    /* AI: neyron tugunlar */
    ai(p){
      let s='';
      const nodes=[[120,120],[120,200],[120,280],[300,90],[300,170],[300,250],[300,330],[480,140],[480,260]];
      const edges=[[0,3],[0,4],[1,4],[1,5],[2,5],[2,6],[3,7],[4,7],[4,8],[5,8],[6,8],[3,8]];
      edges.forEach(([a,b],i)=>{s+=`<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="${p.txt}" stroke-width="2" opacity=".3"/>`});
      nodes.forEach(([x,y],i)=>{s+=`<circle class="il-pulse" style="animation-delay:${i*.2}s" cx="${x}" cy="${y}" r="${i>=7?22:14}" fill="${i>=7?p.a:(i>=3?p.b:p.txt)}"/>`});
      s += `<rect x="520" y="90" width="80" height="220" rx="18" fill="${p.win}"/>`+lines(p,536,112,[48,36,44,30,46,40,34],24,9,.4);
      s += sticker(p,70,360,'AI mahsulot',p.a,M,-5);
      return open(p)+s+close();
    },
    /* Media bot: telefon + video karta + nota */
    bot(p){
      let s = phone(p,100,30,200,360);
      s += `<rect x="118" y="70" width="164" height="110" rx="16" fill="${p.a}"/><path d="M190 110l26 15-26 15z" fill="${M}"/><rect x="118" y="196" width="164" height="36" rx="14" fill="${p.txt}" opacity=".18"/><rect x="118" y="244" width="120" height="36" rx="14" fill="${p.txt}" opacity=".18"/><rect x="160" y="292" width="122" height="36" rx="14" fill="${p.b}"/>`;
      s += `<g class="il-float"><rect x="360" y="90" width="220" height="150" rx="20" fill="${p.win}"/><circle cx="420" cy="165" r="34" fill="${p.a}"/><path d="M414 150v26a8 8 0 1 1-6-8V146l22-6v24a8 8 0 1 1-6-8" fill="${M}"/><rect x="470" y="140" width="90" height="12" rx="6" fill="${p.txt}" opacity=".8"/><rect x="470" y="162" width="60" height="10" rx="5" fill="${p.txt}" opacity=".4"/><rect x="470" y="190" width="80" height="22" rx="11" fill="${p.b}"/></g>`;
      s += sticker(p,380,300,'2 GB',p.a,M,6)+sticker(p,470,350,'yt-dlp · shazam',M,C,-4);
      return open(p)+s+close();
    },
    /* Portfolio: zarracha-portret belgisi */
    portfolio(p){
      let s = win(p,60,40,520,330);
      let dots='';
      for(let i=0;i<220;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*85;const x=200+Math.cos(a)*r,y=170+Math.sin(a)*r*1.15;dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5+Math.random()*2.5).toFixed(1)}" fill="${Math.random()<.8?p.a:p.b}" opacity="${(.5+Math.random()*.5).toFixed(2)}"/>`}
      for(let i=0;i<120;i++){const x=120+Math.random()*160,y=280+Math.random()*60;dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5+Math.random()*2).toFixed(1)}" fill="${p.a}" opacity="${(.3+Math.random()*.5).toFixed(2)}"/>`}
      s += `<g class="il-float">${dots}</g>`;
      s += `<rect x="340" y="110" width="200" height="26" rx="8" fill="${p.txt}"/><rect x="340" y="146" width="150" height="26" rx="8" fill="${p.a}"/><rect x="340" y="190" width="180" height="9" rx="4" fill="${p.txt}" opacity=".4"/><rect x="340" y="206" width="140" height="9" rx="4" fill="${p.txt}" opacity=".4"/><rect x="340" y="240" width="140" height="38" rx="19" fill="${p.b}"/>`;
      return open(p)+s+close();
    }
  };
  return {
    draw(kind, theme){ const p = pal[theme] || pal.red; return (kinds[kind]||kinds.site)(p); },
    themes:Object.keys(pal)
  };
})();
