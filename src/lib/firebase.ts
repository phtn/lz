import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from 'firebase/auth'

export const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
} satisfies FirebaseOptions

const requiredConfig = {
  PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
}

const missingConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name)

const configurationError = `Missing Firebase configuration: ${missingConfig.join(', ')}`
const isFirebaseConfigured = missingConfig.length === 0

let firebaseApp: FirebaseApp | undefined
let auth: Auth | undefined
let googleProvider: GoogleAuthProvider | undefined

function getFirebaseAuth() {
  if (!isFirebaseConfigured) throw new Error(configurationError)

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    auth = getAuth(firebaseApp)
    googleProvider = new GoogleAuthProvider()
  }

  return { auth: auth!, googleProvider: googleProvider! }
}

let authStateReady = false

export function signInWithGoogle(): Promise<UserCredential> {
  const { auth, googleProvider } = getFirebaseAuth()
  return signInWithPopup(auth, googleProvider)
}

export function signOutCurrentUser(): Promise<void> {
  return signOut(getFirebaseAuth().auth)
}

export function subscribeToAuthState(onStoreChange: () => void): () => void {
  if (!isFirebaseConfigured) {
    authStateReady = true
    queueMicrotask(onStoreChange)
    return () => {}
  }

  return onAuthStateChanged(getFirebaseAuth().auth, () => {
    authStateReady = true
    onStoreChange()
  })
}

export function getCurrentUser(): User | null {
  return isFirebaseConfigured ? getFirebaseAuth().auth.currentUser : null
}

export function getServerAuthUser(): User | null {
  return null
}

export function getAuthStateReady(): boolean {
  return authStateReady
}

export function getServerAuthStateReady(): boolean {
  return false
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = getFirebaseAuth().auth.currentUser
  if (!user) throw new Error('Sign in with Google to access your files.')

  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${await user.getIdToken()}`)
  return await fetch(input, { ...init, headers })
}
