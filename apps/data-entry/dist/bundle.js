/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as P,useRef as J,useState as j}from"react";import{useAuth as te,useOrgUnitBinding as ne,useOnlineStatus as re,useDerApi as ae,ScreenCard as se,StatusPill as oe}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function ie(){let r=te(),e=ne(),o=re(),s=ae(),[t,n]=j("custom"),[a,c]=j([]),[i,d]=j(""),[l,m]=j(""),[u,f]=j(""),[h,T]=j(""),[w,$]=j({kind:"idle"}),[E,D]=j(null),C=J(null),[U,V]=j({}),I=J({}),[O,X]=j([]);P(()=>{let g=!1;return(async()=>{try{let y=await s.listDataSets();if(g)return;let S=(y.dataSets??[]).map(x=>({id:x.id,label:x.displayName??x.name??x.id,periodType:x.periodType,formType:x.formType})).sort((x,F)=>x.label.localeCompare(F.label));c(S)}catch{}})(),()=>{g=!0}},[]),P(()=>{if(i.trim()===""){D(null);return}let g=!1;return(async()=>{try{let y=await s.getDataSetMeta(i.trim());if(g)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";D({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),n(S?"custom":"structured")}catch{g||D(null)}})(),()=>{g=!0}},[i]),P(()=>{if(t!=="custom"||!E?.hasCustomForm||!E.formId)return;let g=C.current;if(!g)return;let y=!1;return(async()=>{$({kind:"submitting"});try{let S=await s.getDataSetFormMetadata(i.trim());if(y)return;let x="";if(E.formType==="CUSTOM"&&E.formId?x=(await s.getDataEntryFormHtml(E.formId)).htmlCode??"":E.formType==="SECTION"&&(x=le(S)),y)return;let F=await s.listValidationRules(i.trim()).catch(()=>({validationRules:[]}));if(y)return;let B=(S.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(_=>({id:_.id,name:_.name??_.id}))}));X(B);let N={};for(let b of B)b.options[0]&&(N[b.id]=b.options[0].id);V(N),I.current=N,g.replaceChildren();for(let[b,_]of[["selectedDataSetId",i.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let k=document.createElement("input");k.type="hidden",k.id=b,k.value=_,g.appendChild(k)}for(let[b,_]of Object.entries(N)){let k=document.createElement("input");k.type="hidden",k.id=`category-${b}`,k.value=_,k.setAttribute("data-der-category",b),g.appendChild(k)}let A=document.createElement("div");A.id="contentDiv",g.appendChild(A),me({dataSetId:i.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:S,aocSelections:N,validationRules:F.validationRules??[]});for(let b of ce)Y(b);for(let b of de)document.querySelector(`script[data-der-custom-form="${b}"]`)||await z(b);ge(),await Se(A,x),await ve(A,i.trim(),l.trim(),e.orgUnitUid??"",s),fe(A,()=>i.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...I.current}),s),ye(A),$({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(S){$({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[t,E,i,l,e.orgUnitUid]);let Z=e.bound&&i.trim()!==""&&l.trim()!==""&&u.trim()!==""&&h.trim()!==""&&w.kind!=="submitting";async function ee(g){g.preventDefault(),$({kind:"submitting"});try{await s.submitAggregate({dataSet:i,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:u,value:h}]}),$({kind:"ok",message:`Submitted ${u}=${h} for ${l}.`}),f(""),T("")}catch(y){$({kind:"error",message:y.message??"Submission failed"})}}let Q=l.trim()!=="",M=i.trim()!=="",H=M&&Q&&e.bound;return v(se,{title:"Aggregate data entry",actions:p(oe,{tone:o.isOnline?"success":"warning",children:o.isOnline?"online":`offline (${o.queuedCount} queued)`}),children:[p("style",{children:_e}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:i,onChange:g=>{d(g.target.value),m("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),a.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",E?.periodType?`\xB7 ${E.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:je(E?.periodType,l,m)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:r.displayName})]})]}),w.kind==="ok"&&p("div",{style:Ee,"data-test":"de-ok",children:w.message}),w.kind==="error"&&p("div",{style:ke,"data-test":"de-err",children:w.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!M&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&M&&!Q&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",E?.formType==="SECTION"?"section":"data entry"," form."]}),H&&t==="structured"&&v("form",{onSubmit:ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:u,onChange:g=>f(g.target.value),style:R})]}),v("label",{children:["Value",p("input",{value:h,onChange:g=>T(g.target.value),inputMode:"decimal",style:R})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!Z,style:xe,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),H&&t==="custom"&&v("div",{className:"der-de-form-card",children:[O.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(O.length,3)}, 1fr)`,gap:12,marginBottom:12},children:O.map(g=>v("label",{children:[g.name,p("select",{value:U[g.id]??"",onChange:y=>{let S={...U,[g.id]:y.target.value};V(S),I.current=S,pe(C.current,S)},style:R,children:g.options.map(y=>p("option",{value:y.id,children:y.name},y.id))})]},g.id))}),p("div",{ref:C,"data-test":"der-de-custom-form",className:"der-de-custom-form"}),p("div",{className:"der-de-form-actions",children:p("button",{type:"button",onClick:()=>be(C.current,$),style:$e,"data-test":"de-validate-btn",children:"Validate"})})]})]})}var de=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ce=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function le(r){let e={};for(let a of r.dataSetElements??[])a.dataElement&&(e[a.dataElement.id]=a.dataElement);let o={};for(let a of r.indicators??[])o[a.id]=a;let s=(r.sections??[]).slice().sort((a,c)=>(a.sortOrder??0)-(c.sortOrder??0)),t=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let a of s){let c=new Set;for(let d of a.greyedFields??[])d.dataElement?.id&&d.categoryOptionCombo?.id&&c.add(`${d.dataElement.id}:${d.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${t(a.name??"")}</h3>`);let i=new Map;for(let d of a.dataElements??[]){let l=e[d.id];if(!l?.categoryCombo)continue;let m=l.categoryCombo.id,u=i.get(m);u||(u={cc:l.categoryCombo,des:[]},i.set(m,u)),u.des.push(l)}for(let d of i.values()){let l=d.cc.categoryOptionCombos??[],m=d.cc.categories??[];n.push('<table class="sectionTable" cellspacing="0">');let u=ue(m,l);if(n.push("<thead>"),u.length>0)for(let f=0;f<u.length;f++){n.push("<tr>"),f===0&&n.push(`<th class="dataElementCell" rowspan="${u.length}">`+t(d.cc.name??"Data element")+"</th>");for(let h of u[f]??[])n.push(`<th colspan="${h.span}">${t(h.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${t(d.cc.name??"Data element")}</th>`);for(let f of l)n.push(`<th>${t(f.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let f of d.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let h of l){let T=`${f.id}-${h.id}-val`;c.has(`${f.id}:${h.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${t(T)}" name="${t(T)}" dataelementid="${t(f.id)}" optioncomboid="${t(h.id)}"></td>`)}n.push("</tr>")}for(let f of a.indicators??[]){let h=o[f.id];h&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${t(h.name??h.id)}</td>`),n.push(`<td colspan="${l.length}"><input type="text" name="indicator" indicatorid="${t(h.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table>")}}return n.join(`
`)}function ue(r,e){if(r.length===0)return[];let o=r.map(t=>t.categoryOptions?.length??0);if(o.some(t=>t===0))return[];let s=[];for(let t=0;t<r.length;t++){let n=[],a=1;for(let i=t+1;i<r.length;i++)a*=o[i]??1;let c=1;for(let i=0;i<t;i++)c*=o[i]??1;for(let i=0;i<c;i++)for(let d of r[t]?.categoryOptions??[])n.push({label:d.name??d.id,span:a});s.push(n)}return s}function me(r){let e=globalThis;e.dhis2=e.dhis2??{};let o=e.dhis2;o.de=o.de??{};let s=o.de;s.currentDataSetId=r.dataSetId,s.currentOrganisationUnitId=r.orgUnitId,s.currentPeriodId=r.periodId,s.currentCategorySelections={...r.aocSelections??{}};let t=r.meta??{},n={},a={};if(t.categoryCombo){a[t.categoryCombo.id]=t.categoryCombo;for(let m of t.categoryCombo.categories??[])n[m.id]=m}s.categories=n,s.categoryCombos=a;let c={},i={};for(let m of t.dataSetElements??[]){let u=m.dataElement;u&&(c[u.id]=u,u.optionSet&&(i[u.optionSet.id]=u.optionSet),u.categoryCombo&&(a[u.categoryCombo.id]=u.categoryCombo))}s.dataElements=c,s.optionSets=i;let d={};for(let m of t.indicators??[])d[m.id]={explodedNumerator:m.numerator,denominator:m.denominator,factor:m.indicatorType?.factor??1};s.indicatorFormulas=d;let l={};for(let m of r.validationRules??[])l[m.id]=m;s.validationRules=l,s.lockExceptions=[],s.emptyOrganisationUnits=[],s.significantZeros=[],s.dataSets={[t.id]:{id:t.id,name:t.name??t.displayName??"",periodType:t.periodType,categoryCombo:t.categoryCombo?.id,periodId:r.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,o.shim=o.shim??{},o.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ge(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(e,o)=>{o.xhrFields={...o.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let e=r.dhis2.period;e.format="yyyy-mm-dd",e.calendar=r.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function pe(r,e){if(!r)return;for(let[s,t]of Object.entries(e)){let n=r.querySelector(`input[data-der-category="${s}"]`);n||(n=document.createElement("input"),n.type="hidden",n.id=`category-${s}`,n.setAttribute("data-der-category",s),r.appendChild(n)),n.value=t}let o=globalThis;o.dhis2?.de&&(o.dhis2.de.currentCategorySelections={...e})}function fe(r,e,o,s,t,n){let a=l=>{let m=/^(.+)-(.+)-val$/.exec(l);return m?{de:m[1],coc:m[2]}:null},c=new WeakMap,i=r.querySelectorAll('input[name$="-val"]');for(let l of Array.from(i))c.set(l,l.value);let d=async l=>{let m=l.target;if(!m||m.tagName!=="INPUT")return;let u=m.getAttribute("name")??"",f=a(u);if(!f)return;let h=e(),T=o(),w=s();if(!h||!T||!w)return;let $=m.value;if(c.get(m)!==$){q(m,"saving");try{await n.submitAggregate({dataSet:h,period:T,orgUnit:w,attributeOptionComboSelections:t(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:$}]}),c.set(m,$),q(m,"saved")}catch{q(m,"error")}}};r.addEventListener("blur",l=>{d(l)},!0)}function ye(r){r.addEventListener("keydown",e=>{let o=e;if(o.key!=="Enter")return;let s=o.target;if(!(s instanceof HTMLInputElement))return;let t=s.getAttribute("name")??"",n=/^(.+)-(.+)-val$/.exec(t);if(!n)return;o.preventDefault();let a=n[2],c=Array.from(r.querySelectorAll(`input[name$="-${a}-val"]`)),i=c.indexOf(s);if(i===-1)return;let d=c[i+(o.shiftKey?-1:1)];d?.focus(),d instanceof HTMLInputElement&&d.select()})}function be(r,e){if(!r)return;let s=globalThis.dhis2?.de?.dataElements??{},t=Array.from(r.querySelectorAll('input[name$="-val"]')),n=[];for(let a of t){a.style.outline="";let c=a.value.trim();if(c==="")continue;let i=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");if(!i)continue;let d=i[1],l=s[d],m=l?.valueType??"TEXT",u=he(c,m);u&&(a.style.outline="2px solid #a93232",n.push(`${l?.valueType?"":"(unknown DE) "}${d}: ${u}`))}n.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${t.length} cells OK.`}):e({kind:"error",message:`Validation found ${n.length} issue${n.length===1?"":"s"}. First: ${n[0]}`})}function he(r,e){let o=Number(r),s=Number.isInteger(o);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(o))return"must be a number";break}switch(e){case"INTEGER":if(!s)return"must be an integer";break;case"INTEGER_POSITIVE":if(!s||o<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!s||o>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!s||o<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(o<0||o>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(o<0||o>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function q(r,e){let o=e==="saving"?"#b9860a":e==="saved"?"#1a8754":"#a93232";r.style.outline=`2px solid ${o}`,r.style.transition="outline 150ms",e==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function ve(r,e,o,s,t){if(!e||!o||!s)return;let n;try{n=(await t.readAggregateValues(s,o,2e3)).dataValues??[]}catch{return}for(let a of n){let c=a.dataElement,i=a.categoryOptionCombo,d=a.value;if(!c||!i||d==null)continue;let l=r.querySelector(`input[name="${c}-${i}-val"]`);l&&(l.value=d)}}function z(r){return new Promise((e,o)=>{let s=document.createElement("script");s.src=r,s.async=!1,s.setAttribute("data-der-custom-form",r),s.onload=()=>e(),s.onerror=()=>o(new Error(`failed to load ${r}`)),document.head.appendChild(s)})}function Y(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=r,e.setAttribute("data-der-custom-form",r),document.head.appendChild(e)}function G(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Se(r,e){let o=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let t of Array.from(o.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let n=t.getAttribute("href")??"";n&&Y(G(n))}else{let n=document.createElement("style");n.textContent=t.textContent??"",n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n)}t.remove()}let s=[];for(let t of Array.from(o.querySelectorAll("script"))){let n=t.getAttribute("src");n?s.push({src:G(n)}):s.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(o.body.childNodes))r.appendChild(document.adoptNode(t));for(let t of s)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await z(t.src);else if(t.code){let n=document.createElement("script");n.textContent=t.code,n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n),n.remove()}}var R={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},xe={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},$e={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Ee={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},ke={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function je(r,e,o){let s={...R},t=Te(r);if(t.length===0)return p("input",{value:e,onChange:u=>o(u.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:s});let n=[...t];if(e&&!n.some(u=>u.id===e)){let u=we(r,e)??e;n.unshift({id:e,label:u})}let a=t[0]?.id??null,c=n.findIndex(u=>u.id===e),i=c===-1||c<n.length-1||!!r,d=e!==""&&(c>0||e!==a),l=()=>{if(!r)return;let u=c>=0&&c<n.length-1?n[c+1]?.id??"":W(r,e||a||"",-1);u&&o(u)},m=()=>{if(!r||!e||e===a)return;let u=c>0?n[c-1]?.id??"":W(r,e,1);u&&o(u)};return v("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!i,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:e,onChange:u=>o(u.target.value),style:s,children:[p("option",{value:"",children:"Select a period\u2026"}),n.map(u=>p("option",{value:u.id,children:u.label},u.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:m,disabled:!d,className:"der-de-period-btn",children:"\u25B6"})]})}function W(r,e,o){let s=t=>String(t).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(e))return"";let t=Number(e.slice(0,4)),n=Number(e.slice(4,6))-1,a=Number(e.slice(6,8)),c=new Date(t,n,a+o);return`${c.getFullYear()}${s(c.getMonth()+1)}${s(c.getDate())}`}case"Weekly":{let t=/^(\d{4})W(\d{1,2})$/.exec(e);if(!t)return"";let n=Number(t[1]),a=Number(t[2])+o;return a<1?(n-=1,a=L(n)):a>L(n)&&(n+=1,a=1),`${n}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let t=Number(e.slice(0,4)),n=Number(e.slice(4,6))-1,a=t*12+n+o;return`${Math.floor(a/12)}${s((a%12+12)%12+1)}`}case"BiMonthly":{let t=/^(\d{4})(\d{2})B$/.exec(e);if(!t)return"";let n=Number(t[1]),a=Number(t[2])+o;return a<1?(n-=1,a=6):a>6&&(n+=1,a=1),`${n}${s(a)}B`}case"Quarterly":{let t=/^(\d{4})Q(\d)$/.exec(e);if(!t)return"";let n=Number(t[1]),a=Number(t[2])+o;return a<1?(n-=1,a=4):a>4&&(n+=1,a=1),`${n}Q${a}`}case"SixMonthly":{let t=/^(\d{4})S(\d)$/.exec(e);if(!t)return"";let n=Number(t[1]),a=Number(t[2])+o;return a<1?(n-=1,a=2):a>2&&(n+=1,a=1),`${n}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+o):"";default:return""}}function we(r,e){let o=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(e);return s?`${s[1]} W${String(s[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let s=Number(e.slice(4,6))-1;return`${o[s]??""} ${e.slice(0,4)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(e);if(!s)return null;let t=(Number(s[2])-1)*2;return`${o[t]}\u2013${o[t+1]} ${s[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(e);return s?`${s[1]} ${s[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Te(r){let e=new Date,o=e.getFullYear(),s=e.getMonth(),t=a=>String(a).padStart(2,"0"),n=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":{let a=[];for(let c=0;c<30;c++){let i=new Date(e);i.setDate(i.getDate()-c);let d=`${i.getFullYear()}${t(i.getMonth()+1)}${t(i.getDate())}`,l=`${i.getFullYear()}-${t(i.getMonth()+1)}-${t(i.getDate())}`;a.push({id:d,label:l})}return a}case"Weekly":{let a=[],c=K(e),i=c.year,d=c.week;for(let l=0;l<12;l++)a.push({id:`${i}W${d}`,label:`${i} W${t(d)}`}),d-=1,d<1&&(i-=1,d=L(i));return a}case"Monthly":{let a=[];for(let c=0;c<24;c++){let i=o,d=s,l=i*12+d-c,m=Math.floor(l/12),u=(l%12+12)%12;a.push({id:`${m}${t(u+1)}`,label:`${n[u]} ${m}`})}return a}case"BiMonthly":{let a=[],c=Math.floor(s/2)+1,i=o,d=c;for(let l=0;l<12;l++){let m=(d-1)*2;a.push({id:`${i}${t(d)}B`,label:`${n[m]}\u2013${n[m+1]} ${i}`}),d-=1,d<1&&(i-=1,d=6)}return a}case"Quarterly":{let a=[],c=Math.floor(s/3)+1,i=o,d=c;for(let l=0;l<8;l++)a.push({id:`${i}Q${d}`,label:`${i} Q${d}`}),d-=1,d<1&&(i-=1,d=4);return a}case"SixMonthly":{let a=[],c=s<6?1:2,i=o,d=c;for(let l=0;l<6;l++)a.push({id:`${i}S${d}`,label:`${i} ${d===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),d-=1,d<1&&(i-=1,d=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let c=0;c<10;c++){let i=o-c;a.push({id:String(i),label:String(i)})}return a}default:return[]}}function K(r){let e=new Date(r.getFullYear(),r.getMonth(),r.getDate()),o=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-o);let s=new Date(e.getFullYear(),0,1),n=Math.round((e.getTime()-s.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((n+1)/7)}}function L(r){return K(new Date(r,11,28)).week}var _e=`
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
.der-de-period-nav {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  width: 100%;
}
.der-de-period-nav select {
  flex: 1 1 auto;
}
.der-de-period-btn {
  background: #fff;
  border: 1px solid #d7dde5;
  color: #2c6693;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 2px;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  background: #e4edf6;
}
.der-de-period-btn:disabled {
  color: #c0c7d2;
  cursor: not-allowed;
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
.der-de-form-card .der-de-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef0f3;
  gap: 8px;
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
`;export{ie as default};
