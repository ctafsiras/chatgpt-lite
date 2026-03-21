'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog'
import { useFileAttachments } from '@/hooks/useFileAttachments'
import { useInViewport } from '@/hooks/useInViewport'
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'
import { type ChatComposerPayload } from '@/lib/chat-attachments'

import { ComposerAttachments } from './composer/composer-attachments'
import { ComposerError } from './composer/composer-error'
import { ComposerTextarea } from './composer/composer-textarea'
import { ComposerToolbar } from './composer/composer-toolbar'

export interface ChatComposerHandle {
  focus: () => void
}

interface ChatComposerProps {
  isChatHydrated: boolean
  isSending: boolean
  hasActiveChat: boolean
  showClear: boolean
  composerError: string | null
  setComposerError: (next: string | null) => void
  onClear: () => void
  onSend: (payload: ChatComposerPayload) => Promise<boolean> | boolean
  onStop: () => void
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    isChatHydrated,
    isSending,
    hasActiveChat,
    showClear,
    composerError,
    setComposerError,
    onClear,
    onSend,
    onStop
  },
  ref
): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const composingRef = useRef(false)
  const messageRef = useRef(message)
  const [voiceButtonRef, isVoiceButtonInView] = useInViewport<HTMLButtonElement>()

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

  const { isListening, interimTranscript, toggleVoiceInput, resetTranscript } = useVoiceRecognition(
    {
      onTranscript: useCallback((text: string) => setMessage((prev) => prev + text), [])
    }
  )

  const {
    uploadedImages,
    uploadedDocuments,
    fileInputRef,
    handleFileUpload,
    handlePaste,
    handleImagePreviewError,
    removeImage,
    removeDocument,
    resetAttachments,
    restoreAttachments,
    hasAttachments,
    hasCurrentAttachments
  } = useFileAttachments()

  const chatInputId = useId()
  const helperTextId = useId()
  const errorTextId = useId()

  const hasText = message.trim().length > 0
  const hasContent = hasText || hasAttachments
  const canSend = isChatHydrated && hasActiveChat && !isSending && hasContent

  useEffect(() => {
    messageRef.current = message
  }, [message])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        textAreaRef.current?.focus()
      }
    }),
    []
  )

  const resetComposerState = useCallback(() => {
    setMessage('')
    resetAttachments()
    resetTranscript()
  }, [resetAttachments, resetTranscript])

  const handleSubmit = useCallback(
    async (event: React.SyntheticEvent) => {
      event.preventDefault()

      if (isSending || !canSend) {
        return
      }

      const input = message.trim()

      const draftMessage = message
      const draftImages = uploadedImages
      const draftDocuments = uploadedDocuments

      resetComposerState()
      setComposerError(null)

      let accepted = false
      try {
        accepted = await onSend({
          text: input,
          uploadedImages: draftImages,
          uploadedDocuments: draftDocuments
        })
      } catch (error) {
        console.error(error)
        setComposerError('Something went wrong. Please try again.')
        accepted = false
      }

      if (!accepted) {
        const shouldRestoreDraft = messageRef.current.length === 0 && !hasCurrentAttachments()

        if (shouldRestoreDraft) {
          setMessage(draftMessage)
          restoreAttachments(draftImages, draftDocuments)
          textAreaRef.current?.focus()
        }
      }
    },
    [
      hasCurrentAttachments,
      canSend,
      isSending,
      message,
      onSend,
      resetComposerState,
      restoreAttachments,
      setComposerError,
      uploadedDocuments,
      uploadedImages
    ]
  )

  const handleClear = useCallback(() => {
    setIsClearConfirmOpen(true)
  }, [])

  const confirmClear = useCallback(() => {
    onClear()
    resetComposerState()
    setComposerError(null)
    setIsClearConfirmOpen(false)
  }, [onClear, resetComposerState, setComposerError])

  const handleKeypress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
        e.preventDefault()
        if (!canSend) {
          return
        }
        handleSubmit(e)
      }
    },
    [canSend, handleSubmit]
  )

  const handleMessageChange = useCallback(
    (value: string) => {
      setMessage(value)
      setComposerError(null)
    },
    [setComposerError]
  )

  const showPlaceholder = !message && !isComposerFocused && !hasAttachments

  return (
    <>
      <div className="relative">
        <div className="bg-card border-border/60 focus-within:border-primary/30 focus-within:ring-primary/10 has-[textarea[aria-invalid=true]]:border-destructive has-[textarea[aria-invalid=true]]:ring-destructive/20 flex flex-col rounded-2xl border shadow-md focus-within:shadow-lg focus-within:ring-4 has-[textarea[aria-invalid=true]]:ring-2">
          {hasAttachments && (
            <ComposerAttachments
              uploadedImages={uploadedImages}
              uploadedDocuments={uploadedDocuments}
              onRemoveImage={removeImage}
              onRemoveDocument={removeDocument}
              onImagePreviewError={handleImagePreviewError}
            />
          )}
          <ComposerTextarea
            textAreaRef={textAreaRef}
            message={message}
            disabled={!isChatHydrated}
            showPlaceholder={showPlaceholder}
            interimTranscript={interimTranscript}
            isVoiceButtonInView={isVoiceButtonInView}
            composerError={composerError}
            chatInputId={chatInputId}
            helperTextId={helperTextId}
            errorTextId={errorTextId}
            onMessageChange={handleMessageChange}
            onFocus={() => setIsComposerFocused(true)}
            onBlur={() => setIsComposerFocused(false)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            onKeyDown={handleKeypress}
            onPaste={handlePaste}
          />

          {composerError && <ComposerError errorTextId={errorTextId} message={composerError} />}

          <ComposerToolbar
            isChatHydrated={isChatHydrated}
            isSending={isSending}
            canSend={canSend}
            showClear={showClear}
            isListening={isListening}
            isVoiceButtonInView={isVoiceButtonInView}
            voiceButtonRef={voiceButtonRef}
            fileInputRef={fileInputRef}
            onFileUpload={handleFileUpload}
            onClear={handleClear}
            onVoiceToggle={toggleVoiceInput}
            onSend={handleSubmit}
            onStop={onStop}
          />
        </div>
        <p className="text-muted-foreground mt-2 hidden px-1 text-xs leading-relaxed text-pretty md:block">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
      <ConfirmActionDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
        title="Clear conversation history?"
        description="This removes all messages in this conversation and cannot be undone."
        confirmLabel="Clear history"
        confirmVariant="destructive"
        onConfirm={confirmClear}
      />
    </>
  )
})
