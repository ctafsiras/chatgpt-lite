'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { getDomain, getSourceTitle } from '@/components/chat/message-sources'
import { AppButton } from '@/components/common/app-button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { ChatMessageSource } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronDown, FileText, Globe } from 'lucide-react'

function Favicon({ domain }: { domain: string }): React.JSX.Element {
  const [hasError, setHasError] = useState(() => domain.length === 0)
  const fallbackLabel = domain.charAt(0).toUpperCase() || '?'

  if (hasError) {
    return (
      <span className="bg-muted text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium uppercase">
        {fallbackLabel}
      </span>
    )
  }

  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      width={16}
      height={16}
      unoptimized
      loading="lazy"
      sizes="16px"
      className="size-4 shrink-0 rounded-sm"
      onError={() => setHasError(true)}
    />
  )
}

export function InlineCitationBadge({
  index,
  source
}: {
  index: number
  source: ChatMessageSource
}): React.JSX.Element {
  const title = getSourceTitle(source)
  const url = source.type === 'url' ? source.url : ''
  const domain = url ? getDomain(url) : ''
  const documentSubtitle = source.type === 'document' ? source.filename || source.mediaType : ''

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Source ${index + 1}: ${title}`}
          className="bg-accent text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-offset-background hover:bg-accent/90 ml-1 inline-flex size-4 items-center justify-center rounded-full align-super text-[10px] font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {index + 1}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={8} className="flex w-72 flex-col gap-2 p-3">
        <div className="flex flex-col gap-1.5">
          <div className="line-clamp-2 text-sm font-semibold">{title}</div>
          {source.type === 'url' ? (
            <>
              {domain ? <div className="text-muted-foreground text-xs">{domain}</div> : null}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary focus-visible:ring-ring/50 focus-visible:ring-offset-background block rounded-sm text-xs break-all underline underline-offset-2 hover:decoration-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {url}
              </a>
            </>
          ) : (
            <>
              {documentSubtitle ? (
                <div className="text-muted-foreground text-xs break-all">{documentSubtitle}</div>
              ) : null}
              <div className="text-muted-foreground text-xs">{source.mediaType}</div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function useSourcesExpanded() {
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((v) => !v), [])
  return { expanded, toggle }
}

export function SourcesToggle({
  sources,
  expanded,
  onToggle,
  sourceListId
}: {
  sources: ChatMessageSource[]
  expanded: boolean
  onToggle: () => void
  sourceListId: string
}): React.JSX.Element | null {
  if (sources.length === 0) return null

  const sourceCountLabel = `${sources.length} source${sources.length === 1 ? '' : 's'}`

  return (
    <AppButton
      type="button"
      variant="ghost"
      size="sm"
      touch={false}
      mutedDisabled={false}
      aria-expanded={expanded}
      aria-controls={sourceListId}
      onClick={onToggle}
      className="text-muted-foreground hover:text-foreground h-11 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium md:h-7 md:px-1 md:py-0.5"
    >
      <Globe className="size-3.5" aria-hidden="true" />
      <span>{sourceCountLabel}</span>
      <ChevronDown
        className={cn(
          'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
          expanded && 'rotate-180'
        )}
        aria-hidden="true"
      />
    </AppButton>
  )
}

export function SourcesList({
  sources,
  expanded,
  sourceListId
}: {
  sources: ChatMessageSource[]
  expanded: boolean
  sourceListId: string
}): React.JSX.Element | null {
  if (sources.length === 0) return null

  return (
    <div className={cn('grid w-full max-w-full', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div className="overflow-hidden">
        <div id={sourceListId} aria-hidden={!expanded} className="mt-1 flex flex-col gap-1">
          {sources.map((source) => {
            const title = getSourceTitle(source)

            if (source.type === 'url') {
              const domain = getDomain(source.url)

              return (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={expanded ? undefined : -1}
                  className="focus-visible:ring-ring/50 focus-visible:ring-offset-background hover:bg-accent/50 flex min-h-11 w-full max-w-full items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:min-h-7 md:px-1 md:py-1"
                >
                  <Favicon key={domain} domain={domain} />
                  <div className="text-foreground min-w-0 flex-1 truncate font-medium">{title}</div>
                  <div className="text-muted-foreground max-w-[45%] shrink-0 truncate">
                    {domain || source.url}
                  </div>
                </a>
              )
            }

            return (
              <div
                key={source.id}
                className="flex w-full max-w-full items-center gap-2 px-1 py-1 text-xs"
              >
                <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <div className="text-foreground min-w-0 flex-1 truncate font-medium">{title}</div>
                <div className="text-muted-foreground max-w-[45%] shrink-0 truncate">
                  {source.filename || source.mediaType}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
