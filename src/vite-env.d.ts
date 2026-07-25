/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_SITE_GATE?: string;
  readonly VITE_BUILD_VERSION?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Sole admin Firebase Auth UID — must match firestore.rules isAdmin() */
  readonly VITE_ADMIN_UID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
