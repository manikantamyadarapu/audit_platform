import { cn } from '../../utils/cn';

const AUDIT_CODES = [
  'PAN_VALIDATION',
  'FORM_60',
  'GROSS_WEIGHT_MISMATCH',
  'RATE_DEVIATION',
  'LEDGER_VERIFICATION',
  'GST_CHECK',
  'VOUCHER_MATCHING',
  'INVOICE_VALIDATION',
  'COMPLIANCE_SCORE',
  'AUDIT_ENGINE',
  'RISK_ANALYSIS',
  'KYC_VERIFICATION',
  'INTERNAL_CONTROL',
  'AAAPL1234Q',
  'ABCDE1234F',
  'JH/2526/001',
  '₹2,00,000',
  'PASS',
  'FAILED',
  'VERIFIED',
  'VALIDATED',
  'SCRUTINY_RUN',
  'RATE_RULE_BOOK',
  'SALES_RETURN',
  'ID_PROOF_CHECK',
  'WEIGHT_DELTA',
  'VOUCHER_NO',
  'LEDGER_BAL',
  'GSTIN_MATCH',
  'COMPLIANCE_OK',
];

const SYMBOLS = ['◈', '▣', '◎', '◇', '▤', '✓', '×', '◉', '▦', '⬡'];

const FLOATING_ITEMS = [
  { text: 'AUDIT_ENGINE', top: '12%', left: '8%', delay: '0s', duration: '16s' },
  { text: 'PASS', top: '28%', left: '72%', delay: '2s', duration: '13s' },
  { text: 'AAAPL1234Q', top: '44%', left: '18%', delay: '4s', duration: '18s' },
  { text: 'COMPLIANCE_SCORE', top: '58%', left: '55%', delay: '1s', duration: '15s' },
  { text: 'VERIFIED', top: '72%', left: '32%', delay: '3s', duration: '17s' },
  { text: 'JH/2526/001', top: '82%', left: '68%', delay: '5s', duration: '14s' },
  { text: 'RATE_DEVIATION', top: '36%', left: '42%', delay: '6s', duration: '19s' },
  { text: 'VALIDATED', top: '18%', left: '48%', delay: '2.5s', duration: '16s' },
];

function buildColumnItems(seed, count = 24) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const code = AUDIT_CODES[(seed + i) % AUDIT_CODES.length];
    const symbol = SYMBOLS[(seed + i * 3) % SYMBOLS.length];
    const showSymbol = i % 3 === 0;
    items.push(showSymbol ? `${symbol}  ${code}` : code);
  }
  return items;
}

function ScrollColumn({ items, className, trackClassName }) {
  const doubled = [...items, ...items];

  return (
    <div className={cn('relative h-full overflow-hidden', className)}>
      <div className={cn('flex flex-col gap-5 py-4', trackClassName)}>
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="whitespace-nowrap font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AuditIntelligenceBackground({ isDark }) {
  const textTone = isDark
    ? 'text-emerald-400/[0.09] [text-shadow:0_0_20px_rgba(16,185,129,0.08)]'
    : 'text-emerald-700/[0.08] [text-shadow:0_0_16px_rgba(16,185,129,0.06)]';

  const blurTone = isDark
    ? 'text-emerald-300/[0.06] blur-[6px]'
    : 'text-emerald-600/[0.05] blur-[5px]';

  const floatTone = isDark
    ? 'text-emerald-400/[0.1] [text-shadow:0_0_24px_rgba(16,185,129,0.12)]'
    : 'text-emerald-700/[0.09] [text-shadow:0_0_20px_rgba(16,185,129,0.08)]';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Layer 4 — blurred symbols (deepest) */}
      <div className="audit-blur-layer absolute inset-[-10%] opacity-80">
        <div className={cn('absolute inset-0 flex flex-wrap content-start gap-x-16 gap-y-10 p-8', blurTone)}>
          {AUDIT_CODES.slice(0, 18).map((code, i) => (
            <span
              key={`blur-${code}`}
              className="font-mono text-2xl font-light tracking-widest"
              style={{ marginLeft: `${(i % 5) * 12}px` }}
            >
              {SYMBOLS[i % SYMBOLS.length]} {code.split('_')[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Layer 1 — slow vertical scroll */}
      <div className={cn('absolute inset-0 grid grid-cols-4 gap-6 px-6 opacity-90', textTone)}>
        <ScrollColumn items={buildColumnItems(0)} trackClassName="audit-scroll-column" />
        <ScrollColumn items={buildColumnItems(7)} trackClassName="audit-scroll-column-fast" />
        <ScrollColumn items={buildColumnItems(14)} trackClassName="audit-scroll-column" />
        <ScrollColumn items={buildColumnItems(21)} trackClassName="audit-scroll-column-fast" />
      </div>

      {/* Layer 2 — diagonal scroll */}
      <div
        className={cn(
          'absolute inset-[-20%] rotate-[-14deg] opacity-70',
          textTone
        )}
      >
        <div className="audit-scroll-diagonal grid h-[140%] grid-cols-3 gap-10 px-12">
          <ScrollColumn items={buildColumnItems(3, 20)} trackClassName="audit-scroll-column" />
          <ScrollColumn items={buildColumnItems(11, 20)} trackClassName="audit-scroll-column-fast" />
          <ScrollColumn items={buildColumnItems(19, 20)} trackClassName="audit-scroll-column" />
        </div>
      </div>

      {/* Layer 3 — floating audit codes */}
      <div className={cn('absolute inset-0', floatTone)}>
        {FLOATING_ITEMS.map((item) => (
          <span
            key={item.text}
            className="audit-float-item absolute font-mono text-xs font-medium tracking-[0.2em]"
            style={{
              top: item.top,
              left: item.left,
              animationDelay: item.delay,
              animationDuration: item.duration,
            }}
          >
            {item.text}
          </span>
        ))}
      </div>

      {/* Depth vignette */}
      <div
        className={cn(
          'absolute inset-0',
          isDark
            ? 'bg-gradient-to-r from-slate-950/40 via-transparent to-slate-950/20'
            : 'bg-gradient-to-r from-emerald-50/50 via-transparent to-emerald-50/30'
        )}
      />
    </div>
  );
}
