import { cacheKeysWithPrefix } from '@/lib/cache'
import {
  DefaultPersona,
  EMPTY_MESSAGES,
  ensureMessageIds,
  getChatFallbackTitle
} from '@/lib/chat-utils'
import { AppError } from '@/lib/errors'
import type { Chat, ChatMessage, Persona } from '@/lib/types'
import { CACHE_KEY } from '@/services/constant'
import { toast } from 'sonner'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'

import { coerceStoredMessage } from './chat-coerce'
import {
  createChatRecord,
  deriveTitleFromMessages,
  resolveCurrentId,
  sortChatsByPinnedThenRecent,
  truncateToWords
} from './chat-helpers'
import { chatRepo } from './chat-repository'

// --- Utility functions ---

function updateChatField(
  state: ChatState,
  chatId: string,
  updates: Partial<Chat>,
  set: (partial: Partial<ChatState>) => void
): void {
  const nextList = state.chatList.map((chat) =>
    chat.id === chatId ? { ...chat, ...updates } : chat
  )
  const chatList = sortChatsByPinnedThenRecent(nextList)
  const currentChatId = resolveCurrentId(chatList, state.currentChatId)
  set({ chatList, currentChatId })
}

function getChatIdSet(chatList: Chat[]): Set<string> {
  return new Set(chatList.map((chat) => chat.id))
}

function cleanupRemovedChatMessages(chatIds: string[]): void {
  for (const chatId of chatIds) {
    chatRepo.deleteMessages(chatId)
    chatRepo.removePersistedMessages(chatId)
  }
}

const PERSISTED_MESSAGE_KEY_PREFIX = CACHE_KEY.chatMessages('')
const PERSISTED_ORPHAN_SCAN_IDLE_TIMEOUT_MS = 1500

function getPersistedMessageChatIds(): string[] {
  return cacheKeysWithPrefix(PERSISTED_MESSAGE_KEY_PREFIX).map((key) =>
    key.slice(PERSISTED_MESSAGE_KEY_PREFIX.length)
  )
}

function reconcileOrphanedMessages(validIds: Set<string>): void {
  for (const key of chatRepo.allMessageKeys()) {
    if (!validIds.has(key)) {
      chatRepo.deleteMessages(key)
      chatRepo.removePersistedMessages(key)
    }
  }
}

function reconcilePersistedOrphanedMessages(validIds: Set<string>): void {
  for (const id of getPersistedMessageChatIds()) {
    if (!validIds.has(id)) {
      chatRepo.removePersistedMessages(id)
    }
  }
}

function schedulePersistedOrphanScan(): void {
  const run = () => {
    const validIds = getChatIdSet(useChatStore.getState().chatList)
    reconcilePersistedOrphanedMessages(validIds)
  }

  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: PERSISTED_ORPHAN_SCAN_IDLE_TIMEOUT_MS })
    return
  }

  window.setTimeout(run, 0)
}

// --- Store ---

interface ChatState {
  chatList: Chat[]
  currentChatId: string | undefined
  isChatHydrated: boolean

  hydrate: () => void
  getChatById: (id?: string | null) => Chat | undefined
  getMessagesForChat: (id?: string | null) => ChatMessage[]
  saveMessages: (
    chatId: string,
    messages: ChatMessage[]
  ) => { normalized: ChatMessage[]; previousCount: number }
  clearMessages: (chatId: string, personaName?: string) => void
  persistMessages: (chatId: string, messages: ChatMessage[]) => void
  onChangeChat: (chat: Chat) => void
  onCreateChat: (persona: Persona, firstMessage?: string) => Chat | undefined
  onCreateDefaultChat: (firstMessage?: string) => Chat | undefined
  onDeleteChat: (chat: Chat) => void
  updateChatTitle: (chatId: string, title: string) => void
  updateChatPinned: (chatId: string, pinned: boolean) => void
}

// --- Selectors ---
export const selectCurrentChatId = (s: ChatState) => s.currentChatId
export const selectChatList = (s: ChatState) => s.chatList
export const selectIsChatHydrated = (s: ChatState) => s.isChatHydrated
export const selectHydrate = (s: ChatState) => s.hydrate
export const selectGetChatById = (s: ChatState) => s.getChatById
export const selectGetMessagesForChat = (s: ChatState) => s.getMessagesForChat
export const selectSaveMessages = (s: ChatState) => s.saveMessages
export const selectClearMessages = (s: ChatState) => s.clearMessages
export const selectPersistMessages = (s: ChatState) => s.persistMessages
export const selectOnChangeChat = (s: ChatState) => s.onChangeChat
export const selectOnCreateChat = (s: ChatState) => s.onCreateChat
export const selectOnCreateDefaultChat = (s: ChatState) => s.onCreateDefaultChat
export const selectOnDeleteChat = (s: ChatState) => s.onDeleteChat
export const selectUpdateChatTitle = (s: ChatState) => s.updateChatTitle
export const selectUpdateChatPinned = (s: ChatState) => s.updateChatPinned

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    chatList: [],
    currentChatId: undefined,
    isChatHydrated: false,

    hydrate: () => {
      if (get().isChatHydrated) return

      if (typeof window === 'undefined') {
        set({ isChatHydrated: true })
        return
      }

      try {
        const storedChatList = chatRepo.loadChatList()
        const storedCurrentChatId = chatRepo.loadCurrentChatId()

        for (const chat of storedChatList) {
          const storedMessagesRaw = chatRepo.loadMessagesRaw(chat.id)
          const storedMessages: ChatMessage[] = []

          for (const rawMessage of storedMessagesRaw) {
            const parsed = coerceStoredMessage(rawMessage)
            if (parsed) {
              storedMessages.push(parsed)
            }
          }

          const normalizedMessages = ensureMessageIds(storedMessages)
          chatRepo.setMessages(chat.id, normalizedMessages)
        }

        const chatList = sortChatsByPinnedThenRecent(
          storedChatList.length > 0 ? storedChatList : [createChatRecord()]
        )
        const currentChatId = resolveCurrentId(chatList, storedCurrentChatId)

        set({ chatList, currentChatId, isChatHydrated: true })
      } catch (error) {
        AppError.warn('store', 'corrupt_data', 'Failed to hydrate stored chats', error)
        toast.error('Failed to load saved chats. Your chat history may be unavailable.')
        chatRepo.clearMessages()
        const fallbackChat = createChatRecord()
        set({
          chatList: [fallbackChat],
          currentChatId: fallbackChat.id,
          isChatHydrated: true
        })
      }
    },

    getChatById: (id) => {
      const state = get()
      const targetId = id ?? state.currentChatId
      if (!targetId) return undefined
      return state.chatList.find((chat) => chat.id === targetId)
    },

    getMessagesForChat: (id) => {
      const targetId = id ?? get().currentChatId
      if (!targetId) return EMPTY_MESSAGES
      return chatRepo.getMessages(targetId) ?? EMPTY_MESSAGES
    },

    saveMessages: (chatId, messages) => {
      const { normalized, previousCount } = chatRepo.updateConversation(chatId, messages)
      const state = get()
      const existingChat = state.chatList.find((c) => c.id === chatId)
      if (!existingChat) return { normalized, previousCount }

      const now = new Date().toISOString()
      const latestTimestamp = normalized.at(-1)?.createdAt?.toISOString() ?? now
      const hasNewMessages = normalized.length > previousCount
      const activityTimestamp = hasNewMessages ? now : latestTimestamp

      const isFirstMessage = previousCount === 0 && normalized.length > 0
      const isDefaultPersona =
        !existingChat.personaId || existingChat.personaId === DefaultPersona.id
      const shouldDeriveTitle = isFirstMessage && isDefaultPersona
      const fallbackTitle = existingChat.title || 'New Chat'

      const updates: Partial<Chat> = { updatedAt: activityTimestamp }
      if (shouldDeriveTitle) {
        updates.title = deriveTitleFromMessages(normalized, fallbackTitle)
      }

      updateChatField(state, chatId, updates, set)
      return { normalized, previousCount }
    },

    clearMessages: (chatId, personaName) => {
      chatRepo.saveConversation(chatId, [])

      const state = get()
      const existingChat = state.chatList.find((c) => c.id === chatId)
      if (!existingChat) return

      updateChatField(
        state,
        chatId,
        { title: getChatFallbackTitle(existingChat.personaId, personaName) },
        set
      )
    },

    persistMessages: (chatId, messages) => {
      chatRepo.saveConversation(chatId, messages)
    },

    onChangeChat: (chat) => {
      const state = get()
      if (state.chatList.some((c) => c.id === chat.id)) {
        set({ currentChatId: chat.id })
        return
      }
      set({
        chatList: sortChatsByPinnedThenRecent([chat, ...state.chatList]),
        currentChatId: chat.id
      })
    },

    onCreateChat: (persona, firstMessage) => {
      const state = get()
      const quickTitle = firstMessage ? truncateToWords(firstMessage, 4) : undefined
      const newChat = createChatRecord({
        title: quickTitle,
        personaId: persona.id,
        personaName: persona.name
      })
      set({
        chatList: sortChatsByPinnedThenRecent([newChat, ...state.chatList]),
        currentChatId: newChat.id
      })
      return newChat
    },

    onCreateDefaultChat: (firstMessage) => {
      return get().onCreateChat(DefaultPersona, firstMessage)
    },

    onDeleteChat: (chat) => {
      const state = get()

      const filtered = state.chatList.filter((c) => c.id !== chat.id)
      const nextList = filtered.length > 0 ? filtered : [createChatRecord()]

      const chatList = sortChatsByPinnedThenRecent(nextList)
      const currentChatId = state.currentChatId === chat.id ? chatList[0]?.id : state.currentChatId
      set({ chatList, currentChatId })
    },

    updateChatTitle: (chatId, title) => {
      if (!title) return
      updateChatField(get(), chatId, { title }, set)
    },

    updateChatPinned: (chatId, pinned) => {
      updateChatField(get(), chatId, { pinned }, set)
    }
  }))
)

// --- Subscribers (each with a single responsibility) ---

// Subscriber 1: Persist chatList
useChatStore.subscribe(
  (state) => state.chatList,
  (chatList) => {
    if (!useChatStore.getState().isChatHydrated) return

    chatRepo.saveChatList(chatList)
  }
)

// Subscriber 2: Incremental cleanup when chats are removed
useChatStore.subscribe(
  (state) => state.chatList.map((chat) => chat.id),
  (chatIds, previousChatIds) => {
    if (!useChatStore.getState().isChatHydrated) return

    const previousIds = previousChatIds ?? []
    if (previousIds.length === 0) return

    const currentIds = new Set(chatIds)
    const removedIds = previousIds.filter((id) => !currentIds.has(id))
    if (removedIds.length > 0) {
      cleanupRemovedChatMessages(removedIds)
    }
  },
  { equalityFn: shallow }
)

// Subscriber 3: One-time orphan reconciliation after hydration
useChatStore.subscribe(
  (state) => state.isChatHydrated,
  (isChatHydrated, wasChatHydrated) => {
    if (!isChatHydrated || wasChatHydrated) return

    const validIds = getChatIdSet(useChatStore.getState().chatList)
    reconcileOrphanedMessages(validIds)
    schedulePersistedOrphanScan()
  }
)

// Subscriber 4: Persist currentChatId
useChatStore.subscribe(
  (state) => state.currentChatId,
  (currentChatId) => {
    if (!useChatStore.getState().isChatHydrated) return

    if (currentChatId) {
      chatRepo.saveCurrentChatId(currentChatId)
    } else {
      chatRepo.removeCurrentChatId()
    }
  }
)
