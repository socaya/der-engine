/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as F,useRef as G,useState as _}from"react";import{useAuth as J,useOrgUnitBinding as X,useOnlineStatus as K,useDerApi as Z,ScreenCard as ee,StatusPill as te}from"@der/app-sdk";import{jsx as c,jsxs as v}from"react/jsx-runtime";function re(){let o=J(),r=X(),s=K(),n=Z(),[e,t]=_("custom"),[a,h]=_([]),[i,g]=_(""),[u,f]=_(""),[l,y]=_(""),[b,E]=_(""),[w,T]=_({kind:"idle"}),[x,R]=_(null),D=G(null),[P,U]=_({}),[I,B]=_([]);F(()=>{let d=!1;return(async()=>{try{let m=await n.listDataSets();if(d)return;let j=(m.dataSets??[]).map(S=>({id:S.id,label:S.displayName??S.name??S.id,periodType:S.periodType,formType:S.formType})).sort((S,O)=>S.label.localeCompare(O.label));h(j)}catch{}})(),()=>{d=!0}},[n]),F(()=>{if(i.trim()===""){R(null);return}let d=!1;return(async()=>{try{let m=await n.getDataSetMeta(i.trim());if(d)return;let j=!!m.dataEntryForm&&m.formType==="CUSTOM"||m.formType==="SECTION";R({hasCustomForm:j,formId:m.dataEntryForm?.id,displayName:m.displayName??m.name,formType:m.formType,periodType:m.periodType}),t(j?"custom":"structured")}catch{d||R(null)}})(),()=>{d=!0}},[i,n]),F(()=>{if(e!=="custom"||!x?.hasCustomForm||!x.formId)return;let d=D.current;if(!d)return;let m=!1;return(async()=>{T({kind:"submitting"});try{let j=await n.getDataSetFormMetadata(i.trim());if(m)return;let S="";if(x.formType==="CUSTOM"&&x.formId?S=(await n.getDataEntryFormHtml(x.formId)).htmlCode??"":x.formType==="SECTION"&&(S=ae(j)),m)return;let O=await n.listValidationRules(i.trim()).catch(()=>({validationRules:[]}));if(m)return;let V=(j.categoryCombo?.categories??[]).filter(p=>(p.categoryOptions?.length??0)>1).map(p=>({id:p.id,name:p.name??p.id,options:(p.categoryOptions??[]).map(C=>({id:C.id,name:C.name??C.id}))}));B(V);let A={};for(let p of V)p.options[0]&&(A[p.id]=p.options[0].id);U(A),d.replaceChildren();for(let[p,C]of[["selectedDataSetId",i.trim()],["selectedPeriodId",u.trim()],["selectedOrganisationUnitId",r.orgUnitUid??""]]){let k=document.createElement("input");k.type="hidden",k.id=p,k.value=C,d.appendChild(k)}for(let[p,C]of Object.entries(A)){let k=document.createElement("input");k.type="hidden",k.id=`category-${p}`,k.value=C,k.setAttribute("data-der-category",p),d.appendChild(k)}let q=document.createElement("div");q.id="contentDiv",d.appendChild(q),ie({dataSetId:i.trim(),periodId:u.trim(),orgUnitId:r.orgUnitUid??"",meta:j,aocSelections:A,validationRules:O.validationRules??[]});for(let p of ne)z(p);for(let p of oe)document.querySelector(`script[data-der-custom-form="${p}"]`)||await H(p);de(),await le(q,S),T({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(j){T({kind:"error",message:`custom form failed to render: ${j.message}`})}})(),()=>{m=!0}},[e,x,i,u,r.orgUnitUid,n]);let W=r.bound&&i.trim()!==""&&u.trim()!==""&&l.trim()!==""&&b.trim()!==""&&w.kind!=="submitting";async function Y(d){d.preventDefault(),T({kind:"submitting"});try{await n.submitAggregate({dataSet:i,period:u,orgUnit:r.orgUnitUid,dataValues:[{dataElement:l,value:b}]}),T({kind:"ok",message:`Submitted ${l}=${b} for ${u}.`}),y(""),E("")}catch(m){T({kind:"error",message:m.message??"Submission failed"})}}let Q=u.trim()!=="",N=i.trim()!=="",M=N&&Q&&r.bound;return v(ee,{title:"Aggregate data entry",actions:c(te,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[c("style",{children:fe}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Organisation unit"}),c("span",{className:"der-de-chip-value",title:r.orgUnitPath||r.orgUnitUid||"",children:r.orgUnitDisplayName||r.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:i,onChange:d=>{g(d.target.value),f("")},"data-test":"der-de-dataset-picker",children:[c("option",{value:"",children:"Select a data set\u2026"}),a.map(d=>c("option",{value:d.id,children:d.label},d.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",x?.periodType?`\xB7 ${x.periodType}`:""]}),c("span",{className:"der-de-period-wrap",children:ge(x?.periodType,u,f)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[c("span",{className:"der-de-chip-label",children:"Signed in"}),c("span",{className:"der-de-chip-value",children:o.displayName})]})]}),w.kind==="ok"&&c("div",{style:ue,"data-test":"de-ok",children:w.message}),w.kind==="error"&&c("div",{style:pe,"data-test":"de-err",children:w.message}),!r.bound&&c("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),r.bound&&!N&&c("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),r.bound&&N&&!Q&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),M&&e==="structured"&&v("form",{onSubmit:Y,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",c("input",{value:l,onChange:d=>y(d.target.value),style:$})]}),v("label",{children:["Value",c("input",{value:b,onChange:d=>E(d.target.value),inputMode:"decimal",style:$})]}),c("div",{style:{gridColumn:"1 / -1"},children:c("button",{type:"submit",disabled:!W,style:me,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),M&&e==="custom"&&v("div",{className:"der-de-form-card",children:[I.length>0&&c("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(I.length,3)}, 1fr)`,gap:12,marginBottom:12},children:I.map(d=>v("label",{children:[d.name,c("select",{value:P[d.id]??"",onChange:m=>{let j={...P,[d.id]:m.target.value};U(j),ce(D.current,j)},style:$,children:d.options.map(m=>c("option",{value:m.id,children:m.name},m.id))})]},d.id))}),c("div",{ref:D,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var oe=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ne=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function ae(o){let r={};for(let a of o.dataSetElements??[])a.dataElement&&(r[a.dataElement.id]=a.dataElement);let s={};for(let a of o.indicators??[])s[a.id]=a;let n=(o.sections??[]).slice().sort((a,h)=>(a.sortOrder??0)-(h.sortOrder??0)),e=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),t=[];for(let a of n){let h=new Set;for(let g of a.greyedFields??[])g.dataElement?.id&&g.categoryOptionCombo?.id&&h.add(`${g.dataElement.id}:${g.categoryOptionCombo.id}`);t.push(`<h3 class="formSection">${e(a.name??"")}</h3>`);let i=new Map;for(let g of a.dataElements??[]){let u=r[g.id];if(!u?.categoryCombo)continue;let f=u.categoryCombo.id,l=i.get(f);l||(l={cc:u.categoryCombo,des:[]},i.set(f,l)),l.des.push(u)}for(let g of i.values()){let u=g.cc.categoryOptionCombos??[],f=g.cc.categories??[];t.push('<table class="sectionTable" cellspacing="0">');let l=se(f,u);if(t.push("<thead>"),l.length>0)for(let y=0;y<l.length;y++){t.push("<tr>"),y===0&&t.push(`<th class="dataElementCell" rowspan="${l.length}">`+e(g.cc.name??"Data element")+"</th>");for(let b of l[y]??[])t.push(`<th colspan="${b.span}">${e(b.label)}</th>`);t.push("</tr>")}else{t.push("<tr>"),t.push(`<th class="dataElementCell">${e(g.cc.name??"Data element")}</th>`);for(let y of u)t.push(`<th>${e(y.name??"")}</th>`);t.push("</tr>")}t.push("</thead><tbody>");for(let y of g.des){t.push("<tr>"),t.push(`<td class="dataElementCell" id="${e(y.id)}-cell">`+e(y.formName??y.name??y.id)+"</td>");for(let b of u){let E=`${y.id}-${b.id}-val`;h.has(`${y.id}:${b.id}`)?t.push('<td class="greyed">\u2014</td>'):t.push(`<td><input type="text" id="${e(E)}" name="${e(E)}" dataelementid="${e(y.id)}" optioncomboid="${e(b.id)}"></td>`)}t.push("</tr>")}for(let y of a.indicators??[]){let b=s[y.id];b&&(t.push('<tr class="indicatorRow">'),t.push(`<td class="dataElementCell">${e(b.name??b.id)}</td>`),t.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${e(b.id)}" readonly></td>`),t.push("</tr>"))}t.push("</tbody></table>")}}return t.join(`
`)}function se(o,r){if(o.length===0)return[];let s=o.map(e=>e.categoryOptions?.length??0);if(s.some(e=>e===0))return[];let n=[];for(let e=0;e<o.length;e++){let t=[],a=1;for(let i=e+1;i<o.length;i++)a*=s[i]??1;let h=1;for(let i=0;i<e;i++)h*=s[i]??1;for(let i=0;i<h;i++)for(let g of o[e]?.categoryOptions??[])t.push({label:g.name??g.id,span:a});n.push(t)}return n}function ie(o){let r=globalThis;r.dhis2=r.dhis2??{};let s=r.dhis2;s.de=s.de??{};let n=s.de;n.currentDataSetId=o.dataSetId,n.currentOrganisationUnitId=o.orgUnitId,n.currentPeriodId=o.periodId,n.currentCategorySelections={...o.aocSelections??{}};let e=o.meta??{},t={},a={};if(e.categoryCombo){a[e.categoryCombo.id]=e.categoryCombo;for(let f of e.categoryCombo.categories??[])t[f.id]=f}n.categories=t,n.categoryCombos=a;let h={},i={};for(let f of e.dataSetElements??[]){let l=f.dataElement;l&&(h[l.id]=l,l.optionSet&&(i[l.optionSet.id]=l.optionSet),l.categoryCombo&&(a[l.categoryCombo.id]=l.categoryCombo))}n.dataElements=h,n.optionSets=i;let g={};for(let f of e.indicators??[])g[f.id]={explodedNumerator:f.numerator,denominator:f.denominator,factor:f.indicatorType?.factor??1};n.indicatorFormulas=g;let u={};for(let f of o.validationRules??[])u[f.id]=f;n.validationRules=u,n.lockExceptions=[],n.emptyOrganisationUnits=[],n.significantZeros=[],n.dataSets={[e.id]:{id:e.id,name:e.name??e.displayName??"",periodType:e.periodType,categoryCombo:e.categoryCombo?.id,periodId:o.periodId}},r.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function de(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(r,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let r=o.dhis2.period;r.format="yyyy-mm-dd",r.calendar=o.$.calendars.instance("gregorian"),r.PeriodGenerator&&(r.generator=new r.PeriodGenerator(r.calendar,r.format)),r.DatePicker&&(r.picker=new r.DatePicker(r.calendar,r.format))}}function ce(o,r){if(!o)return;for(let[n,e]of Object.entries(r)){let t=o.querySelector(`input[data-der-category="${n}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${n}`,t.setAttribute("data-der-category",n),o.appendChild(t)),t.value=e}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...r})}function H(o){return new Promise((r,s)=>{let n=document.createElement("script");n.src=o,n.async=!1,n.setAttribute("data-der-custom-form",o),n.onload=()=>r(),n.onerror=()=>s(new Error(`failed to load ${o}`)),document.head.appendChild(n)})}function z(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let r=document.createElement("link");r.rel="stylesheet",r.href=o,r.setAttribute("data-der-custom-form",o),document.head.appendChild(r)}function L(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function le(o,r){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${r}</body></html>`,"text/html");for(let e of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let t=e.getAttribute("href")??"";t&&z(L(t))}else{let t=document.createElement("style");t.textContent=e.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}e.remove()}let n=[];for(let e of Array.from(s.querySelectorAll("script"))){let t=e.getAttribute("src");t?n.push({src:L(t)}):n.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(s.body.childNodes))o.appendChild(document.adoptNode(e));for(let e of n)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await H(e.src);else if(e.code){let t=document.createElement("script");t.textContent=e.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var $={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ue={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},pe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function ge(o,r,s){let n={...$};switch(o){case"Monthly":{let e=r.length===6?`${r.slice(0,4)}-${r.slice(4,6)}`:"";return c("input",{type:"month",value:e,onChange:t=>s(t.target.value.replace("-","")),style:n})}case"Daily":{let e=r.length===8?`${r.slice(0,4)}-${r.slice(4,6)}-${r.slice(6,8)}`:"";return c("input",{type:"date",value:e,onChange:t=>s(t.target.value.replace(/-/g,"")),style:n})}case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(r),t=e?`${e[1]}-W${String(e[2]).padStart(2,"0")}`:"";return c("input",{type:"week",value:t,onChange:a=>{let h=/^(\d{4})-W(\d{2})$/.exec(a.target.value);s(h?`${h[1]}W${h[2]}`:"")},style:n})}case"Yearly":{let e=new Date().getFullYear(),t=[];for(let a=e;a>e-11;a--)t.push(a);return v("select",{value:r,onChange:a=>s(a.target.value),style:n,children:[c("option",{value:"",children:"Pick a year"}),t.map(a=>c("option",{value:String(a),children:a},a))]})}case"Quarterly":{let e=new Date().getFullYear(),t=[];for(let a of[e,e-1])for(let h of[1,2,3,4])t.push(`${a}Q${h}`);return v("select",{value:r,onChange:a=>s(a.target.value),style:n,children:[c("option",{value:"",children:"Pick a quarter"}),t.map(a=>c("option",{value:a,children:a.replace("Q"," Q")},a))]})}default:return c("input",{value:r,onChange:e=>s(e.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:n})}}var fe=`
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
