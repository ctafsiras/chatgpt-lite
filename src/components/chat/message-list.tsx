'use client'

import { Message } from '@/components/chat/message'
import { AppIconButton } from '@/components/common/app-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { findLastMessageIndex, isStreamingStatus, type ChatStreamStatus } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/types'
import { AlertCircle, X } from 'lucide-react'

interface MessageListProps {
  messages: ChatMessage[]
  streamStatus?: ChatStreamStatus
  error?: string | null
  onDismissError?: () => void
}

export function MessageList({
  messages,
  streamStatus,
  error,
  onDismissError
}: MessageListProps): React.JSX.Element {
  const isStreaming = isStreamingStatus(streamStatus)
  const lastAssistantIndex = isStreaming ? findLastMessageIndex(messages, 'assistant') : -1

  return (
    <div className="flex flex-col gap-5">
      {messages.map((item, index) => (
        <div key={item.id} className="[contain-intrinsic-size:auto_80px] [content-visibility:auto]">
          <Message
            message={item}
            isThinking={isStreaming && index === lastAssistantIndex}
            streamStatus={isStreaming && index === lastAssistantIndex ? streamStatus : undefined}
          />
        </div>
      ))}
      {error && (
        <div className="flex justify-center px-4">
          <Alert
            variant="destructive"
            className="border-destructive/20 bg-destructive/5 w-full max-w-3xl rounded-xl py-3"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <AlertDescription className="text-foreground">
              <div className="flex min-w-0 items-start gap-2">
                <span className="min-w-0 flex-1 break-words">{error}</span>
                {onDismissError && (
                  <AppIconButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    touch={false}
                    mutedDisabled={false}
                    onClick={onDismissError}
                    className="text-muted-foreground hover:text-foreground -mr-1 size-6 rounded-md"
                    aria-label="Dismiss error"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </AppIconButton>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
