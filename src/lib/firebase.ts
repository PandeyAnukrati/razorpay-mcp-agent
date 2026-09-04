import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyC3Ye2MKlzRMlUwWoPkqLK-TwpmJV0cKxU",
  authDomain: "duvolabs.firebaseapp.com",
  projectId: "duvolabs",
  storageBucket: "duvolabs.firebasestorage.app",
  messagingSenderId: "889046396784",
  appId: "1:889046396784:web:bac6e680e1f65fd38a29b5",
  measurementId: "G-DSPM7CK9M1",
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null
export const auth = getAuth(app)
export const db = getFirestore(app)

