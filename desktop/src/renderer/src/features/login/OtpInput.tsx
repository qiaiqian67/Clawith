import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './otp-input.css';

/**
 * The one-time code entry: a row of slots with one hidden input over them.
 *
 * The native input keeps the code as its value, so the platform's autofill
 * and the keyboard suggestions work. The slots draw what the input holds.
 */

export type OtpInputStatus = 'idle' | 'verifying' | 'error' | 'success';

export interface OtpInputProps {
  value: string;
  length?: number;
  numeric?: boolean;
  label?: string;
  status?: OtpInputStatus;
  hint?: string;
  errorMessage?: string | null;
  successMessage?: string;
  disabled?: boolean;
  autofocus?: boolean;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
}

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function OtpInput(props: OtpInputProps) {
  const length = props.length ?? 6;
  const alphabet = props.numeric ? '0123456789' : ALPHABET;
  const [slots, setSlots] = useState<string[]>(() => toSlots(props.value, length, alphabet));
  const [active, setActive] = useState(() => firstEmptySlot(slots, length));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const completeAfterComposition = useRef(false);

  const status = props.status ?? 'idle';
  const disabled = Boolean(props.disabled || status === 'verifying' || status === 'success');

  const message = useMemo(() => {
    if (status === 'success') return props.successMessage ?? '';
    if (status === 'error') return props.errorMessage ?? '';
    if (status === 'verifying') return '';
    return props.hint;
  }, [props.errorMessage, props.hint, props.successMessage, status]);

  // The value from outside is the authority. The slots are derived from it
  // while the user types, and they follow it when the caller replaces it.
  const incoming = sanitize(props.value, length, alphabet);
  const typed = slots.join('');
  if (incoming !== typed) {
    const next = toSlots(incoming, length, alphabet);
    setSlots(next);
    setActive(firstEmptySlot(next, length));
  }

  useEffect(() => {
    if (!props.autofocus || disabled) return;
    queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }));
  }, [disabled, props.autofocus]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const value = slots.join('');
    if (input.value !== value) {
      input.value = value;
      input.setSelectionRange(value.length, value.length);
    }
  }, [slots]);

  const commit = useCallback(
    (next: string[]) => {
      const previous = slots.join('');
      setSlots(next);
      const value = next.join('');
      props.onChange(value);
      if (value === previous) return;
      const complete = next.every(Boolean);
      if (composing.current) {
        completeAfterComposition.current = complete;
        return;
      }
      if (complete) {
        props.onComplete?.(value);
        inputRef.current?.focus({ preventScroll: true });
      }
    },
    [props, slots],
  );

  const insert = useCallback(
    (raw: string, from = active) => {
      const characters = sanitize(raw, length, alphabet);
      if (!characters) return;
      const next = [...slots];
      let index = from;
      for (const character of characters) {
        if (index >= length) break;
        next[index] = character;
        index += 1;
      }
      commit(next);
      setActive(Math.min(index, length - 1));
    },
    [active, alphabet, commit, length, slots],
  );

  const clearSlot = useCallback(
    (index: number) => {
      const next = [...slots];
      next[index] = '';
      commit(next);
    },
    [commit, slots],
  );

  const backspace = useCallback(() => {
    if (slots[active]) {
      clearSlot(active);
      return;
    }
    if (active > 0) {
      const previous = active - 1;
      clearSlot(previous);
      setActive(previous);
    }
  }, [active, clearSlot, slots]);

  const handleInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      if (disabled) return;
      const typed = sanitize(input.value.slice(input.value.length - 1), length, alphabet);
      const whole = sanitize(input.value, length, alphabet);
      if (whole.length === length && whole !== slots.join('')) {
        commit(toSlots(whole, length, alphabet));
        setActive(length - 1);
        return;
      }
      if (typed.length === 1) {
        insert(typed);
        return;
      }
      commit(toSlots(whole, length, alphabet));
    },
    [alphabet, commit, disabled, insert, length, slots],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toUpperCase();
      if (key.length === 1 && alphabet.includes(key)) {
        event.preventDefault();
        insert(key);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        clearSlot(active);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActive((index) => Math.min(index + 1, length - 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActive(length - 1);
      }
    },
    [active, alphabet, backspace, clearSlot, disabled, insert, length],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-otp-index]');
      const requested = slot ? Number.parseInt(slot?.dataset.otpIndex ?? '0', 10) : 0;
      setActive(Math.min(Math.max(Number.isFinite(requested) ? requested : 0, 0), length - 1));
      inputRef.current?.focus();
    },
    [disabled, length],
  );

  return (
    <div className="zx-otp" data-status={status}>
      <div
        className="zx-otp-fieldset"
        role="group"
        aria-label={props.label ?? 'code'}
        aria-disabled={disabled ? 'true' : undefined}
        onPointerDown={handlePointerDown}
      >
        <input
          ref={inputRef}
          className="zx-otp-native"
          type="text"
          inputMode={props.numeric ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label={props.label ?? 'code'}
          aria-invalid={status === 'error' ? 'true' : undefined}
          readOnly={Boolean(props.disabled || status === 'success')}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
            const pending = completeAfterComposition.current;
            completeAfterComposition.current = false;
            if (!disabled && pending) props.onComplete?.(slots.join(''));
          }}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />

        <div className="zx-otp-slots">
          {slots.map((character, index) => (
            <span
              key={index}
              className="zx-otp-slot"
              data-active={focused && index === active ? 'true' : undefined}
              data-filled={character ? 'true' : undefined}
              data-otp-index={index}
            >
              {character || (focused && index === active ? <span className="zx-otp-caret" /> : null)}
            </span>
          ))}
        </div>
      </div>

      {message ? (
        <p className="zx-otp-message" role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

function sanitize(value: string, length: number, alphabet: string): string {
  return value
    .toUpperCase()
    .split('')
    .filter((character) => alphabet.includes(character))
    .join('')
    .slice(0, length);
}

function toSlots(value: string, length: number, alphabet: string): string[] {
  const characters = sanitize(value, length, alphabet);
  return Array.from({ length }, (_, index) => characters[index] ?? '');
}

function firstEmptySlot(slots: string[], length: number): number {
  const index = slots.findIndex((character) => !character);
  return index === -1 ? length - 1 : index;
}
