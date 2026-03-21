import { formatSizeInMB } from '@/lib/size'
import { MAX_PDF_FILE_SIZE } from '@/services/constant'

type TableCell = string | number | boolean | null | undefined
type TableRows = TableCell[][]

function formatRowsAsTable(rows: TableRows, addSeparatorAfterHeader = true): string {
  const lines: string[] = []
  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row)) continue
    lines.push(row.join(' | '))
    if (addSeparatorAfterHeader && index === 0) {
      lines.push('-'.repeat(50))
    }
  }
  return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

export interface PDFImage {
  pageNumber: number
  name: string
  width: number
  height: number
  dataUrl: string
}

export interface ParsedFile {
  name: string
  content: string
  mimeType: string
  images?: PDFImage[]
}

function getNormalizedFileMimeType(file: File, fallbackMimeType: string): string {
  const fileType = file.type.toLowerCase()
  if (fileType && fileType !== 'application/octet-stream') {
    return fileType
  }

  return fallbackMimeType
}

async function parsePDF(file: File): Promise<ParsedFile> {
  if (file.size > MAX_PDF_FILE_SIZE) {
    throw new Error(
      `File size (${formatSizeInMB(file.size)}) exceeds the maximum allowed size of ${formatSizeInMB(
        MAX_PDF_FILE_SIZE
      )}`
    )
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/parse-pdf', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || errorData.error || 'Failed to parse PDF')
  }

  const data = await response.json()

  let content = `[PDF File: ${file.name}]\n\nPages: ${data.pages}\n\n`

  if (data.images && data.images.length > 0) {
    content += `Images found: ${data.images.length}\n\n`
  }

  content += data.content

  return {
    name: file.name,
    content,
    mimeType: getNormalizedFileMimeType(file, 'application/pdf'),
    images: data.images || []
  }
}

async function parseTextDocument(file: File): Promise<ParsedFile> {
  const text = await file.text()
  const fallbackMimeType = file.name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain'

  return {
    name: file.name,
    content: text,
    mimeType: getNormalizedFileMimeType(file, fallbackMimeType)
  }
}

async function parseCSV(file: File): Promise<ParsedFile> {
  const { default: Papa } = await import('papaparse')
  const fallbackMimeType = 'text/csv'

  return new Promise((resolve, reject) => {
    Papa.parse<TableCell[]>(file, {
      complete: (results) => {
        let content = `[CSV File: ${file.name}]\n\n`
        if (results.data && results.data.length > 0) {
          content += formatRowsAsTable(results.data)
        }
        resolve({
          name: file.name,
          content,
          mimeType: getNormalizedFileMimeType(file, fallbackMimeType)
        })
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const [arrayBuffer, XLSX] = await Promise.all([file.arrayBuffer(), import('xlsx')])
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const fallbackMimeType = file.name.toLowerCase().endsWith('.xls')
    ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  let content = `[Excel File: ${file.name}]\n\n`

  for (const [index, sheetName] of workbook.SheetNames.entries()) {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<TableCell[]>(worksheet, { header: 1 })

    content += `Sheet: ${sheetName}\n`
    content += '-'.repeat(50) + '\n'
    content += formatRowsAsTable(jsonData)

    if (index < workbook.SheetNames.length - 1) {
      content += '\n'
    }
  }

  return {
    name: file.name,
    content,
    mimeType: getNormalizedFileMimeType(file, fallbackMimeType)
  }
}

type FileParser = (file: File) => Promise<ParsedFile>

const fileTypeParsers: Array<{ test: (type: string, name: string) => boolean; parse: FileParser }> =
  [
    {
      test: (type, name) =>
        type === 'text/plain' ||
        type === 'text/markdown' ||
        name.endsWith('.txt') ||
        name.endsWith('.md'),
      parse: parseTextDocument
    },
    {
      test: (type, name) => type === 'text/csv' || name.endsWith('.csv'),
      parse: parseCSV
    },
    {
      test: (type, name) =>
        type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        type === 'application/vnd.ms-excel' ||
        name.endsWith('.xlsx') ||
        name.endsWith('.xls'),
      parse: parseExcel
    },
    {
      test: (type, name) => type === 'application/pdf' || name.endsWith('.pdf'),
      parse: parsePDF
    }
  ]

export async function parseFile(file: File): Promise<ParsedFile> {
  const fileType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()

  const parser = fileTypeParsers.find(({ test }) => test(fileType, fileName))
  if (parser) {
    return parser.parse(file)
  }

  throw new Error(`Unsupported file type: ${fileType || fileName}`)
}
