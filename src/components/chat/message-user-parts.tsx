'use client'

import { useState, type ReactNode } from 'react'
import type { ChatMessagePart, DocumentAttachmentData } from '@/lib/types'
import { FileText } from 'lucide-react'

function renderDocumentPreview(doc: DocumentAttachmentData, key: string | number): ReactNode {
  return (
    <div key={key} className="border-border bg-muted/50 mt-2 rounded-lg border p-3">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <FileText className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm font-medium">{doc.name}</span>
      </div>
      <div className="text-muted-foreground max-h-40 overflow-y-auto text-sm leading-relaxed break-words whitespace-pre-wrap">
        {doc.content.slice(0, 500)}
        {doc.content.length > 500 && '…'}
      </div>
    </div>
  )
}

function UserImageFallback({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="bg-muted/50 text-muted-foreground mt-2 flex h-20 w-32 items-center justify-center rounded-lg text-xs italic">
      {label}
    </div>
  )
}

function UserUploadedImage({ alt, src }: { alt: string; src: string }): React.JSX.Element | null {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return <UserImageFallback label="Image failed to load" />
  }

  return (
    // Data URLs are already local payloads; Next.js optimization provides no benefit here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="mt-2 h-auto max-h-72 w-auto max-w-full rounded-lg"
      onError={() => setFailedSrc(src)}
    />
  )
}

export function renderUserParts(parts: ChatMessagePart[]): ReactNode {
  return parts.map((part, index) => {
    switch (part.type) {
      case 'text':
        return <span key={index}>{part.text}</span>
      case 'file':
        if (part.mediaType.startsWith('image/')) {
          if (!part.url) {
            return <UserImageFallback key={index} label="Image" />
          }

          return (
            <UserUploadedImage key={index} src={part.url} alt={part.filename || 'Uploaded image'} />
          )
        }
        return null
      case 'data-document':
        return renderDocumentPreview(part.data, index)
      default: {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[message.tsx] Unhandled message part type: ${part.type}`)
        }
        return null
      }
    }
  })
}
