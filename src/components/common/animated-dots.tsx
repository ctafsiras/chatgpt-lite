import { useInViewport } from '@/hooks/useInViewport'
import { cn } from '@/lib/utils'

type AnimatedDotsProps = {
  className?: string
  dotClassName?: string
  activeAnimationClassName: string
  delayStepMs?: number
  srLabel?: string
  ariaHidden?: boolean
}

const DOT_INDEXES = [0, 1, 2] as const
const BASE_DOT_CLASS = 'size-1.5 rounded-full motion-reduce:animate-none'

export function AnimatedDots({
  className,
  dotClassName,
  activeAnimationClassName,
  delayStepMs = 150,
  srLabel,
  ariaHidden
}: AnimatedDotsProps): React.JSX.Element {
  const [dotsRef, isInView] = useInViewport<HTMLSpanElement>()

  return (
    <span ref={dotsRef} className={className} aria-hidden={ariaHidden}>
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
      {DOT_INDEXES.map((index) => (
        <span
          key={index}
          className={cn(BASE_DOT_CLASS, dotClassName, isInView && activeAnimationClassName)}
          style={{ animationDelay: `${index * delayStepMs}ms` }}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
