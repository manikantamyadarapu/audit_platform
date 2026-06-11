# Sales Audit - Validation Rules

## 1. Products

### Gold Products (GRAMS UOM)
| Product | UOM |
|---------|-----|
| Gold Ornaments 14K | GRAMS |
| Gold Ornaments 18K | GRAMS |
| Customer Gold Ornaments 18K | GRAMS |
| Customer Gold Ornaments 22K | GRAMS |
| Gold Ornaments 22K | GRAMS |
| Gold Ornaments Jadau | GRAMS |
| Standard Gold 24K | GRAMS |

### Silver Products (GRAMS UOM)
| Product | UOM |
|---------|-----|
| Silver articles | GRAMS |

### Accessory Products (GRAMS UOM + Unit Rate 0-1)
| Product | UOM | Unit Rate Range |
|---------|-----|-----------------|
| Black beads | GRAMS | 0 to 1 |
| Dori | GRAMS | 0 to 1 |
| Lac | GRAMS | 0 to 1 |
| Wax, Dori Etc | GRAMS | 0 to 1 |
| Wax | GRAMS | 0 to 1 |
| Nail | GRAMS | 0 to 1 |



### Diamond Products (CARATS UOM)
| Product Pattern | Min Rate | Max Rate |
|-----------------|----------|----------|
| DI. RA 10 | 10,000 | 15,000 |
| DI. RA 15 | 15,000 | 20,000 |
| DI. RA 20 | 20,000 | 25,000 |
| DI. RA 25 | 25,000 | 30,000 |
| DI. RA 30 | 30,000 | 35,000 |
| DI. RA 40 | 40,000 | 45,000 |
| DI. RA 50 | 50,000 | 60,000 |
| DI. RA 60 | 60,000 | 70,000 |
| DI. RA 70 | 70,000 | 80,000 |
| DI. RA 80 | 80,000 | 90,000 |
| DI. RA 90 | 90,000 | 100,000 |
| DI. RA 100-190 | +10,000 steps | Range ±5,000-10,000 |
| DI. RC 1-26 | 14,000-135,000 | Fixed rates |
| DIAMONDS LOOSE DI. RA 10-190 | 5,000-200,000 | Varies by grade |
| DIAMONDS LOOSE DI. SD 200-275 | 200,000-300,000 | Varies |
| FLAT POLKI FP 1-20 | 5,500-75,000 | Fixed rates |
| POLKI A-D | 2,500-8,000 | Fixed rates |

### Gemstone Products (CARATS UOM)
| Account | Products | Slab Rates |
|---------|----------|------------|
| JEWELS SALES ACCOUNT - COLOR STONES | Customer Stones, Precious Stones | 50-3000 |

### Pearl Products (GRAMS UOM)
| Product Pattern | UOM |
|-----------------|-----|
| Pearls | GRAMS |
| Pearls JPS [Number] | GRAMS |

---

## 2. Prices / Rates

### Gold & Silver Rates
- Source: User editable via Rate Rule Book
- Deviation: ±15%

### Diamond Rates
- Source: Hardcoded JSON config
- Deviation: ±15%
- Uplift: +25% on min rate

### Gemstone Rates
- Source: Slab prices in product name
- Deviation: ±15%

---

## 3. UOM Validation

### Expected UOM by Product
| Product Type | Expected UOM |
|--------------|--------------|
| Gold Ornaments | GRAMS |
| Silver articles | GRAMS |
| Diamonds | CARATS |
| Gemstones | CARATS |
| Lac/Dori/Wax/Nail | GRAMS |
| Black beads | GRAMS |
| Pearls | GRAMS |

### Valid UOM Inputs
| Input | Normalized To |
|-------|---------------|
| Grams, Gram, Gms, Gm, G | GRAMS |
| Carats, Carat, Cts, Crt, Ct | CARATS |

### Validation Rule
```
IF invoice_uom != expected_uom THEN INVALID_UOM
```

---

## 4. Unit Rate Range Validation (Lac/Dori Special Rule)

### Products Affected
- Lac
- Dori
- Black beads
- Wax
- Wax, Dori Etc
- Nail

### Validation Rule
```
IF product IN [Lac, Dori, Black beads, Wax, Nail]
   AND unit_rate NOT BETWEEN 0 AND 1
THEN INVALID_UNIT_RATE_RANGE
```

### Valid Range
- Min: 0 (inclusive)
- Max: 1 (inclusive)
- NULL values: Skip (handled by missing rate validation)

---

## 5. Issue Types

| Issue Code | Description |
|------------|-------------|
| INVALID_PRODUCT_MAPPING | Product not found in catalog |
| INVALID_UOM | UOM does not match expected value |
| INVALID_RATE_DEVIATION | Unit rate outside allowed deviation |
| INVALID_UNIT_RATE_RANGE | Unit rate not between 0-1 for accessory products |
| MISSING_RATE_RULE | No rate rule found for product |
| MISSING_UNIT_RATE | Unit rate is NULL or empty |
| RATE_DEVIATION_VIOLATION | Rate exceeds ±threshold% |
