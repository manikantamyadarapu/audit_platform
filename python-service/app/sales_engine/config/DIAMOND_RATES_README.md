# Diamond Rate Validation - Complete Reference

## Overview

All diamond products use **HARDCODED** rates from `diamond_hardcoded_rates.json`.

**No editable products.** The Diamond Rule Book has been removed.

## Validation Logic

### Formula

```
STEP 1: Apply +25% Uplift
  uplifted_min = base_min × 1.25
  uplifted_max = base_max × 1.25

STEP 2: Apply ±15% Deviation
  final_min = uplifted_min × 0.85
  final_max = uplifted_max × 1.15

COMBINED:
  final_min = base_min × 1.0625
  final_max = base_max × 1.4375
```

### Valid Condition
```
final_min ≤ invoice_unit_rate ≤ final_max
```

### Invalid Conditions
- **Below range:** `invoice_unit_rate < final_min`
  - Message: "Unit rate below allowed diamond range."
- **Above range:** `invoice_unit_rate > final_max`
  - Message: "Unit rate above allowed diamond range."

---

## Complete Product List

### CHAKRI
```json
"CHAKRI": { "min_rate": 1500, "max_rate": 1500 }
```
- Valid range: 1593.75 to 2156.25

### CUSTOMER FLAT POLKI
```json
"CUSTOMER FLAT POLKI": { "min_rate": 0, "max_rate": 1 }
```
- Valid range: 0 to 1.4375

### CUSTOMER DIAMONDS (DI. RA)
```json
"DI. RA 10": { "min_rate": 10000, "max_rate": 15000 }
"DI. RA 15": { "min_rate": 15000, "max_rate": 20000 }
"DI. RA 20": { "min_rate": 20000, "max_rate": 25000 }
"DI. RA 25": { "min_rate": 25000, "max_rate": 30000 }
"DI. RA 30": { "min_rate": 30000, "max_rate": 35000 }
"DI. RA 35": { "min_rate": 35000, "max_rate": 40000 }
"DI. RA 40": { "min_rate": 40000, "max_rate": 45000 }
"DI. RA 45": { "min_rate": 45000, "max_rate": 50000 }
"DI. RA 50": { "min_rate": 50000, "max_rate": 60000 }
"DI. RA 60": { "min_rate": 60000, "max_rate": 70000 }
"DI. RA 70": { "min_rate": 70000, "max_rate": 80000 }
"DI. RA 80": { "min_rate": 80000, "max_rate": 90000 }
"DI. RA 90": { "min_rate": 90000, "max_rate": 100000 }
"DI. RA 100": { "min_rate": 100000, "max_rate": 110000 }
"DI. RA 110": { "min_rate": 110000, "max_rate": 120000 }
"DI. RA 120": { "min_rate": 120000, "max_rate": 130000 }
"DI. RA 130": { "min_rate": 130000, "max_rate": 140000 }
"DI. RA 140": { "min_rate": 140000, "max_rate": 150000 }
"DI. RA 150": { "min_rate": 150000, "max_rate": 160000 }
"DI. RA 160": { "min_rate": 160000, "max_rate": 170000 }
"DI. RA 170": { "min_rate": 170000, "max_rate": 180000 }
"DI. RA 180": { "min_rate": 180000, "max_rate": 190000 }
"DI. RA 190": { "min_rate": 190000, "max_rate": 200000 }
```

### DI. RC (Rose Cut Diamonds)
```json
"DI. RC 1": { "min_rate": 14000, "max_rate": 14000 }
"DI. RC 2": { "min_rate": 17000, "max_rate": 17000 }
"DI. RC 3": { "min_rate": 23000, "max_rate": 23000 }
"DI. RC 4": { "min_rate": 29000, "max_rate": 29000 }
"DI. RC 5": { "min_rate": 34000, "max_rate": 34000 }
"DI. RC 6": { "min_rate": 38000, "max_rate": 38000 }
"DI. RC 7": { "min_rate": 42000, "max_rate": 42000 }
"DI. RC 8": { "min_rate": 45000, "max_rate": 45000 }
"DI. RC 9": { "min_rate": 50000, "max_rate": 50000 }
"DI. RC 10": { "min_rate": 54000, "max_rate": 54000 }
"DI. RC 11": { "min_rate": 60000, "max_rate": 60000 }
"DI. RC 12": { "min_rate": 61000, "max_rate": 61000 }
"DI. RC 13": { "min_rate": 65000, "max_rate": 65000 }
"DI. RC 14": { "min_rate": 70000, "max_rate": 70000 }
"DI. RC 15": { "min_rate": 75000, "max_rate": 75000 }
"DI. RC 16": { "min_rate": 80000, "max_rate": 80000 }
"DI. RC 17": { "min_rate": 82000, "max_rate": 82000 }
"DI. RC 18": { "min_rate": 91000, "max_rate": 91000 }
"DI. RC 19": { "min_rate": 95000, "max_rate": 95000 }
"DI. RC 20": { "min_rate": 100000, "max_rate": 100000 }
"DI. RC 21": { "min_rate": 105000, "max_rate": 105000 }
"DI. RC 22": { "min_rate": 110000, "max_rate": 110000 }
"DI. RC 23": { "min_rate": 115000, "max_rate": 115000 }
"DI. RC 24": { "min_rate": 125000, "max_rate": 125000 }
"DI. RC 25": { "min_rate": 130000, "max_rate": 130000 }
"DI. RC 26": { "min_rate": 135000, "max_rate": 135000 }
"DI. RC 30": { "min_rate": 165000, "max_rate": 165000 }
```

### DIAMONDS LOOSE DI. RA
```json
"DIAMONDS LOOSE DI. RA 10": { "min_rate": 10000, "max_rate": 15000 }
"DIAMONDS LOOSE DI. RA 15": { "min_rate": 5000, "max_rate": 20000 }
"DIAMONDS LOOSE DI. RA 20": { "min_rate": 20000, "max_rate": 25000 }
"DIAMONDS LOOSE DI. RA 25": { "min_rate": 25000, "max_rate": 30000 }
"DIAMONDS LOOSE DI. RA 30": { "min_rate": 30000, "max_rate": 35000 }
"DIAMONDS LOOSE DI. RA 40": { "min_rate": 40000, "max_rate": 45000 }
"DIAMONDS LOOSE DI. RA 50": { "min_rate": 50000, "max_rate": 60000 }
"DIAMONDS LOOSE DI. RA 60": { "min_rate": 60000, "max_rate": 70000 }
"DIAMONDS LOOSE DI. RA 70": { "min_rate": 70000, "max_rate": 80000 }
"DIAMONDS LOOSE DI. RA 80": { "min_rate": 80000, "max_rate": 90000 }
"DIAMONDS LOOSE DI. RA 90": { "min_rate": 90000, "max_rate": 100000 }
"DIAMONDS LOOSE DI. RA 100": { "min_rate": 100000, "max_rate": 110000 }
"DIAMONDS LOOSE DI. RA 110": { "min_rate": 110000, "max_rate": 120000 }
"DIAMONDS LOOSE DI. RA 120": { "min_rate": 120000, "max_rate": 130000 }
"DIAMONDS LOOSE DI. RA 130": { "min_rate": 130000, "max_rate": 140000 }
"DIAMONDS LOOSE DI. RA 140": { "min_rate": 140000, "max_rate": 150000 }
"DIAMONDS LOOSE DI. RA 150": { "min_rate": 150000, "max_rate": 160000 }
"DIAMONDS LOOSE DI. RA 160": { "min_rate": 160000, "max_rate": 170000 }
"DIAMONDS LOOSE DI. RA 170": { "min_rate": 170000, "max_rate": 180000 }
"DIAMONDS LOOSE DI. RA 180": { "min_rate": 180000, "max_rate": 190000 }
"DIAMONDS LOOSE DI. RA 190": { "min_rate": 190000, "max_rate": 200000 }
```

### DIAMONDS LOOSE DI. SD
```json
"DIAMONDS LOOSE DI. SD 200": { "min_rate": 200000, "max_rate": 225000 }
"DIAMONDS LOOSE DI. SD 225": { "min_rate": 225000, "max_rate": 250000 }
"DIAMONDS LOOSE DI. SD 250": { "min_rate": 250000, "max_rate": 275000 }
"DIAMONDS LOOSE DI. SD 275": { "min_rate": 275000, "max_rate": 300000 }
```

### DIAMONDS LOOSE SD DI. MIX (Min Only)
```json
"DIAMONDS LOOSE SD DI. MIX": { "min_rate": 300000, "min_only": true }
```

### SD DI.
```json
"SD DI. 200": { "min_rate": 200000, "max_rate": 225000 }
"SD DI. 225": { "min_rate": 225000, "max_rate": 250000 }
"SD DI. 250": { "min_rate": 250000, "max_rate": 275000 }
"SD DI. 275": { "min_rate": 275000, "max_rate": 300000 }
"SD DI. MIX": { "min_rate": 300000, "min_only": true }
```

### FLAT POLKI FP (Fixed Price)
```json
"FLAT POLKI FP 1": { "min_rate": 5500, "max_rate": 5500 }
"FLAT POLKI FP 2": { "min_rate": 7500, "max_rate": 7500 }
"FLAT POLKI FP 3": { "min_rate": 10000, "max_rate": 10000 }
"FLAT POLKI FP 4": { "min_rate": 11000, "max_rate": 11000 }
"FLAT POLKI FP 5": { "min_rate": 14000, "max_rate": 14000 }
"FLAT POLKI FP 6": { "min_rate": 16500, "max_rate": 16500 }
"FLAT POLKI FP 7": { "min_rate": 20000, "max_rate": 20000 }
"FLAT POLKI FP 8": { "min_rate": 22000, "max_rate": 22000 }
"FLAT POLKI FP 9": { "min_rate": 25000, "max_rate": 25000 }
"FLAT POLKI FP 10": { "min_rate": 30000, "max_rate": 30000 }
"FLAT POLKI FP 11": { "min_rate": 32000, "max_rate": 32000 }
"FLAT POLKI FP 12": { "min_rate": 33000, "max_rate": 33000 }
"FLAT POLKI FP 13": { "min_rate": 35000, "max_rate": 35000 }
"FLAT POLKI FP 14": { "min_rate": 36000, "max_rate": 36000 }
"FLAT POLKI FP 15": { "min_rate": 39000, "max_rate": 39000 }
"FLAT POLKI FP 16": { "min_rate": 43000, "max_rate": 43000 }
"FLAT POLKI FP 17": { "min_rate": 50000, "max_rate": 50000 }
"FLAT POLKI FP 18": { "min_rate": 66000, "max_rate": 66000 }
"FLAT POLKI FP 19": { "min_rate": 70000, "max_rate": 70000 }
"FLAT POLKI FP 20": { "min_rate": 75000, "max_rate": 75000 }
```

### FLAT POLKI LOOSE FP
```json
"FLAT POLKI LOOSE FP 1": { "min_rate": 5500, "max_rate": 5500 }
"FLAT POLKI LOOSE FP 4": { "min_rate": 11000, "max_rate": 11000 }
"FLAT POLKI LOOSE FP 5": { "min_rate": 14000, "max_rate": 14000 }
"FLAT POLKI LOOSE FP 6": { "min_rate": 16500, "max_rate": 16500 }
"FLAT POLKI LOOSE FP 9": { "min_rate": 25000, "max_rate": 25000 }
"FLAT POLKI LOOSE FP 13": { "min_rate": 35000, "max_rate": 35000 }
```

### POLKI
```json
"POLKI A": { "min_rate": 2500, "max_rate": 2500 }
"POLKI B": { "min_rate": 4000, "max_rate": 4000 }
"POLKI C": { "min_rate": 6000, "max_rate": 6000 }
"POLKI D": { "min_rate": 8000, "max_rate": 8000 }
```

---

## Example Calculations

### Example 1: FLAT POLKI FP 1
```
Base Rate: 5500

After +25% Uplift:
  5500 × 1.25 = 6875

After ±15% Deviation:
  final_min = 6875 × 0.85 = 5843.75
  final_max = 6875 × 1.15 = 7906.25

Valid Range: 5843.75 to 7906.25
```

### Example 2: DI. RA 20
```
Base Range: 20000 - 25000

After +25% Uplift:
  min: 20000 × 1.25 = 25000
  max: 25000 × 1.25 = 31250

After ±15% Deviation:
  final_min = 25000 × 0.85 = 21250
  final_max = 31250 × 1.15 = 35937.50

Valid Range: 21250 to 35937.50
```

### Example 3: CUSTOMER FLAT POLKI (0-1)
```
Base Range: 0 - 1

After +25% Uplift:
  min: 0 × 1.25 = 0
  max: 1 × 1.25 = 1.25

After ±15% Deviation:
  final_min = 0 × 0.85 = 0
  final_max = 1.25 × 1.15 = 1.4375

Valid Range: 0 to 1.4375
```

---

## Product Matching

**STRICT MATCHING ONLY**

- Exact normalized product name matching
- No `contains()` matching
- No `startswith()` matching
- No partial or fuzzy matching

Products are normalized using `normalize_strict_text()` which:
- Converts to uppercase
- Removes extra spaces
- Normalizes special characters

---

## Configuration Files

### diamond_hardcoded_rates.json
Contains all diamond product rates. This is the **ONLY** source for diamond rates.

### Deprecated Files (No Longer Used)
- `diamond_editable_products.json` - Removed
- `diamond_rate_rule_book.json` - Removed
- Diamond Rule Book UI - Removed

---

## Backend Functions

### load_diamond_hardcoded_rates()
Loads rates from `diamond_hardcoded_rates.json`

### diamond_final_bands_by_product()
Returns pre-computed final bands for all products:
- Applies +25% uplift
- Applies ±15% deviation
- Returns final_min, final_max for each product

### Validation
```python
if final_min <= invoice_unit_rate <= final_max:
    result = "PASS"
elif invoice_unit_rate < final_min:
    result = "FAIL - Below range"
elif invoice_unit_rate > final_max:
    result = "FAIL - Above range"
```

---

## Important Notes

1. **All diamonds are hardcoded** - No frontend editing
2. **+25% uplift then ±15% deviation** - Fixed formula
3. **Min-only products** (SD DI. MIX, DIAMONDS LOOSE SD DI. MIX) only validate minimum, no upper bound
4. **CUSTOMER FLAT POLKI** has special range 0-1 for flexible pricing
5. **Exact matching** - Product names must match exactly after normalization

---

## Cache Clearing

After updating `diamond_hardcoded_rates.json`, restart the Python service to clear LRU caches:

```bash
# Stop and restart uvicorn
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or call `clear_metal_rate_caches()` function.
