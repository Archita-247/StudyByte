// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 PASTE YOUR CONFIG HERE (replace below)
const firebaseConfig = {
  apiKey: "AIzaSyCrBmLtW0hK5pShfSTTX8uDITdXadTI72s",
  authDomain: "studybyte-a5743.firebaseapp.com",
  projectId: "studybyte-a5743",
  storageBucket: "studybyte-a5743.firebasestorage.app",
  messagingSenderId: "373579305607",
  appId: "1:373579305607:web:cb8b2090148fadb7289e22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export
export const auth = getAuth(app);
export const db = getFirestore(app);