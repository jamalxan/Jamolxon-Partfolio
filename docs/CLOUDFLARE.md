# DNS'ni Cloudflare'ga ko'chirish (jamolxon.uz)

Hozir NS: `rdns1/2/3.ahost.uz`; A yozuvlar (`@`, `admin`, `staging`, `admin.staging`) → 20.219.147.37 (2026-11-07). Pochta ahost'da qoladi (mail.jamolxon.uz → 185.196.212.52), shuning uchun pochta yozuvlari **DNS only** (kulrang bulut) bo'lishi shart.

## 1. Cloudflare'da zona qo'shish
dash.cloudflare.com → Add a site → `jamolxon.uz` → Free. Avtomatik skanerlangan yozuvlarni quyidagi jadval bilan solishtiring, ortiqchasini o'chiring.

| Turi | Nom | Qiymat | Proxy |
|---|---|---|---|
| A | `@` | 20.219.147.37 | Proxied (to'q sariq) |
| CNAME | `www` | jamolxon.uz | Proxied |
| CNAME | `admin` | jamolxon.uz | Proxied |
| CNAME | `staging` | jamolxon.uz | Proxied |
| CNAME | `admin.staging` | jamolxon.uz | Proxied |
| A | `mail` | 185.196.212.52 | **DNS only** |
| MX | `@` | mail.jamolxon.uz (priority 0) | — |
| TXT | `@` | `v=spf1 +mx +ip4:185.196.212.52 ~all` | — |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<sizning email>` | — |
| TXT | `<selector>._domainkey` | ahost panelidagi DKIM kaliti | — |

DKIM: ahost panel → Pochta → DKIM'ni yoqing va u bergan TXT'ni shu yerga ko'chiring. Bir-ikki hafta `p=none` bilan kuzatib, keyin `p=quarantine` qiling.
SMTP boshqa provayderdan (masalan Resend/Brevo) bo'lsa, ularning SPF `include:` va DKIM yozuvlarini ham qo'shing.

## 2. NS'ni almashtirish
Cloudflare bergan ikki NS'ni (`xxx.ns.cloudflare.com`) ahost → Domenlar → jamolxon.uz → NS serverlar bo'limiga yozing. Tarqalishi 1–24 soat. Shu vaqt ichida sayt ishlayveradi (A yozuv bir xil).

## 3. Cloudflare sozlamalari
- SSL/TLS → **Full (strict)** (Caddy serverda haqiqiy sertifikat oladi).
- SSL/TLS → Edge → Always Use HTTPS: on; Minimum TLS 1.2; HSTS'ni yoqmang (nginx o'zi yuboradi).
- Caching → Cache Rules: `admin.*` va `/api/*` uchun **Bypass**. Qolganini nginx sarlavhalari boshqaradi.
- Security → WAF → Rate limiting: `/api/v1/leads` POST, 10/daqiqa/IP (ilovadagi limitga qo'shimcha).
- Turnstile → Add site → `jamolxon.uz`, `staging.jamolxon.uz` → site key va secret'ni `/opt/jamolxon/<env>/.env` ga (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`).
- API token (cache purge uchun): My Profile → API Tokens → Custom: Zone.Cache Purge, faqat jamolxon.uz → `CF_API_TOKEN`, `CF_ZONE_ID`.
- R2 (media + zaxira): R2 → bucket `jamolxon-media` va `jamolxon-backup` → S3 API token → `S3_*` va `BACKUP_S3_*`.

## 4. Caddy va Cloudflare
Proxied rejimda Caddy sertifikatni HTTP-01 orqali ham oladi (Cloudflare `/.well-known/acme-challenge` ni o'tkazadi). nginx haqiqiy IP'ni `CF-Connecting-IP` dan oladi (`infra/nginx/conf.d/cloudflare-ips.inc`).

## Tekshirish
```bash
nslookup -type=NS jamolxon.uz 1.1.1.1
curl -sI https://jamolxon.uz | grep -i "cf-ray\|strict-transport"
nslookup -type=MX jamolxon.uz 1.1.1.1
```
