// PigShopTH PWA v2 (full)
// Data model stored in localStorage (lightweight, offline)
const THB = new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0});
const SKEY='pigshop.v2.full'; const SETKEY='pigshop.settings.v2.full';
let state={date:todayYMD(),days:load(SKEY,[]),settings:load(SETKEY,{quick:[100,150,200,500],sheetsUrl:''})};

function todayYMD(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function load(k,def){try{return JSON.parse(localStorage.getItem(k))??def}catch(e){return def}}
function save(){localStorage.setItem(SKEY,JSON.stringify(state.days));localStorage.setItem(SETKEY,JSON.stringify(state.settings))}
function day(){let d=state.days.find(x=>x.date===state.date);if(!d){d={id:crypto.randomUUID(),date:state.date,pigBatches:[],sales:[],expenses:[],notes:'',breakEvenPigAt:null,breakEvenAllAt:null};state.days.push(d)}return d}
function sum(arr,field){return arr.reduce((a,b)=>a+Number(b[field]||0),0)}
function fmt(n){return THB.format(Math.max(0,Math.round(Number(n)||0)))}
function setProg(el,p){el.style.width=Math.max(0,Math.min(100,Math.round(p*100)))+'%'}
function recalc(d){
  d.breakEvenPigAt=null; d.breakEvenAllAt=null;
  const fund=d.pigBatches.reduce((a,b)=>a+b.pigs.reduce((x,y)=>x+Number(y.costTHB||0),0),0);
  const exp=sum(d.expenses,'amount'); const all=fund+exp;
  let run=0; const sales=[...d.sales].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  for(const s of sales){ run+=Number(s.amount);
    if(!d.breakEvenPigAt && run>=fund) d.breakEvenPigAt=s.createdAt;
    if(!d.breakEvenAllAt && run>=all) d.breakEvenAllAt=s.createdAt;
    if(d.breakEvenPigAt && d.breakEvenAllAt) break;
  }
}

// Shorthands
const $=s=>document.querySelector(s);
const dp=$('#datePicker'),btnToday=$('#btnToday');
const valFund=$('#valFund'),valSales=$('#valSales'),valExpense=$('#valExpense'),valProfit=$('#valProfit');
const remPig=$('#remPig'),remAll=$('#remAll'),progPig=$('#progPig'),progAll=$('#progAll');
const batchList=$('#batchList'),saleList=$('#saleList'),expList=$('#expList');
const monthSummary=$('#monthSummary'),historyList=$('#historyList');

// ----- Dialogs (built here so file stays single) -----
const dlgSale=document.createElement('dialog');dlgSale.innerHTML=`<h3>เพิ่มยอดขาย</h3>
<div class="grid"><label>จำนวน (บาท)</label><input id="saleAmount" type="number" inputmode="numeric" min="0" step="1">
<label>หมายเหตุ</label><input id="saleNote" type="text"></div><div class="chips" id="quickChips"></div>
<menu><button id="saleCancel">ยกเลิก</button><button id="saleSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgSale);

const dlgExpense=document.createElement('dialog');dlgExpense.innerHTML=`<h3>เพิ่ม/แก้ไข ค่าใช้จ่าย</h3>
<div class="grid"><label>ตั้งชื่อ</label><input id="expTitle" type="text">
<label>หมวด</label><select id="expCat"><option>น้ำแข็ง</option><option>ค่าแรง</option><option>ขนส่ง</option><option>ถุง</option><option>อื่น ๆ</option></select>
<label>จำนวน (บาท)</label><input id="expAmount" type="number" inputmode="numeric" min="0" step="1">
<label>หมายเหตุ</label><input id="expNote" type="text"></div>
<menu><button id="expCancel">ยกเลิก</button><button id="expSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgExpense);

const dlgBatch=document.createElement('dialog');dlgBatch.innerHTML=`<h3>เพิ่มทุน (ระบุทีละตัว)</h3>
<div class="grid"><label>ตั้งชื่อชุด</label><input id="bName" type="text" value="ชุดเช้า"><label>ผู้ขาย</label><input id="bSup" type="text"></div>
<div id="pigsWrap"></div><div class="chips"><button id="addPig" class="secondary">+ เพิ่มตัว</button></div>
<menu><button id="bCancel">ยกเลิก</button><button id="bSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgBatch);

const dlgClose=document.createElement('dialog');dlgClose.innerHTML=`<h3>ปิดวัน / ส่งออก</h3>
<div class="grid"><label>บันทึกเพิ่มเติม</label><input id="closeNote" type="text">
<label>Google Sheets Web App URL</label><input id="sheetsUrl" type="url" placeholder="https://script.google.com/..."></div>
<div class="export-actions"><button id="btnExportCSV" class="secondary">ส่งออก CSV (เดือนนี้)</button>
<button id="btnAppendSheets" class="secondary">Append วันนี้ → Sheets</button></div><div id="closeMsg" class="muted"></div>
<menu><button id="closeCancel">ปิด</button></menu>`;document.body.appendChild(dlgClose);

// ----- Actions -----
$('#btnAddSale').addEventListener('click',()=>{dlgSale.showModal(); renderQuick()});
$('#btnAddExpense').addEventListener('click',()=>{openExpense()});
$('#btnAddBatch').addEventListener('click',()=>{openBatch()});
$('#btnCloseDay').addEventListener('click',()=>{openClose()});

function renderQuick(){ const wrap=dlgSale.querySelector('#quickChips'); wrap.innerHTML='';
  (state.settings.quick||[100,150,200,500]).forEach(n=>{const b=document.createElement('button'); b.textContent=n; b.onclick=()=>dlgSale.querySelector('#saleAmount').value=String(n); wrap.appendChild(b)});
}

function openExpense(editId=null){
  const d=day(); const t=dlgExpense;
  t.dataset.editId=editId||'';
  t.querySelector('#expTitle').value=''; t.querySelector('#expNote').value=''; t.querySelector('#expAmount').value=''; t.querySelector('#expCat').value='น้ำแข็ง';
  if(editId){
    const e=d.expenses.find(x=>x.id===editId);
    if(e){ t.querySelector('#expTitle').value=e.title; t.querySelector('#expAmount').value=e.amount; t.querySelector('#expCat').value=e.category; t.querySelector('#expNote').value=e.note||''; }
  }
  t.showModal();
}
dlgExpense.querySelector('#expCancel').onclick=()=>dlgExpense.close();
dlgExpense.querySelector('#expSave').onclick=()=>{
  const d=day(); const editId=dlgExpense.dataset.editId||null;
  const obj={ id: editId||crypto.randomUUID(), title: dlgExpense.querySelector('#expTitle').value.trim(), category: dlgExpense.querySelector('#expCat').value, amount: Math.round(Number(dlgExpense.querySelector('#expAmount').value||0)), note: dlgExpense.querySelector('#expNote').value||'', createdAt: new Date().toISOString() };
  if(!obj.title || obj.amount<=0){ return; }
  if(editId){ const i=d.expenses.findIndex(x=>x.id===editId); if(i>=0) d.expenses[i]=obj; } else { d.expenses.push(obj); }
  recalc(d); save(); renderAll(); dlgExpense.close();
};

function openBatch(){ const w=dlgBatch.querySelector('#pigsWrap'); w.innerHTML=''; addPigRow(); dlgBatch.showModal(); }
function addPigRow(){ const w=dlgBatch.querySelector('#pigsWrap'); const row=document.createElement('div'); row.className='row';
  row.innerHTML=`<div class="meta">ตัวหมู</div><div class="btns">
    <input class="w" type="number" inputmode="decimal" min="0" step="0.1" placeholder="กก.">
    <input class="c" type="number" inputmode="numeric" min="0" step="1" placeholder="บาท">
    <button class="small del">ลบ</button></div>`;
  row.querySelector('.del').onclick=()=>row.remove(); w.appendChild(row);
}
dlgBatch.querySelector('#addPig').onclick=addPigRow;
dlgBatch.querySelector('#bCancel').onclick=()=>dlgBatch.close();
dlgBatch.querySelector('#bSave').onclick=()=>{
  const d=day();
  const pigs=[...dlgBatch.querySelectorAll('#pigsWrap .row')].map(r=>({ id:crypto.randomUUID(), weightKg:Number(r.querySelector('.w').value||0), costTHB:Math.round(Number(r.querySelector('.c').value||0)) }))
                .filter(p=>p.weightKg>0 && p.costTHB>0);
  if(pigs.length===0){ return; }
  d.pigBatches.push({ id:crypto.randomUUID(), name: dlgBatch.querySelector('#bName').value||'ชุด', supplier: dlgBatch.querySelector('#bSup').value||'', createdAt:new Date().toISOString(), pigs });
  recalc(d); save(); renderAll(); dlgBatch.close();
};

// Sale dialog
dlgSale.querySelector('#saleCancel').onclick=()=>dlgSale.close();
dlgSale.querySelector('#saleSave').onclick=()=>{
  const v=Math.round(Number(dlgSale.querySelector('#saleAmount').value||0)); if(v<=0){return}
  const d=day(); d.sales.push({ id:crypto.randomUUID(), amount:v, note: dlgSale.querySelector('#saleNote').value||'', createdAt:new Date().toISOString() });
  recalc(d); save(); renderAll(); dlgSale.close();
};

// Close dialog: CSV + Google Sheets
function openClose(){
  const d=day(); dlgClose.querySelector('#closeNote').value=d.notes||''; dlgClose.querySelector('#sheetsUrl').value=state.settings.sheetsUrl||''; dlgClose.querySelector('#closeMsg').textContent=''; dlgClose.showModal();
}
dlgClose.querySelector('#closeCancel').onclick=()=>dlgClose.close();
dlgClose.querySelector('#btnExportCSV').onclick=()=>{
  const now=new Date(state.date); const y=now.getFullYear(), m=now.getMonth();
  const list=state.days.filter(dd=>{const dt=new Date(dd.date+'T00:00:00');return dt.getFullYear()===y&&dt.getMonth()===m}).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const header="Date,TotalFund,TotalExpense,TotalSales,Profit,BreakEvenPigAt,BreakEvenAllAt,Notes"; const lines=[header];
  for(const d of list){
    const tf=d.pigBatches.reduce((a,b)=>a+b.pigs.reduce((x,y)=>x+y.costTHB,0),0);
    const te=sum(d.expenses,'amount'); const ts=sum(d.sales,'amount'); const profit=Math.max(0,ts-tf-te);
    const pig=d.breakEvenPigAt?new Date(d.breakEvenPigAt).toLocaleString('th-TH'):""; const all=d.breakEvenAllAt?new Date(d.breakEvenAllAt).toLocaleString('th-TH'):"";
    const note=(d.notes||'').replace(/,/g,' ');
    lines.push([d.date,tf,te,ts,profit,pig,all,note].join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`PigShop-${state.date.slice(0,7)}.csv`; a.click();
};
dlgClose.querySelector('#btnAppendSheets').onclick=async()=>{
  const url=(dlgClose.querySelector('#sheetsUrl').value||'').trim(); state.settings.sheetsUrl=url; save();
  const d=day(); d.notes=dlgClose.querySelector('#closeNote').value||'';
  const tf=d.pigBatches.reduce((a,b)=>a+b.pigs.reduce((x,y)=>x+y.costTHB,0),0); const te=sum(d.expenses,'amount'); const ts=sum(d.sales,'amount'); const profit=Math.max(0,ts-tf-te);
  const payload={date:d.date,totalFund:tf,totalExpense:te,totalSales:ts,profit,breakEvenPigAt:d.breakEvenPigAt?new Date(d.breakEvenPigAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):null,breakEvenAllAt:d.breakEvenAllAt?new Date(d.breakEvenAllAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):null,dayNote:d.notes||''};
  try{ const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); dlgClose.querySelector('#closeMsg').textContent=res.ok?'ส่งข้อมูลเรียบร้อย':'ส่งไม่สำเร็จ'; }catch(e){ dlgClose.querySelector('#closeMsg').textContent='ออฟไลน์/ลิงก์ผิด'; }
};

// ----- Rendering -----
function renderTop(){
  const d=day();
  const tf=d.pigBatches.reduce((a,b)=>a+b.pigs.reduce((x,y)=>x+y.costTHB,0),0);
  const ts=sum(d.sales,'amount'); const te=sum(d.expenses,'amount'); const profit=Math.max(0,ts-tf-te);
  valFund.textContent=fmt(tf); valSales.textContent=fmt(ts); valExpense.textContent=fmt(te); valProfit.textContent=fmt(profit);
  const pigRemain=Math.max(0,tf-ts), allRemain=Math.max(0,tf+te-ts);
  remPig.textContent=pigRemain===0?'ถึงแล้ว':`ขาดอีก ${fmt(pigRemain)}`;
  remAll.textContent=allRemain===0?'ถึงแล้ว':`ขาดอีก ${fmt(allRemain)}`;
  setProg(progPig, tf===0?0:ts/tf); setProg(progAll, (tf+te)===0?0:ts/(tf+te));
}
function renderLists(){
  const d=day();
  // Batches
  batchList.innerHTML='';
  d.pigBatches.forEach(b=>{
    const total = b.pigs.reduce((a,p)=>a+p.costTHB,0);
    const weight = b.pigs.reduce((a,p)=>a+p.weightKg,0);
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div><div><strong>${b.name}</strong></div><div class="meta">จำนวน ${b.pigs.length} ตัว • รวม ${weight} กก.</div></div>
      <div class="btns"><div class="meta">${fmt(total)}</div> <button class="small del">ลบ</button></div>`;
    row.querySelector('.del').onclick=()=>{ d.pigBatches=d.pigBatches.filter(x=>x.id!==b.id); recalc(d); save(); renderAll(); };
    batchList.appendChild(row);
  });
  // Sales
  saleList.innerHTML='';
  d.sales.forEach(s=>{
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div><div>${s.note||'ขาย'}</div><div class="meta">${new Date(s.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="btns"><div class="meta">${fmt(s.amount)}</div> <button class="small del">ลบ</button></div>`;
    row.querySelector('.del').onclick=()=>{ d.sales=d.sales.filter(x=>x.id!==s.id); recalc(d); save(); renderAll(); };
    saleList.appendChild(row);
  });
  // Expenses
  expList.innerHTML='';
  d.expenses.forEach(e=>{
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div><div><strong>${e.title}</strong> • ${e.category}</div><div class="meta">${e.note||''}</div></div>
      <div class="btns"><div class="meta">${fmt(e.amount)}</div> <button class="small edit">แก้</button> <button class="small del">ลบ</button></div>`;
    row.querySelector('.edit').onclick=()=>openExpense(e.id);
    row.querySelector('.del').onclick=()=>{ d.expenses=d.expenses.filter(x=>x.id!==e.id); recalc(d); save(); renderAll(); };
    expList.appendChild(row);
  });
}
function renderHistory(){
  const now=new Date(state.date); const y=now.getFullYear(), m=now.getMonth();
  const list=state.days.filter(d=>{const dt=new Date(d.date+'T00:00:00');return dt.getFullYear()===y && dt.getMonth()===m}).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let F=0,E=0,S=0,P=0,hitPig=0,hitAll=0;
  historyList.innerHTML='';
  list.forEach(d=>{
    const tf=d.pigBatches.reduce((a,b)=>a+b.pigs.reduce((x,y)=>x+y.costTHB,0),0);
    const te=sum(d.expenses,'amount'); const ts=sum(d.sales,'amount'); const pr=Math.max(0,ts-tf-te);
    F+=tf;E+=te;S+=ts;P+=pr; if(d.breakEvenPigAt)hitPig++; if(d.breakEvenAllAt)hitAll++;
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div><div class="title">${d.date}</div><div class="meta">ทุน: ${fmt(tf)} | ขาย: ${fmt(ts)} | กำไร: ${fmt(pr)}</div></div>`;
    row.onclick=()=>{ state.date=d.date; dp.value=d.date; renderAll(); };
    historyList.appendChild(row);
  });
  monthSummary.textContent=`ทุนรวม ${fmt(F)} | ค่าใช้จ่ายรวม ${fmt(E)} | ยอดขายรวม ${fmt(S)} | กำไรรวม ${fmt(P)} | แตะทุนหมู ${hitPig} วัน | ครอบคลุมทั้งหมด ${hitAll} วัน`;
}
function renderAll(){ renderTop(); renderLists(); renderHistory(); }

// Date controls
dp.value=state.date;
btnToday.onclick=()=>{ state.date=todayYMD(); dp.value=state.date; renderAll(); };
dp.onchange=e=>{ state.date=e.target.value; renderAll(); };

// Initial render
renderAll();
