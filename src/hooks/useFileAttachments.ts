import { useCallback, useEffect, useRef, useState } from 'react'
import {
  convertImageToSupportedFormat,
  getImageMimeType,
  isDocumentFile,
  isImageFile,
  MAX_IMAGE_SIZE,
  readFileAsDataUrl,
  type UploadedDocument,
  type UploadedImage
} from '@/lib/chat-attachments'
import { formatSizeInMB } from '@/lib/size'
import { toast } from 'sonner'

interface UseFileAttachmentsReturn {
  uploadedImages: UploadedImage[]
  uploadedDocuments: UploadedDocument[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  handleImagePreviewError: (index: number, url: string) => void
  removeImage: (index: number) => void
  removeDocument: (index: number) => void
  resetAttachments: () => void
  restoreAttachments: (images: UploadedImage[], documents: UploadedDocument[]) => void
  hasAttachments: boolean
  hasCurrentAttachments: () => boolean
}

export function useFileAttachments(): UseFileAttachmentsReturn {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const failedPreviewUrlsRef = useRef<Set<string>>(new Set())
  const uploadedImagesRef = useRef(uploadedImages)
  const uploadedDocumentsRef = useRef(uploadedDocuments)

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages
    uploadedDocumentsRef.current = uploadedDocuments

    const currentImageUrls = new Set(uploadedImages.map(({ url }) => url))
    for (const url of failedPreviewUrlsRef.current) {
      if (!currentImageUrls.has(url)) {
        failedPreviewUrlsRef.current.delete(url)
      }
    }
  }, [uploadedImages, uploadedDocuments])

  const convertImageFile = useCallback(async (file: File): Promise<UploadedImage | null> => {
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const converted = await convertImageToSupportedFormat(dataUrl, getImageMimeType(file))
      return { url: converted.url, mimeType: converted.mimeType, name: file.name || undefined }
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error(
        file.name
          ? `Unsupported image format: ${file.name}. Supported: JPEG, PNG, GIF, WebP`
          : 'Unsupported image format. Supported: JPEG, PNG, GIF, WebP'
      )
      return null
    }
  }, [])

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const documentFiles: File[] = []
      const imageConversions: Array<Promise<UploadedImage | null>> = []
      let fileParserPromise: Promise<typeof import('@/lib/file-parser')> | null = null

      for (const file of Array.from(files)) {
        if (isImageFile(file)) {
          if (file.size > MAX_IMAGE_SIZE) {
            toast.error(
              `Image too large: ${file.name}. Maximum size is ${formatSizeInMB(MAX_IMAGE_SIZE)}.`
            )
            continue
          }

          imageConversions.push(convertImageFile(file))
        } else if (isDocumentFile(file)) {
          documentFiles.push(file)
          fileParserPromise ??= import('@/lib/file-parser')
        } else {
          toast.error(`Unsupported file type: ${file.name}`)
        }
      }

      const parseDocumentsTask =
        documentFiles.length > 0 && fileParserPromise
          ? (async (): Promise<UploadedDocument[]> => {
              try {
                const { parseFile } = await fileParserPromise
                const results = await Promise.allSettled(
                  documentFiles.map((file) => parseFile(file))
                )
                const parsedDocuments: UploadedDocument[] = []

                for (const [index, result] of results.entries()) {
                  const file = documentFiles[index]

                  if (!file) {
                    continue
                  }

                  if (result.status === 'fulfilled') {
                    parsedDocuments.push(result.value)
                    toast.success(`File "${file.name}" uploaded successfully`)
                  } else {
                    console.error('Error parsing file:', result.reason)
                    toast.error(`Failed to parse file: ${file.name}`)
                  }
                }

                return parsedDocuments
              } catch (error) {
                console.error('Error loading file parser:', error)
                for (const file of documentFiles) {
                  toast.error(`Failed to parse file: ${file.name}`)
                }
                return []
              }
            })()
          : Promise.resolve([])

      const convertedImages = await Promise.all(imageConversions)
      const successfulImages = convertedImages.filter(
        (image): image is UploadedImage => image !== null
      )
      if (successfulImages.length > 0) {
        setUploadedImages((prev) => [...prev, ...successfulImages])
      }

      const parsedDocuments = await parseDocumentsTask
      if (parsedDocuments.length > 0) {
        setUploadedDocuments((prev) => [...prev, ...parsedDocuments])
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [convertImageFile]
  )

  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeDocument = useCallback((index: number) => {
    setUploadedDocuments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleImagePreviewError = useCallback((index: number, url: string) => {
    const currentImage = uploadedImagesRef.current[index]
    if (!currentImage || currentImage.url !== url || failedPreviewUrlsRef.current.has(url)) {
      return
    }

    failedPreviewUrlsRef.current.add(url)
    setUploadedImages((prev) => {
      const imageToRemove = prev[index]
      if (!imageToRemove || imageToRemove.url !== url) {
        return prev
      }

      return prev.filter((_, i) => i !== index)
    })
    toast.error('Failed to load image preview')
  }, [])

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items
      if (!items) return

      const pastedImageConversions: Array<Promise<UploadedImage | null>> = []
      let hasPastedImage = false
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item?.type?.startsWith('image/')) continue

        const file = item.getAsFile()
        if (!file) continue

        hasPastedImage = true
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(
            `Image too large to paste. Maximum size is ${formatSizeInMB(MAX_IMAGE_SIZE)}.`
          )
          continue
        }

        pastedImageConversions.push(convertImageFile(file))
      }

      if (!hasPastedImage) {
        return
      }

      // Prevent browsers from inserting plain-text clipboard artifacts into the textarea
      // when image paste is handled as an attachment.
      event.preventDefault()

      if (pastedImageConversions.length === 0) {
        return
      }

      void (async () => {
        const pastedImages = await Promise.all(pastedImageConversions)
        const successfulImages = pastedImages.filter(
          (image): image is UploadedImage => image !== null
        )
        if (successfulImages.length > 0) {
          setUploadedImages((prev) => [...prev, ...successfulImages])
        }
      })()
    },
    [convertImageFile]
  )

  const resetAttachments = useCallback(() => {
    setUploadedImages([])
    setUploadedDocuments([])
  }, [])

  const restoreAttachments = useCallback(
    (images: UploadedImage[], documents: UploadedDocument[]) => {
      setUploadedImages(images)
      setUploadedDocuments(documents)
    },
    []
  )

  const hasAttachments = uploadedImages.length > 0 || uploadedDocuments.length > 0

  const hasCurrentAttachments = useCallback(
    () => uploadedImagesRef.current.length > 0 || uploadedDocumentsRef.current.length > 0,
    []
  )

  return {
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
  }
}
