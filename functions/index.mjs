import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { roomAccess } from './rooms.mjs';

initializeApp();
export const coupleRoomAccess = onCall({ maxInstances: 10 }, (request) =>
  roomAccess(getFirestore(), request.auth, request.data),
);
