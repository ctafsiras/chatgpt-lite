'use client'

import { useEffect, useRef } from 'react'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { MessageList } from '@/components/chat/message-list'
import { AnimatedDots } from '@/components/common/animated-dots'
import { useChatSession } from '@/hooks/useChatSession'
import { isMobileViewport } from '@/lib/viewport'
import { selectCurrentChatId, selectIsChatHydrated, useChatStore } from '@/store/chat-store'
import { StickToBottom } from 'use-stick-to-bottom'

function LoadingDots(): React.JSX.Element {
  return (
    <AnimatedDots
      ariaHidden
      className="flex items-center gap-1.5"
      dotClassName="bg-foreground/60"
      activeAnimationClassName="animate-[pulse-dot_1.4s_ease-in-out_infinite]"
      delayStepMs={200}
    />
  )
}

// --- ActiveChat: per-chat component that delegates orchestration to useChatSession ---

function ActiveChat({ chatId }: { chatId: string }): React.JSX.Element {
  const composerRef = useRef<ChatComposerHandle>(null)

  const {
    messages,
    status,
    isLoading,
    isChatHydrated,
    streamError,
    composerError,
    setComposerError,
    handleSend,
    handleStop,
    handleClearMessages,
    handleDismissError
  } = useChatSession(chatId)

  useEffect(() => {
    if (!isMobileViewport()) {
      composerRef.current?.focus()
    }
  }, [chatId])

  const sharedComposerProps = {
    isChatHydrated,
    isSending: isLoading,
    hasActiveChat: true,
    composerError,
    setComposerError,
    onClear: handleClearMessages,
    onStop: handleStop,
    onSend: handleSend
  }

  if (messages.length === 0) {
    return (
      <div className="bg-background text-foreground flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        <div className="relative flex w-full max-w-2xl -translate-y-6 flex-col gap-10 text-center">
          <div className="flex flex-col gap-5">
            <h1 className="text-foreground font-sans text-3xl font-medium tracking-normal text-balance md:text-4xl lg:text-5xl">
              How can I help?
            </h1>
          </div>
          <ChatComposer ref={composerRef} showClear={false} {...sharedComposerProps} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <h1 className="sr-only">Chat conversation</h1>
      <StickToBottom
        className="relative min-h-0 flex-1 overflow-y-auto"
        initial="smooth"
        resize="smooth"
      >
        <StickToBottom.Content className="relative flex min-h-full flex-col">
          <div className="@container/chat relative mx-auto w-full max-w-4xl flex-1 px-4 pt-4 pb-3 md:px-6 lg:px-8">
            <MessageList
              messages={messages}
              streamStatus={status}
              error={streamError}
              onDismissError={handleDismissError}
            />
          </div>
        </StickToBottom.Content>
      </StickToBottom>
      <div className="border-border/60 bg-background relative shrink-0 border-t pt-2">
        <div className="@container/chat mx-auto w-full max-w-4xl px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:px-6 lg:px-8">
          <ChatComposer ref={composerRef} showClear={true} {...sharedComposerProps} />
        </div>
      </div>
    </div>
  )
}

// --- Chat: shell that handles hydration and delegates to ActiveChat ---

function Chat(): React.JSX.Element {
  const currentChatId = useChatStore(selectCurrentChatId)
  const isChatHydrated = useChatStore(selectIsChatHydrated)

  if (!isChatHydrated || !currentChatId) {
    return (
      <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="text-primary/20 font-serif text-6xl select-none md:text-7xl">
            &#10087;
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary/10 size-16 rounded-full blur-xl" />
          </div>
        </div>
        <div
          className="text-muted-foreground flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <LoadingDots />
          <span className="text-sm tracking-wide text-balance">Preparing your workspace…</span>
        </div>
      </div>
    )
  }

  return <ActiveChat key={currentChatId} chatId={currentChatId} />
}

export default Chat
