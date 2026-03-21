'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  buildUserMessageParts,
  getTextFromParts,
  type ChatComposerPayload
} from '@/lib/chat-attachments'
import { createChatTransport } from '@/lib/chat-transport'
import { DefaultPersona, isStreamingStatus, preloadMarkdown } from '@/lib/chat-utils'
import { generateId } from '@/lib/id'
import type { ChatMessage } from '@/lib/types'
import {
  selectClearMessages,
  selectGetChatById,
  selectGetMessagesForChat,
  selectIsChatHydrated,
  selectPersistMessages,
  selectSaveMessages,
  useChatStore
} from '@/store/chat-store'
import { selectGetPersonaById, usePersonaStore } from '@/store/persona-store'
import { useChat, type UseChatHelpers } from '@ai-sdk/react'

const CHAT_STREAM_THROTTLE_MS = 32

interface UseChatSessionReturn {
  messages: ChatMessage[]
  status: UseChatHelpers<ChatMessage>['status']
  isLoading: boolean
  isChatHydrated: boolean
  streamError: string | null
  composerError: string | null
  setComposerError: Dispatch<SetStateAction<string | null>>
  handleSend: (payload: ChatComposerPayload) => Promise<boolean>
  handleStop: () => void
  handleClearMessages: () => void
  handleDismissError: () => void
}

function dropTrailingEmptyAssistantMessages(conversation: ChatMessage[]): ChatMessage[] {
  let end = conversation.length
  while (end > 0) {
    const last = conversation[end - 1]
    if (last.role !== 'assistant' || getTextFromParts(last.parts).trim().length > 0) {
      break
    }
    end--
  }
  return end === conversation.length ? conversation : conversation.slice(0, end)
}

export function useChatSession(chatId: string): UseChatSessionReturn {
  const getChatById = useChatStore(selectGetChatById)
  const saveMessages = useChatStore(selectSaveMessages)
  const clearMessages = useChatStore(selectClearMessages)
  const persistMessages = useChatStore(selectPersistMessages)
  const getMessagesForChat = useChatStore(selectGetMessagesForChat)
  const isChatHydrated = useChatStore(selectIsChatHydrated)
  const getPersonaById = usePersonaStore(selectGetPersonaById)

  const [composerError, setComposerError] = useState<string | null>(null)
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const [transport] = useState(createChatTransport)
  const [initialMessages] = useState(() => getMessagesForChat(chatId))

  // Persist only — metadata (updatedAt, title) was already set by handleSend's pre-send write
  const handleFinish = useCallback(
    ({ messages: finalMessages, isAbort }: { messages: ChatMessage[]; isAbort: boolean }) => {
      if (!getChatById(chatId)) return
      const toSave = isAbort ? dropTrailingEmptyAssistantMessages(finalMessages) : finalMessages
      persistMessages(chatId, toSave)
    },
    [chatId, getChatById, persistMessages]
  )

  const handleError = useCallback((err: Error) => {
    console.error(err)
  }, [])

  const { messages, setMessages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    experimental_throttle: CHAT_STREAM_THROTTLE_MS,
    onFinish: handleFinish,
    onError: handleError
  })

  const messagesRef = useRef(messages)
  const statusRef = useRef(status)
  useEffect(() => {
    messagesRef.current = messages
    statusRef.current = status
  }, [messages, status])

  const isLoading = isStreamingStatus(status)

  useEffect(() => {
    if (!error) return
    setMessages((current) => dropTrailingEmptyAssistantMessages(current))
  }, [error, setMessages])

  const streamError = error && error !== dismissedError ? error.message : null

  const handleSend = useCallback(
    async ({ text, uploadedImages, uploadedDocuments }: ChatComposerPayload) => {
      if (!isChatHydrated) {
        setComposerError('Setting up your chat. Please wait a moment.')
        return false
      }

      const chat = getChatById(chatId)
      if (!chat) {
        setComposerError('Chat not found. Please try again.')
        return false
      }

      const persona = chat.personaId ? getPersonaById(chat.personaId) : undefined
      const personaPrompt = persona?.prompt.trim() || DefaultPersona.prompt
      if (!personaPrompt) {
        setComposerError('This persona is missing a prompt. Please edit it and try again.')
        return false
      }

      const parts = buildUserMessageParts(text, uploadedImages, uploadedDocuments)
      if (parts.length === 0) {
        setComposerError('Please enter a message or upload a file to continue.')
        return false
      }

      if (isStreamingStatus(statusRef.current)) {
        setComposerError('Message is already sending. Please wait a moment.')
        return false
      }

      try {
        setComposerError(null)
        preloadMarkdown()

        const userMessage: ChatMessage = {
          id: generateId(),
          createdAt: new Date(),
          role: 'user',
          parts
        }

        saveMessages(chatId, [...messagesRef.current, userMessage])

        await sendMessage(userMessage, {
          body: { prompt: personaPrompt }
        })
        return true
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return true
        }
        console.error(err)
        return false
      }
    },
    [chatId, getChatById, getPersonaById, isChatHydrated, saveMessages, sendMessage]
  )

  const handleStop = useCallback(() => {
    stop()
    setMessages((current) => dropTrailingEmptyAssistantMessages(current))
  }, [stop, setMessages])

  const handleClearMessages = useCallback(() => {
    if (isLoading) return
    stop()
    setMessages([])
    const chat = getChatById(chatId)
    const persona = chat?.personaId ? getPersonaById(chat.personaId) : undefined
    clearMessages(chatId, persona?.name)
  }, [chatId, clearMessages, getChatById, getPersonaById, isLoading, setMessages, stop])

  const handleDismissError = useCallback(() => {
    setDismissedError(error ?? null)
  }, [error])

  return {
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
  }
}
