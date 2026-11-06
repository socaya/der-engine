/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as M,useRef as Z,useState as w}from"react";import{useAuth as ge,useOrgUnitBinding as pe,useOnlineStatus as fe,useDerApi as ye,ScreenCard as be,StatusPill as he}from"@der/app-sdk";import{jsx as f,jsxs as v}from"react/jsx-runtime";function ve(){let n=ge(),e=pe(),d=fe(),i=ye(),[o,a]=w("custom"),[r,s]=w([]),[t,l]=w(""),[c,u]=w(""),[m,E]=w(""),[y,h]=w(""),[k,C]=w({kind:"idle"}),[S,U]=w(null),O=Z(null),[G,W]=w({}),F=Z({}),[q,de]=w([]),[T,I]=w(null),[L,Y]=w(!1);M(()=>{let g=!1;return(async()=>{try{let p=await i.listDataSets();if(g)return;let $=(p.dataSets??[]).map(x=>({id:x.id,label:x.displayName??x.name??x.id,periodType:x.periodType,formType:x.formType})).sort((x,N)=>x.label.localeCompare(N.label));s($)}catch{}})(),()=>{g=!0}},[]),M(()=>{if(t.trim()===""){U(null);return}let g=!1;return(async()=>{try{let p=await i.getDataSetMeta(t.trim());if(g)return;let $=!!p.dataEntryForm&&p.formType==="CUSTOM"||p.formType==="SECTION";U({hasCustomForm:$,formId:p.dataEntryForm?.id,displayName:p.displayName??p.name,formType:p.formType,periodType:p.periodType}),a($?"custom":"structured")}catch{g||U(null)}})(),()=>{g=!0}},[t]),M(()=>{if(o!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let g=O.current;if(!g)return;let p=!1;return(async()=>{C({kind:"submitting"});try{let $=await i.getDataSetFormMetadata(t.trim());if(p)return;let x=await Ce($,i);if(p)return;let N="";if(S.formType==="CUSTOM"&&S.formId){try{N=(await i.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(b){N="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}N.trim()||(N=ee(x))}else S.formType==="SECTION"&&(N=ee(x));if(p)return;let me=await i.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(p)return;let X=(x.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(j=>({id:j.id,name:j.name??j.id}))}));de(X);let D={};for(let b of X)b.options[0]&&(D[b.id]=b.options[0].id);W(D),F.current=D,g.replaceChildren();for(let[b,j]of[["selectedDataSetId",t.trim()],["selectedPeriodId",c.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let A=document.createElement("input");A.type="hidden",A.id=b,A.value=j,g.appendChild(A)}for(let[b,j]of Object.entries(D)){let A=document.createElement("input");A.type="hidden",A.id=`category-${b}`,A.value=j,A.setAttribute("data-der-category",b),g.appendChild(A)}let _=document.createElement("div");_.id="contentDiv",g.appendChild(_),ke({dataSetId:t.trim(),periodId:c.trim(),orgUnitId:e.orgUnitUid??"",meta:x,aocSelections:D,validationRules:me.validationRules??[]});for(let b of Se)ie(b);for(let b of Ee)document.querySelector(`script[data-der-custom-form="${b}"]`)||await oe(b);$e(),await Re(_,N),await _e(_,t.trim(),c.trim(),e.orgUnitUid??"",i),Ae(_,()=>t.trim(),()=>c.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),i),Ne(_),C({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch($){C({kind:"error",message:`custom form failed to render: ${$.message}`})}})(),()=>{p=!0}},[o,S,t,c,e.orgUnitUid]);let ce=e.bound&&t.trim()!==""&&c.trim()!==""&&m.trim()!==""&&y.trim()!==""&&k.kind!=="submitting";async function le(g){g.preventDefault(),C({kind:"submitting"});try{await i.submitAggregate({dataSet:t,period:c,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),C({kind:"ok",message:`Submitted ${m}=${y} for ${c}.`}),E(""),h("")}catch(p){C({kind:"error",message:p.message??"Submission failed"})}}let K=c.trim()!=="",B=t.trim()!=="",R=B&&K&&e.bound;M(()=>{if(!R){I(null);return}let g=!1;return(async()=>{try{let p=await i.getCompletion(t.trim(),e.orgUnitUid??"",c.trim());if(g)return;I({completed:!!p.completed,completedAt:p.completedAt})}catch{g||I({completed:!1})}})(),()=>{g=!0}},[t,c,e.orgUnitUid,R]);async function ue(){if(!R||L)return;let g=!T?.completed;Y(!0);try{let p=await i.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:c.trim(),completed:g});I({completed:!!p.completed,completedAt:p.completedAt}),C({kind:"ok",message:p.completed?"Dataset marked complete.":"Dataset reopened."})}catch(p){C({kind:"error",message:`Completion failed: ${p.message}`})}finally{Y(!1)}}return v(be,{title:"Aggregate data entry",actions:f(he,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[f("style",{children:Ue}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[f("span",{className:"der-de-chip-label",children:"Organisation unit"}),f("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[f("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:t,onChange:g=>{l(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[f("option",{value:"",children:"Select a data set\u2026"}),r.map(g=>f("option",{value:g.id,children:g.label},g.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),f("span",{className:"der-de-period-wrap",children:Ie(S?.periodType,c,u)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[f("span",{className:"der-de-chip-label",children:"Signed in"}),f("span",{className:"der-de-chip-value",children:n.displayName})]})]}),k.kind==="ok"&&f("div",{style:De,"data-test":"de-ok",children:k.message}),k.kind==="error"&&f("div",{style:Oe,"data-test":"de-err",children:k.message}),!e.bound&&f("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&f("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!K&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),R&&o==="structured"&&v("form",{onSubmit:le,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",f("input",{value:m,onChange:g=>E(g.target.value),style:P})]}),v("label",{children:["Value",f("input",{value:y,onChange:g=>h(g.target.value),inputMode:"decimal",style:P})]}),f("div",{style:{gridColumn:"1 / -1"},children:f("button",{type:"submit",disabled:!ce,style:ne,children:k.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),R&&o==="custom"&&v("div",{className:"der-de-form-card",children:[q.length>0&&f("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(q.length,3)}, 1fr)`,gap:12,marginBottom:12},children:q.map(g=>v("label",{children:[g.name,f("select",{value:G[g.id]??"",onChange:p=>{let $={...G,[g.id]:p.target.value};W($),F.current=$,we(O.current,$)},style:P,children:g.options.map(p=>f("option",{value:p.id,children:p.name},p.id))})]},g.id))}),f("div",{ref:O,"data-test":"der-de-custom-form",className:"der-de-custom-form"}),v("div",{className:"der-de-form-actions",children:[T&&f("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:T.completed?`Complete${T.completedAt?" \xB7 "+new Date(T.completedAt).toLocaleString():""}`:"Open for edits"}),f("button",{type:"button",onClick:()=>Te(O.current,C),style:re,"data-test":"de-validate-btn",children:"Validate"}),f("button",{type:"button",onClick:ue,disabled:L,style:T?.completed?re:ne,"data-test":"de-complete-btn",children:L?"Saving\u2026":T?.completed?"Reopen":"Mark complete"})]})]})]})}var Ee=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Se=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],V=null,Q=null,H=null;async function Ce(n,e){V||(V=e.listAllDataElements().then(s=>new Map(s.map(t=>[t.id,t])))),Q||(Q=e.listAllCategoryCombos().then(s=>new Map(s.map(t=>[t.id,t])))),H||(H=e.listAllCategoryOptionCombos().then(s=>{let t=new Map;for(let l of s){let c=l.categoryCombo?.id;if(!c)continue;let u=t.get(c);u?u.push(l):t.set(c,[l])}return t}));let[d,i,o]=await Promise.all([V,Q,H]),a=s=>{if(!s?.id)return;let t=i.get(s.id),l=o.get(s.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:l.map(c=>({id:c.id,name:c.name??c.displayName})),categories:(t.categories??[]).map(c=>({id:c.id}))}:s},r=s=>{let t=d.get(s.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:s};return{...n,categoryCombo:a(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(s=>({...s,dataElement:s.dataElement?r(s.dataElement):void 0})),sections:(n.sections??[]).map(s=>({...s,dataElements:(s.dataElements??[]).map(t=>r(t))}))}}function ee(n){let e={};for(let s of n.dataSetElements??[])s.dataElement&&(e[s.dataElement.id]=s.dataElement);let d={};for(let s of n.indicators??[])d[s.id]=s;let i=(n.sections??[]).slice().sort((s,t)=>(s.sortOrder??0)-(t.sortOrder??0));if(!i.some(s=>(s.dataElements?.length??0)>0)){let s=(n.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);i=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:s,indicators:[],greyedFields:[]}]}let a=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let s of i){let t=new Set;for(let c of s.greyedFields??[])c.dataElement?.id&&c.categoryOptionCombo?.id&&t.add(`${c.dataElement.id}:${c.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${a(s.name??"")}</h3>`);let l=new Map;for(let c of s.dataElements??[]){let u=e[c.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,E=l.get(m);E||(E={cc:u.categoryCombo,des:[]},l.set(m,E)),E.des.push(u)}for(let c of l.values()){let u=c.cc.categoryOptionCombos??[],m=c.cc.categories??[];r.push('<table class="sectionTable" cellspacing="0">');let E=xe(m,u);if(r.push("<thead>"),E.length>0)for(let y=0;y<E.length;y++){r.push("<tr>"),y===0&&r.push(`<th class="dataElementCell" rowspan="${E.length}">`+a(c.cc.name??"Data element")+"</th>");for(let h of E[y]??[])r.push(`<th colspan="${h.span}">${a(h.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${a(c.cc.name??"Data element")}</th>`);for(let y of u)r.push(`<th>${a(y.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let y of c.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${a(y.id)}-cell">`+a(y.formName??y.name??y.id)+"</td>");for(let h of u){let k=`${y.id}-${h.id}-val`;t.has(`${y.id}:${h.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${a(k)}" name="${a(k)}" dataelementid="${a(y.id)}" optioncomboid="${a(h.id)}"></td>`)}r.push("</tr>")}for(let y of s.indicators??[]){let h=d[y.id];h&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${a(h.name??h.id)}</td>`),r.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(h.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table>")}}return r.join(`
`)}function xe(n,e){if(n.length===0)return[];let d=n.map(o=>o.categoryOptions?.length??0);if(d.some(o=>o===0))return[];let i=[];for(let o=0;o<n.length;o++){let a=[],r=1;for(let t=o+1;t<n.length;t++)r*=d[t]??1;let s=1;for(let t=0;t<o;t++)s*=d[t]??1;for(let t=0;t<s;t++)for(let l of n[o]?.categoryOptions??[])a.push({label:l.name??l.id,span:r});i.push(a)}return i}function ke(n){let e=globalThis;e.dhis2=e.dhis2??{};let d=e.dhis2;d.de=d.de??{};let i=d.de;i.currentDataSetId=n.dataSetId,i.currentOrganisationUnitId=n.orgUnitId,i.currentPeriodId=n.periodId,i.currentCategorySelections={...n.aocSelections??{}};let o=n.meta??{},a={},r={};if(o.categoryCombo){r[o.categoryCombo.id]=o.categoryCombo;for(let u of o.categoryCombo.categories??[])a[u.id]=u}i.categories=a,i.categoryCombos=r;let s={},t={};for(let u of o.dataSetElements??[]){let m=u.dataElement;m&&(s[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(r[m.categoryCombo.id]=m.categoryCombo))}i.dataElements=s,i.optionSets=t;let l={};for(let u of o.indicators??[])l[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};i.indicatorFormulas=l;let c={};for(let u of n.validationRules??[])c[u.id]=u;i.validationRules=c,i.lockExceptions=[],i.emptyOrganisationUnits=[],i.significantZeros=[],i.dataSets={[o.id]:{id:o.id,name:o.name??o.displayName??"",periodType:o.periodType,categoryCombo:o.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function $e(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function we(n,e){if(!n)return;for(let[i,o]of Object.entries(e)){let a=n.querySelector(`input[data-der-category="${i}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${i}`,a.setAttribute("data-der-category",i),n.appendChild(a)),a.value=o}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...e})}function Ae(n,e,d,i,o,a){let r=c=>{let u=/^(.+)-(.+)-val$/.exec(c);return u?{de:u[1],coc:u[2]}:null},s=new WeakMap,t=n.querySelectorAll('input[name$="-val"]');for(let c of Array.from(t))s.set(c,c.value);let l=async c=>{let u=c.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",E=r(m);if(!E)return;let y=e(),h=d(),k=i();if(!y||!h||!k)return;let C=u.value;if(s.get(u)!==C){J(u,"saving");try{let S=await a.submitAggregate({dataSet:y,period:h,orgUnit:k,attributeOptionComboSelections:o(),dataValues:[{dataElement:E.de,categoryOptionCombo:E.coc,value:C}]});s.set(u,C),J(u,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{J(u,"error")}}};n.addEventListener("blur",c=>{l(c)},!0)}function Ne(n){n.addEventListener("keydown",e=>{let d=e;if(d.key!=="Enter")return;let i=d.target;if(!(i instanceof HTMLInputElement))return;let o=i.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(o);if(!a)return;d.preventDefault();let r=a[2],s=Array.from(n.querySelectorAll(`input[name$="-${r}-val"]`)),t=s.indexOf(i);if(t===-1)return;let l=s[t+(d.shiftKey?-1:1)];l?.focus(),l instanceof HTMLInputElement&&l.select()})}function Te(n,e){if(!n)return;let i=globalThis.dhis2?.de?.dataElements??{},o=Array.from(n.querySelectorAll('input[name$="-val"]')),a=[];for(let r of o){r.style.outline="";let s=r.value.trim();if(s==="")continue;let t=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!t)continue;let l=t[1],c=i[l],u=c?.valueType??"TEXT",m=je(s,u);m&&(r.style.outline="2px solid #a93232",a.push(`${c?.valueType?"":"(unknown DE) "}${l}: ${m}`))}a.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${a.length} issue${a.length===1?"":"s"}. First: ${a[0]}`})}function je(n,e){let d=Number(n),i=Number.isInteger(d);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(e){case"INTEGER":if(!i)return"must be an integer";break;case"INTEGER_POSITIVE":if(!i||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!i||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!i||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function J(n,e){let d=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${d}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function _e(n,e,d,i,o){if(!e||!d||!i)return;let a;try{a=(await o.readAggregateValues(i,d,2e3)).dataValues??[]}catch{return}for(let r of a){let s=r.dataElement,t=r.categoryOptionCombo,l=r.value;if(!s||!t||l==null)continue;let c=n.querySelector(`input[name="${s}-${t}-val"]`);c&&(c.value=l)}}function oe(n){return new Promise((e,d)=>{let i=document.createElement("script");i.src=n,i.async=!1,i.setAttribute("data-der-custom-form",n),i.onload=()=>e(),i.onerror=()=>d(new Error(`failed to load ${n}`)),document.head.appendChild(i)})}function ie(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function te(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Re(n,e){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let o of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(o.tagName==="LINK"){let a=o.getAttribute("href")??"";a&&ie(te(a))}else{let a=document.createElement("style");a.textContent=o.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}o.remove()}let i=[];for(let o of Array.from(d.querySelectorAll("script"))){let a=o.getAttribute("src");a?i.push({src:te(a)}):i.push({code:o.textContent??""}),o.remove()}for(let o of Array.from(d.body.childNodes))n.appendChild(document.adoptNode(o));for(let o of i)if(o.src)document.querySelector(`script[data-der-custom-form="${o.src}"]`)||await oe(o.src);else if(o.code){let a=document.createElement("script");a.textContent=o.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var P={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ne={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},re={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},De={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Oe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Ie(n,e,d){let i={...P},o=Pe(n);if(o.length===0)return f("input",{value:e,onChange:m=>d(m.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:i});let a=[...o];if(e&&!a.some(m=>m.id===e)){let m=Me(n,e)??e;a.unshift({id:e,label:m})}let r=o[0]?.id??null,s=a.findIndex(m=>m.id===e),t=s===-1||s<a.length-1||!!n,l=e!==""&&(s>0||e!==r),c=()=>{if(!n)return;let m=s>=0&&s<a.length-1?a[s+1]?.id??"":ae(n,e||r||"",-1);m&&d(m)},u=()=>{if(!n||!e||e===r)return;let m=s>0?a[s-1]?.id??"":ae(n,e,1);m&&d(m)};return v("span",{className:"der-de-period-nav",children:[f("button",{type:"button","aria-label":"Previous period",onClick:c,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:e,onChange:m=>d(m.target.value),style:i,children:[f("option",{value:"",children:"Select a period\u2026"}),a.map(m=>f("option",{value:m.id,children:m.label},m.id))]}),f("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!l,className:"der-de-period-btn",children:"\u25B6"})]})}function ae(n,e,d){let i=o=>String(o).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let o=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,r=Number(e.slice(6,8)),s=new Date(o,a,r+d);return`${s.getFullYear()}${i(s.getMonth()+1)}${i(s.getDate())}`}case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+d;return r<1?(a-=1,r=z(a)):r>z(a)&&(a+=1,r=1),`${a}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let o=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,r=o*12+a+d;return`${Math.floor(r/12)}${i((r%12+12)%12+1)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+d;return r<1?(a-=1,r=6):r>6&&(a+=1,r=1),`${a}${i(r)}B`}case"Quarterly":{let o=/^(\d{4})Q(\d)$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+d;return r<1?(a-=1,r=4):r>4&&(a+=1,r=1),`${a}Q${r}`}case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+d;return r<1?(a-=1,r=2):r>2&&(a+=1,r=1),`${a}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+d):"";default:return""}}function Me(n,e){let d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(e);return i?`${i[1]} W${String(i[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let i=Number(e.slice(4,6))-1;return`${d[i]??""} ${e.slice(0,4)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(e);if(!i)return null;let o=(Number(i[2])-1)*2;return`${d[o]}\u2013${d[o+1]} ${i[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(e);return i?`${i[1]} ${i[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Pe(n){let e=new Date,d=e.getFullYear(),i=e.getMonth(),o=r=>String(r).padStart(2,"0"),a=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let r=[];for(let s=0;s<30;s++){let t=new Date(e);t.setDate(t.getDate()-s);let l=`${t.getFullYear()}${o(t.getMonth()+1)}${o(t.getDate())}`,c=`${t.getFullYear()}-${o(t.getMonth()+1)}-${o(t.getDate())}`;r.push({id:l,label:c})}return r}case"Weekly":{let r=[],s=se(e),t=s.year,l=s.week;for(let c=0;c<12;c++)r.push({id:`${t}W${l}`,label:`${t} W${o(l)}`}),l-=1,l<1&&(t-=1,l=z(t));return r}case"Monthly":{let r=[];for(let s=0;s<24;s++){let t=d,l=i,c=t*12+l-s,u=Math.floor(c/12),m=(c%12+12)%12;r.push({id:`${u}${o(m+1)}`,label:`${a[m]} ${u}`})}return r}case"BiMonthly":{let r=[],s=Math.floor(i/2)+1,t=d,l=s;for(let c=0;c<12;c++){let u=(l-1)*2;r.push({id:`${t}${o(l)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),l-=1,l<1&&(t-=1,l=6)}return r}case"Quarterly":{let r=[],s=Math.floor(i/3)+1,t=d,l=s;for(let c=0;c<8;c++)r.push({id:`${t}Q${l}`,label:`${t} Q${l}`}),l-=1,l<1&&(t-=1,l=4);return r}case"SixMonthly":{let r=[],s=i<6?1:2,t=d,l=s;for(let c=0;c<6;c++)r.push({id:`${t}S${l}`,label:`${t} ${l===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),l-=1,l<1&&(t-=1,l=2);return r}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let r=[];for(let s=0;s<10;s++){let t=d-s;r.push({id:String(t),label:String(t)})}return r}default:return[]}}function se(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),d=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-d);let i=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-i.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function z(n){return se(new Date(n,11,28)).week}var Ue=`
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
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef0f3;
  gap: 8px;
}
.der-de-completion-pill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 12px;
  background: #eef0f3;
  color: #404b5a;
  font-size: 12px;
  letter-spacing: 0.02em;
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
`;export{ve as default};
