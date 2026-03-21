import { z } from 'zod'

// --- Message part schemas (passthrough preserves AI SDK's providerMetadata) ---

const textPartSchema = z.object({ type: z.literal('text'), text: z.string() }).passthrough()

const filePartSchema = z
  .object({ type: z.literal('file'), mediaType: z.string(), url: z.string() })
  .passthrough()

const dataDocumentPartSchema = z
  .object({
    type: z.literal('data-document'),
    data: z.object({
      name: z.string(),
      content: z.string(),
      mimeType: z.string(),
      images: z.array(z.object({}).passthrough()).optional()
    })
  })
  .passthrough()

const reasoningPartSchema = z
  .object({ type: z.literal('reasoning'), text: z.string() })
  .passthrough()

const stepStartPartSchema = z.object({ type: z.literal('step-start') }).passthrough()

const sourceUrlPartSchema = z
  .object({ type: z.literal('source-url'), sourceId: z.string(), url: z.string() })
  .passthrough()

const sourceDocumentPartSchema = z
  .object({
    type: z.literal('source-document'),
    sourceId: z.string(),
    mediaType: z.string(),
    title: z.string()
  })
  .passthrough()

const knownPartSchema = z.discriminatedUnion('type', [
  textPartSchema,
  filePartSchema,
  dataDocumentPartSchema,
  reasoningPartSchema,
  stepStartPartSchema,
  sourceUrlPartSchema,
  sourceDocumentPartSchema
])

// Catch-all for future AI SDK part types — must have a `type` string at minimum.
const fallbackPartSchema = z.object({ type: z.string() }).passthrough()

const chatMessagePartSchema = knownPartSchema.or(fallbackPartSchema)

// --- Message & request schemas ---

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(chatMessagePartSchema)
})

export const chatRequestSchema = z.object({
  prompt: z.string(),
  messages: z.array(chatMessageSchema)
})
