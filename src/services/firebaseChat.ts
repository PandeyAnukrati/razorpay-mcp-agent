/**
 * Firebase Firestore Chat & Session Storage Service
 * 
 * Stores all chat sessions, message histories, and file metadata
 * in Firebase Firestore under `users/{uid}/sessions/{sessionId}`.
 * Replaces browser localStorage to prevent QuotaExceededError.
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export type Message = {
  id: string
  text: string
  isUser: boolean
  timestamp: string
}

export type UploadedFile = {
  id: string
  name: string
  size: string
  type: "image" | "pdf" | "code" | "other"
  status: "Uploading" | "Uploaded" | "Verified" | "Analyzed"
  previewUrl?: string
  content?: string
}

export type ChatSession = {
  id: string
  uid: string
  subject: string
  status: "Open" | "In Review" | "Resolved"
  priority: "High" | "Medium" | "Low"
  date: string
  messages: Message[]
  files: UploadedFile[]
  updatedAt?: any
  createdAt?: any
}

export function getInitialDefaultSession(uid: string): ChatSession {
  return {
    id: "CHAT-MCP-01",
    uid,
    subject: "Razorpay Virtual Assistant (Claude)",
    status: "Open",
    priority: "Medium",
    date: "Today",
    messages: [
      {
        id: "m1",
        text: "Hello! I am your Razorpay Support Agent powered by Anthropic Claude and the Model Context Protocol (MCP). How can I assist you with your live transactions, payments, refunds, or orders today?",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    files: [],
  }
}

/**
 * Sanitize session data before writing to Firestore.
 * Prevents exceeding Firestore's 1MB per-document size limit by trimming
 * large binary strings or oversized log files.
 */
function sanitizeSessionForFirestore(session: ChatSession): Record<string, any> {
  const sanitizedFiles = (session.files || []).map((f) => {
    // Truncate file content preview to max 25KB to stay well within 1MB limit
    const trimmedContent =
      f.content && f.content.length > 25000
        ? f.content.substring(0, 25000) + "\n...[Content truncated for storage]"
        : f.content

    // Do not store multi-megabyte base64 data URLs in Firestore
    const safePreviewUrl =
      f.previewUrl && f.previewUrl.startsWith("data:") && f.previewUrl.length > 5000
        ? undefined
        : f.previewUrl

    return {
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      status: f.status,
      content: trimmedContent,
      previewUrl: safePreviewUrl,
    }
  })

  // Limit message history to last 100 messages per session if needed
  const sanitizedMessages = (session.messages || []).slice(-100).map((m) => ({
    id: m.id,
    text: m.text || "",
    isUser: Boolean(m.isUser),
    timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }))

  return {
    id: session.id,
    uid: session.uid,
    subject: session.subject || "Support Chat",
    status: session.status || "Open",
    priority: session.priority || "Medium",
    date: session.date || "Today",
    messages: sanitizedMessages,
    files: sanitizedFiles,
    updatedAt: serverTimestamp(),
  }
}

/**
 * Real-time listener for all chat sessions belonging to the authenticated user.
 */
export function subscribeToUserSessions(
  uid: string,
  onUpdate: (sessions: ChatSession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const sessionsCol = collection(db, "users", uid, "sessions")
  const q = query(sessionsCol)

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        // If collection is empty, initialize default session in Firestore
        const defaultSession = getInitialDefaultSession(uid)
        try {
          await saveSessionToFirebase(uid, defaultSession)
        } catch (err) {
          console.warn("Could not write default session to Firestore:", err)
        }
        onUpdate([defaultSession])
        return
      }

      const sessions: ChatSession[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data()
        sessions.push({
          id: data.id || docSnap.id,
          uid: data.uid || uid,
          subject: data.subject || "Support Chat",
          status: data.status || "Open",
          priority: data.priority || "Medium",
          date: data.date || "Today",
          messages: data.messages || [],
          files: data.files || [],
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
        })
      })

      // Sort in-memory by id or timestamp (newest first)
      sessions.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0
        const timeB = b.updatedAt?.toMillis?.() || 0
        return timeB - timeA
      })

      onUpdate(sessions)
    },
    (err) => {
      console.error("Firestore sessions subscription error:", err)
      if (onError) onError(err)
    }
  )
}

/**
 * Save or update a session in Firestore.
 */
export async function saveSessionToFirebase(
  uid: string,
  session: ChatSession
): Promise<void> {
  if (!uid || !session?.id) return

  try {
    const sessionDocRef = doc(db, "users", uid, "sessions", session.id)
    const payload = sanitizeSessionForFirestore(session)
    await setDoc(sessionDocRef, payload, { merge: true })
  } catch (err: any) {
    console.error(`Failed to save session ${session.id} to Firestore:`, err)
    throw err
  }
}

/**
 * Delete a session from Firestore.
 */
export async function deleteSessionFromFirebase(
  uid: string,
  sessionId: string
): Promise<void> {
  if (!uid || !sessionId) return

  try {
    const sessionDocRef = doc(db, "users", uid, "sessions", sessionId)
    await deleteDoc(sessionDocRef)
  } catch (err: any) {
    console.error(`Failed to delete session ${sessionId} from Firestore:`, err)
    throw err
  }
}

/**
 * One-time migration:
 * Migrates any legacy sessions stored in localStorage to Firebase Firestore,
 * and immediately cleans up the bloated localStorage key to clear browser storage quota.
 */
export async function migrateLocalStorageToFirestore(uid: string): Promise<void> {
  if (typeof window === "undefined" || !uid) return

  const storageKey = `rzp_sessions_${uid}`
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed: ChatSession[] = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Firebase Migration] Migrating ${parsed.length} sessions to Firestore...`)
        for (const s of parsed) {
          await saveSessionToFirebase(uid, s)
        }
        console.log("[Firebase Migration] Successfully migrated sessions to Firestore!")
      }
    }
  } catch (err) {
    console.warn("[Firebase Migration] Migration warning:", err)
  } finally {
    // ALWAYS remove the oversized key from localStorage to immediately free quota
    try {
      localStorage.removeItem(storageKey)
      console.log(`[Storage Cleanup] Cleared oversized '${storageKey}' from localStorage.`)
    } catch {
      // ignore
    }
  }
}
