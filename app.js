// PigShopTH v11 — Summary Deep Dive, trends, expense pie, supplier stats, badges
// PigShopTH v11 — Summary Deep Dive, trends, expense pie, supplier stats, badges
const THB = new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0});
const SKEY='pigshop.v10.days'; const SETKEY='pigshop.v10.settings';

// Defaults
const DEFAULT_SESSIONS = ['เช้า','เย็น','อื่นๆ'];
const DEFAULT_FUNDCATS = [
  {key:'pig', name:'หมูเป็นตัว', type:'pig'},
  {key:'half', name:'หมูซีก', type:'pig'},
  {key:'supp', name:'ทุนเสริม', type:'bulk'}
];
const DEFAULT_QUICK = [20,50,100,500];
const DEFAULT_EXPCATS = ['น้ำแข็ง','ค่าแรง','ถุง','ค่าน้ำมัน','ค่าน้ำ-ค่าไฟ'];

let state={
  date:todayYMD(),
  days:load(SKEY,[]),
  settings:load(SETKEY,{
    saleSessions:DEFAULT_SESSIONS,
    fundCategories:DEFAULT_FUNDCATS,
    quickSale:DEFAULT_QUICK,
    sheetsUrl:'',
    suppliers:[],lastSupplier:'',
    expenseCats: DEFAULT_EXPCATS,
    chartRange:'week' // 'week' | 'month'
  })
};

function todayYMD(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function load(k,def){try{return JSON.parse(localStorage.getItem(k))??def}catch(e){return def}}
function save(){localStorage.setItem(SKEY,JSON.stringify(state.days));localStorage.setItem(SETKEY,JSON.stringify(state.settings))}
function max0(n){ return Math.max(0, Math.round(Number(n)||0)); }

function getPrevDay(ymd){
  const list=(state.days||[]).filter(x=>x.date<ymd).sort((a,b)=>a.date.localeCompare(b.date));
  return list.length? list[list.length-1] : null;
}

function day(){
  let d=state.days.find(x=>x.date===state.date);
  if(!d){
    d={id:crypto.randomUUID(),date:state.date,funds:[],sales:[],expenses:[],orders:[],drawer:initDrawer(),notes:'',
       breakEvenPigAt:null,breakEvenAllAt:null,pigOriginDate:null,pigBreakevenDate:null};
    const prev=getPrevDay(state.date);
    if(prev){
      d.drawer = JSON.parse(JSON.stringify(prev.drawer||initDrawer()));
      const prevPig=getPigFund(prev);
      const prevSales=sum(prev.sales,'amount');
      const remain=max0(prevPig - prevSales);
      if(remain>0){
        const origin = prev.pigOriginDate || prev.date;
        d.pigOriginDate = origin;
        d.funds.push({
          id:crypto.randomUUID(),
          type:'pig',
          categoryKey:'carry',
          name:'ยกมาทุนหมู',
          supplier:'',
          pigs:[{id:crypto.randomUUID(),weightKg:0,costTHB:remain}],
          originDate: origin,
          isCarry:true
        });
      }
    }
    state.days.push(d);
  }
  return d;
}
function initDrawer(){return {b1000:0,b500:0,b100:0,b50:0,b20:0,c10:0,c5:0,c2:0,c1:0}}
function sum(arr,field){return arr.reduce((a,b)=>a+Number(b[field]||0),0)}
function drawerTotal(d){ d=d||day(); const x=d.drawer||initDrawer(); return x.b1000*1000+x.b500*500+x.b100*100+x.b50*50+x.b20*20+x.c10*10+x.c5*5+x.c2*2+x.c1*1; }
function fmt(n){return THB.format(max0(n))}
function setProg(el,p){if(!el) return; el.style.width=Math.max(0,Math.min(100,Math.round((p||0)*100)))+'%'}

function getPigFund(d){
  return (d.funds||[]).filter(f=>f.type==='pig').reduce((acc,f)=>acc+(f.pigs||[]).reduce((x,p)=>x+Number(p.costTHB||0),0),0);
}
function getPigWeight(d){
  return (d.funds||[]).filter(f=>f.type==='pig').reduce((acc,f)=>acc+(f.pigs||[]).reduce((x,p)=>x+Number(p.weightKg||0),0),0);
}
function getBulkFund(d){
  return (d.funds||[]).filter(f=>f.type==='bulk').reduce((acc,f)=>acc+Number(f.costTHB||0),0);
}

function recalc(d){
  d.breakEvenPigAt=null; d.breakEvenAllAt=null;
  const pig=getPigFund(d); const bulk=getBulkFund(d); const exp=sum(d.expenses,'amount');
  const all=pig+bulk+exp;
  let run=0; const sales=[...(d.sales||[])].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  for(const s of sales){ run+=Number(s.amount||0);
    if(!d.breakEvenPigAt && run>=pig) d.breakEvenPigAt=s.createdAt;
    if(!d.breakEvenAllAt && run>=all) d.breakEvenAllAt=s.createdAt;
    if(d.breakEvenPigAt && d.breakEvenAllAt) break;
  }
  const pigRemain=max0(pig - sum(d.sales,'amount'));
  if(pigRemain===0 && !d.pigBreakevenDate && d.pigOriginDate){
    d.pigBreakevenDate=d.date;
  }
}

// ---------- UI refs ----------
const $=s=>document.querySelector(s);
const dp=$('#datePicker'),btnToday=$('#btnToday'),btnDrawer=$('#btnDrawer'),btnSettings=$('#btnSettings');
const drawerCard=$('#drawerCard'), drawerVal=$('#valDrawer');
const drawerCard2=$('#drawerCard2'), drawerVal2=$('#valDrawer2');
const valFund=$('#valFund'),valSales=$('#valSales'),valExpense=$('#valExpense'),valProfit=$('#valProfit'),valSalesSessions=$('#valSalesSessions');
const valSalesMethod=$('#valSalesMethod');
const remPig=$('#remPig'),remAll=$('#remAll'),progPig=$('#progPig'),progAll=$('#progAll');
const pigBars=$('#pigBars');
const fundList=$('#fundList'),saleList=$('#saleList'),expList=$('#expList'),orderList=$('#orderList');
const monthSummary=$('#monthSummary'),historyList=$('#historyList');

// Tabs
const tabs=[...document.querySelectorAll('.tab')];
const panels=[...document.querySelectorAll('[data-tabpanel]')];
tabs.forEach(t=>t.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active');
  const k=t.dataset.tab; panels.forEach(p=>p.classList.toggle('hide',p.getAttribute('data-tabpanel')!==k));
}));

// ---------- Dialogs (same as v10 but kept) ----------
// ... Due to size, dialogs code identical to v10 omitted here in comment; it's implemented below fully.

// Add Sale
const dlgSale=document.createElement('dialog');dlgSale.innerHTML=`<h3>เพิ่มยอดขาย</h3>
<div class="grid">
  <label>จำนวน (บาท)</label><input id="saleAmount" type="number" inputmode="numeric" min="0" step="1">
  <label>เงินทอน (บาท)</label><input id="saleChange" type="number" inputmode="numeric" min="0" step="1">
  <div class="subtle" id="saleNetTxt">สุทธิ: ฿0</div>
  <label>วิธีชำระ</label>
  <select id="saleMethod">
    <option value="cash">เงินสด</option>
    <option value="scan">เงินสแกน</option>
  </select>
  <label>รอบเวลา</label><select id="saleSession"></select>
  <label>หมายเหตุ</label><input id="saleNote" type="text" placeholder="เช่น ปลีก/ส่ง/ลูกค้า">
</div>
<div class="chips" id="quickChips"></div>
<menu><button id="saleCancel">ยกเลิก</button><button id="saleSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgSale);

// Orders
const dlgOrder=document.createElement('dialog');dlgOrder.innerHTML=`<h3>เพิ่มออเดอร์</h3>
<div class="grid">
  <label>ชื่อลูกค้า</label><input id="ordCus" type="text" placeholder="เช่น ป้าจิตร / ร้านหมูกระทะ">
  <div class="tabline"><button class="mini active" data-otab="items">รายการ</button><button class="mini" data-otab="status">สถานะ</button></div>
  <div id="ordItemsPane">
    <div id="ordItems"></div>
    <div class="chips"><button id="ordAddItem" class="secondary">+ เพิ่มรายการ</button></div>
    <div class="subtle" id="ordTotalTxt">ราคารวม: ฿0</div>
  </div>
  <div id="ordStatusPane" class="hide">
    <label><input id="ordSent" type="checkbox"> ส่งของแล้ว</label>
    <label><input id="ordPaid" type="checkbox"> เก็บเงินแล้ว</label>
    <label>หมายเหตุ</label><input id="ordNote" type="text" placeholder="เช่น ส่งช่วงเย็น">
  </div>
</div>
<menu><button id="ordCancel">ยกเลิก</button><button id="ordSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgOrder);

// Expense
const dlgExpense=document.createElement('dialog');dlgExpense.innerHTML=`<h3>เพิ่ม/แก้ไข ค่าใช้จ่าย</h3>
<div class="grid">
  <label>ตั้งชื่อ</label><input id="expTitle" type="text" placeholder="ถ้าไม่พิมพ์ จะตั้งชื่ออัตโนมัติจากหมวด">
  <label>หมวด</label>
  <input list="expCatList" id="expCat" type="text" placeholder="เช่น น้ำแข็ง/ค่าแรง/ถุง">
  <datalist id="expCatList"></datalist>
  <div class="chips" id="expCatChips"></div>
  <label>จำนวน (บาท)</label><input id="expAmount" type="number" inputmode="numeric" min="0" step="1">
  <label>หมายเหตุ</label><input id="expNote" type="text">
</div>
<menu><button id="expCancel">ยกเลิก</button><button id="expSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgExpense);

// Fund
const dlgFund=document.createElement('dialog');dlgFund.innerHTML=`<h3>เพิ่มทุน</h3>
<div class="grid">
  <div class="tabline"><button class="mini active" data-ftab="pig">หมู</button><button class="mini" data-ftab="bulk">ทุนเสริม</button></div>
  <div id="fundPigPane">
    <label>ผู้ขาย</label><input list="supList" id="fundSup" type="text" placeholder="เช่น ลุงเอก">
    <datalist id="supList"></datalist>
    <div id="fundDynamicPig"></div>
    <div class="chips"><button id="fundPigAddRow" class="secondary">+ เพิ่มตัว</button></div>
  </div>
  <div id="fundBulkPane" class="hide">
    <label>ชื่อทุน (พิมพ์สั้นๆ)</label><input id="bulkName" type="text" placeholder="เช่น หมูบด 5 โล">
    <label>ต้นทุนรวม (บาท)</label><input id="bulkCost" type="number" inputmode="numeric" min="0" step="1">
  </div>
</div>
<menu><button id="fundCancel">ยกเลิก</button><button id="fundSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgFund);

// Drawer
const dlgDrawer=document.createElement('dialog');dlgDrawer.innerHTML=`<h3>ลิ้นชักเงิน (นับยอด)</h3>
<div id="drawerInputs" class="grid"></div>
<div id="drawerResult" class="month-summary"></div>
<menu><button id="drawerCancel">ปิด</button><button id="drawerSave" class="primary">บันทึกจำนวน</button></menu>`;document.body.appendChild(dlgDrawer);

// Close/Export
const dlgClose=document.createElement('dialog');dlgClose.innerHTML=`<h3>ปิดวัน / ส่งออก</h3>
<div class="grid">
  <label>บันทึกเพิ่มเติม</label><input id="closeNote" type="text">
  <label>Google Sheets Web App URL</label><input id="sheetsUrl" type="url" placeholder="https://script.google.com/...">
</div>
<div class="chips">
  <button id="btnExportCSV" class="secondary">ส่งออก CSV (เดือนนี้)</button>
  <button id="btnAppendSheets" class="secondary">Append วันนี้ → Sheets</button>
</div>
<div id="closeMsg" class="subtle"></div>
<menu><button id="closeCancel">ปิด</button></menu>`;document.body.appendChild(dlgClose);

// Settings
const dlgSettings=document.createElement('dialog');dlgSettings.innerHTML=`<h3>ตั้งค่า</h3>
<div class="grid">
  <label>รอบขาย (คั่นด้วย , )</label><input id="setSessions" type="text" placeholder="เช้า,เย็น,อื่นๆ">
  <label>ปุ่มลัดยอดขาย (คั่นด้วย , )</label><input id="setQuick" type="text" placeholder="20,50,100,500">
</div>
<div class="grid">
  <div><b>หมวดทุน</b> <span class="meta">(เลือกชนิด pig/bulk)</span></div>
  <div id="setFundCats"></div>
  <div class="chips"><button id="addFundCat" class="secondary">+ เพิ่มหมวดทุน</button></div>
</div>
<div class="grid">
  <div><b>หมวดค่าใช้จ่าย</b> <span class="meta">(ใช้เป็นตัวเลือกเวลาเพิ่มค่าใช้จ่าย)</span></div>
  <div id="setExpCats"></div>
  <div class="chips"><button id="addExpCat" class="secondary">+ เพิ่มหมวดค่าใช้จ่าย</button></div>
</div>
<menu><button id="setCancel">ปิด</button><button id="setSave" class="primary">บันทึก</button></menu>`;document.body.appendChild(dlgSettings);

// ---------- Event bindings ----------
$('#btnAddSale')?.addEventListener('click',()=>{openSale()});
$('#btnAddOrder')?.addEventListener('click',()=>{openOrder()});
$('#btnAddExpense')?.addEventListener('click',()=>{openExpense()});
$('#btnAddFund')?.addEventListener('click',()=>{openFund()});
$('#btnCloseDay')?.addEventListener('click',()=>{openClose()});
btnDrawer?.addEventListener('click',()=>openDrawer());
btnSettings?.addEventListener('click',()=>openSettings());
drawerCard?.addEventListener('click',()=>openDrawer());
drawerCard2?.addEventListener('click',()=>openDrawer());
document.getElementById('btnRangeWeek')?.addEventListener('click',()=>{state.settings.chartRange='week'; save(); renderCharts(); setRangeButtons(); renderSummaryDeep();});
document.getElementById('btnRangeMonth')?.addEventListener('click',()=>{state.settings.chartRange='month'; save(); renderCharts(); setRangeButtons(); renderSummaryDeep();});

function setRangeButtons(){
  const w=document.getElementById('btnRangeWeek'), m=document.getElementById('btnRangeMonth');
  if(!w||!m) return;
  if((state.settings.chartRange||'week')==='week'){ w.classList.add('active'); m.classList.remove('active'); }
  else { m.classList.add('active'); w.classList.remove('active'); }
}

// Sale dialog
function openSale(){
  const sel=dlgSale.querySelector('#saleSession');
  sel.innerHTML=''; (state.settings.saleSessions||DEFAULT_SESSIONS).forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; sel.appendChild(o); });
  const wrap=dlgSale.querySelector('#quickChips'); wrap.innerHTML='';
  (state.settings.quickSale||DEFAULT_QUICK).forEach(n=>{ const b=document.createElement('button'); b.textContent=n; b.onclick=()=>{dlgSale.querySelector('#saleAmount').value=String(n); updateSaleNet();}; wrap.appendChild(b); });
  // Update net preview on input
  dlgSale.addEventListener('input', (e)=>{
    if(e.target && (e.target.id==='saleAmount' || e.target.id==='saleChange')) updateSaleNet();
  }, {once:false});
  updateSaleNet();
  dlgSale.showModal();
}
dlgSale.querySelector('#saleCancel').onclick=()=>dlgSale.close();
function updateSaleNet(){
  const amount = Math.max(0, Math.round(Number(dlgSale.querySelector('#saleAmount').value||0)));
  const change = Math.max(0, Math.round(Number(dlgSale.querySelector('#saleChange').value||0)));
  const net = Math.max(0, amount - change);
  const el = dlgSale.querySelector('#saleNetTxt');
  if(el){ el.textContent = 'สุทธิ: ' + THB.format(net); }
}
dlgSale.querySelector('#saleSave').onclick=()=>{
  const gross=max0(dlgSale.querySelector('#saleAmount').value||0);
  const change=max0(dlgSale.querySelector('#saleChange').value||0);
  const amount=Math.max(0, gross - change);
  const session=dlgSale.querySelector('#saleSession').value||'อื่นๆ';
  const method=dlgSale.querySelector('#saleMethod').value||'cash';
  const note=dlgSale.querySelector('#saleNote').value||'';
  if(amount<=0) return;
  const d=day(); d.sales.push({id:crypto.randomUUID(),amount,gross,change,session,method,note,checked:false,createdAt:new Date().toISOString()});
  recalc(d); save(); renderAll(); dlgSale.close();
};

// Orders
function openOrder(){
  dlgOrder.querySelector('[data-otab=\"items\"]').classList.add('active');
  dlgOrder.querySelector('[data-otab=\"status\"]').classList.remove('active');
  dlgOrder.querySelector('#ordItemsPane').classList.remove('hide');
  dlgOrder.querySelector('#ordStatusPane').classList.add('hide');
  dlgOrder.querySelector('#ordCus').value='';
  dlgOrder.querySelector('#ordSent').checked=false;
  dlgOrder.querySelector('#ordPaid').checked=false;
  dlgOrder.querySelector('#ordNote').value='';
  const items=dlgOrder.querySelector('#ordItems'); items.innerHTML='';
  addOrderItem();
  dlgOrder.showModal();
}
dlgOrder.addEventListener('click',e=>{
  if(e.target.matches('[data-otab]')){
    dlgOrder.querySelectorAll('[data-otab]').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    const k=e.target.getAttribute('data-otab');
    dlgOrder.querySelector('#ordItemsPane').classList.toggle('hide',k!=='items');
    dlgOrder.querySelector('#ordStatusPane').classList.toggle('hide',k!=='status');
  }
});
dlgOrder.querySelector('#ordAddItem').onclick=()=>addOrderItem();
function addOrderItem(){
  const host=dlgOrder.querySelector('#ordItems');
  const row=document.createElement('div'); row.className='order-item';
  row.innerHTML=`<input class="p" type="text" placeholder="ส่วนไหน เช่น สันคอ/หมูบด">
    <input class="w" type="number" inputmode="decimal" min="0" step="0.1" placeholder="กก.">
    <input class="r" type="number" inputmode="numeric" min="0" step="1" placeholder="บาท/กก.">
    <input class="t" type="number" inputmode="numeric" min="0" step="1" placeholder="บาท">
    <div class="btns"><span class="meta subtotal">฿0</span> <button class="small del">ลบ</button></div>`;
  row.querySelector('.del').onclick=()=>{ row.remove(); updateOrderTotal(); };
  ['input','change'].forEach(ev=>row.addEventListener(ev,updateOrderTotal));
  host.appendChild(row);
  updateOrderTotal();
}
function updateOrderTotal(){
  const rows=[...dlgOrder.querySelectorAll('.order-item')];
  let total=0;
  rows.forEach(r=>{
    const kg=Number(r.querySelector('.w').value||0);
    let rate=Number(r.querySelector('.r').value||0);
    let tot=Number(r.querySelector('.t').value||0);
    if(tot>0 && kg>0){
      // Auto-calc average rate per kg from total
      const avg = Math.round(tot / kg);
      r.querySelector('.r').value = String(avg);
      rate = avg;
    }
    const sub = tot>0 ? max0(tot) : max0(kg*rate);
    r.querySelector('.subtotal').textContent=fmt(sub);
    total+=sub;
  });
  dlgOrder.querySelector('#ordTotalTxt').textContent='ราคารวม: '+fmt(total);
}
dlgOrder.querySelector('#ordCancel').onclick=()=>dlgOrder.close();
dlgOrder.querySelector('#ordSave').onclick=()=>{
  const d=day();
  const items=[...dlgOrder.querySelectorAll('.order-item')].map(r=>({part:r.querySelector('.p').value.trim()||'ไม่ระบุ',kg:Number(r.querySelector('.w').value||0),rate:Number(r.querySelector('.r').value||0), total: Number(r.querySelector('.t').value||0)})).filter(i=> (i.kg>0 && (i.rate>0 || i.total>0)) || i.total>0);
  if(items.length===0) return;
  const total=items.reduce((a,b)=>a + (b.total>0 ? Math.round(b.total) : Math.round(b.kg*b.rate)),0);
  d.orders.push({id:crypto.randomUUID(),customer:dlgOrder.querySelector('#ordCus').value.trim()||'ลูกค้า',items,total, sent:dlgOrder.querySelector('#ordSent').checked, paid:dlgOrder.querySelector('#ordPaid').checked, note:dlgOrder.querySelector('#ordNote').value||'', createdAt:new Date().toISOString()});
  save(); renderAll(); dlgOrder.close();
};

// Expense
function refreshExpenseCatUI(){
  const dl=dlgExpense.querySelector('#expCatList'); dl.innerHTML='';
  (state.settings.expenseCats||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c; dl.appendChild(o); });
  const chips=dlgExpense.querySelector('#expCatChips'); chips.innerHTML='';
  (state.settings.expenseCats||[]).forEach(c=>{
    const b=document.createElement('button'); b.textContent=c; b.onclick=()=>{ dlgExpense.querySelector('#expCat').value=c; };
    chips.appendChild(b);
  });
}
function openExpense(editId=null){
  const t=dlgExpense; const d=day(); t.dataset.editId=editId||'';
  refreshExpenseCatUI();
  t.querySelector('#expTitle').value=''; t.querySelector('#expCat').value=''; t.querySelector('#expAmount').value=''; t.querySelector('#expNote').value='';
  if(editId){ const e=d.expenses.find(x=>x.id===editId); if(e){ t.querySelector('#expTitle').value=e.title; t.querySelector('#expCat').value=e.category; t.querySelector('#expAmount').value=e.amount; t.querySelector('#expNote').value=e.note||''; } }
  dlgExpense.showModal();
}
dlgExpense.querySelector('#expCancel').onclick=()=>dlgExpense.close();
dlgExpense.querySelector('#expSave').onclick=()=>{
  const d=day(); const editId=dlgExpense.dataset.editId||null;
  let title=(dlgExpense.querySelector('#expTitle').value||'').trim();
  const category=(dlgExpense.querySelector('#expCat').value||'').trim()||'อื่นๆ';
  const amount=max0(dlgExpense.querySelector('#expAmount').value||0);
  const note=dlgExpense.querySelector('#expNote').value||'';
  if(!title) title=category;
  if(amount<=0){ return; }
  const obj={ id: editId||crypto.randomUUID(), title, category, amount, note, createdAt: new Date().toISOString() };
  if(editId){ const i=d.expenses.findIndex(x=>x.id===editId); if(i>=0) d.expenses[i]=obj; } else { d.expenses.push(obj); }
  if(category && !state.settings.expenseCats.includes(category)){
    state.settings.expenseCats.push(category);
  }
  recalc(d); save(); renderAll(); dlgExpense.close();
};

// Fund
function openFund(){
  const dl=dlgFund.querySelector('#supList'); dl.innerHTML='';
  (state.settings.suppliers||[]).forEach(s=>{ const o=document.createElement('option'); o.value=s; dl.appendChild(o); });
  dlgFund.querySelector('[data-ftab=\"pig\"]').classList.add('active');
  dlgFund.querySelector('[data-ftab=\"bulk\"]').classList.remove('active');
  dlgFund.querySelector('#fundPigPane').classList.remove('hide');
  dlgFund.querySelector('#fundBulkPane').classList.add('hide');
  
  dlgFund.querySelector('#fundSup').value=state.settings.lastSupplier||'';
  const host=dlgFund.querySelector('#fundDynamicPig'); host.innerHTML=''; addFundRow();
  dlgFund.showModal();
}
dlgFund.addEventListener('click',e=>{
  if(e.target.matches('[data-ftab]')){
    dlgFund.querySelectorAll('[data-ftab]').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    const k=e.target.getAttribute('data-ftab');
    dlgFund.querySelector('#fundPigPane').classList.toggle('hide',k!=='pig');
    dlgFund.querySelector('#fundBulkPane').classList.toggle('hide',k!=='bulk');
  }
});
dlgFund.querySelector('#fundPigAddRow').onclick=()=>addFundRow();
function addFundRow(){
  const host=dlgFund.querySelector('#fundDynamicPig');
  const idx=(host?.children?.length||0)+1;
  const div=document.createElement('div'); div.className='pigcard';
  div.innerHTML=`<span class="pigicon">🐷</span>
    <div style="flex:1"><div><b>หมู ตัวที่ ${idx}</b></div><div class="meta">น้ำหนัก (กก.) + ต้นทุน (บาท)</div></div>
    <div style="display:flex;gap:6px;align-items:center">
      <input class="w" type="number" inputmode="decimal" min="0" step="0.1" placeholder="กก." style="width:90px">
      <input class="c" type="number" inputmode="numeric" min="0" step="1" placeholder="บาท" style="width:110px">
      <button class="small del">ลบ</button>
    </div>`;
  div.querySelector('.del').onclick=()=>div.remove();
  host.appendChild(div);
}
dlgFund.querySelector('#fundCancel').onclick=()=>dlgFund.close();
dlgFund.querySelector('#fundSave').onclick=()=>{
  const d=day();
  const activeTab = dlgFund.querySelector('[data-ftab].active').getAttribute('data-ftab');
  if(activeTab==='pig'){
    const name=dlgFund.querySelector('#fundName').value || 'หมู';
    const supplier=dlgFund.querySelector('#fundSup').value.trim();
    const host=dlgFund.querySelector('#fundDynamicPig');
    const pigs=[...host.querySelectorAll('.pigcard')].map(c=>({ id:crypto.randomUUID(), weightKg:Number(c.querySelector('.w').value||0), costTHB:max0(c.querySelector('.c').value||0) })).filter(p=>p.weightKg>0 && p.costTHB>0);
    if(pigs.length===0) return;
    d.funds.push({id:crypto.randomUUID(), type:'pig', categoryKey:'pig', name, supplier, pigs, originDate: d.pigOriginDate || d.date});
    if(!d.pigOriginDate) d.pigOriginDate = d.date;
    if(supplier){
      if(!state.settings.suppliers.includes(supplier)) state.settings.suppliers.push(supplier);
      state.settings.lastSupplier=supplier;
      const slug='sup_'+supplier.toLowerCase().replace(/\\s+/g,'_').replace(/[^a-z0-9_]/g,'');
      if(!(state.settings.fundCategories||[]).some(c=>c.key===slug)){
        state.settings.fundCategories.push({key:slug, name:supplier, type:'pig'});
      }
    }
  }else{
    const name=dlgFund.querySelector('#bulkName').value.trim()||'ทุนเสริม';
    const cost=max0(dlgFund.querySelector('#bulkCost').value||0);
    if(cost<=0) return;
    d.funds.push({id:crypto.randomUUID(), type:'bulk', categoryKey:'supp', name, supplier:'', weightKg:0, costTHB:cost});
  }
  recalc(d); save(); renderAll(); dlgFund.close();
};

// Drawer
function openDrawer(){
  const d=day(); const host=dlgDrawer.querySelector('#drawerInputs'); host.innerHTML='';
  const denom=[['b1000',1000],['b500',500],['b100',100],['b50',50],['b20',20],['c10',10],['c5',5],['c2',2],['c1',1]];
  const wrap=document.createElement('div'); wrap.className='drawer-grid';
  wrap.innerHTML = '<div class="hdr cell">ชนิด</div><div class="hdr cell">จำนวน</div><div class="hdr cell">รวม</div>';
  denom.forEach(([k,v])=>{
    const label = v>=20 ? 'แบงค์' : 'เหรียญ';
    wrap.innerHTML += `<div class="cell">${label} ฿${v}</div>
      <div class="cell"><input class="drawer-qty" data-k="${k}" type="number" inputmode="numeric" min="0" step="1" value="${d.drawer?.[k]??0}"></div>
      <div class="cell"><span class="subtotal" data-sub="${k}">฿0</span></div>`;
  });
  host.appendChild(wrap);
  const result = dlgDrawer.querySelector('#drawerResult'); result.className='drawer-total';
  renderDrawerTotals();
  dlgDrawer.showModal();
}
function renderDrawerTotals(){
  const denom=[['b1000',1000],['b500',500],['b100',100],['b50',50],['b20',20],['c10',10],['c5',5],['c2',2],['c1',1]];
  const inputs=dlgDrawer.querySelectorAll('#drawerInputs input');
  let text=[], grand=0;
  inputs.forEach(inp=>{
    const key=inp.dataset.k; const v=Number(inp.value||0); const value=denom.find(d=>d[0]===key)[1];
    const sumVal=v*value; grand+=sumVal; if(v>0){ text.push(`฿${value} × ${v} = ${fmt(sumVal)}`); }
    const sub=dlgDrawer.querySelector(`[data-sub="${key}"]`); if(sub) sub.textContent=fmt(sumVal);
  });
  dlgDrawer.querySelector('#drawerResult').textContent = (text.length?text.join(' | '):'ยังไม่มีรายการ') + `  ➜ รวมทั้งสิ้น: ${fmt(grand)}`;
}
dlgDrawer.addEventListener('input', (e)=>{ if(e.target.matches('.drawer-qty')) renderDrawerTotals(); });
dlgDrawer.querySelector('#drawerCancel').onclick=()=>dlgDrawer.close();
dlgDrawer.querySelector('#drawerSave').onclick=()=>{
  const d=day(); d.drawer = d.drawer || initDrawer();
  dlgDrawer.querySelectorAll('#drawerInputs input').forEach(inp=>{ d.drawer[inp.dataset.k]=max0(inp.value||0) });
  save(); dlgDrawer.close();
};

// Close/Export
function openClose(){
  const d=day(); dlgClose.querySelector('#closeNote').value=d.notes||''; dlgClose.querySelector('#sheetsUrl').value=state.settings.sheetsUrl||''; dlgClose.querySelector('#closeMsg').textContent=''; dlgClose.showModal();
}
dlgClose.querySelector('#closeCancel').onclick=()=>dlgClose.close();
dlgClose.querySelector('#btnExportCSV').onclick=()=>{
  const now=new Date(state.date); const y=now.getFullYear(), m=now.getMonth();
  const list=state.days.filter(dd=>{const dt=new Date(dd.date+'T00:00:00');return dt.getFullYear()===y&&dt.getMonth()===m}).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const header="Date,FundPig,FundBulk,Expense,Sales,SalesCash,SalesScan,Profit,SalesMorning,SalesEvening,SalesOther,OrdersCount,BreakEvenPigAt,BreakEvenAllAt,OriginPig,BreakevenPig,Notes"; const lines=[header];
  for(const d of list){
    const fp=getPigFund(d), fb=getBulkFund(d), te=sum(d.expenses,'amount'), ts=sum(d.sales,'amount');
    const cash=(d.sales||[]).filter(s=>s.method!=='scan').reduce((a,b)=>a+Number(b.amount||0),0);
    const scan=(d.sales||[]).filter(s=>s.method==='scan').reduce((a,b)=>a+Number(b.amount||0),0);
    const profit=Math.max(0,ts-fp-fb-te);
    const m = (d.sales||[]).filter(s=>s.session===(state.settings.saleSessions[0]||'เช้า')).reduce((a,b)=>a+b.amount,0);
    const e = (d.sales||[]).filter(s=>s.session===(state.settings.saleSessions[1]||'เย็น')).reduce((a,b)=>a+b.amount,0);
    const o = (d.sales||[]).filter(s=>![state.settings.saleSessions[0], state.settings.saleSessions[1]].includes(s.session)).reduce((a,b)=>a+b.amount,0);
    const pig=d.breakEvenPigAt?new Date(d.breakEvenPigAt).toLocaleString('th-TH'):""; const all=d.breakEvenAllAt?new Date(d.breakEvenAllAt).toLocaleString('th-TH'):"";
    const note=(d.notes||'').replace(/,/g,' ');
    lines.push([d.date,fp,fb,te,ts,cash,scan,profit,m,e,o,(d.orders||[]).length,pig,all,(d.pigOriginDate||''),(d.pigBreakevenDate||''),note].join(','));
  }
  const blob=new Blob([lines.join('\\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`PigShop-${state.date.slice(0,7)}.csv`; a.click();
};
dlgClose.querySelector('#btnAppendSheets').onclick=async()=>{
  const url=(dlgClose.querySelector('#sheetsUrl').value||'').trim(); state.settings.sheetsUrl=url; save();
  const d=day(); d.notes=dlgClose.querySelector('#closeNote').value||'';
  const fp=getPigFund(d), fb=getBulkFund(d); const te=sum(d.expenses,'amount'); const ts=sum(d.sales,'amount'); const profit=Math.max(0,ts-fp-fb-te);
  const payload={date:d.date, fundPig:fp, fundBulk:fb, totalExpense:te, totalSales:ts, profit, orders:(d.orders||[]).length,
    breakEvenFundAt:d.breakEvenPigAt?new Date(d.breakEvenPigAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):null,
    breakEvenAllAt:d.breakEvenAllAt?new Date(d.breakEvenAllAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):null,
    pigOriginDate: d.pigOriginDate||null, pigBreakevenDate: d.pigBreakevenDate||null, dayNote:d.notes||''};
  try{ const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); dlgClose.querySelector('#closeMsg').textContent=res.ok?'ส่งข้อมูลเรียบร้อย':'ส่งไม่สำเร็จ'; }catch(e){ dlgClose.querySelector('#closeMsg').textContent='ออฟไลน์/ลิงก์ผิด'; }
};

// Settings
function openSettings(){
  const t=dlgSettings;
  t.querySelector('#setSessions').value=(state.settings.saleSessions||DEFAULT_SESSIONS).join(',');
  t.querySelector('#setQuick').value=(state.settings.quickSale||DEFAULT_QUICK).join(',');
  renderFundCats();
  renderExpCats();
  dlgSettings.showModal();
}
function renderFundCats(){
  const host=dlgSettings.querySelector('#setFundCats'); host.innerHTML='';
  (state.settings.fundCategories||DEFAULT_FUNDCATS).forEach((c,idx)=>{
    const row=document.createElement('div'); row.className='row type-fund';
    row.innerHTML=`<div class="btns">
      <input data-idx="${idx}" class="fc-name" type="text" value="${c.name}" style="width:180px">
      <select data-idx="${idx}" class="fc-type"><option value="pig"${c.type==='pig'?' selected':''}>pig</option><option value="bulk"${c.type==='bulk'?' selected':''}>bulk</option></select>
      <button class="small del">ลบ</button>
    </div>`;
    row.querySelector('.del').onclick=()=>{ state.settings.fundCategories.splice(idx,1); renderFundCats(); };
    host.appendChild(row);
  });
}
function renderExpCats(){
  const host=dlgSettings.querySelector('#setExpCats'); host.innerHTML='';
  (state.settings.expenseCats||[]).forEach((name,idx)=>{
    const row=document.createElement('div'); row.className='row type-fund';
    row.innerHTML=`<div class="btns">
      <input data-idx="${idx}" class="ec-name" type="text" value="${name}" style="width:220px">
      <button class="small del">ลบ</button>
    </div>`;
    row.querySelector('.del').onclick=()=>{ state.settings.expenseCats.splice(idx,1); renderExpCats(); };
    host.appendChild(row);
  });
}
dlgSettings.querySelector('#addFundCat').onclick=()=>{
  const key='cat'+Math.random().toString(36).slice(2,6);
  state.settings.fundCategories.push({key, name:'หมวดใหม่', type:'pig'});
  renderFundCats();
};
dlgSettings.querySelector('#addExpCat').onclick=()=>{
  (state.settings.expenseCats = state.settings.expenseCats || []).push('หมวดใหม่');
  renderExpCats();
};
dlgSettings.querySelector('#setCancel').onclick=()=>dlgSettings.close();
dlgSettings.querySelector('#setSave').onclick=()=>{
  const sessionsRaw=dlgSettings.querySelector('#setSessions').value.split(',').map(s=>s.trim()).filter(Boolean);
  state.settings.saleSessions = sessionsRaw.length? sessionsRaw : DEFAULT_SESSIONS;
  const quickRaw=dlgSettings.querySelector('#setQuick').value.split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n) && n>0);
  state.settings.quickSale = quickRaw.length? quickRaw : DEFAULT_QUICK;
  const names=[...dlgSettings.querySelectorAll('.fc-name')]; const types=[...dlgSettings.querySelectorAll('.fc-type')];
  state.settings.fundCategories = names.map((n,i)=>({ key: state.settings.fundCategories[i]?.key || ('cat'+i), name: n.value||'หมวด', type: types[i].value==='bulk'?'bulk':'pig' }));
  const ec=[...dlgSettings.querySelectorAll('.ec-name')].map(n=>n.value.trim()).filter(Boolean);
  state.settings.expenseCats = ec.length? ec : DEFAULT_EXPCATS;
  save(); dlgSettings.close();
};

// ---------- Rendering (Today/History) ----------
function renderTop(){
  const d=day(); const fp=getPigFund(d); const fb=getBulkFund(d); const ts=sum(d.sales,'amount'); const te=sum(d.expenses,'amount'); const profit=Math.max(0,ts-fp-fb-te);
  const tf=fp+fb;
  valFund.textContent=fmt(tf); valSales.textContent=fmt(ts); valExpense.textContent=fmt(te); valProfit.textContent=fmt(profit);
  const ses=state.settings.saleSessions||DEFAULT_SESSIONS;
  const s0=(d.sales||[]).filter(s=>s.session===(ses[0]||'เช้า')).reduce((a,b)=>a+b.amount,0);
  const s1=(d.sales||[]).filter(s=>s.session===(ses[1]||'เย็น')).reduce((a,b)=>a+b.amount,0);
  const s2=(d.sales||[]).filter(s=>![ses[0],ses[1]].includes(s.session)).reduce((a,b)=>a+b.amount,0);
  valSalesSessions.textContent=`${ses[0]||'เช้า'}: ${fmt(s0)} | ${ses[1]||'เย็น'}: ${fmt(s1)} | อื่นๆ: ${fmt(s2)}`;
  const cash=(d.sales||[]).filter(s=>s.method!=='scan').reduce((a,b)=>a+Number(b.amount||0),0);
  const scan=(d.sales||[]).filter(s=>s.method==='scan').reduce((a,b)=>a+Number(b.amount||0),0);
  if(valSalesMethod) valSalesMethod.textContent=`สด: ${fmt(cash)} | สแกน: ${fmt(scan)}`;
  const pigRemain=Math.max(0,fp-ts), allRemain=Math.max(0,fp+fb+te-ts);
  remPig.textContent=pigRemain===0?'ถึงแล้ว':`ขาดอีก ${fmt(pigRemain)}`;
  remAll.textContent=allRemain===0?'ถึงแล้ว':`ขาดอีก ${fmt(allRemain)}`;
  setProg(progPig, fp===0?0:ts/fp); setProg(progAll, (fp+fb+te)===0?0:ts/(fp+fb+te));
  renderPigBars(fp, ts);
}

function renderPigBars(fpTotal, salesTotal){
  const d=day();
  const pigs = (d.funds||[]).filter(f=>f.type==='pig').flatMap(f=>(f.pigs||[]).map(p=>({cost:p.costTHB})));
  pigBars.innerHTML=''; if(pigs.length===0) return;
  let remaining = Math.max(0, salesTotal);
  pigs.forEach((p,idx)=>{
    const covered = Math.max(0, Math.min(p.cost, remaining));
    const pct = p.cost>0 ? covered / p.cost : 0; remaining = Math.max(0, remaining - p.cost);
    const row=document.createElement('div'); row.className='bar';
    row.innerHTML=`<div class="bar-head"><span>หมูตัวที่ ${idx+1}</span><span>${THB.format(Math.round(covered))} / ${THB.format(Math.round(p.cost))}</span></div>
      <div class="progress pigitem"><div style="width:${Math.round(pct*100)}%"></div></div>`;
    pigBars.appendChild(row);
  });
}

function catIndex(name){
  const list=state.settings.expenseCats||[]; const i=list.findIndex(x=>x===name);
  return i>=0? i % 8 : 4;
}

function renderLists(){
  const d=day(); const cats=state.settings.fundCategories||DEFAULT_FUNDCATS;
  // Funds
  fundList.innerHTML='';
  (d.funds||[]).forEach(f=>{
    const cat=cats.find(c=>c.key===f.categoryKey); const cname=cat?cat.name:f.categoryKey;
    let right=''; let meta='';
    if(f.type==='pig'){ right=fmt((f.pigs||[]).reduce((a,p)=>a+Number(p.costTHB||0),0)); meta=`${cname} • ${(f.pigs||[]).length} ตัว`; }
    else { right=fmt(f.costTHB||0); meta=`${cname}`; }
    const row=document.createElement('div'); row.className='row type-fund';
    const buy = f.originDate || d.pigOriginDate; const brk = d.pigBreakevenDate;
    const extra = (f.type==='pig' && (buy || brk)) ? (`<div class="meta">ซื้อ: ${buy||'-'}${brk? ' • คืนทุน: '+brk : ''}</div>`) : '';
    row.innerHTML=`<div><div><b>${f.type==='pig'?'🐷':'🍖'} ${f.name}</b> ${f.supplier?`<span class="meta">• ${f.supplier}</span>`:''}</div><div class="meta">${meta}</div>${extra}</div>
      <div class="btns"><div class="meta">${right}</div> <button class="small del">ลบ</button></div>`;
    row.querySelector('.del').onclick=()=>{ d.funds=(d.funds||[]).filter(x=>x.id!==f.id); recalc(d); save(); renderAll(); };
    fundList.appendChild(row);
  });

  // Orders
  orderList.innerHTML='';
  (d.orders||[]).forEach(o=>{
    const totalItems = o.items.map(it=> (it.total&&it.total>0 && it.kg>0) ? `${it.part} ${it.kg}กก. = ${fmt(it.total)}` : `${it.part} ${it.kg}กก. x ${fmt(it.rate)}`).join(' • ');
    const row=document.createElement('div'); row.className='row type-fund';
    row.innerHTML=`<div><div><b>🧾 ${o.customer}</b><span class="tag">${new Date(o.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="meta">${totalItems}</div>
      <div class="meta">รวม ${fmt(o.total)} 
       <span class="badge ${o.sent?'sent-active':'sent'}">ส่งแล้ว</span> 
       <span class="badge ${o.paid?'paid-active':'paid'}">เก็บเงินแล้ว</span>
    </div></div>
      <div class="btns">
        <button class="small mark-send">${o.sent?'ยกเลิกส่ง':'ติ๊กส่งแล้ว'}</button>
        <button class="small mark-paid">${o.paid?'ยกเลิกเก็บเงิน':'ติ๊กเก็บเงิน'}</button>
        <button class="small to-sale" ${o.converted?'disabled':''}>${o.converted?'บันทึกแล้ว':'บันทึกเป็นยอดขาย'}</button>
        <button class="small del">ลบ</button>
      </div>`;
    row.querySelector('.mark-send').onclick=()=>{ o.sent=!o.sent; save(); renderLists(); };
    row.querySelector('.mark-paid').onclick=()=>{ o.paid=!o.paid; save(); renderLists(); };
    row.querySelector('.to-sale').onclick=()=>{ if(o.converted) return; o.converted=true; const note = `ออเดอร์: ${o.customer}`; const method='cash'; day().sales.push({id:crypto.randomUUID(),amount:o.total,session:(state.settings.saleSessions[0]||'เช้า'),method,note,createdAt:new Date().toISOString()}); recalc(day()); save(); renderAll(); };
    row.querySelector('.del').onclick=()=>{ d.orders=d.orders.filter(x=>x.id!==o.id); save(); renderLists(); };
    orderList.appendChild(row);
  });

  // Sales
  saleList.innerHTML='';
  (d.sales||[]).forEach(s=>{
    const row=document.createElement('div'); row.className='row type-fund'+(s.checked?' done':'');
    const methodBadge = s.method==='scan' ? '<span class="badge">สแกน</span>' : '<span class="badge">สด</span>'; const checkBadge = `<span class="badge ${s.checked?'checked-active':'checked'}">นับแล้ว</span>`;
    row.innerHTML=`<div><div>${s.note||'ขาย'} ${methodBadge} ${checkBadge} <span class="meta">• ${s.session}</span></div><div class="meta">${new Date(s.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="btns"><div class="meta">${fmt(s.amount)}</div> <button class="small del">ลบ</button></div>`;
    row.querySelector('.mark-checked').onclick=()=>{ s.checked=!s.checked; save(); renderLists(); };
    row.querySelector('.del').onclick=()=>{ d.sales=d.sales.filter(x=>x.id!==s.id); recalc(d); save(); renderAll(); };
    saleList.appendChild(row);
  });

  // Expenses
  expList.innerHTML='';
  (d.expenses||[]).forEach(e=>{
    const idx=catIndex(e.category||'อื่นๆ');
    const row=document.createElement('div'); row.className='row type-fund';
    row.innerHTML=`<div>
        <div><b>${e.title}</b> <span class="cat-badge cat-${idx}">${e.category||'อื่นๆ'}</span></div>
        <div class="meta">${e.note||''}</div>
      </div>
      <div class="btns"><div class="meta">${fmt(e.amount)}</div> <button class="small del">ลบ</button></div>`;
    row.querySelector('.del').onclick=()=>{ d.expenses=d.expenses.filter(x=>x.id!==e.id); recalc(d); save(); renderAll(); };
    expList.appendChild(row);
  });
}

function renderHistory(){
  const now=new Date(state.date); const y=now.getFullYear(), m=now.getMonth();
  const list=(state.days||[]).filter(d=>{const dt=new Date(d.date+'T00:00:00');return dt.getFullYear()===y && dt.getMonth()===m}).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let FP=0,FB=0,E=0,S=0,P=0,hitFund=0,hitAll=0,ORD=0;
  historyList.innerHTML='';
  list.forEach(d=>{
    const fp=getPigFund(d), fb=getBulkFund(d), te=sum(d.expenses,'amount'), ts=sum(d.sales,'amount'), pr=Math.max(0,ts-fp-fb-te);
    FP+=fp;FB+=fb;E+=te;S+=ts;P+=pr; ORD+=(d.orders||[]).length; if(d.breakEvenPigAt)hitFund++; if(d.breakEvenAllAt)hitAll++;
    const row=document.createElement('div'); row.className='row type-fund';
    const extra = (d.pigOriginDate||d.pigBreakevenDate) ? ` • ซื้อ: ${d.pigOriginDate||'-'}${d.pigBreakevenDate? ' • คืนทุน: '+d.pigBreakevenDate : ''}` : '';
    row.innerHTML=`<div><div class="title">${d.date}</div><div class="meta">ทุนหมู: ${fmt(fp)} | ทุนเสริม: ${fmt(fb)} | ขาย: ${fmt(ts)} | กำไร: ${fmt(pr)} | ออเดอร์ ${d.orders?.length||0} รายการ${extra}</div></div>`;
    row.onclick=()=>{ state.date=d.date; dp.value=d.date; tabs.find(t=>t.dataset.tab==='today').click(); renderAll(); };
    historyList.appendChild(row);
  });
  monthSummary.textContent=`ทุนหมูรวม ${fmt(FP)} | ทุนเสริมรวม ${fmt(FB)} | ค่าใช้จ่ายรวม ${fmt(E)} | ยอดขายรวม ${fmt(S)} | กำไรรวม ${fmt(P)} | ออเดอร์ ${ORD} รายการ | แตะทุนหมู ${hitFund} วัน | ครอบคลุมทั้งหมด ${hitAll} วัน`;
}

// ---------- Summary Deep Metrics ----------
function rangeDates(){
  const now=new Date(state.date+'T00:00:00');
  const y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  let from, to;
  if((state.settings.chartRange||'week')==='week'){
    const dayIdx=(now.getDay()+6)%7; // Monday start
    from=new Date(y,m,d - dayIdx);
    to=new Date(from); to.setDate(from.getDate()+6);
  }else{
    from=new Date(y,m,1); to=new Date(y,m+1,0);
  }
  return {from, to};
}
function listBetween(from,to){
  const days=[]; let cur=new Date(from);
  while(cur<=to){ const ymd=new Date(cur); ymd.setMinutes(ymd.getMinutes()-ymd.getTimezoneOffset()); const s=ymd.toISOString().slice(0,10); days.push(s); cur.setDate(cur.getDate()+1); }
  return days;
}
function rangeRows(from,to){
  const ymds=listBetween(from,to);
  const rows=ymds.map(dt=> (state.days||[]).find(x=>x.date===dt) || {date:dt,funds:[],sales:[],expenses:[],orders:[],drawer:initDrawer()});
  return rows;
}
function aggregate(rows){
  const res={sales:0, expense:0, fundPig:0, fundBulk:0, orders:0, hitsPig:0, hitsAll:0, pigKg:0, cash:0, scan:0, sessions:{}, drawerLast:0,
             expByCat:{}, supplierSpend:{}, salesFromOrders:0, salesFromStore:0};
  const ses=state.settings.saleSessions||DEFAULT_SESSIONS;
  rows.forEach(r=>{
    res.fundPig+=getPigFund(r); res.fundBulk+=getBulkFund(r);
    res.expense+=sum(r.expenses,'amount'); res.sales+=sum(r.sales,'amount');
    res.orders+=(r.orders||[]).length; if(r.breakEvenPigAt)res.hitsPig++; if(r.breakEvenAllAt)res.hitsAll++;
    res.pigKg+=getPigWeight(r);
    (r.sales||[]).forEach(s=>{
      if(s.method==='scan') res.scan+=Number(s.amount||0); else res.cash+=Number(s.amount||0);
      const idx = ses.findIndex(n=>n===s.session); const key = idx>=0? ses[idx] : 'อื่นๆ';
      res.sessions[key]=(res.sessions[key]||0)+Number(s.amount||0);
      if((s.note||'').startsWith('ออเดอร์:')) res.salesFromOrders+=Number(s.amount||0); else res.salesFromStore+=Number(s.amount||0);
    });
    (r.expenses||[]).forEach(e=>{ const c=e.category||'อื่นๆ'; res.expByCat[c]=(res.expByCat[c]||0)+Number(e.amount||0); });
    (r.funds||[]).forEach(f=>{ if(f.type==='pig' && f.supplier){ const sumCost=(f.pigs||[]).reduce((a,p)=>a+Number(p.costTHB||0),0); res.supplierSpend[f.supplier]=(res.supplierSpend[f.supplier]||0)+sumCost; } });
    res.drawerLast = drawerTotal(r); // last day in range ends up used
  });
  res.profit = Math.max(0, res.sales - res.fundPig - res.fundBulk - res.expense);
  res.margin = res.sales>0 ? (res.profit / res.sales) : 0;
  res.days = rows.length;
  res.avgSales = res.sales / (rows.length||1);
  res.avgProfit = res.profit / (rows.length||1);
  res.avgExpense = res.expense / (rows.length||1);
  res.fundRatioPig = (res.fundPig>0 || res.fundBulk>0) ? (res.fundPig / (res.fundPig+res.fundBulk)) : 0;
  res.salesPerKg = res.pigKg>0 ? (res.sales / res.pigKg) : 0;
  // top 3 expenses
  res.top3 = Object.entries(res.expByCat).sort((a,b)=>b[1]-a[1]).slice(0,3);
  // supplier top
  res.topSupplier = Object.entries(res.supplierSpend).sort((a,b)=>b[1]-a[1])[0] || null;
  return res;
}
function previousRangeTrend(){
  const {from,to}=rangeDates();
  const dur = Math.round((to - from) / (1000*3600*24)) + 1;
  const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate()-dur);
  const prevTo = new Date(to); prevTo.setDate(prevTo.getDate()-dur);
  const cur = aggregate(rangeRows(from,to));
  const prev = aggregate(rangeRows(prevFrom, prevTo));
  function diffPct(a,b){ if(b<=0) return a>0? 1 : 0; return (a-b)/b; }
  return {
    cur, prev,
    salesPct: diffPct(cur.sales, prev.sales),
    profitPct: diffPct(cur.profit, prev.profit),
    expensePct: diffPct(cur.expense, prev.expense)
  };
}

// === Charts (reuse from v10) ===
function rangeData(){
  const {from,to}=rangeDates();
  const rows=rangeRows(from,to);
  return rows.map(rec=>{
    const fp=getPigFund(rec), fb=getBulkFund(rec), te=sum(rec.expenses,'amount'), ts=sum(rec.sales,'amount');
    const drawer = drawerTotal(rec);
    return {date:rec.date, sales:ts, cost:fp+fb+te, hit:!!rec.breakEvenAllAt, drawer};
  });
}
function drawRangeChart(){
  const data=rangeData(); const svg=document.getElementById('chartRange'); if(!svg) return;
  svg.innerHTML='';
  const W=800,H=320, pad={l:46,r:16,t:10,b:28}; const iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  const grad=document.createElementNS(defs.namespaceURI,'linearGradient'); grad.id='gradBar'; grad.setAttribute('x1','0');grad.setAttribute('x2','0');grad.setAttribute('y1','0');grad.setAttribute('y2','1');
  const s1=document.createElementNS(defs.namespaceURI,'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#7ad1ff');
  const s2=document.createElementNS(defs.namespaceURI,'stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#2b6d9a');
  grad.append(s1,s2); defs.appendChild(grad); svg.appendChild(defs);

  const gGrid=document.createElementNS(svg.namespaceURI,'g'); gGrid.setAttribute('class','svg-grid'); svg.appendChild(gGrid);
  const gAxis=document.createElementNS(svg.namespaceURI,'g'); gAxis.setAttribute('class','svg-axis'); svg.appendChild(gAxis);
  const gMain=document.createElementNS(svg.namespaceURI,'g'); svg.appendChild(gMain);
  gMain.setAttribute('transform',`translate(${pad.l},${pad.t})`); gGrid.setAttribute('transform',`translate(${pad.l},${pad.t})`); gAxis.setAttribute('transform',`translate(${pad.l},${pad.t})`);

  if(data.length===0){
    const t=document.createElementNS(svg.namespaceURI,'text'); t.setAttribute('x',W/2); t.setAttribute('y',H/2); t.setAttribute('text-anchor','middle'); t.setAttribute('fill','#889'); t.textContent='ยังไม่มีข้อมูล';
    svg.appendChild(t); return;
  }
  const maxY=Math.max(...data.map(d=>Math.max(d.sales,d.cost,d.drawer)))||1;
  const xStep=iw/data.length;

  for(let i=0;i<=5;i++){
    const y=ih - (ih*(i/5));
    const line=document.createElementNS(svg.namespaceURI,'line');
    line.setAttribute('x1',0); line.setAttribute('x2',iw); line.setAttribute('y1',y); line.setAttribute('y2',y);
    gGrid.appendChild(line);
    const label=document.createElementNS(svg.namespaceURI,'text');
    label.setAttribute('x',-8); label.setAttribute('y',y+4); label.setAttribute('text-anchor','end'); label.textContent=THB.format(Math.round(maxY*(i/5)));
    gAxis.appendChild(label);
  }

  // bars: sales
  data.forEach((d,i)=>{
    const bh = Math.round((d.sales/maxY)*ih);
    const rect=document.createElementNS(svg.namespaceURI,'rect');
    rect.setAttribute('class','bar-rect');
    rect.setAttribute('x', i*xStep + xStep*0.15);
    rect.setAttribute('y', ih - bh);
    rect.setAttribute('width', xStep*0.5);
    rect.setAttribute('height', bh);
    gMain.appendChild(rect);
  });

  // cost line
  const pts = data.map((d,i)=>[i*xStep + xStep*0.4, ih - Math.round((d.cost/maxY)*ih)]);
  const path=document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('class','line-path');
  let dstr='M'+pts[0][0]+','+pts[0][1]; for(let i=1;i<pts.length;i++){ dstr+=' L'+pts[i][0]+','+pts[i][1]; }
  path.setAttribute('d',dstr); gMain.appendChild(path);
  pts.forEach((p,i)=>{
    const c=document.createElementNS(svg.namespaceURI,'circle'); c.setAttribute('cx',p[0]); c.setAttribute('cy',p[1]); c.setAttribute('r',3.2);
    c.setAttribute('class', data[i].hit ? 'break-dot' : 'dot'); gMain.appendChild(c);
  });

  // drawer line
  const dpts = data.map((d,i)=>[i*xStep + xStep*0.4, ih - Math.round((d.drawer/maxY)*ih)]);
  const dpath=document.createElementNS(svg.namespaceURI,'path'); dpath.setAttribute('class','drawer-line');
  let dd='M'+dpts[0][0]+','+dpts[0][1]; for(let i=1;i<dpts.length;i++){ dd+=' L'+dpts[i][0]+','+dpts[i][1]; }
  dpath.setAttribute('d',dd); gMain.appendChild(dpath);

  // x labels
  data.forEach((d,i)=>{
    const tx=document.createElementNS(svg.namespaceURI,'text'); tx.textContent = d.date.slice(5);
    tx.setAttribute('x', i*xStep + xStep*0.4);
    tx.setAttribute('y', ih + 18);
    tx.setAttribute('text-anchor','middle');
    gAxis.appendChild(tx);
  });

  const lg=document.getElementById('chartRangeLegend'); if(lg){ lg.innerHTML='';
    lg.innerHTML = '<span class="item"><span class="swatch" style="background:#7ad1ff"></span>ยอดขาย</span>' +
                   '<span class="item"><span class="swatch" style="background:#ffb3c1"></span>ต้นทุนรวม</span>' +
                   '<span class="item"><span class="swatch" style="background:#8df0ff"></span>เงินสดในลิ้นชัก</span>';
  }
}

// Donut (sales sessions) — unchanged
function donutSeries(){
  const {from,to}=rangeDates();
  const rows=rangeRows(from,to);
  const ses=state.settings.saleSessions||['เช้า','เย็น','อื่นๆ'];
  const sums=[0,0,0,0,0];
  rows.forEach(rec=>{
    (rec.sales||[]).forEach(s=>{
      const i = Math.max(0, ses.findIndex(n=>n===s.session));
      sums[i>=0?i:2]+=Number(s.amount||0);
    });
  });
  const labels=[ses[0]||'เช้า', ses[1]||'เย็น', 'อื่นๆ', ses[3]||'', ses[4]||''].filter(Boolean);
  const values=sums.slice(0,labels.length);
  return {labels, values};
}
function drawDonut(){
  const svg=document.getElementById('chartDonut'); if(!svg) return;
  svg.innerHTML='';
  const {labels, values} = donutSeries();
  const total = values.reduce((a,b)=>a+b,0);
  const cx=160, cy=160, r=90, r2=55;
  if(total<=0){
    const t=document.createElementNS(svg.namespaceURI,'text'); t.setAttribute('x',cx); t.setAttribute('y',cy); t.setAttribute('text-anchor','middle'); t.setAttribute('fill','#889'); t.textContent='ยังไม่มียอดขาย';
    svg.appendChild(t); return;
  }
  let ang= -Math.PI/2;
  for(let i=0;i<values.length;i++){
    const val=values[i]; const frac=val/total; const sweep=frac*2*Math.PI;
    const x1=cx + r*Math.cos(ang), y1=cy + r*Math.sin(ang);
    const x2=cx + r*Math.cos(ang+sweep), y2=cy + r*Math.sin(ang+sweep);
    const lx1=cx + r2*Math.cos(ang), ly1=cy + r2*Math.sin(ang);
    const lx2=cx + r2*Math.cos(ang+sweep), ly2=cy + r2*Math.sin(ang+sweep);
    const large = sweep>Math.PI ? 1 : 0;
    const path=document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d', `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${lx2} ${ly2} A ${r2} ${r2} 0 ${large} 0 ${lx1} ${ly1} Z`);
    path.setAttribute('class', 'slice'+(i%5));
    svg.appendChild(path);
    ang += sweep;
  }
  const lg=document.getElementById('chartDonutLegend'); if(lg){ lg.innerHTML='';
    const palette=['#9cc9ff','#ffd1a8','#c8ffa8','#e7b3ff','#ffa8c6'];
    labels.forEach((lab,i)=>{
      const el = `<span class="item"><span class="swatch" style="background:${palette[i%5]}"></span>${lab} ${THB.format(Math.round(values[i]||0))}</span>`;
      lg.innerHTML += el;
    });
  }
}

function renderCharts(){ drawRangeChart(); drawDonut(); }

// ---------- Summary Basic + Deep ----------
function renderSummary(){
  const d=day(); const fp=getPigFund(d), fb=getBulkFund(d), te=sum(d.expenses,'amount'), ts=sum(d.sales,'amount');
  const ses=state.settings.saleSessions||DEFAULT_SESSIONS;
  const s0=(d.sales||[]).filter(s=>s.session===(ses[0]||'เช้า')).reduce((a,b)=>a+b.amount,0);
  const s1=(d.sales||[]).filter(s=>s.session===(ses[1]||'เย็น')).reduce((a,b)=>a+b.amount,0);
  const s2=(d.sales||[]).filter(s=>![ses[0],ses[1]].includes(s.session)).reduce((a,b)=>a+b.amount,0);
  const profit=Math.max(0,ts-fp-fb-te);
  document.querySelector('#sumSales').textContent=fmt(ts);
  document.querySelector('#sumSalesBySes').textContent=`${ses[0]||'เช้า'} ${fmt(s0)} | ${ses[1]||'เย็น'} ${fmt(s1)} | อื่นๆ ${fmt(s2)}`;
  document.querySelector('#sumFundPig').textContent=fmt(fp);
  document.querySelector('#sumFundBulk').textContent=fmt(fb);
  document.querySelector('#sumProfit').textContent=fmt(profit);
  const dw=d.drawer||initDrawer(); const total = drawerTotal(d);
  document.querySelector('#drawerSummary').textContent = `เงินสดในลิ้นชัก: ${fmt(total)}`;
  setRangeButtons();
  renderCharts();
  renderSummaryDeep();
}

function renderSummaryDeep(){
  // if containers not yet added (first run after upgrade), create UI block once.
  if(!document.getElementById('sumDeep')){
    const host=document.querySelector('[data-tabpanel="summary"]');
    const block=document.createElement('section'); block.id='sumDeep'; block.className='cards';
    block.innerHTML = `
    <div class="card pastel3"><div class="label">ค่าใช้จ่ายรวม (ช่วง)</div><div class="value" id="sdExpense">฿0</div></div>
    <div class="card pastel2"><div class="label">ยอดขาย: สด/สแกน</div><div class="value" id="sdMethod">สด ฿0 | สแกน ฿0</div></div>
    <div class="card pastel4"><div class="label">จำนวนออเดอร์</div><div class="value" id="sdOrders">0 รายการ</div></div>
    <div class="card pastel1"><div class="label">กำไรสุทธิ (%)</div><div class="value"><span id="sdMargin">0%</span> <span class="tag" id="sdProfitVal">฿0</span></div></div>
    <div class="card pastel1"><div class="label">Break-even (ช่วง)</div><div class="value"><span id="sdHitPig">0</span> วัน / <span id="sdHitAll">0</span> วัน</div><div class="sub">แตะทุนหมู / ครอบคลุมทั้งหมด</div></div>
    <div class="card pastel3"><div class="label">Top 3 ค่าใช้จ่าย</div><div class="value" id="sdTopExp">-</div></div>
    <div class="card pastel2"><div class="label">ค่าเฉลี่ย/วัน</div><div class="value" id="sdAvg">ขาย ฿0 | กำไร ฿0 | ค่าใช้จ่าย ฿0</div></div>
    <div class="card pastel4"><div class="label">สัดส่วนทุน</div><div class="value" id="sdFundRatio">หมูตัว 0% / ทุนเสริม 0%</div></div>
    <div class="card pastel2"><div class="label">ยอดขายต่อกิโล (เฉลี่ย)</div><div class="value" id="sdPerKg">-</div></div>
    <div class="card pastel3"><div class="label">แนวโน้มเทียบช่วงก่อน</div><div class="value" id="sdTrend">ขาย 0% | กำไร 0% | ค่าใช้จ่าย 0%</div></div>
    <div class="card pastel4"><div class="label">เงินสดคงเหลือสุทธิ</div><div class="value" id="sdNetCash">฿0</div><div class="sub">ลิ้นชัก + กำไรสะสม (ช่วง)</div></div>
    <div class="card pastel2"><div class="label">กำไร: ออเดอร์ vs หน้าร้าน</div><div class="value" id="sdProfitSplit">ออเดอร์ ฿0 | หน้าร้าน ฿0</div></div>
    <div class="card pastel1"><div class="label">Supplier</div><div class="value" id="sdSupplier">-</div></div>
    <div class="card pastel1"><div class="label">⚠️ สถานะทุนหมู</div><div class="value" id="sdBadge">-</div></div>
    <div class="card chart-card"><div class="chart-title">Pie ค่าใช้จ่าย (ช่วง)</div><svg id="chartExpPie" class="chart" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet"></svg><div id="chartExpLegend" class="legend"></div></div>
    `;
    host.appendChild(block);
  }

  const {from,to}=rangeDates();
  const rows=rangeRows(from,to);
  const agg=aggregate(rows);
  const trend=previousRangeTrend();

  $('#sdExpense').textContent = fmt(agg.expense);
  $('#sdMethod').textContent = `สด ${fmt(agg.cash)} | สแกน ${fmt(agg.scan)}`;
  $('#sdOrders').textContent = `${agg.orders} รายการ`;
  $('#sdMargin').textContent = `${Math.round(agg.margin*100)}%`; $('#sdProfitVal').textContent = fmt(agg.profit);
  $('#sdHitPig').textContent = agg.hitsPig; $('#sdHitAll').textContent = agg.hitsAll;
  $('#sdTopExp').innerHTML = (agg.top3.length? agg.top3.map(([c,v])=>`${c} ${fmt(v)}`).join(' • ') : '-');
  $('#sdAvg').textContent = `ขาย ${fmt(agg.avgSales)} | กำไร ${fmt(agg.avgProfit)} | ค่าใช้จ่าย ${fmt(agg.avgExpense)}`;
  $('#sdFundRatio').textContent = `หมูตัว ${Math.round(agg.fundRatioPig*100)}% / ทุนเสริม ${Math.round((1-agg.fundRatioPig)*100)}%`;
  $('#sdPerKg').textContent = agg.salesPerKg>0 ? `${THB.format(Math.round(agg.salesPerKg))} / กก.` : '-';
  const tSales = Math.round(trend.salesPct*100), tProfit=Math.round(trend.profitPct*100), tExp=Math.round(trend.expensePct*100);
  $('#sdTrend').textContent = `ขาย ${tSales>=0?'📈':'📉'} ${Math.abs(tSales)}% | กำไร ${tProfit>=0?'📈':'📉'} ${Math.abs(tProfit)}% | ค่าใช้จ่าย ${Math.abs(tExp)}%`;
  $('#sdNetCash').textContent = fmt(agg.drawerLast + agg.profit);
  $('#sdProfitSplit').textContent = `ออเดอร์ ${fmt(agg.salesFromOrders)} | หน้าร้าน ${fmt(agg.salesFromStore)}`;
  $('#sdSupplier').textContent = agg.topSupplier ? `${agg.topSupplier[0]} รวม ${fmt(agg.topSupplier[1])}` : '-';
  // Badge
  const today = day();
  const pigCost=getPigFund(today), running=sum(today.sales,'amount');
  const need = Math.max(0, pigCost - running);
  $('#sdBadge').textContent = need>0 ? `ขาดอีก ${fmt(need)} เพื่อถึงทุนหมู` : '✅ ถึงทุนหมูแล้ววันนี้';

  drawExpensePie(agg);
}

function drawExpensePie(agg){
  const svg=document.getElementById('chartExpPie'); if(!svg) return;
  svg.innerHTML='';
  const entries=Object.entries(agg.expByCat); const total=entries.reduce((a,[_c,v])=>a+v,0);
  const cx=160, cy=160, r=100;
  if(total<=0){
    const t=document.createElementNS(svg.namespaceURI,'text'); t.setAttribute('x',cx); t.setAttribute('y',cy); t.setAttribute('text-anchor','middle'); t.setAttribute('fill','#889'); t.textContent='ยังไม่มีค่าใช้จ่าย';
    svg.appendChild(t); return;
  }
  let ang=-Math.PI/2; const palette=['#9cc9ff','#ffd1a8','#c8ffa8','#e7b3ff','#ffa8c6','#f6ffa8','#a8ffec','#ffb3c1'];
  entries.forEach(([cat,val],i)=>{
    const frac=val/total, sweep=frac*2*Math.PI;
    const x1=cx + r*Math.cos(ang), y1=cy + r*Math.sin(ang);
    const x2=cx + r*Math.cos(ang+sweep), y2=cy + r*Math.sin(ang+sweep);
    const large = sweep>Math.PI ? 1 : 0;
    const path=document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d', `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`);
    path.setAttribute('fill', palette[i%palette.length]);
    svg.appendChild(path);
    ang += sweep;
  });
  const lg=document.getElementById('chartExpLegend'); if(lg){ lg.innerHTML=''; entries.forEach(([c,v],i)=>{ lg.innerHTML += `<span class="item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${c} ${THB.format(Math.round(v))}</span>`; }); }
}

// ---------- Boot ----------
const dpInit=()=>{ if(dp) dp.value=state.date; }; dpInit();
btnToday&& (btnToday.onclick=()=>{ state.date=todayYMD(); if(dp) dp.value=state.date; renderAll(); });
dp&& (dp.onchange=e=>{ state.date=e.target.value; renderAll(); });
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js')) }
function renderAll(){ renderTop(); renderLists(); renderHistory(); renderSummary(); }
renderAll();
