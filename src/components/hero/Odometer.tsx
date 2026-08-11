import { useEffect, useRef, useState } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A single rolling digit.
 *
 * The invisible `0` is a strut, and it does two jobs that are otherwise fiddly:
 * it gives the cell the font's own digit width (so no measuring, and proportional
 * figures are preserved), and it gives the cell a real text baseline. Without it an
 * `overflow: hidden` inline-block baselines on its bottom margin edge, which drops
 * commas and decimals well below the digits sitting beside them.
 *
 * The strip is ten cells tall, so one cell of travel is 10% of its own height.
 */
function Digit({ value }: { value: number }) {
  return (
    <span className="relative inline-block overflow-hidden" aria-hidden="true">
      <span className="invisible">0</span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateY(${-value * 10}%)` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] text-center leading-[1em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Animated numeric display.
 *
 * Requires a line-height of 1 on the surrounding text so a cell is exactly 1em tall
 * and the strip's per-cell travel lines up; `leading-none` is set here rather than
 * left to the caller.
 */
export function Odometer({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`leading-none ${className ?? ''}`}>
      {/* Screen readers and copy-paste get the plain number; the roll is decorative. */}
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="select-none">
        {value.split('').map((char, i) =>
          /\d/.test(char) ? (
            <Digit key={i} value={Number(char)} />
          ) : (
            /*
              Optical correction for the separators. Instrument Serif's comma has a
              long, low descender that at display sizes reads as a dropped glyph
              rather than punctuation. Nudged up a fraction of an em — the face is
              left alone, only its placement beside the digits is adjusted.
            */
            <span key={i} className="inline-block" style={{ transform: 'translateY(-0.06em)' }}>
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

/** Fires briefly whenever the value rises — used to pulse the bloom behind the hero. */
export function useIncreasePulse(value: number): boolean {
  const previous = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (value > previous.current) {
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 1800);
      previous.current = value;
      return () => clearTimeout(id);
    }
    previous.current = value;
    return undefined;
  }, [value]);

  return pulsing;
}
