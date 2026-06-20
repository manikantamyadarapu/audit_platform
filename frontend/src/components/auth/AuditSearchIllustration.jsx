import { motion, useReducedMotion } from 'framer-motion';
import { Search } from 'lucide-react';

const ACCENT = '#34D399';
const ACCENT_SOFT = '#34D399';
const RADAR_DURATION = 4;
const RIPPLE_COUNT = 5;
const RIPPLE_STAGGER = 0.5;

/** Search icon container is 38% of the scanner — pulse starts at its outer edge. */
const SEARCH_ICON_SIZE_RATIO = 0.38;
const VIEWBOX_CENTER = 100;
const SEARCH_OUTER_R = VIEWBOX_CENTER * SEARCH_ICON_SIZE_RATIO;
const PULSE_END_R = 98;
const STATIC_RING_RADII = [42, 54, 66, 78, 90, 98];

const smoothEase = [0.22, 1, 0.36, 1];

const SCAN_NODES = [
  { angle: 25, radius: 78, delay: 0 },
  { angle: 130, radius: 92, delay: 0.8 },
  { angle: 220, radius: 66, delay: 1.6 },
  { angle: 310, radius: 88, delay: 2.2 },
];

const ORBIT_R = 94;

function nodePosition(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return {
    cx: 100 + radius * Math.cos(rad),
    cy: 100 + radius * Math.sin(rad),
  };
}

function RadarSvg({ animated = true }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" aria-hidden="true">
      {/* Static rings — outside search icon only */}
      {STATIC_RING_RADII.map((radius, index) => (
        <circle
          key={`static-${radius}`}
          cx={VIEWBOX_CENTER}
          cy={VIEWBOX_CENTER}
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth="0.6"
          opacity={0.05 + index * 0.01}
        />
      ))}

      {/* Pulse rings — expand outward from search icon outer edge */}
      {animated
        ? Array.from({ length: RIPPLE_COUNT }, (_, index) => (
            <motion.circle
              key={`ripple-${index}`}
              cx={VIEWBOX_CENTER}
              cy={VIEWBOX_CENTER}
              fill="none"
              stroke={ACCENT}
              strokeWidth="0.8"
              initial={{ r: SEARCH_OUTER_R, opacity: 0 }}
              animate={{ r: [SEARCH_OUTER_R, PULSE_END_R], opacity: [0.18, 0] }}
              transition={{
                duration: RADAR_DURATION,
                repeat: Infinity,
                delay: index * RIPPLE_STAGGER,
                ease: smoothEase,
              }}
            />
          ))
        : null}

      {animated
        ? SCAN_NODES.map((node, index) => {
            const { cx, cy } = nodePosition(node.angle, node.radius);
            return (
              <motion.circle
                key={`node-${index}`}
                cx={cx}
                cy={cy}
                r="2"
                fill={ACCENT}
                animate={{ opacity: [0.12, 0.35, 0.12], scale: [1, 1.35, 1] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  delay: node.delay,
                  ease: 'easeInOut',
                }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
            );
          })
        : null}

      {animated ? (
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        >
          <circle cx="100" cy={100 - ORBIT_R} r="2.5" fill={ACCENT_SOFT} opacity="0.5" />
          <circle
            cx="100"
            cy={100 - ORBIT_R}
            r="5.5"
            fill={ACCENT_SOFT}
            opacity="0.12"
            style={{ filter: 'blur(2px)' }}
          />
        </motion.g>
      ) : null}
    </svg>
  );
}

/**
 * Audit scanner — rings start outside the search icon and expand to fill the left panel.
 */
export function AuditSearchIllustration() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-visible select-none"
      aria-hidden="true"
    >
      {/* Full panel scanner — oversized to fill left half */}
      <div className="relative aspect-square w-[min(48vw,760px)] xl:w-[min(52vw,820px)]">
        <div className="absolute inset-0 z-0">
          <RadarSvg animated={!reduceMotion} />
        </div>

        {/* Search icon — fixed, no animation */}
        <div className="absolute left-1/2 top-1/2 z-10 flex h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-200/25 blur-2xl" aria-hidden="true" />
          <Search
            className="relative h-full w-full -rotate-2 text-emerald-300 opacity-[0.35] dark:text-emerald-200 dark:opacity-[0.28]"
            strokeWidth={1.25}
          />
        </div>
      </div>
    </div>
  );
}
