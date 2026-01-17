import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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