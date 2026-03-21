'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AppButton, AppIconButton } from '@/components/common/app-button'
import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { resolveChatTitle } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'
import { isMobileViewport } from '@/lib/viewport'
import {
  selectChatList,
  selectCurrentChatId,
  selectGetMessagesForChat,
  selectIsChatHydrated,
  selectOnChangeChat,
  selectOnCreateDefaultChat,
  selectOnDeleteChat,
  selectUpdateChatPinned,
  selectUpdateChatTitle,
  useChatStore
} from '@/store/chat-store'
import {
  selectClosePersonaPanel,
  selectOpenPersonaPanel,
  usePersonaUiStore
} from '@/store/persona-ui-store'
import {
  Bot,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2
} from 'lucide-react'

function preloadPersonaPanel(): void {
  if (typeof window !== 'undefined') {
    void import('@/app/chat/persona-panel')
  }
}

type ChatListItem = ReturnType<typeof selectChatList>[number]

export function SideBar(): React.JSX.Element {
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  const openPersonaPanel = usePersonaUiStore(selectOpenPersonaPanel)
  const closePersonaPanel = usePersonaUiStore(selectClosePersonaPanel)
  const currentChatId = useChatStore(selectCurrentChatId)
  const isChatHydrated = useChatStore(selectIsChatHydrated)
  const chatList = useChatStore(selectChatList)
  const getMessagesForChat = useChatStore(selectGetMessagesForChat)
  const onDeleteChat = useChatStore(selectOnDeleteChat)
  const onChangeChat = useChatStore(selectOnChangeChat)
  const onCreateDefaultChat = useChatStore(selectOnCreateDefaultChat)
  const updateChatTitle = useChatStore(selectUpdateChatTitle)
  const updateChatPinned = useChatStore(selectUpdateChatPinned)
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
  const [chatPendingDelete, setChatPendingDelete] = useState<ChatListItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const trimmedRenameValue = renameValue.trim()

  const closeMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  const handleNewChat = useCallback(() => {
    const emptyChat = chatList.find((chat) => getMessagesForChat(chat.id).length === 0)

    if (emptyChat) {
      onChangeChat(emptyChat)
    } else {
      onCreateDefaultChat()
    }

    closePersonaPanel()
    closeMobile()
  }, [
    chatList,
    closePersonaPanel,
    closeMobile,
    getMessagesForChat,
    onChangeChat,
    onCreateDefaultChat
  ])

  const handleOpenPersonaLibrary = useCallback(() => {
    openPersonaPanel()
    closeMobile()
  }, [openPersonaPanel, closeMobile])

  const startRename = useCallback((chatId: string, currentTitle: string) => {
    setRenamingChatId(chatId)
    setRenameValue(currentTitle)
  }, [])

  const cancelRename = useCallback(() => {
    setRenamingChatId(null)
    setRenameValue('')
  }, [])

  const confirmRename = useCallback(() => {
    if (renamingChatId && trimmedRenameValue) {
      updateChatTitle(renamingChatId, trimmedRenameValue)
    }
    cancelRename()
  }, [cancelRename, renamingChatId, trimmedRenameValue, updateChatTitle])

  const handleDeleteChat = useCallback((chat: ChatListItem): void => {
    setChatPendingDelete(chat)
  }, [])

  const confirmDeleteChat = useCallback((): void => {
    if (!chatPendingDelete) {
      return
    }

    onDeleteChat(chatPendingDelete)
    setChatPendingDelete(null)
  }, [chatPendingDelete, onDeleteChat])

  const handleDeleteConfirmOpenChange = useCallback((open: boolean): void => {
    if (!open) {
      setChatPendingDelete(null)
    }
  }, [])

  const isDeleteConfirmOpen = chatPendingDelete !== null

  useEffect(() => {
    if (renamingChatId && renameInputRef.current && !isMobileViewport()) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingChatId])

  const { pinnedChats, recentChats } = useMemo(() => {
    const nextPinnedChats: typeof chatList = []
    const nextRecentChats: typeof chatList = []

    for (const chat of chatList) {
      if (chat.pinned) {
        nextPinnedChats.push(chat)
        continue
      }

      nextRecentChats.push(chat)
    }

    return {
      pinnedChats: nextPinnedChats,
      recentChats: nextRecentChats
    }
  }, [chatList])

  const renderChatItem = useCallback(
    (chat: (typeof chatList)[number]) => {
      const isActive = currentChatId === chat.id
      const chatTitle = resolveChatTitle(chat)
      const isPinned = chat.pinned === true

      const selectChat = () => {
        onChangeChat(chat)
        closePersonaPanel()
        closeMobile()
      }

      const handleRenameMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation()
        startRename(chat.id, chatTitle)
      }

      const handlePinMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation()
        updateChatPinned(chat.id, !isPinned)
      }

      const handleDeleteMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation()
        handleDeleteChat(chat)
      }

      return (
        <SidebarMenuItem
          key={chat.id}
          className="[contain-intrinsic-size:auto_44px] [content-visibility:auto]"
        >
          <ButtonWithTooltip
            placement="right"
            label={<p className="text-pretty break-words">{chatTitle}</p>}
          >
            <SidebarMenuButton
              isActive={isActive}
              onClick={selectChat}
              className={cn('h-11 pr-10 md:h-9', !isActive && 'hover:bg-sidebar-accent/50')}
            >
              <span className="truncate">{chatTitle}</span>
            </SidebarMenuButton>
          </ButtonWithTooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction
                showOnHover
                className="!top-0 !right-0 !size-11 rounded-lg md:!size-9"
                aria-label="Chat options"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer" onClick={handleRenameMenuClick}>
                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                  Rename…
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handlePinMenuClick}>
                  {isPinned ? (
                    <PinOff className="mr-2 size-4" aria-hidden="true" />
                  ) : (
                    <Pin className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleDeleteMenuClick}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      )
    },
    [
      currentChatId,
      closePersonaPanel,
      closeMobile,
      handleDeleteChat,
      onChangeChat,
      startRename,
      updateChatPinned
    ]
  )

  return (
    <>
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarHeader className="px-2 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <Link
              href="/chat"
              className="group focus-visible:ring-ring/50 focus-visible:ring-offset-background flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span
                className="text-primary/70 group-hover:text-primary font-serif text-lg transition-colors duration-200"
                aria-hidden="true"
              >
                ✦
              </span>
              <span className="text-foreground group-hover:text-primary font-display text-lg font-medium tracking-tight transition-colors duration-200">
                ChatGPT Lite
              </span>
            </Link>
            <ButtonWithTooltip label="Close sidebar" placement="bottom">
              <AppIconButton
                type="button"
                variant="ghost"
                onClick={toggleSidebar}
                className="hover:bg-primary/5 rounded-lg transition-colors duration-200"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="size-4" aria-hidden="true" />
              </AppIconButton>
            </ButtonWithTooltip>
          </div>
          <AppButton
            type="button"
            variant="outline"
            onClick={handleNewChat}
            className="text-foreground border-border/60 hover:bg-primary/5 hover:border-primary/30 justify-start rounded-lg"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">New chat</span>
          </AppButton>
        </SidebarHeader>
        <SidebarContent>
          {chatList.length === 0 && isChatHydrated ? (
            <Empty className="items-start gap-4 border-0 px-2 py-12 text-left">
              <EmptyHeader className="items-start text-left">
                <EmptyMedia
                  variant="icon"
                  className="border-border/40 relative mb-0 size-16 rounded-2xl border shadow-sm [&_svg:not([class*='size-'])]:size-7"
                >
                  <span
                    className="text-primary/20 absolute -top-1.5 -right-1.5 font-serif text-sm"
                    aria-hidden="true"
                  >
                    ✦
                  </span>
                  <MessageSquare className="text-muted-foreground size-7" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground text-sm font-normal text-pretty">
                  No conversations yet
                </EmptyTitle>
                <EmptyDescription className="text-muted-foreground text-xs tracking-wide text-pretty">
                  Start one above
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {pinnedChats.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Pin className="text-primary/70 mr-1 size-3" aria-hidden="true" />
                    Pinned
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>{pinnedChats.map(renderChatItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
              {recentChats.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Recent</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>{recentChats.map(renderChatItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </>
          )}
        </SidebarContent>
        <SidebarFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleOpenPersonaLibrary}
                onMouseEnter={preloadPersonaPanel}
                onFocus={preloadPersonaPanel}
                className="h-11 md:h-9"
              >
                <Bot className="text-primary/70 size-4" aria-hidden="true" />
                <span>Persona Library</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <Dialog
        open={renamingChatId !== null}
        onOpenChange={(open) => {
          if (!open) {
            cancelRename()
          }
        }}
      >
        <DialogContent className="overscroll-behavior-contain sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">Rename chat</DialogTitle>
            <DialogDescription className="text-pretty">
              Choose a clearer title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="chat-rename-title">Title</Label>
            <Input
              id="chat-rename-title"
              name="chat-title"
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (trimmedRenameValue) {
                    confirmRename()
                  }
                }
              }}
              autoComplete="off"
              aria-label="Chat title"
              className="bg-background focus-visible:ring-offset-background focus-visible:ring-offset-2"
            />
          </div>
          <DialogFooter>
            <AppButton type="button" variant="outline" onClick={cancelRename}>
              Cancel
            </AppButton>
            <AppButton type="button" onClick={confirmRename} disabled={!trimmedRenameValue}>
              Save
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={isDeleteConfirmOpen}
        onOpenChange={handleDeleteConfirmOpenChange}
        title="Delete this chat?"
        description="This removes its messages and cannot be undone."
        confirmLabel="Delete chat"
        confirmVariant="destructive"
        onConfirm={confirmDeleteChat}
      />
    </>
  )
}
