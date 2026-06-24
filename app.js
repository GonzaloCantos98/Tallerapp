const firebaseConfig={apiKey:"AIzaSyAQn3jnMnZJAMRYR4QoFQLauiHqZDurdR4",authDomain:"motoauto-rangel.firebaseapp.com",databaseURL:"https://motoauto-rangel-default-rtdb.europe-west1.firebasedatabase.app",projectId:"motoauto-rangel",storageBucket:"motoauto-rangel.firebasestorage.app",messagingSenderId:"20360476397",appId:"1:20360476397:web:37efc39bbf576e76c5bee4"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();

let user=null,uPath=null;
let clientes=[],presupuestos=[],caja=[],avisos=[],citas=[],ordenes=[];
let tallNombre='Mi Taller',tallTel='',tallDir='',tallCif='',tallLogo='',tallFacturaPrefix='',tallFacturaContador=0,tallFacturaAño=0;
let currentPage='inicio',filterActivo='todos',filterOrden='todos';
let lineas=[],listeners=[],agendaDate=new Date();
let chartIngresos=null;

auth.onAuthStateChanged(u=>{
  document.getElementById('screen-loading').style.display='none';
  if(u){user=u;uPath='talleres/'+u.uid;startApp();}
  else{user=null;uPath=null;stopListeners();showScreen('login');}
});

function switchTab(t){['login','register'].forEach(x=>{document.getElementById('tab-'+x).classList.toggle('active',x===t);document.getElementById('form-'+x).style.display=x===t?'block':'none';});clearMsgs();}
function showErr(m){const e=document.getElementById('login-error');e.textContent=m;e.classList.add('active');document.getElementById('login-ok').classList.remove('active')}
function showOk(m){const e=document.getElementById('login-ok');e.textContent=m;e.classList.add('active');document.getElementById('login-error').classList.remove('active')}
function clearMsgs(){document.getElementById('login-error').classList.remove('active');document.getElementById('login-ok').classList.remove('active')}

function doLogin(){
  const email=document.getElementById('l-email').value.trim(),pass=document.getElementById('l-pass').value;
  if(!email||!pass){showErr('Introduce email y contraseña');return}
  const btn=document.getElementById('btn-login');btn.textContent='Entrando...';btn.disabled=true;
  auth.signInWithEmailAndPassword(email,pass).catch(e=>{btn.textContent='Entrar →';btn.disabled=false;const m={'auth/user-not-found':'No existe esa cuenta.','auth/wrong-password':'Contraseña incorrecta.','auth/invalid-email':'Email no válido.','auth/too-many-requests':'Demasiados intentos.'};showErr(m[e.code]||'Error al entrar.');});
}
function doRegister(){
  const nombre=document.getElementById('r-nombre').value.trim(),email=document.getElementById('r-email').value.trim(),tel=document.getElementById('r-tel').value.trim(),pass=document.getElementById('r-pass').value;
  if(!nombre){showErr('Introduce el nombre del taller');return}
  if(!email){showErr('Introduce un email');return}
  if(pass.length<6){showErr('Mínimo 6 caracteres');return}
  const btn=document.getElementById('btn-register');btn.textContent='Creando...';btn.disabled=true;
  auth.createUserWithEmailAndPassword(email,pass).then(c=>db.ref('talleres/'+c.user.uid+'/config').set({nombre,telefono:tel,direccion:'',cif:'',creado:new Date().toISOString()})).catch(e=>{btn.textContent='Crear cuenta →';btn.disabled=false;const m={'auth/email-already-in-use':'Ya existe una cuenta con ese email.','auth/invalid-email':'Email no válido.','auth/weak-password':'Contraseña débil.'};showErr(m[e.code]||'Error al crear cuenta.');});
}
function doForgot(){const email=document.getElementById('l-email').value.trim();if(!email){showErr('Introduce tu email primero');return}auth.sendPasswordResetEmail(email).then(()=>showOk('Email de recuperación enviado.')).catch(()=>showErr('No se pudo enviar el email.'));}
function doLogout(){if(confirm('¿Cerrar sesión?'))auth.signOut()}

function showScreen(s){document.getElementById('screen-login').classList.toggle('active',s==='login');document.getElementById('screen-app').classList.toggle('active',s==='app');}

function startApp(){
  showScreen('app');
  document.getElementById('page-date').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('p-email-display').textContent=user.email;
  db.ref('.info/connected').on('value',s=>{const d=document.getElementById('sync-dot');d.className=s.val()?'':'off';});
  startListeners();
}

function startListeners(){
  stopListeners();
  const loaded={config:false,clientes:false,presupuestos:false,caja:false,avisos:false,citas:false,ordenes:false};
  function check(){if(Object.values(loaded).every(Boolean))renderCurrentPage()}

  const rc=db.ref(uPath+'/config');
  rc.on('value',s=>{const d=s.val()||{};tallNombre=d.nombre||'Mi Taller';tallTel=d.telefono||'';tallDir=d.direccion||'';tallCif=d.cif||'';tallLogo=d.logo||'';tallFacturaPrefix=d.facturaPrefix||'';tallFacturaContador=d.facturaContador||0;tallFacturaAño=d.facturaAño||0;document.getElementById('p-nombre-display').textContent=tallNombre;const lp=document.getElementById('logo-preview');if(lp)lp.src=tallLogo||'';const lpw=document.getElementById('logo-preview-wrap');if(lpw)lpw.style.display=tallLogo?'block':'none';document.getElementById('pf-nombre').value=tallNombre;document.getElementById('pf-tel').value=tallTel;document.getElementById('pf-dir').value=tallDir;document.getElementById('pf-cif').value=tallCif;document.getElementById('pf-prefix').value=tallFacturaPrefix;loaded.config=true;check();});
  listeners.push(()=>rc.off());

  function mkL(ref,arr,sortFn,key){
    ref.on('value',s=>{
      arr.length=0;
      s.forEach(c=>{
        const v=c.val();
        if(key==='clientes'){
          if(v.vehiculos){v.vehiculos=Object.entries(v.vehiculos).map(([id,vh])=>({id,...vh}));}
          else{v.vehiculos=[];if(v.matricula||v.vehiculo){v.vehiculos=[{id:'legacy',matricula:v.matricula||'',marca:'',modelo:v.vehiculo||'',km:'',año:'',color:''}];}}
        }
        arr.push({id:c.key,...v});
      });
      if(sortFn)arr.sort(sortFn);
      loaded[key]=true;check();renderCurrentPage();
    });
    listeners.push(()=>ref.off());
  }
  mkL(db.ref(uPath+'/clientes'),clientes,(a,b)=>(a.nombre||'').localeCompare(b.nombre||''),'clientes');
  mkL(db.ref(uPath+'/presupuestos'),presupuestos,(a,b)=>new Date(b.fecha)-new Date(a.fecha),'presupuestos');
  mkL(db.ref(uPath+'/caja'),caja,(a,b)=>new Date(b.fecha)-new Date(a.fecha),'caja');
  mkL(db.ref(uPath+'/avisos'),avisos,(a,b)=>new Date(a.fecha)-new Date(b.fecha),'avisos');
  mkL(db.ref(uPath+'/citas'),citas,(a,b)=>(a.fecha+' '+(a.hora||'')).localeCompare(b.fecha+' '+(b.hora||'')),'citas');
  mkL(db.ref(uPath+'/ordenes'),ordenes,(a,b)=>new Date(b.fechaEntrada)-new Date(a.fechaEntrada),'ordenes');
}
function stopListeners(){listeners.forEach(f=>f());listeners=[];clientes=[];presupuestos=[];caja=[];avisos=[];citas=[];ordenes=[];}

const pageTitles={inicio:'🏠 Inicio',clientes:'👥 Clientes',presupuestos:'📋 Presupuestos',agenda:'📅 Agenda',mas:'☰ Más',caja:'💰 Caja',estadisticas:'📊 Estadísticas',ordenes:'🔧 Órdenes de trabajo',avisos:'🔔 Avisos',perfil:'⚙️ Perfil'};
const navIds=['inicio','clientes','presupuestos','agenda','mas'];

function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pg=document.getElementById('page-'+name);if(pg)pg.classList.add('active');
  const nk=navIds.includes(name)?name:'mas';
  const nb=document.getElementById('nav-'+nk);if(nb)nb.classList.add('active');
  currentPage=name;
  document.getElementById('page-title').textContent=pageTitles[name]||name;
  renderCurrentPage();
}

function renderCurrentPage(){
  if(currentPage==='inicio')renderInicio();
  else if(currentPage==='clientes')renderClientes();
  else if(currentPage==='presupuestos')renderPresupuestos();
  else if(currentPage==='agenda')renderAgenda();
  else if(currentPage==='caja')renderCaja();
  else if(currentPage==='estadisticas')renderEstadisticas();
  else if(currentPage==='ordenes')renderOrdenes();
  else if(currentPage==='avisos')renderAvisos();
}

function openModal(id){
  if(id==='modal-presupuesto'){fillClientesSelect('mp-cliente');initLineas()}
  if(id==='modal-cita'){fillClientesSelect('mci-cliente');setTodayDate('mci-fecha')}
  if(id==='modal-aviso')fillClientesSelect('mav-cliente');
  if(id==='modal-orden')fillClientesSelect('mo-cliente');
  document.getElementById(id).classList.add('active');
}
function closeModal(id){
  document.getElementById(id).classList.remove('active');
  if(id==='modal-cliente')resetClienteForm();
  if(id==='modal-presupuesto')resetPresupuestoForm();
}
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)closeModal(o.id)});});
function setTodayDate(id){document.getElementById(id).value=new Date().toISOString().split('T')[0]}

// CLIENTES
function resetClienteForm(){['mc-id','mc-nombre','mc-tel','mc-email','mc-notas'].forEach(id=>document.getElementById(id).value='');document.getElementById('mc-title').textContent='Nuevo cliente';}
function saveCliente(){
  const nombre=document.getElementById('mc-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio');return}
  const id=document.getElementById('mc-id').value;
  const data={nombre,telefono:document.getElementById('mc-tel').value.trim(),email:document.getElementById('mc-email').value.trim(),notas:document.getElementById('mc-notas').value.trim(),creado:id?(clientes.find(c=>c.id===id)||{}).creado:new Date().toISOString()};
  if(id)db.ref(uPath+'/clientes/'+id).update(data);
  else db.ref(uPath+'/clientes').push(data);
  closeModal('modal-cliente');
}
function editCliente(id){closeModal('modal-ver-cliente');const c=clientes.find(x=>x.id===id);if(!c)return;document.getElementById('mc-id').value=c.id;document.getElementById('mc-nombre').value=c.nombre||'';document.getElementById('mc-tel').value=c.telefono||'';document.getElementById('mc-email').value=c.email||'';document.getElementById('mc-notas').value=c.notas||'';document.getElementById('mc-title').textContent='Editar cliente';openModal('modal-cliente');}
function deleteCliente(id){if(!confirm('¿Eliminar este cliente?'))return;db.ref(uPath+'/clientes/'+id).remove();closeModal('modal-ver-cliente');}

function verCliente(id){
  const c=clientes.find(x=>x.id===id);if(!c)return;
  const presCli=presupuestos.filter(p=>p.clienteId===id);
  const total=presCli.reduce((a,p)=>a+(p.total||0),0);
  const vehs=(c.vehiculos||[]);
  document.getElementById('ver-cliente-body').innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="avatar" style="width:56px;height:56px;font-size:22px">${(c.nombre||'?')[0].toUpperCase()}</div>
      <div><div style="font-size:20px;font-weight:700">${c.nombre}</div>${c.telefono?`<a href="tel:${c.telefono}" style="font-size:14px;color:var(--primary)">📞 ${c.telefono}</a>`:''}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="stat-card"><div class="stat-value">${presCli.length}</div><div class="stat-label">Trabajos</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:18px">${fmt(total)}</div><div class="stat-label">Facturado</div></div>
    </div>
    <div class="section-title" style="margin-top:0">🚗 Vehículos</div>
    <div style="margin-bottom:12px">${vehs.length?vehs.map(v=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div class="vehiculo-chip" onclick="editVehiculo('${id}','${v.id}')" style="flex:1">${v.matricula||'Sin matrícula'} · ${v.marca||''} ${v.modelo||''}</div><button onclick="verHistorialVehiculo('${id}','${v.id}')" class="btn btn-secondary btn-sm" style="flex-shrink:0">📋 Historial</button></div>`).join(''):'<div style="font-size:13px;color:var(--muted)">Sin vehículos</div>'}</div>
    <button class="btn btn-secondary btn-block btn-sm" onclick="abrirNuevoVehiculo('${id}')">➕ Añadir vehículo</button>
    ${c.notas?`<div class="card" style="margin-top:10px;font-size:14px"><b>📝</b> ${c.notas}</div>`:''}
    <button class="btn btn-danger btn-block btn-sm" onclick="deleteCliente('${id}')" style="margin-top:10px">🗑️ Eliminar cliente</button>
  `;
  document.getElementById('btn-edit-cliente').onclick=()=>editCliente(id);
  openModal('modal-ver-cliente');
}

function verHistorialVehiculo(clienteId,vehiculoId){
  const c=clientes.find(x=>x.id===clienteId)||{};
  const v=getVehiculo(c,vehiculoId);
  const presV=presupuestos.filter(p=>p.vehiculoId===vehiculoId).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const ordV=ordenes.filter(o=>o.vehiculoId===vehiculoId).sort((a,b)=>new Date(b.fechaEntrada)-new Date(a.fechaEntrada));
  const totalGastado=presV.filter(p=>p.estado==='cobrado').reduce((a,p)=>a+p.total,0);
  const eBadge={pendiente:'badge-warning',cobrado:'badge-success',presupuesto:'badge-secondary'};
  document.getElementById('historial-body').innerHTML=`
    <div style="margin-bottom:16px">
      <div style="font-size:18px;font-weight:700">📋 Historial del vehículo</div>
      <div style="font-size:15px;color:var(--primary);font-weight:700;margin-top:4px">${v?v.matricula+' · '+[v.marca,v.modelo].filter(Boolean).join(' '):'Vehículo'}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">Propietario: ${c.nombre||'-'}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-value">${presV.length}</div><div class="stat-label">Trabajos</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:16px">${fmt(totalGastado)}</div><div class="stat-label">Cobrado</div></div>
      <div class="stat-card"><div class="stat-value">${ordV.length}</div><div class="stat-label">Entradas</div></div>
    </div>
    ${ordV.length?`<div class="section-title" style="margin-top:0">🔧 Entradas al taller</div>`+'<div class="card">'+ordV.map(o=>{const eLabel={recibido:'Recibido',en_taller:'En taller',listo:'Listo ✅',entregado:'Entregado'};return`<div class="list-item"><div style="font-size:22px">🔧</div><div class="list-content"><div class="list-title">${o.trabajo||'Trabajo sin descripción'}</div><div class="list-meta">${fmtFecha(o.fechaEntrada)}${o.kmEntrada?' · '+Number(o.kmEntrada).toLocaleString('es')+' km':''} · ${eLabel[o.estado]||o.estado}</div></div></div>`;}).join('')+'</div>':''}
    ${presV.length?`<div class="section-title">💶 Presupuestos y facturas</div>`+'<div class="card">'+presV.map(p=>`<div class="list-item" onclick="closeModal('modal-historial');verPresupuesto('${p.id}')"><div class="list-content"><div class="list-title">${p.descripcion||'Trabajo'}${p.numeroFactura?' <span style="font-size:11px;color:var(--muted)">· Fac. '+p.numeroFactura+'</span>':''}</div><div class="list-meta">${fmtFecha(p.fecha)}</div></div><div class="list-right"><div style="font-weight:700">${fmt(p.total)}</div><span class="badge ${eBadge[p.estado]}">${p.estado}</span></div></div>`).join('')+'</div>':'<div class="empty-state"><div class="ei">📋</div><p>Sin trabajos registrados</p></div>'}
  `;
  closeModal('modal-ver-cliente');
  openModal('modal-historial');
}

function renderClientes(){
  const q=(document.getElementById('search-clientes')?.value||'').toLowerCase();
  const f=clientes.filter(c=>(c.nombre||'').toLowerCase().includes(q)||(c.vehiculos||[]).some(v=>(v.matricula||'').toLowerCase().includes(q)));
  const el=document.getElementById('lista-clientes');
  if(!f.length){el.innerHTML='<div class="empty-state"><div class="ei">👥</div><p>No hay clientes todavía.</p></div>';return}
  el.innerHTML='<div class="card">'+f.map(c=>{const vehs=(c.vehiculos||[]);return`<div class="list-item" onclick="verCliente('${c.id}')"><div class="avatar">${(c.nombre||'?')[0].toUpperCase()}</div><div class="list-content"><div class="list-title">${c.nombre}</div><div class="list-meta">${vehs.length?vehs.map(v=>v.matricula).filter(Boolean).join(', ')||'Sin matrícula':'Sin vehículos'}</div></div><div style="color:var(--muted);font-size:18px">›</div></div>`;}).join('')+'</div>';
}

// VEHÍCULOS
function abrirNuevoVehiculo(clienteId){closeModal('modal-ver-cliente');document.getElementById('mv-cliente-id').value=clienteId;document.getElementById('mv-id').value='';['mv-matricula','mv-marca','mv-modelo','mv-año','mv-km','mv-color'].forEach(id=>document.getElementById(id).value='');document.getElementById('mv-title').textContent='Añadir vehículo';openModal('modal-vehiculo');}
function editVehiculo(clienteId,vehiculoId){closeModal('modal-ver-cliente');const c=clientes.find(x=>x.id===clienteId);const v=(c?.vehiculos||[]).find(x=>x.id===vehiculoId);if(!v)return;document.getElementById('mv-cliente-id').value=clienteId;document.getElementById('mv-id').value=vehiculoId;document.getElementById('mv-matricula').value=v.matricula||'';document.getElementById('mv-marca').value=v.marca||'';document.getElementById('mv-modelo').value=v.modelo||'';document.getElementById('mv-año').value=v.año||'';document.getElementById('mv-km').value=v.km||'';document.getElementById('mv-color').value=v.color||'';document.getElementById('mv-title').textContent='Editar vehículo';openModal('modal-vehiculo');}
function saveVehiculo(){
  const matricula=document.getElementById('mv-matricula').value.trim().toUpperCase();
  if(!matricula){alert('La matrícula es obligatoria');return}
  const clienteId=document.getElementById('mv-cliente-id').value,id=document.getElementById('mv-id').value;
  const data={matricula,marca:document.getElementById('mv-marca').value.trim(),modelo:document.getElementById('mv-modelo').value.trim(),año:document.getElementById('mv-año').value,km:document.getElementById('mv-km').value,color:document.getElementById('mv-color').value.trim()};
  const vPath=uPath+'/clientes/'+clienteId+'/vehiculos/';
  if(id&&id!=='legacy')db.ref(vPath+id).update(data);
  else db.ref(vPath).push(data);
  closeModal('modal-vehiculo');
}
function getVehiculo(c,vehiculoId){if(!c||!vehiculoId)return null;return(c.vehiculos||[]).find(v=>v.id===vehiculoId)||null;}
function getLineas(p){const l=p.lineas;if(!l)return[];if(Array.isArray(l))return l;return Object.values(l);}
function loadVehiculosSelect(selectId,clienteId){const sel=document.getElementById(selectId);const c=clientes.find(x=>x.id===clienteId);const vehs=(c?.vehiculos||[]);sel.innerHTML='<option value="">Sin vehículo específico</option>'+vehs.map(v=>`<option value="${v.id}">${v.matricula||'Sin matrícula'} ${v.marca?'· '+v.marca:''} ${v.modelo||''}</option>`).join('');}
function fillClientesSelect(selectId){const sel=document.getElementById(selectId);const cur=sel.value;sel.innerHTML='<option value="">Seleccionar cliente...</option>'+clientes.map(c=>`<option value="${c.id}" ${c.id===cur?'selected':''}>${c.nombre}</option>`).join('');}

// PRESUPUESTOS
function resetPresupuestoForm(){document.getElementById('mp-id').value='';['mp-cliente','mp-vehiculo','mp-desc','mp-notas'].forEach(id=>document.getElementById(id).value='');document.getElementById('mp-estado').value='pendiente';document.getElementById('mp-title').textContent='Nuevo presupuesto';lineas=[];renderLineas();}
function initLineas(){if(!lineas.length)lineas=[{concepto:'',precio:'',cantidad:1}];renderLineas();}
function addLinea(){lineas.push({concepto:'',precio:'',cantidad:1});renderLineas();}
function removeLinea(i){lineas.splice(i,1);if(!lineas.length)lineas=[{concepto:'',precio:'',cantidad:1}];renderLineas();}
function renderLineas(){document.getElementById('mp-lineas').innerHTML=lineas.map((l,i)=>`<div class="linea-item"><input class="form-control" placeholder="Concepto" value="${l.concepto}" oninput="lineas[${i}].concepto=this.value"><input class="form-control w-sm" placeholder="€" type="number" min="0" step="0.01" value="${l.precio}" oninput="lineas[${i}].precio=this.value;calcTotal()"><input class="form-control w-sm" placeholder="Ud" type="number" min="1" value="${l.cantidad}" oninput="lineas[${i}].cantidad=this.value;calcTotal()"><button class="btn-remove" onclick="removeLinea(${i})">✕</button></div>`).join('');calcTotal();}
function calcTotal(){const sub=lineas.reduce((a,l)=>a+(parseFloat(l.precio)||0)*(parseFloat(l.cantidad)||1),0);document.getElementById('mp-sub').textContent=fmt(sub);document.getElementById('mp-iva').textContent=fmt(sub*.21);document.getElementById('mp-total').textContent=fmt(sub*1.21);}

function savePresupuesto(){
  const clienteId=document.getElementById('mp-cliente').value;
  if(!clienteId){alert('Selecciona un cliente');return}
  const ls=lineas.filter(l=>l.concepto||l.precio);
  const sub=ls.reduce((a,l)=>a+(parseFloat(l.precio)||0)*(parseFloat(l.cantidad)||1),0);
  const id=document.getElementById('mp-id').value;
  const data={clienteId,vehiculoId:document.getElementById('mp-vehiculo').value,descripcion:document.getElementById('mp-desc').value.trim(),lineas:ls,subtotal:sub,iva:sub*.21,total:sub*1.21,notas:document.getElementById('mp-notas').value.trim(),estado:document.getElementById('mp-estado').value,fecha:id?(presupuestos.find(p=>p.id===id)||{}).fecha||new Date().toISOString():new Date().toISOString()};
  if(id)db.ref(uPath+'/presupuestos/'+id).update(data);
  else db.ref(uPath+'/presupuestos').push(data);
  closeModal('modal-presupuesto');
}

function verPresupuesto(id){
  const p=presupuestos.find(x=>x.id===id);if(!p)return;
  const c=clientes.find(x=>x.id===p.clienteId)||{};
  const v=getVehiculo(c,p.vehiculoId);
  const eBadge={pendiente:'badge-warning',cobrado:'badge-success',presupuesto:'badge-secondary'};
  const eLabel={pendiente:'Pendiente',cobrado:'Cobrado ✅',presupuesto:'Presupuesto'};
  document.getElementById('ver-presupuesto-body').innerHTML=`
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:18px;font-weight:700">${p.descripcion||'Trabajo'}</div><div style="font-size:14px;color:var(--muted);margin-top:2px">${c.nombre||'Cliente eliminado'}${v?' · '+v.matricula:''}</div><div style="font-size:12px;color:var(--muted)">${fmtFecha(p.fecha)}${p.numeroFactura?' · <b>Factura '+p.numeroFactura+'</b>':''}</div></div>
        <span class="badge ${eBadge[p.estado]}">${eLabel[p.estado]}</span>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px">
      ${getLineas(p).map(l=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:14px">${l.concepto||'Concepto'}</div><div style="font-size:12px;color:var(--muted)">${l.cantidad} ud × ${fmt(l.precio)}</div></div><div style="font-weight:600">${fmt(l.precio*l.cantidad)}</div></div>`).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px"><span>Subtotal</span><span>${fmt(p.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span>IVA 21%</span><span>${fmt(p.iva)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:17px;margin-top:6px;color:var(--primary)"><span>TOTAL</span><span>${fmt(p.total)}</span></div>
    </div>
    ${p.notas?`<div class="card" style="font-size:14px;margin-bottom:10px"><b>📝</b> ${p.notas}</div>`:''}
  `;
  document.getElementById('btn-edit-p').onclick=()=>editPresupuesto(id);
  document.getElementById('btn-cobrar-p').style.display=p.estado==='cobrado'?'none':'';
  document.getElementById('btn-cobrar-p').onclick=()=>cobrarPresupuesto(id);
  document.getElementById('btn-wa-p').onclick=()=>enviarWAPresupuesto(id);
  document.getElementById('btn-pdf-p').onclick=()=>{closeModal('modal-ver-presupuesto');generarPDF(id)};
  openModal('modal-ver-presupuesto');
}

function cobrarPresupuesto(id){
  const p=presupuestos.find(x=>x.id===id);if(!p)return;
  const c=clientes.find(x=>x.id===p.clienteId)||{};
  const año=new Date().getFullYear();
  const nuevoContador=tallFacturaAño===año?(tallFacturaContador+1):1;
  const numFactura=(tallFacturaPrefix?tallFacturaPrefix+'-':'')+año+'-'+String(nuevoContador).padStart(3,'0');
  db.ref(uPath+'/config').update({facturaContador:nuevoContador,facturaAño:año});
  db.ref(uPath+'/presupuestos/'+id).update({estado:'cobrado',numeroFactura:numFactura});
  db.ref(uPath+'/caja').push({tipo:'entrada',concepto:(p.descripcion||'Trabajo')+' - '+(c.nombre||''),importe:p.total,fecha:new Date().toISOString()});
  closeModal('modal-ver-presupuesto');
  alert('✅ Factura '+numFactura+' · Cobrado y añadido a la caja.');
}

function editPresupuesto(id){
  closeModal('modal-ver-presupuesto');
  const p=presupuestos.find(x=>x.id===id);if(!p)return;
  fillClientesSelect('mp-cliente');
  document.getElementById('mp-id').value=p.id;
  document.getElementById('mp-cliente').value=p.clienteId;
  loadVehiculosSelect('mp-vehiculo',p.clienteId);
  document.getElementById('mp-vehiculo').value=p.vehiculoId||'';
  document.getElementById('mp-desc').value=p.descripcion||'';
  document.getElementById('mp-notas').value=p.notas||'';
  document.getElementById('mp-estado').value=p.estado;
  document.getElementById('mp-title').textContent='Editar presupuesto';
  lineas=getLineas(p).map(l=>({...l}));renderLineas();
  document.getElementById('modal-presupuesto').classList.add('active');
}

function filterP(f){filterActivo=f;['todos','pendiente','cobrado','presupuesto'].forEach(x=>{const el=document.getElementById('f-'+x);if(el){el.style.fontWeight=x===f?'800':'600';el.style.opacity=x===f?'1':'0.6'}});renderPresupuestos();}

function renderPresupuestos(){
  const f=filterActivo==='todos'?presupuestos:presupuestos.filter(p=>p.estado===filterActivo);
  const el=document.getElementById('lista-presupuestos');
  if(!f.length){el.innerHTML='<div class="empty-state"><div class="ei">📋</div><p>No hay presupuestos.</p></div>';return}
  const eBadge={pendiente:'badge-warning',cobrado:'badge-success',presupuesto:'badge-secondary'};
  const eLabel={pendiente:'Pendiente',cobrado:'Cobrado',presupuesto:'Presupuesto'};
  el.innerHTML='<div class="card">'+f.map(p=>{const c=clientes.find(x=>x.id===p.clienteId)||{};const v=getVehiculo(c,p.vehiculoId);return`<div class="list-item" onclick="verPresupuesto('${p.id}')"><div class="avatar" style="background:linear-gradient(135deg,#264653,#2a9d8f)">${(c.nombre||'?')[0].toUpperCase()}</div><div class="list-content"><div class="list-title">${p.descripcion||'Trabajo'}</div><div class="list-meta">${c.nombre||'Sin cliente'}${v?' · '+v.matricula:''} · ${fmtFecha(p.fecha)}${p.numeroFactura?' · Fac. '+p.numeroFactura:''}</div></div><div class="list-right"><div style="font-weight:700">${fmt(p.total)}</div><span class="badge ${eBadge[p.estado]}">${eLabel[p.estado]}</span></div></div>`;}).join('')+'</div>';
}

// WHATSAPP
function fmtWAPhone(tel){const clean=(tel||'').replace(/[\s\-\(\)]/g,'');if(clean.startsWith('+'))return clean.slice(1);if(clean.startsWith('34'))return clean;if(/^[6-9]/.test(clean))return'34'+clean;return clean;}

function enviarWAPresupuesto(id){
  const p=presupuestos.find(x=>x.id===id);if(!p)return;
  const c=clientes.find(x=>x.id===p.clienteId)||{};
  const v=getVehiculo(c,p.vehiculoId);
  if(!c.telefono){alert('El cliente no tiene teléfono registrado');return}
  const lineasTxt=getLineas(p).map(l=>`• ${l.concepto}: ${fmt(l.precio*l.cantidad)}`).join('\n');
  const texto=`Hola ${c.nombre||''}! 👋\n\nLe enviamos el presupuesto para${v?' su '+[v.marca,v.modelo].filter(Boolean).join(' ')+' ('+v.matricula+')':' su vehículo'}:\n\n*${p.descripcion||'Trabajo'}*\n\n${lineasTxt}\n\n💶 *TOTAL: ${fmt(p.total)}* (IVA incluido)\n\nPara cualquier consulta estamos a su disposición.\nSaludos, ${tallNombre}`;
  window.open('https://wa.me/'+fmtWAPhone(c.telefono)+'?text='+encodeURIComponent(texto));
  closeModal('modal-ver-presupuesto');
}

function enviarWAListoOrden(id){
  const o=ordenes.find(x=>x.id===id);if(!o)return;
  const c=clientes.find(x=>x.id===o.clienteId)||{};
  const v=getVehiculo(c,o.vehiculoId);
  if(!c.telefono){alert('El cliente no tiene teléfono registrado');return}
  const texto=`Hola ${c.nombre||''}! 🎉\n\nSu vehículo${v?' '+[v.marca,v.modelo].filter(Boolean).join(' ')+' ('+v.matricula+')':''} ya está *LISTO PARA RECOGER* ✅\n\nPuede venir a buscarlo cuando quiera en nuestro horario habitual.\n\nGracias por confiar en ${tallNombre}!`;
  window.open('https://wa.me/'+fmtWAPhone(c.telefono)+'?text='+encodeURIComponent(texto));
}

// ÓRDENES
function saveOrden(){
  const clienteId=document.getElementById('mo-cliente').value,vehiculoId=document.getElementById('mo-vehiculo').value;
  if(!clienteId||!vehiculoId){alert('Selecciona cliente y vehículo');return}
  const id=document.getElementById('mo-id').value;
  const data={clienteId,vehiculoId,kmEntrada:document.getElementById('mo-km').value,combustible:document.getElementById('mo-combustible').value,daños:document.getElementById('mo-daños').value.trim(),trabajo:document.getElementById('mo-trabajo').value.trim(),fechaEntrega:document.getElementById('mo-entrega').value,estado:'recibido',fechaEntrada:id?(ordenes.find(o=>o.id===id)||{}).fechaEntrada||new Date().toISOString():new Date().toISOString()};
  if(id)db.ref(uPath+'/ordenes/'+id).update(data);
  else db.ref(uPath+'/ordenes').push(data);
  closeModal('modal-orden');
}

function verOrden(id){
  const o=ordenes.find(x=>x.id===id);if(!o)return;
  const c=clientes.find(x=>x.id===o.clienteId)||{};
  const v=getVehiculo(c,o.vehiculoId);
  const estados=['recibido','en_taller','listo','entregado'];
  const eLabel={recibido:'Recibido',en_taller:'En taller 🔧',listo:'Listo ✅',entregado:'Entregado'};
  document.getElementById('ver-orden-body').innerHTML=`
    <div style="margin-bottom:16px">
      <div style="font-size:18px;font-weight:700">${c.nombre||'Sin cliente'}</div>
      ${v?`<div class="badge badge-info" style="margin-top:6px">${v.matricula} · ${[v.marca,v.modelo].filter(Boolean).join(' ')}</div>`:''}
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Entrada: ${fmtFecha(o.fechaEntrada)}${o.fechaEntrega?' · Entrega estimada: '+fmtFechaAviso(o.fechaEntrega):''}</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${estados.map(s=>`<button onclick="cambiarEstadoOrden('${id}','${s}')" class="btn btn-sm" style="${o.estado===s?'background:var(--primary);color:#fff':'background:#f0f0f0'}">${eLabel[s]}</button>`).join('')}
      </div>
      ${o.kmEntrada?`<div style="font-size:13px;margin-bottom:6px"><b>KM entrada:</b> ${Number(o.kmEntrada).toLocaleString('es')} km</div>`:''}
      ${o.combustible?`<div style="font-size:13px;margin-bottom:6px"><b>Combustible:</b> ${o.combustible}</div>`:''}
      ${o.daños?`<div style="font-size:13px;margin-bottom:6px"><b>Daños observados:</b> ${o.daños}</div>`:''}
      ${o.trabajo?`<div style="font-size:13px"><b>Trabajo a realizar:</b> ${o.trabajo}</div>`:''}
    </div>
  `;
  document.getElementById('btn-wa-orden').onclick=()=>{closeModal('modal-ver-orden');enviarWAListoOrden(id)};
  document.getElementById('btn-pdf-orden').onclick=()=>{closeModal('modal-ver-orden');generarPDFOrden(id)};
  openModal('modal-ver-orden');
}

function cambiarEstadoOrden(id,estado){
  db.ref(uPath+'/ordenes/'+id).update({estado});
  closeModal('modal-ver-orden');
  if(estado==='listo'){if(confirm('¿Avisar al cliente por WhatsApp que el coche está listo?'))enviarWAListoOrden(id)}
}

function filterO(f){filterOrden=f;['todos','recibido','en_taller','listo','entregado'].forEach(x=>{const el=document.getElementById('fo-'+x);if(el){el.style.fontWeight=x===f?'800':'600';el.style.opacity=x===f?'1':'0.6'}});renderOrdenes();}

function renderOrdenes(){
  const f=filterOrden==='todos'?ordenes:ordenes.filter(o=>o.estado===filterOrden);
  const el=document.getElementById('lista-ordenes');
  if(!f.length){el.innerHTML='<div class="empty-state"><div class="ei">🔧</div><p>No hay órdenes.</p></div>';return}
  const eBadge={recibido:'estado-recibido',en_taller:'estado-en_taller',listo:'estado-listo',entregado:'estado-entregado'};
  const eLabel={recibido:'Recibido',en_taller:'En taller',listo:'Listo ✅',entregado:'Entregado'};
  el.innerHTML='<div class="card">'+f.map(o=>{const c=clientes.find(x=>x.id===o.clienteId)||{};const v=getVehiculo(c,o.vehiculoId);return`<div class="list-item" onclick="verOrden('${o.id}')"><div class="avatar" style="background:linear-gradient(135deg,#2d6a4f,#40916c)">${(c.nombre||'?')[0].toUpperCase()}</div><div class="list-content"><div class="list-title">${c.nombre||'Sin cliente'}${v?' · '+v.matricula:''}</div><div class="list-meta">${o.trabajo||'Sin descripción'} · ${fmtFecha(o.fechaEntrada)}</div></div><div class="list-right"><span class="badge ${eBadge[o.estado]}">${eLabel[o.estado]}</span></div></div>`;}).join('')+'</div>';
}

// AGENDA
function agendaDia(dir){agendaDate=new Date(agendaDate);agendaDate.setDate(agendaDate.getDate()+dir);renderAgenda();}
function saveCita(){
  const fecha=document.getElementById('mci-fecha').value,hora=document.getElementById('mci-hora').value;
  if(!fecha||!hora){alert('Fecha y hora son obligatorias');return}
  const id=document.getElementById('mci-id').value;
  const data={clienteId:document.getElementById('mci-cliente').value,vehiculoId:document.getElementById('mci-vehiculo').value,fecha,hora,tipo:document.getElementById('mci-tipo').value.trim(),notas:document.getElementById('mci-notas').value.trim()};
  if(id)db.ref(uPath+'/citas/'+id).update(data);
  else db.ref(uPath+'/citas').push(data);
  closeModal('modal-cita');
}
function deleteCita(id){if(!confirm('¿Eliminar esta cita?'))return;db.ref(uPath+'/citas/'+id).remove();}
function renderAgenda(){
  const dateStr=agendaDate.toISOString().split('T')[0];
  document.getElementById('agenda-fecha-label').textContent=agendaDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  const del_dia=citas.filter(c=>c.fecha===dateStr).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
  const el=document.getElementById('lista-agenda');
  if(!del_dia.length){el.innerHTML='<div class="empty-state"><div class="ei">📅</div><p>Sin citas este día.<br>Pulsa + para añadir.</p></div>';return}
  el.innerHTML=del_dia.map(ci=>{const c=clientes.find(x=>x.id===ci.clienteId)||{};const v=getVehiculo(c,ci.vehiculoId);return`<div class="cita-card"><div class="cita-hora">${ci.hora||'--:--'}</div><div class="cita-info"><div class="cita-titulo">${ci.tipo||'Cita'}</div><div class="cita-meta">${c.nombre||'Sin cliente'}${v?' · '+v.matricula:''}</div>${ci.notas?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${ci.notas}</div>`:''}</div><button onclick="deleteCita('${ci.id}')" class="btn btn-sm" style="background:#fee2e2;color:#dc3545;border:none;padding:6px">🗑️</button></div>`;}).join('');
}

// CAJA
function openModalCaja(tipo){document.getElementById('mcj-tipo').value=tipo;document.getElementById('mcj-title').textContent=tipo==='entrada'?'➕ Apuntar entrada':'➖ Apuntar salida';document.getElementById('mcj-concepto').value='';document.getElementById('mcj-importe').value='';openModal('modal-caja');}
function saveCaja(){const imp=parseFloat(document.getElementById('mcj-importe').value);if(!imp||imp<=0){alert('Introduce un importe válido');return}db.ref(uPath+'/caja').push({tipo:document.getElementById('mcj-tipo').value,concepto:document.getElementById('mcj-concepto').value.trim()||'Sin concepto',importe:imp,fecha:new Date().toISOString()});closeModal('modal-caja');}
function deleteCajaItem(id){if(!confirm('¿Eliminar?'))return;db.ref(uPath+'/caja/'+id).remove()}
function renderCaja(){
  const hoy=new Date().toDateString();
  const hoyMovs=caja.filter(m=>new Date(m.fecha).toDateString()===hoy);
  const tot=hoyMovs.reduce((a,m)=>m.tipo==='entrada'?a+m.importe:a-m.importe,0);
  document.getElementById('caja-hoy-total').textContent=fmt(tot);
  const lh=document.getElementById('lista-caja-hoy');
  lh.innerHTML=hoyMovs.length?hoyMovs.map(m=>`<div class="list-item caja-${m.tipo}" onclick="deleteCajaItem('${m.id}')"><div style="font-size:22px">${m.tipo==='entrada'?'⬆️':'⬇️'}</div><div class="list-content"><div class="list-title">${m.concepto}</div><div class="list-meta">${fmtHora(m.fecha)}</div></div><div style="font-weight:700;color:${m.tipo==='entrada'?'var(--success)':'var(--primary)'}">${m.tipo==='entrada'?'+':'-'}${fmt(m.importe)}</div></div>`).join(''):'<div class="empty-state"><div class="ei">💵</div><p>Sin movimientos hoy</p></div>';
  const dias={};
  caja.forEach(m=>{const d=new Date(m.fecha).toDateString();if(d!==hoy){if(!dias[d])dias[d]=[];dias[d].push(m)}});
  const hist=document.getElementById('lista-caja-hist');
  const keys=Object.keys(dias).sort((a,b)=>new Date(b)-new Date(a)).slice(0,7);
  hist.innerHTML=keys.map(d=>{const ms=dias[d];const t=ms.reduce((a,m)=>m.tipo==='entrada'?a+m.importe:a-m.importe,0);return`<div class="date-badge">${fmtFechaCorta(d)}</div><div class="card" style="margin-bottom:12px">${ms.map(m=>`<div class="list-item caja-${m.tipo}"><div style="font-size:18px">${m.tipo==='entrada'?'⬆️':'⬇️'}</div><div class="list-content"><div style="font-size:14px;font-weight:600">${m.concepto}</div></div><div style="font-weight:700;color:${m.tipo==='entrada'?'var(--success)':'var(--primary)'}">${m.tipo==='entrada'?'+':'-'}${fmt(m.importe)}</div></div>`).join('')}<div style="text-align:right;font-weight:700;font-size:14px;margin-top:6px;color:${t>=0?'var(--success)':'var(--primary)'}">Total: ${fmt(t)}</div></div>`;}).join('');
}

// ESTADÍSTICAS
function renderEstadisticas(){
  const ahora=new Date(),mesActual=ahora.getMonth(),añoActual=ahora.getFullYear();
  const cobrados=presupuestos.filter(p=>p.estado==='cobrado');
  const esMes=cobrados.filter(p=>{const d=new Date(p.fecha);return d.getMonth()===mesActual&&d.getFullYear()===añoActual});
  const esAño=cobrados.filter(p=>new Date(p.fecha).getFullYear()===añoActual);
  document.getElementById('est-mes').textContent=fmt(esMes.reduce((a,p)=>a+p.total,0));
  document.getElementById('est-año').textContent=fmt(esAño.reduce((a,p)=>a+p.total,0));
  document.getElementById('est-cobradas').textContent=cobrados.length;
  document.getElementById('est-pendientes').textContent=presupuestos.filter(p=>p.estado==='pendiente').length;
  const meses=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);meses.push({label:d.toLocaleDateString('es-ES',{month:'short',year:'2-digit'}),m:d.getMonth(),a:d.getFullYear()})}
  const dataChart=meses.map(m=>cobrados.filter(p=>{const d=new Date(p.fecha);return d.getMonth()===m.m&&d.getFullYear()===m.a}).reduce((a,p)=>a+p.total,0));
  if(chartIngresos)chartIngresos.destroy();
  const ctx=document.getElementById('chart-ingresos').getContext('2d');
  chartIngresos=new Chart(ctx,{type:'bar',data:{labels:meses.map(m=>m.label),datasets:[{label:'Ingresos (€)',data:dataChart,backgroundColor:'rgba(230,57,70,.7)',borderColor:'rgba(230,57,70,1)',borderWidth:2,borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false},title:{display:true,text:'Ingresos últimos 6 meses',font:{size:14}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>v+'€'}}}}});
  const topMap={};
  cobrados.forEach(p=>{if(p.clienteId)topMap[p.clienteId]=(topMap[p.clienteId]||0)+p.total});
  const top=Object.entries(topMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('est-top-clientes').innerHTML=top.length?top.map(([cid,tot])=>{const c=clientes.find(x=>x.id===cid)||{};return`<div class="list-item"><div class="avatar">${(c.nombre||'?')[0].toUpperCase()}</div><div class="list-content"><div class="list-title">${c.nombre||'Sin cliente'}</div></div><div style="font-weight:800;color:var(--primary)">${fmt(tot)}</div></div>`;}).join(''):'<div style="font-size:14px;color:var(--muted);text-align:center;padding:20px">Sin datos aún</div>';
}

// WHATSAPP AVISOS
function enviarWAAviso(id){
  const a=avisos.find(x=>x.id===id);if(!a)return;
  const c=clientes.find(x=>x.id===a.clienteId)||{};
  if(!c.telefono){alert('El cliente no tiene teléfono registrado');return}
  const v=a.vehiculoId?getVehiculo(c,a.vehiculoId):null;
  const vehiculoTxt=v?` para su ${[v.marca,v.modelo].filter(Boolean).join(' ')||'vehículo'} (${v.matricula||'sin matrícula'})`:' para su vehículo';
  const texto=`Hola ${c.nombre||''}! 👋\n\nLe recordamos que su *${a.tipo}*${vehiculoTxt} vence el *${fmtFechaAviso(a.fecha)}*.\n\n¿Quiere pedir cita? ${tallTel?'Llámenos al '+tallTel+' o responda':'Responda'} a este mensaje y le atendemos enseguida.\n\nGracias, ${tallNombre}`;
  window.open('https://wa.me/'+fmtWAPhone(c.telefono)+'?text='+encodeURIComponent(texto));
}

// AVISOS
function saveAviso(){const fecha=document.getElementById('mav-fecha').value;if(!fecha){alert('Selecciona una fecha');return}const id=document.getElementById('mav-id').value;const data={clienteId:document.getElementById('mav-cliente').value,vehiculoId:document.getElementById('mav-vehiculo').value,tipo:document.getElementById('mav-tipo').value,fecha,notas:document.getElementById('mav-notas').value.trim()};if(id)db.ref(uPath+'/avisos/'+id).update(data);else db.ref(uPath+'/avisos').push(data);closeModal('modal-aviso');}
function deleteAviso(id){if(!confirm('¿Eliminar?'))return;db.ref(uPath+'/avisos/'+id).remove()}
function renderAvisos(){
  const el=document.getElementById('lista-avisos');
  if(!avisos.length){el.innerHTML='<div class="empty-state"><div class="ei">🔔</div><p>Sin avisos.</p></div>';return}
  const hoy=new Date();hoy.setHours(0,0,0,0);
  el.innerHTML=avisos.map(a=>{const c=clientes.find(x=>x.id===a.clienteId)||{};const v=a.vehiculoId?getVehiculo(c,a.vehiculoId):null;const diff=Math.ceil((new Date(a.fecha+'T12:00:00')-hoy)/86400000);const cls=diff<0?'reminder-urgent':diff<=14?'reminder-pronto':'reminder-ok';const label=diff<0?`Vencido hace ${-diff} días`:diff===0?'¡Hoy!':'En '+diff+' días';return`<div class="card ${cls}" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><div><div style="font-weight:700">${a.tipo}</div><div style="font-size:13px;color:var(--muted)">${c.nombre||'Sin cliente'}${v?' · '+v.matricula:''}</div>${v&&(v.marca||v.modelo)?`<div style="font-size:12px;color:var(--muted)">${[v.marca,v.modelo].filter(Boolean).join(' ')}</div>`:''} ${a.notas?`<div style="font-size:12px;color:var(--muted)">${a.notas}</div>`:''}</div><div style="text-align:right"><div style="font-size:13px;font-weight:700">${fmtFechaAviso(a.fecha)}</div><div style="font-size:11px;font-weight:600;color:${diff<0?'var(--primary)':diff<=14?'var(--warning)':'var(--success)'}">${label}</div></div></div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${c.telefono?`<a href="tel:${c.telefono}" class="btn btn-secondary btn-sm">📞 Llamar</a>`:''}${c.telefono?`<button class="btn btn-whatsapp btn-sm" onclick="enviarWAAviso('${a.id}')">💬 Recordatorio</button>`:''}<button class="btn btn-danger btn-sm" onclick="deleteAviso('${a.id}')">🗑️</button></div></div>`;}).join('');
}

// INICIO
function renderInicio(){
  const hoy=new Date();
  const hoyStr=hoy.toDateString(),hoyDate=hoy.toISOString().split('T')[0];
  const movHoy=caja.filter(m=>new Date(m.fecha).toDateString()===hoyStr);
  const totHoy=movHoy.reduce((a,m)=>m.tipo==='entrada'?a+m.importe:a-m.importe,0);
  const mes=hoy.getMonth(),año=hoy.getFullYear();
  const totMes=presupuestos.filter(p=>p.estado==='cobrado'&&new Date(p.fecha).getMonth()===mes&&new Date(p.fecha).getFullYear()===año).reduce((a,p)=>a+p.total,0);
  document.getElementById('s-clientes').textContent=clientes.length;
  document.getElementById('s-pendientes').textContent=presupuestos.filter(p=>p.estado==='pendiente').length;
  document.getElementById('s-caja').textContent=fmt(totHoy).replace(' ','');
  document.getElementById('s-mes').textContent=fmt(totMes).replace(' ','');
  const citasHoy=citas.filter(c=>c.fecha===hoyDate).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
  const elC=document.getElementById('inicio-citas');
  elC.innerHTML=citasHoy.length?citasHoy.map(ci=>{const c=clientes.find(x=>x.id===ci.clienteId)||{};const v=getVehiculo(c,ci.vehiculoId);return`<div class="list-item"><div style="font-size:18px;font-weight:800;color:var(--primary);min-width:48px">${ci.hora||'--'}</div><div class="list-content"><div class="list-title">${ci.tipo||'Cita'}</div><div class="list-meta">${c.nombre||'Sin cliente'}${v?' · '+v.matricula:''}</div></div></div>`;}).join(''):'<div class="empty-state"><div class="ei">📅</div><p>Sin citas hoy</p></div>';
  const elP=document.getElementById('inicio-presupuestos');
  const ult=presupuestos.slice(0,3);
  const eBadge={pendiente:'badge-warning',cobrado:'badge-success',presupuesto:'badge-secondary'};
  elP.innerHTML=ult.length?ult.map(p=>{const c=clientes.find(x=>x.id===p.clienteId)||{};return`<div class="list-item" onclick="showPage('presupuestos');verPresupuesto('${p.id}')"><div class="list-content"><div class="list-title">${p.descripcion||'Trabajo'} <span class="badge ${eBadge[p.estado]}">${p.estado}</span></div><div class="list-meta">${c.nombre||'Sin cliente'} · ${fmt(p.total)}</div></div></div>`;}).join(''):'<div class="empty-state"><div class="ei">📋</div><p>Sin presupuestos aún</p></div>';
}

// PERFIL
function cargarLogo(input){
  const file=input.files[0];if(!file)return;
  if(file.size>500000){alert('El logo debe pesar menos de 500KB');return}
  const reader=new FileReader();
  reader.onload=e=>{
    tallLogo=e.target.result;
    const lp=document.getElementById('logo-preview');lp.src=tallLogo;
    document.getElementById('logo-preview-wrap').style.display='block';
  };
  reader.readAsDataURL(file);
}
function savePerfil(){
  const prefix=document.getElementById('pf-prefix').value.trim();
  const updates={nombre:document.getElementById('pf-nombre').value.trim()||'Mi Taller',telefono:document.getElementById('pf-tel').value.trim(),direccion:document.getElementById('pf-dir').value.trim(),cif:document.getElementById('pf-cif').value.trim(),facturaPrefix:prefix};
  if(tallLogo)updates.logo=tallLogo;
  db.ref(uPath+'/config').update(updates);
  alert('✅ Datos guardados');
}
function updatePrefixPreview(){const p=document.getElementById('pf-prefix').value.trim();const año=new Date().getFullYear();document.getElementById('prefix-preview').textContent=(p?p+'-':'')+año+'-001';}

// PDF PRESUPUESTO
function generarPDF(id){
  const p=presupuestos.find(x=>x.id===id);if(!p)return;
  const c=clientes.find(x=>x.id===p.clienteId)||{};
  const v=getVehiculo(c,p.vehiculoId);
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(26,26,46);doc.rect(0,0,210,40,'F');
  doc.setTextColor(255,255,255);
  const logoX=tallLogo?48:20;
  if(tallLogo){try{const fmt2=tallLogo.split(';')[0].split('/')[1].toUpperCase();doc.addImage(tallLogo,fmt2,16,6,28,28);}catch(e){}}
  doc.setFontSize(20);doc.setFont('helvetica','bold');doc.text(tallNombre,logoX,18);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  if(tallTel)doc.text('Tel: '+tallTel,logoX,25);
  if(tallDir)doc.text(tallDir,logoX,31);
  if(tallCif)doc.text('CIF: '+tallCif,logoX,37);
  doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text(p.estado==='presupuesto'?'PRESUPUESTO':'FACTURA',190,18,{align:'right'});
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(fmtFecha(p.fecha),190,26,{align:'right'});doc.text('Nº '+(p.numeroFactura||p.id.substr(-6).toUpperCase()),190,32,{align:'right'});
  doc.setTextColor(0,0,0);doc.setFontSize(11);doc.setFont('helvetica','bold');doc.text('CLIENTE',20,55);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(c.nombre||'-',20,62);
  if(v)doc.text('Vehículo: '+[v.marca,v.modelo].filter(Boolean).join(' ')+(v.matricula?' ('+v.matricula+')':''),20,68);
  if(c.telefono)doc.text('Tel: '+c.telefono,20,74);
  if(p.descripcion){doc.setFont('helvetica','bold');doc.text('TRABAJO: ',20,86);doc.setFont('helvetica','normal');doc.text(p.descripcion,52,86)}
  let y=96;
  doc.setFillColor(230,57,70);doc.rect(20,y-5,170,8,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text('CONCEPTO',22,y);doc.text('CANT',130,y,{align:'right'});doc.text('PRECIO',155,y,{align:'right'});doc.text('TOTAL',188,y,{align:'right'});
  y+=8;doc.setTextColor(0,0,0);doc.setFont('helvetica','normal');
  getLineas(p).forEach((l,i)=>{if(i%2===0){doc.setFillColor(248,249,250);doc.rect(20,y-4,170,7,'F')}doc.text(l.concepto||'-',22,y);doc.text(String(l.cantidad),130,y,{align:'right'});doc.text(fmt(l.precio),155,y,{align:'right'});doc.text(fmt(l.precio*l.cantidad),188,y,{align:'right'});y+=7});
  y+=5;doc.line(120,y,190,y);y+=5;
  doc.text('Subtotal:',130,y);doc.text(fmt(p.subtotal),188,y,{align:'right'});y+=6;
  doc.text('IVA (21%):',130,y);doc.text(fmt(p.iva),188,y,{align:'right'});y+=2;doc.line(120,y+2,190,y+2);y+=6;
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('TOTAL:',130,y);doc.text(fmt(p.total),188,y,{align:'right'});
  if(p.notas){y+=14;doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(100,100,100);doc.text('Notas: '+p.notas,20,y)}
  doc.setFillColor(26,26,46);doc.rect(0,280,210,17,'F');doc.setTextColor(255,255,255);doc.setFontSize(8);doc.text('Gracias por su confianza · '+tallNombre,105,290,{align:'center'});
  doc.save(`${p.estado==='presupuesto'?'Presupuesto':'Factura'}_${c.nombre||'cliente'}.pdf`);
}

// PDF ORDEN
function generarPDFOrden(id){
  const o=ordenes.find(x=>x.id===id);if(!o)return;
  const c=clientes.find(x=>x.id===o.clienteId)||{};
  const v=getVehiculo(c,o.vehiculoId);
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(26,26,46);doc.rect(0,0,210,35,'F');
  doc.setTextColor(255,255,255);
  const oLogoX=tallLogo?48:20;
  if(tallLogo){try{const fmt2=tallLogo.split(';')[0].split('/')[1].toUpperCase();doc.addImage(tallLogo,fmt2,16,4,26,26);}catch(e){}}
  doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text(tallNombre,oLogoX,14);
  doc.setFontSize(9);doc.setFont('helvetica','normal');if(tallTel)doc.text('Tel: '+tallTel,oLogoX,21);if(tallDir)doc.text(tallDir,oLogoX,27);
  doc.text('ORDEN DE TRABAJO',190,14,{align:'right'});doc.setFontSize(9);doc.text('Nº '+o.id.substr(-6).toUpperCase(),190,21,{align:'right'});doc.text(fmtFecha(o.fechaEntrada),190,27,{align:'right'});
  doc.setTextColor(0,0,0);let y=48;
  doc.setFontSize(11);doc.setFont('helvetica','bold');doc.text('DATOS DEL CLIENTE',20,y);y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Nombre: '+(c.nombre||'-'),20,y);y+=6;
  if(c.telefono){doc.text('Teléfono: '+c.telefono,20,y);y+=6}
  if(v){doc.setFont('helvetica','bold');doc.text('VEHÍCULO',120,y-12);doc.setFont('helvetica','normal');doc.text('Matrícula: '+(v.matricula||'-'),120,y-6);doc.text([v.marca,v.modelo].filter(Boolean).join(' ')||'-',120,y);if(o.kmEntrada)doc.text('KM: '+Number(o.kmEntrada).toLocaleString('es'),120,y+6)}
  y+=14;doc.line(20,y,190,y);y+=8;
  doc.setFont('helvetica','bold');doc.text('ESTADO DEL VEHÍCULO AL RECIBIR',20,y);y+=7;
  doc.setFont('helvetica','normal');doc.text('Nivel de combustible: '+(o.combustible||'-'),20,y);y+=6;
  doc.text('Daños observados: '+(o.daños||'Ninguno'),20,y);y+=10;
  doc.setFont('helvetica','bold');doc.text('TRABAJO A REALIZAR',20,y);y+=7;
  doc.setFont('helvetica','normal');doc.text(o.trabajo||'-',20,y);y+=10;
  if(o.fechaEntrega){doc.setFont('helvetica','bold');doc.text('Fecha de entrega estimada: ',20,y);doc.setFont('helvetica','normal');doc.text(fmtFechaAviso(o.fechaEntrega),95,y);y+=14}
  doc.line(20,y,190,y);y+=10;
  doc.setFont('helvetica','bold');doc.text('AUTORIZACIÓN DEL CLIENTE',20,y);y+=8;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('El abajo firmante autoriza al taller a realizar los trabajos descritos.',20,y);y+=16;
  doc.text('Firma: _____________________________',20,y);doc.text('Fecha: _______________',130,y);
  doc.setFillColor(26,26,46);doc.rect(0,280,210,17,'F');doc.setTextColor(255,255,255);doc.setFontSize(8);doc.text('Gracias por su confianza · '+tallNombre,105,290,{align:'center'});
  doc.save('OrdenTrabajo_'+(v?.matricula||c.nombre||'vehiculo')+'.pdf');
}

// HELPERS
function fmt(n){return(parseFloat(n)||0).toFixed(2).replace('.',',')+' €'}
function fmtFecha(iso){return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}
function fmtFechaCorta(d){return new Date(d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
function fmtFechaAviso(str){return new Date(str+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}
function fmtHora(iso){return new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
