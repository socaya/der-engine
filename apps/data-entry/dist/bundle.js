/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as F,useRef as z,useState as T}from"react";import{useAuth as ie,useOrgUnitBinding as oe,useOnlineStatus as de,useDerApi as ce,ScreenCard as le,StatusPill as ue}from"@der/app-sdk";import{jsx as p,jsxs as E}from"react/jsx-runtime";function me(){let r=ie(),e=oe(),d=de(),o=ce(),[s,a]=T("custom"),[n,i]=T([]),[t,l]=T(""),[c,u]=T(""),[m,v]=T(""),[f,h]=T(""),[x,k]=T({kind:"idle"}),[C,O]=T(null),R=z(null),[H,Q]=T({}),I=z({}),[M,ne]=T([]);F(()=>{let g=!1;return(async()=>{try{let y=await o.listDataSets();if(g)return;let $=(y.dataSets??[]).map(S=>({id:S.id,label:S.displayName??S.name??S.id,periodType:S.periodType,formType:S.formType})).sort((S,j)=>S.label.localeCompare(j.label));i($)}catch{}})(),()=>{g=!0}},[]),F(()=>{if(t.trim()===""){O(null);return}let g=!1;return(async()=>{try{let y=await o.getDataSetMeta(t.trim());if(g)return;let $=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";O({hasCustomForm:$,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),a($?"custom":"structured")}catch{g||O(null)}})(),()=>{g=!0}},[t]),F(()=>{if(s!=="custom"||!C?.hasCustomForm||C.formType==="CUSTOM"&&!C.formId)return;let g=R.current;if(!g)return;let y=!1;return(async()=>{k({kind:"submitting"});try{let $=await o.getDataSetFormMetadata(t.trim());if(y)return;let S=await fe($,o);if(y)return;let j="";if(C.formType==="CUSTOM"&&C.formId){try{j=(await o.getDataEntryFormHtml(C.formId)).htmlCode??""}catch(b){j="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}j.trim()||(j=Y(S))}else C.formType==="SECTION"&&(j=Y(S));if(y)return;let se=await o.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(y)return;let W=(S.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(N=>({id:N.id,name:N.name??N.id}))}));ne(W);let _={};for(let b of W)b.options[0]&&(_[b.id]=b.options[0].id);Q(_),I.current=_,g.replaceChildren();for(let[b,N]of[["selectedDataSetId",t.trim()],["selectedPeriodId",c.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let w=document.createElement("input");w.type="hidden",w.id=b,w.value=N,g.appendChild(w)}for(let[b,N]of Object.entries(_)){let w=document.createElement("input");w.type="hidden",w.id=`category-${b}`,w.value=N,w.setAttribute("data-der-category",b),g.appendChild(w)}let A=document.createElement("div");A.id="contentDiv",g.appendChild(A),be({dataSetId:t.trim(),periodId:c.trim(),orgUnitId:e.orgUnitUid??"",meta:S,aocSelections:_,validationRules:se.validationRules??[]});for(let b of pe)ee(b);for(let b of ge)document.querySelector(`script[data-der-custom-form="${b}"]`)||await Z(b);he(),await ke(A,j),await $e(A,t.trim(),c.trim(),e.orgUnitUid??"",o),Ee(A,()=>t.trim(),()=>c.trim(),()=>e.orgUnitUid??"",()=>({...I.current}),o),Se(A),k({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch($){k({kind:"error",message:`custom form failed to render: ${$.message}`})}})(),()=>{y=!0}},[s,C,t,c,e.orgUnitUid]);let re=e.bound&&t.trim()!==""&&c.trim()!==""&&m.trim()!==""&&f.trim()!==""&&x.kind!=="submitting";async function ae(g){g.preventDefault(),k({kind:"submitting"});try{await o.submitAggregate({dataSet:t,period:c,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:f}]}),k({kind:"ok",message:`Submitted ${m}=${f} for ${c}.`}),v(""),h("")}catch(y){k({kind:"error",message:y.message??"Submission failed"})}}let J=c.trim()!=="",P=t.trim()!=="",G=P&&J&&e.bound;return E(le,{title:"Aggregate data entry",actions:p(ue,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[p("style",{children:De}),E("div",{className:"der-de-context",children:[E("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),E("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),E("select",{className:"der-de-select",value:t,onChange:g=>{l(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),n.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),E("div",{className:"der-de-chip",children:[E("span",{className:"der-de-chip-label",children:["Period ",C?.periodType?`\xB7 ${C.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Ae(C?.periodType,c,u)})]}),E("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:r.displayName})]})]}),x.kind==="ok"&&p("div",{style:je,"data-test":"de-ok",children:x.message}),x.kind==="error"&&p("div",{style:Ne,"data-test":"de-err",children:x.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!P&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&P&&!J&&E("div",{className:"der-de-placeholder",children:["Pick a period to load the ",C?.formType==="SECTION"?"section":"data entry"," form."]}),G&&s==="structured"&&E("form",{onSubmit:ae,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[E("label",{children:["Data element UID",p("input",{value:m,onChange:g=>v(g.target.value),style:D})]}),E("label",{children:["Value",p("input",{value:f,onChange:g=>h(g.target.value),inputMode:"decimal",style:D})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!re,style:we,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),G&&s==="custom"&&E("div",{className:"der-de-form-card",children:[M.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(M.length,3)}, 1fr)`,gap:12,marginBottom:12},children:M.map(g=>E("label",{children:[g.name,p("select",{value:H[g.id]??"",onChange:y=>{let $={...H,[g.id]:y.target.value};Q($),I.current=$,ve(R.current,$)},style:D,children:g.options.map(y=>p("option",{value:y.id,children:y.name},y.id))})]},g.id))}),p("div",{ref:R,"data-test":"der-de-custom-form",className:"der-de-custom-form"}),p("div",{className:"der-de-form-actions",children:p("button",{type:"button",onClick:()=>xe(R.current,k),style:Te,"data-test":"de-validate-btn",children:"Validate"})})]})]})}var ge=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],pe=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],U=null,q=null,L=null;async function fe(r,e){U||(U=e.listAllDataElements().then(i=>new Map(i.map(t=>[t.id,t])))),q||(q=e.listAllCategoryCombos().then(i=>new Map(i.map(t=>[t.id,t])))),L||(L=e.listAllCategoryOptionCombos().then(i=>{let t=new Map;for(let l of i){let c=l.categoryCombo?.id;if(!c)continue;let u=t.get(c);u?u.push(l):t.set(c,[l])}return t}));let[d,o,s]=await Promise.all([U,q,L]),a=i=>{if(!i?.id)return;let t=o.get(i.id),l=s.get(i.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:l.map(c=>({id:c.id,name:c.name??c.displayName})),categories:(t.categories??[]).map(c=>({id:c.id}))}:i},n=i=>{let t=d.get(i.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:i};return{...r,categoryCombo:a(r.categoryCombo)??r.categoryCombo,dataSetElements:(r.dataSetElements??[]).map(i=>({...i,dataElement:i.dataElement?n(i.dataElement):void 0})),sections:(r.sections??[]).map(i=>({...i,dataElements:(i.dataElements??[]).map(t=>n(t))}))}}function Y(r){let e={};for(let i of r.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let d={};for(let i of r.indicators??[])d[i.id]=i;let o=(r.sections??[]).slice().sort((i,t)=>(i.sortOrder??0)-(t.sortOrder??0));if(!o.some(i=>(i.dataElements?.length??0)>0)){let i=(r.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);o=[{id:r.id,name:r.displayName??r.name??"Data entry",sortOrder:0,dataElements:i,indicators:[],greyedFields:[]}]}let a=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let i of o){let t=new Set;for(let c of i.greyedFields??[])c.dataElement?.id&&c.categoryOptionCombo?.id&&t.add(`${c.dataElement.id}:${c.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${a(i.name??"")}</h3>`);let l=new Map;for(let c of i.dataElements??[]){let u=e[c.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,v=l.get(m);v||(v={cc:u.categoryCombo,des:[]},l.set(m,v)),v.des.push(u)}for(let c of l.values()){let u=c.cc.categoryOptionCombos??[],m=c.cc.categories??[];n.push('<table class="sectionTable" cellspacing="0">');let v=ye(m,u);if(n.push("<thead>"),v.length>0)for(let f=0;f<v.length;f++){n.push("<tr>"),f===0&&n.push(`<th class="dataElementCell" rowspan="${v.length}">`+a(c.cc.name??"Data element")+"</th>");for(let h of v[f]??[])n.push(`<th colspan="${h.span}">${a(h.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${a(c.cc.name??"Data element")}</th>`);for(let f of u)n.push(`<th>${a(f.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let f of c.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${a(f.id)}-cell">`+a(f.formName??f.name??f.id)+"</td>");for(let h of u){let x=`${f.id}-${h.id}-val`;t.has(`${f.id}:${h.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${a(x)}" name="${a(x)}" dataelementid="${a(f.id)}" optioncomboid="${a(h.id)}"></td>`)}n.push("</tr>")}for(let f of i.indicators??[]){let h=d[f.id];h&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${a(h.name??h.id)}</td>`),n.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(h.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table>")}}return n.join(`
`)}function ye(r,e){if(r.length===0)return[];let d=r.map(s=>s.categoryOptions?.length??0);if(d.some(s=>s===0))return[];let o=[];for(let s=0;s<r.length;s++){let a=[],n=1;for(let t=s+1;t<r.length;t++)n*=d[t]??1;let i=1;for(let t=0;t<s;t++)i*=d[t]??1;for(let t=0;t<i;t++)for(let l of r[s]?.categoryOptions??[])a.push({label:l.name??l.id,span:n});o.push(a)}return o}function be(r){let e=globalThis;e.dhis2=e.dhis2??{};let d=e.dhis2;d.de=d.de??{};let o=d.de;o.currentDataSetId=r.dataSetId,o.currentOrganisationUnitId=r.orgUnitId,o.currentPeriodId=r.periodId,o.currentCategorySelections={...r.aocSelections??{}};let s=r.meta??{},a={},n={};if(s.categoryCombo){n[s.categoryCombo.id]=s.categoryCombo;for(let u of s.categoryCombo.categories??[])a[u.id]=u}o.categories=a,o.categoryCombos=n;let i={},t={};for(let u of s.dataSetElements??[]){let m=u.dataElement;m&&(i[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(n[m.categoryCombo.id]=m.categoryCombo))}o.dataElements=i,o.optionSets=t;let l={};for(let u of s.indicators??[])l[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};o.indicatorFormulas=l;let c={};for(let u of r.validationRules??[])c[u.id]=u;o.validationRules=c,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[s.id]:{id:s.id,name:s.name??s.displayName??"",periodType:s.periodType,categoryCombo:s.categoryCombo?.id,periodId:r.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function he(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(e,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let e=r.dhis2.period;e.format="yyyy-mm-dd",e.calendar=r.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function ve(r,e){if(!r)return;for(let[o,s]of Object.entries(e)){let a=r.querySelector(`input[data-der-category="${o}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${o}`,a.setAttribute("data-der-category",o),r.appendChild(a)),a.value=s}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...e})}function Ee(r,e,d,o,s,a){let n=c=>{let u=/^(.+)-(.+)-val$/.exec(c);return u?{de:u[1],coc:u[2]}:null},i=new WeakMap,t=r.querySelectorAll('input[name$="-val"]');for(let c of Array.from(t))i.set(c,c.value);let l=async c=>{let u=c.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",v=n(m);if(!v)return;let f=e(),h=d(),x=o();if(!f||!h||!x)return;let k=u.value;if(i.get(u)!==k){B(u,"saving");try{await a.submitAggregate({dataSet:f,period:h,orgUnit:x,attributeOptionComboSelections:s(),dataValues:[{dataElement:v.de,categoryOptionCombo:v.coc,value:k}]}),i.set(u,k),B(u,"saved")}catch{B(u,"error")}}};r.addEventListener("blur",c=>{l(c)},!0)}function Se(r){r.addEventListener("keydown",e=>{let d=e;if(d.key!=="Enter")return;let o=d.target;if(!(o instanceof HTMLInputElement))return;let s=o.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(s);if(!a)return;d.preventDefault();let n=a[2],i=Array.from(r.querySelectorAll(`input[name$="-${n}-val"]`)),t=i.indexOf(o);if(t===-1)return;let l=i[t+(d.shiftKey?-1:1)];l?.focus(),l instanceof HTMLInputElement&&l.select()})}function xe(r,e){if(!r)return;let o=globalThis.dhis2?.de?.dataElements??{},s=Array.from(r.querySelectorAll('input[name$="-val"]')),a=[];for(let n of s){n.style.outline="";let i=n.value.trim();if(i==="")continue;let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!t)continue;let l=t[1],c=o[l],u=c?.valueType??"TEXT",m=Ce(i,u);m&&(n.style.outline="2px solid #a93232",a.push(`${c?.valueType?"":"(unknown DE) "}${l}: ${m}`))}a.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${s.length} cells OK.`}):e({kind:"error",message:`Validation found ${a.length} issue${a.length===1?"":"s"}. First: ${a[0]}`})}function Ce(r,e){let d=Number(r),o=Number.isInteger(d);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function B(r,e){let d=e==="saving"?"#b9860a":e==="saved"?"#1a8754":"#a93232";r.style.outline=`2px solid ${d}`,r.style.transition="outline 150ms",e==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function $e(r,e,d,o,s){if(!e||!d||!o)return;let a;try{a=(await s.readAggregateValues(o,d,2e3)).dataValues??[]}catch{return}for(let n of a){let i=n.dataElement,t=n.categoryOptionCombo,l=n.value;if(!i||!t||l==null)continue;let c=r.querySelector(`input[name="${i}-${t}-val"]`);c&&(c.value=l)}}function Z(r){return new Promise((e,d)=>{let o=document.createElement("script");o.src=r,o.async=!1,o.setAttribute("data-der-custom-form",r),o.onload=()=>e(),o.onerror=()=>d(new Error(`failed to load ${r}`)),document.head.appendChild(o)})}function ee(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=r,e.setAttribute("data-der-custom-form",r),document.head.appendChild(e)}function K(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function ke(r,e){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let s of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(s.tagName==="LINK"){let a=s.getAttribute("href")??"";a&&ee(K(a))}else{let a=document.createElement("style");a.textContent=s.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}s.remove()}let o=[];for(let s of Array.from(d.querySelectorAll("script"))){let a=s.getAttribute("src");a?o.push({src:K(a)}):o.push({code:s.textContent??""}),s.remove()}for(let s of Array.from(d.body.childNodes))r.appendChild(document.adoptNode(s));for(let s of o)if(s.src)document.querySelector(`script[data-der-custom-form="${s.src}"]`)||await Z(s.src);else if(s.code){let a=document.createElement("script");a.textContent=s.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var D={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},we={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Te={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},je={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Ne={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Ae(r,e,d){let o={...D},s=Re(r);if(s.length===0)return p("input",{value:e,onChange:m=>d(m.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:o});let a=[...s];if(e&&!a.some(m=>m.id===e)){let m=_e(r,e)??e;a.unshift({id:e,label:m})}let n=s[0]?.id??null,i=a.findIndex(m=>m.id===e),t=i===-1||i<a.length-1||!!r,l=e!==""&&(i>0||e!==n),c=()=>{if(!r)return;let m=i>=0&&i<a.length-1?a[i+1]?.id??"":X(r,e||n||"",-1);m&&d(m)},u=()=>{if(!r||!e||e===n)return;let m=i>0?a[i-1]?.id??"":X(r,e,1);m&&d(m)};return E("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:c,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),E("select",{value:e,onChange:m=>d(m.target.value),style:o,children:[p("option",{value:"",children:"Select a period\u2026"}),a.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!l,className:"der-de-period-btn",children:"\u25B6"})]})}function X(r,e,d){let o=s=>String(s).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(e))return"";let s=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),i=new Date(s,a,n+d);return`${i.getFullYear()}${o(i.getMonth()+1)}${o(i.getDate())}`}case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(e);if(!s)return"";let a=Number(s[1]),n=Number(s[2])+d;return n<1?(a-=1,n=V(a)):n>V(a)&&(a+=1,n=1),`${a}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let s=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,n=s*12+a+d;return`${Math.floor(n/12)}${o((n%12+12)%12+1)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(e);if(!s)return"";let a=Number(s[1]),n=Number(s[2])+d;return n<1?(a-=1,n=6):n>6&&(a+=1,n=1),`${a}${o(n)}B`}case"Quarterly":{let s=/^(\d{4})Q(\d)$/.exec(e);if(!s)return"";let a=Number(s[1]),n=Number(s[2])+d;return n<1?(a-=1,n=4):n>4&&(a+=1,n=1),`${a}Q${n}`}case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(e);if(!s)return"";let a=Number(s[1]),n=Number(s[2])+d;return n<1?(a-=1,n=2):n>2&&(a+=1,n=1),`${a}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+d):"";default:return""}}function _e(r,e){let d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${d[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let s=(Number(o[2])-1)*2;return`${d[s]}\u2013${d[s+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Re(r){let e=new Date,d=e.getFullYear(),o=e.getMonth(),s=n=>String(n).padStart(2,"0"),a=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":{let n=[];for(let i=0;i<30;i++){let t=new Date(e);t.setDate(t.getDate()-i);let l=`${t.getFullYear()}${s(t.getMonth()+1)}${s(t.getDate())}`,c=`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}`;n.push({id:l,label:c})}return n}case"Weekly":{let n=[],i=te(e),t=i.year,l=i.week;for(let c=0;c<12;c++)n.push({id:`${t}W${l}`,label:`${t} W${s(l)}`}),l-=1,l<1&&(t-=1,l=V(t));return n}case"Monthly":{let n=[];for(let i=0;i<24;i++){let t=d,l=o,c=t*12+l-i,u=Math.floor(c/12),m=(c%12+12)%12;n.push({id:`${u}${s(m+1)}`,label:`${a[m]} ${u}`})}return n}case"BiMonthly":{let n=[],i=Math.floor(o/2)+1,t=d,l=i;for(let c=0;c<12;c++){let u=(l-1)*2;n.push({id:`${t}${s(l)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),l-=1,l<1&&(t-=1,l=6)}return n}case"Quarterly":{let n=[],i=Math.floor(o/3)+1,t=d,l=i;for(let c=0;c<8;c++)n.push({id:`${t}Q${l}`,label:`${t} Q${l}`}),l-=1,l<1&&(t-=1,l=4);return n}case"SixMonthly":{let n=[],i=o<6?1:2,t=d,l=i;for(let c=0;c<6;c++)n.push({id:`${t}S${l}`,label:`${t} ${l===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),l-=1,l<1&&(t-=1,l=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let i=0;i<10;i++){let t=d-i;n.push({id:String(t),label:String(t)})}return n}default:return[]}}function te(r){let e=new Date(r.getFullYear(),r.getMonth(),r.getDate()),d=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-d);let o=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function V(r){return te(new Date(r,11,28)).week}var De=`
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
`;export{me as default};
