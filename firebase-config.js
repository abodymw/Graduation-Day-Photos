// Fill these in from Firebase Console → Project settings → General → Your apps → Web app config.
// These values are safe to be public; access is controlled by Storage Security Rules, not by hiding this file.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const photosRef = storage.ref("photos");
