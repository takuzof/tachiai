
const $ = id => document.getElementById(id);
const state = {
  attachments: [],
  vendors: JSON.parse(localStorage.getItem('handoffVendors') || localStorage.getItem('taikyoVendors') || '[]'),
  properties: JSON.parse(localStorage.getItem('handoffProperties') || '[]')
};
let editingPropertyIndex = null;
let editingVendorIndex = null;
let pendingPropertyImport = [];

function saveVendors(){
  localStorage.setItem('handoffVendors', JSON.stringify(state.vendors));
  localStorage.removeItem('taikyoVendors');
}
function saveProperties(){ localStorage.setItem('handoffProperties', JSON.stringify(state.properties)); }
function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmtBytes(n){ if(n<1024)return n+' B'; if(n<1048576)return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }

function renderVendors(){
  const sel=$('vendorSelect');
  const current=sel.value;
  sel.innerHTML='';
  if(!state.vendors.length){
    const o=document.createElement('option');o.value='';o.textContent='業者マスターを登録してください';sel.appendChild(o);
  }else{
    state.vendors.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${v.name}${v.person?' / '+v.person:''}`;sel.appendChild(o)});
    if(current!=='' && state.vendors[+current]) sel.value=current;
  }
  updateVendorDetail();
  $('vendorList').innerHTML=state.vendors.length ? state.vendors.map((v,i)=>`
    <div class="vendor-row"><div><b>${esc(v.name)}</b><div class="small">${esc(v.person||'')} ${esc(v.email||'')}</div><div class="small">${esc(v.phone||'')}</div></div>
    <div class="master-row-actions"><button type="button" class="edit-master" onclick="editVendor(${i})">編集</button><button type="button" class="remove" onclick="deleteVendor(${i})">削除</button></div></div>`).join('') : '<div class="empty-master">まだ業者が登録されていません。</div>';
}
function updateVendorDetail(){
  const v=state.vendors[+$('vendorSelect').value]||{};
  $('vendorDetail').innerHTML=v.name ? `<b>${esc(v.name)}</b><br>${esc(v.person||'')}<br>${esc(v.email||'')}${v.phone?'<br>'+esc(v.phone):''}` : 'マスター管理から立会業者を登録してください。';
}
window.deleteVendor=(i)=>{ if(!confirm('この業者を削除しますか？'))return; state.vendors.splice(i,1); saveVendors(); renderProperties(); renderVendors(); generateMail(); };

function renderProperties(){
  const dl=$('propertyOptions');
  dl.innerHTML=state.properties.map(p=>`<option value="${esc(p.name)}">${esc(p.address||'')}</option>`).join('');
  $('propertyMasterList').innerHTML=state.properties.length ? state.properties.map((p,i)=>`
    <div class="vendor-row"><div><b>${esc(p.name)}</b><div class="small">${esc(p.address||'')}</div></div>
    <div class="master-row-actions"><button type="button" class="edit-master" onclick="editProperty(${i})">編集</button><button type="button" class="remove" onclick="deleteProperty(${i})">削除</button></div></div>`).join('') : '<div class="empty-master">まだ物件が登録されていません。</div>';
}
window.deleteProperty=(i)=>{ if(!confirm('この物件を削除しますか？'))return; state.properties.splice(i,1); if(editingPropertyIndex===i) cancelPropertyEdit(); editingPropertyIndex=null; saveProperties(); renderProperties(); };
window.editProperty=(i)=>{ const p=state.properties[i]; if(!p)return; editingPropertyIndex=i; $('masterPropertyName').value=p.name||''; $('masterPropertyAddress').value=p.address||''; $('savePropertyBtn').textContent='変更を保存'; $('cancelPropertyEditBtn').hidden=false; };
function cancelPropertyEdit(){ editingPropertyIndex=null; $('masterPropertyName').value=''; $('masterPropertyAddress').value=''; $('savePropertyBtn').textContent='物件を登録'; $('cancelPropertyEditBtn').hidden=true; }
$('cancelPropertyEditBtn').onclick=cancelPropertyEdit;

function openMasterDialog(tab='property'){
  switchMasterTab(tab);
  renderProperties(); renderVendors();
  $('masterDialog').showModal();
}
function switchMasterTab(tab){
  document.querySelectorAll('.master-tab').forEach(b=>b.classList.toggle('active',b.dataset.masterTab===tab));
  $('propertyMasterPanel').classList.toggle('active',tab==='property');
  $('vendorMasterPanel').classList.toggle('active',tab==='vendor');
}
$('masterBtn').onclick=()=>openMasterDialog('property');
$('manageVendorsBtn').onclick=()=>openMasterDialog('vendor');
document.querySelectorAll('.master-tab').forEach(b=>b.onclick=()=>switchMasterTab(b.dataset.masterTab));

$('savePropertyBtn').onclick=()=>{
  const p={name:$('masterPropertyName').value.trim(),address:$('masterPropertyAddress').value.trim()};
  if(!p.name){alert('物件名を入力してください');return}
  const dup=state.properties.findIndex((x,i)=>x.name===p.name && i!==editingPropertyIndex);
  if(dup>=0){alert('同じ物件名が登録されています');return}
  if(editingPropertyIndex===null){ state.properties.push(p); }
  else { state.properties[editingPropertyIndex]=p; }
  state.properties.sort((a,b)=>a.name.localeCompare(b.name,'ja')); saveProperties(); cancelPropertyEdit(); renderProperties();
};

$('saveVendorBtn').onclick=()=>{
  const v={name:$('vendorName').value.trim(),person:$('vendorPerson').value.trim(),email:$('vendorEmail').value.trim(),phone:$('vendorPhone').value.trim()};
  if(!v.name||!v.email){alert('会社名とメールアドレスを入力してください');return}
  if(editingVendorIndex===null){ state.vendors.push(v); }
  else { state.vendors[editingVendorIndex]=v; }
  saveVendors(); cancelVendorEdit(); renderVendors(); generateMail();
};
$('vendorSelect').onchange=()=>{updateVendorDetail();generateMail();};

$('exportMastersBtn').onclick=()=>{
  const data={version:1,exportedAt:new Date().toISOString(),properties:state.properties,vendors:state.vendors};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`HANDOFF_マスター_${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
$('importMastersInput').onchange=async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    if(!Array.isArray(data.properties)||!Array.isArray(data.vendors)) throw new Error('invalid');
    if(!confirm('現在のマスターをバックアップ内容で置き換えますか？')){e.target.value='';return}
    state.properties=data.properties; state.vendors=data.vendors; saveProperties(); saveVendors(); renderProperties(); renderProperties(); renderVendors(); generateMail();
    alert('マスターを復元しました');
  }catch(err){alert('バックアップファイルを読み込めませんでした');}
  e.target.value='';
};


function normalizeHeader(s){
  return String(s ?? '').replace(/\s+/g,'').replace(/[　]/g,'').toLowerCase();
}
function detectColumn(headers, candidates){
  const normalized=headers.map(normalizeHeader);
  for(const c of candidates){
    const idx=normalized.indexOf(normalizeHeader(c));
    if(idx>=0) return headers[idx];
  }
  return null;
}
function rowsToProperties(rows){
  if(!Array.isArray(rows) || !rows.length) return [];
  const headers=Object.keys(rows[0]||{});
  const nameCol=detectColumn(headers,['物件名','建物名','物件名称','建物名称','マンション名','アパート名','名称','name']);
  const addrCol=detectColumn(headers,['住所','所在地','物件住所','建物住所','address']);
  if(!nameCol){
    throw new Error('「物件名」または「建物名」の列が見つかりません');
  }
  const seen=new Set();
  const props=[];
  for(const row of rows){
    const name=String(row[nameCol] ?? '').trim();
    if(!name) continue;
    const address=addrCol ? String(row[addrCol] ?? '').trim() : '';
    const key=name.replace(/\s+/g,'').toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    props.push({name,address});
  }
  return props;
}
function parseCsvText(text){
  // Excel等から出力した一般的なCSVを簡易解析。引用符内カンマに対応。
  const rows=[]; let row=[], field='', quote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quote && text[i+1]==='"'){field+='"';i++;}
      else quote=!quote;
    }else if(ch===',' && !quote){row.push(field);field='';}
    else if((ch==='\n' || ch==='\r') && !quote){
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(field); field='';
      if(row.some(v=>String(v).trim()!=='')) rows.push(row);
      row=[];
    }else field+=ch;
  }
  if(field || row.length){row.push(field); if(row.some(v=>String(v).trim()!=='')) rows.push(row);}
  if(!rows.length) return [];
  const headers=rows[0].map(v=>String(v).trim());
  return rows.slice(1).map(r=>{
    const o={}; headers.forEach((h,i)=>o[h]=r[i]??''); return o;
  });
}
async function readPropertyImportFile(file){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(ext==='csv'){
    const buf=await file.arrayBuffer();
    let text;
    // UTF-8 first; fallback to Shift_JIS for common Japanese CSVs.
    try{
      text=new TextDecoder('utf-8',{fatal:true}).decode(buf);
    }catch(e){
      text=new TextDecoder('shift_jis').decode(buf);
    }
    return parseCsvText(text);
  }
  if(!window.XLSX) throw new Error('Excel読込ライブラリを読み込めませんでした');
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet,{defval:''});
}
function showPropertyImportPreview(props){
  const box=$('propertyImportPreview');
  if(!props.length){
    box.hidden=true; box.innerHTML=''; $('applyPropertyImportBtn').hidden=true; return;
  }
  const sample=props.slice(0,8);
  box.innerHTML=`<div class="import-summary"><b>${props.length}件</b>を読み込みました。</div>`+
    sample.map(p=>`<div class="import-preview-row"><b>${esc(p.name)}</b><span>${esc(p.address||'住所なし')}</span></div>`).join('')+
    (props.length>8?`<div class="small">ほか ${props.length-8}件</div>`:'');
  box.hidden=false; $('applyPropertyImportBtn').hidden=false;
}
$('propertyImportFile').onchange=async e=>{
  const file=e.target.files?.[0];
  if(!file) return;
  $('propertyImportStatus').textContent='読み込み中...';
  pendingPropertyImport=[];
  try{
    const rows=await readPropertyImportFile(file);
    pendingPropertyImport=rowsToProperties(rows);
    if(!pendingPropertyImport.length) throw new Error('登録できる物件がありません');
    $('propertyImportStatus').textContent=`${file.name} を読み込みました`;
    showPropertyImportPreview(pendingPropertyImport);
  }catch(err){
    console.error(err);
    $('propertyImportStatus').textContent=`読込エラー：${err.message||err}`;
    showPropertyImportPreview([]);
  }
};
$('applyPropertyImportBtn').onclick=()=>{
  if(!pendingPropertyImport.length) return;
  const mode=document.querySelector('input[name="propertyImportMode"]:checked')?.value || 'append';
  if(mode==='replace'){
    if(!confirm(`現在の物件マスターを削除して、${pendingPropertyImport.length}件で置き換えますか？`)) return;
    state.properties=[...pendingPropertyImport];
  }else{
    const existing=new Set(state.properties.map(p=>p.name.replace(/\s+/g,'').toLowerCase()));
    let added=0;
    for(const p of pendingPropertyImport){
      const key=p.name.replace(/\s+/g,'').toLowerCase();
      if(existing.has(key)) continue;
      state.properties.push(p); existing.add(key); added++;
    }
    alert(`${added}件を追加しました。重複物件は追加していません。`);
  }
  state.properties.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  saveProperties(); renderProperties();
  pendingPropertyImport=[];
  $('propertyImportFile').value='';
  $('propertyImportStatus').textContent='物件マスターへ登録しました';
  showPropertyImportPreview([]);
};

// 有坂不動産「貸室解約申出書」専用OCR
const FORM_ZONES = [
  {key:'property',label:'貸室名',x:.315,y:.315,w:.465,h:.042},
  {key:'room',label:'号室',x:.785,y:.315,w:.105,h:.042},
  {key:'cancelDate',label:'解約予定日',x:.315,y:.355,w:.570,h:.045},
  {key:'phone',label:'TEL',x:.555,y:.438,w:.335,h:.050},
  {key:'tenantName',label:'氏名',x:.445,y:.845,w:.445,h:.055}
];

function cleanText(t){return (t||'').replace(/[|｜]/g,'').replace(/[ \t　]+/g,' ').replace(/\n+/g,' ').trim()}
function parseDate(t){
  t=cleanText(t);
  let m=t.match(/令和\s*(\d+)\D+(\d{1,2})\D+(\d{1,2})/);
  if(m)return `${2018+Number(m[1])}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=t.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  return '';
}
function parsePhone(t){const m=cleanText(t).match(/0\d{1,4}[^\d]?\d{1,4}[^\d]?\d{3,4}/);return m?m[0].replace(/[^\d]/g,''):''}
function detectPageBottom(bitmap){
  const c=document.createElement('canvas'); const w=180,h=Math.max(1,Math.round(bitmap.height*w/bitmap.width)); c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0,w,h);const d=ctx.getImageData(0,0,w,h).data;
  const rowMean=y=>{let sum=0;for(let x=0;x<w;x++){const i=(y*w+x)*4;sum+=(d[i]+d[i+1]+d[i+2])/3}return sum/w};
  let bottom=h-1, darkRun=0;
  for(let y=Math.round(h*.55);y<h;y++){ if(rowMean(y)<145) darkRun++; else darkRun=0; if(darkRun>=6){bottom=y-5;break;} }
  return Math.max(Math.round(h*.65),bottom)/h;
}
function cropZone(bitmap,z,pageBottom){
  const sx=Math.round(bitmap.width*z.x), sy=Math.round(bitmap.height*(z.y*pageBottom));
  const sw=Math.round(bitmap.width*z.w), sh=Math.round(bitmap.height*(z.h*pageBottom));
  const c=document.createElement('canvas');c.width=Math.max(1,sw*3);c.height=Math.max(1,sh*3);
  const ctx=c.getContext('2d');ctx.drawImage(bitmap,sx,sy,sw,sh,0,0,c.width,c.height);
  const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=g<180?Math.max(0,g*.68):255;d[i]=d[i+1]=d[i+2]=v}ctx.putImageData(im,0,0);return c;
}
function zoneValue(z,raw){let t=cleanText(raw);if(z.key==='cancelDate')return parseDate(t);if(z.key==='phone')return parsePhone(t);if(z.key==='room')return t.replace(/号室/g,'').replace(/[^0-9A-Za-z-]/g,'');return t.replace(/^(貸室名|氏名|TEL|号室)[:：\s]*/,'').trim()}
async function processTemplate(file){
  $('ocrPreview').innerHTML='';$('zonePreview').innerHTML='';$('ocrStatus').textContent='書類を読み込んでいます…';
  const bitmap=await createImageBitmap(file), img=document.createElement('img');img.src=URL.createObjectURL(file);$('ocrPreview').appendChild(img);
  const pageBottom=detectPageBottom(bitmap); const all=[];
  for(let i=0;i<FORM_ZONES.length;i++){
    const z=FORM_ZONES[i],canvas=cropZone(bitmap,z,pageBottom),card=document.createElement('div');card.className='zone-card';card.innerHTML=`<b>${z.label}</b>`;card.appendChild(canvas);const result=document.createElement('div');result.className='zone-result';result.textContent='読取中…';card.appendChild(result);$('zonePreview').appendChild(card);
    $('ocrStatus').textContent=`${z.label}を読取中… ${i+1}/${FORM_ZONES.length}`;
    try{const {data:{text}}=await Tesseract.recognize(canvas,z.key==='cancelDate'||z.key==='phone'?'eng':'jpn+eng',{logger:()=>{}});const v=zoneValue(z,text);result.textContent=v||'未認識';if(v)$(z.key).value=v;all.push(`${z.label}: ${cleanText(text)}`)}catch(e){console.error(e);result.textContent='読取失敗'}
  }
  $('ocrText').value=all.join('\n');generateMail();$('ocrStatus').textContent='専用OCRが完了しました。必ず各項目を確認してください。';
}
$('reparseBtn').onclick=()=>{const t=$('ocrText').value;const ph=parsePhone(t),dt=parseDate(t);if(ph&&!$('phone').value)$('phone').value=ph;if(dt&&!$('cancelDate').value)$('cancelDate').value=dt;generateMail()};
$('ocrInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await processTemplate(file)}catch(err){console.error(err);$('ocrStatus').textContent='OCRに失敗しました。用紙全体が入るよう、できるだけ正面から撮影してください。'}};

['attachCamera','attachImages','attachPdf'].forEach(id=>{
  $(id).onchange=e=>{ [...e.target.files].forEach(addAttachment); e.target.value=''; };
});
function addAttachment(file){
  state.attachments.push({id:crypto.randomUUID(),file});
  renderAttachments();
}
function renderAttachments(){
  const box=$('attachmentList'); box.innerHTML='';
  state.attachments.forEach(a=>{
    const el=document.createElement('div');el.className='attachment-item';
    const isImg=a.file.type.startsWith('image/');
    el.innerHTML=`${isImg?`<img src="${URL.createObjectURL(a.file)}">`:`<div style="font-size:34px">📄</div>`}
      <div class="attachment-meta"><b>${esc(a.file.name)}</b><span>${fmtBytes(a.file.size)}</span></div>
      <button class="remove" type="button">削除</button>`;
    el.querySelector('button').onclick=()=>{state.attachments=state.attachments.filter(x=>x.id!==a.id);renderAttachments()};
    box.appendChild(el);
  });
}

function generateMail(){
  const v=state.vendors[+$('vendorSelect').value]||{};
  const p=$('property').value.trim(), r=$('room').value.trim();
  $('mailSubject').value=`退去立会のお願い【${p||'物件名'}${r?' '+r:''}】`;
  const val=id=>$(id).value||'';
  $('mailBody').value=
`${v.person||v.name||'ご担当者'} 様

いつもお世話になっております。

下記物件につきまして、退去立会をお願いいたします。

【物件名】
${p}${r?` ${r}`:''}

【借主名】
${val('tenantName')}

【入居者名】
${val('residentName')}

【電話番号】
${val('phone')}

【立会者】
${val('attendee')}

【立会希望日】
${formatDateTime(val('inspectionDate'))}

【退去予定日】
${formatDate(val('moveoutDate'))}

【解約予定日】
${formatDate(val('cancelDate'))}

添付資料も併せてご確認ください。

お手数ですが、ご対応のほどよろしくお願いいたします。`;
}
function formatDate(v){ if(!v)return ''; const [y,m,d]=v.split('-'); return `${y}年${Number(m)}月${Number(d)}日`; }
function formatDateTime(v){ if(!v)return ''; const [date,time]=v.split('T'); return `${formatDate(date)} ${time||''}`.trim(); }
document.querySelectorAll('#property,#room,#tenantName,#residentName,#phone,#attendee,#inspectionDate,#moveoutDate,#cancelDate').forEach(el=>el.addEventListener('input',generateMail));
$('generateMailBtn').onclick=generateMail;
$('copyMailBtn').onclick=async()=>{await navigator.clipboard.writeText($('mailBody').value);alert('メール本文をコピーしました');};
$('clearFormBtn').onclick=()=>{['property','room','tenantName','residentName','phone','attendee','inspectionDate','moveoutDate','cancelDate','ocrText'].forEach(id=>$(id).value='');generateMail();};

async function imageFileToJpegBytes(file, maxWidth=1800, quality=.82){
  const img=await createImageBitmap(file);
  const scale=Math.min(1,maxWidth/img.width);
  const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
  const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));
  return new Uint8Array(await blob.arrayBuffer());
}
async function buildPdf(){
  const {PDFDocument}=PDFLib;
  const out=await PDFDocument.create();

  // First page: request summary
  const page=out.addPage([595.28,841.89]);
  const font=await out.embedFont(PDFLib.StandardFonts.Helvetica);
  const lines = [
    'Move-out inspection request',
    `Property: ${$('property').value} ${$('room').value}`,
    `Tenant: ${$('tenantName').value}`,
    `Resident: ${$('residentName').value}`,
    `Phone: ${$('phone').value}`,
    `Attendee: ${$('attendee').value}`,
    `Inspection: ${$('inspectionDate').value}`,
    `Move-out: ${$('moveoutDate').value}`,
    `Cancellation: ${$('cancelDate').value}`
  ];
  let y=800;
  lines.forEach((t,i)=>{page.drawText(t,{x:45,y,size:i===0?18:11,font});y-=i===0?34:24;});

  for(const a of state.attachments){
    const f=a.file;
    if(f.type.startsWith('image/')){
      const bytes=await imageFileToJpegBytes(f);
      const img=await out.embedJpg(bytes);
      const dim=img.scale(1);
      const p=out.addPage([595.28,841.89]);
      const maxW=515,maxH=761,scale=Math.min(maxW/dim.width,maxH/dim.height,1);
      const w=dim.width*scale,h=dim.height*scale;
      p.drawImage(img,{x:(595.28-w)/2,y:(841.89-h)/2,width:w,height:h});
    }else if(f.type==='application/pdf'){
      const src=await PDFDocument.load(await f.arrayBuffer());
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
  }
  return await out.save();
}
function safeName(){
  const p=($('property').value||'退去立会').replace(/[\\/:*?"<>|]/g,'_');
  const r=($('room').value||'').replace(/[\\/:*?"<>|]/g,'_');
  return `${p}${r?'_'+r:''}_退去立会資料.pdf`;
}
$('downloadPdfBtn').onclick=async()=>{
  $('shareStatus').textContent='PDF作成中…';
  try{
    const bytes=await buildPdf(); const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=safeName();a.click();
    $('shareStatus').textContent='PDFを作成しました。';
  }catch(e){console.error(e);$('shareStatus').textContent='PDF作成に失敗しました。';}
};
$('shareBtn').onclick=async()=>{
  $('shareStatus').textContent='PDF作成中…';
  try{
    generateMail();
    const bytes=await buildPdf(); const file=new File([bytes],safeName(),{type:'application/pdf'});
    const v=state.vendors[+$('vendorSelect').value]||{};
    const shareData={title:$('mailSubject').value,text:$('mailBody').value,files:[file]};
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share(shareData);
      $('shareStatus').textContent='共有画面を開きました。「メール」を選択してください。';
    }else{
      const blob=new Blob([bytes],{type:'application/pdf'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=safeName();a.click();
      await navigator.clipboard.writeText($('mailBody').value);
      $('shareStatus').textContent='この端末では直接共有できないため、PDFを保存しメール本文をコピーしました。';
    }
  }catch(e){
    if(e.name!=='AbortError'){console.error(e);$('shareStatus').textContent='共有処理に失敗しました。';}
    else $('shareStatus').textContent='共有をキャンセルしました。';
  }
};

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;$('installBtn').hidden=true}};
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

renderProperties(); renderVendors(); generateMail();
