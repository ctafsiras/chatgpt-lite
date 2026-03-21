'use client'

import { isValidElement, memo, useCallback, useMemo, type ReactNode } from 'react'
import { CopyStatusAnnouncement } from '@/components/accessibility/copy-status-announcement'
import { AppIconButton } from '@/components/common/app-button'
import { Separator } from '@/components/ui/separator'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { cn } from '@/lib/utils'
import type { Element, Nodes, Properties, Root } from 'hast'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { PluggableList } from 'unified'

const HIGHLIGHT_LANGUAGE_ALLOWLIST = new Set([
  'arduino',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'go',
  'graphql',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'objectivec',
  'perl',
  'php',
  'php-template',
  'plaintext',
  'python',
  'python-repl',
  'r',
  'ruby',
  'rust',
  'scss',
  'shell',
  'sql',
  'swift',
  'typescript',
  'vbnet',
  'wasm',
  'xml',
  'yaml'
])

const HIGHLIGHT_LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  svg: 'xml',
  md: 'markdown',
  'c++': 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  objc: 'objectivec',
  txt: 'plaintext',
  text: 'plaintext',
  plain: 'plaintext'
}

function normalizeHighlightLanguage(input: string): string {
  const language = input.trim().toLowerCase()
  return HIGHLIGHT_LANGUAGE_ALIASES[language] ?? language
}

const WHITESPACE_REGEX = /\s+/

function getClassList(rawClassName: Properties[string]): string[] {
  if (Array.isArray(rawClassName)) {
    return rawClassName.filter(
      (value: string | number): value is string => typeof value === 'string'
    )
  }

  if (typeof rawClassName === 'string') {
    return rawClassName.split(WHITESPACE_REGEX).filter(Boolean)
  }

  return []
}

function getHighlightLanguage(classList: string[]): string | null {
  const languageClass = classList.find((value) => value.startsWith('language-'))

  if (!languageClass) {
    return null
  }

  const normalized = normalizeHighlightLanguage(languageClass.slice('language-'.length))
  return HIGHLIGHT_LANGUAGE_ALLOWLIST.has(normalized) ? normalized : null
}

function rehypeNormalizeCodeLanguage(): (tree: Root) => void {
  return function transformer(tree: Root): void {
    const visit = (node: Nodes): void => {
      if (node.type === 'element' && node.tagName === 'code') {
        const rawClassName = node.properties['className'] ?? node.properties['class']
        const classList = getClassList(rawClassName)

        const languageClassIndex = classList.findIndex((c) => c.startsWith('language-'))

        if (languageClassIndex !== -1) {
          const normalized = getHighlightLanguage(classList)

          if (normalized) {
            classList[languageClassIndex] = `language-${normalized}`
          } else {
            classList.splice(languageClassIndex, 1)
          }

          if (classList.length > 0) node.properties['className'] = classList
          else delete node.properties['className']
        }
      }

      if ('children' in node) {
        for (const child of (node as Element).children) visit(child)
      }
    }

    visit(tree)
  }
}

const remarkPluginList: PluggableList = [remarkGfm, remarkMath]

const rehypePluginList: PluggableList = [
  rehypeKatex,
  rehypeNormalizeCodeLanguage,
  [rehypeHighlight, { detect: false }]
]

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node) && node.props) {
    return extractText((node.props as { children?: React.ReactNode }).children)
  }
  return String(node ?? '')
}

function extractLanguage(children: React.ReactNode): string | null {
  const child = Array.isArray(children) ? children[0] : children
  if (!isValidElement(child)) return null

  const className = (child.props as { className?: string | string[] }).className
  return getHighlightLanguage(getClassList(className))
}

function CodeBlockCopyButton({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { copy, copied } = useCopyToClipboard()
  const handleCopy = useCallback(() => {
    void copy(extractText(children))
  }, [copy, children])

  return (
    <>
      <AppIconButton
        type="button"
        size="icon-sm"
        variant="ghost"
        touch={false}
        mutedDisabled={false}
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground hover:bg-primary/5 size-11 shrink-0 md:size-7"
        aria-label={copied ? 'Code copied to clipboard' : 'Copy code'}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </AppIconButton>
      <CopyStatusAnnouncement copied={copied} message="Code copied to clipboard." />
    </>
  )
}

export interface MarkdownProps {
  className?: string
  children: string
  renderLinkAnnotation?: (href: string) => ReactNode | null
}

const STATIC_COMPONENTS: Components = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-balance first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-3 mb-2 text-xl font-bold tracking-tight text-balance first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-3 mb-1.5 text-lg font-semibold tracking-[-0.01em] text-balance first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mt-2 mb-1 text-lg font-semibold text-balance first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-pretty last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc pl-5 [&>li+li]:mt-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal pl-5 [&>li+li]:mt-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="text-muted-foreground border-primary/20 my-2 border-l-2 pl-3 italic">
      {children}
    </blockquote>
  ),
  hr: () => <Separator className="my-3" />,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = className?.includes('language-') || className?.includes('hljs')
    if (isBlock) {
      return <code className={cn('text-xs', className)}>{children}</code>
    }
    return (
      <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-xs">
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => {
    const language = extractLanguage(children)
    return (
      <div className="bg-muted border-border/40 my-2 overflow-hidden rounded-lg border">
        {language && (
          <div className="border-border/50 flex items-center justify-between border-b px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs select-none">
              <span className="capitalize">{language}</span>
            </div>
            <CodeBlockCopyButton>{children}</CodeBlockCopyButton>
          </div>
        )}
        <div className="relative">
          {!language && (
            <div className="absolute top-2 right-2 z-10">
              <CodeBlockCopyButton>{children}</CodeBlockCopyButton>
            </div>
          )}
          <pre className="overflow-x-auto p-3 text-xs">{children}</pre>
        </div>
      </div>
    )
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="border-border my-2 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/60">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-border border-b last:border-b-0">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="text-foreground px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="text-foreground px-3 py-2 tabular-nums">{children}</td>
  )
}

function createMarkdownComponents(
  renderLinkAnnotation?: (href: string) => ReactNode | null
): Components {
  return {
    ...STATIC_COMPONENTS,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const link = (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary decoration-primary/60 hover:decoration-primary focus-visible:ring-ring/50 focus-visible:ring-offset-background rounded-sm underline underline-offset-2 hover:decoration-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {children}
        </a>
      )

      if (!href || !renderLinkAnnotation) {
        return link
      }

      const annotation = renderLinkAnnotation(href)
      if (annotation == null) {
        return link
      }

      return (
        <>
          {link}
          {annotation}
        </>
      )
    }
  }
}

export const Markdown = memo(function Markdown({
  className,
  children,
  renderLinkAnnotation
}: MarkdownProps): React.JSX.Element {
  const components = useMemo(
    () => createMarkdownComponents(renderLinkAnnotation),
    [renderLinkAnnotation]
  )

  return (
    <div
      className={cn(
        'markdown-body max-w-none break-words',
        '[&_.katex]{font-size:1em;}',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPluginList}
        rehypePlugins={rehypePluginList}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
