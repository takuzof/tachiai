
const $ = id => document.getElementById(id);
const state = {
  attachments: [],
  vendors: JSON.parse(localStorage.getItem('taikyoVendors') || '[]')
};
if (!state.vendors.length) {
  state.vendors = [{name:'サンプル内装', person:'ご担当者様', email:'sample@example.com'}];
  saveVendors();
}

function saveVendors(){ localStorage.setItem('taikyoVendors', JSON.stringify(state.vendors)); }
function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmtBytes(n){ if(n<1024)return n+' B'; if(n<1048576)return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }

function renderVendors(){
  const sel=$('vendorSelect'); sel.innerHTML='';
  state.vendors.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${v.name}${v.person?' / '+v.person:''}`;sel.appendChild(o)});
  updateVendorDetail();
  $('vendorList').innerHTML=state.vendors.map((v,i)=>`
    <div class="vendor-row"><div><b>${esc(v.name)}</b><div class="small">${esc(v.person||'')} ${esc(v.email||'')}</div></div>
    <button type="button" class="remove" onclick="deleteVendor(${i})">削除</button></div>`).join('');
}
function updateVendorDetail(){
  const v=state.vendors[+$('vendorSelect').value]||{};
  $('vendorDetail').innerHTML=`<b>${esc(v.name||'')}</b><br>${esc(v.person||'')}<br>${esc(v.email||'')}`;
}
window.deleteVendor=(i)=>{ state.vendors.splice(i,1); saveVendors(); renderVendors(); };

$('manageVendorsBtn').onclick=()=>{$('vendorDialog').showModal();renderVendors()};
$('saveVendorBtn').onclick=()=>{
  const v={name:$('vendorName').value.trim(),person:$('vendorPerson').value.trim(),email:$('vendorEmail').value.trim()};
  if(!v.name||!v.email){alert('会社名とメールアドレスを入力してください');return}
  state.vendors.push(v);saveVendors();['vendorName','vendorPerson','vendorEmail'].forEach(id=>$(id).value='');renderVendors();
};
$('vendorSelect').onchange=()=>{updateVendorDetail();generateMail();};

function normalizeDateText(s){
  s=s.replace(/[年月]/g,'/').replace(/日/g,'').replace(/\s+/g,' ');
  const reiwa=s.match(/令和\s*(\d+)\s*[\/.-]\s*(\d+)\s*[\/.-]\s*(\d+)/);
  if(reiwa){ const y=2018+Number(reiwa[1]); return `${y}-${String(reiwa[2]).padStart(2,'0')}-${String(reiwa[3]).padStart(2,'0')}`; }
  const m=s.match(/(20\d{2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  return '';
}
function pickLine(text, keys){
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const line of lines){
    if(keys.some(k=>line.includes(k))){
      const parts=line.split(/[：:]/);
      if(parts.length>1) return parts.slice(1).join(':').trim();
      for(const k of keys){ const idx=line.indexOf(k); if(idx>=0) return line.slice(idx+k.length).replace(/^[\s　・\-]+/,'').trim(); }
    }
  }
  return '';
}
function findPhone(text){
  const m=text.match(/0\d{1,4}[-ー−\s]?\d{1,4}[-ー−\s]?\d{3,4}/);
  return m?m[0].replace(/[ー−\s]/g,'-'):'';
}
function findDateNear(text, keys){
  const lines=text.split(/\r?\n/);
  for(const line of lines){
    if(keys.some(k=>line.includes(k))){
      const d=normalizeDateText(line);
      if(d)return d;
      const md=line.match(/(\d{1,2})\s*[月\/]\s*(\d{1,2})/);
      if(md){
        const y=new Date().getFullYear();
        return `${y}-${String(md[1]).padStart(2,'0')}-${String(md[2]).padStart(2,'0')}`;
      }
    }
  }
  return '';
}
function findDateTimeNear(text, keys){
  const d=findDateNear(text,keys);
  if(!d)return '';
  const lines=text.split(/\r?\n/);
  let hour='10', min='00';
  for(const line of lines){
    if(keys.some(k=>line.includes(k))){
      const tm=line.match(/(\d{1,2})\s*[:時]\s*(\d{1,2})?/);
      if(tm){hour=String(tm[1]).padStart(2,'0'); min=String(tm[2]||0).padStart(2,'0');}
    }
  }
  return `${d}T${hour}:${min}`;
}
function extractFields(text){
  const set=(id,val)=>{ if(val && !$(id).value) $(id).value=val; };
  set('property',pickLine(text,['物件名','建物名','マンション名']));
  set('room',pickLine(text,['号室','部屋番号']));
  set('tenantName',pickLine(text,['借主名','契約者名','賃借人名','契約者']));
  set('residentName',pickLine(text,['入居者名','入居者']));
  set('phone',findPhone(text));
  set('attendee',pickLine(text,['立会者','立ち会い者','立会い者']));
  set('inspectionDate',findDateTimeNear(text,['立会希望日','立会希望日時','立ち会い希望日','立会日']));
  set('moveoutDate',findDateNear(text,['退去予定日','退去日','明渡予定日']));
  set('cancelDate',findDateNear(text,['解約予定日','解約日','契約終了日']));
  generateMail();
}
$('reparseBtn').onclick=()=>extractFields($('ocrText').value);

$('ocrInput').onchange=async e=>{
  const file=e.target.files[0]; if(!file)return;
  $('ocrPreview').innerHTML='';
  const img=document.createElement('img'); img.src=URL.createObjectURL(file); $('ocrPreview').appendChild(img);
  $('ocrStatus').textContent='OCR処理中です…';
  try{
    const { data:{ text } } = await Tesseract.recognize(file,'jpn+eng',{
      logger:m=>{ if(m.status==='recognizing text') $('ocrStatus').textContent=`OCR処理中… ${Math.round((m.progress||0)*100)}%`; }
    });
    $('ocrText').value=text;
    extractFields(text);
    $('ocrStatus').textContent='OCRが完了しました。読取結果を確認・修正してください。';
  }catch(err){
    console.error(err);
    $('ocrStatus').textContent='OCRに失敗しました。画像を撮り直すか、OCR全文欄へ手入力してください。';
  }
};

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

renderVendors(); generateMail();
