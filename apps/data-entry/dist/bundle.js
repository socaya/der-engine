/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as F,useRef as B,useState as _}from"react";import{useAuth as Z,useOrgUnitBinding as ee,useOnlineStatus as te,useDerApi as re,ScreenCard as ne,StatusPill as oe}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function ae(){let r=Z(),t=ee(),c=te(),a=re(),[e,n]=_("custom"),[i,l]=_([]),[o,s]=_(""),[d,u]=_(""),[g,f]=_(""),[h,A]=_(""),[C,x]=_({kind:"idle"}),[k,R]=_(null),I=B(null),[U,Q]=_({}),N=B({}),[O,G]=_([]);F(()=>{let m=!1;return(async()=>{try{let y=await a.listDataSets();if(m)return;let S=(y.dataSets??[]).map(j=>({id:j.id,label:j.displayName??j.name??j.id,periodType:j.periodType,formType:j.formType})).sort((j,q)=>j.label.localeCompare(q.label));l(S)}catch{}})(),()=>{m=!0}},[]),F(()=>{if(o.trim()===""){R(null);return}let m=!1;return(async()=>{try{let y=await a.getDataSetMeta(o.trim());if(m)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";R({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),n(S?"custom":"structured")}catch{m||R(null)}})(),()=>{m=!0}},[o]),F(()=>{if(e!=="custom"||!k?.hasCustomForm||!k.formId)return;let m=I.current;if(!m)return;let y=!1;return(async()=>{x({kind:"submitting"});try{let S=await a.getDataSetFormMetadata(o.trim());if(y)return;let j="";if(k.formType==="CUSTOM"&&k.formId?j=(await a.getDataEntryFormHtml(k.formId)).htmlCode??"":k.formType==="SECTION"&&(j=de(S)),y)return;let q=await a.listValidationRules(o.trim()).catch(()=>({validationRules:[]}));if(y)return;let H=(S.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));G(H);let $={};for(let b of H)b.options[0]&&($[b.id]=b.options[0].id);Q($),N.current=$,m.replaceChildren();for(let[b,T]of[["selectedDataSetId",o.trim()],["selectedPeriodId",d.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let w=document.createElement("input");w.type="hidden",w.id=b,w.value=T,m.appendChild(w)}for(let[b,T]of Object.entries($)){let w=document.createElement("input");w.type="hidden",w.id=`category-${b}`,w.value=T,w.setAttribute("data-der-category",b),m.appendChild(w)}let E=document.createElement("div");E.id="contentDiv",m.appendChild(E),le({dataSetId:o.trim(),periodId:d.trim(),orgUnitId:t.orgUnitUid??"",meta:S,aocSelections:$,validationRules:q.validationRules??[]});for(let b of se)J(b);for(let b of ie)document.querySelector(`script[data-der-custom-form="${b}"]`)||await Y(b);ue(),await fe(E,j),await pe(E,o.trim(),d.trim(),t.orgUnitUid??"",a),ge(E,()=>o.trim(),()=>d.trim(),()=>t.orgUnitUid??"",()=>({...N.current}),a),x({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(S){x({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[e,k,o,d,t.orgUnitUid]);let X=t.bound&&o.trim()!==""&&d.trim()!==""&&g.trim()!==""&&h.trim()!==""&&C.kind!=="submitting";async function K(m){m.preventDefault(),x({kind:"submitting"});try{await a.submitAggregate({dataSet:o,period:d,orgUnit:t.orgUnitUid,dataValues:[{dataElement:g,value:h}]}),x({kind:"ok",message:`Submitted ${g}=${h} for ${d}.`}),f(""),A("")}catch(y){x({kind:"error",message:y.message??"Submission failed"})}}let L=d.trim()!=="",M=o.trim()!=="",V=M&&L&&t.bound;return v(ne,{title:"Aggregate data entry",actions:p(oe,{tone:c.isOnline?"success":"warning",children:c.isOnline?"online":`offline (${c.queuedCount} queued)`}),children:[p("style",{children:ke}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:t.orgUnitPath||t.orgUnitUid||"",children:t.orgUnitDisplayName||t.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:o,onChange:m=>{s(m.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),i.map(m=>p("option",{value:m.id,children:m.label},m.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",k?.periodType?`\xB7 ${k.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:ve(k?.periodType,d,u)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:r.displayName})]})]}),C.kind==="ok"&&p("div",{style:be,"data-test":"de-ok",children:C.message}),C.kind==="error"&&p("div",{style:he,"data-test":"de-err",children:C.message}),!t.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!M&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&M&&!L&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),V&&e==="structured"&&v("form",{onSubmit:K,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:g,onChange:m=>f(m.target.value),style:D})]}),v("label",{children:["Value",p("input",{value:h,onChange:m=>A(m.target.value),inputMode:"decimal",style:D})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!X,style:ye,children:C.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),V&&e==="custom"&&v("div",{className:"der-de-form-card",children:[O.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(O.length,3)}, 1fr)`,gap:12,marginBottom:12},children:O.map(m=>v("label",{children:[m.name,p("select",{value:U[m.id]??"",onChange:y=>{let S={...U,[m.id]:y.target.value};Q(S),N.current=S,me(I.current,S)},style:D,children:m.options.map(y=>p("option",{value:y.id,children:y.name},y.id))})]},m.id))}),p("div",{ref:I,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var ie=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],se=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function de(r){let t={};for(let i of r.dataSetElements??[])i.dataElement&&(t[i.dataElement.id]=i.dataElement);let c={};for(let i of r.indicators??[])c[i.id]=i;let a=(r.sections??[]).slice().sort((i,l)=>(i.sortOrder??0)-(l.sortOrder??0)),e=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let i of a){let l=new Set;for(let s of i.greyedFields??[])s.dataElement?.id&&s.categoryOptionCombo?.id&&l.add(`${s.dataElement.id}:${s.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${e(i.name??"")}</h3>`);let o=new Map;for(let s of i.dataElements??[]){let d=t[s.id];if(!d?.categoryCombo)continue;let u=d.categoryCombo.id,g=o.get(u);g||(g={cc:d.categoryCombo,des:[]},o.set(u,g)),g.des.push(d)}for(let s of o.values()){let d=s.cc.categoryOptionCombos??[],u=s.cc.categories??[];n.push('<table class="sectionTable" cellspacing="0">');let g=ce(u,d);if(n.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){n.push("<tr>"),f===0&&n.push(`<th class="dataElementCell" rowspan="${g.length}">`+e(s.cc.name??"Data element")+"</th>");for(let h of g[f]??[])n.push(`<th colspan="${h.span}">${e(h.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${e(s.cc.name??"Data element")}</th>`);for(let f of d)n.push(`<th>${e(f.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let f of s.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${e(f.id)}-cell">`+e(f.formName??f.name??f.id)+"</td>");for(let h of d){let A=`${f.id}-${h.id}-val`;l.has(`${f.id}:${h.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${e(A)}" name="${e(A)}" dataelementid="${e(f.id)}" optioncomboid="${e(h.id)}"></td>`)}n.push("</tr>")}for(let f of i.indicators??[]){let h=c[f.id];h&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${e(h.name??h.id)}</td>`),n.push(`<td colspan="${d.length}"><input type="text" name="indicator" indicatorid="${e(h.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table>")}}return n.join(`
`)}function ce(r,t){if(r.length===0)return[];let c=r.map(e=>e.categoryOptions?.length??0);if(c.some(e=>e===0))return[];let a=[];for(let e=0;e<r.length;e++){let n=[],i=1;for(let o=e+1;o<r.length;o++)i*=c[o]??1;let l=1;for(let o=0;o<e;o++)l*=c[o]??1;for(let o=0;o<l;o++)for(let s of r[e]?.categoryOptions??[])n.push({label:s.name??s.id,span:i});a.push(n)}return a}function le(r){let t=globalThis;t.dhis2=t.dhis2??{};let c=t.dhis2;c.de=c.de??{};let a=c.de;a.currentDataSetId=r.dataSetId,a.currentOrganisationUnitId=r.orgUnitId,a.currentPeriodId=r.periodId,a.currentCategorySelections={...r.aocSelections??{}};let e=r.meta??{},n={},i={};if(e.categoryCombo){i[e.categoryCombo.id]=e.categoryCombo;for(let u of e.categoryCombo.categories??[])n[u.id]=u}a.categories=n,a.categoryCombos=i;let l={},o={};for(let u of e.dataSetElements??[]){let g=u.dataElement;g&&(l[g.id]=g,g.optionSet&&(o[g.optionSet.id]=g.optionSet),g.categoryCombo&&(i[g.categoryCombo.id]=g.categoryCombo))}a.dataElements=l,a.optionSets=o;let s={};for(let u of e.indicators??[])s[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};a.indicatorFormulas=s;let d={};for(let u of r.validationRules??[])d[u.id]=u;a.validationRules=d,a.lockExceptions=[],a.emptyOrganisationUnits=[],a.significantZeros=[],a.dataSets={[e.id]:{id:e.id,name:e.name??e.displayName??"",periodType:e.periodType,categoryCombo:e.categoryCombo?.id,periodId:r.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,c.shim=c.shim??{},c.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ue(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(t,c)=>{c.xhrFields={...c.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let t=r.dhis2.period;t.format="yyyy-mm-dd",t.calendar=r.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function me(r,t){if(!r)return;for(let[a,e]of Object.entries(t)){let n=r.querySelector(`input[data-der-category="${a}"]`);n||(n=document.createElement("input"),n.type="hidden",n.id=`category-${a}`,n.setAttribute("data-der-category",a),r.appendChild(n)),n.value=e}let c=globalThis;c.dhis2?.de&&(c.dhis2.de.currentCategorySelections={...t})}function ge(r,t,c,a,e,n){let i=d=>{let u=/^(.+)-(.+)-val$/.exec(d);return u?{de:u[1],coc:u[2]}:null},l=new WeakMap,o=r.querySelectorAll('input[name$="-val"]');for(let d of Array.from(o))l.set(d,d.value);let s=async d=>{let u=d.target;if(!u||u.tagName!=="INPUT")return;let g=u.getAttribute("name")??"",f=i(g);if(!f)return;let h=t(),A=c(),C=a();if(!h||!A||!C)return;let x=u.value;if(l.get(u)!==x){P(u,"saving");try{await n.submitAggregate({dataSet:h,period:A,orgUnit:C,attributeOptionComboSelections:e(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:x}]}),l.set(u,x),P(u,"saved")}catch{P(u,"error")}}};r.addEventListener("blur",d=>{s(d)},!0)}function P(r,t){let c=t==="saving"?"#b9860a":t==="saved"?"#1a8754":"#a93232";r.style.outline=`2px solid ${c}`,r.style.transition="outline 150ms",t==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function pe(r,t,c,a,e){if(!t||!c||!a)return;let n;try{n=(await e.readAggregateValues(a,c,2e3)).dataValues??[]}catch{return}for(let i of n){let l=i.dataElement,o=i.categoryOptionCombo,s=i.value;if(!l||!o||s==null)continue;let d=r.querySelector(`input[name="${l}-${o}-val"]`);d&&(d.value=s)}}function Y(r){return new Promise((t,c)=>{let a=document.createElement("script");a.src=r,a.async=!1,a.setAttribute("data-der-custom-form",r),a.onload=()=>t(),a.onerror=()=>c(new Error(`failed to load ${r}`)),document.head.appendChild(a)})}function J(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=r,t.setAttribute("data-der-custom-form",r),document.head.appendChild(t)}function z(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function fe(r,t){let c=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let e of Array.from(c.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let n=e.getAttribute("href")??"";n&&J(z(n))}else{let n=document.createElement("style");n.textContent=e.textContent??"",n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n)}e.remove()}let a=[];for(let e of Array.from(c.querySelectorAll("script"))){let n=e.getAttribute("src");n?a.push({src:z(n)}):a.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(c.body.childNodes))r.appendChild(document.adoptNode(e));for(let e of a)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await Y(e.src);else if(e.code){let n=document.createElement("script");n.textContent=e.code,n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n),n.remove()}}var D={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ye={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},be={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},he={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function ve(r,t,c){let a={...D},e=Se(r);return e.length===0?p("input",{value:t,onChange:n=>c(n.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:a}):v("select",{value:t,onChange:n=>c(n.target.value),style:a,children:[p("option",{value:"",children:"Select a period\u2026"}),e.map(n=>p("option",{value:n.id,children:n.label},n.id))]})}function Se(r){let t=new Date,c=t.getFullYear(),a=t.getMonth(),e=i=>String(i).padStart(2,"0"),n=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":{let i=[];for(let l=0;l<30;l++){let o=new Date(t);o.setDate(o.getDate()-l);let s=`${o.getFullYear()}${e(o.getMonth()+1)}${e(o.getDate())}`,d=`${o.getFullYear()}-${e(o.getMonth()+1)}-${e(o.getDate())}`;i.push({id:s,label:d})}return i}case"Weekly":{let i=[],l=W(t),o=l.year,s=l.week;for(let d=0;d<12;d++)i.push({id:`${o}W${s}`,label:`${o} W${e(s)}`}),s-=1,s<1&&(o-=1,s=je(o));return i}case"Monthly":{let i=[];for(let l=0;l<24;l++){let o=c,s=a,d=o*12+s-l,u=Math.floor(d/12),g=(d%12+12)%12;i.push({id:`${u}${e(g+1)}`,label:`${n[g]} ${u}`})}return i}case"BiMonthly":{let i=[],l=Math.floor(a/2)+1,o=c,s=l;for(let d=0;d<12;d++){let u=(s-1)*2;i.push({id:`${o}${e(s)}B`,label:`${n[u]}\u2013${n[u+1]} ${o}`}),s-=1,s<1&&(o-=1,s=6)}return i}case"Quarterly":{let i=[],l=Math.floor(a/3)+1,o=c,s=l;for(let d=0;d<8;d++)i.push({id:`${o}Q${s}`,label:`${o} Q${s}`}),s-=1,s<1&&(o-=1,s=4);return i}case"SixMonthly":{let i=[],l=a<6?1:2,o=c,s=l;for(let d=0;d<6;d++)i.push({id:`${o}S${s}`,label:`${o} ${s===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),s-=1,s<1&&(o-=1,s=2);return i}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let i=[];for(let l=0;l<10;l++){let o=c-l;i.push({id:String(o),label:String(o)})}return i}default:return[]}}function W(r){let t=new Date(r.getFullYear(),r.getMonth(),r.getDate()),c=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-c);let a=new Date(t.getFullYear(),0,1),n=Math.round((t.getTime()-a.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((n+1)/7)}}function je(r){return W(new Date(r,11,28)).week}var ke=`
.der-de-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
}
.der-de-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-chip-signed {
  background: #f3f5f7;
}
.der-de-chip-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
}
.der-de-chip-value {
  font-size: 13px;
  color: #212934;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.der-de-select,
.der-de-period-wrap > * {
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid #d7dde5;
  border-radius: 2px;
  background: #fff;
  color: #212934;
  width: 100%;
  font-family: inherit;
}
.der-de-select:focus,
.der-de-period-wrap > *:focus {
  outline: none;
  border-color: #2c6693;
}
.der-de-placeholder {
  padding: 32px 16px;
  text-align: center;
  color: #6e7a8a;
  font-size: 14px;
  background: #fff;
  border: 1px dashed #d7dde5;
  border-radius: 3px;
}
.der-de-form-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0 20px;
  font-size: 13px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #d7dde5;
  padding: 6px 8px;
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable th {
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #f8fafc;
  min-width: 220px;
}
.der-de-form-card .sectionTable .indicatorRow td {
  background: #fcf7e6;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f3;
  color: #9aa3b0;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 2px 4px;
  font-size: 13px;
  color: #212934;
  font-family: inherit;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 1px solid #2c6693;
  background: #fff;
}
.der-de-form-card h3.formSection {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: #1f4d70;
  border-bottom: 1px solid #d7dde5;
  padding-bottom: 4px;
}
`;export{ae as default};
