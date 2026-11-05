/* Hoja Neo — núcleo de sesión y conexión Firebase.
   La interfaz visual se mantiene separada de Requiem.
   El jugador ingresa un nombre de usuario; Firebase Auth recibe un alias interno
   no destinado a correo. Nunca se solicita ni se muestra un correo real. */
const INTERNAL_LOGIN_DOMAIN="hojaneo-c7718.firebaseapp.com";
const sections={combat:{title:"Combate",intro:"Prepará tus acciones y consultá tus recursos antes de entrar en batalla.",cards:[["Ataque","Resolvé tus tiradas de ataque con PC y daño."],["Defensa","Consultá PD y prepará tus respuestas."],["Recursos","HP y SM se muestran en tu ficha principal."]]},tech:{title:"Técnicas",intro:"Tus habilidades, poderes y técnicas especiales.",cards:[["Técnicas conocidas","Acá aparecerán tus técnicas y sus requisitos."],["Esencia","Las técnicas podrán organizarse según tu esencia."]]},armory:{title:"Arsenal",intro:"Armas, armaduras y equipo que lleva tu personaje.",cards:[["Arma equipada","Todavía no hay un arma seleccionada."],["Equipamiento","Administrá tus piezas de equipo y sus efectos."]]},treasure:{title:"Tesoro",intro:"Tu riqueza, objetos y hallazgos de aventura.",cards:[["Moneda","Saldo inicial: 0."],["Inventario","Todavía no agregaste objetos."]]},log:{title:"Bitácora",intro:"Misiones, acontecimientos y registros de tu historia.",cards:[["Misiones activas","No hay misiones cargadas todavía."],["Registro","Tus acontecimientos importantes aparecerán acá."]]},profile:{title:"Perfil",intro:"La identidad, historia y características de tu personaje.",cards:[["Identidad","Nombre, esencia, nivel y rango."],["Historia","Agregá trasfondo, descripción y notas personales."]]}};
const $=s=>document.querySelector(s);
let hp=100,sm=50,hpMax=100,smMax=50;
let neo={app:null,auth:null,db:null,user:null,role:null,username:null,characterRef:null,sharedRef:null};
function setAuthMessage(message,isError=false){const el=$("#authMessage");if(el){el.textContent=message;el.classList.toggle("error",isError)}}
function showLogin(){$("#loginGate").hidden=false;$("#appShell").hidden=true;}
function showApp(){$("#loginGate").hidden=true;$("#appShell").hidden=false;}
function usernameToEmail(username){return username.trim().toLowerCase()+"@"+INTERNAL_LOGIN_DOMAIN;}
function updateResource(type,value){const max=type==="hp"?hpMax:smMax;if(type==="hp")hp=Math.max(0,Math.min(max,value));else sm=Math.max(0,Math.min(max,value));const val=type==="hp"?hp:sm;$("#"+type+"Value").textContent=val+" / "+max;$("#"+type+"Fill").style.width=(val/max*100)+"%";}
function openSection(key){if(!sections[key])return;$("#home").hidden=true;$("#sectionView").classList.add("active");$("#viewTitle").textContent=sections[key].title;renderNeoModule(key);window.scrollTo({top:0,behavior:"smooth"});}
function goHome(){$("#sectionView").classList.remove("active");$("#home").hidden=false;window.scrollTo({top:0,behavior:"smooth"});}
function renderIdentity(user,role,roleData){const el=$("#onlineStatus");if(el)el.textContent=role==="admin"?"ADMIN ONLINE":role==="gm"?"MASTER ONLINE":"ONLINE";const label=$("#sessionIdentity");if(label)label.textContent="Usuario: "+(roleData.username||neo.username||"Cuenta activa");const gm=$("#masterConsoleBtn");if(gm)gm.hidden=!["admin","gm"].includes(role);}
function initFirebase(){
  if(!window.firebase||!window.HOJA_NEO_FIREBASE_CONFIG){setAuthMessage("No se pudo cargar Firebase. Revisá la conexión y recargá.",true);return;}
  try{
    neo.app=firebase.apps.length?firebase.app():firebase.initializeApp(window.HOJA_NEO_FIREBASE_CONFIG);
    neo.auth=firebase.auth();neo.db=firebase.database();
    neo.auth.onAuthStateChanged(async user=>{
      neo.user=user;neo.role=null;neo.username=null;
      if(!user){showLogin();return;}
      try{
        const snap=await neo.db.ref("neo/roles/"+user.uid).once("value");
        const roleData=snap.val();
        if(!roleData||!["admin","gm","player"].includes(roleData.role)){
          await neo.auth.signOut();showLogin();
          setAuthMessage("La cuenta todavía no tiene un rol habilitado. Pedile al administrador que revise tu acceso.",true);return;
        }
        neo.role=roleData.role;neo.username=roleData.username||"";
        neo.characterRef=neo.db.ref("neo/characters/"+user.uid);
        neo.sharedRef=neo.db.ref("neo/shared");
        if(["admin","gm"].includes(neo.role)) setupMasterConsole();
        const characterSnap=await neo.characterRef.once("value");
        if(characterSnap.exists())applyCharacterData(characterSnap.val());
        renderIdentity(user,neo.role,roleData);showApp();setAuthMessage("");
        startCharacterSync();
      }catch(error){showLogin();setAuthMessage("No se pudo validar el acceso: "+friendlyError(error),true);}
    });
  }catch(error){setAuthMessage("Error al iniciar Firebase: "+friendlyError(error),true);}
}
function setSyncStatus(message,isError=false){
  const el=$("#syncStatus");
  if(!el)return;
  el.textContent=message;
  el.classList.toggle("error",isError);
}
function startCharacterSync(){
  if(!neo.characterRef)return;
  setSyncStatus("Conectando ficha…");
  // Suscripción persistente: cada modificación del Master debe actualizar esta hoja.
  neo.characterRef.off("value");
  neo.characterRef.on("value",snapshot=>{
    if(snapshot.exists()){
      applyCharacterData(snapshot.val());
      setSyncStatus("Ficha sincronizada");
    }else setSyncStatus("Ficha todavía sin datos");
  },error=>{
    setSyncStatus("Error de sincronización",true);
    console.error("Hoja Neo: error escuchando la ficha",error);
  });
  // Si el navegador pierde y recupera conexión, revalidamos la ficha actual.
  neo.db.ref(".info/connected").on("value",snapshot=>{
    if(snapshot.val()===true){
      neo.characterRef.once("value").then(current=>{
        if(current.exists())applyCharacterData(current.val());
        setSyncStatus("Ficha sincronizada");
      }).catch(error=>{
        setSyncStatus("Sin conexión a la ficha",true);
        console.error("Hoja Neo: no se pudo revalidar la ficha",error);
      });
    }else setSyncStatus("Reconectando…");
  });
}
function applyCharacterData(data){
  if(typeof neoModuleData!=="undefined")neoModuleData={...neoModuleData,...data};
  if(typeof data.hpMax==="number"&&data.hpMax>0)hpMax=data.hpMax;
  if(typeof data.smMax==="number"&&data.smMax>0)smMax=data.smMax;
  if(typeof data.hp==="number")updateResource("hp",data.hp);
  if(typeof data.sm==="number")updateResource("sm",data.sm);
  if(data.name)$("#characterName").textContent=data.name;
  if(data.essence||data.level||data.rank)$("#characterMeta").textContent=[data.essence,data.level?"Nivel "+data.level:"",data.rank?"Rango "+data.rank:""].filter(Boolean).join(" · ");
  if(data.pc!=null)$("#pcValue").textContent=data.pc;
  if(data.pd!=null)$("#pdValue").textContent=data.pd;
  if(data.damage!=null)$("#damageValue").textContent=data.damage;
  // Si la ficha cambia desde Master, refrescar el módulo abierto sin exigir F5.
  const current=$("#sectionView");
  if(current?.classList.contains("active")&&typeof renderNeoModule==="function"){
    const key=Object.keys(sections).find(k=>sections[k].title===$("#viewTitle").textContent);
    if(key)renderNeoModule(key);
  }
}
function friendlyError(error){const code=error&&error.code||"";const messages={"auth/invalid-credential":"Usuario o contraseña incorrectos.","auth/user-not-found":"Usuario o contraseña incorrectos.","auth/wrong-password":"Usuario o contraseña incorrectos.","auth/invalid-email":"El usuario ingresado no es válido.","auth/too-many-requests":"Demasiados intentos. Esperá un momento.","auth/network-request-failed":"No se pudo conectar. Revisá tu internet."};return messages[code]||((error&&error.message)||"Error desconocido.");}
$("#loginForm").addEventListener("submit",async event=>{
  event.preventDefault();const username=$("#loginUsername").value.trim().toLowerCase(),password=$("#loginPassword").value;
  if(!/^[a-z0-9._-]{3,32}$/.test(username)){setAuthMessage("Usá entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.",true);return;}
  neo.username=username;
  const button=$("#loginButton");button.disabled=true;button.textContent="Ingresando…";setAuthMessage("Conectando con Hoja Neo…");
  try{await neo.auth.signInWithEmailAndPassword(usernameToEmail(username),password);}
  catch(error){setAuthMessage(friendlyError(error),true);}
  finally{button.disabled=false;button.textContent="Ingresar";}
});
$("#logoutButton").addEventListener("click",()=>neo.auth&&neo.auth.signOut());
document.querySelectorAll("[data-adjust]").forEach(btn=>btn.addEventListener("click",async()=>{const [type,delta]=btn.dataset.adjust.split(":");const next=(type==="hp"?hp:sm)+Number(delta);updateResource(type,next);if(neo.characterRef){try{await neo.characterRef.child(type).set(type==="hp"?hp:sm);}catch(error){setAuthMessage("No se pudo guardar el recurso: "+friendlyError(error),true);}}}));
document.querySelectorAll("[data-section]").forEach(el=>el.addEventListener("click",()=>openSection(el.dataset.section)));
$("#backHome").addEventListener("click",goHome);

/* Consola del Master — roster y edición segura de fichas */
let masterRolesCache={};
let masterCharactersCache={};
let masterRolesListener=null;
const masterCharacterListeners={};
let activeEditorUid=null;
function setConsoleStatus(message,isError=false){const el=$("#masterConsoleStatus");if(el){el.textContent=message;el.classList.toggle("error",isError);}}
function setEditorMessage(message,isError=false){const el=$("#editorMessage");if(el){el.textContent=message;el.classList.toggle("error",isError);}}
function openMasterConsole(){if(!["admin","gm"].includes(neo.role))return;$("#home").hidden=true;$("#sectionView").classList.remove("active");$("#masterConsole").hidden=false;loadMasterRoster();window.scrollTo({top:0,behavior:"smooth"});}
function closeMasterConsole(){ $("#masterConsole").hidden=true;$("#home").hidden=false;window.scrollTo({top:0,behavior:"smooth"});}
function setupMasterConsole(){
  $("#masterConsoleBtn").addEventListener("click",openMasterConsole);
  $("#closeMasterConsole").addEventListener("click",closeMasterConsole);
  $("#refreshRoster").addEventListener("click",loadMasterRoster);
  $("#characterEditor").addEventListener("submit",saveMasterCharacter);
  $("#characterEditor").addEventListener("input",()=>{$("#characterEditor").dataset.dirty="true";});
}
function loadMasterRoster(){
  if(!["admin","gm"].includes(neo.role)||!neo.db)return;
  setConsoleStatus("Sincronizando integrantes y fichas…");
  const roster=$("#masterRoster");
  if(!masterRolesListener){
    masterRolesListener=neo.db.ref("neo/roles");
    masterRolesListener.on("value",snapshot=>{
      masterRolesCache=snapshot.val()||{};
      syncMasterCharacterListeners();
      renderMasterRoster();
    },error=>{
      roster.innerHTML='<p class="empty">No se pudo leer el grupo. Revisá las reglas de lectura de roles.</p>';
      setConsoleStatus("Error al cargar el grupo: "+friendlyError(error),true);
    });
  }else renderMasterRoster();
}
function syncMasterCharacterListeners(){
  const playerUids=new Set(Object.entries(masterRolesCache).filter(([,v])=>v&&v.role==="player").map(([uid])=>uid));
  Object.keys(masterCharacterListeners).forEach(uid=>{
    if(!playerUids.has(uid)){
      neo.db.ref("neo/characters/"+uid).off("value",masterCharacterListeners[uid]);
      delete masterCharacterListeners[uid];delete masterCharactersCache[uid];
    }
  });
  playerUids.forEach(uid=>{
    if(masterCharacterListeners[uid])return;
    const ref=neo.db.ref("neo/characters/"+uid);
    const listener=snapshot=>{
      masterCharactersCache[uid]=snapshot.val()||{};
      renderMasterRoster();
      if(activeEditorUid===uid&&!$("#characterEditor").dataset.dirty)fillCharacterEditor(uid,masterCharactersCache[uid],masterRolesCache[uid]);
    };
    masterCharacterListeners[uid]=listener;
    ref.on("value",listener,error=>setConsoleStatus("No se pudo sincronizar una ficha: "+friendlyError(error),true));
  });
}
function renderMasterRoster(){
  const roster=$("#masterRoster");if(!roster)return;
  const players=Object.entries(masterRolesCache).filter(([,v])=>v&&v.role==="player");
  if(!players.length){roster.innerHTML='<p class="empty">Todavía no hay jugadores asignados.</p>';setConsoleStatus("No hay jugadores registrados.");return;}
  roster.innerHTML=players.map(([uid,info])=>{
    const character=masterCharactersCache[uid]||{};
    const safeName=escapeHtml(character.name||"Personaje sin crear");
    const hpText=Number.isFinite(Number(character.hp))?Number(character.hp)+" / "+(character.hpMax||100):"—";
    const smText=Number.isFinite(Number(character.sm))?Number(character.sm)+" / "+(character.smMax||50):"—";
    return '<article class="roster-card"><div><strong>'+escapeHtml(info.username||"Jugador")+'</strong><span>'+safeName+'</span><small>HP '+hpText+' · SM '+smText+'</small></div><button type="button" class="console-small-btn" data-edit-uid="'+uid+'">Editar</button></article>';
  }).join("");
  roster.querySelectorAll("[data-edit-uid]").forEach(btn=>btn.addEventListener("click",()=>openCharacterEditor(btn.dataset.editUid)));
  setConsoleStatus(players.length+" jugadores sincronizados en tiempo real.");
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function fillCharacterEditor(uid,c,info){
  $("#editUid").value=uid;$("#editUsername").value=(info&&info.username)||"Jugador";
  $("#editName").value=c.name||"";$("#editEssence").value=c.essence||"";$("#editLevel").value=c.level??1;$("#editRank").value=c.rank||"";
  $("#editHp").value=c.hp??100;$("#editHpMax").value=c.hpMax??100;$("#editSm").value=c.sm??50;$("#editSmMax").value=c.smMax??50;
  $("#editPc").value=c.pc??10;$("#editPd").value=c.pd??10;$("#editDamage").value=c.damage??5;
}
async function openCharacterEditor(uid){
  const info=masterRolesCache[uid];if(!info||info.role!=="player")return;
  try{
    const snap=await neo.db.ref("neo/characters/"+uid).once("value"),c=snap.val()||{};
    activeEditorUid=uid;$("#characterEditor").dataset.dirty="";
    fillCharacterEditor(uid,c,info);
    $("#editorHint").hidden=true;$("#characterEditor").hidden=false;setEditorMessage("");
  }catch(error){setConsoleStatus("No se pudo abrir la ficha: "+friendlyError(error),true);}
}
async function saveMasterCharacter(event){
  event.preventDefault();if(!["admin","gm"].includes(neo.role))return;
  const uid=$("#editUid").value;if(!uid||!masterRolesCache[uid]||masterRolesCache[uid].role!=="player")return;
  const values={hp:Number($("#editHp").value),hpMax:Number($("#editHpMax").value),sm:Number($("#editSm").value),smMax:Number($("#editSmMax").value),level:Number($("#editLevel").value),pc:Number($("#editPc").value),pd:Number($("#editPd").value),damage:Number($("#editDamage").value)};
  if(Object.values(values).some(v=>!Number.isFinite(v))||values.hp<0||values.hpMax<1||values.hp>values.hpMax||values.sm<0||values.smMax<1||values.sm>values.smMax||values.level<1){setEditorMessage("Revisá los valores: HP y SM deben estar dentro de sus máximos y el nivel debe ser al menos 1.",true);return;}
  const data={name:$("#editName").value.trim(),essence:$("#editEssence").value.trim(),level:values.level,rank:$("#editRank").value.trim(),hp:values.hp,hpMax:values.hpMax,sm:values.sm,smMax:values.smMax,pc:values.pc,pd:values.pd,damage:values.damage};
  try{await neo.db.ref("neo/characters/"+uid).update(data);$("#characterEditor").dataset.dirty="";setEditorMessage("Ficha guardada correctamente.");setConsoleStatus("Cambios guardados y sincronizados para "+(masterRolesCache[uid].username||"el jugador")+".");masterCharactersCache[uid]=data;renderMasterRoster();}
  catch(error){setEditorMessage("No se pudo guardar: "+friendlyError(error),true);}
}

initFirebase();
