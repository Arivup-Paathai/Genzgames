import { initializeApp } from "firebase/app";

import {
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import {
  getFunctions,
} from "firebase/functions";


const firebaseConfig = {
  apiKey: "AIzaSyDjTyQ-LXVclfe7KcBrxknAPHeS160RLDY",
  authDomain: "multi-games-hub.firebaseapp.com",
  projectId: "multi-games-hub",
  storageBucket: "multi-games-hub.firebasestorage.app",
  messagingSenderId: "1091546453124",
  appId: "1:1091546453124:web:6e395140af883a3ae69ed1"
};

export const app =
  initializeApp(
    firebaseConfig,
  );


export const db =
  getFirestore(
    app,
  );


export const auth =
  getAuth(
    app,
  );


export const functions =
  getFunctions(
    app,
    "asia-south1",
  );


export {
  serverTimestamp,
};