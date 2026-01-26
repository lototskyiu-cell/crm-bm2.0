
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSFoef4Qrr3fYFzAwouJ34DDUyhW5T-qU",
  authDomain: "crm-bm-2-prod.firebaseapp.com",
  projectId: "crm-bm-2-prod",
  storageBucket: "crm-bm-2-prod.firebasestorage.app",
  messagingSenderId: "259059572732",
  appId: "1:259059572732:web:11868a9ad9dce246f7dc79"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn("Firestore persistence failed-precondition: multiple tabs open");
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn("Firestore persistence unimplemented in this browser");
    }
});
