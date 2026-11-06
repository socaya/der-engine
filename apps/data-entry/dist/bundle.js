/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as F,useRef as G,useState as C}from"react";import{useAuth as J,useOrgUnitBinding as X,useOnlineStatus as K,useDerApi as Z,ScreenCard as ee,StatusPill as te}from"@der/app-sdk";import{jsx as c,jsxs as v}from"react/jsx-runtime";function re(){let n=J(),r=X(),s=K(),o=Z(),[e,t]=C("custom"),[a,p]=C([]),[i,u]=C(""),[l,y]=C(""),[m,h]=C(""),[b,T]=C(""),[w,E]=C({kind:"idle"}),[x,D]=C(null),I=G(null),[P,U]=C({}),[N,B]=C([]);F(()=>{let d=!1;return(async()=>{try{let g=await o.listDataSets();if(d)return;let j=(g.dataSets??[]).map(S=>({id:S.id,label:S.displayName??S.name??S.id,periodType:S.periodType,formType:S.formType})).sort((S,q)=>S.label.localeCompare(q.label));p(j)}catch{}})(),()=>{d=!0}},[o]),F(()=>{if(i.trim()===""){D(null);return}let d=!1;return(async()=>{try{let g=await o.getDataSetMeta(i.trim());if(d)return;let j=!!g.dataEntryForm&&g.formType==="CUSTOM"||g.formType==="SECTION";D({hasCustomForm:j,formId:g.dataEntryForm?.id,displayName:g.displayName??g.name,formType:g.formType,periodType:g.periodType}),t(j?"custom":"structured")}catch{d||D(null)}})(),()=>{d=!0}},[i,o]),F(()=>{if(e!=="custom"||!x?.hasCustomForm||!x.formId)return;let d=I.current;if(!d)return;let g=!1;return(async()=>{E({kind:"submitting"});try{let j=await o.getDataSetFormMetadata(i.trim());if(g)return;let S="";if(x.formType==="CUSTOM"&&x.formId?S=(await o.getDataEntryFormHtml(x.formId)).htmlCode??"":x.formType==="SECTION"&&(S=ae(j)),g)return;let q=await o.listValidationRules(i.trim()).catch(()=>({validationRules:[]}));if(g)return;let M=(j.categoryCombo?.categories??[]).filter(f=>(f.categoryOptions?.length??0)>1).map(f=>({id:f.id,name:f.name??f.id,options:(f.categoryOptions??[]).map(_=>({id:_.id,name:_.name??_.id}))}));B(M);let A={};for(let f of M)f.options[0]&&(A[f.id]=f.options[0].id);U(A),d.replaceChildren();for(let[f,_]of[["selectedDataSetId",i.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",r.orgUnitUid??""]]){let k=document.createElement("input");k.type="hidden",k.id=f,k.value=_,d.appendChild(k)}for(let[f,_]of Object.entries(A)){let k=document.createElement("input");k.type="hidden",k.id=`category-${f}`,k.value=_,k.setAttribute("data-der-category",f),d.appendChild(k)}let $=document.createElement("div");$.id="contentDiv",d.appendChild($),ie({dataSetId:i.trim(),periodId:l.trim(),orgUnitId:r.orgUnitUid??"",meta:j,aocSelections:A,validationRules:q.validationRules??[]});for(let f of oe)z(f);for(let f of ne)document.querySelector(`script[data-der-custom-form="${f}"]`)||await H(f);de(),await me($,S),await le($,i.trim(),l.trim(),r.orgUnitUid??"",o),E({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(j){E({kind:"error",message:`custom form failed to render: ${j.message}`})}})(),()=>{g=!0}},[e,x,i,l,r.orgUnitUid,o]);let W=r.bound&&i.trim()!==""&&l.trim()!==""&&m.trim()!==""&&b.trim()!==""&&w.kind!=="submitting";async function Y(d){d.preventDefault(),E({kind:"submitting"});try{await o.submitAggregate({dataSet:i,period:l,orgUnit:r.orgUnitUid,dataValues:[{dataElement:m,value:b}]}),E({kind:"ok",message:`Submitted ${m}=${b} for ${l}.`}),h(""),T("")}catch(g){E({kind:"error",message:g.message??"Submission failed"})}}let Q=l.trim()!=="",O=i.trim()!=="",V=O&&Q&&r.bound;return v(ee,{title:"Aggregate data entry",actions:c(te,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[c("style",{children:ye}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Organisation unit"}),c("span",{className:"der-de-chip-value",title:r.orgUnitPath||r.orgUnitUid||"",children:r.orgUnitDisplayName||r.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:i,onChange:d=>{u(d.target.value),y("")},"data-test":"der-de-dataset-picker",children:[c("option",{value:"",children:"Select a data set\u2026"}),a.map(d=>c("option",{value:d.id,children:d.label},d.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",x?.periodType?`\xB7 ${x.periodType}`:""]}),c("span",{className:"der-de-period-wrap",children:fe(x?.periodType,l,y)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[c("span",{className:"der-de-chip-label",children:"Signed in"}),c("span",{className:"der-de-chip-value",children:n.displayName})]})]}),w.kind==="ok"&&c("div",{style:ge,"data-test":"de-ok",children:w.message}),w.kind==="error"&&c("div",{style:pe,"data-test":"de-err",children:w.message}),!r.bound&&c("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),r.bound&&!O&&c("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),r.bound&&O&&!Q&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),V&&e==="structured"&&v("form",{onSubmit:Y,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",c("input",{value:m,onChange:d=>h(d.target.value),style:R})]}),v("label",{children:["Value",c("input",{value:b,onChange:d=>T(d.target.value),inputMode:"decimal",style:R})]}),c("div",{style:{gridColumn:"1 / -1"},children:c("button",{type:"submit",disabled:!W,style:ue,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),V&&e==="custom"&&v("div",{className:"der-de-form-card",children:[N.length>0&&c("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(N.length,3)}, 1fr)`,gap:12,marginBottom:12},children:N.map(d=>v("label",{children:[d.name,c("select",{value:P[d.id]??"",onChange:g=>{let j={...P,[d.id]:g.target.value};U(j),ce(I.current,j)},style:R,children:d.options.map(g=>c("option",{value:g.id,children:g.name},g.id))})]},d.id))}),c("div",{ref:I,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var ne=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],oe=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function ae(n){let r={};for(let a of n.dataSetElements??[])a.dataElement&&(r[a.dataElement.id]=a.dataElement);let s={};for(let a of n.indicators??[])s[a.id]=a;let o=(n.sections??[]).slice().sort((a,p)=>(a.sortOrder??0)-(p.sortOrder??0)),e=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),t=[];for(let a of o){let p=new Set;for(let u of a.greyedFields??[])u.dataElement?.id&&u.categoryOptionCombo?.id&&p.add(`${u.dataElement.id}:${u.categoryOptionCombo.id}`);t.push(`<h3 class="formSection">${e(a.name??"")}</h3>`);let i=new Map;for(let u of a.dataElements??[]){let l=r[u.id];if(!l?.categoryCombo)continue;let y=l.categoryCombo.id,m=i.get(y);m||(m={cc:l.categoryCombo,des:[]},i.set(y,m)),m.des.push(l)}for(let u of i.values()){let l=u.cc.categoryOptionCombos??[],y=u.cc.categories??[];t.push('<table class="sectionTable" cellspacing="0">');let m=se(y,l);if(t.push("<thead>"),m.length>0)for(let h=0;h<m.length;h++){t.push("<tr>"),h===0&&t.push(`<th class="dataElementCell" rowspan="${m.length}">`+e(u.cc.name??"Data element")+"</th>");for(let b of m[h]??[])t.push(`<th colspan="${b.span}">${e(b.label)}</th>`);t.push("</tr>")}else{t.push("<tr>"),t.push(`<th class="dataElementCell">${e(u.cc.name??"Data element")}</th>`);for(let h of l)t.push(`<th>${e(h.name??"")}</th>`);t.push("</tr>")}t.push("</thead><tbody>");for(let h of u.des){t.push("<tr>"),t.push(`<td class="dataElementCell" id="${e(h.id)}-cell">`+e(h.formName??h.name??h.id)+"</td>");for(let b of l){let T=`${h.id}-${b.id}-val`;p.has(`${h.id}:${b.id}`)?t.push('<td class="greyed">\u2014</td>'):t.push(`<td><input type="text" id="${e(T)}" name="${e(T)}" dataelementid="${e(h.id)}" optioncomboid="${e(b.id)}"></td>`)}t.push("</tr>")}for(let h of a.indicators??[]){let b=s[h.id];b&&(t.push('<tr class="indicatorRow">'),t.push(`<td class="dataElementCell">${e(b.name??b.id)}</td>`),t.push(`<td colspan="${l.length}"><input type="text" name="indicator" indicatorid="${e(b.id)}" readonly></td>`),t.push("</tr>"))}t.push("</tbody></table>")}}return t.join(`
`)}function se(n,r){if(n.length===0)return[];let s=n.map(e=>e.categoryOptions?.length??0);if(s.some(e=>e===0))return[];let o=[];for(let e=0;e<n.length;e++){let t=[],a=1;for(let i=e+1;i<n.length;i++)a*=s[i]??1;let p=1;for(let i=0;i<e;i++)p*=s[i]??1;for(let i=0;i<p;i++)for(let u of n[e]?.categoryOptions??[])t.push({label:u.name??u.id,span:a});o.push(t)}return o}function ie(n){let r=globalThis;r.dhis2=r.dhis2??{};let s=r.dhis2;s.de=s.de??{};let o=s.de;o.currentDataSetId=n.dataSetId,o.currentOrganisationUnitId=n.orgUnitId,o.currentPeriodId=n.periodId,o.currentCategorySelections={...n.aocSelections??{}};let e=n.meta??{},t={},a={};if(e.categoryCombo){a[e.categoryCombo.id]=e.categoryCombo;for(let y of e.categoryCombo.categories??[])t[y.id]=y}o.categories=t,o.categoryCombos=a;let p={},i={};for(let y of e.dataSetElements??[]){let m=y.dataElement;m&&(p[m.id]=m,m.optionSet&&(i[m.optionSet.id]=m.optionSet),m.categoryCombo&&(a[m.categoryCombo.id]=m.categoryCombo))}o.dataElements=p,o.optionSets=i;let u={};for(let y of e.indicators??[])u[y.id]={explodedNumerator:y.numerator,denominator:y.denominator,factor:y.indicatorType?.factor??1};o.indicatorFormulas=u;let l={};for(let y of n.validationRules??[])l[y.id]=y;o.validationRules=l,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[e.id]:{id:e.id,name:e.name??e.displayName??"",periodType:e.periodType,categoryCombo:e.categoryCombo?.id,periodId:n.periodId}},r.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function de(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(r,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let r=n.dhis2.period;r.format="yyyy-mm-dd",r.calendar=n.$.calendars.instance("gregorian"),r.PeriodGenerator&&(r.generator=new r.PeriodGenerator(r.calendar,r.format)),r.DatePicker&&(r.picker=new r.DatePicker(r.calendar,r.format))}}function ce(n,r){if(!n)return;for(let[o,e]of Object.entries(r)){let t=n.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),n.appendChild(t)),t.value=e}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...r})}async function le(n,r,s,o,e){if(!r||!s||!o)return;let t;try{t=(await e.readAggregateValues(o,s,2e3)).dataValues??[]}catch{return}for(let a of t){let p=a.dataElement,i=a.categoryOptionCombo,u=a.value;if(!p||!i||u==null)continue;let l=n.querySelector(`input[name="${p}-${i}-val"]`);l&&(l.value=u)}}function H(n){return new Promise((r,s)=>{let o=document.createElement("script");o.src=n,o.async=!1,o.setAttribute("data-der-custom-form",n),o.onload=()=>r(),o.onerror=()=>s(new Error(`failed to load ${n}`)),document.head.appendChild(o)})}function z(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let r=document.createElement("link");r.rel="stylesheet",r.href=n,r.setAttribute("data-der-custom-form",n),document.head.appendChild(r)}function L(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function me(n,r){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${r}</body></html>`,"text/html");for(let e of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let t=e.getAttribute("href")??"";t&&z(L(t))}else{let t=document.createElement("style");t.textContent=e.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}e.remove()}let o=[];for(let e of Array.from(s.querySelectorAll("script"))){let t=e.getAttribute("src");t?o.push({src:L(t)}):o.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(s.body.childNodes))n.appendChild(document.adoptNode(e));for(let e of o)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await H(e.src);else if(e.code){let t=document.createElement("script");t.textContent=e.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var R={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ue={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ge={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},pe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function fe(n,r,s){let o={...R};switch(n){case"Monthly":{let e=r.length===6?`${r.slice(0,4)}-${r.slice(4,6)}`:"";return c("input",{type:"month",value:e,onChange:t=>s(t.target.value.replace("-","")),style:o})}case"Daily":{let e=r.length===8?`${r.slice(0,4)}-${r.slice(4,6)}-${r.slice(6,8)}`:"";return c("input",{type:"date",value:e,onChange:t=>s(t.target.value.replace(/-/g,"")),style:o})}case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(r),t=e?`${e[1]}-W${String(e[2]).padStart(2,"0")}`:"";return c("input",{type:"week",value:t,onChange:a=>{let p=/^(\d{4})-W(\d{2})$/.exec(a.target.value);s(p?`${p[1]}W${p[2]}`:"")},style:o})}case"Yearly":{let e=new Date().getFullYear(),t=[];for(let a=e;a>e-11;a--)t.push(a);return v("select",{value:r,onChange:a=>s(a.target.value),style:o,children:[c("option",{value:"",children:"Pick a year"}),t.map(a=>c("option",{value:String(a),children:a},a))]})}case"Quarterly":{let e=new Date().getFullYear(),t=[];for(let a of[e,e-1])for(let p of[1,2,3,4])t.push(`${a}Q${p}`);return v("select",{value:r,onChange:a=>s(a.target.value),style:o,children:[c("option",{value:"",children:"Pick a quarter"}),t.map(a=>c("option",{value:a,children:a.replace("Q"," Q")},a))]})}default:return c("input",{value:r,onChange:e=>s(e.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:o})}}var ye=`
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
`;export{re as default};
