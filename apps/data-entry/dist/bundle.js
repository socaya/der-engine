/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as F,useRef as G,useState as _}from"react";import{useAuth as X,useOrgUnitBinding as K,useOnlineStatus as Z,useDerApi as ee,ScreenCard as te,StatusPill as re}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function ne(){let n=X(),r=K(),d=Z(),o=ee(),[e,t]=_("custom"),[i,l]=_([]),[a,s]=_(""),[c,g]=_(""),[m,h]=_(""),[b,$]=_(""),[C,A]=_({kind:"idle"}),[k,R]=_(null),N=G(null),[M,P]=_({}),[I,Y]=_([]);F(()=>{let u=!1;return(async()=>{try{let f=await o.listDataSets();if(u)return;let S=(f.dataSets??[]).map(j=>({id:j.id,label:j.displayName??j.name??j.id,periodType:j.periodType,formType:j.formType})).sort((j,q)=>j.label.localeCompare(q.label));l(S)}catch{}})(),()=>{u=!0}},[]),F(()=>{if(a.trim()===""){R(null);return}let u=!1;return(async()=>{try{let f=await o.getDataSetMeta(a.trim());if(u)return;let S=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";R({hasCustomForm:S,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),t(S?"custom":"structured")}catch{u||R(null)}})(),()=>{u=!0}},[a]),F(()=>{if(e!=="custom"||!k?.hasCustomForm||!k.formId)return;let u=N.current;if(!u)return;let f=!1;return(async()=>{A({kind:"submitting"});try{let S=await o.getDataSetFormMetadata(a.trim());if(f)return;let j="";if(k.formType==="CUSTOM"&&k.formId?j=(await o.getDataEntryFormHtml(k.formId)).htmlCode??"":k.formType==="SECTION"&&(j=ie(S)),f)return;let q=await o.listValidationRules(a.trim()).catch(()=>({validationRules:[]}));if(f)return;let V=(S.categoryCombo?.categories??[]).filter(y=>(y.categoryOptions?.length??0)>1).map(y=>({id:y.id,name:y.name??y.id,options:(y.categoryOptions??[]).map(w=>({id:w.id,name:w.name??w.id}))}));Y(V);let T={};for(let y of V)y.options[0]&&(T[y.id]=y.options[0].id);P(T),u.replaceChildren();for(let[y,w]of[["selectedDataSetId",a.trim()],["selectedPeriodId",c.trim()],["selectedOrganisationUnitId",r.orgUnitUid??""]]){let x=document.createElement("input");x.type="hidden",x.id=y,x.value=w,u.appendChild(x)}for(let[y,w]of Object.entries(T)){let x=document.createElement("input");x.type="hidden",x.id=`category-${y}`,x.value=w,x.setAttribute("data-der-category",y),u.appendChild(x)}let E=document.createElement("div");E.id="contentDiv",u.appendChild(E),de({dataSetId:a.trim(),periodId:c.trim(),orgUnitId:r.orgUnitUid??"",meta:S,aocSelections:T,validationRules:q.validationRules??[]});for(let y of oe)B(y);for(let y of ae)document.querySelector(`script[data-der-custom-form="${y}"]`)||await L(y);ce(),await me(E,j),await ue(E,a.trim(),c.trim(),r.orgUnitUid??"",o),A({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(S){A({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{f=!0}},[e,k,a,c,r.orgUnitUid]);let J=r.bound&&a.trim()!==""&&c.trim()!==""&&m.trim()!==""&&b.trim()!==""&&C.kind!=="submitting";async function W(u){u.preventDefault(),A({kind:"submitting"});try{await o.submitAggregate({dataSet:a,period:c,orgUnit:r.orgUnitUid,dataValues:[{dataElement:m,value:b}]}),A({kind:"ok",message:`Submitted ${m}=${b} for ${c}.`}),h(""),$("")}catch(f){A({kind:"error",message:f.message??"Submission failed"})}}let U=c.trim()!=="",O=a.trim()!=="",Q=O&&U&&r.bound;return v(te,{title:"Aggregate data entry",actions:p(re,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[p("style",{children:ve}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:r.orgUnitPath||r.orgUnitUid||"",children:r.orgUnitDisplayName||r.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:a,onChange:u=>{s(u.target.value),g("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),i.map(u=>p("option",{value:u.id,children:u.label},u.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",k?.periodType?`\xB7 ${k.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:ye(k?.periodType,c,g)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:n.displayName})]})]}),C.kind==="ok"&&p("div",{style:pe,"data-test":"de-ok",children:C.message}),C.kind==="error"&&p("div",{style:fe,"data-test":"de-err",children:C.message}),!r.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),r.bound&&!O&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),r.bound&&O&&!U&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),Q&&e==="structured"&&v("form",{onSubmit:W,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:m,onChange:u=>h(u.target.value),style:D})]}),v("label",{children:["Value",p("input",{value:b,onChange:u=>$(u.target.value),inputMode:"decimal",style:D})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!J,style:ge,children:C.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),Q&&e==="custom"&&v("div",{className:"der-de-form-card",children:[I.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(I.length,3)}, 1fr)`,gap:12,marginBottom:12},children:I.map(u=>v("label",{children:[u.name,p("select",{value:M[u.id]??"",onChange:f=>{let S={...M,[u.id]:f.target.value};P(S),le(N.current,S)},style:D,children:u.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},u.id))}),p("div",{ref:N,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var ae=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],oe=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function ie(n){let r={};for(let i of n.dataSetElements??[])i.dataElement&&(r[i.dataElement.id]=i.dataElement);let d={};for(let i of n.indicators??[])d[i.id]=i;let o=(n.sections??[]).slice().sort((i,l)=>(i.sortOrder??0)-(l.sortOrder??0)),e=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),t=[];for(let i of o){let l=new Set;for(let s of i.greyedFields??[])s.dataElement?.id&&s.categoryOptionCombo?.id&&l.add(`${s.dataElement.id}:${s.categoryOptionCombo.id}`);t.push(`<h3 class="formSection">${e(i.name??"")}</h3>`);let a=new Map;for(let s of i.dataElements??[]){let c=r[s.id];if(!c?.categoryCombo)continue;let g=c.categoryCombo.id,m=a.get(g);m||(m={cc:c.categoryCombo,des:[]},a.set(g,m)),m.des.push(c)}for(let s of a.values()){let c=s.cc.categoryOptionCombos??[],g=s.cc.categories??[];t.push('<table class="sectionTable" cellspacing="0">');let m=se(g,c);if(t.push("<thead>"),m.length>0)for(let h=0;h<m.length;h++){t.push("<tr>"),h===0&&t.push(`<th class="dataElementCell" rowspan="${m.length}">`+e(s.cc.name??"Data element")+"</th>");for(let b of m[h]??[])t.push(`<th colspan="${b.span}">${e(b.label)}</th>`);t.push("</tr>")}else{t.push("<tr>"),t.push(`<th class="dataElementCell">${e(s.cc.name??"Data element")}</th>`);for(let h of c)t.push(`<th>${e(h.name??"")}</th>`);t.push("</tr>")}t.push("</thead><tbody>");for(let h of s.des){t.push("<tr>"),t.push(`<td class="dataElementCell" id="${e(h.id)}-cell">`+e(h.formName??h.name??h.id)+"</td>");for(let b of c){let $=`${h.id}-${b.id}-val`;l.has(`${h.id}:${b.id}`)?t.push('<td class="greyed">\u2014</td>'):t.push(`<td><input type="text" id="${e($)}" name="${e($)}" dataelementid="${e(h.id)}" optioncomboid="${e(b.id)}"></td>`)}t.push("</tr>")}for(let h of i.indicators??[]){let b=d[h.id];b&&(t.push('<tr class="indicatorRow">'),t.push(`<td class="dataElementCell">${e(b.name??b.id)}</td>`),t.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${e(b.id)}" readonly></td>`),t.push("</tr>"))}t.push("</tbody></table>")}}return t.join(`
`)}function se(n,r){if(n.length===0)return[];let d=n.map(e=>e.categoryOptions?.length??0);if(d.some(e=>e===0))return[];let o=[];for(let e=0;e<n.length;e++){let t=[],i=1;for(let a=e+1;a<n.length;a++)i*=d[a]??1;let l=1;for(let a=0;a<e;a++)l*=d[a]??1;for(let a=0;a<l;a++)for(let s of n[e]?.categoryOptions??[])t.push({label:s.name??s.id,span:i});o.push(t)}return o}function de(n){let r=globalThis;r.dhis2=r.dhis2??{};let d=r.dhis2;d.de=d.de??{};let o=d.de;o.currentDataSetId=n.dataSetId,o.currentOrganisationUnitId=n.orgUnitId,o.currentPeriodId=n.periodId,o.currentCategorySelections={...n.aocSelections??{}};let e=n.meta??{},t={},i={};if(e.categoryCombo){i[e.categoryCombo.id]=e.categoryCombo;for(let g of e.categoryCombo.categories??[])t[g.id]=g}o.categories=t,o.categoryCombos=i;let l={},a={};for(let g of e.dataSetElements??[]){let m=g.dataElement;m&&(l[m.id]=m,m.optionSet&&(a[m.optionSet.id]=m.optionSet),m.categoryCombo&&(i[m.categoryCombo.id]=m.categoryCombo))}o.dataElements=l,o.optionSets=a;let s={};for(let g of e.indicators??[])s[g.id]={explodedNumerator:g.numerator,denominator:g.denominator,factor:g.indicatorType?.factor??1};o.indicatorFormulas=s;let c={};for(let g of n.validationRules??[])c[g.id]=g;o.validationRules=c,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[e.id]:{id:e.id,name:e.name??e.displayName??"",periodType:e.periodType,categoryCombo:e.categoryCombo?.id,periodId:n.periodId}},r.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ce(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(r,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let r=n.dhis2.period;r.format="yyyy-mm-dd",r.calendar=n.$.calendars.instance("gregorian"),r.PeriodGenerator&&(r.generator=new r.PeriodGenerator(r.calendar,r.format)),r.DatePicker&&(r.picker=new r.DatePicker(r.calendar,r.format))}}function le(n,r){if(!n)return;for(let[o,e]of Object.entries(r)){let t=n.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),n.appendChild(t)),t.value=e}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...r})}async function ue(n,r,d,o,e){if(!r||!d||!o)return;let t;try{t=(await e.readAggregateValues(o,d,2e3)).dataValues??[]}catch{return}for(let i of t){let l=i.dataElement,a=i.categoryOptionCombo,s=i.value;if(!l||!a||s==null)continue;let c=n.querySelector(`input[name="${l}-${a}-val"]`);c&&(c.value=s)}}function L(n){return new Promise((r,d)=>{let o=document.createElement("script");o.src=n,o.async=!1,o.setAttribute("data-der-custom-form",n),o.onload=()=>r(),o.onerror=()=>d(new Error(`failed to load ${n}`)),document.head.appendChild(o)})}function B(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let r=document.createElement("link");r.rel="stylesheet",r.href=n,r.setAttribute("data-der-custom-form",n),document.head.appendChild(r)}function H(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function me(n,r){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${r}</body></html>`,"text/html");for(let e of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let t=e.getAttribute("href")??"";t&&B(H(t))}else{let t=document.createElement("style");t.textContent=e.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}e.remove()}let o=[];for(let e of Array.from(d.querySelectorAll("script"))){let t=e.getAttribute("src");t?o.push({src:H(t)}):o.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(d.body.childNodes))n.appendChild(document.adoptNode(e));for(let e of o)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await L(e.src);else if(e.code){let t=document.createElement("script");t.textContent=e.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var D={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ge={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},pe={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},fe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function ye(n,r,d){let o={...D},e=he(n);return e.length===0?p("input",{value:r,onChange:t=>d(t.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:o}):v("select",{value:r,onChange:t=>d(t.target.value),style:o,children:[p("option",{value:"",children:"Select a period\u2026"}),e.map(t=>p("option",{value:t.id,children:t.label},t.id))]})}function he(n){let r=new Date,d=r.getFullYear(),o=r.getMonth(),e=i=>String(i).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let i=[];for(let l=0;l<30;l++){let a=new Date(r);a.setDate(a.getDate()-l);let s=`${a.getFullYear()}${e(a.getMonth()+1)}${e(a.getDate())}`,c=`${a.getFullYear()}-${e(a.getMonth()+1)}-${e(a.getDate())}`;i.push({id:s,label:c})}return i}case"Weekly":{let i=[],l=z(r),a=l.year,s=l.week;for(let c=0;c<12;c++)i.push({id:`${a}W${s}`,label:`${a} W${e(s)}`}),s-=1,s<1&&(a-=1,s=be(a));return i}case"Monthly":{let i=[];for(let l=0;l<24;l++){let a=d,s=o,c=a*12+s-l,g=Math.floor(c/12),m=(c%12+12)%12;i.push({id:`${g}${e(m+1)}`,label:`${t[m]} ${g}`})}return i}case"BiMonthly":{let i=[],l=Math.floor(o/2)+1,a=d,s=l;for(let c=0;c<12;c++){let g=(s-1)*2;i.push({id:`${a}${e(s)}B`,label:`${t[g]}\u2013${t[g+1]} ${a}`}),s-=1,s<1&&(a-=1,s=6)}return i}case"Quarterly":{let i=[],l=Math.floor(o/3)+1,a=d,s=l;for(let c=0;c<8;c++)i.push({id:`${a}Q${s}`,label:`${a} Q${s}`}),s-=1,s<1&&(a-=1,s=4);return i}case"SixMonthly":{let i=[],l=o<6?1:2,a=d,s=l;for(let c=0;c<6;c++)i.push({id:`${a}S${s}`,label:`${a} ${s===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),s-=1,s<1&&(a-=1,s=2);return i}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let i=[];for(let l=0;l<10;l++){let a=d-l;i.push({id:String(a),label:String(a)})}return i}default:return[]}}function z(n){let r=new Date(n.getFullYear(),n.getMonth(),n.getDate()),d=r.getDay()===0?7:r.getDay();r.setDate(r.getDate()+4-d);let o=new Date(r.getFullYear(),0,1),t=Math.round((r.getTime()-o.getTime())/864e5);return{year:r.getFullYear(),week:Math.ceil((t+1)/7)}}function be(n){return z(new Date(n,11,28)).week}var ve=`
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
`;export{ne as default};
