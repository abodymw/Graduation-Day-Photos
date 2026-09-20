// Fill these in from Firebase Console → Project settings → General → Your apps → Web app config.
// These values are safe to be public; access is controlled by Storage Security Rules, not by hiding this file.
const firebaseConfig = {
  apiKey: "AIzaSyBXhlpeigxclR6RcJPTARCdWVJxKhp4rdU",
  authDomain: "graduation-day-photos.firebaseapp.com",
  projectId: "graduation-day-photos",
  storageBucket: "graduation-day-photos.firebasestorage.app",
  messagingSenderId: "919203408554",
  appId: "1:919203408554:web:9a0b5f82dc709f16b6fed3"
};

firebase.initializeApp(firebaseConfig);

// App Check: protects Storage from abuse/scraping outside this site.
// Site key is public by design; the reCAPTCHA key only accepts the
// abodymw.github.io domain (see the reCAPTCHA Enterprise console).
const appCheck = firebase.appCheck();
appCheck.activate(
  new firebase.appCheck.ReCaptchaEnterpriseProvider("6LcC_8UtAAAAAF_b6BDkqPTu4JvDD8cE0umoODk2"),
  true
);

const storage = firebase.storage();
const photosRef = storage.ref("photos");
