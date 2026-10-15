# Project Specification: "Gaji Survival" - Salary Burn Rate & Survival Visualizer

Dokumen ini mengandungi spesifikasi penuh, formula matematik, arkitektur UI, dan Master Prompt bersedia untuk digunakan bersama OpenAI Codex, Cursor, Claude Code, atau GitHub Copilot.

---

## 1. Konsep Projek & Objektif

* **Nama Projek:** Gaji Survival: The Financial Health-Bar Simulator
* **Konsep:** Sebuah web app interaktif bergaya cyberpunk/gamified dashboard yang mengira jangka hayat kewangan seseorang sehingga hari gaji seterusnya. Ia memaparkan kadar "duit terbakar" (burn rate) per jam/hari, jangkaan tarikh bankrap (D-Day), HP bar ala RPG, dan simulasi penjimatan ("What-If Mode").
* **Target Build:** Boleh dibina sebagai single-file (`index.html`) menggunakan Tailwind CSS dan CDN libraries untuk kemudahan testing terus dalam browser.

---

## 2. Ciri-Ciri Utama (Core Features)

### A. Input Data Pengguna (Drawer / Modal / Sidebar)
* **Gaji Bersih Bulanan (RM):** Input angka.
* **Tarikh Masuk Gaji:** Hari dalam bulan (cth: 25hb).
* **Komitmen Tetap (Fixed Bills):**
  * Sewa / Ansuran Rumah
  * Pinjaman Kereta / Motor
  * Bil Utiliti & Wifi
  * Hutang / Kad Kredit / Komitmen Lain
* **Perbelanjaan Harian Boleh Ubah (Variable Daily):**
  * Bajet Makan Harian
  * Kopi Hipster / Minuman Mewah
  * Rokok / Vape / Hiburan
  * Belanja Runcit / Misc harian

### B. The Survival HUD (Main Dashboard)
1. **RPG Health Bar (Gaji HP):**
   * 100% - 75%: Hijau Bersinar (Status: "Sultan Awal Bulan 👑")
   * 74% - 40%: Kuning Amaran (Status: "Rakyat Biasa Berhati-Hati 🛡️")
   * 39% - 15%: Oren Bahaya (Status: "Zon Catuan Makanan ⚠️")
   * 14% - 1%: Merah Kritikal (Status: "Mod Maggi Aktif 🍜")
   * 0%: Tengkorak / Dead (Status: "Tinggal Doa & Harapan 💀")
2. **Burn Rate Metrics:**
   * Duit terbakar per hari (RM/hari).
   * Duit terbakar per jam (RM/jam) – ada counter real-time berdetik.
3. **Countdown to Bankruptcy (D-Day):**
   * Tarikh & jam tepat bila duit akan mencecah RM0.00 berdasarkan tabiat berbelanja.
   * Jumlah hari bertahan vs baki hari sebelum gaji seterusnya masuk.
4. **Interactive Burn-Down Chart:**
   * Graf garis (Line chart) menunjukkan unjuran baki wang dari Hari 1 hingga Hari 30.
   * Ada garisan merah "Dead Line" (RM0) dan garisan hijau "Gaji Seterusnya".

### C. "Penyelamat Terakhir" (What-If Interactive Toggles)
* Toggle interaktif untuk melihat kesan serta-merta pada D-Day:
  * "Potong Kopi RM15 sehari" $\rightarrow$ *+4 Hari Bertahan*
  * "Masak sendiri vs Makan luar" $\rightarrow$ *+6 Hari Bertahan*
  * "Henti merokok/vape" $\rightarrow$ *+3 Hari Bertahan*

### D. Export / Shareable Card
* Butang untuk menghasilkan kad ringkasan bergaya tiket retro/resit untuk dikongsi ke media sosial (Status: "Duit aku bertahan sampai 12 haribulan sahaja").

---

## 3. Logik Matematik & Formula

1. **Baki Wang Boleh Belanja (Disposable Income):**
   $$\text{Disposable Income} = \text{Gaji Bersih} - \sum(\text{Komitmen Tetap})$$

2. **Kadar Belanja Harian (Daily Burn Rate):**
   $$\text{Daily Burn} = \sum(\text{Perbelanjaan Harian})$$

3. **Jangka Hayat Gaji (Survival Days):**
   $$\text{Survival Days} = \frac{\text{Disposable Income}}{\text{Daily Burn}}$$

4. **Kadar Terbakar Per Jam (Hourly Burn Rate):**
   $$\text{Hourly Burn} = \frac{\text{Daily Burn}}{24}$$

5. **D-Day (Tarikh Kehabisan Wang):**
   $$\text{D-Day} = \text{Tarikh Gaji} + \text{Survival Days (dalam hari)}$$

6. **Defisit / Surplus:**
   $$\text{Gap to Next Payday} = \text{Baki Hari Ke Gaji Seterusnya} - \text{Survival Days}$$

---

## 4. Cadangan Stack Ringkas (Single-File Architecture)

* **Markup & UI:** HTML5 + Tailwind CSS (via Tailwind CDN)
* **Icons:** Lucide Icons (via unpkg CDN)
* **Graf:** Chart.js (via CDN)
* **Visual Effects:** Canvas Confetti (untuk kemenangan bila surplus) / CSS Keyframe shake & flame (bila kritikal)
* **Penyimpanan:** `localStorage` (simpan input supaya tak hilang bila refresh)

---

## 5. Master Prompt untuk Dimasukkan ke Codex

Salin (copy) prompt di bawah ini sepenuhnya dan masukkan ke dalam Codex / AI editor kamu:

```text
Act as an expert full-stack developer and creative UI/UX designer. Build a complete, functional, single-file interactive web application called "Gaji Survival - Salary Burn Rate & Survival Visualizer".

REQUIREMENTS:
1. File Structure: Single self-contained `index.html` file containing HTML, inline Tailwind CSS (via CDN), and vanilla JavaScript.
2. Styling & Theme: Dark mode gamified cyberpunk/retro dashboard theme (slate-900 background, neon accents: emerald-400 for safe, amber-400 for warning, rose-500 for critical).
3. Libraries to load via CDN:
   - Tailwind CSS: https://cdn.tailwindcss.com
   - Chart.js: https://cdn.jsdelivr.net/npm/chart.js
   - Lucide Icons: https://unpkg.com/lucide@latest

FEATURES TO IMPLEMENT:
1. INPUT SECTION (Interactive Form with live calculation):
   - Monthly Net Salary (RM)
   - Payday of the month (default: 25)
   - Fixed Commitments (Rent/Mortgage, Vehicle Loan, Utilities, Savings/Debt)
   - Variable Daily Expenses (Meals, Specialty Coffee/Boba, Cigarettes/Vape, Misc)
   - Auto-save all inputs into localStorage so data persists on reload.

2. DASHBOARD HUD:
   - RPG Health Bar: Animated gradient progress bar showing % of salary survived, transitioning from emerald green to amber to bloody red.
   - Sarcastic Title/Badge that changes dynamically based on survival rate (e.g., "Sultan Minggu Pertama 👑", "Zon Catuan Makanan 🛡️", "Kecemasan Maggi Segera 🍜", "Tinggal Doa & Harapan 💀").
   - Live Burn Rate Ticker: Shows money burning in RM per day, RM per hour, and RM per minute (with an animated ticker effect).
   - "D-Day to Bankrupt": Exact predicted date and time when balance drops to RM0.00.
   - Payday Countdown: Days remaining until the next payday vs. survival days remaining.

3. INTERACTIVE CHART:
   - A Chart.js line chart showing balance trajectory over 30 days.
   - Highlight the zero-balance intersection and next payday with clear visual markers.

4. "WHAT-IF" SURVIVAL SAVIOUR TOGGLES:
   - Toggles to simulate cutting down expenses (e.g., "Skip Hipster Coffee (+RM15/day)", "Cook at Home (+RM20/day)", "Pause Subscriptions (+RM50/month)").
   - Instantly recalculates the D-Day and updates the chart in real-time.

5. POLISH & MICRO-INTERACTIONS:
   - Smooth numeric transitions/counters when values change.
   - Alert notification banners if the user goes into negative territory before payday.
   - Clean, responsive mobile-friendly layout (looks great on phone screens and desktop).

Please write the entire clean, bug-free, fully implemented HTML file with no placeholders or missing functions.
```

---

## 6. Cadangan Ujian & Iterasi (Testing Roadmap)

Selepas Codex menjana kod pertama:
1. **Test Edge Cases:**
   * Masukkan belanja harian yang lebih besar daripada gaji (adakah ia handle nilai negatif tanpa crash?).
   * Masukkan belanja RM0 (pastikan tiada ralat *Division by Zero*).
2. **Audio/VFX Add-on (Pilihan Lanjutan):**
   * Minta Codex tambah sound effect 8-bit bila menukar toggle atau bila HP bar turun ke zon merah.
3. **Resit generator:**
   * Minta Codex tambah fungsi `html2canvas` untuk download ringkasan kewangan dalam bentuk imej resit mini 80mm.