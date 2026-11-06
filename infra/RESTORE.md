# Zaxiradan tiklash (RESTORE)

Maqsad: RPO ≤ 24 soat, RTO ≤ 1 soat (TZ 11).

## Zaxiralar qayerda
- Serverda: `/var/backups/jamolxon/<production|staging>/{daily,weekly,monthly}/*.dump.age` (7 kunlik / 4 haftalik / 6 oylik).
- Tashqarida: R2 bucket `$BACKUP_S3_BUCKET/<env>/` (agar `BACKUP_S3_*` sozlangan bo'lsa).
- Fayllar `age` bilan shifrlangan. **Maxfiy kalit serverda saqlanmaydi**, u parol menejerida turadi ("jamolxon backup age key").

## 1. Faylni tanlash
```bash
ls -1t /var/backups/jamolxon/production/daily | head
# yoki R2'dan:
docker run --rm -v /tmp/r:/r -e AWS_ACCESS_KEY_ID=... -e AWS_SECRET_ACCESS_KEY=... amazon/aws-cli \
  s3 cp s3://$BACKUP_S3_BUCKET/production/daily/<fayl> /r/ --endpoint-url $BACKUP_S3_ENDPOINT
```

## 2. Kalitni vaqtincha qo'yish
```bash
install -m 600 /dev/null /root/age-key.txt && nano /root/age-key.txt   # parol menejeridan nusxa
```

## 3. Tiklash
Avval joriy holatdan zaxira oling (xato tiklashga qarshi):
```bash
BACKUP_REASON=pre-restore /opt/jamolxon/src/infra/scripts/backup.sh production
docker compose -p jamolxon stop api worker          # yozuvlarni to'xtatish
AGE_IDENTITY=/root/age-key.txt /opt/jamolxon/src/infra/scripts/restore.sh production /var/backups/jamolxon/production/daily/<fayl>
docker compose -p jamolxon start api worker
curl -fsS https://jamolxon.uz/api/v1/ready
```
Saytni qayta yig'ish: admin panel → Tizim → "Saytni qayta yig'ish" (yoki `POST /api/v1/admin/site/rebuild`).

## 4. Tozalash
```bash
shred -u /root/age-key.txt
```
Natijani `infra/RESTORE_LOG.md` ga yozing (sana, fayl, vaqt, tekshiruv natijasi).

## Mashq
Har chorakda staging'ga tiklash mashqi: `restore.sh staging <production zaxirasi>`, so'ng `/api/v1/ready` va admin'da loyihalar soni tekshiriladi.
