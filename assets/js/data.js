/* ============================================================
   MA'LUMOTLAR — faqat shu faylni tahrirlab kontentni yangilaysiz.
   Loyiha kategoriyalari: prod | pm | own | sale
   illo: dashboard | chat | cards | exam | site | brand | office | shop | ai | bot | portfolio
   image: null bo'lsa SVG illyustratsiya; real skrinshot qo'ysangiz (URL yoki data:) o'sha chiqadi.
   ============================================================ */
const CATS = {
  prod:{label:'Real ishlayotgan', short:'Production', badge:'b-live', dot:'Live', desc:'Hozir ishlayotgan, foydalanuvchilari bor tizimlar — ochiq havola bilan.'},
  pm:  {label:'Loyiha menejeri sifatida', short:'PM', badge:'b-pm', dot:'PM', desc:'Jamoa bilan qurilgan mahsulotlar: men talablar, bosqichlar, sifat va muddatni boshqarganman.'},
  own: {label:"O'zim uchun qilganlarim", short:'Shaxsiy', badge:'b-own', dot:'Shaxsiy', desc:"Tajriba va o'z ehtiyojim uchun qurilgan narsalar — eng ko'p o'rgangan joylarim."},
  sale:{label:'Tayyor yechimlar — sotuvda', short:'Sotuvda', badge:'b-sale', dot:'Sotuvda', desc:"Taklif uchun qilingan, ishlaydigan yechimlar: sizning brendingizga moslab 1–2 haftada ishga tushadi."}
};

const PROJECTS = [
  /* ---------------- PRODUCTION ---------------- */
  {slug:'socialauto', cat:'prod', title:'SocialAuto', url:'https://socialauto.uz', year:'2025',
   tagline:'Instagram izohiga avtomatik javob va DM yuboruvchi SaaS',
   summary:"«Narxi?» deb yozgan yuzlab izohga qo'lda javob berib bo'lmaydi. SocialAuto kalit so'zli izohni ushlaydi, javob beradi va Direct'ga havola yuboradi — lid yo'qolmaydi.",
   illo:'dashboard', image:null, stack:['FastAPI','ARQ','PostgreSQL','Redis','Next.js 14','Tailwind','Instagram Graph API'],
   role:'Backend, frontend, mahsulot rejasi',
   sections:[
     {h:'Muammo', p:["Instagram orqali sotadigan biznesda bitta post ostiga yuzlab bir xil izoh tushadi: «narxi?», «manzil?», «yetkazib berish bormi?». Odam ulgurmaydi, kechqurun kelgan lidlar ertalabgacha sovib qoladi."]},
     {h:'Yechim', p:["Biznes kalit so'zlarni va javob matnini sozlaydi. Izoh tushishi bilan tizim unga ochiq javob yozadi va foydalanuvchiga Direct'da havola yuboradi (comment-to-DM). Hammasi Meta'ning rasmiy webhook'lari orqali, akkauntga xavf yo'q.", "Keyingi bosqich — lead assistant: DM'da ism va telefonni so'rab, Telegram, amoCRM yoki Bitrix24'ga uzatadi."]},
     {h:'Texnik tomoni', p:["FastAPI + ARQ fon vazifalari: webhook darhol qabul qilinadi, javob navbatda ishlanadi — Instagram'ning vaqt chegarasiga sig'adi. PostgreSQL va Redis real muhitda tekshirilgan 68 ta pytest unit test va to'liq webhook oqimi sinovi bor.", "Frontend — Next.js 14, Tailwind, GSAP va Lenis: landing, login va 7 ta boshqaruv paneli sahifasi."]},
     {h:'Nimani o\'rgandim', p:["Meta API bilan ishlashda eng qimmat narsa — webhook'ni imzo bilan tekshirish va takroriy hodisalarni yutish. Shuni birinchi kundan qursangiz, qolgani oson."]}
   ],
   results:["Izoh → javob → Direct'da havola: odam aralashuvisiz","68 unit test real PostgreSQL va Redis'da","7 sahifali boshqaruv paneli"],
   links:[{label:'socialauto.uz',url:'https://socialauto.uz'}]},

  {slug:'vocably', cat:'prod', title:'Vocably', url:'https://vocably.uz', year:'2025',
   tagline:"Ingliz tili o'rganish platformasi: 14 ta lug'at rejimi, IELTS, AI chat",
   summary:"So'z yodlash, IELTS mashqi va AI suhbatdosh — bitta joyda. 14 ta o'rganish rejimi, Reading/Listening/Writing/Speaking bo'limlari, reyting va do'stlar chati.",
   illo:'cards', image:null, stack:['Next.js','Vercel','MongoDB','Gemini','OpenRouter'],
   role:"To'liq: backend, frontend, AI, dizayn",
   sections:[
     {h:'Muammo', p:["Ingliz tilini o'rganuvchi so'z yodlash uchun bitta ilova, IELTS mashqi uchun boshqa sayt, savol so'rash uchun uchinchi joyga yuradi. Har joyda alohida akkaunt, alohida progress."]},
     {h:'Yechim', p:["Vocably — bitta hisob, bitta progress. So'z yodlashning 14 ta rejimi (kartochka, tanlov, yozish, eshitish va boshqalar), IELTS bo'limlari, do'stlar bilan reyting va chat, hamda AI chat: so'zni kontekstda tushuntiradi, misol beradi, yozma ishni tekshiradi."]},
     {h:'Texnik tomoni', p:["Next.js (Vercel) + MongoDB. AI qatlami OpenRouter va Gemini orqali — model almashtirish bir qator sozlama. To'liq admin panel: statistika, foydalanuvchilar, reportlar, audit log, kontent studiyasi va AI natijalarini tekshirish navbati — AI'ning har bir javobi odam ko'zidan o'tishi mumkin."]},
     {h:'Nimani o\'rgandim', p:["AI mahsulotda eng muhim ekran — admin uchun «AI nima dedi va to'g'rimi?» ekrani. U bo'lmasa sifatni o'lchab bo'lmaydi."]}
   ],
   results:["14 ta o'rganish rejimi","AI chat + yozma ishni tekshirish","Admin panel: audit log va AI tekshiruv navbati"],
   links:[{label:'vocably.uz',url:'https://vocably.uz'}]},

  {slug:'promtchi-uz', cat:'prod', title:'promtchi.uz', url:'https://promtchi.uz', year:'2025',
   tagline:'Promtchi IT studiyasining sayti',
   summary:"O'zim asos solgan Promtchi studiyasining sayti: xizmatlar, ishlar va aloqa. Tez, yengil, AWS Lightsail'da o'zim deploy qilganman.",
   illo:'site', image:null, stack:['HTML','CSS','JavaScript','Linux','AWS Lightsail','Nginx'],
   role:'Dizayn, frontend, deploy',
   sections:[
     {h:'Nima qilindi', p:["Studiya uchun korporativ sayt: kim ekanimiz, nima qilamiz, qanday bog'lanish. Ortiqcha freymvorksiz — toza HTML/CSS/JS, shuning uchun sekundning bir qismida ochiladi.", "Server: AWS Lightsail, Nginx, SSL. Deploy va monitoringni o'zim yuritaman."]},
     {h:'Nega muhim', p:["Promtchi — men va hamkorim qurayotgan studiya; sayt bizning «yuz»imiz. Shu yerdagi barcha loyihalar Promtchi nomi ostida ham taqdim etiladi."]}
   ],
   results:["Live — promtchi.uz","O'z serverimizda, o'z nazoratimizda"],
   links:[{label:'promtchi.uz',url:'https://promtchi.uz'}]},

  {slug:'chindan-brending', cat:'prod', title:'Chindan Group — brending', year:'2025',
   tagline:'Logotipni vektorda qayta qurish va aydentika taqdimoti',
   summary:"Mijozning eski rastr logotipi vektorda qayta qurildi, yangi belgi ishlab chiqildi va 27 slaydli aydentika taqdimoti topshirildi.",
   illo:'brand', image:null, stack:['Vektor grafika','Aydentika','HTML taqdimot'],
   role:'Dizayn va taqdimot',
   sections:[
     {h:'Vazifa', p:["Chindan Group'da logotip faqat past sifatli rastr ko'rinishda bor edi — chop etishga ham, saytga ham yaramasdi. Brendni tartibga keltirish kerak edi."]},
     {h:'Nima qilindi', p:["Logotip vektorda qaytadan qurildi, yangi belgi (znak) taklif qilindi, ranglar, shrift va qo'llanish qoidalari 27 slaydli aydentika taqdimotida jamlandi. Taqdimot HTML ko'rinishda — brauzerda ochiladi, hech qanday dastur kerak emas."]},
     {h:'Natija', p:["Mijoz vektor fayllar to'plami va brend qoidalarini oldi. Keyinroq shu asosda Chindan Group uchun ERP va yangi sayt ustida ish boshlandi."]}
   ],
   results:["Vektor logotip + yangi belgi","27 slaydli aydentika taqdimoti","Mijozga topshirilgan"],
   links:[]},

  {slug:'vidyuklaydi-bot', cat:'prod', title:'@vidyuklaydi_bot', url:'https://t.me/vidyuklaydi_bot', year:'2024',
   tagline:'Video yuklovchi va musiqa aniqlovchi Telegram bot',
   summary:"Havola tashlaysiz — video keladi. Videodagi musiqani ham aniqlab beradi. 2 GB gacha fayl, menyusiz: bot nima qilishini o'zi tushunadi.",
   illo:'bot', image:null, stack:['aiogram 3.x','ARQ','yt-dlp','shazamio','Local Bot API Server'],
   role:"To'liq: bot, navbat, server",
   sections:[
     {h:'Muammo', p:["Oddiy foydalanuvchi uchun videoni saqlab olish yoki undagi musiqani topish — bir nechta sayt, reklama va kutish. Telegram ichida bitta xabar bilan hal bo'lishi kerak."]},
     {h:'Yechim', p:["Bot havolani oladi, yt-dlp bilan yuklaydi, ARQ navbatida ishlaydi (bir vaqtda ko'p so'rov bo'lsa ham bloklanmaydi) va natijani qaytaradi. «Bu qaysi musiqa?» deb so'rasangiz, shazamio orqali aniqlab beradi.", "Standart Telegram Bot API 50 MB'gacha fayl yuboradi — Local Bot API Server o'rnatilgani uchun bot 2 GB gacha fayl bilan ishlaydi."]},
     {h:'Nimani o\'rgandim', p:["Botda eng yaxshi interfeys — interfeysning yo'qligi. Menyu, tugma, buyruq yo'q: havola → natija."]}
   ],
   results:["2 GB gacha fayl (Local Bot API Server)","Video + musiqa aniqlash bitta botda","Menyusiz UX"],
   links:[{label:'@vidyuklaydi_bot',url:'https://t.me/vidyuklaydi_bot'}]},

  /* ---------------- PM ---------------- */
  {slug:'natiq-ai', cat:'pm', title:'Natiq AI', year:'2025',
   tagline:'AI mahsulot — loyiha menejeri sifatida',
   summary:"Jamoa bilan qurilgan AI mahsulot. Mening rolim — loyiha menejeri: talablar, bosqichlar, jamoa muvofiqligi va sifat nazorati.",
   illo:'ai', image:null, stack:['AI mahsulot','Loyiha boshqaruvi'],
   role:'Loyiha menejeri',
   sections:[
     {h:'Mening rolim', p:["Mahsulot g'oyasini texnik topshiriqqa aylantirish, ishni bosqichlarga bo'lish, dasturchilar va dizayner orasida muvofiqlikni ta'minlash, har bosqich oxirida natijani qabul qilish.", "Dasturchi bo'lganim uchun jamoa bilan bir tilda gaplashaman: TZ'dagi har bir band texnik jihatdan bajariladigan va tekshiriladigan bo'ladi."]},
     {h:'Qanday ishlaymiz', p:["Haftalik sprintlar, har sprint oxirida ishlaydigan demo. Muammo yashirilmaydi — muddatga ta'sir qilsa, mijoz birinchi bo'lib biladi."]}
   ],
   results:["Loyiha boshqaruvi: TZ, sprintlar, QA"],
   links:[]},

  {slug:'tizimly', cat:'pm', title:'Tizimly', url:'https://tizimly.uz', year:'2025',
   tagline:"Multi-tenant B2B SaaS: savdo, moliya, CRM, qo'ng'iroqlar, analitika",
   summary:"Biznes uchun bitta tizim: savdo bo'limi, moliya, mijozlar bazasi, qo'ng'iroqlar va analitika. Ko'p kompaniya bitta platformada, ma'lumotlar bir-biridan to'liq ajratilgan.",
   illo:'dashboard', image:null, stack:['Multi-tenant SaaS','CRM','Moliya','Analitika'],
   role:'Loyiha menejeri',
   sections:[
     {h:'Mahsulot', p:["Tizimly — o'sayotgan kompaniyalar uchun boshqaruv platformasi: savdo voronkasi, moliya hisobi, mijozlar bazasi (CRM), qo'ng'iroqlar nazorati va rahbar uchun analitika — bitta oynada."]},
     {h:'Mening rolim', p:["Loyiha menejeri: modul bo'yicha talablar, bosqichlar va muddatlar, jamoa bilan kunlik muvofiqlik, sifat nazorati. Multi-tenant arxitekturada eng muhim talab — bir mijozning ma'lumoti boshqasiga hech qachon ko'rinmasligi; bu har bir modul qabul qilinishida tekshiriladi."]}
   ],
   results:["5 modul: savdo, moliya, CRM, qo'ng'iroqlar, analitika","Multi-tenant: har mijoz alohida izolyatsiyada"],
   links:[{label:'tizimly.uz',url:'https://tizimly.uz'}]},

  {slug:'chindan-erp', cat:'pm', title:'Chindan ERP', year:'2025',
   tagline:'Chindan Group uchun ichki ERP tizimi',
   summary:"Kompaniyaning ichki jarayonlarini bitta tizimga yig'adigan ERP. Brending ishidan keyin boshlangan ikkinchi loyiha — ishonch ishga aylandi.",
   illo:'dashboard', image:null, stack:['ERP','Ichki tizim','Loyiha boshqaruvi'],
   role:'Loyiha menejeri',
   sections:[
     {h:'Mahsulot', p:["Chindan Group uchun ichki ERP: kompaniya jarayonlari, rollar va hisobotlar bitta tizimda. Tizim faqat ichki foydalanish uchun — ochiq havola yo'q."]},
     {h:'Mening rolim', p:["Loyiha menejeri: mijoz bilan talablarni aniqlash, jarayonlarni xaritalash, jamoa uchun TZ, bosqichma-bosqich topshirish va qabul qilish."]}
   ],
   results:["Brendingdan ERP'gacha — bitta mijoz bilan uzoq hamkorlik"],
   links:[]},

  /* ---------------- OWN ---------------- */
  {slug:'promtchi-hq', cat:'own', title:'Promtchi HQ', year:'2025',
   tagline:"AI agentlar ishlaydigan 3D virtual ofis",
   summary:"Brauzerda ochiladigan 3D ofis: har bir xonada o'z vazifasi bor AI agent — tadqiqot, kontent reja, senariy, tarjima. Three.js'da qurilgan.",
   illo:'office', image:null, stack:['Three.js','WebGL','AI agentlar'],
   role:'3D interfeys va integratsiya',
   sections:[
     {h:"G'oya", p:["Marketing agentligida ish zanjiri bor: trend tahlili → kontent reja → senariy va kopirayting → tarjima (EN→UZ). Har bir bosqichni alohida AI agent bajaradi. Buni jadval emas, 3D ofis sifatida ko'rsatsak — jamoa jarayonni «ko'radi»."]},
     {h:'Nima qurildi', p:["Three.js'da virtual ofis: xonalar, agentlar, ular orasidagi topshiriq oqimi. Agentlar spetsifikatsiyasi hamkasbim Samandar tomonidan yozilgan; 3D interfeys va integratsiya — mening ishim."]},
     {h:'Holat', p:["Prototip. Shu yerdagi avatar va 3D elementlar ham o'sha tajribaning davomi."]}
   ],
   results:["Three.js 3D ofis prototipi","4 bosqichli agentlar zanjiri vizualizatsiyasi"],
   links:[]},

  {slug:'portfolio-bot', cat:'own', title:'Portfolio bot', year:'2025',
   tagline:'CV va portfolio boti: AI FAQ va bilim bazasi',
   summary:"Telegram'da men haqimda so'rang — bot javob beradi. Mijoz xabarlarini menga yo'naltiradi, bilim bazasi /knowledge buyrug'i bilan yangilanadi, 3 tilda.",
   illo:'chat', image:null, stack:['aiogram 3.x','AI','Bilim bazasi'],
   role:"To'liq",
   sections:[
     {h:'Nima qiladi', p:["Bot — mening Telegram'dagi vizitkam. Loyihalar, stek, narx siyosati haqidagi savollarga AI bilim bazasidan javob beradi; aniq taklif bo'lsa, xabarni menga uzatadi. O'zbek, rus va ingliz tillarida."]},
     {h:'Texnik tomoni', p:["aiogram 3.x. Bilim bazasi — oddiy matnli hujjatlar; /knowledge buyrug'i bilan botni qayta ishga tushirmasdan yangilanadi. AI bilmagan savolni to'qib chiqarmaydi — «so'rab ko'raman» deb menga yo'naltiradi."]}
   ],
   results:["3 tilda AI FAQ","/knowledge bilan jonli yangilanadigan bilim bazasi"],
   links:[]},

  {slug:'jamolxon-uz', cat:'own', title:'jamolxon.uz', year:'2025',
   tagline:"Shu sayt: zarracha-avatar, skroll animatsiya, blog va taklif formasi",
   summary:"Hozir ko'rib turgan saytingiz. Three.js zarrachalardan yig'ilgan portret, GSAP skroll animatsiyalari, loyihalar katalogi, blog va taklif formasi — freymvorksiz, bitta fayl.",
   illo:'portfolio', image:null, stack:['Three.js','GSAP ScrollTrigger','Vanilla JS','SVG'],
   role:"To'liq",
   sections:[
     {h:'Nega bunday', p:["Portfolio sayt — dasturchining eng halol namunasi: u qanday ishlasa, mijozning loyihasi ham shunday ishlaydi. Shuning uchun u tez, aniq tuzilgan va biroz quvnoq bo'lishi kerak edi."]},
     {h:'Texnik tomoni', p:["Zarracha-avatar: Three.js Points + maxsus shader, sichqonchaga qaraydi, skrollda sochiladi. GSAP ScrollTrigger bilan bo'limlar animatsiyasi. Hash-router bilan ichki sahifalar (loyihalar, blog, taklif) — bitta HTML fayl, server kerak emas. prefers-reduced-motion hurmat qilinadi."]}
   ],
   results:["Bitta fayl, freymvorksiz","Zarracha-avatar + skroll animatsiya"],
   links:[]},

  /* ---------------- SALE ---------------- */
  {slug:'appleshop', cat:'sale', title:"Onlayn do'kon (AppleShop)", year:'2024',
   tagline:'Rang va xotira variantlari bilan e-commerce + admin panel',
   summary:"Texnika do'koni uchun tayyor onlayn do'kon: mahsulot variantlari (rang, xotira), savat, buyurtma va to'liq admin panel. Brendingizga moslab 1–2 haftada ishga tushadi.",
   illo:'shop', image:null, stack:['Django REST','Next.js','PostgreSQL'],
   role:"To'liq",
   sections:[
     {h:'Kimga', p:["Smartfon, noutbuk va aksessuar sotadigan do'konlar — mahsulotning rang va xotira kabi variantlari, har variantga alohida narx va qoldiq kerak bo'lgan joyda."]},
     {h:'Nima bor', p:["Katalog, filtrlar, variantli mahsulot kartasi, savat va buyurdma oqimi, admin panel: mahsulot, qoldiq, buyurtmalar, mijozlar. Backend — Django REST (API boshqa ilovalar uchun ham ochiq), frontend — Next.js."]},
     {h:'Moslashtirish', p:["Logotip, ranglar, to'lov tizimi (CLICK/Payme), yetkazib berish qoidalari — sozlanadi. Telegram'ga buyurtma bildirishnomasi qo'shiladi."]}
   ],
   results:["Variantli mahsulotlar (rang, xotira)","Admin panel","1–2 haftada brendga moslash"],
   links:[]},

  {slug:'fastfood-bot', cat:'sale', title:'Fastfood bot', year:'2024',
   tagline:'Telegram orqali fastfood buyurtma boti',
   summary:"Menyu, savat, manzil va to'lov — hammasi Telegram ichida. Buyurtma oshxonaga va kuryerga darhol tushadi. Kafe yoki yetkazib berish xizmati uchun tayyor.",
   illo:'chat', image:null, stack:['Telegram bot','Buyurtma oqimi','Admin'],
   role:"To'liq",
   sections:[
     {h:'Kimga', p:["Fastfood, kafe, yetkazib berish xizmati — mijozlari allaqachon Telegram'da bo'lgan har qanday biznes. Ilova yuklatishning hojati yo'q."]},
     {h:'Nima bor', p:["Rasmli menyu, savat, manzilni lokatsiya bilan yuborish, buyurtmani tasdiqlash, operator uchun boshqaruv: buyurtmalar ro'yxati, holatlar, menyuni tahrirlash. Istasangiz to'lov tizimi va AI yordamchi (menyu bo'yicha savollarga javob) qo'shiladi."]}
   ],
   results:["Menyu → savat → buyurtma: Telegram ichida","Operator paneli"],
   links:[]},

  {slug:'everest-mock', cat:'sale', title:'IELTS mock platforma (Everest Mock)', year:'2025',
   tagline:'Mock imtihon va AI Writing baholash',
   summary:"O'quv markazi uchun IELTS mock imtihon platformasi: Reading, Listening, Writing. Yozma ishni AI band shkalasi bo'yicha baholaydi, o'qituvchi tasdiqlaydi.",
   illo:'exam', image:null, stack:['React','FastAPI','MongoDB','AWS Lightsail','Nginx','Cloudflare'],
   role:"To'liq: backend, frontend, AI",
   sections:[
     {h:'Kimga', p:["IELTS'ga tayyorlaydigan o'quv markazlari — mock imtihonni qog'ozda emas, onlayn o'tkazish va natijani darhol ko'rish uchun."]},
     {h:'Nima bor', p:["Reading va Listening avtomatik tekshiriladi. Writing'ni AI IELTS band shkalasi bo'yicha strukturalangan baholaydi: Task Achievement, Coherence, Lexical Resource, Grammar — har biriga izoh bilan. O'qituvchi bahoni tasdiqlaydi yoki o'zgartiradi — oxirgi so'z odamda."]},
     {h:'Texnik tomoni', p:["React + FastAPI + MongoDB; AWS Lightsail, Nginx, Cloudflare SSL. O'quv markazining brendi va domeni bilan ishga tushadi."]}
   ],
   results:["AI Writing baholash — band shkalasi bo'yicha","O'qituvchi tasdiqlash oqimi","O'z domeningizda"],
   links:[]}
];

/* ---------------- AI YECHIMLAR (taklif) ---------------- */
const OFFERS = [
  {key:'aloqa', title:'Mijozlar bilan aloqa', icon:'chat',
   problem:"Telegram, Instagram va WhatsApp'dagi xabarlarga kech javob beriladi; kechqurun kelgan lidlar yo'qoladi.",
   solution:"AI avto-javob: biznes ma'lumotlari asosida 24/7 javob beradi, narx va manzilni aytadi, norozi mijozni odamga uzatadi.",
   example:[['SocialAuto','socialauto']]},
  {key:'smm', title:'Instagram va SMM', icon:'ig',
   problem:"«Narxi?» degan yuzlab izohga qo'lda javob berib ulgurilmaydi.",
   solution:"Comment-to-DM: izohga avtomatik javob + Direct'da havola; lead assistant ism va telefonni yig'ib CRM'ga uzatadi.",
   example:[['SocialAuto','socialauto']]},
  {key:'talim', title:"Ta'lim", icon:'edu',
   problem:"Yozma ishlarni tekshirish sekin va qimmat; o'quvchi savoliga darhol javob yo'q.",
   solution:"AI baholash (IELTS band shkalasi), AI suhbatdosh, materialdan test yaratish; o'qituvchi tasdiqlaydi.",
   example:[['Vocably','vocably'],['Everest Mock','everest-mock']]},
  {key:'biznes', title:'CRM / ERP / analitika', icon:'erp',
   problem:"Savdo, moliya va mijozlar bazasi turli jadvallarda; rahbar rasmni ko'rmaydi.",
   solution:"Bitta tizim: savdo voronkasi, moliya, qo'ng'iroqlar nazorati, analitika; AI hisobot va eslatmalar.",
   example:[['Tizimly','tizimly'],['Chindan ERP','chindan-erp']]},
  {key:'bot', title:'Telegram botlar', icon:'bot',
   problem:"Buyurtma, so'rov va ma'lumot uchun odam qo'li bilan ishlash — sekin va xato.",
   solution:"Buyurtma botlari, to'lov (CLICK/Payme), AI yordamchi, admin panel — mijoz Telegram'dan chiqmaydi.",
   example:[['Fastfood bot','fastfood-bot'],['@vidyuklaydi_bot','vidyuklaydi-bot']]},
  {key:'kontent', title:'Kontent va marketing', icon:'content',
   problem:"Trend tahlili, kontent reja, senariy va tarjima — har kuni ko'p qo'l mehnati.",
   solution:"AI agentlar zanjiri: tadqiqot → reja → senariy → tarjima; odam faqat tasdiqlaydi.",
   example:[['Promtchi HQ','promtchi-hq']]}
];

/* ---------------- JARAYON ---------------- */
const STEPS = [
  {h:'Tahlil va TZ', d:"Biznes jarayonini o'rganaman, MVP chegarasini belgilayman.", get:'Texnik topshiriq, bosqichlar va muddatlar.'},
  {h:'Arxitektura va dizayn', d:"Ma'lumotlar modeli, integratsiyalar, xavfsizlik, interfeys maketi.", get:'Tasdiqlanadigan maket va arxitektura sxemasi.'},
  {h:'Bosqichma-bosqich ishlab chiqish', d:'Har bosqich oxirida ishlaydigan versiya va demo.', get:"Har 1–2 haftada ko'rinadigan natija."},
  {h:'Test va xavfsizlik', d:"Avtomatik testlar, hujumchi ko'zi bilan audit, yuklama sinovi.", get:'Topilgan va yopilgan muammolar hisoboti.'},
  {h:"Ishga tushirish va qo'llab-quvvatlash", d:"Deploy, monitoring, jamoani o'qitish.", get:'Ishlayotgan tizim, hujjatlar va kafolat davri.'}
];

/* ---------------- BLOG ---------------- */
const POSTS = [
  {slug:'ai-avval-backend', title:"Nega AI loyiha avval backend'dan boshlanadi", date:'2025-11-02', read:'4 daqiqa', tags:['AI','Backend','Arxitektura'],
   excerpt:"«AI qo'shib beramiz» deganda ko'pchilik modelni o'ylaydi. Aslida ishning 80 foizi — model atrofidagi oddiy, zerikarli va juda muhim narsalar.",
   body:`<p>Mijoz «bizga AI kerak» deydi. Men esa birinchi savolni beraman: ma'lumot qayerda? Javob ko'pincha — Excel, Telegram guruhi va bir necha odamning xotirasida. Shu yerda hamma narsa hal bo'ladi: AI ma'lumotsiz ishlamaydi, ma'lumot esa tartibsiz bo'lsa, AI tartibsizlikni tezlashtiradi, xolos.</p>
<h2>Avval ishonchli asos</h2>
<p>Har bir AI loyihamda tartib bir xil. Avval ma'lumotlar modeli: nima saqlanadi, kim ko'ra oladi, qaysi hodisa qachon yoziladi. Keyin fon vazifalari — AI'ga so'rov sekund emas, ba'zan o'n sekund oladi; foydalanuvchini kuttirmaslik uchun navbat kerak (men ARQ ishlataman). Keyin tenantlar izolyatsiyasi: bir mijozning ma'lumoti boshqasiga ko'rinmasligi har bir so'rovda tekshiriladi. Va testlar.</p>
<p>Shundan keyingina AI qatlami: qaysi model, qanday prompt, javob sifatini qanday o'lchaymiz.</p>
<h2>AI bilmasa — odamga</h2>
<p>Eng muhim dizayn qarori: AI ishonchsiz bo'lsa nima bo'ladi? Mening javobim — hech qachon to'qib chiqarmaydi, odamga uzatadi. SocialAuto'da bu operatorga o'tkazish, Vocably'da — AI natijalarini tekshirish navbati, Everest Mock'da — o'qituvchi tasdiqlaydi. Odam oxirgi so'zni aytadi, AI vaqtni tejaydi.</p>
<blockquote>AI — maqsad emas, vosita. Mahsulot ishonchli backend ustida turadi, AI unga aql qo'shadi.</blockquote>
<h2>Xarajat va sifat o'lchanadi</h2>
<p>Har bir AI so'rovi pul. Shuning uchun model tanlash bitta sozlama bo'lishi kerak (OpenRouter orqali almashtiraman), har bir javob loglanadi va kichik eval to'plam bilan sifat vaqti-vaqti bilan tekshiriladi. «Ishlayapti shekilli» — natija emas.</p>
<p>Agar sizda AI loyiha g'oyasi bo'lsa, birinchi suhbatda men ma'lumot va jarayon haqida so'rayman, model haqida emas. Endi nega ekanini bilasiz.</p>`},
  {slug:'comment-to-dm', title:"Instagram izohidan lidgacha: comment-to-DM qanday ishlaydi", date:'2025-10-19', read:'5 daqiqa', tags:['Instagram','Meta API','SocialAuto'],
   excerpt:"Post ostiga «narxi?» deb yozgan odam — issiq lid. Uni 30 soniya ichida Direct'ga olib o'tish mexanikasi va Meta API'ning qaltis joylari.",
   body:`<p>Instagram'da sotadigan biznes uchun eng qimmat izoh — «narxi?». Uni yozgan odam sotib olishga tayyor, lekin javobni 2 soatdan keyin olsa, raqobatchiga ketadi. SocialAuto aynan shu 2 soatni 30 soniyaga tushiradi.</p>
<h2>Oqim</h2>
<ol>
<li>Meta webhook izoh tushganini xabar qiladi.</li>
<li>Tizim izohni kalit so'zlar bilan solishtiradi («narx», «qancha», «manzil»).</li>
<li>Izohga ochiq javob yoziladi («Direct'ga yozdik ✓») va foydalanuvchiga xususiy xabar yuboriladi — narx, havola yoki forma.</li>
<li>Keyingi bosqichda lead assistant ism va telefonni so'raydi va CRM'ga (amoCRM, Bitrix24) yoki Telegram'ga uzatadi.</li>
</ol>
<h2>Qaltis joylar</h2>
<p><strong>Webhook imzosi.</strong> Meta har bir so'rovni X-Hub-Signature-256 bilan imzolaydi. Tekshirmasangiz, istalgan odam sizning tizimingizga «izoh» yuborishi mumkin.</p>
<p><strong>Takroriy hodisalar.</strong> Meta bir hodisani ikki marta yuborishi mumkin. Har bir hodisaning ID'si saqlanadi; takrori yutib yuboriladi — aks holda mijoz ikki marta DM oladi va bu spam.</p>
<p><strong>Vaqt chegarasi.</strong> Webhook'ga tez javob berish kerak. Shuning uchun FastAPI so'rovni darhol qabul qiladi, ishni ARQ navbatiga tashlaydi va 200 qaytaradi; javob yozish fonda bo'ladi.</p>
<p><strong>Limitlar.</strong> Instagram bir akkauntdan qisqa vaqtda ko'p DM yuborishni yoqtirmaydi. Redis'da rate limit — akkaunt bloklanmasligi uchun.</p>
<h2>Nega testlar</h2>
<p>SocialAuto backend'ida 68 ta unit test real PostgreSQL va Redis'da ishlaydi, qo'shimcha to'liq webhook oqimi sinovi bor. Meta API bilan ishlaganda «mahalliy muhitda ishladi» yetarli emas — hodisalar ketma-ketligi haqiqiy bazada tekshirilishi kerak.</p>
<p>Instagram orqali sotasizmi? Shu mexanikani sizning akkauntingizga ulab beraman — <a href="#taklif" class="link">taklif yozing</a>.</p>`},
  {slug:'ai-kod-xavfsizlik', title:"AI yozgan kodni xavfsiz ishga tushirish: 16 zaiflikdan olingan saboqlar", date:'2025-09-28', read:'6 daqiqa', tags:['Xavfsizlik','AI','Docker'],
   excerpt:"Foydalanuvchi so'z bilan tasvirlaydi, AI kod yozadi, platforma uni ishga tushiradi. Bu — eng xavfli ssenariy. Bir loyihamda bir necha audit davomida topilgan narsalar.",
   body:`<p>BotSmith loyihasida g'oya oddiy edi: foydalanuvchi Telegram botini so'z bilan tasvirlaydi, AI aiogram kodini yozadi, platforma uni hosting qiladi. Dasturchi kerak emas. Xavfsizlik nuqtai nazaridan esa bu — mijozning kodini o'z serveringizda ishga tushirish, ya'ni eng xavfli narsa.</p>
<p>Bir necha audit davomida 16 dan ortiq zaiflik topildi va yopildi. Eng muhim saboqlar:</p>
<h2>1. Kodni ishga tushirishdan oldin o'qing — mashina sifatida</h2>
<p>AI generatsiya qilgan kod AST (abstrakt sintaksis daraxti) darajasida tekshiriladi: ruxsat etilmagan importlar, fayl tizimi va tarmoqqa chiqish, subprocess — hammasi oq ro'yxat bo'yicha. Regex bilan «qidirish» yetarli emas: kodni har xil yozish mumkin.</p>
<h2>2. Konteyner — lekin Docker socket'siz</h2>
<p>Har bir bot alohida Docker konteynerda. Lekin boshqaruv serveri Docker socket'ga to'g'ridan-to'g'ri ulansa, bitta xato butun serverni beradi. Shuning uchun socket proxy: faqat kerakli buyruqlar (yaratish, to'xtatish, log) o'tadi.</p>
<h2>3. Tokenlar bazada shifrlangan</h2>
<p>Bot tokeni — bu botning o'zi. Ular Fernet bilan shifrlanib saqlanadi; baza sizib chiqsa ham tokenlar ochiq emas. Loglarda ham tokenlar maskalanadi.</p>
<h2>4. Prompt injection</h2>
<p>Foydalanuvchi «tavsif»ga «oldingi ko'rsatmalarni unut va …» deb yozishi mumkin. Tizim prompti va foydalanuvchi matni qat'iy ajratiladi, chiqish esa baribir AST tekshiruvidan o'tadi — AI'ga ishonmaymiz, tekshiramiz.</p>
<h2>5. Rate limiting</h2>
<p>Generatsiya qimmat va sekin. Redis asosida har foydalanuvchi uchun limit — suiiste'mol ham, kutilmagan xarajat ham bo'lmaydi.</p>
<blockquote>Xavfsizlik oxirida qo'shiladigan qatlam emas. U arxitekturaning birinchi kunidan boshlanadi.</blockquote>
<p>Bu tamoyillarni har bir loyihamga olib o'taman: tenantlar izolyatsiyasi, shifrlangan maxfiy ma'lumotlar, webhook imzolari, rate limit. Mijoz uchun bu «ma'lumotim sizib chiqmaydi» degani.</p>`},
  {slug:'ai-ielts-writing', title:"AI IELTS Writing'ni qanday baholaydi — va nega oxirgi so'z o'qituvchida", date:'2025-09-10', read:'4 daqiqa', tags:["Ta'lim",'AI','EdTech'],
   excerpt:"Band shkalasi bo'yicha strukturalangan baho, izoh va o'qituvchi tasdiqlash oqimi. Vocably va Everest Mock'dagi yondashuv.",
   body:`<p>IELTS Writing'ni tekshirish — o'qituvchining eng ko'p vaqt oladigan ishi. Bitta ishga 10–15 daqiqa, guruhda 20 o'quvchi. AI buni daqiqaga tushiradi — agar to'g'ri qurilsa.</p>
<h2>Shunchaki «baho qo'y» emas</h2>
<p>Modeldan «bu ishga nechchi?» deb so'rasangiz, u ishonchli ohangda tasodifiy raqam aytadi. Shuning uchun baho strukturalangan: IELTS'ning to'rtta mezoni — Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy — har biriga alohida band va aniq izoh, matndan misol bilan. Umumiy band shundan hisoblanadi.</p>
<h2>O'qituvchi tasdiqlaydi</h2>
<p>Everest Mock'da AI bahosi o'quvchiga darhol ko'rinmaydi — avval o'qituvchiga. U tasdiqlaydi yoki o'zgartiradi. Vocably'da esa AI natijalarini tekshirish navbati bor: admin har qanday javobni ko'rib, belgilab qo'yishi mumkin. Bu ikki narsa beradi: o'quvchi uchun ishonch va biz uchun sifat o'lchovi — AI qayerda adashayotganini ko'ramiz.</p>
<h2>Narx</h2>
<p>Har bir baholash — AI so'rovi. Model OpenRouter orqali tanlanadi: Writing uchun kuchliroq, oddiy savollar uchun arzonroq. O'quv markazi uchun bu bir o'quvchiga oyiga bir necha ming so'mdan oshmaydi.</p>
<p>O'quv markazingiz uchun shunday tizim kerakmi? <a href="#taklif" class="link">Yozing</a> — Everest Mock tayyor yechim sifatida sizning brendingiz bilan ishga tushadi.</p>`}
];

const FACTS = [
  {n:PROJECTS.length, suf:'', t:"ta loyiha — saytlar, botlar, CRM va SaaS"},
  {n:PROJECTS.filter(p=>p.cat==='prod').length, suf:'', t:"ta tizim hozir ishlab turibdi (Live)"},
  {n:PROJECTS.filter(p=>p.cat==='pm').length, suf:'', t:"ta yirik loyihani menejer sifatida boshqarganman"},
  {n:PROJECTS.filter(p=>p.cat==='sale').length, suf:'', t:"ta tayyor yechim — 1–2 haftada ishga tushadi"}
];

const CONTACT = {
  tg:'jamalxon', tgUrl:'https://t.me/jamalxon',
  gh:'github.com/jamalxan', ghUrl:'https://github.com/jamalxan',
  ig:'@jamalxann', igUrl:'https://instagram.com/jamalxann',
  mailParts:['jamolxonyoldashaliyev3','gmail.com'],
  telParts:['+998','93','160','67','06'],
  studio:'promtchi.uz', studioUrl:'https://promtchi.uz'
};

/* ---------------- XIZMATLAR — har biri alohida, o'z sahifasi bilan ---------------- */
const SERVICES = [
  {slug:'web-saytlar', title:'Web saytlar', icon:'site', illo:'site',
   short:"Korporativ sayt, landing, katalog, ko'p sahifali sayt — tez ochiladigan, qidiruvga tayyor, o'z serveringizda.",
   who:["Yangi biznes — birinchi sayt kerak","Eski sayti sekin yoki telefonda buzilib ko'rinadigan kompaniyalar","Mahsulot yoki xizmat uchun landing kerak bo'lganlar"],
   includes:["Tuzilma va matn rejasi (nima qaysi sahifada)","Dizayn: mobil va desktop uchun alohida kompozitsiya","Qurish: HTML/CSS/JS yoki Next.js — loyihaga qarab","SEO asoslari: title/description, schema.org, OG rasm, sitemap","Tezlik: mobil LCP 2.5 s dan kam, rasm optimizatsiyasi","Domen, SSL, deploy (AWS Lightsail / Vercel / Cloudflare) va monitoring","Aloqa formasi → Telegram'ga bildirishnoma"],
   process:["Suhbat: maqsad, auditoriya, raqobatchilar","Tuzilma va matn — tasdiqlaysiz","Dizayn maketi — tasdiqlaysiz","Qurish, test (telefon, planshet, desktop), deploy"],
   examples:['promtchi-uz','jamolxon-uz'], stack:['HTML/CSS/JS','Next.js','Tailwind','GSAP','AWS Lightsail','Vercel','Cloudflare'],
   timeline:"Landing — 1–2 hafta. Ko'p sahifali sayt — 3–5 hafta.",
   faq:[["Matnni kim yozadi?","Tuzilmani men beraman; matnni siz berasiz yoki birga yozamiz."],["Keyin o'zim tahrirlay olamanmi?","Ha — kontent qismi uchun oddiy admin yoki fayl orqali tahrirlash beriladi; qanday bo'lishini boshida kelishamiz."]]},

  {slug:'web-dizayn', title:'Web dizayn va aydentika', icon:'design', illo:'brand',
   short:"Interfeys maketi (UI/UX), landing dizayni, logotip va brend kitobi, taqdimot — kod yozishdan oldin ko'rib tasdiqlaysiz.",
   who:["Sayt yoki ilova qurishdan oldin maket kerak bo'lgan jamoalar","Logotipi faqat rastr yoki umuman yo'q bizneslar","Investor yoki mijoz uchun taqdimot kerak bo'lganlar"],
   includes:["UI/UX maketi: ekranlar, oqimlar, komponentlar","Landing va sayt dizayni — mobil birinchi","Logotip vektorda, ranglar, shriftlar, qo'llanish qoidalari","Brend kitobi va aydentika taqdimoti (HTML yoki PDF)","Ijtimoiy tarmoq va reklama uchun shablonlar","Dizaynni kodga o'tkazish — xohlasangiz, o'zim quraman"],
   process:["Brif: kim uchun, qanday his, 3 ta yoqqan misol","2–3 yo'nalish eskizi — birini tanlaysiz","Tanlangan yo'nalishni to'liq ishlab chiqish","Fayllar to'plami va qoidalar topshiriladi"],
   examples:['chindan-brending','promtchi-uz'], stack:['Figma','Vektor grafika','Canva','HTML taqdimot'],
   timeline:"Logotip va aydentika — 1–2 hafta. Sayt maketi — 1–3 hafta.",
   faq:[["Dizaynni boshqa dasturchi qursa bo'ladimi?","Ha — maket va fayllar standart formatda, istalgan jamoa ishlata oladi."]]},

  {slug:'telegram-botlar', title:'Telegram botlar va mini-ilovalar', icon:'bot', illo:'bot',
   short:"Buyurtma, so'rov, media, CV — mijoz Telegram'dan chiqmaydi. To'lov, obuna, admin panel va AI yordamchi bilan.",
   who:["Fastfood, do'kon, xizmat — buyurtmani Telegram'da qabul qilmoqchilar","Mijozlarga ma'lumot va so'rovnoma tarqatadigan bizneslar","Ichki jarayon (hisobot, eslatma, tasdiqlash) uchun bot kerak bo'lgan jamoalar"],
   includes:["Bot mantig'i: aiogram 3.x, holatlar, menyusiz UX","To'lovlar: CLICK / Payme, obuna billing","Mini-ilova (Telegram Web App) — kerak bo'lsa","Admin panel: buyurtmalar, foydalanuvchilar, xabar yuborish","2 GB gacha fayl (Local Bot API Server)","AI yordamchi: savollarga bilim bazasidan javob","Navbat (ARQ), monitoring, backup"],
   process:["Oqimni qog'ozda chizamiz: foydalanuvchi nima bosadi, nima oladi","Prototip — 2–3 kunda sinab ko'rasiz","To'liq qurish, to'lov va admin","Deploy, monitoring, qo'llab-quvvatlash"],
   examples:['vidyuklaydi-bot','fastfood-bot','portfolio-bot'], stack:['aiogram 3.x','ARQ','Redis','PostgreSQL','Telegram Payments','Local Bot API','Docker'],
   timeline:"Oddiy bot — 3–7 kun. Buyurtma + to'lov + admin — 2–3 hafta.",
   faq:[["Botni keyin o'zim boshqaraymanmi?","Ha — admin panel orqali menyu, matn va foydalanuvchilarni o'zingiz boshqarasiz."]]},

  {slug:'crm-erp', title:'CRM va ERP tizimlar', icon:'erp', illo:'dashboard',
   short:"Savdo, moliya, mijozlar bazasi, buyurtma pipeline, rollar va hisobotlar — bitta tizimda. Multi-tenant SaaS sifatida ham.",
   who:["Excel va Telegram guruhlaridan o'sib ketgan kompaniyalar","Bir nechta filial yoki jamoa — rollar va ruxsatlar kerak","O'z SaaS mahsulotini qurmoqchi bo'lgan startaplar"],
   includes:["Jarayon xaritasi va ma'lumotlar modeli","Modullar: savdo voronkasi, moliya, mijozlar, buyurtmalar, ombor","Rollar va ruxsatlar, audit log","Dashboard va hisobotlar; Telegram eslatmalar","Multi-tenant arxitektura (har mijoz alohida izolyatsiyada)","Integratsiyalar: amoCRM/Bitrix24 import, to'lov, Face ID qurilmalari","Testlar, migratsiyalar, Docker deploy"],
   process:["Jarayonlarni o'rganish — kim nima qiladi, qayerda vaqt ketadi","Ma'lumotlar modeli va maket — tasdiqlaysiz","Modul-modul topshirish: har 1–2 haftada ishlaydigan qism","Jamoani o'qitish, ishga tushirish, qo'llab-quvvatlash"],
   examples:['tizimly','chindan-erp'], stack:['FastAPI','PostgreSQL','Redis','ARQ','Next.js','Docker','Prisma'],
   timeline:"MVP (2–3 modul) — 4–6 hafta. To'liq tizim — bosqichma-bosqich, 2–4 oy.",
   faq:[["Tayyor CRM'dan nima farqi?","Tayyor CRM sizni o'z jarayoniga moslaydi; bu tizim sizning jarayoningizga quriladi va faqat kerakli narsani o'z ichiga oladi."]]},

  {slug:'integratsiyalar', title:'Integratsiyalar va API', icon:'link', illo:'ai',
   short:"Instagram/Meta webhook'lari, amoCRM va Bitrix24, CLICK/Payme, Telegram, qurilmalar — tizimlaringiz bir-biri bilan gaplashadi.",
   who:["Ma'lumot bir tizimdan ikkinchisiga qo'lda ko'chiriladigan kompaniyalar","Instagram/WhatsApp'dan kelgan lidni CRM'ga avtomatik tushirmoqchilar","Mavjud tizimga to'lov yoki bildirishnoma ulamoqchilar"],
   includes:["Meta: Instagram Graph API, WhatsApp va Facebook webhook'lari (imzo tekshiruvi bilan)","CRM: amoCRM, Bitrix24 — lid, bitim, vazifa","To'lov: CLICK, Payme, Telegram Payments","Telegram bildirishnomalar va botlar","Qurilmalar: Face ID / davomat, webhook hodisalari","O'z REST API'ngiz: hujjat, versiya, rate limit","Takroriy hodisalardan himoya, navbat, loglar"],
   process:["Qaysi tizim qaysi ma'lumotni qachon berishi — sxema","Test muhitda ulash va sinov","Production, monitoring, xatolik bo'lsa ogohlantirish"],
   examples:['socialauto','tizimly'], stack:['FastAPI','Webhooks','OAuth','ARQ','Redis','Cloudflare Tunnel'],
   timeline:"Bitta integratsiya — 3–10 kun. Bir nechta tizimni bog'lash — 2–4 hafta.",
   faq:[["Meta App Review kerakmi?","Instagram DM uchun — ha; jarayonni men olib boraman, siz faqat biznes hujjatlarini berasiz."]]},

  {slug:'ai-agentlar', title:'AI agentlar va integratsiya', icon:'ai', illo:'office',
   short:"Avto-javob, AI baholash, bilim bazasidan javob (RAG), agentlar zanjiri — sifat o'lchanadi, xarajat nazoratda, odam oxirgi so'zni aytadi.",
   who:["Ko'p murojaat oladigan bizneslar — 24/7 javob kerak","Ta'lim va kontent — baholash, tekshirish, material yaratish","Takrorlanadigan aqliy ish (tahlil, xulosa, tarjima) bor jamoalar"],
   includes:["AI avto-javob: Telegram / Instagram / WhatsApp, biznes ma'lumoti asosida","Bilim bazasidan javob (RAG): hujjatlar, FAQ, narxlar","AI baholash va tekshirish — strukturalangan natija, odam tasdiqlaydi","Agentlar zanjiri: tadqiqot → reja → matn → tarjima","Eval: javob sifatini o'lchash to'plami","Xarajat nazorati va model almashtirish (Claude, Gemini, OpenRouter, lokal)","Prompt injection himoyasi, loglarda maxfiylik"],
   process:["Qaysi vazifa AI'ga, qaysi odamga — chegarani chizamiz","Prototip real ma'lumotingizda — sifatni ko'rasiz","Backend'ga ulash, eval va nazorat paneli","Ishga tushirish, sifatni muntazam o'lchash"],
   examples:['vocably','everest-mock','promtchi-hq','portfolio-bot'], stack:['Anthropic Claude','Google Gemini','OpenRouter','AWS Bedrock','LM Studio','FastAPI','pgvector'],
   timeline:"Prototip — 1 hafta. Ishlaydigan AI qatlam — 2–4 hafta.",
   faq:[["AI xato qilsa nima bo'ladi?","Ishonchsiz holatda to'qib chiqarmaydi — odamga uzatadi. Har javob loglanadi, sifat eval bilan o'lchanadi."]]}
];
