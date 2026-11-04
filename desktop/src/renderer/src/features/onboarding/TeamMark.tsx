/**
 * The team of marks above the first-run question.
 *
 * The marks stand in an arc: the biggest in the middle, the smallest at the
 * ends. Each one rises as it appears, so the group reads as arriving.
 */

const MARKS = [
  { size: 40, color: '#f0a06a', offset: 24, delay: 0 },
  { size: 46, color: '#d98ac9', offset: 8, delay: 1 },
  { size: 68, color: '#7c5cff', offset: 0, delay: 2 },
  { size: 104, color: '#7c5cff', offset: -12, delay: 3 },
  { size: 68, color: '#6bc7d9', offset: 0, delay: 4 },
  { size: 46, color: '#31cf76', offset: 8, delay: 5 },
  { size: 40, color: '#74b9ff', offset: 24, delay: 6 },
];

export function TeamMark() {
  return (
    <div className="zx-team" aria-hidden="true">
      {MARKS.map((mark, index) => (
        <span
          key={index}
          className="zx-team-mark"
          style={
            {
              '--zx-mark-size': `${mark.size}px`,
              '--zx-mark-offset': `${mark.offset}px`,
              '--zx-mark-delay': `${mark.delay * 90}ms`,
              '--zx-mark-color': mark.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
