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

function ScrollColumn({ items, className, trackClassName, size = 'sm' }) {
  const doubled = [...items, ...items];
  const sizeClass =
    size === 'xl'
      ? 'text-xl font-bold tracking-[0.14em]'
      : size === 'lg'
        ? 'text-lg font-semibold tracking-[0.15em]'
        : size === 'md'
          ? 'text-base font-medium tracking-[0.16em]'
          : 'text-sm tracking-[0.17em]';

  return (
    <div className={cn('relative h-full overflow-hidden', className)}>
      <div className={cn('flex flex-col gap-6 py-4', trackClassName)}>
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={cn('whitespace-nowrap font-mono uppercase', sizeClass)}
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
    ? 'text-slate-500/[0.38] [text-shadow:0_0_20px_rgba(100,116,139,0.12)]'
    : 'text-slate-700/[0.32] [text-shadow:0_0_16px_rgba(51,65,85,0.1)]';

  const blurTone = isDark
    ? 'text-slate-600/[0.28] blur-[6px]'
    : 'text-slate-600/[0.22] blur-[5px]';

  const floatTone = isDark
    ? 'text-slate-400/[0.42] [text-shadow:0_0_24px_rgba(148,163,184,0.14)]'
    : 'text-slate-700/[0.36] [text-shadow:0_0_20px_rgba(51,65,85,0.12)]';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Layer 4 — blurred symbols (deepest) */}
      <div className="audit-blur-layer absolute inset-[-10%] opacity-80">
        <div className={cn('absolute inset-0 flex flex-wrap content-start gap-x-16 gap-y-10 p-8', blurTone)}>
          {AUDIT_CODES.slice(0, 18).map((code, i) => (
            <span
              key={`blur-${code}`}
              className={cn(
                'font-mono font-light tracking-widest',
                i % 4 === 0 ? 'text-6xl' : i % 2 === 0 ? 'text-5xl' : 'text-4xl'
              )}
              style={{ marginLeft: `${(i % 5) * 12}px` }}
            >
              {SYMBOLS[i % SYMBOLS.length]} {code.split('_')[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Layer 1 — slow vertical scroll */}
      <div className={cn('absolute inset-0 grid grid-cols-4 gap-8 px-4 opacity-100', textTone)}>
        <ScrollColumn items={buildColumnItems(0)} trackClassName="audit-scroll-column" size="lg" />
        <ScrollColumn items={buildColumnItems(7)} trackClassName="audit-scroll-column-fast" size="xl" />
        <ScrollColumn items={buildColumnItems(14)} trackClassName="audit-scroll-column" size="md" />
        <ScrollColumn items={buildColumnItems(21)} trackClassName="audit-scroll-column-fast" size="lg" />
      </div>

      {/* Layer 2 — diagonal scroll */}
      <div
        className={cn(
          'absolute inset-[-20%] rotate-[-14deg] opacity-85',
          textTone
        )}
      >
        <div className="audit-scroll-diagonal grid h-[140%] grid-cols-3 gap-12 px-8">
          <ScrollColumn items={buildColumnItems(3, 20)} trackClassName="audit-scroll-column" size="xl" />
          <ScrollColumn items={buildColumnItems(11, 20)} trackClassName="audit-scroll-column-fast" size="lg" />
          <ScrollColumn items={buildColumnItems(19, 20)} trackClassName="audit-scroll-column" size="xl" />
        </div>
      </div>

      {/* Layer 3 — floating audit codes */}
      <div className={cn('absolute inset-0', floatTone)}>
        {FLOATING_ITEMS.map((item, index) => (
          <span
            key={item.text}
            className={cn(
              'audit-float-item absolute font-mono font-bold tracking-[0.16em]',
              index % 3 === 0 ? 'text-2xl' : index % 2 === 0 ? 'text-xl' : 'text-lg'
            )}
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
            ? 'bg-gradient-to-r from-slate-950/55 via-slate-900/20 to-slate-950/35'
            : 'bg-gradient-to-r from-slate-200/40 via-transparent to-slate-200/25'
        )}
      />
    </div>
  );
}
