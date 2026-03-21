export function SkipToContentLink(): React.JSX.Element {
  return (
    <a
      href="#main-content"
      className="focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:bg-background sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      Skip to main content
    </a>
  )
}
