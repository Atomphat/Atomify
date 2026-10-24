# Atomify · HI! I'M ATOM

เว็บแนะนำตัว Phatthana Pomthong (Atom) สไตล์เดียวกับเว็บตัวอย่าง OATOH!:
พื้นครีมโอ๊ต สีส้มเป็นสีเดียวที่ตะโกน ตัวหนังสือยักษ์ (Bowlby One) บินเข้ามาตอนเลื่อน
รูปอยู่ในแคปซูล สติกเกอร์ขอบดำ และเกมลากของลงกล่อง มี 3 ภาษา ไทย / EN / 中文

เวอร์ชันเก่า: ธีม Spotify อยู่ใน `_spotify-v1/` และแบบคลิปอธิบาย Vox อยู่ใน `_vox-v2.html`

## โครงสร้าง

```
index.html                 ← ทั้งเว็บอยู่ในไฟล์เดียว (HTML + CSS + JS, GSAP จาก cdnjs)
images/profile-capsule.jpg ← รูปในแคปซูลหน้าแรก (ครอป 9:16 จาก profile.jpg)
images/atom-halftone.png   ← สติกเกอร์ตัว Atom ท้ายหน้า
images/work/               ← ภาพหน้าจอผลงาน
tools/record-reel.mjs      ← render วิดีโอ show reel ทีละเฟรม (1920×1080)
tools/frames2mp4.swift     ← รวมเฟรมเป็น MP4
tools/halftone.swift       ← ตัดพื้นหลังด้วย Vision แล้วทำเป็นภาพ halftone
showreel/                  ← วิดีโอ show reel (ไม่เข้า git เพราะไฟล์ใหญ่)
```

## แก้เนื้อหา

- ผลงาน: อาร์เรย์ `WORKS` (ภาพอยู่ใน `images/work/`)
- ของในเกมจัดเว็บ: `FEATS` · เครื่องมือ: `KITS` · ข้อความทุกภาษา: `T`
- `?reel` ให้ recorder คุมเวลา gsap เองทีละเฟรม และเกมจะเล่นเองในวิดีโอ

## ทำวิดีโอ show reel ใหม่

```
node tools/record-reel.mjs <path ของ puppeteer-core.js> /tmp/reel-frames
swift tools/frames2mp4.swift /tmp/reel-frames showreel/atomify-showreel-1920x1080.mp4 30
```
