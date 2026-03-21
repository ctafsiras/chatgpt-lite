import type { NextRequest } from 'next/server'
import { MAX_IMAGE_SIZE, SUPPORTED_API_IMAGE_TYPES } from '@/lib/chat-attachments'
import { AppError } from '@/lib/errors'
import { getModel } from '@/services/ai-provider'
import { isJsonObject } from '@/types/json'
import { azure as azureProvider } from '@ai-sdk/azure'
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
  UnsupportedFunctionalityError,
  type LanguageModel,
  type ToolSet,
  type UIMessage
} from 'ai'

import { chatRequestSchema } from './schema'

// 4 * ceil(10 MiB / 3) = 13,981,016. Base64 expands bytes by ~4/3 and rounds up to 4-char blocks.
const MAX_IMAGE_BASE64_LENGTH = 4 * Math.ceil(MAX_IMAGE_SIZE / 3)

// --- Document expansion ---
// Expand data-document parts into text + file parts before calling convertToModelMessages,
// since its convertDataPart callback can only return a single part (not arrays).

const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/
const GENERIC_STREAM_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const GENERIC_INTERNAL_ERROR_MESSAGE = 'Something went wrong'

function parseDataUrl(dataUrl: string): { base64: string; mimeType?: string } | null {
  const match = dataUrl.match(DATA_URL_REGEX)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

type MessageLike = { role: 'user' | 'assistant' | 'system'; parts: unknown[] }

function expandDocumentParts(messages: MessageLike[]): MessageLike[] {
  return messages.map((msg) => {
    if (msg.role !== 'user') return msg

    let changed = false
    const expandedParts: unknown[] = []

    for (const part of msg.parts) {
      if (!isJsonObject(part)) {
        expandedParts.push(part)
        continue
      }

      // Convert data: URL file parts to inline base64 so the AI SDK does not
      // attempt to download them (its downloadAssets step rejects data: URLs).
      if (part.type === 'file' && typeof part.url === 'string') {
        const parsed = parseDataUrl(part.url)
        if (!parsed || !parsed.base64) {
          changed = true
          continue
        }
        // Replace the data URL with bare base64 so the SDK treats it as inline data.
        changed = true
        expandedParts.push({ ...part, url: parsed.base64 })
        continue
      }

      if (part.type !== 'data-document' || !isJsonObject(part.data)) {
        expandedParts.push(part)
        continue
      }

      changed = true
      const data = part.data
      const name = typeof data.name === 'string' ? data.name : 'Unknown'
      const content = typeof data.content === 'string' ? data.content : ''

      expandedParts.push({ type: 'text', text: `[Document: ${name}]\n\n${content}` })

      if (Array.isArray(data.images) && data.images.length > 0) {
        expandedParts.push({
          type: 'text',
          text: `\n\n[This document contains ${data.images.length} image(s)]`
        })

        for (const img of data.images) {
          if (!isJsonObject(img) || typeof img.dataUrl !== 'string') continue

          const parsed = parseDataUrl(img.dataUrl)
          if (!parsed) {
            expandedParts.push({ type: 'text', text: '[Unsupported image source]' })
            continue
          }

          const mimeType = parsed.mimeType?.toLowerCase()
          if (!mimeType || !SUPPORTED_API_IMAGE_TYPES.has(mimeType)) {
            const label = mimeType
              ? `[Unsupported image format: ${mimeType}]`
              : '[Unsupported image format]'
            expandedParts.push({ type: 'text', text: label })
          } else if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
            expandedParts.push({ type: 'text', text: '[Image too large]' })
          } else {
            expandedParts.push({ type: 'file', mediaType: mimeType, url: parsed.base64 })
          }
        }
      }
    }

    return changed ? { ...msg, parts: expandedParts } : msg
  })
}

// --- Web search fallback ---

function getErrorTextForWebSearchCheck(error: unknown): string | undefined {
  if (APICallError.isInstance(error)) {
    return [error.message, error.responseBody]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join('\n')
      .toLowerCase()
  }
  if (error instanceof Error) {
    return error.message.toLowerCase()
  }
  return undefined
}

function isWebSearchSetupFallbackError(error: unknown): boolean {
  // Only allow fallback for feature/setup incompatibilities.
  // Request execution failures (auth/rate-limit/network) should not be downgraded silently.
  if (UnsupportedFunctionalityError.isInstance(error)) {
    const functionality = error.functionality.toLowerCase()
    return functionality.includes('web_search') || functionality.includes('web search')
  }

  const text = getErrorTextForWebSearchCheck(error)
  if (!text) return false

  const mentionsWebSearch = text.includes('web_search') || text.includes('web search')
  const mentionsUnsupported = text.includes('not supported') || text.includes('unsupported')
  return mentionsWebSearch && mentionsUnsupported
}

function getPublicStreamErrorMessage(error: unknown): string {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return 'Model provider authentication failed. Please check your API settings.'
      case 429:
        return 'Rate limit reached. Please try again shortly.'
      default:
        if (typeof error.statusCode === 'number' && error.statusCode >= 500) {
          return 'Model provider is temporarily unavailable. Please try again later.'
        }
    }
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'Request cancelled.'
  }

  return GENERIC_STREAM_ERROR_MESSAGE
}

// --- Route handler ---

export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown

  try {
    payload = await req.json()
  } catch (error) {
    console.warn('[Chat API] Invalid JSON request body', error)
    return new AppError('invalid_json', 'Invalid JSON in request body').toResponse()
  }

  const parsed = chatRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return new AppError('invalid_request', 'Invalid request body').toResponse()
  }

  const { prompt, messages } = parsed.data

  try {
    const systemMessage = {
      role: 'system' as const,
      parts: [{ type: 'text' as const, text: prompt }]
    }

    const expanded = expandDocumentParts([systemMessage, ...messages])
    const messagesWithHistory = await convertToModelMessages(
      expanded as Array<Omit<UIMessage, 'id'>>
    )

    const modelConfig = getModel()
    const baseStreamOptions = {
      messages: messagesWithHistory,
      abortSignal: req.signal,
      stopWhen: stepCountIs(5),
      experimental_transform: smoothStream({ chunking: 'word' as const })
    }

    function runPlainStream(model: LanguageModel) {
      return streamText({
        model,
        ...baseStreamOptions
      })
    }

    function runStream() {
      switch (modelConfig.mode) {
        case 'azure': {
          const tools = {
            web_search_preview: azureProvider.tools.webSearchPreview({
              searchContextSize: 'high'
            })
          } satisfies ToolSet

          return streamText({
            model: modelConfig.model,
            tools,
            ...baseStreamOptions
          })
        }
        case 'openai-web-search': {
          try {
            const tools = {
              web_search_preview: modelConfig.openaiProvider.tools.webSearchPreview({
                searchContextSize: 'high'
              })
            } satisfies ToolSet

            return streamText({
              model: modelConfig.openaiProvider.responses(modelConfig.openaiModel),
              tools,
              ...baseStreamOptions
            })
          } catch (error) {
            if (!isWebSearchSetupFallbackError(error)) {
              throw error
            }

            console.warn(
              '[Chat API] Web search unavailable at request start; falling back to plain chat',
              error
            )
          }

          return runPlainStream(modelConfig.model)
        }
      }
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = runStream()
        writer.merge(result.toUIMessageStream({ sendSources: true, sendReasoning: false }))
      },
      onError: (error) => {
        console.error('[Chat API] Stream error:', error)
        return getPublicStreamErrorMessage(error)
      }
    })

    return createUIMessageStreamResponse({
      stream
    })
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return new AppError('internal_error', GENERIC_INTERNAL_ERROR_MESSAGE).toResponse()
  }
}
