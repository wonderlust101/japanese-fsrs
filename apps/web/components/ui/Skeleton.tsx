interface SkeletonProps {
  className?: string
  width?:     string | number
  height?:    string | number
}

/**
 * Shimmering skeleton block. Tinted toward the warm-paper neutrals so the
 * skeleton reads as "data loading" without leaving Tomo's quiet palette.
 *
 * The visible shimmer comes from `.dashboard-skeleton` in `globals.css`.
 * Width / height accept either numbers (treated as px) or any CSS length
 * string (`'80%'`, `'min(440px, 92%)'`).
 */
export function Skeleton({
  className = '',
  width,
  height,
}: SkeletonProps): React.JSX.Element {
  const style: React.CSSProperties = {}
  if (width  !== undefined) style.width  = typeof width  === 'number' ? `${width}px`  : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      aria-hidden="true"
      className={`dashboard-skeleton rounded-[2px] ${className}`}
      style={style}
    />
  )
}
