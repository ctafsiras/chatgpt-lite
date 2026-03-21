import { memo } from 'react'
import Image from 'next/image'
import { AppIconButton } from '@/components/common/app-button'
import { type UploadedDocument, type UploadedImage } from '@/lib/chat-attachments'
import { cn } from '@/lib/utils'
import { FileText, X } from 'lucide-react'

interface ComposerAttachmentsProps {
  uploadedImages: UploadedImage[]
  uploadedDocuments: UploadedDocument[]
  onRemoveImage: (index: number) => void
  onRemoveDocument: (index: number) => void
  onImagePreviewError: (index: number, url: string) => void
}

type RemoveAttachmentButtonProps = {
  className: string
  label: string
  onClick: () => void
}

function RemoveAttachmentButton({
  className,
  label,
  onClick
}: RemoveAttachmentButtonProps): React.JSX.Element {
  return (
    <AppIconButton
      type="button"
      variant="ghost"
      size="icon-sm"
      touch={false}
      mutedDisabled={false}
      onClick={onClick}
      className={cn(
        'bg-destructive/90 text-destructive-foreground hover:bg-destructive/90 rounded-full shadow-sm',
        className
      )}
      aria-label={label}
    >
      <X className="size-3.5" aria-hidden="true" />
    </AppIconButton>
  )
}

export const ComposerAttachments = memo(function ComposerAttachments({
  uploadedImages,
  uploadedDocuments,
  onRemoveImage,
  onRemoveDocument,
  onImagePreviewError
}: ComposerAttachmentsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3">
      {uploadedImages.map((img, index) => (
        <div key={`img-${index}`} className="group relative size-20">
          <Image
            src={img.url}
            alt={img.name || 'Upload preview'}
            fill
            unoptimized
            sizes="80px"
            className="border-border/50 rounded-xl border object-cover shadow-sm group-hover:shadow-md"
            onError={() => onImagePreviewError(index, img.url)}
          />
          <RemoveAttachmentButton
            onClick={() => onRemoveImage(index)}
            className="absolute -top-1.5 -right-1.5 size-11 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            label="Remove image"
          />
        </div>
      ))}
      {uploadedDocuments.map((doc, index) => (
        <div
          key={`doc-${index}`}
          className="group border-border/50 bg-muted/50 relative flex items-center gap-2 rounded-xl border py-2 pr-12 pl-3 shadow-sm hover:shadow-md"
        >
          <span className="bg-accent text-accent-foreground flex size-7 shrink-0 items-center justify-center rounded-lg">
            <FileText className="size-3.5" aria-hidden="true" />
          </span>
          <span className="max-w-36 truncate text-sm font-medium" title={doc.name}>
            {doc.name}
          </span>
          <RemoveAttachmentButton
            onClick={() => onRemoveDocument(index)}
            className="absolute top-1/2 right-1 size-11 -translate-y-1/2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            label="Remove document"
          />
        </div>
      ))}
    </div>
  )
})
