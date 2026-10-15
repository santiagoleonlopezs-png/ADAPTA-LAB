import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore, collection, doc, setDoc, getDoc, onSnapshot, serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const configured = firebaseConfig.projectId && !firebaseConfig.projectId.startsWith('REEMPLAZAR');
let auth, db, unsub;
let firebaseReady=false;
const status = document.getElementById('teacherError');
if(configured){
 try {
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);firebaseReady=true;
  onAuthStateChanged(auth,()=>teacherState());
 }catch(e){status.textContent='Error de configuración Firebase: '+e.message}
}
function teacherState(){
 const signed=auth?.currentUser && !auth.currentUser.isAnonymous;
 document.getElementById('teacherLogin').classList.toggle('hidden',!!signed);
 document.getElementById('teacherControls').classList.toggle('hidden',!signed);
 if(!signed){unsub?.();unsub=null;document.getElementById('teacherData').classList.add('hidden');}
}
async function submit(report){
 if(!firebaseReady)throw Error('Firebase aún no configurado');
 const room=report.room.toUpperCase();
 if(auth.currentUser && !auth.currentUser.isAnonymous)throw Error('Abre el test en ventana privada para participar como estudiante');
 const user=auth.currentUser || (await signInAnonymously(auth)).user;
 const roomRef=doc(db,'rooms',room);
 let roomDoc=await getDoc(roomRef);
 if(!roomDoc.exists() || !roomDoc.data().active)throw Error('La sala no existe o está cerrada');
 const scores=Object.fromEntries(['flex','emotion','agency','learning','social','uncertainty'].map(k=>[k,Number(report.scores[k])]));
 // Nunca se transmiten respuestas, nombre, alias, compromisos ni texto libre.
 await setDoc(doc(db,'rooms',room,'submissions',user.uid),{scores,overall:Number(report.overall),createdAt:serverTimestamp()});
}
async function login(email,password){if(!firebaseReady)throw Error('Configura firebase-config.js');await signInWithEmailAndPassword(auth,email.trim(),password);}
async function logout(){unsub?.();unsub=null;await signOut(auth);teacherState();}
async function createRoom(code,title){if(!auth.currentUser || auth.currentUser.isAnonymous)throw Error('Debes iniciar sesión como docente');await setDoc(doc(db,'rooms',code),{active:true,title:title.slice(0,90),createdBy:auth.currentUser.uid,updatedAt:serverTimestamp()},{merge:true});}
async function close(code){await setDoc(doc(db,'rooms',code),{active:false,updatedAt:serverTimestamp()},{merge:true});}
function watch(code){
 if(!auth.currentUser || auth.currentUser.isAnonymous)throw Error('Inicia sesión como docente');
 unsub?.();document.getElementById('teacherData').classList.add('hidden');
 document.getElementById('liveStatus').textContent='Conectando con '+code+'…';
 unsub=onSnapshot(collection(db,'rooms',code,'submissions'),snapshot=>{
  window.group=snapshot.docs.map(d=>d.data()).filter(d=>d.scores && Number.isFinite(d.overall));
  // El script principal mantiene group en ámbito global léxico; actualizamos por función explícita.
  window.updateLiveGroup(window.group);
  document.getElementById('liveStatus').textContent=`Sala ${code} · ${snapshot.size} envíos recibidos · actualizado en vivo`;
 },err=>{document.getElementById('liveStatus').textContent='Sin acceso a sala: '+err.message;});
}
window.adaptaFirebase={ready:firebaseReady,submit,login,logout,createRoom,close,watch,teacherState};
if(!firebaseReady) status.textContent='Configura firebase-config.js para activar la versión en vivo.';
