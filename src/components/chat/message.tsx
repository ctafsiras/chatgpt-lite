'use client'

import { memo, useCallback, useDeferredValue, useId, useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { CopyStatusAnnouncement } from '@/components/accessibility/copy-status-announcement'
import {
  InlineCitationBadge,
  SourcesList,
  SourcesToggle,
  useSourcesExpanded
} from '@/components/chat/message-sources-view'
import { renderUserParts } from '@/components/chat/message-user-parts'
import { AnimatedDots } from '@/components/common/animated-dots'
import { AppIconButton } from '@/components/common/app-button'
import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useInViewport } from '@/hooks/useInViewport'
import { getTextFromParts } from '@/lib/chat-attachments'
import type { ChatStreamStatus } from '@/lib/chat-utils'
import type { ChatMessage, ChatMessageSource } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'

import { getSourcesFromParts, stripTrailingSourceMarkdownLinks } from './message-sources'

const Markdown = dynamic(() =>
  import('@/components/markdown/markdown').then((mod) => ({ default: mod.Markdown }))
)

interface MessageProps {
  message: ChatMessage
  isThinking?: boolean
  streamStatus?: ChatStreamStatus
}

function StreamingDots(): React.JSX.Element {
  return (
    <AnimatedDots
      className="inline-flex items-center gap-1.5"
      dotClassName="bg-card-foreground/60"
      activeAnimationClassName="animate-[streaming-bounce_0.9s_ease-in-out_infinite]"
      delayStepMs={150}
      srLabel="Thinking…"
    />
  )
}

function StreamingCursor(): React.JSX.Element {
  const [cursorRef, isInView] = useInViewport<HTMLSpanElement>()

  return (
    <span
      ref={cursorRef}
      aria-hidden="true"
      className={cn(
        'bg-card-foreground/50 pointer-events-none absolute right-3 bottom-3 h-4 w-1 rounded-full motion-reduce:animate-none',
        isInView && 'animate-pulse'
      )}
    />
  )
}

function UserMessage({ message }: MessageProps): React.JSX.Element {
  return (
    <div className="flex w-full justify-end">
      <div className="flex max-w-[90%] min-w-0 flex-col items-end md:max-w-[85%]">
        <div className="bg-secondary text-secondary-foreground max-w-full rounded-2xl rounded-br-md px-4 py-3 break-words shadow-sm hover:shadow-md">
          <div className="text-base leading-relaxed whitespace-pre-wrap">
            {renderUserParts(message.parts)}
          </div>
        </div>
      </div>
    </div>
  )
}

function AssistantMessage({ message, isThinking, streamStatus }: MessageProps): React.JSX.Element {
  const parts = message.parts
  const sources = useMemo(() => getSourcesFromParts(parts), [parts])
  const { copy, copied } = useCopyToClipboard()
  const { expanded: sourcesExpanded, toggle: toggleSources } = useSourcesExpanded()
  const sourceListId = useId()

  const fullText = useMemo(() => getTextFromParts(parts), [parts])
  const deferredText = useDeferredValue(fullText)
  const markdownSource = useMemo(() => {
    return sources.length > 0
      ? stripTrailingSourceMarkdownLinks(deferredText, sources)
      : deferredText
  }, [deferredText, sources])
  const sourceUrlMap = useMemo(() => {
    const urlMap = new Map<string, { index: number; source: ChatMessageSource }>()

    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index]

      if (source.type === 'url') {
        urlMap.set(source.url, { index, source })
      }
    }

    return urlMap
  }, [sources])
  const renderLinkAnnotation = useCallback(
    function renderLinkAnnotation(href: string): ReactNode | null {
      const match = sourceUrlMap.get(href)

      if (!match) {
        return null
      }

      return <InlineCitationBadge index={match.index} source={match.source} />
    },
    [sourceUrlMap]
  )

  const hasCopyText = fullText.trim().length > 0
  const hasRenderedText = deferredText.trim().length > 0
  const showWaitingDots = isThinking && !hasRenderedText
  const showCursor = isThinking && streamStatus === 'streaming' && hasRenderedText

  const handleCopy = useCallback(() => {
    void copy(fullText)
  }, [copy, fullText])

  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[90%] min-w-0 flex-col items-start md:max-w-[85%]">
        <div className="bg-muted text-foreground relative max-w-full rounded-2xl rounded-bl-md px-4 py-3 break-words shadow-sm hover:shadow-md">
          <div className="text-base leading-relaxed">
            {showWaitingDots ? (
              <StreamingDots />
            ) : (
              <Markdown
                renderLinkAnnotation={sourceUrlMap.size > 0 ? renderLinkAnnotation : undefined}
              >
                {markdownSource}
              </Markdown>
            )}
          </div>
          {showCursor && <StreamingCursor />}
        </div>
        {(sources.length > 0 || hasCopyText) && (
          <>
            <div className="mt-1 flex w-full max-w-full items-center">
              {hasCopyText && (
                <>
                  <ButtonWithTooltip label={copied ? 'Copied' : 'Copy'}>
                    <AppIconButton
                      variant="ghost"
                      size="icon-sm"
                      touch={false}
                      mutedDisabled={false}
                      className={cn(
                        'text-muted-foreground size-11 transition-colors duration-200 md:size-7',
                        copied ? 'text-accent-foreground' : 'hover:text-foreground'
                      )}
                      disabled={copied}
                      onClick={handleCopy}
                      aria-label={copied ? 'Message copied to clipboard' : 'Copy to clipboard'}
                    >
                      {copied ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                    </AppIconButton>
                  </ButtonWithTooltip>
                  <CopyStatusAnnouncement copied={copied} message="Message copied to clipboard." />
                </>
              )}
              <SourcesToggle
                sources={sources}
                expanded={sourcesExpanded}
                onToggle={toggleSources}
                sourceListId={sourceListId}
              />
            </div>
            <SourcesList sources={sources} expanded={sourcesExpanded} sourceListId={sourceListId} />
          </>
        )}
      </div>
    </div>
  )
}

function MessageComponent({ message, isThinking, streamStatus }: MessageProps): React.JSX.Element {
  if (message.role === 'user') {
    return <UserMessage message={message} />
  }

  return <AssistantMessage message={message} isThinking={isThinking} streamStatus={streamStatus} />
}

export const Message = memo(MessageComponent)
Message.displayName = 'Message'
