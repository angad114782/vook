import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Check,
  CheckCheck,
  Clock3,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Tag,
  UserRound,
} from "lucide-react";
import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { supportApi, type SupportCommentsResponse, type SupportTicket } from "../../api/support";
import { useSupportComments } from "../../hooks/queries/useSupportQueries";
import { useSocket } from "../../hooks/useSocket";
import { useVirtualizedList } from "../../hooks/useVirtualizedList";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { qk } from "../../lib/queryKeys";
import AppDrawer from "../ui/AppDrawer";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  clientMessageId?: string;
  authorId?: { id?: string; _id?: string; name: string; role: string };
  // Rule 16: no longer using per-message readBy/deliveredTo arrays
};

type TimelineItem =
  | { type: "date"; id: string; label: string }
  | { type: "comment"; id: string; comment: Comment; dateLabel: string };

type ReadCursor = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  lastDeliveredMessageId: string | null;
  lastDeliveredAt: string | null;
};

type CursorFrontier = {
  newest?: { userId: string; timestamp: number };
  secondNewest?: { userId: string; timestamp: number };
};

type CommentPage = Omit<SupportCommentsResponse, "comments"> & { comments: Comment[] };
type CommentsCache = InfiniteData<CommentPage, string | null>;

function updateNewestCommentPage(
  current: CommentsCache | undefined,
  update: (page: CommentPage) => CommentPage,
): CommentsCache {
  if (!current?.pages.length) {
    return {
      pages: [update({ comments: [], hasMore: false, nextCursor: null, readCursors: [] })],
      pageParams: [null],
    };
  }
  const newestPageIndex = current.pages.length - 1;
  return {
    ...current,
    pages: current.pages.map((page, index) => index === newestPageIndex ? update(page as CommentPage) : page),
  };
}

function replaceNewestCommentPage(
  current: CommentsCache | undefined,
  newestPage: CommentPage,
): CommentsCache {
  if (!current?.pages.length) return { pages: [newestPage], pageParams: [null] };
  const newestCommentIds = new Set(newestPage.comments.map((comment) => comment.id));
  const lastPageIndex = current.pages.length - 1;
  return {
    ...current,
    pages: current.pages.map((page, index) => {
      if (index === lastPageIndex) return newestPage;
      return {
        ...page,
        comments: (page as CommentPage).comments.filter((comment) => !newestCommentIds.has(comment.id)),
      };
    }),
  };
}

function buildCursorFrontier(cursors: Iterable<ReadCursor>, field: "lastReadAt" | "lastDeliveredAt"): CursorFrontier {
  const frontier: CursorFrontier = {};
  for (const cursor of cursors) {
    const value = cursor[field];
    const timestamp = value ? new Date(value).getTime() : Number.NaN;
    if (Number.isNaN(timestamp)) continue;
    const candidate = { userId: cursor.userId, timestamp };
    if (!frontier.newest || candidate.timestamp > frontier.newest.timestamp) {
      frontier.secondNewest = frontier.newest;
      frontier.newest = candidate;
    } else if (!frontier.secondNewest || candidate.timestamp > frontier.secondNewest.timestamp) {
      frontier.secondNewest = candidate;
    }
  }
  return frontier;
}

function cursorReachedMessage(frontier: CursorFrontier, authorId: string, createdAt: string): boolean {
  const candidate = frontier.newest?.userId !== authorId ? frontier.newest : frontier.secondNewest;
  return Boolean(candidate && candidate.timestamp >= new Date(createdAt).getTime());
}

function mergeCursor(previous: ReadCursor | undefined, incoming: ReadCursor): ReadCursor {
  const isAtLeastAsRecent = (next: string | null, current: string | null | undefined) =>
    next !== null && (!current || new Date(next).getTime() >= new Date(current).getTime());
  const useIncomingRead = isAtLeastAsRecent(incoming.lastReadAt, previous?.lastReadAt);
  const useIncomingDelivery = isAtLeastAsRecent(incoming.lastDeliveredAt, previous?.lastDeliveredAt);

  return {
    userId: incoming.userId,
    lastReadMessageId: useIncomingRead ? incoming.lastReadMessageId : previous?.lastReadMessageId ?? null,
    lastReadAt: useIncomingRead ? incoming.lastReadAt : previous?.lastReadAt ?? null,
    lastDeliveredMessageId: useIncomingDelivery
      ? incoming.lastDeliveredMessageId
      : previous?.lastDeliveredMessageId ?? null,
    lastDeliveredAt: useIncomingDelivery ? incoming.lastDeliveredAt : previous?.lastDeliveredAt ?? null,
  };
}

type Props = {
  ticket: SupportTicket;
  onClose: () => void;
  onStatusChange?: (id: string, status: string) => void;
  admin?: boolean;
};

const statusMeta: Record<string, { label: string; bg: string; color: string }> =
  {
    PENDING: { label: "Open", bg: "#fef3c7", color: "#92400e" },
    IN_PROGRESS: { label: "In progress", bg: "#dbeafe", color: "#1d4ed8" },
    RESOLVED: { label: "Resolved", bg: "#dcfce7", color: "#166534" },
    CLOSED: { label: "Closed", bg: "#e2e8f0", color: "#475569" },
  };
const priorityMeta: Record<string, { bg: string; color: string }> = {
  LOW: { bg: "#dcfce7", color: "#166534" },
  MEDIUM: { bg: "#fef3c7", color: "#92400e" },
  HIGH: { bg: "#ffedd5", color: "#c2410c" },
  CRITICAL: { bg: "#fee2e2", color: "#b91c1c" },
};
const fmt = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function messageDayKey(value: string): string {
  const date = new Date(value);
  return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const dayDifference = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
      - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000,
  );
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function buildTimeline(comments: readonly Comment[]): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  let previousDay = "";
  for (const comment of comments) {
    const day = messageDayKey(comment.createdAt);
    const dateLabel = formatConversationDate(comment.createdAt);
    if (day !== previousDay) {
      timeline.push({ type: "date", id: "date:" + day, label: dateLabel });
      previousDay = day;
    }
    timeline.push({ type: "comment", id: comment.id, comment, dateLabel });
  }
  return timeline;
}

export default function TicketConversationModal({
  ticket,
  onClose,
  onStatusChange,
  admin = false,
}: Props) {
  const queryClient = useQueryClient();
  const socket = useSocket(); // Shared socket — no new io() call

  const mobileLayout = useMediaQuery("(max-width: 1199px)");

  const {
    data: commentsData,
    isLoading: loadingComments,
    hasPreviousPage,
    isFetchingPreviousPage,
    fetchPreviousPage,
    refetch: refetchComments,
  } = useSupportComments(ticket.id);
  const comments = useMemo(
    () => (commentsData?.pages.flatMap((page) => page.comments) ?? []) as Comment[],
    [commentsData?.pages]
  );
  const newestCommentId = comments[comments.length - 1]?.id;
  const timeline = useMemo(() => buildTimeline(comments), [comments]);
  const canLoadOlderComments = Boolean(hasPreviousPage && (commentsData?.pages.length ?? 0) < 10);

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(() => (
    typeof window === "undefined" || window.matchMedia("(min-width: 1200px)").matches
  ));
  const [threadBounds, setThreadBounds] = useState<{ top: number; left: number; width: number } | null>(null);
  // Rule 16: one cursor per participant — used for receipt display (✓ / ✓✓)
  const [readCursors, setReadCursors] = useState<Map<string, ReadCursor>>(
    new Map()
  );
  // Rule 19: presence per userId
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);
  const joinedTicketRef = useRef<string | null>(null);
  const typingActiveRef = useRef(false); // track if typing:start already emitted
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const closed = ticket.status === "CLOSED";
  const status = statusMeta[ticket.status]!;
  const priority = priorityMeta[ticket.priority]!;
  useEffect(() => {
    if (mobileLayout) setDetailsExpanded(false);
  }, [mobileLayout]);
  const {
    virtualItems,
    totalSize,
    firstVisibleIndex,
    scrollTop,
    getOffset,
    onScroll: onVirtualScroll,
    measureRef,
  } = useVirtualizedList(
    timeline,
    threadRef,
    (item) => item.id,
  );
  const activeDateIndex = useMemo(() => {
    for (let index = Math.min(firstVisibleIndex, timeline.length - 1); index >= 0; index -= 1) {
      if (timeline[index]?.type === "date") return index;
    }
    return -1;
  }, [firstVisibleIndex, timeline]);
  const activeDate = activeDateIndex >= 0 && timeline[activeDateIndex]?.type === "date"
    ? timeline[activeDateIndex]
    : undefined;
  const nextDateIndex = useMemo(() => {
    for (let index = activeDateIndex + 1; index < timeline.length; index += 1) {
      if (timeline[index]?.type === "date") return index;
    }
    return -1;
  }, [activeDateIndex, timeline]);
  const dateHandoffOffset = nextDateIndex >= 0
    ? Math.min(0, getOffset(nextDateIndex) - scrollTop - 28)
    : 0;
  const receiptFrontiers = useMemo(() => ({
    read: buildCursorFrontier(readCursors.values(), "lastReadAt"),
    delivered: buildCursorFrontier(readCursors.values(), "lastDeliveredAt"),
  }), [readCursors]);
  const refreshLatestComments = useCallback(async () => {
    const { data } = await supportApi.getComments(ticket.id, { limit: 50 });
    queryClient.setQueryData<CommentsCache>(
      qk.support.comments(ticket.id),
      (current) => replaceNewestCommentPage(current, data as CommentPage),
    );
  }, [queryClient, ticket.id]);

  // The active date is rendered in a portal so virtualized content and the
  // thread's scroll transform can never move it.
  useLayoutEffect(() => {
    const threadElement = threadRef.current;
    if (!threadElement) return;
    const updateBounds = () => {
      const rect = threadElement.getBoundingClientRect();
      setThreadBounds({ top: rect.top, left: rect.left, width: rect.width });
    };
    updateBounds();
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(threadElement);
    window.addEventListener("resize", updateBounds);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, []);

  // The comments response already includes persisted receipt cursors, so this
  // restores ticks when reopening a modal without a second network request.
  useEffect(() => {
    const cursors = commentsData?.pages.at(-1)?.readCursors;
    if (!cursors) return;
    setReadCursors((previous) => {
      const next = new Map(previous);
      for (const cursor of cursors) {
        next.set(cursor.userId, mergeCursor(next.get(cursor.userId), cursor));
      }
      return next;
    });
  }, [commentsData?.pages]);

  // Dispatch CustomEvent so notification bell knows which ticket is open
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("support-ticket-opened", {
        detail: { ticketId: ticket.id },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("support-ticket-closed", {
          detail: { ticketId: ticket.id },
        })
      );
    };
  }, [ticket.id]);

  // Socket room join + listeners
  useEffect(() => {
    if (closed || !socket) return;

    socket.emit("support:join", { ticketId: ticket.id });
    if (joinedTicketRef.current !== ticket.id) {
      joinedTicketRef.current = ticket.id;
      const cached = queryClient.getQueryData<CommentsCache>(qk.support.comments(ticket.id));
      if (cached?.pages.length) void refreshLatestComments();
      else void refetchComments();
    }

    // Rule 16: merge incoming cursor state
    const onCursorUpdate = ({
      ticketId: tid,
      userId,
      lastReadMessageId,
      lastReadAt,
      lastDeliveredMessageId,
      lastDeliveredAt,
    }: any) => {
      if (tid !== ticket.id) return;
      setReadCursors((prev) => {
        const next = new Map(prev);
        const previous = prev.get(userId);
        next.set(userId, mergeCursor(previous, {
          userId,
          lastReadMessageId,
          lastReadAt,
          lastDeliveredMessageId:
            lastDeliveredMessageId ?? previous?.lastDeliveredMessageId ?? null,
          lastDeliveredAt: lastDeliveredAt ?? previous?.lastDeliveredAt ?? null,
        }));
        return next;
      });
    };

    const onDeliveryCursor = ({
      ticketId: tid,
      userId,
      lastDeliveredMessageId,
      lastDeliveredAt,
    }: ReadCursor & { ticketId: string }) => {
      if (tid !== ticket.id) return;
      setReadCursors((prev) => {
        const next = new Map(prev);
        const previous = prev.get(userId);
        next.set(userId, mergeCursor(previous, {
          userId,
          lastReadMessageId: previous?.lastReadMessageId ?? null,
          lastReadAt: previous?.lastReadAt ?? null,
          lastDeliveredMessageId,
          lastDeliveredAt,
        }));
        return next;
      });
    };

    // Rule 19: presence
    const onPresence = ({
      ticketId: tid,
      userId,
      online,
    }: {
      ticketId: string;
      userId: string;
      online: boolean;
    }) => {
      if (tid !== ticket.id) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const onComment = ({
      ticketId,
      comment,
    }: {
      ticketId: string;
      comment: Comment;
    }) => {
      if (ticketId !== ticket.id) return;
      queryClient.setQueryData<CommentsCache>(
        qk.support.comments(ticket.id),
        (current) => updateNewestCommentPage(current, (page) => {
          const comments = page.comments;
          const optimisticIndex = comment.clientMessageId
            ? comments.findIndex(
                (c) => c.clientMessageId === comment.clientMessageId
              )
            : -1;
          if (optimisticIndex >= 0) {
            const next = [...comments];
            next[optimisticIndex] = comment;
            return { ...page, comments: next };
          }
          return {
            ...page,
            comments: comments.some((c) => c.id === comment.id) ? comments : [...comments, comment],
          };
        })
      );
      // Debounced read — Rule 17: one event covers all messages
      // A received comment is delivered now; read acknowledgement is separate.
      if (comment.id)
        socket.emit("support:delivered", {
          ticketId: ticket.id,
          commentId: comment.id,
        });
      clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => {
        socket.emit("support:read", { ticketId: ticket.id });
      }, 300);
    };

    const onTicketUpdated = ({
      ticketId,
      ticket: updated,
    }: {
      ticketId: string;
      ticket: { status?: string };
    }) => {
      if (ticketId === ticket.id && updated?.status)
        onStatusChange?.(ticketId, updated.status);
    };

    const onTyping = ({
      ticketId,
      isTyping,
    }: {
      ticketId: string;
      isTyping: boolean;
    }) => {
      if (ticketId !== ticket.id) return;
      setTyping(Boolean(isTyping));
      if (isTyping) {
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 1600);
      }
    };

    // Rule 20: on reconnect — rejoin room and refetch from server (source of truth)
    const onReconnect = () => {
      socket.emit("support:join", { ticketId: ticket.id });
      void refreshLatestComments();
    };
    window.addEventListener("socket:reconnect", onReconnect);

    socket.on("support:comment", onComment);
    socket.on("support:read:cursor", onCursorUpdate);
    socket.on("support:delivered:cursor", onDeliveryCursor);
    socket.on("support:presence", onPresence);
    socket.on("support:ticket-updated", onTicketUpdated);
    socket.on("support:typing", onTyping);

    return () => {
      socket.off("support:comment", onComment);
      socket.off("support:read:cursor", onCursorUpdate);
      socket.off("support:delivered:cursor", onDeliveryCursor);
      socket.off("support:presence", onPresence);
      socket.off("support:ticket-updated", onTicketUpdated);
      socket.off("support:typing", onTyping);
      window.removeEventListener("socket:reconnect", onReconnect);
      socket.emit("support:leave", { ticketId: ticket.id });
      clearTimeout(typingTimer.current);
      clearTimeout(readTimer.current);
    };
  }, [ticket.id, closed, socket, queryClient, onStatusChange, refetchComments, refreshLatestComments]);

  // Send initial read on comments load
  useEffect(() => {
    if (!closed && !loadingComments && socket) {
      socket.emit("support:read", { ticketId: ticket.id });
    }
  }, [ticket.id, closed, loadingComments, socket]);

  const loadOlderComments = useCallback(async () => {
    const threadElement = threadRef.current;
    if (!threadElement || !canLoadOlderComments || isFetchingPreviousPage) return;
    prependScrollRef.current = {
      height: threadElement.scrollHeight,
      top: threadElement.scrollTop,
    };
    await fetchPreviousPage();
  }, [canLoadOlderComments, fetchPreviousPage, isFetchingPreviousPage]);

  const handleThreadScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const threadElement = event.currentTarget;
    stickToBottomRef.current =
      threadElement.scrollHeight - threadElement.clientHeight - threadElement.scrollTop < 40;
    onVirtualScroll(event);
    if (threadElement.scrollTop < 80) void loadOlderComments();
  }, [loadOlderComments, onVirtualScroll]);

  // Keep the reader anchored when older messages are prepended. New messages
  // only pull the viewport down when the reader was already at the bottom.
  useLayoutEffect(() => {
    const threadElement = threadRef.current;
    if (!threadElement) return;
    const pending = prependScrollRef.current;
    if (pending) {
      threadElement.scrollTop = pending.top + threadElement.scrollHeight - pending.height;
      prependScrollRef.current = null;
    } else if (stickToBottomRef.current) {
      const animationFrame = window.requestAnimationFrame(() => {
        if (stickToBottomRef.current) threadElement.scrollTop = threadElement.scrollHeight;
      });
      return () => window.cancelAnimationFrame(animationFrame);
    }
  }, [comments.length, newestCommentId]);

  /**
   * Typing throttle — emit typing:start ONCE per burst, not per keypress.
   * Auto-stops after 900ms of inactivity.
   */
  const type = useCallback(
    (value: string) => {
      if (closed) return;
      setDraft(value);
      if (!typingActiveRef.current && value && socket) {
        typingActiveRef.current = true;
        socket.emit("support:typing", { ticketId: ticket.id, isTyping: true });
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        typingActiveRef.current = false;
        socket?.emit("support:typing", {
          ticketId: ticket.id,
          isTyping: false,
        });
      }, 900);
    },
    [closed, socket, ticket.id]
  );

  const stopTyping = useCallback(() => {
    if (typingActiveRef.current && socket) {
      typingActiveRef.current = false;
      clearTimeout(typingTimer.current);
      socket.emit("support:typing", { ticketId: ticket.id, isTyping: false });
    }
  }, [socket, ticket.id]);

  /**
   * Send message — prefer socket path (with clientMessageId for idempotency).
   * Falls back to REST if socket is unavailable.
   */
  const send = useCallback(async () => {
    const body = draft.trim();
    if (closed || !body || sending) return;

    setDraft("");
    setSending(true);
    stopTyping();

    const clientMessageId = crypto.randomUUID();

    // Optimistic UI — show immediately with "sending" state
    const optimisticComment: Comment = {
      id: clientMessageId, // temp ID, will be replaced on ACK
      body,
      createdAt: new Date().toISOString(),
      clientMessageId,
      authorId: undefined, // filled by server response
    };

    queryClient.setQueryData<CommentsCache>(
      qk.support.comments(ticket.id),
      (current) => updateNewestCommentPage(current, (page) => ({
        ...page,
        comments: [...page.comments, optimisticComment],
      }))
    );

    try {
      if (socket && socket.connected) {
        // Socket path — clientMessageId enables idempotent retry
        socket.emit(
          "support:message:send",
          { ticketId: ticket.id, clientMessageId, body },
          (result: { ok: boolean; comment?: Comment; error?: string }) => {
            if (result.ok && result.comment) {
              // Replace optimistic entry with real comment from server
              queryClient.setQueryData<CommentsCache>(
                qk.support.comments(ticket.id),
                (current) => updateNewestCommentPage(current, (page) => ({
                  ...page,
                  comments: page.comments.map((c) =>
                    c.id === clientMessageId ? result.comment! : c
                  ),
                }))
              );
            } else {
              // Remove optimistic entry on failure, restore draft
              queryClient.setQueryData<CommentsCache>(
                qk.support.comments(ticket.id),
                (current) => updateNewestCommentPage(current, (page) => ({
                  ...page,
                  comments: page.comments.filter(
                    (c) => c.id !== clientMessageId
                  ),
                }))
              );
              setDraft(body);
            }
          }
        );
      } else {
        // REST fallback
        const { data } = await supportApi.addComment(
          ticket.id,
          body,
          clientMessageId
        );
        queryClient.setQueryData<CommentsCache>(
          qk.support.comments(ticket.id),
          (current) => updateNewestCommentPage(current, (page) => ({
            ...page,
            comments: page.comments.map((c) =>
              c.id === clientMessageId ? data : c
            ),
          }))
        );
      }
    } catch {
      queryClient.setQueryData<CommentsCache>(
        qk.support.comments(ticket.id),
        (current) => updateNewestCommentPage(current, (page) => ({
          ...page,
          comments: page.comments.filter(
            (c) => c.id !== clientMessageId
          ),
        }))
      );
      setDraft(body);
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }, [closed, draft, sending, socket, ticket.id, queryClient, stopTyping]);

  const changeStatus = useCallback(
    async (value: string) => {
      if (!admin || !onStatusChange) return;
      await supportApi.update(ticket.id, { status: value });
      onStatusChange(ticket.id, value);
    },
    [admin, onStatusChange, ticket.id]
  );

  return (
    <AppDrawer
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={ticket.subject}
      description={(
        <span className="ticket-conversation-drawer__description">
          <span className="ticket-conversation-drawer__context">
            <span>{ticket.ticketNo}</span>
            <span aria-hidden="true">·</span>
            <span>{fmt(ticket.createdAt)}</span>
          </span>
          <span className="ticket-conversation-drawer__mobile-meta" aria-label="Ticket summary">
            <span style={{ color: status.color }}>{status.label}</span>
            <span style={{ color: priority.color }}>{ticket.priority}</span>
            <span className="ticket-conversation-drawer__category">{ticket.category}</span>
          </span>
        </span>
      )}
      size="xl"
      className="ticket-conversation-drawer"
      contentClassName="ticket-conversation-drawer__body"
    >
      <style>
        {
          "@keyframes supportSkeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }"
        }
      </style>
        <div
          className={`ticket-conversation-layout ${detailsExpanded ? "is-details-expanded" : "is-details-collapsed"}`}
          style={{
            ...bodyGrid,
            gridTemplateColumns: detailsExpanded
              ? "minmax(0,1fr) 230px"
              : "minmax(0,1fr) 46px",
          }}
        >
          {/* ── Conversation panel ── */}
          <main className="ticket-conversation-main" style={conversationPanel}>
            <div style={sectionHead}>
              <div>
                <h3 style={sectionTitle}>Conversation</h3>
                <p style={sectionHint}>{comments.length} {comments.length === 1 ? "message" : "messages"} · shared with the requester</p>
              </div>
              <MessageSquare size={17} color="#0d7470" />
            </div>

            <div className="ticket-conversation-thread" ref={threadRef} style={thread} onScroll={handleThreadScroll}>
              {loadingComments ? (
                <>
                  <div
                    style={{
                      ...skeletonBubble,
                      alignSelf: "flex-start",
                      width: "58%",
                    }}
                  >
                    <span />
                    <span />
                  </div>
                  <div
                    style={{
                      ...skeletonBubble,
                      alignSelf: "flex-end",
                      width: "45%",
                    }}
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                  <div
                    style={{
                      ...skeletonBubble,
                      alignSelf: "flex-start",
                      width: "66%",
                    }}
                  >
                    <span />
                    <span />
                  </div>
                </>
              ) : comments.length === 0 ? (
                <p style={emptyStyle}>
                  No messages yet. Start the conversation below.
                </p>
              ) : (
                <div style={{ position: "relative", height: totalSize, minHeight: "100%" }}>
                  {isFetchingPreviousPage && <span style={historyLoading}>Loading earlier messagesâ€¦</span>}
                  {virtualItems.map(({ item, key, top, index }) => {
                  if (item.type === "date") {
                    const mergingWithFloatingDate = index === activeDateIndex && Math.abs(top - scrollTop) < 32;
                    return (
                      <div
                        key={key}
                        ref={(element) => measureRef(key, element)}
                        style={{ ...dateDivider, position: "absolute", top }}
                      >
                        <span style={{ ...datePill, opacity: mergingWithFloatingDate ? 0 : 1 }}>{item.label}</span>
                      </div>
                    );
                  }
                  const comment = item.comment;
                  const mine = admin
                    ? comment.authorId?.role === "SUPER_ADMIN"
                    : comment.authorId?.role !== "SUPER_ADMIN";
                  const isOptimistic = !comment.authorId; // temp optimistic message
                  const authorUserId = comment.authorId?.id ?? comment.authorId?._id;

                  // Rule 16: Check read/delivered state from participant cursors
                  const isRead = authorUserId
                    ? cursorReachedMessage(receiptFrontiers.read, authorUserId, comment.createdAt)
                    : false;
                  const isDelivered = authorUserId
                    ? cursorReachedMessage(receiptFrontiers.delivered, authorUserId, comment.createdAt)
                    : false;

                  return (
                    <article
                      key={key}
                      ref={(element) => measureRef(key, element)}
                      style={{
                        ...bubble,
                        position: "absolute",
                        top,
                        right: mine ? 0 : undefined,
                        left: mine ? undefined : 0,
                        background: mine ? "#e6fffa" : "white",
                        opacity: isOptimistic ? 0.6 : 1,
                      }}
                    >
                      <div style={bubbleMeta}>
                        <strong>{comment.authorId?.name ?? (isOptimistic ? "You" : "User")}</strong>
                        <span>{fmt(comment.createdAt)}</span>
                        {mine && !isOptimistic && (
                          isRead ? <CheckCheck size={13} color="#1687ff" />
                          : isDelivered ? <CheckCheck size={13} color="#94a3b8" />
                          : <Check size={13} color="#94a3b8" />
                        )}
                        {isOptimistic && <span style={{ fontSize: 9, color: "#94a3b8" }}>sending…</span>}
                      </div>
                      <p style={bubbleText}>{comment.body}</p>
                    </article>
                  );
                  })}
                </div>
              )}
              <div style={typingSlot} aria-live="polite">
                {typing && (
                  <span style={typingText}>
                    {admin ? "Requester" : "Support"} is typing…
                  </span>
                )}
              </div>
            </div>

            {closed ? (
              <div className="ticket-conversation-composer" style={closedNotice}>
                This ticket is closed. Further messages cannot be sent.
              </div>
            ) : (
              <div className="ticket-conversation-composer" style={composer}>
                <input
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => type(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Write a reply…"
                  style={composerInput}
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  style={{
                    ...sendButton,
                    opacity: draft.trim() && !sending ? 1 : 0.5,
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            )}
          </main>

          {admin && (
            <label className="ticket-conversation-mobile-status">
              <span>Ticket status</span>
              <select
                value={ticket.status}
                onChange={(e) => void changeStatus(e.target.value)}
                style={statusSelect}
              >
                <option value="PENDING">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          )}

          {/* ── Details sidebar ── */}
          {!mobileLayout && (
          <aside style={detailsExpanded ? side : collapsedSide}>
            <button
              onClick={() => setDetailsExpanded((expanded) => !expanded)}
              className="ticket-conversation-sidebar-toggle"
              style={sidebarToggle}
              aria-label={
                detailsExpanded ? "Collapse ticket details" : "Show ticket details"
              }
              title={detailsExpanded ? "Collapse ticket details" : "Show ticket details"}
            >
              {detailsExpanded ? (
                <PanelRightClose size={15} />
              ) : (
                <PanelRightOpen size={15} />
              )}
            </button>
            {detailsExpanded && (
              <>
                <div style={sideTitle}>Ticket details</div>
                <div style={badgeRow}>
                  <span
                    style={{
                      ...badge,
                      background: status.bg,
                      color: status.color,
                    }}
                  >
                    {status.label}
                  </span>
                  <span
                    style={{
                      ...badge,
                      background: priority.bg,
                      color: priority.color,
                    }}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <div style={detail}>
                  <Tag size={14} />
                  <div style={detailText}>
                    <small>Category</small>
                    <strong>{ticket.category}</strong>
                  </div>
                </div>
                <div style={detail}>
                  <UserRound size={14} />
                  <div style={detailText}>
                    <small
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      Submitted by
                      {Boolean(
                        (ticket.userId || ticket.user?.id) &&
                          onlineUsers.has((ticket.userId || ticket.user?.id)!)
                      ) && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#22c55e",
                            display: "inline-block",
                          }}
                          title="Online"
                        />
                      )}
                    </small>
                    <strong>{ticket.user?.name ?? "Unknown"}</strong>
                  </div>
                </div>
                <div style={detail}>
                  <Building2 size={14} />
                  <div style={detailText}>
                    <small>Company</small>
                    <strong>{ticket.company?.name ?? "—"}</strong>
                  </div>
                </div>
                <div style={detail}>
                  <Clock3 size={14} />
                  <div style={detailText}>
                    <small>Last updated</small>
                    <strong>{fmt(ticket.updatedAt)}</strong>
                  </div>
                </div>
                <div style={description}>
                  <small style={descriptionLabel}>Original request</small>
                  <p style={descriptionText}>{ticket.description}</p>
                </div>
                {admin && (
                  <label style={statusControl}>
                    <span>Update status</span>
                    <select
                      value={ticket.status}
                      onChange={(e) => void changeStatus(e.target.value)}
                      style={statusSelect}
                    >
                      <option value="PENDING">Open</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>
                )}
              </>
            )}
          </aside>
          )}
        </div>
        {activeDate && threadBounds && createPortal(
          <span
            aria-hidden="true"
            style={{
              ...floatingDateLabel,
              position: "fixed",
              top: threadBounds.top + 6 + dateHandoffOffset,
              left: threadBounds.left + threadBounds.width / 2,
              transform: "translateX(-50%)",
              zIndex: 1001,
            }}
          >
            {activeDate.label}
          </span>,
          document.body,
        )}
    </AppDrawer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const bodyGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 230px",
  flex: 1,
  minHeight: 0,
};
const conversationPanel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: "12px 14px 10px",
  borderRight: "1px solid #e2e8f0",
};
const sectionHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 7,
  borderBottom: "1px solid #f1f5f9",
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 750,
};
const sectionHint: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#94a3b8",
  fontSize: 10,
};
const thread: React.CSSProperties = {
  display: "flex",
  position: "relative",
  flex: 1,
  minHeight: 0,
  flexDirection: "column",
  gap: 6,
  overflowY: "auto",
  padding: "10px 2px 24px",
};
const historyLoading: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  display: "block",
  width: "fit-content",
  margin: "0 auto",
  padding: "3px 7px",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 9,
};
const floatingDateLabel: React.CSSProperties = {
  display: "block",
  padding: "3px 8px",
  borderRadius: 10,
  background: "rgba(241,245,249,.96)",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
  pointerEvents: "none",
  transition: "opacity .14s ease-out",
};
const dateDivider: React.CSSProperties = {
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  padding: "3px 0 7px",
  pointerEvents: "none",
};
const datePill: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 10,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
  transition: "opacity .14s ease-out",
};
const emptyStyle: React.CSSProperties = {
  margin: "auto",
  color: "#94a3b8",
  fontSize: 12,
  textAlign: "center",
};
const skeletonBubble: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "10px 12px",
  border: "1px solid #eef2f5",
  borderRadius: 10,
  background: "linear-gradient(90deg, #f8fafc 25%, #eef2f5 50%, #f8fafc 75%)",
  backgroundSize: "200% 100%",
  animation: "supportSkeleton 1.4s ease-in-out infinite",
};
const bubble: React.CSSProperties = {
  width: "fit-content",
  maxWidth: "78%",
  padding: "7px 9px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
};
const bubbleText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};
const bubbleMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#64748b",
  fontSize: 10,
};
const typingText: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#0d7470",
  fontSize: 10,
  fontStyle: "italic",
};
const typingSlot: React.CSSProperties = {
  height: 18,
  display: "flex",
  alignItems: "center",
  paddingLeft: 2,
  flexShrink: 0,
};
const composer: React.CSSProperties = {
  display: "flex",
  gap: 5,
  padding: 4,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
};
const composerInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "5px 7px",
  border: 0,
  outline: 0,
  color: "#0f172a",
  fontSize: 12,
};
const sendButton: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  border: 0,
  borderRadius: 7,
  color: "white",
  background: "#0d7470",
  cursor: "pointer",
};
const closedNotice: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 8,
  color: "#64748b",
  background: "#f8fafc",
  fontSize: 11,
  textAlign: "center",
};
const side: React.CSSProperties = {
  position: "relative",
  overflowY: "auto",
  padding: "12px 13px",
  background: "#fbfdfe",
};
const collapsedSide: React.CSSProperties = {
  position: "relative",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  padding: "12px 7px",
  background: "#fbfdfe",
  borderLeft: "1px solid #e2e8f0",
};
const sidebarToggle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 2,
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  minHeight: 30,
  padding: 0,
  border: "1px solid #dbe5e8",
  borderRadius: 8,
  color: "#0d7470",
  background: "white",
  cursor: "pointer",
};
const sideTitle: React.CSSProperties = {
  marginBottom: 9,
  paddingRight: 36,
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 750,
};
const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 10,
};
const badge: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 700,
};
const detail: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "7px 0",
  borderBottom: "1px solid #eef2f5",
  color: "#0d7470",
};
const detailText: React.CSSProperties = {
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  gap: 3,
  color: "#0f172a",
  fontSize: 11,
  overflow: "hidden",
};
const description: React.CSSProperties = {
  marginTop: 11,
  paddingTop: 9,
  borderTop: "1px solid #e2e8f0",
};
const descriptionLabel: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".35px",
};
const descriptionText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#475569",
  fontSize: 11,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};
const statusControl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  marginTop: 10,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
};
const statusSelect: React.CSSProperties = {
  padding: "7px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  color: "#334155",
  background: "white",
  fontSize: 11,
};
