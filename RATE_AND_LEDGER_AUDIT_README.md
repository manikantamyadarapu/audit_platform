# Rate and Ledger Audit — Business User Guide

**Where to find it:** Scrutiny → **Rate and Ledger Audit**

This guide explains every product, every rate source, and every validation rule used in the audit. It is written for **auditors, managers, and finance teams** — no technical background required.

---

## What this audit does

When you upload a sales Excel file, the system checks **every transaction row** for:

1. **Ledger correctness** — Is the product booked under the correct sales account?
2. **Rate correctness** — Is the unit rate within the allowed range for that product?
3. **Unit of measurement (UOM)** — Is Grams/Carats correct for the product type?
4. **Accessory rules** — Are small items (Lac, Dori, Black beads, etc.) entered with a fractional rate (0 to 1)?

All checks run together in one upload. Rows that fail any check appear in the **Error rows** report.

---

## Rate source types (explained)

Every product uses one of the following rate sources:

| Rate Source | Plain-English meaning | Who controls it |
|-------------|----------------------|-----------------|
| **Rule Book Input** | Your team enters the current market rate in **Scrutiny → Rate Rule Book** | User (updated when gold/silver market moves) |
| **User Entered** | Same as Rule Book Input — the rate is typed in by your team, not fixed by the system | User |
| **Hardcoded** | Fixed standard rates built into the system (all diamond products) | System administrator (requires IT to change) |
| **Extracted from Product Name** | The **last number in the product name** is treated as the standard rate (gemstones & pearls) | Product naming convention |
| **Master File Based** | Product must appear on the **official Sales Ledger Verification list** under the correct account | Master catalog (maintained by audit/accounts team) |
| **Mapping Only** | Only the sales account is checked; **no rate validation** is applied | — |

---

## Sales accounts covered (11 accounts)

Every product in your file must belong to one of these sales accounts:

| # | Sales Account | Product families allowed |
|---|---------------|--------------------------|
| 1 | Gold Sales Account - 14K | Gold Ornaments 14K |
| 2 | Gold Sales Account - 18K | Gold Ornaments 18K, Customer Gold Ornaments 18K |
| 3 | Gold Sales Account - 22K | Gold Ornaments 22K, Customer Gold Ornaments 22K, Black beads, Dori, Lac, Wax Dori Etc |
| 4 | Gold Sales Account - Jadau | Gold Ornaments Jadau |
| 5 | Gold Sales Account - 24K | Standard Gold 24K |
| 6 | Silver Sales Account | Silver articles |
| 7 | Jewel Sales Account - Diamonds | All diamond products (Di. RA, Di. RC, Chakri, Flat Polki, etc.) |
| 8 | Jewels Sales Account - Color Stones | Precious stones, Semi precious, Synthetic, Customer Stones |
| 9 | Jewels Sales Account - Emeralds | Emeralds JEM products, Customer Emeralds |
| 10 | Jewels Sales Account - Pearls | Pearls JPS products, Customer Pearls |
| 11 | Jewels Sales Account - Rubies | Rubies JRU products, Customer Rubies |

---

## Allowed range formulas

### Formula A — Gold & Silver (Rule Book Input)

Used for: Gold Ornaments, Customer Gold, Standard Gold 24K, Silver articles

```
Minimum Allowed Rate = Rule Book Minimum Rate × 85%
Maximum Allowed Rate = Rule Book Maximum Rate × 115%
```

**Example — Gold Ornaments 22K**

| Item | Value |
|------|-------|
| Rule Book Minimum Rate | ₹14,500 |
| Rule Book Maximum Rate | ₹15,000 |
| Minimum Allowed | ₹14,500 × 85% = **₹12,325** |
| Maximum Allowed | ₹15,000 × 115% = **₹17,250** |
| Invoice rate ₹14,800 | ✅ Pass |
| Invoice rate ₹18,000 | ❌ Fail — Rate above allowed range |

---

### Formula B — Gemstones & Pearls (Extracted from Product Name)

Used for: Emeralds JEM, Rubies JRU, Pearls JPS, Precious stones JOS, Semi precious JSP, Synthetic JSY (numbered products only)

```
Slab Rate = Last number in the product name
Minimum Allowed Rate = Slab Rate × 85%
Maximum Allowed Rate = Slab Rate × 115%
```

**Example — Emeralds JEM 5000**

| Item | Value |
|------|-------|
| Slab Rate (from product name) | ₹5,000 |
| Minimum Allowed | ₹5,000 × 85% = **₹4,250** |
| Maximum Allowed | ₹5,000 × 115% = **₹5,750** |
| Invoice rate ₹5,000 | ✅ Pass |
| Invoice rate ₹8,000 | ❌ Fail — Rate above allowed range |

**Example — Pearls JPS 2000** (UOM = Grams, rate still from product name)

| Item | Value |
|------|-------|
| Slab Rate | ₹2,000 |
| Allowed band | **₹1,700 – ₹2,300** |
| UOM must be | **Grams** (not Carats) |

---

### Formula C — Diamonds (Hardcoded)

Used for: All diamond products listed in the Hardcoded Diamond Rate List

```
Step 1 — Apply 25% uplift to the base rate:
  Uplifted Minimum = Base Minimum × 125%
  Uplifted Maximum = Base Maximum × 125%

Step 2 — Apply ±15% tolerance:
  Final Minimum = Uplifted Minimum × 85%
  Final Maximum = Uplifted Maximum × 115%

Shortcut:
  Final Minimum = Base Minimum × 106.25%
  Final Maximum = Base Maximum × 143.75%
```

**Example — Di. RA 20**

| Item | Value |
|------|-------|
| Base Minimum | ₹20,000 |
| Base Maximum | ₹25,000 |
| Final Minimum | ₹20,000 × 106.25% = **₹21,250** |
| Final Maximum | ₹25,000 × 143.75% = **₹35,937.50** |
| Invoice rate ₹22,000 | ✅ Pass |
| Invoice rate ₹40,000 | ❌ Fail — Rate above allowed range |

---

### Formula D — Accessories (Unit Rate 0 to 1)

Used for: Lac, Dori, Black beads, Wax Dori Etc, Nail, Wax

```
Valid unit rate = any value from 0 to 1 (inclusive)
```

These items represent **fractional gram weight**, not a full rupee rate.

**Example — Black beads**

| Invoice unit rate | Result |
|-------------------|--------|
| 0.5 | ✅ Pass |
| 0.85 | ✅ Pass |
| 500 | ❌ Fail — Unit rate must be between 0 and 1 |

---

# Product-wise Rate Validation

Below is every product used in Rate & Ledger Audit, grouped by sales account.

---

## Group 1 — Gold Sales Account - 14K

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Gold Ornaments 14K | Rule Book Input | Invoice rate compared to Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹8,750–₹10,000 → Allowed: **₹7,437.50 – ₹11,500**. Rate ₹9,000 ✅ |

**UOM:** Grams  
**Sales account:** Gold Sales Account - 14K only

---

## Group 2 — Gold Sales Account - 18K

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Gold Ornaments 18K | Rule Book Input | Invoice rate vs Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹11,800–₹12,000 → Allowed: **₹10,030 – ₹13,800** |
| Customer Gold Ornaments 18K | Rule Book Input | Same as above (separate Rule Book entry) | Min = Book Min × 85%; Max = Book Max × 115% | Same band as Gold Ornaments 18K when rates match |

**UOM:** Grams  
**Sales account:** Gold Sales Account - 18K only

---

## Group 3 — Gold Sales Account - 22K

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Gold Ornaments 22K | Rule Book Input | Invoice rate vs Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹14,500–₹15,000 → Allowed: **₹12,325 – ₹17,250** |
| Customer Gold Ornaments 22K | Rule Book Input | Same formula, own Rule Book entry | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹14,500–₹15,000 → Allowed: **₹12,325 – ₹17,250** |
| Black beads | Mapping Only + Accessory Rule | No rate band; unit rate must be 0–1 | 0 ≤ Unit Rate ≤ 1 | Rate 0.5 ✅; Rate 500 ❌ |
| Dori | Mapping Only + Accessory Rule | No rate band; unit rate must be 0–1 | 0 ≤ Unit Rate ≤ 1 | Rate 0.3 ✅ |
| Lac | Mapping Only + Accessory Rule | No rate band; unit rate must be 0–1 | 0 ≤ Unit Rate ≤ 1 | Rate 0.8 ✅ |
| Wax, Dori Etc | Mapping Only + Accessory Rule | No rate band; unit rate must be 0–1 | 0 ≤ Unit Rate ≤ 1 | Rate 1.0 ✅ |
| Nail | Mapping Only + Accessory Rule | No rate band; unit rate must be 0–1 | 0 ≤ Unit Rate ≤ 1 | Rate 0.2 ✅ |
| Wax | Mapping Only + Accessory Rule | Same as Wax Dori (if used as product name) | 0 ≤ Unit Rate ≤ 1 | Rate 0.5 ✅ |

**UOM:** Grams (all products in this group)  
**Sales account:** Gold Sales Account - 22K only

---

## Group 4 — Gold Sales Account - Jadau

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Gold Ornaments Jadau | Rule Book Input | Invoice rate vs Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹14,500–₹15,000 → Allowed: **₹12,325 – ₹17,250** |

**UOM:** Grams

---

## Group 5 — Gold Sales Account - 24K

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Standard Gold 24K | Rule Book Input | Invoice rate vs Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹15,700–₹16,000 → Allowed: **₹13,345 – ₹18,400** |

**UOM:** Grams

---

## Group 6 — Silver Sales Account

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Silver articles | Rule Book Input | Invoice rate vs Rule Book band | Min = Book Min × 85%; Max = Book Max × 115% | Book: ₹170–₹200 → Allowed: **₹144.50 – ₹230** |

**UOM:** Grams

---

## Group 7 — Jewel Sales Account - Diamonds

All diamond products use **Hardcoded** rates. UOM for all: **Carats**.

### 7A — General diamond products

| Product Name | Rate Source | Base Rate (Min – Max) | Allowed Range Formula | Example |
|--------------|-------------|----------------------|----------------------|---------|
| Chakri | Hardcoded | ₹1,500 – ₹1,500 | Final Min = Base Min × 106.25%; Final Max = Base Max × 143.75% | Allowed: **₹1,593.75 – ₹2,156.25** |
| Customer Diamonds | Mapping Only | — | No rate check | Account mapping only |
| Customer Flat Polki | Hardcoded | ₹0 – ₹1 | Final Min = 0; Final Max = 1 × 143.75% | Allowed: **₹0 – ₹1.44** |
| Polki A | Hardcoded | ₹2,500 – ₹2,500 | Formula C | Allowed: **₹2,656.25 – ₹3,593.75** |
| SD DI. Mix | Hardcoded | ₹3,00,000 (minimum only) | Rate must be ≥ Final Minimum | Minimum: **₹3,18,750** |
| Diamonds Loose SD DI. Mix | Hardcoded | ₹3,00,000 (minimum only) | Rate must be ≥ Final Minimum | Minimum: **₹3,18,750** |

### 7B — Di. RA series (Customer Diamonds)

| Product Name | Rate Source | Base Rate (Min – Max) | Example Allowed Range |
|--------------|-------------|----------------------|----------------------|
| Di. RA 10 | Hardcoded | ₹10,000 – ₹15,000 | ₹10,625 – ₹21,562.50 |
| Di. RA 15 | Hardcoded | ₹15,000 – ₹20,000 | ₹15,937.50 – ₹28,750 |
| Di. RA 20 | Hardcoded | ₹20,000 – ₹25,000 | ₹21,250 – ₹35,937.50 |
| Di. RA 25 | Hardcoded | ₹25,000 – ₹30,000 | ₹26,562.50 – ₹43,125 |
| Di. RA 30 | Hardcoded | ₹30,000 – ₹35,000 | ₹31,875 – ₹50,312.50 |
| Di. RA 35 | Hardcoded | ₹35,000 – ₹40,000 | ₹37,187.50 – ₹57,500 |
| Di. RA 40 | Hardcoded | ₹40,000 – ₹45,000 | ₹42,500 – ₹64,687.50 |
| Di. RA 45 | Hardcoded | ₹45,000 – ₹50,000 | ₹47,812.50 – ₹71,875 |
| Di. RA 50 | Hardcoded | ₹50,000 – ₹60,000 | ₹53,125 – ₹86,250 |
| Di. RA 60 | Hardcoded | ₹60,000 – ₹70,000 | ₹63,750 – ₹1,00,625 |
| Di. RA 70 | Hardcoded | ₹70,000 – ₹80,000 | ₹74,375 – ₹1,15,000 |
| Di. RA 80 | Hardcoded | ₹80,000 – ₹90,000 | ₹85,000 – ₹1,29,375 |
| Di. RA 90 | Hardcoded | ₹90,000 – ₹1,00,000 | ₹95,625 – ₹1,43,750 |
| Di. RA 100 | Hardcoded | ₹1,00,000 – ₹1,10,000 | ₹1,06,250 – ₹1,58,125 |
| Di. RA 110 | Hardcoded | ₹1,10,000 – ₹1,20,000 | ₹1,16,875 – ₹1,72,500 |
| Di. RA 120 | Hardcoded | ₹1,20,000 – ₹1,30,000 | ₹1,27,500 – ₹1,86,875 |
| Di. RA 130 | Hardcoded | ₹1,30,000 – ₹1,40,000 | ₹1,38,125 – ₹2,01,250 |
| Di. RA 140 | Hardcoded | ₹1,40,000 – ₹1,50,000 | ₹1,48,750 – ₹2,15,625 |
| Di. RA 150 | Hardcoded | ₹1,50,000 – ₹1,60,000 | ₹1,59,375 – ₹2,30,000 |
| Di. RA 160 | Hardcoded | ₹1,60,000 – ₹1,70,000 | ₹1,70,000 – ₹2,44,375 |
| Di. RA 170 | Hardcoded | ₹1,70,000 – ₹1,80,000 | ₹1,80,625 – ₹2,58,750 |
| Di. RA 180 | Hardcoded | ₹1,80,000 – ₹1,90,000 | ₹1,91,250 – ₹2,73,125 |
| Di. RA 190 | Hardcoded | ₹1,90,000 – ₹2,00,000 | ₹2,01,875 – ₹2,87,500 |

### 7C — Di. RC series

| Product Name | Rate Source | Base Rate | Example Allowed Range |
|--------------|-------------|-----------|----------------------|
| Di. RC 1 | Hardcoded | ₹14,000 | ₹14,875 – ₹20,125 |
| Di. RC 2 | Hardcoded | ₹17,000 | ₹18,062.50 – ₹24,437.50 |
| Di. RC 3 | Hardcoded | ₹23,000 | ₹24,437.50 – ₹33,062.50 |
| Di. RC 4 | Hardcoded | ₹29,000 | ₹30,812.50 – ₹41,687.50 |
| Di. RC 5 | Hardcoded | ₹34,000 | ₹36,125 – ₹48,875 |
| Di. RC 6 | Hardcoded | ₹38,000 | ₹40,375 – ₹54,625 |
| Di. RC 7 | Hardcoded | ₹42,000 | ₹44,625 – ₹60,375 |
| Di. RC 8 | Hardcoded | ₹45,000 | ₹47,812.50 – ₹64,687.50 |
| Di. RC 9 | Hardcoded | ₹50,000 | ₹53,125 – ₹71,875 |
| Di. RC 10 | Hardcoded | ₹54,000 | ₹57,375 – ₹77,625 |
| Di. RC 11 | Hardcoded | ₹60,000 | ₹63,750 – ₹86,250 |
| Di. RC 12 | Hardcoded | ₹61,000 | ₹64,812.50 – ₹87,687.50 |
| Di. RC 13 | Hardcoded | ₹65,000 | ₹69,062.50 – ₹93,437.50 |
| Di. RC 14 | Hardcoded | ₹70,000 | ₹74,375 – ₹1,00,625 |
| Di. RC 15 | Hardcoded | ₹75,000 | ₹79,687.50 – ₹1,07,812.50 |
| Di. RC 16 | Hardcoded | ₹80,000 | ₹85,000 – ₹1,15,000 |
| Di. RC 17 | Hardcoded | ₹82,000 | ₹87,125 – ₹1,17,875 |
| Di. RC 18 | Hardcoded | ₹91,000 | ₹96,687.50 – ₹1,30,812.50 |
| Di. RC 19 | Hardcoded | ₹95,000 | ₹1,00,937.50 – ₹1,36,562.50 |
| Di. RC 20 | Hardcoded | ₹1,00,000 | ₹1,06,250 – ₹1,43,750 |
| Di. RC 21 | Hardcoded | ₹1,05,000 | ₹1,11,562.50 – ₹1,50,937.50 |
| Di. RC 22 | Hardcoded | ₹1,10,000 | ₹1,16,875 – ₹1,58,125 |
| Di. RC 23 | Hardcoded | ₹1,15,000 | ₹1,22,187.50 – ₹1,65,312.50 |
| Di. RC 24 | Hardcoded | ₹1,25,000 | ₹1,32,812.50 – ₹1,79,687.50 |
| Di. RC 25 | Hardcoded | ₹1,30,000 | ₹1,38,125 – ₹1,86,875 |
| Di. RC 26 | Hardcoded | ₹1,35,000 | ₹1,43,437.50 – ₹1,94,062.50 |
| Di. RC 30 | Hardcoded | ₹1,65,000 | ₹1,75,312.50 – ₹2,37,187.50 |

### 7D — Diamonds Loose Di. RA series

Same base rates and formula as Di. RA series above. Product names:

`Diamonds Loose Di. RA 10`, `Diamonds Loose Di. RA 15`, `Diamonds Loose Di. RA 20`, `Diamonds Loose Di. RA 25`, `Diamonds Loose Di. RA 30`, `Diamonds Loose Di. RA 40`, `Diamonds Loose Di. RA 50`, `Diamonds Loose Di. RA 60`, `Diamonds Loose Di. RA 70`, `Diamonds Loose Di. RA 80`, `Diamonds Loose Di. RA 90`, `Diamonds Loose Di. RA 100`, `Diamonds Loose Di. RA 110`, `Diamonds Loose Di. RA 120`, `Diamonds Loose Di. RA 130`, `Diamonds Loose Di. RA 140`, `Diamonds Loose Di. RA 150`, `Diamonds Loose Di. RA 160`, `Diamonds Loose Di. RA 170`, `Diamonds Loose Di. RA 180`, `Diamonds Loose Di. RA 190`

### 7E — Diamonds Loose Di. SD / SD DI. series

| Product Name | Rate Source | Base Rate (Min – Max) | Example Allowed Range |
|--------------|-------------|----------------------|----------------------|
| Diamonds Loose Di. SD 200 | Hardcoded | ₹2,00,000 – ₹2,25,000 | ₹2,12,500 – ₹3,23,437.50 |
| Diamonds Loose Di. SD 225 | Hardcoded | ₹2,25,000 – ₹2,50,000 | ₹2,39,062.50 – ₹3,59,375 |
| Diamonds Loose Di. SD 250 | Hardcoded | ₹2,50,000 – ₹2,75,000 | ₹2,65,625 – ₹3,95,312.50 |
| Diamonds Loose Di. SD 275 | Hardcoded | ₹2,75,000 – ₹3,00,000 | ₹2,92,187.50 – ₹4,31,250 |
| SD DI. 200 | Hardcoded | ₹2,00,000 – ₹2,25,000 | ₹2,12,500 – ₹3,23,437.50 |
| SD DI. 225 | Hardcoded | ₹2,25,000 – ₹2,50,000 | ₹2,39,062.50 – ₹3,59,375 |
| SD DI. 250 | Hardcoded | ₹2,50,000 – ₹2,75,000 | ₹2,65,625 – ₹3,95,312.50 |
| SD DI. 275 | Hardcoded | ₹2,75,000 – ₹3,00,000 | ₹2,92,187.50 – ₹4,31,250 |

### 7F — Flat Polki FP series

| Product Name | Rate Source | Base Rate | Example Allowed Range |
|--------------|-------------|-----------|----------------------|
| Flat Polki FP 1 | Hardcoded | ₹5,500 | ₹5,843.75 – ₹7,906.25 |
| Flat Polki FP 2 | Hardcoded | ₹7,500 | ₹7,968.75 – ₹10,781.25 |
| Flat Polki FP 3 | Hardcoded | ₹10,000 | ₹10,625 – ₹14,375 |
| Flat Polki FP 4 | Hardcoded | ₹11,000 | ₹11,687.50 – ₹15,812.50 |
| Flat Polki FP 5 | Hardcoded | ₹14,000 | ₹14,875 – ₹20,125 |
| Flat Polki FP 6 | Hardcoded | ₹16,500 | ₹17,531.25 – ₹23,718.75 |
| Flat Polki FP 7 | Hardcoded | ₹20,000 | ₹21,250 – ₹28,750 |
| Flat Polki FP 8 | Hardcoded | ₹22,000 | ₹23,375 – ₹31,625 |
| Flat Polki FP 9 | Hardcoded | ₹25,000 | ₹26,562.50 – ₹35,937.50 |
| Flat Polki FP 10 | Hardcoded | ₹30,000 | ₹31,875 – ₹43,125 |
| Flat Polki FP 11 | Hardcoded | ₹32,000 | ₹34,000 – ₹46,000 |
| Flat Polki FP 12 | Hardcoded | ₹33,000 | ₹35,062.50 – ₹47,437.50 |
| Flat Polki FP 13 | Hardcoded | ₹35,000 | ₹37,187.50 – ₹50,312.50 |
| Flat Polki FP 14 | Hardcoded | ₹36,000 | ₹38,250 – ₹51,750 |
| Flat Polki FP 15 | Hardcoded | ₹39,000 | ₹41,437.50 – ₹56,062.50 |
| Flat Polki FP 16 | Hardcoded | ₹43,000 | ₹45,687.50 – ₹61,812.50 |
| Flat Polki FP 17 | Hardcoded | ₹50,000 | ₹53,125 – ₹71,875 |
| Flat Polki FP 18 | Hardcoded | ₹66,000 | ₹70,125 – ₹94,875 |
| Flat Polki FP 19 | Hardcoded | ₹70,000 | ₹74,375 – ₹1,00,625 |
| Flat Polki FP 20 | Hardcoded | ₹75,000 | ₹79,687.50 – ₹1,07,812.50 |

---

## Group 8 — Jewels Sales Account - Color Stones

**UOM:** Carats (all products)

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Customer Stones | Mapping Only | Account mapping only; no rate band | — | Any rate accepted for mapping |
| Precious stones JOS {n} | Extracted from Product Name | Slab = number after JOS | Slab × 85% to Slab × 115% | Precious stones JOS 3600 → **₹3,060 – ₹4,140** |
| Precious stones Loose JOS {n} | Extracted from Product Name | Slab = number in name | Slab × 85% to Slab × 115% | Loose JOS 2000 → **₹1,700 – ₹2,300** |
| Semi precious JSP {n} | Extracted from Product Name | Slab = number after JSP | Slab × 85% to Slab × 115% | Semi precious JSP 500 → **₹425 – ₹575** |
| Synthetic JSY {n} | Extracted from Product Name | Slab = number after JSY | Slab × 85% to Slab × 115% | Synthetic JSY 150 → **₹127.50 – ₹172.50** |

### All approved Precious stones JOS slab numbers

50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 4000, 4200, 4400, 4500, 4800, 4900, 5000, 5500, 5600, 6000, 6500, 7000, 7500, 8000, 8500, 10000, 11000, 12000, 14000, 16000, 17000, 17500, 20000, 25000, 38500, 45000, 49000, 66000

### All approved Precious stones Loose JOS slab numbers

100, 150, 200, 250, 400, 600, 1100, 1200, 1800, 2000, 2800, 3000, 3600, 4700, 5600, 7000

### All approved Semi precious JSP slab numbers

50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 750, 800, 850, 900, 1000, 1100, 1200, 1300, 1400, 1600, 2500

### All approved Synthetic JSY slab numbers

100, 150

---

## Group 9 — Jewels Sales Account - Emeralds

**UOM:** Carats (all products except none — all Carats)

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Customer Emeralds | Mapping Only | Account mapping only | — | No rate band |
| Emeralds JEM {n} | Extracted from Product Name | Slab = number after JEM | Slab × 85% to Slab × 115% | Emeralds JEM 5000 → **₹4,250 – ₹5,750** |
| Emeralds JEM Loose {n} | Extracted from Product Name | Slab = number in name | Slab × 85% to Slab × 115% | Emeralds JEM Loose 22000 → **₹18,700 – ₹25,300** |
| Emeralds JEM Mix | Mapping Only | Account mapping only | — | No rate band |

### All approved Emeralds JEM slab numbers

50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900, 5000, 5200, 5300, 5600, 5800, 6000, 6500, 6700, 6800, 7000, 7500, 7800, 8000, 8500, 9000, 9500, 10000, 10500, 11500, 12000, 12500, 13000, 14000, 14500, 15000, 18500, 24000, 25000, 30000, 40000, 58000

Also: **Emeralds JEM Loose 22000**

---

## Group 10 — Jewels Sales Account - Pearls

**UOM:** Grams (all products — pearls are weighed in grams, not carats)

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Customer Pearls | Mapping Only | Account mapping only | — | No rate band |
| Pearls JPS {n} | Extracted from Product Name | Slab = number after JPS | Slab × 85% to Slab × 115% | Pearls JPS 2000 → **₹1,700 – ₹2,300**, UOM = Grams |

### All approved Pearls JPS slab numbers

50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 800, 850, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2400, 2500, 2800, 2900, 3500, 4000, 4200, 5000, 8400, 33000

---

## Group 11 — Jewels Sales Account - Rubies

**UOM:** Carats (all products)

| Product Name | Rate Source | Validation Logic | Allowed Range Formula | Example |
|--------------|-------------|------------------|----------------------|---------|
| Customer Rubies | Mapping Only | Account mapping only | — | No rate band |
| Rubies JRU {n} | Extracted from Product Name | Slab = number after JRU | Slab × 85% to Slab × 115% | Rubies JRU 1000 → **₹850 – ₹1,150** |
| Rubies JRU Loose {n} | Extracted from Product Name | Slab = number in name | Slab × 85% to Slab × 115% | Rubies JRU Loose 33500 → **₹28,475 – ₹38,525** |
| Rubies JRU Mix | Mapping Only | Account mapping only | — | No rate band |

### All approved Rubies JRU slab numbers

50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500, 4700, 4800, 5000, 5100, 5300, 5400, 5500, 6000, 6300, 6600, 7000, 8400, 10000, 11200, 14500, 20000

Also: **Rubies JRU Loose 33500**

---

## Current Rule Book rates (Gold & Silver)

These are the rates **your team has entered** in Scrutiny → Rate Rule Book. Update them when the market moves.

| Product | Rule Book Minimum | Rule Book Maximum | Allowed Band (±15%) |
|---------|-------------------|-------------------|---------------------|
| Gold Ornaments 14K | ₹8,750 | ₹10,000 | ₹7,437.50 – ₹11,500 |
| Gold Ornaments 18K | ₹11,800 | ₹12,000 | ₹10,030 – ₹13,800 |
| Customer Gold Ornaments 18K | ₹11,800 | ₹12,000 | ₹10,030 – ₹13,800 |
| Gold Ornaments 22K | ₹14,500 | ₹15,000 | ₹12,325 – ₹17,250 |
| Customer Gold Ornaments 22K | ₹14,500 | ₹15,000 | ₹12,325 – ₹17,250 |
| Gold Ornaments Jadau | ₹14,500 | ₹15,000 | ₹12,325 – ₹17,250 |
| Standard Gold 24K | ₹15,700 | ₹16,000 | ₹13,345 – ₹18,400 |
| Silver articles | ₹170 | ₹200 | ₹144.50 – ₹230 |

---

# Step-by-Step Audit Flow

This section explains what happens from the moment you upload a file until you see the error report.

---

## Step 1 — File Upload

| | |
|---|---|
| **What is checked** | The uploaded file is a valid sales Excel (.xlsx). Required columns exist: Voucher No, Sales Account, Product, Quantity, Unit Rate. |
| **Why it is checked** | The audit cannot run without these basic transaction details. |
| **Error if failed** | Upload rejected — *"Missing required columns"* (file is not processed at all). |

---

## Step 2 — Header Detection

| | |
|---|---|
| **What is checked** | The system finds the row that contains column headings (e.g. "Voucher No", "Sales Account"). Title rows or company headers above the table are skipped automatically. |
| **Why it is checked** | Sales exports often include company name or date range rows above the data table. |
| **Error if failed** | Upload rejected if no valid header row is found. |

---

## Step 3 — Product Identification

| | |
|---|---|
| **What is checked** | Each row's Product name is read and matched against the **Master File Based** official product catalog. The system identifies which product family the row belongs to (Gold 22K, Emeralds, Diamonds, etc.). |
| **Why it is checked** | Different products follow different rate rules. The product name determines which validation applies. |
| **Error if failed** | No error for unknown products — they are silently skipped. Known products that don't match any catalog entry are not flagged. |

---

## Step 4 — Rate Source Identification

| | |
|---|---|
| **What is checked** | Based on the product, the system determines the rate source: Rule Book Input, Hardcoded, Extracted from Product Name, or Mapping Only. |
| **Why it is checked** | Each rate source has a different allowed range formula. The system must know which formula to apply before comparing the invoice rate. |
| **Error if failed** | **Missing Rate Rule** — if a gold/silver product has no entry in the Rate Rule Book, or a diamond product is missing from the hardcoded list. |

---

## Step 5 — Rate Validation

| | |
|---|---|
| **What is checked** | The invoice **Unit Rate** is compared to the allowed range for that product (using the correct formula from Step 4). |
| **Why it is checked** | To detect billing at rates significantly above or below the approved standard — protecting against pricing errors, outdated rates, or manual entry mistakes. |
| **Error if failed** | **Rate above allowed range** or **Rate below allowed range** — invoice rate is outside the ±15% band. **Missing unit rate** — rate is blank or zero on a product that requires rate validation. |

---

## Step 6 — Ledger Validation

| | |
|---|---|
| **What is checked** | The **Sales Account** on the row is compared to the product. Each product must appear under its designated sales account (Master File Based catalog). |
| **Why it is checked** | Sales ledger discipline — e.g. Emeralds must be under Emeralds account, not Pearls account. Wrong account indicates a booking/classification error. |
| **Error if failed** | **Product mapping mismatch** — product belongs to a different sales account (e.g. Pearls JPS 2000 booked under Rubies account). |

---

## Step 7 — Deviation Check

| | |
|---|---|
| **What is checked** | Three additional deviation rules: **UOM** (Grams vs Carats), **Accessory unit rate** (0 to 1 for Lac/Dori/Black beads), and **Product pattern** (can the slab number be read from a gemstone product name?). |
| **Why it is checked** | UOM errors affect weight-based valuation. Accessory rates must be fractional. Gemstone products must have a readable slab number for rate extraction. |
| **Error if failed** | **Invalid UOM for product** — wrong unit of measurement. **Unit rate must be between 0 and 1** — accessory rate too high. **Invalid product pattern** — gemstone name does not contain a readable slab number. |

---

## Step 8 — Error Generation

| | |
|---|---|
| **What is checked** | All failed checks from Steps 5–7 are combined into a single error list per row. If a row has multiple issues, the **most important** error is shown first (mapping errors take priority over rate errors). |
| **Why it is checked** | To give auditors one clear message per row to investigate. |
| **Error if failed** | Row appears in the **Error rows** count with a specific message (see Error Messages table below). |

---

## Step 9 — Report Generation

| | |
|---|---|
| **What is checked** | Summary counts are calculated: total rows, error rows, and breakdown by error type. The exception report can be exported to Excel, CSV, or PDF. |
| **Why it is checked** | Managers and auditors need a filterable summary and exportable evidence for follow-up. |
| **Error if failed** | No error at this step — this step produces the output you see on screen. |

---

# Validation summary — all checks at a glance

| Validation | What is checked | Why | Error message if failed |
|------------|-----------------|-----|------------------------|
| **Ledger mapping** | Product matches its sales account | Prevents mis-classification in books | Product mapping mismatch |
| **Rate deviation** | Unit rate within allowed band | Catches pricing errors | Rate above / below allowed range |
| **Missing rate** | Unit rate present for rate-checked products | Cannot validate without a rate | (Missing unit rate) |
| **Missing rate rule** | Gold/silver/diamond has a configured rate | System needs a standard to compare against | (Missing rate rule) |
| **UOM** | Grams or Carats matches product type | Wrong unit distorts weight/value | Invalid UOM for product |
| **Accessory range** | Lac/Dori/Black beads rate is 0–1 | These are fractional weight items | Unit rate must be between 0 and 1 |
| **Product pattern** | Gemstone name contains readable slab | Cannot extract rate without a number | (Invalid product pattern) |

---

# Dashboard widgets (how to read your results)

| Widget | What it shows | Typical fix |
|--------|---------------|-------------|
| **Error rows** | All rows with any issue | Review and fix in source system |
| **Account vs product** | Wrong sales account for a product | Correct Sales Account column |
| **Range deviations** | Rate too high or too low | Update Rate Rule Book (gold/silver) or fix invoice rate |
| **Accessories Unit Rate Check** | Lac/Dori/Black beads rate > 1 | Enter fractional rate (0 to 1) |
| **Unit of measurement deviations** | Wrong Grams/Carats | Fix UOM column in export |

---

# Common reasons for many error rows

| Symptom | Most likely cause | What to do |
|---------|-------------------|------------|
| Hundreds of **Range deviation** errors on gold | Rate Rule Book is outdated | Update gold/silver rates in **Scrutiny → Rate Rule Book** |
| Hundreds of **UOM** errors | Export uses Carats for everything | Set Grams for gold/silver/pearls; Carats for gems/diamonds |
| Many **Account vs product** errors | Wrong sales account on all rows | Verify Sales Account column matches product family |
| Many **Accessories** errors | Black beads/Lac entered with full rupee rates | Use rates between 0 and 1 |
| Many gemstone **Range deviation** errors | Invoice rate differs from slab number in product name | Verify product name and unit rate match (e.g. JEM 5000 should rate near ₹5,000) |

---

# Required columns in your Excel file

| Column | Required? | Notes |
|--------|-----------|-------|
| Voucher No | Yes | Identifies each transaction |
| Sales Account | Yes | Must match one of the 11 official accounts |
| Product | Yes | Must match official product catalog |
| Quantity | Yes | Must be greater than zero |
| Unit Rate | Yes | Required for rate-checked products |
| UOM | Recommended | Grams or Carats; audit skips UOM check if column is missing |
| Date, Party Name, Gross Amount, GST | Optional | Preserved in export for reference |

---

# Relationship to Sales Return Audit

**Sales Return Rate Audit** uses the same product and rate rules on your return file, then additionally compares average return rates against a baseline from a previous **Rate and Ledger Audit** run.

**Recommendation:** Run Rate and Ledger Audit first (while logged in) before running Sales Return Audit, so the system has a sales baseline for comparison.

---

# Quick troubleshooting checklist

- [ ] Updated **Rate Rule Book** for gold and silver to current market rates?
- [ ] UOM column shows **Grams** for gold, silver, pearls, and accessories?
- [ ] UOM column shows **Carats** for diamonds, rubies, emeralds, and color stones?
- [ ] Sales Account matches the product family for every row?
- [ ] Lac / Dori / Black beads / Wax rates are between **0 and 1**?
- [ ] Gemstone and pearl rates are within **±15%** of the number in the product name?
- [ ] Re-uploaded the file after making corrections?

---

*Last updated to reflect current Rule Book rates and official product catalog. For Sales Return Audit rules, see the Sales Return Audit guide.*
