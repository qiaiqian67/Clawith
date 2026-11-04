import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES } from '../../i18n';
import { wheelIndex, wheelOffset } from './language-wheel-math';
import './language-wheel.css';

/**
 * The language wheel: a loop of languages with one in the centre.
 *
 * Five ways turn it: the arrow buttons, the scroll wheel or a trackpad swipe,
 * a drag, the arrow keys, and a click on a name. The keys work without focus
 * first, because this screen is the whole screen.
 */

const WHEEL_STEP_DELTA = 24;
const WHEEL_STEP_COOLDOWN_MS = 140;
const DRAG_THRESHOLD_PX = 6;

const KEY_STEP: Record<string, number> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

export interface LanguageWheelProps {
  /** The language in the centre. */
  language: string;
  onChange: (language: string) => void;
  /** The brand mark above the wheel. */
  logo?: React.ReactNode;
}

export function LanguageWheel(props: LanguageWheelProps) {
  const { t } = useTranslation();
  const languages = SUPPORTED_LANGUAGES;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState({ active: false, anchor: 0, offset: 0, row: 1 });

  const index = useMemo(
    () => Math.max(0, languages.findIndex((entry) => entry.id === props.language)),
    [languages, props.language],
  );

  const currentLanguage = props.language;
  const onChange = props.onChange;
  const move = useCallback(
    (to: number) => {
      const next = languages[wheelIndex(to, languages.length)];
      if (next && next.id !== currentLanguage) onChange(next.id);
    },
    [currentLanguage, languages, onChange],
  );

  // While dragging, the wheel follows the pointer between rows.
  const position = drag.active ? drag.anchor + drag.offset / drag.row : index;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const rowHeight = () => element.querySelector<HTMLElement>('.zx-wheel-item')?.offsetHeight ?? 1;

    let wheelDelta = 0;
    let wheelLockedUntil = 0;
    function onWheel(event: WheelEvent): void {
      event.preventDefault();
      if (event.timeStamp < wheelLockedUntil) return;
      wheelDelta += event.deltaY;
      if (Math.abs(wheelDelta) < WHEEL_STEP_DELTA) return;
      move(index + Math.sign(wheelDelta));
      wheelDelta = 0;
      wheelLockedUntil = event.timeStamp + WHEEL_STEP_COOLDOWN_MS;
    }

    let pointerId: number | null = null;
    let startY = 0;
    let dragged = false;
    function onPointerDown(event: PointerEvent): void {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      dragged = false;
      setDrag({ active: false, anchor: index, offset: 0, row: rowHeight() });
    }
    function onPointerMove(event: PointerEvent): void {
      if (event.pointerId !== pointerId) return;
      if (event.buttons === 0) {
        onPointerEnd(event);
        return;
      }
      const travel = startY - event.clientY;
      if (!dragged && Math.abs(travel) < DRAG_THRESHOLD_PX) return;
      if (!dragged) {
        dragged = true;
        element?.setPointerCapture(event.pointerId);
      }
      setDrag({ active: true, anchor: drag.anchor, offset: travel, row: drag.row });
      move(drag.anchor + Math.round(travel / drag.row));
    }
    function onPointerEnd(event: PointerEvent): void {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      setDrag((state) => ({ ...state, active: false, offset: 0 }));
    }
    function onClickCapture(event: MouseEvent): void {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        return;
      }
      const step = KEY_STEP[event.key];
      let to: number;
      if (event.key === 'Home') to = 0;
      else if (event.key === 'End') to = languages.length - 1;
      else if (step !== undefined) to = wheelIndex(index + step, languages.length);
      else return;
      event.preventDefault();
      move(to);
    }

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerEnd);
    element.addEventListener('pointercancel', onPointerEnd);
    element.addEventListener('click', onClickCapture, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drag.anchor, drag.row, index, languages.length, move]);

  return (
    <main className="zx-wheel-screen" lang={props.language}>
      <div className="zx-wheel-shell">
        <header className="zx-wheel-lockup">
          {props.logo}
          <span className="zx-wheel-wordmark">ZeroX</span>
        </header>

        <h1 className="zx-wheel-title">{t('language.title')}</h1>

        <div className="zx-wheel-frame">
          <div className="zx-wheel" ref={viewportRef} data-dragging={drag.active ? '' : undefined}>
            {languages.map((entry, row) => {
              const offset = wheelOffset(row, position, languages.length);
              const distance = Math.min(3, Math.abs(offset));
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="zx-wheel-item"
                  data-active={offset === 0 ? 'true' : undefined}
                  aria-current={offset === 0 ? 'true' : undefined}
                  style={
                    {
                      '--offset': offset,
                      '--distance': distance,
                    } as React.CSSProperties
                  }
                  onClick={() => move(row)}
                >
                  <span className="zx-wheel-flag" aria-hidden="true">
                    {entry.flag}
                  </span>
                  <span className="zx-wheel-name">{entry.nativeLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="zx-wheel-arrows">
            <button
              type="button"
              className="zx-wheel-arrow"
              aria-label={t('language.continue')}
              onClick={() => move(index - 1)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className="zx-wheel-arrow"
              aria-label={t('language.continue')}
              onClick={() => move(index + 1)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
