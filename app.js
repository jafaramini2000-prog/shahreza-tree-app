
const DB="shahrezaTreeSurveyV1";
let records=JSON.parse(localStorage.getItem(DB)||"[]");
let editingId=null, lat=null, lon=null, photoData=null;
const $=id=>document.getElementById(id);
function toast(s){let t=$("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active");if(b.dataset.tab==="records") renderRecords(); if(b.dataset.tab==="dashboard") renderDashboard()})

let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden")}};

function n(id){let v=parseFloat($(id).value);return isNaN(v)?0:v}
function calc(){
  let health=Math.max(n("crownScore"),n("trunkScore"),n("rootScore"));
  let bio=Math.max(n("pest"),n("disease"));
  let env=Math.max(n("irrigation"),n("site"));
  let risk=Math.max(n("structural"),n("failure"));
  let target=n("target");
  let score=Math.round((health/4)*30+(risk/4)*35+(bio/4)*15+(env/4)*10+(target/4)*10);
  let priority=score>=75?"P1":score>=50?"P2":score>=25?"P3":"P4";
  let riskTxt=risk>=4?"A - فوری":risk>=3?"B - زیاد":risk>=2?"C - متوسط":"D - کم";
  $("scoreOut").textContent=score;$("priorityOut").textContent=priority;$("riskOut").textContent=riskTxt;
  return {score,priority,riskTxt};
}
["crownScore","trunkScore","rootScore","pest","disease","irrigation","site","structural","failure","target"].forEach(id=>$(id).addEventListener("change",calc));

$("gpsBtn").onclick=()=>{if(!navigator.geolocation)return toast("GPS در دسترس نیست");$("gpsText").textContent="در حال دریافت...";navigator.geolocation.getCurrentPosition(p=>{lat=p.coords.latitude;lon=p.coords.longitude;$("gpsText").textContent=`${lat.toFixed(6)}, ${lon.toFixed(6)}`},e=>{$("gpsText").textContent="خطا در GPS";toast("اجازه دسترسی به موقعیت را بررسی کنید")},{enableHighAccuracy:true,timeout:12000})}

$("photo").onchange=()=>{let f=$("photo").files[0];if(!f){photoData=null;return}let r=new FileReader();r.onload=()=>photoData=r.result;r.readAsDataURL(f)};

function resetForm(){
  $("treeForm").reset(); editingId=null; lat=lon=photoData=null;$("gpsText").textContent="ثبت نشده";calc();
}
$("resetBtn").onclick=resetForm;

$("treeForm").onsubmit=e=>{
  e.preventDefault(); let c=calc();
  let rec={
    uid:editingId||crypto.randomUUID(), treeId:$("treeId").value.trim(), visitDate:new Date().toISOString(),
    inspector:$("inspector").value.trim(), zone:$("zone").value.trim(), place:$("place").value.trim(),
    species:$("species").value.trim(), ageClass:$("ageClass").value, lat, lon,
    dbh:$("dbh").value, height:$("height").value, crown:$("crown").value,
    crownScore:$("crownScore").value,trunkScore:$("trunkScore").value,rootScore:$("rootScore").value,
    pest:$("pest").value,disease:$("disease").value,irrigation:$("irrigation").value,site:$("site").value,
    conflict:$("conflict").value,target:$("target").value,symptoms:$("symptoms").value.trim(),
    structural:$("structural").value,failure:$("failure").value,risk:c.riskTxt,score:c.score,priority:c.priority,
    management:$("management").value,action:$("action").value,notes:$("notes").value.trim(),photo:photoData
  };
  let dup=records.find(x=>x.treeId===rec.treeId && x.uid!==rec.uid);
  if(dup && !confirm("برای این شناسه قبلاً رکورد وجود دارد. ذخیره شود؟"))return;
  let i=records.findIndex(x=>x.uid===rec.uid); if(i>=0)records[i]=rec;else records.push(rec);
  persist();toast("رکورد ذخیره شد");resetForm();
}
function persist(){localStorage.setItem(DB,JSON.stringify(records))}
function labelScore(v){return ["خوب","خفیف","متوسط","شدید","بحرانی"][parseInt(v)]||"NA"}
function renderRecords(){
  let q=$("search").value.trim().toLowerCase();
  let arr=records.filter(r=>!q||[r.treeId,r.place,r.zone,r.species,r.inspector].join(" ").toLowerCase().includes(q)).slice().reverse();
  $("recordsList").innerHTML=arr.length?arr.map(r=>`<div class="record">
    <div class="recordhead"><b>${esc(r.treeId)}</b><span class="badge">${esc(r.priority)} | گروه ${esc(r.management)}</span></div>
    <div>${esc(r.place)} — ${esc(r.species||"گونه ثبت نشده")}</div>
    <div class="small">خطر: ${esc(r.risk)} | امتیاز: ${r.score} | اقدام: ${esc(r.action)}</div>
    <div class="recordActions"><button onclick="editRec('${r.uid}')">ویرایش</button><button onclick="deleteRec('${r.uid}')">حذف</button></div>
  </div>`).join(""):"<p class='muted'>رکوردی ثبت نشده است.</p>";
}
$("search").oninput=renderRecords;
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
window.deleteRec=id=>{if(confirm("این رکورد حذف شود؟")){records=records.filter(r=>r.uid!==id);persist();renderRecords();renderDashboard()}}
window.editRec=id=>{let r=records.find(x=>x.uid===id);if(!r)return;editingId=id;["treeId","inspector","zone","place","species","ageClass","dbh","height","crown","crownScore","trunkScore","rootScore","pest","disease","irrigation","site","conflict","target","symptoms","structural","failure","management","action","notes"].forEach(k=>{if($(k))$(k).value=r[k]??""});lat=r.lat;lon=r.lon;photoData=r.photo;$("gpsText").textContent=lat?`${lat.toFixed(6)}, ${lon.toFixed(6)}`:"ثبت نشده";calc();document.querySelector('[data-tab="form"]').click();window.scrollTo(0,0)}

function renderDashboard(){
 let total=records.length, p1=records.filter(r=>r.priority==="P1").length, g4=records.filter(r=>r.management==="4").length, flagged=records.filter(r=>+r.pest>0||+r.disease>0).length;
 $("kpis").innerHTML=[["کل رکورد",total],["P1 فوری",p1],["گروه ۴",g4],["دارای علامت آفت/بیماری",flagged]].map(x=>`<div class="kpi"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
 bars("groupBars",["1","2","3","4"].map(k=>["گروه "+k,records.filter(r=>r.management===k).length]),total);
 let risks=["A - فوری","B - زیاد","C - متوسط","D - کم"];bars("riskBars",risks.map(k=>[k,records.filter(r=>r.risk===k).length]),total);
 let m={};records.forEach(r=>{let k=(r.zone+" "+r.place).trim()||"نامشخص";m[k]??={n:0,bad:0};m[k].n++;if(r.priority==="P1"||r.priority==="P2"||r.management==="4")m[k].bad++});
 let hot=Object.entries(m).map(([k,v])=>[k,v.bad,v.n,v.n?Math.round(v.bad/v.n*100):0]).sort((a,b)=>b[3]-a[3]).slice(0,10);
 $("hotspots").innerHTML=hot.length?hot.map(x=>`<div class="record"><b>${esc(x[0])}</b><div class="small">${x[1]} مورد اولویت‌دار از ${x[2]} رکورد (${x[3]}٪)</div></div>`).join(""):"<p class='muted'>داده کافی وجود ندارد.</p>";
}
function bars(id,arr,total){$(id).innerHTML=arr.map(([k,v])=>{let p=total?Math.round(v/total*100):0;return `<div class="barrow"><span>${k}</span><div class="bar"><i style="width:${p}%"></i></div><b>${v}</b></div>`}).join("")}

function flat(r){return {
 "شناسه درخت":r.treeId,"تاریخ بازدید":r.visitDate,"بازدیدکننده":r.inspector,"ناحیه":r.zone,"معبر/بوستان":r.place,
 "گونه":r.species,"مرحله سنی":r.ageClass,"عرض جغرافیایی":r.lat,"طول جغرافیایی":r.lon,"DBH_cm":r.dbh,"ارتفاع_m":r.height,"قطر تاج_m":r.crown,
 "سلامت تاج":labelScore(r.crownScore),"سلامت تنه":labelScore(r.trunkScore),"ریشه/طوقه":labelScore(r.rootScore),
 "شدت آفت":r.pest,"شدت بیماری":r.disease,"آبیاری کد":r.irrigation,"بستر کد":r.site,"تعارض":r.conflict,
 "علائم/توضیح":r.symptoms,"نقص سازه‌ای":r.structural,"احتمال شکست":r.failure,"سطح خطر":r.risk,"امتیاز اولویت":r.score,"اولویت":r.priority,
 "گروه مدیریتی":r.management,"اقدام":r.action,"یادداشت":r.notes
}}
function download(name,content,type){let b=new Blob([content],{type});let a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("exportCsv").onclick=()=>{
 let arr=records.map(flat);if(!arr.length)return toast("داده‌ای وجود ندارد");let hs=Object.keys(arr[0]);
 let q=s=>'"'+String(s??"").replaceAll('"','""')+'"';let csv="\uFEFF"+hs.map(q).join(",")+"\n"+arr.map(r=>hs.map(h=>q(r[h])).join(",")).join("\n");
 download("Shahreza_Trees.csv",csv,"text/csv;charset=utf-8");toast("CSV ساخته شد")
}
$("exportExcel").onclick=()=>{
 let arr=records.map(flat);if(!arr.length)return toast("داده‌ای وجود ندارد");
 let hs=Object.keys(arr[0]);let xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
 <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Trees"><Table>`;
 xml+="<Row>"+hs.map(h=>`<Cell><Data ss:Type="String">${xmlEsc(h)}</Data></Cell>`).join("")+"</Row>";
 arr.forEach(r=>xml+="<Row>"+hs.map(h=>`<Cell><Data ss:Type="String">${xmlEsc(r[h])}</Data></Cell>`).join("")+"</Row>");
 xml+="</Table></Worksheet></Workbook>";
 download("Shahreza_Trees.xls","\uFEFF"+xml,"application/vnd.ms-excel");toast("فایل Excel ساخته شد")
}
function xmlEsc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

$("backupJson").onclick=()=>download("Shahreza_Trees_Backup.json",JSON.stringify(records,null,2),"application/json");
$("restoreJson").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!Array.isArray(x))throw 0;records=x;persist();renderDashboard();toast("پشتیبان بازیابی شد")}catch{toast("فایل معتبر نیست")}};r.readAsText(f)}
$("clearAll").onclick=()=>{if(confirm("همه داده‌های این گوشی حذف شود؟")){records=[];persist();renderDashboard();renderRecords();toast("داده‌ها حذف شد")}}

if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
calc();renderDashboard();
