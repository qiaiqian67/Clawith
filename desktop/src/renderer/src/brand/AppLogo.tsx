/**
 * The ZeroX mark: a rounded square in the brand violet with two eyes.
 *
 * The eyes follow the pointer when the logo is interactive, so the mark reads
 * as alive on the first screen. The reduced-motion preference turns that off.
 */
import { useCallback, useRef } from 'react';

export interface AppLogoProps {
  /** The brand colour of this build. */
  variant?: 'production' | 'dev' | 'preview';
  /** Whether the eyes follow the pointer. */
  interactive?: boolean;
  className?: string;
}

const EYE_RANGE = { x: 2.4, y: 1.8 };

export function AppLogo(props: AppLogoProps) {
  const variant = props.variant ?? 'production';
  const svgRef = useRef<SVGSVGElement | null>(null);

  const lookAt = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!props.interactive) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const svg = svgRef.current;
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const dx = (event.clientX - centerX) / (bounds.width / 2);
      const dy = (event.clientY - centerY) / (bounds.height / 2);
      svg.style.setProperty('--zx-logo-eye-x', `${dx * EYE_RANGE.x}%`);
      svg.style.setProperty('--zx-logo-eye-y', `${dy * EYE_RANGE.y}%`);
    },
    [props.interactive],
  );

  const resetEyes = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.style.setProperty('--zx-logo-eye-x', '0%');
    svg.style.setProperty('--zx-logo-eye-y', '0%');
  }, []);

  return (
    <svg
      ref={svgRef}
      className={['zx-app-logo', props.className].filter(Boolean).join(' ')}
      data-variant={variant}
      viewBox="0 0 64 64"
      width="48"
      height="48"
      role="img"
      aria-label="ZeroX"
      onPointerMove={lookAt}
      onPointerLeave={resetEyes}
    >
      <rect width="64" height="64" rx="14" fill="var(--zx-logo-production)" />
      <circle cx="24" cy="32" r="7" fill="var(--zx-logo-eye)" />
      <circle cx="40" cy="32" r="7" fill="var(--zx-logo-eye)" />
    </svg>
  );
}
