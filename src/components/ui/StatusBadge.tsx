export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

interface StatusBadgeProps {
  tone: BadgeTone
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function StatusBadge({ tone, children, icon, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`badge gap-1 ${className}`}
      style={{ background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-ink)` }}
    >
      {icon}
      {children}
    </span>
  )
}
