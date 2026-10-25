import { createClient } from '@supabase/supabase-js';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://qmnkhmlyuwvixvigbhgz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l5XvqXMs5pySlkLHiM7NUQ_iGy08vgZ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const FALLBACK_LOCATIONS = [
  {id:'local-nb-city',type:'neighborhood',code:'SHR-CITY',name:'شهرضا'},
  {id:'local-nb-khm',type:'neighborhood',code:'KHM',name:'خمینی‌آباد'},
  {id:'local-nb-gsh',type:'neighborhood',code:'GSH',name:'شهرک قشقایی'},
  {id:'local-nb-tal',type:'neighborhood',code:'TAL',name:'شهرک طالقانی'},
  {id:'local-nb-500',type:'neighborhood',code:'500',name:'پانصد دستگاه'},
  {id:'local-nb-isl',type:'neighborhood',code:'ISL',name:'اسلام‌آباد'},
  {id:'local-nb-hos',type:'neighborhood',code:'HOS',name:'حسین‌آباد'},
  {id:'local-nb-bml',type:'neighborhood',code:'BML',name:'باغ‌ملی'},
  {id:'local-nb-srv',type:'neighborhood',code:'SRV',name:'سروستان'},
  {id:'local-nb-ord',type:'neighborhood',code:'ORD',name:'اردیبهشت'},
  {id:'local-st-001',type:'street',code:'ST001',name:'شهید بهشتی'},
  {id:'local-st-002',type:'street',code:'ST002',name:'حکیم صهبا'},
  {id:'local-st-003',type:'street',code:'ST003',name:'پاسداران'},
  {id:'local-st-004',type:'street',code:'ST004',name:'طباطبایی'},
  {id:'local-bl-001',type:'boulevard',code:'BL001',name:'بلوار امام خمینی'},
  {id:'local-bl-002',type:'boulevard',code:'BL002',name:'بلوار شهید مطهری'},
  {id:'local-st-005',type:'street',code:'ST005',name:'نواب صفوی'},
  {id:'local-st-006',type:'street',code:'ST006',name:'بلال'},
  {id:'local-st-007',type:'street',code:'ST007',name:'جانبازان'},
  {id:'local-st-008',type:'street',code:'ST008',name:'حافظ شرقی'},
  {id:'local-st-009',type:'street',code:'ST009',name:'حافظ غربی'},
  {id:'local-st-010',type:'street',code:'ST010',name:'آیت‌الله غفاری'},
  {id:'local-st-011',type:'street',code:'ST011',name:'طالقانی'},
  {id:'local-st-012',type:'street',code:'ST012',name:'آزادگان'},
  {id:'local-st-013',type:'street',code:'ST013',name:'ولیعصر شرقی'},
  {id:'local-st-014',type:'street',code:'ST014',name:'ولیعصر غربی'},
  {id:'local-st-015',type:'street',code:'ST015',name:'استقلال'},
  {id:'local-st-016',type:'street',code:'ST016',name:'پیروزی'},
  {id:'local-st-017',type:'street',code:'ST017',name:'مدرس'},
  {id:'local-st-018',type:'street',code:'ST018',name:'کشاورز'},
  {id:'local-st-019',type:'street',code:'ST019',name:'امیرکبیر'},
  {id:'local-st-020',type:'street',code:'ST020',name:'انقلاب اسلامی'},
  {id:'local-pk-001',type:'park',code:'PK001',name:'پارک ملت'},
  {id:'local-pk-002',type:'park',code:'PK002',name:'پارک خانه شهر'},
  {id:'local-pk-003',type:'park',code:'PK003',name:'پارک شهید بهشتی'},
  {id:'local-pk-004',type:'park',code:'PK004',name:'پارک معلم'},
  {id:'local-pk-005',type:'park',code:'PK005',name:'باغ بانوان'},
  {id:'local-pk-006',type:'park',code:'PK006',name:'پارک شهید ولی‌الله وفایی'},
  {id:'local-pk-007',type:'park',code:'PK007',name:'پارک اسلام‌شهر'}
];

const $ = id => document.getElementById(id);
let db;
let session = null;
let profile = null;
let offlineMode = false;
let currentGps = null;
let selectedPhotoFiles = [];
let editingId = null;
let locationsCache = [];
let syncBusy = false;

function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function val(id){return $(id)?.value ?? ''}
function num(id){const v=parseFloat(val(id));return Number.isFinite(v)?v:null}
function safe(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function isOnline(){return navigator.onLine && !offlineMode}
function nowIso(){return new Date().toISOString()}
function uid(){return crypto.randomUUID()}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('ShahrezaTreeSurveyDB',3);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('trees'))d.createObjectStore('trees',{keyPath:'id'});if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});if(!d.objectStoreNames.contains('locations'))d.createObjectStore('locations',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function put(store,obj){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)})}
function get(store,key){return new Promise((res,rej)=>{const r=tx(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function del(store,key){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function metaGet(key,def=null){const x=await get('meta',key);return x?.value ?? def}
async function metaSet(key,value){return put('meta',{key,value})}

async function init(){
  db=await openDB();
  await seedFallbackLocations();
  bindUI();
  updateNetStatus();
  const cachedProfile=await metaGet('cachedProfile');
  const {data:{session:s}}=await supabase.auth.getSession();
  session=s;
  if(session){await loadProfile();showApp();await refreshLocations();await syncAll();}
  else if(cachedProfile){$('offlineEntry').hidden=false;}
  window.addEventListener('online',async()=>{offlineMode=false;updateNetStatus();await tryRestoreSessionAndSync();});
  window.addEventListener('offline',updateNetStatus);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

async function seedFallbackLocations(){const existing=await getAll('locations');if(existing.length===0){for(const x of FALLBACK_LOCATIONS)await put('locations',x)}}

function bindUI(){
  $('loginTab').onclick=()=>switchAuth('login');$('signupTab').onclick=()=>switchAuth('signup');
  $('loginBtn').onclick=login;$('signupBtn').onclick=signup;$('continueOfflineBtn').onclick=continueOffline;$('logoutBtn').onclick=logout;
  document.querySelectorAll('.tabs button[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab,b));
  $('syncNowBtn').onclick=syncAll;$('gpsBtn').onclick=captureGps;$('mapCurrentBtn').onclick=()=>currentGps&&openMap(currentGps.latitude,currentGps.longitude);
  $('treeForm').addEventListener('submit',saveTree);$('resetBtn').onclick=resetForm;
  $('photo').addEventListener('change',previewPhotos);$('search').addEventListener('input',renderRecords);
  $('exportExcel').onclick=exportExcel;$('backupJson').onclick=backupJson;$('backupJson2').onclick=backupJson;$('restoreJson').onchange=restoreJson;
  $('closeDetail').onclick=()=>$('detailDialog').close();$('addLocationBtn').onclick=addLocation;
  ['crownScore','trunkScore','rootScore','pest','disease','irrigation','site','structural','failure','target'].forEach(id=>$(id).onchange=calcRisk);
}
function switchAuth(mode){const login=mode==='login';$('loginPane').hidden=!login;$('signupPane').hidden=login;$('loginTab').classList.toggle('active',login);$('signupTab').classList.toggle('active',!login);$('authMsg').textContent=''}
function showTab(id,btn){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tabs button[data-tab]').forEach(x=>x.classList.toggle('active',x===btn));if(id==='records')renderRecords();if(id==='dashboard')renderDashboard();if(id==='settings')renderSettings();if(id==='team')renderTeam();}

async function login(){
  $('authMsg').textContent='در حال ورود...';
  const emailInput=document.getElementById('loginEmail');
  const passwordInput=document.getElementById('loginPassword');
  emailInput?.blur();
  passwordInput?.blur();
  await new Promise(r=>setTimeout(r,150));
  const email=(emailInput?.value||'').trim().toLowerCase();
  const password=passwordInput?.value||'';
  if(!email||!password){
    $('authMsg').textContent='ایمیل و رمز عبور را کامل وارد کنید.';
    return;
  }
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){$('authMsg').textContent='ورود انجام نشد: '+error.message;return}
  session=data.session;offlineMode=false;await loadProfile();await metaSet('cachedProfile',profile);showApp();await refreshLocations();await syncAll();
}
async function signup(){
  const full_name=val('signupName').trim(),email=val('signupEmail').trim(),password=val('signupPassword');
  if(!full_name||!email||password.length<6){$('authMsg').textContent='نام، ایمیل و رمز حداقل ۶ کاراکتری را وارد کنید.';return}
  $('authMsg').textContent='در حال ساخت حساب...';
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name}}});
  if(error){$('authMsg').textContent=error.message;return}
  if(!data.session){$('authMsg').textContent='حساب ساخته شد. اگر تأیید ایمیل فعال باشد، ایمیل را تأیید و سپس وارد شوید.';switchAuth('login');return}
  session=data.session;
  await new Promise(r=>setTimeout(r,600));
  await supabase.rpc('claim_initial_admin');
  await loadProfile();await metaSet('cachedProfile',profile);showApp();await refreshLocations();await syncAll();
}
async function continueOffline(){profile=await metaGet('cachedProfile');offlineMode=true;showApp();await loadLocalLocations();toast('حالت آفلاین فعال شد')}
async function logout(){if(isOnline())await supabase.auth.signOut();session=null;profile=null;offlineMode=false;$('appShell').hidden=true;$('authGate').hidden=false;$('offlineEntry').hidden=!(await metaGet('cachedProfile'));}
async function tryRestoreSessionAndSync(){const {data:{session:s}}=await supabase.auth.getSession();if(s){session=s;await loadProfile();await syncAll();}}
async function loadProfile(){
  if(!session?.user)return;
  const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();
  if(!error&&data){profile=data;await metaSet('cachedProfile',profile)}else profile=await metaGet('cachedProfile',{id:session.user.id,full_name:session.user.email,role:'inspector',is_active:true});
}
function showApp(){
  $('authGate').hidden=true;$('appShell').hidden=false;
  $('userName').textContent=profile?.full_name||session?.user?.email||'کاربر';$('userRole').textContent=profile?.role==='admin'?'مدیر':'کارشناس';
  const admin=profile?.role==='admin';$('teamTabBtn').hidden=!admin;document.querySelectorAll('.adminOnly').forEach(x=>x.hidden=!admin);updateNetStatus();loadLocalLocations();renderRecords();
}
function updateNetStatus(){$('netStatus').textContent=isOnline()?'آنلاین':'آفلاین';$('netStatus').className='pill '+(isOnline()?'synced':'pending')}

async function refreshLocations(){
  if(isOnline()&&session){const {data,error}=await supabase.from('locations').select('*').eq('is_active',true).order('name');if(!error&&data?.length){await clearStore('locations');for(const x of data)await put('locations',x)}}
  await loadLocalLocations();
}
async function loadLocalLocations(){locationsCache=await getAll('locations');fillLocationSelects();}
function fillLocationSelects(){
  fillSelect('zone',locationsCache.filter(x=>x.type==='zone'));fillSelect('neighborhood',locationsCache.filter(x=>x.type==='neighborhood'));fillSelect('street',locationsCache.filter(x=>['street','boulevard','park'].includes(x.type)));
}
function fillSelect(id,items){const el=$(id),old=el.value;el.innerHTML='<option value="">انتخاب کنید</option>'+items.sort((a,b)=>a.name.localeCompare(b.name,'fa')).map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old;}
function locName(id){return locationsCache.find(x=>String(x.id)===String(id))?.name||''}

function calcRisk(){
  const health=Math.max(num('crownScore')||0,num('trunkScore')||0,num('rootScore')||0);const structural=Math.max(num('structural')||0,num('failure')||0);const pd=Math.max(num('pest')||0,num('disease')||0);const site=Math.max(num('irrigation')||0,num('site')||0);const target=num('target')||0;
  const score=Math.round((health/4)*30+(structural/4)*35+(pd/4)*15+(site/4)*10+(target/4)*10);let p='P4';if(score>=75)p='P1';else if(score>=50)p='P2';else if(score>=25)p='P3';const raw=Math.max(structural,health,pd);let risk='D - کم';if(raw>=4)risk='A - فوری';else if(raw>=3)risk='B - زیاد';else if(raw>=2)risk='C - متوسط';$('scoreOut').textContent=score;$('priorityOut').textContent=p;$('riskOut').textContent=risk;return{score,priority:p,risk_level:risk}}
async function captureGps(){
  try{await Geolocation.requestPermissions();const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000});currentGps={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};$('gpsText').textContent=`${currentGps.latitude.toFixed(6)}, ${currentGps.longitude.toFixed(6)} ±${Math.round(currentGps.accuracy)}m`;$('mapCurrentBtn').disabled=false;}
  catch(e){toast('GPS دریافت نشد: '+(e.message||e))}
}
function openMap(lat,lng){window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,'_blank')}
function previewPhotos(){selectedPhotoFiles=[...$('photo').files].slice(0,3);$('photoPreview').innerHTML='';selectedPhotoFiles.forEach(f=>{const u=URL.createObjectURL(f);const img=document.createElement('img');img.src=u;$('photoPreview').appendChild(img)})}

async function saveTree(e){
  e.preventDefault();const risk=calcRisk();const id=editingId||uid();const old=await get('trees',id);const record={
    id,tree_code:old?.tree_code||null,created_by:old?.created_by||profile?.id||session?.user?.id||null,updated_by:profile?.id||session?.user?.id||null,
    zone_id:val('zone')||null,neighborhood_id:val('neighborhood')||null,place_id:val('street')||null,section_name:val('section'),route_side:val('side'),local_position:val('landmark'),
    latitude:currentGps?.latitude??old?.latitude??null,longitude:currentGps?.longitude??old?.longitude??null,species:val('species'),age_class:val('ageClass'),dbh_cm:num('dbh'),height_m:num('height'),crown_diameter_m:num('crown'),
    crown_health:num('crownScore'),trunk_health:num('trunkScore'),root_collar_health:num('rootScore'),pest_disease_score:Math.max(num('pest')||0,num('disease')||0),irrigation_site_score:Math.max(num('irrigation')||0,num('site')||0),structural_score:num('structural'),failure_likelihood:num('failure'),
    risk_level:risk.risk_level,priority:risk.priority,management_group:num('management'),recommended_action:val('action'),symptoms:val('symptoms'),notes:val('notes'),device_id:await deviceId(),captured_at:old?.captured_at||nowIso(),created_at:old?.created_at||nowIso(),updated_at:nowIso(),sync_revision:old?.sync_revision||1,
    _syncState:'pending',_serverUpdatedAt:old?._serverUpdatedAt||null,_localUpdatedAt:nowIso(),_locationNames:{zone:locName(val('zone')),neighborhood:locName(val('neighborhood')),place:locName(val('street'))}
  };
  await put('trees',record);
  for(const file of selectedPhotoFiles){await put('photos',{id:uid(),tree_id:id,blob:file,mime:file.type||'image/jpeg',name:file.name||'photo.jpg',created_at:nowIso(),_syncState:'pending'});}
  toast('رکورد روی گوشی ذخیره شد');resetForm();renderRecords();if(isOnline())syncAll();
}
async function deviceId(){let d=await metaGet('deviceId');if(!d){d=uid();await metaSet('deviceId',d)}return d}
function resetForm(){editingId=null;$('treeForm').reset();currentGps=null;selectedPhotoFiles=[];$('photoPreview').innerHTML='';$('gpsText').textContent='ثبت نشده';$('mapCurrentBtn').disabled=true;$('treeIdPreview').textContent='پس از ثبت، سرور کد نهایی می‌سازد';calcRisk()}

function toServerTree(r){const out={};['id','tree_code','created_by','updated_by','zone_id','neighborhood_id','place_id','section_name','route_side','local_position','latitude','longitude','species','age_class','dbh_cm','height_m','crown_diameter_m','crown_health','trunk_health','root_collar_health','pest_disease_score','irrigation_site_score','structural_score','failure_likelihood','risk_level','priority','management_group','recommended_action','symptoms','notes','device_id','captured_at'].forEach(k=>{if(r[k]!==undefined)out[k]=r[k]});if(!out.tree_code)delete out.tree_code;return out}

async function syncAll(){
  if(syncBusy)return;if(!isOnline()||!session){$('syncStatus').textContent='آفلاین؛ داده‌ها روی گوشی محفوظ‌اند';return}
  syncBusy=true;$('syncStatus').textContent='در حال همگام‌سازی...';
  try{await pushTrees();await pushPhotos();await pullTrees();await refreshLocations();await metaSet('lastSyncAt',nowIso());$('syncStatus').textContent='همگام‌سازی کامل شد';toast('همگام‌سازی انجام شد');}
  catch(e){$('syncStatus').textContent='همگام‌سازی ناقص؛ اطلاعات محلی محفوظ است';console.error(e)}finally{syncBusy=false;renderRecords();}
}
async function pushTrees(){
  const trees=await getAll('trees');for(const r of trees.filter(x=>x._syncState==='pending')){
    if(r._serverUpdatedAt){const {data:server}=await supabase.from('trees').select('updated_at,sync_revision').eq('id',r.id).maybeSingle();if(server&&new Date(server.updated_at)>new Date(r._serverUpdatedAt)){r._syncState='conflict';await put('trees',r);continue}}
    const {data,error}=await supabase.from('trees').upsert(toServerTree(r),{onConflict:'id'}).select().single();if(error){r._syncState='error';r._syncError=error.message;await put('trees',r);continue}Object.assign(r,data,{_syncState:'synced',_serverUpdatedAt:data.updated_at,_syncError:null});await put('trees',r);
  }
}
async function pushPhotos(){
  const photos=await getAll('photos');for(const p of photos.filter(x=>x._syncState==='pending')){
    const tree=await get('trees',p.tree_id);if(!tree||tree._syncState!=='synced')continue;const userId=session.user.id;const ext=(p.mime?.split('/')[1]||'jpg').replace('jpeg','jpg');const path=`${userId}/${p.tree_id}/${p.id}.${ext}`;
    const {error:upErr}=await supabase.storage.from('tree-photos').upload(path,p.blob,{contentType:p.mime,upsert:true});if(upErr){p._syncState='error';p._syncError=upErr.message;await put('photos',p);continue}
    const {error:dbErr}=await supabase.from('tree_photos').upsert({id:p.id,tree_id:p.tree_id,storage_path:path,created_by:userId},{onConflict:'id'});if(dbErr){p._syncState='error';p._syncError=dbErr.message;await put('photos',p);continue}p.storage_path=path;p._syncState='synced';await put('photos',p);
  }
}
async function pullTrees(){
  const last=await metaGet('lastSyncAt','1970-01-01T00:00:00Z');const {data,error}=await supabase.from('trees').select('*').gte('updated_at',last).order('updated_at');if(error)throw error;for(const s of data||[]){const l=await get('trees',s.id);if(l&&['pending','conflict'].includes(l._syncState))continue;await put('trees',{...l,...s,_syncState:'synced',_serverUpdatedAt:s.updated_at,_localUpdatedAt:l?._localUpdatedAt||s.updated_at,_locationNames:{zone:locName(s.zone_id),neighborhood:locName(s.neighborhood_id),place:locName(s.place_id)}})}
}

async function renderRecords(){
  if(!db)return;let rows=await getAll('trees');const q=val('search').trim().toLowerCase();if(q)rows=rows.filter(r=>[r.tree_code,r.species,r.section_name,r.local_position,r._locationNames?.zone,r._locationNames?.neighborhood,r._locationNames?.place].join(' ').toLowerCase().includes(q));rows.sort((a,b)=>new Date(b.captured_at)-new Date(a.captured_at));$('recordsList').innerHTML=rows.length?rows.map(r=>`<div class="record"><div class="recordHead"><div><b>${safe(r.tree_code||'کد موقت '+r.id.slice(0,8))}</b><div class="recordMeta">${safe(r._locationNames?.place||locName(r.place_id)||'بدون محدوده')} • ${safe(r.species||'گونه نامشخص')}</div></div><span class="status ${r._syncState==='synced'?'synced':r._syncState==='conflict'?'conflict':'pending'}">${r._syncState==='synced'?'همگام':r._syncState==='conflict'?'تعارض':'در انتظار'}</span></div><div class="recordMeta">${safe(r.priority||'')} • ${safe(r.risk_level||'')} • ${new Date(r.captured_at).toLocaleString('fa-IR')}</div><div class="toolbar"><button onclick="window.__detail('${r.id}')">جزئیات</button><button onclick="window.__edit('${r.id}')">ویرایش</button>${r.latitude&&r.longitude?`<button onclick="window.__map(${r.latitude},${r.longitude})">نقشه</button>`:''}</div></div>`).join(''):'<p class="muted">هنوز رکوردی ثبت نشده است.</p>';
}
window.__detail=id=>showDetail(id);window.__edit=id=>editTree(id);window.__map=(a,b)=>openMap(a,b);
async function showDetail(id){
  const r=await get('trees',id),photos=(await getAll('photos')).filter(p=>p.tree_id===id);let imgs='';for(const p of photos){if(p.blob){imgs+=`<img src="${URL.createObjectURL(p.blob)}">`}}
  $('detailBody').innerHTML=`<div class="card"><h2>${safe(r.tree_code||'کد موقت')}</h2><p><b>ثبت‌کننده:</b> ${safe(r.created_by||'')}</p><p><b>محل:</b> ${safe(r._locationNames?.zone||locName(r.zone_id))} / ${safe(r._locationNames?.neighborhood||locName(r.neighborhood_id))} / ${safe(r._locationNames?.place||locName(r.place_id))}</p><p><b>بخش:</b> ${safe(r.section_name||'-')} • <b>سمت:</b> ${safe(r.route_side||'-')}</p><p><b>گونه:</b> ${safe(r.species||'-')} • <b>مرحله سنی:</b> ${safe(r.age_class||'-')}</p><p><b>GPS:</b> ${r.latitude?`${r.latitude}, ${r.longitude}`:'ثبت نشده'} ${r.latitude?`<button onclick="window.__map(${r.latitude},${r.longitude})">نمایش روی نقشه</button>`:''}</p><p><b>خطر:</b> ${safe(r.risk_level||'-')} • <b>اولویت:</b> ${safe(r.priority||'-')} • <b>گروه:</b> ${safe(r.management_group||'-')}</p><p><b>اقدام:</b> ${safe(r.recommended_action||'-')}</p><p><b>علائم:</b> ${safe(r.symptoms||'-')}</p><p><b>یادداشت:</b> ${safe(r.notes||'-')}</p><div class="detailPhotos">${imgs||'<span class="muted">عکس محلی ندارد</span>'}</div><p><b>وضعیت همگام‌سازی:</b> ${safe(r._syncState||'')}</p></div>`;$('detailDialog').showModal();
}
async function editTree(id){const r=await get('trees',id);editingId=id;const set=(x,v)=>{if($(x)&&v!==null&&v!==undefined)$(x).value=String(v)};set('zone',r.zone_id);set('neighborhood',r.neighborhood_id);set('street',r.place_id);set('section',r.section_name);set('side',r.route_side);set('landmark',r.local_position);set('species',r.species);set('ageClass',r.age_class);set('dbh',r.dbh_cm);set('height',r.height_m);set('crown',r.crown_diameter_m);set('crownScore',r.crown_health);set('trunkScore',r.trunk_health);set('rootScore',r.root_collar_health);set('structural',r.structural_score);set('failure',r.failure_likelihood);set('management',r.management_group);set('action',r.recommended_action);set('symptoms',r.symptoms);set('notes',r.notes);currentGps=r.latitude?{latitude:r.latitude,longitude:r.longitude}:null;$('gpsText').textContent=currentGps?`${r.latitude}, ${r.longitude}`:'ثبت نشده';$('mapCurrentBtn').disabled=!currentGps;$('treeIdPreview').textContent=r.tree_code||'کد هنوز از سرور دریافت نشده';calcRisk();showTab('form',document.querySelector('[data-tab=form]'));window.scrollTo({top:0,behavior:'smooth'});}

async function renderDashboard(){const rows=await getAll('trees');const p1=rows.filter(x=>x.priority==='P1').length,g4=rows.filter(x=>Number(x.management_group)===4).length,pending=rows.filter(x=>x._syncState!=='synced').length;$('kpis').innerHTML=`<div class="kpi"><span>کل رکورد</span><b>${rows.length}</b></div><div class="kpi"><span>P1</span><b>${p1}</b></div><div class="kpi"><span>گروه ۴</span><b>${g4}</b></div><div class="kpi"><span>در انتظار Sync</span><b>${pending}</b></div>`;renderBars('groupBars',[1,2,3,4].map(n=>[`گروه ${n}`,rows.filter(x=>Number(x.management_group)===n).length]));renderBars('riskBars',['A','B','C','D'].map(c=>[c,rows.filter(x=>(x.risk_level||'').startsWith(c)).length]));const m={};rows.forEach(x=>{const k=x._locationNames?.place||locName(x.place_id)||'نامشخص';m[k]=(m[k]||0)+1});$('hotspots').innerHTML=Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`<div>${safe(k)} — <b>${v}</b></div>`).join('')||'<p class="muted">داده‌ای نیست</p>'}
function renderBars(id,arr){const max=Math.max(1,...arr.map(x=>x[1]));$(id).innerHTML=arr.map(([k,v])=>`<div class="barrow"><span>${k}</span><div class="bar"><i style="width:${(v/max)*100}%"></i></div><b>${v}</b></div>`).join('')}

async function renderSettings(){await loadLocalLocations();const names=t=>locationsCache.filter(x=>t.includes(x.type)).sort((a,b)=>a.name.localeCompare(b.name,'fa')).map(x=>safe(x.name)).join('، ');$('zonesList').innerHTML=names(['zone'])||'<span class="muted">پس از دریافت فهرست رسمی تکمیل می‌شود.</span>';$('neighborhoodsList').innerHTML=names(['neighborhood']);$('streetsList').innerHTML=names(['street','boulevard','park']);}
async function addLocation(){if(profile?.role!=='admin'||!isOnline()){toast('این کار نیازمند مدیر آنلاین است');return}const type=val('newLocationType'),name=val('newLocationName').trim(),code=val('newLocationCode').trim().toUpperCase();if(!name||!code){toast('نام و کد را وارد کنید');return}const {data,error}=await supabase.from('locations').insert({type,name,code}).select().single();if(error){toast(error.message);return}await put('locations',data);$('newLocationName').value='';$('newLocationCode').value='';await renderSettings();fillLocationSelects();toast('به بانک مرکزی اضافه شد')}

async function renderTeam(){if(profile?.role!=='admin')return;const {data,error}=await supabase.from('profiles').select('*').order('created_at');if(error){$('teamList').textContent=error.message;return}$('teamList').innerHTML=(data||[]).map(u=>`<div class="teamRow"><div><b>${safe(u.full_name||u.id)}</b><div class="muted">${u.id.slice(0,8)}…</div></div><select onchange="window.__role('${u.id}',this.value)"><option value="inspector" ${u.role==='inspector'?'selected':''}>کارشناس</option><option value="admin" ${u.role==='admin'?'selected':''}>مدیر</option></select><select onchange="window.__active('${u.id}',this.value)"><option value="1" ${u.is_active?'selected':''}>فعال</option><option value="0" ${!u.is_active?'selected':''}>غیرفعال</option></select></div>`).join('')}
window.__role=async(id,role)=>{const {error}=await supabase.from('profiles').update({role}).eq('id',id);if(error)toast(error.message);else{toast('نقش تغییر کرد');if(id===profile.id){await loadProfile();showApp()}renderTeam()}};
window.__active=async(id,v)=>{const {error}=await supabase.from('profiles').update({is_active:v==='1'}).eq('id',id);if(error)toast(error.message);else{toast('وضعیت تغییر کرد');renderTeam()}};

async function exportExcel(){const rows=await getAll('trees');const data=rows.map(r=>({کد:r.tree_code||r.id,ناحیه:r._locationNames?.zone||locName(r.zone_id),محله:r._locationNames?.neighborhood||locName(r.neighborhood_id),محدوده:r._locationNames?.place||locName(r.place_id),بخش:r.section_name,گونه:r.species,عرض_جغرافیایی:r.latitude,طول_جغرافیایی:r.longitude,اولویت:r.priority,خطر:r.risk_level,گروه:r.management_group,اقدام:r.recommended_action,وضعیت_همگام:r._syncState}));const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(data);XLSX.utils.book_append_sheet(wb,ws,'Trees');const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'});await shareBinary(bytes,`Shahreza_Trees_${new Date().toISOString().slice(0,10)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
async function shareBinary(bytes,name,mime){try{const base64=arrayBufferToBase64(bytes);const w=await Filesystem.writeFile({path:name,data:base64,directory:Directory.Cache});await Share.share({title:name,url:w.uri,dialogTitle:'ذخیره یا اشتراک فایل'});}catch(e){const blob=new Blob([bytes],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();}}
function arrayBufferToBase64(buffer){let binary='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.byteLength;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary)}
async function backupJson(){const payload={version:'0.3',created_at:nowIso(),trees:await getAll('trees'),locations:await getAll('locations')};const text=JSON.stringify(payload,null,2);try{const w=await Filesystem.writeFile({path:`Shahreza_Backup_${Date.now()}.json`,data:btoa(unescape(encodeURIComponent(text))),directory:Directory.Cache});await Share.share({title:'پشتیبان سامانه درختان',url:w.uri});}catch(e){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download='Shahreza_Backup.json';a.click()}}
async function restoreJson(e){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());for(const r of data.trees||[])await put('trees',{...r,_syncState:r._syncState==='synced'?'pending':r._syncState||'pending'});for(const l of data.locations||[])await put('locations',l);await loadLocalLocations();renderRecords();toast('پشتیبان بازیابی شد');}catch(err){toast('فایل پشتیبان معتبر نیست')}}

init().catch(e=>{console.error(e);$('authMsg').textContent='خطا در راه‌اندازی برنامه: '+e.message});
