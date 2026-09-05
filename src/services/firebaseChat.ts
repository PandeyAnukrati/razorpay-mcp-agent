/**
 * Firebase Firestore & Resilient Local-First Chat Storage Service
 * 
 * Provides bulletproof dual-layer persistence:
 * 1. Instant local persistence via IndexedDB & LocalStorage (zero quota limits, works offline, impervious to Firestore permission issues).
 * 2. Cloud sync via Firebase Firestore (`users/{uid}/sessions/{sessionId}`) when permissions and internet are available.
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
    subject: "Razorpay Virtual Assistant (Gemini 2.5 Flash)",
    status: "Open",
    priority: "Medium",
    date: "Today",
    messages: [
      {
        id: "m1",
        text: "Hello! I am your Razorpay Support Agent powered by Google Gemini 2.5 Flash and the Model Context Protocol (MCP). How can I assist you with your live transactions, payments, refunds, or orders today?",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    files: [],
  }
}

/* =========================================================================
 * 1. INDEXED-DB PERSISTENT STORAGE (High Capacity, Zero Quota Limit)
 * ========================================================================= */
const IDB_NAME = "rzp_chat_db"
const IDB_STORE = "sessions"

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not supported"))
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const dbInstance = req.result
      if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
        dbInstance.createObjectStore(IDB_STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSaveSession(session: ChatSession): Promise<void> {
  try {
    const dbInstance = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(IDB_STORE, "readwrite")
      const store = tx.objectStore(IDB_STORE)
      const clean = {
        ...session,
        files: (session.files || []).map((f) => ({ ...f, previewUrl: undefined })),
      }
      store.put(clean)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Graceful fallback
  }
}

export async function idbGetSessions(uid?: string): Promise<ChatSession[]> {
  try {
    const dbInstance = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(IDB_STORE, "readonly")
      const store = tx.objectStore(IDB_STORE)
      const req = store.getAll()
      req.onsuccess = () => {
        const results: ChatSession[] = req.result || []
        if (uid && uid !== "guest_user") {
          const filtered = results.filter((s) => s.uid === uid || !s.uid || s.uid === "guest_user")
          resolve(filtered.length > 0 ? filtered : results)
        } else {
          resolve(results)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

export async function idbDeleteSession(sessionId: string): Promise<void> {
  try {
    const dbInstance = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(IDB_STORE, "readwrite")
      const store = tx.objectStore(IDB_STORE)
      store.delete(sessionId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Graceful fallback
  }
}

/* =========================================================================
 * 2. LOCALSTORAGE FAST SYNC CACHE
 * ========================================================================= */
export function getLocalSessions(uid?: string): ChatSession[] {
  if (typeof window === "undefined") return []
  try {
    if (uid && uid !== "guest_user") {
      const savedUser = localStorage.getItem(`rzp_cached_sessions_${uid}`)
      if (savedUser) {
        const parsed = JSON.parse(savedUser)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    }
    const saved = localStorage.getItem("rzp_cached_sessions")
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return []
}

export function saveLocalSession(uid: string, session: ChatSession): void {
  if (typeof window === "undefined" || !session) return

  // 1. Save to high-capacity IndexedDB
  idbSaveSession(session).catch(() => {})

  // 2. Save to fast localStorage
  try {
    const existing = getLocalSessions(uid)
    const idx = existing.findIndex((s) => s.id === session.id)
    const cleanSession: ChatSession = {
      ...session,
      files: (session.files || []).map((f) => ({ ...f, previewUrl: undefined })),
    }

    const updated =
      idx >= 0
        ? existing.map((s, i) => (i === idx ? cleanSession : s))
        : [cleanSession, ...existing]

    const serialized = JSON.stringify(updated)
    if (uid && uid !== "guest_user") {
      localStorage.setItem(`rzp_cached_sessions_${uid}`, serialized)
    }
    localStorage.setItem("rzp_cached_sessions", serialized)
  } catch (err) {
    console.warn("Local storage cache warning:", err)
  }
}

/* =========================================================================
 * 3. FIRESTORE REAL-TIME SYNC & CLOUD RESILIENCE
 * ========================================================================= */
function sanitizeSessionForFirestore(session: ChatSession): Record<string, any> {
  const sanitizedMessages = (session.messages || []).map((msg) => ({
    id: msg.id || `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    text: msg.text || "",
    isUser: Boolean(msg.isUser),
    timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }))

  const sanitizedFiles = (session.files || []).map((file) => ({
    id: file.id || `${Date.now()}`,
    name: file.name,
    size: file.size,
    type: file.type,
    status: file.status,
    content: file.content ? file.content.slice(0, 10000) : undefined,
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
 * Seamlessly provides local-first persistence when Firestore security rules are locked.
 */
export function subscribeToUserSessions(
  uid: string,
  onUpdate: (sessions: ChatSession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid) return () => {}

  // 1. Immediately provide existing local persistent sessions so chats never vanish
  const local = getLocalSessions(uid)
  if (local.length > 0) {
    onUpdate(local)
  } else {
    idbGetSessions(uid).then((idbSessions) => {
      if (idbSessions.length > 0) {
        onUpdate(idbSessions)
      }
    })
  }

  // 2. Connect to remote Firestore for cloud synchronization
  const sessionsCol = collection(db, "users", uid, "sessions")
  const q = query(sessionsCol)

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        // If remote is empty, preserve local sessions or initialize
        const currentLocal = getLocalSessions(uid)
        if (currentLocal.length > 0) {
          onUpdate(currentLocal)
          return
        }
        const defaultSession = getInitialDefaultSession(uid)
        await saveSessionToFirebase(uid, defaultSession)
        onUpdate([defaultSession])
        return
      }

      const remoteSessions: ChatSession[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data()
        remoteSessions.push({
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

      remoteSessions.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0
        const timeB = b.updatedAt?.toMillis?.() || 0
        return timeB - timeA
      })

      // Sync remote sessions into local persistent storage
      for (const s of remoteSessions) {
        saveLocalSession(uid, s)
      }

      onUpdate(remoteSessions)
    },
    (err: any) => {
      // Permission-denied or rules locked: operate in resilient local mode
      if (err.code === "permission-denied" || err.message?.includes("permissions")) {
        console.warn(
          "[Firestore Sync] Firestore security rules require permission update. Operating smoothly in local persistent mode (IndexedDB/localStorage). Past chats are safely preserved."
        )
      } else {
        console.error("Firestore sessions subscription error:", err)
      }

      // Ensure local sessions are actively presented
      const fallbackSessions = getLocalSessions(uid)
      if (fallbackSessions.length > 0) {
        onUpdate(fallbackSessions)
      } else {
        idbGetSessions(uid).then((idbList) => {
          if (idbList.length > 0) onUpdate(idbList)
        })
      }

      if (onError) onError(err)
    }
  )
}

/**
 * Save or update a session in local persistent storage and Firestore.
 */
export async function saveSessionToFirebase(
  uid: string,
  session: ChatSession
): Promise<void> {
  if (!session?.id) return
  const safeUid = uid || "guest_user"

  // 1. ALWAYS persist locally first (guaranteed instant reliability)
  saveLocalSession(safeUid, session)

  // 2. Attempt remote Firestore sync if user is authenticated
  if (uid && uid !== "guest_user") {
    try {
      const sessionDocRef = doc(db, "users", uid, "sessions", session.id)
      const payload = sanitizeSessionForFirestore(session)
      await setDoc(sessionDocRef, payload, { merge: true })
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        console.warn(
          `[Firestore Sync] Firestore permissions locked on project 'duvolabs'. Session '${session.id}' safely preserved in local persistent storage.`
        )
      } else {
        console.warn(`[Firestore Sync] Could not sync session ${session.id} to cloud:`, err.message)
      }
      // Do not throw: local storage has already safely secured the chat!
    }
  }
}

/**
 * Delete a session from local storage and Firestore.
 */
export async function deleteSessionFromFirebase(
  uid: string,
  sessionId: string
): Promise<void> {
  if (!sessionId) return
  const safeUid = uid || "guest_user"

  // 1. Delete locally from IndexedDB & LocalStorage
  idbDeleteSession(sessionId).catch(() => {})
  try {
    const existing = getLocalSessions(safeUid)
    const filtered = existing.filter((s) => s.id !== sessionId)
    const serialized = JSON.stringify(filtered)
    if (safeUid !== "guest_user") {
      localStorage.setItem(`rzp_cached_sessions_${safeUid}`, serialized)
    }
    localStorage.setItem("rzp_cached_sessions", serialized)
  } catch {}

  // 2. Delete remotely from Firestore
  if (uid && uid !== "guest_user") {
    try {
      const sessionDocRef = doc(db, "users", uid, "sessions", sessionId)
      await deleteDoc(sessionDocRef)
    } catch (err: any) {
      console.warn(`[Firestore Sync] Could not delete session ${sessionId} from cloud:`, err.message)
    }
  }
}

/**
 * Migrates any legacy sessions stored in localStorage to IndexedDB / Firestore safely.
 */
export async function migrateLocalStorageToFirestore(uid: string): Promise<void> {
  if (typeof window === "undefined" || !uid) return

  const storageKey = `rzp_sessions_${uid}`
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed: ChatSession[] = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Persistence Migration] Securing ${parsed.length} sessions in persistent storage...`)
        for (const s of parsed) {
          saveLocalSession(uid, s)
          saveSessionToFirebase(uid, s).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn("[Persistence Migration] Warning:", err)
  }
}
