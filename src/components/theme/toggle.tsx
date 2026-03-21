'use client'

import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import { Button } from '@/components/ui/button'
import { useHydrated } from '@/hooks/useHydrated'
import { cn } from '@/lib/utils'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function ThemeToggle(): React.JSX.Element | null {
  const { theme, setTheme } = useTheme()
  const mounted = useHydrated()

  if (!mounted) {
    return null
  }

  const isDark = theme === 'dark'
  const nextTheme = isDark ? 'light' : 'dark'

  return (
    <ButtonWithTooltip label={`Switch to ${nextTheme} theme`} placement="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(nextTheme)}
        className="hover:bg-primary/5 relative size-11 overflow-hidden rounded-lg transition-colors duration-200"
        aria-label={`Switch to ${nextTheme} theme`}
      >
        <span className="relative flex size-5 items-center justify-center">
          <Sun
            aria-hidden="true"
            className={cn(
              'absolute size-5 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none',
              isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0'
            )}
          />
          <Moon
            aria-hidden="true"
            className={cn(
              'absolute size-5 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none',
              isDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
            )}
          />
        </span>
      </Button>
    </ButtonWithTooltip>
  )
}
