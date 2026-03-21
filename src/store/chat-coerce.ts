import { generateId } from '@/lib/id'
import type { ChatMessage, ChatMessagePart, DocumentAttachmentData } from '@/lib/types'
import { isJsonObject, readJsonString, type JsonValue } from '@/types/json'

type StoredPdfImage = NonNullable<DocumentAttachmentData['images']>[number]

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value)
}

function coerceStoredPdfImage(value: JsonValue | undefined): StoredPdfImage | null {
  if (!isJsonObject(value)) return null

  const pageNumber = value.pageNumber
  const width = value.width
  const height = value.height
  const name = readJsonString(value, 'name')
  const dataUrl = readJsonString(value, 'dataUrl')

  if (
    !isFiniteNumber(pageNumber) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !name ||
    !dataUrl
  ) {
    return null
  }

  return { pageNumber, width, height, name, dataUrl }
}

function coerceDocumentAttachmentData(value: JsonValue | undefined): DocumentAttachmentData | null {
  if (!isJsonObject(value)) return null

  const name = readJsonString(value, 'name')
  const content = readJsonString(value, 'content')
  const mimeType = readJsonString(value, 'mimeType')
  if (!name || content === undefined || !mimeType) return null

  let images: StoredPdfImage[] | undefined
  if (Array.isArray(value.images)) {
    images = []
    for (const raw of value.images) {
      const image = coerceStoredPdfImage(raw)
      if (image) images.push(image)
    }
  }

  return { name, content, mimeType, images }
}

function coerceStoredMessagePart(value: JsonValue | undefined): ChatMessagePart | null {
  if (!isJsonObject(value)) return null

  const type = readJsonString(value, 'type')
  if (!type) return null

  switch (type) {
    case 'text':
    case 'reasoning': {
      const text = readJsonString(value, 'text')
      return text === undefined ? null : { type, text }
    }
    case 'step-start':
      return { type: 'step-start' }
    case 'file': {
      const mediaType = readJsonString(value, 'mediaType')
      const url = readJsonString(value, 'url')
      const filename = readJsonString(value, 'filename')
      if (!mediaType || url === undefined) return null
      if (!url && !mediaType.startsWith('image/')) return null

      return filename
        ? { type: 'file', mediaType, url, filename }
        : { type: 'file', mediaType, url }
    }
    case 'source-url': {
      const sourceId = readJsonString(value, 'sourceId')
      const url = readJsonString(value, 'url')
      const title = readJsonString(value, 'title')
      if (!sourceId || !url) return null

      return title
        ? { type: 'source-url', sourceId, url, title }
        : { type: 'source-url', sourceId, url }
    }
    case 'source-document': {
      const sourceId = readJsonString(value, 'sourceId')
      const mediaType = readJsonString(value, 'mediaType')
      const title = readJsonString(value, 'title')
      const filename = readJsonString(value, 'filename')
      if (!sourceId || !mediaType || !title) return null

      return filename
        ? { type: 'source-document', sourceId, mediaType, title, filename }
        : { type: 'source-document', sourceId, mediaType, title }
    }
    case 'data-document': {
      const data = coerceDocumentAttachmentData(value.data)
      const id = readJsonString(value, 'id')
      if (!data) return null

      return id ? { type: 'data-document', id, data } : { type: 'data-document', data }
    }
    default:
      // Keep forward-compatible AI SDK part shapes instead of dropping them during hydrate.
      return value as unknown as ChatMessagePart
  }
}

function coerceStoredMessageParts(value: JsonValue | undefined): ChatMessagePart[] | null {
  if (!Array.isArray(value)) return null

  const parts: ChatMessagePart[] = []
  for (const raw of value) {
    const part = coerceStoredMessagePart(raw)
    if (part) parts.push(part)
  }
  return parts
}

function coerceStoredCreatedAt(value: JsonValue | undefined): Date | undefined {
  const createdAt = typeof value === 'string' ? value : undefined
  if (!createdAt) return undefined

  const parsedDate = new Date(createdAt)
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate
}

export function coerceStoredMessage(message: JsonValue | undefined): ChatMessage | null {
  if (!isJsonObject(message)) return null

  const role = message.role
  if (role !== 'assistant' && role !== 'user' && role !== 'system') return null

  const id = readJsonString(message, 'id') ?? generateId()
  const createdAt = coerceStoredCreatedAt(message.createdAt)

  const parts = coerceStoredMessageParts(message.parts)
  if (parts === null) return null

  return { id, createdAt, role, parts }
}
