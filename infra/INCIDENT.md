# Hodisalar bo'yicha qo'llanma (INCIDENT)

Server: 20.219.147.37 (Azure `test-server`), unda **vocably.uz** ham ishlaydi. Faqat `jamolxon*` compose loyihalariga tegiladi. Caddy (`jamolxon-caddy`) vocably'ning `media`/`ws` domenlarini ham beradi (`/opt/jamolxon/edge/vocably.caddy`): **restart qilmang**, faqat `caddy validate` + `caddy reload`, va `import /etc/caddy/vocably.caddy` qatorini o'chirmang.

Sayt tashqaridan ochilmasa-yu, server ichida `curl -I http://127.0.0.1 -H 'Host: jamolxon.uz'` 308 qaytarsa: Azure NSG'da 80/443 inbound qoidasini tekshiring.

## Tez diagnostika
```bash
docker compose -p jamolxon ps
docker compose -p jamolxon logs --since 15m api worker nginx | tail -200
curl -fsS https://jamolxon.uz/api/v1/health; curl -fsS https://jamolxon.uz/api/v1/ready
```

| Belgi | Ehtimoliy sabab | Harakat |
|---|---|---|
| Sayt 502 | nginx yoki Caddy'dan `jamolxon-nginx` ko'rinmaydi | `docker compose -p jamolxon up -d nginx`; Caddy tarmog'ini tekshiring (`jamolxon_edge`) |
| Sayt ochiladi, forma xato | api yoki postgres yiqilgan | `logs api`, `/api/v1/ready` |
| Lidlar keladi, Telegram'ga xabar yo'q | bot token / chat id, worker | admin → Tizim → navbat; `logs worker`; lid bazada saqlanadi, yo'qolmaydi |
| Sayt eski kontentni ko'rsatadi | rebuild ishlamadi yoki CDN keshi | admin'da qayta yig'ish; Cloudflare'da purge |
| Admin'ga kira olmayman | 2FA qurilmasi yo'q | zaxira kodlardan biri; bo'lmasa `docker compose -p jamolxon exec api python -m scripts.create_owner --email ... --reset-2fa` |
| Kimdir hisobga kirgan | sessiya o'g'irlangan | parolni o'zgartiring (barcha sessiyalar bekor qilinadi), audit jurnalini ko'ring, `JWT_KEY` ni almashtirib qayta deploy |

## Deploy'ni orqaga qaytarish
Deploy skripti health/smoke xato bo'lsa o'zi qaytaradi. Qo'lda:
```bash
grep '=== ' /var/log/jamolxon/deploy-production.log | tail   # oldingi SHA'lar
sudo /usr/local/bin/jamolxon-deploy production <oldingi_40_belgili_sha>   # SHA'da v* teg bo'lishi kerak
```
Migratsiyalar orqaga mos yoziladi, shuning uchun eski kod yangi sxemada ishlaydi. Ma'lumot buzilgan bo'lsa: `RESTORE.md`.

## Maxfiy kalit sizib chiqsa
1. Kalitni manbada bekor qiling (Telegram BotFather `/revoke`, Cloudflare token, R2 kalit, SMTP parol).
2. `/opt/jamolxon/production/.env` da yangilang (`chmod 600`), `sudo /usr/local/bin/jamolxon-deploy production <joriy_40_belgili_sha>`.
3. `SECRET_KEY`/`JWT_KEY` almashtirilsa barcha sessiyalar tugaydi; `ENCRYPTION_KEY` almashtirilmaydi (TOTP sirlarini o'qib bo'lmay qoladi), avval 2FA'ni qayta sozlang.
4. Git tarixida bo'lsa: kalit baribir bekor qilingan, tarixni qayta yozish shart emas.

## Hodisadan keyin
Qisqa yozuv: nima bo'ldi, qachon sezildi, ta'sir, sabab, nima o'zgartirildi. Shu faylning oxiriga qo'shing.
