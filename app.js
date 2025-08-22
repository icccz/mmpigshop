// PigShopTH PWA logic
const THB = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const storeKey = 'pigshop.days.v1';
const settingsKey = 'pigshop.settings.v1';

// Basic state
let state = {
  date: todayYMD(),
  days: loadJSON(storeKey, []),
  settings: loadJSON(settingsKey, { quickAmounts: [100,150,200,500], sheetsUrl: '' })
};

// Helpers
function todayYMD() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function ymd(d) {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() - c.getTimezoneOffset());
  return c.toISOString().slice(0,10);
}
function loadJSON(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch(e){ return def } }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
function getDay(dateStr){
  let d = state.days.find(x => x.date === dateStr);
  if(!d){
    d = { id: crypto.randomUUID(), date: dateStr, funds:[], sales:[], expenses:[], notes:'', breakEvenPigAt:null, breakEvenAllAt:null };
    state.days.push(d);
  }
  return d;
}
function sum(arr, field){ return arr.reduce((a,b)=>a + Number(b[field]||0), 0) }
function fmt(n){ return THB.format(Math.max(0, Math.round(Number(n)||0))) }
function setProgress(elPct, pct){
  const p = Math.max(0, Math.min(100, Math.round(pct*100)));
  elPct.style.width = p + '%';
}

function recalcBreakEven(day){
  day.breakEvenPigAt = null;
  day.breakEvenAllAt = null;
  const fund = sum(day.funds,'amount');
  const exp = sum(day.expenses,'amount');
  const all = fund + exp;
  let running = 0;
  const salesSorted = [...day.sales].sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
  for(const s of salesSorted){
    running += Number(s.amount);
    if(!day.breakEvenPigAt && running >= fund) day.breakEvenPigAt = s.createdAt;
    if(!day.breakEvenAllAt && running >= all) day.breakEvenAllAt = s.createdAt;
    if(day.breakEvenPigAt && day.breakEvenAllAt) break;
  }
}

function persist(){
  saveJSON(storeKey, state.days);
  saveJSON(settingsKey, state.settings);
}

// UI elements
const $ = sel => document.querySelector(sel);
const datePicker = $('#datePicker');
const btnToday = $('#btnToday');
const valFund = $('#valFund');
const valSales = $('#valSales');
const valExpense = $('#valExpense');
const valProfit = $('#valProfit');
const remPig = $('#remPig');
const remAll = $('#remAll');
const progPig = $('#progPig');
const progAll = $('#progAll');

const dlgSale = $('#dlgSale');
const saleAmount = $('#saleAmount');
const saleNote = $('#saleNote');
const saleSave = $('#saleSave');
const saleCancel = $('#saleCancel');
const quickChips = $('#quickChips');

const dlgExpense = $('#dlgExpense');
const expCat = $('#expCat');
const expAmount = $('#expAmount');
const expNote = $('#expNote');
const expSave = $('#expSave');
const expCancel = $('#expCancel');

const dlgFund = $('#dlgFund');
const fundAmount = $('#fundAmount');
const fundSupplier = $('#fundSupplier');
const fundWeight = $('#fundWeight');
const fundSave = $('#fundSave');
const fundCancel = $('#fundCancel');

const dlgClose = $('#dlgClose');
const closeNote = $('#closeNote');
const sheetsUrl = $('#sheetsUrl');
const btnExportCSV = $('#btnExportCSV');
const btnAppendSheets = $('#btnAppendSheets');
const closeCancel = $('#closeCancel');
const closeMsg = $('#closeMsg');

// init
datePicker.value = state.date;
sheetsUrl.value = state.settings.sheetsUrl || '';
render();
renderHistory();
renderQuickChips();

function render(){
  const day = getDay(state.date);

  const tf = sum(day.funds,'amount');
  const ts = sum(day.sales,'amount');
  const te = sum(day.expenses,'amount');
  const profit = Math.max(0, ts - tf - te);

  valFund.textContent = fmt(tf);
  valSales.textContent = fmt(ts);
  valExpense.textContent = fmt(te);
  valProfit.textContent = fmt(profit);

  const pigRemain = Math.max(0, tf - ts);
  const allRemain = Math.max(0, tf + te - ts);

  remPig.textContent = pigRemain === 0 ? 'ถึงแล้ว' : `ขาดอีก ${fmt(pigRemain)}`;
  remAll.textContent = allRemain === 0 ? 'ถึงแล้ว' : `ขาดอีก ${fmt(allRemain)}`;

  setProgress(progPig, tf===0 ? 0 : ts/tf);
  setProgress(progAll, (tf+te)===0 ? 0 : ts/(tf+te));
}

function renderQuickChips(){
  quickChips.innerHTML = '';
  (state.settings.quickAmounts || [100,150,200,500]).forEach(n => {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', ()=> saleAmount.value = String(n));
    quickChips.appendChild(b);
  });
}

function renderHistory(){
  const wrap = $('#historyList');
  const monthSummary = $('#monthSummary');
  wrap.innerHTML = '';

  const now = new Date(state.date);
  const y = now.getFullYear(), m = now.getMonth();
  let list = state.days.filter(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.getFullYear()===y && dt.getMonth()===m;
  }).sort((a,b)=> new Date(b.date)-new Date(a.date));

  let F=0,E=0,S=0,P=0, hitPig=0, hitAll=0;
  list.forEach(d => {
    const tf = sum(d.funds,'amount');
    const te = sum(d.expenses,'amount');
    const ts = sum(d.sales,'amount');
    const profit = Math.max(0, ts - tf - te);
    F+=tf;E+=te;S+=ts;P+=profit;
    if(d.breakEvenPigAt) hitPig++;
    if(d.breakEvenAllAt) hitAll++;
  });

  monthSummary.textContent = `ทุนรวม ${fmt(F)} | ค่าใช้จ่ายรวม ${fmt(E)} | ยอดขายรวม ${fmt(S)} | กำไรรวม ${fmt(P)} | แตะทุนหมู ${hitPig} วัน | ครอบคลุมทั้งหมด ${hitAll} วัน`;

  list.forEach(d => {
    const tf = sum(d.funds,'amount');
    const te = sum(d.expenses,'amount');
    const ts = sum(d.sales,'amount');
    const profit = Math.max(0, ts - tf - te);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="title">${d.date}</div>
      <div class="meta">ทุน: ${fmt(tf)} | ขาย: ${fmt(ts)} | กำไร: ${fmt(profit)}</div>`;
    row.addEventListener('click', ()=>{
      state.date = d.date;
      datePicker.value = d.date;
      render();
    });
    wrap.appendChild(row);
  });
}

// events
btnToday.addEventListener('click', ()=>{
  state.date = todayYMD();
  datePicker.value = state.date;
  render(); renderHistory();
});

datePicker.addEventListener('change', e=>{
  state.date = e.target.value;
  render(); renderHistory();
});

$('#btnAddSale').addEventListener('click', ()=>{
  saleAmount.value = ''; saleNote.value=''; dlgSale.showModal();
});
saleCancel.addEventListener('click', ()=> dlgSale.close());
saleSave.addEventListener('click', ()=>{
  const v = Math.round(Number(saleAmount.value || 0));
  if(v>0){
    const d = getDay(state.date);
    d.sales.push({ id: crypto.randomUUID(), amount: v, note: saleNote.value||'', createdAt: new Date().toISOString() });
    recalcBreakEven(d);
    persist();
    render(); renderHistory();
  }
  dlgSale.close();
});

$('#btnAddExpense').addEventListener('click', ()=>{
  expAmount.value=''; expNote.value=''; expCat.value='น้ำแข็ง'; dlgExpense.showModal();
});
expCancel.addEventListener('click', ()=> dlgExpense.close());
expSave.addEventListener('click', ()=>{
  const v = Math.round(Number(expAmount.value || 0));
  if(v>0){
    const d = getDay(state.date);
    d.expenses.push({ id: crypto.randomUUID(), amount: v, category: expCat.value, note: expNote.value||'', createdAt: new Date().toISOString() });
    recalcBreakEven(d);
    persist();
    render(); renderHistory();
  }
  dlgExpense.close();
});

$('#btnAddFund').addEventListener('click', ()=>{
  fundAmount.value=''; fundSupplier.value=''; fundWeight.value=''; dlgFund.showModal();
});
fundCancel.addEventListener('click', ()=> dlgFund.close());
fundSave.addEventListener('click', ()=>{
  const v = Math.round(Number(fundAmount.value || 0));
  if(v>0){
    const d = getDay(state.date);
    d.funds.push({ id: crypto.randomUUID(), amount: v, supplier: fundSupplier.value||'', weightKg: Number(fundWeight.value||0), createdAt: new Date().toISOString() });
    recalcBreakEven(d);
    persist();
    render(); renderHistory();
  }
  dlgFund.close();
});

$('#btnCloseDay').addEventListener('click', ()=>{
  const d = getDay(state.date);
  closeNote.value = d.notes || '';
  sheetsUrl.value = state.settings.sheetsUrl || '';
  dlgClose.showModal();
});
closeCancel.addEventListener('click', ()=> dlgClose.close());

btnExportCSV.addEventListener('click', ()=>{
  const now = new Date(state.date);
  const y = now.getFullYear(), m = now.getMonth();
  const list = state.days.filter(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.getFullYear()===y && dt.getMonth()===m;
  }).sort((a,b)=> new Date(a.date)-new Date(b.date));

  const header = "Date,TotalFund,TotalExpense,TotalSales,Profit,BreakEvenPigAt,BreakEvenAllAt,Notes";
  const lines = [header];
  list.forEach(d=>{
    const tf = sum(d.funds,'amount');
    const te = sum(d.expenses,'amount');
    const ts = sum(d.sales,'amount');
    const profit = Math.max(0, ts - tf - te);
    const pig = d.breakEvenPigAt ? new Date(d.breakEvenPigAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '';
    const all = d.breakEvenAllAt ? new Date(d.breakEvenAllAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '';
    const note = (d.notes||'').replace(/,/g,' ');
    lines.push([d.date, tf, te, ts, profit, pig, all, note].join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `PigShop-${state.date.slice(0,7)}.csv`;
  a.click();
});

btnAppendSheets.addEventListener('click', async ()=>{
  const url = (sheetsUrl.value||'').trim();
  state.settings.sheetsUrl = url; persist();
  if(!url){ closeMsg.textContent = 'ใส่ URL ของ Google Apps Script ก่อน'; return; }
  const d = getDay(state.date);
  d.notes = closeNote.value||'';
  const tf = sum(d.funds,'amount');
  const te = sum(d.expenses,'amount');
  const ts = sum(d.sales,'amount');
  const profit = Math.max(0, ts - tf - te);
  const payload = {
    date: d.date,
    totalFund: tf,
    totalExpense: te,
    totalSales: ts,
    profit: profit,
    breakEvenPigAt: d.breakEvenPigAt ? new Date(d.breakEvenPigAt).toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'}) : null,
    breakEvenAllAt: d.breakEvenAllAt ? new Date(d.breakEvenAllAt).toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'}) : null,
    dayNote: d.notes || ''
  };
  try{
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(res.ok){ closeMsg.textContent = 'ส่งข้อมูลไป Google Sheets เรียบร้อย'; }
    else { closeMsg.textContent = 'ส่งไม่สำเร็จ (เช็คเน็ต/ลิงก์)'; }
  }catch(e){
    closeMsg.textContent = 'ส่งไม่สำเร็จ (ออฟไลน์อยู่?)';
  }
});

// Register service worker (offline)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js'));
}
