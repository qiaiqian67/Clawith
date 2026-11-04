/**
 * The geometry of the language wheel.
 *
 * The wheel is a loop, so it has no first row and no last row. These two
 * functions are the whole rule, and they carry no state, so they can be
 * checked on their own.
 */

/** The row index of the wheel, wrapped into its range. */
export function wheelIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/**
 * How far a row sits from the centre.
 *
 * The rows from the centre to one half of the wheel are measured the short
 * way round. The row at the far side jumps to the other end, and it is
 * invisible there.
 */
export function wheelOffset(row: number, position: number, length: number): number {
  return wheelIndex(row - position + length / 2, length) - length / 2;
}
