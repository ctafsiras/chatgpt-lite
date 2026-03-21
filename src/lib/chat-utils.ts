import { generateId } from '@/lib/id'
import type { ChatMessage, Persona, PersonaId } from '@/lib/types'
import { isJsonObject, readJsonString, type JsonValue } from '@/types/json'
import type { ChatStatus } from 'ai'

export const EMPTY_MESSAGES: ChatMessage[] = []
Object.freeze(EMPTY_MESSAGES)

export function ensureMessageIds(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (
      message.id != null &&
      message.createdAt != null &&
      Array.isArray(message.parts) &&
      message.parts.every(Boolean)
    ) {
      return message
    }
    return {
      ...message,
      id: message.id ?? generateId(),
      createdAt: message.createdAt ?? new Date(),
      parts: Array.isArray(message.parts) ? message.parts.filter(Boolean) : []
    }
  })
}

export function createPersonaId(): Persona['id'] {
  return generateId() as Persona['id']
}

export function coercePersonaId(value: string | undefined): Persona['id'] | undefined {
  if (value) {
    return value as Persona['id']
  }
  return undefined
}

export const DefaultPersona: Persona = {
  id: 'chatgpt' as Persona['id'],
  role: 'system',
  name: 'ChatGPT',
  prompt: 'You are a professional, friendly, and helpful AI assistant.'
}

export const DefaultPersonas: Persona[] = [DefaultPersona]

export function coercePersona(persona: JsonValue | Persona | undefined): Persona | undefined {
  if (!isJsonObject(persona)) {
    return undefined
  }

  const name = readJsonString(persona, 'name')
  const prompt = readJsonString(persona, 'prompt') ?? ''
  const personaId = coercePersonaId(readJsonString(persona, 'id'))
  const role: Persona['role'] = 'system'

  if (
    (personaId === DefaultPersona.id || (!personaId && name === DefaultPersona.name)) &&
    prompt === DefaultPersona.prompt
  ) {
    return DefaultPersona
  }

  const id = personaId ?? createPersonaId()
  return { id, role, name, prompt }
}

export function getChatFallbackTitle(
  personaId?: PersonaId | null,
  personaName?: string | null,
  fallback = 'New Chat'
): string {
  if (!personaId || personaId === DefaultPersona.id) {
    return fallback
  }
  return personaName || fallback
}

export function resolveChatTitle(
  chat: { title?: string | null; personaId?: PersonaId | null; personaName?: string | null },
  fallback = 'New Chat'
): string {
  if (chat.title) {
    return chat.title
  }
  return getChatFallbackTitle(chat.personaId, chat.personaName, fallback)
}

export type ChatStreamStatus = ChatStatus

const STREAMING_STATUSES: ReadonlySet<ChatStreamStatus> = new Set<ChatStreamStatus>([
  'submitted',
  'streaming'
])
export function isStreamingStatus(status: ChatStreamStatus | undefined): boolean {
  return status != null && STREAMING_STATUSES.has(status)
}

export const preloadMarkdown = () => void import('@/components/markdown/markdown')

export function findLastMessageIndex(messages: ChatMessage[], role: ChatMessage['role']): number {
  return messages.findLastIndex((message) => message.role === role)
}
