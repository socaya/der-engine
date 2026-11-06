/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as j,useRef as ee,useState as S}from"react";import{useAuth as fe,useOrgUnitBinding as ye,useOnlineStatus as be,useDerApi as he,ScreenCard as ve,StatusPill as xe}from"@der/app-sdk";import{jsx as g,jsxs as E}from"react/jsx-runtime";function Ee(){let r=fe(),e=ye(),s=be(),d=he(),[a,i]=S("custom"),[n,o]=S([]),[t,c]=S(""),[l,u]=S(""),[m,x]=S(""),[y,v]=S(""),[h,C]=S({kind:"idle"}),[k,q]=S(null),R=ee(null),[G,W]=S({}),U=ee({}),[F,le]=S([]),[T,M]=S(null),[L,Y]=S(!1),[K,ce]=S(0);j(()=>{let p=!1;return(async()=>{try{let f=await d.listDataSets();if(p)return;let w=(f.dataSets??[]).map($=>({id:$.id,label:$.displayName??$.name??$.id,periodType:$.periodType,formType:$.formType})).sort(($,N)=>$.label.localeCompare(N.label));o(w)}catch{}})(),()=>{p=!0}},[]),j(()=>{if(t.trim()===""){q(null);return}let p=!1;return(async()=>{try{let f=await d.getDataSetMeta(t.trim());if(p)return;let w=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";q({hasCustomForm:w,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),i(w?"custom":"structured")}catch{p||q(null)}})(),()=>{p=!0}},[t]),j(()=>{if(a!=="custom"||!k?.hasCustomForm||k.formType==="CUSTOM"&&!k.formId)return;let p=R.current;if(!p)return;let f=!1;return(async()=>{C({kind:"submitting"});try{let w=await d.getDataSetFormMetadata(t.trim());if(f)return;let $=await Ce(w,d);if(f)return;let N="";if(k.formType==="CUSTOM"&&k.formId){try{N=(await d.getDataEntryFormHtml(k.formId)).htmlCode??""}catch(b){N="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}N.trim()||(N=te($))}else k.formType==="SECTION"&&(N=te($));if(f)return;let pe=await d.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(f)return;let Z=($.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(_=>({id:_.id,name:_.name??_.id}))}));le(Z);let I={};for(let b of Z)b.options[0]&&(I[b.id]=b.options[0].id);W(I),U.current=I,p.replaceChildren();for(let[b,_]of[["selectedDataSetId",t.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let A=document.createElement("input");A.type="hidden",A.id=b,A.value=_,p.appendChild(A)}for(let[b,_]of Object.entries(I)){let A=document.createElement("input");A.type="hidden",A.id=`category-${b}`,A.value=_,A.setAttribute("data-der-category",b),p.appendChild(A)}let O=document.createElement("div");O.id="contentDiv",p.appendChild(O),we({dataSetId:t.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:$,aocSelections:I,validationRules:pe.validationRules??[]});for(let b of ke)se(b);for(let b of Se)document.querySelector(`script[data-der-custom-form="${b}"]`)||await oe(b);Ae(),await Me(O,N),await Ie(O,t.trim(),l.trim(),e.orgUnitUid??"",d),Te(O,()=>t.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...U.current}),d),_e(O),ce(b=>b+1),C({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(w){C({kind:"error",message:`custom form failed to render: ${w.message}`})}})(),()=>{f=!0}},[a,k,t,l,e.orgUnitUid]);let ue=e.bound&&t.trim()!==""&&l.trim()!==""&&m.trim()!==""&&y.trim()!==""&&h.kind!=="submitting";async function me(p){p.preventDefault(),C({kind:"submitting"});try{await d.submitAggregate({dataSet:t,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),C({kind:"ok",message:`Submitted ${m}=${y} for ${l}.`}),x(""),v("")}catch(f){C({kind:"error",message:f.message??"Submission failed"})}}let X=l.trim()!=="",V=t.trim()!=="",D=V&&X&&e.bound;j(()=>{if(!D){M(null);return}let p=!1;return(async()=>{try{let f=await d.getCompletion(t.trim(),e.orgUnitUid??"",l.trim());if(p)return;M({completed:!!f.completed,completedAt:f.completedAt})}catch{p||M({completed:!1})}})(),()=>{p=!0}},[t,l,e.orgUnitUid,D]);async function ge(){if(!D||L)return;let p=!T?.completed;Y(!0);try{let f=await d.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:p});M({completed:!!f.completed,completedAt:f.completedAt}),C({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){C({kind:"error",message:`Completion failed: ${f.message}`})}finally{Y(!1)}}return E(ve,{title:"Aggregate data entry",actions:g(xe,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[g("style",{children:Ve}),E("div",{className:"der-de-context",children:[E("div",{className:"der-de-chip",children:[g("span",{className:"der-de-chip-label",children:"Organisation unit"}),g("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),E("div",{className:"der-de-chip",children:[g("span",{className:"der-de-chip-label",children:"Data set"}),E("select",{className:"der-de-select",value:t,onChange:p=>{c(p.target.value),u("")},"data-test":"der-de-dataset-picker",children:[g("option",{value:"",children:"Select a data set\u2026"}),n.map(p=>g("option",{value:p.id,children:p.label},p.id))]})]}),E("div",{className:"der-de-chip",children:[E("span",{className:"der-de-chip-label",children:["Period ",k?.periodType?`\xB7 ${k.periodType}`:""]}),g("span",{className:"der-de-period-wrap",children:Ue(k?.periodType,l,u)})]}),E("div",{className:"der-de-chip der-de-chip-signed",children:[g("span",{className:"der-de-chip-label",children:"Signed in"}),g("span",{className:"der-de-chip-value",children:r.displayName})]})]}),h.kind==="ok"&&g("div",{style:Pe,"data-test":"de-ok",children:h.message}),h.kind==="error"&&g("div",{style:qe,"data-test":"de-err",children:h.message}),!e.bound&&g("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!V&&g("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&V&&!X&&E("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),D&&a==="structured"&&E("form",{onSubmit:me,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[E("label",{children:["Data element UID",g("input",{value:m,onChange:p=>x(p.target.value),style:P})]}),E("label",{children:["Value",g("input",{value:y,onChange:p=>v(p.target.value),inputMode:"decimal",style:P})]}),g("div",{style:{gridColumn:"1 / -1"},children:g("button",{type:"submit",disabled:!ue,style:re,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),D&&a==="custom"&&E("div",{className:"der-de-form-card",children:[F.length>0&&g("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(F.length,3)}, 1fr)`,gap:12,marginBottom:12},children:F.map(p=>E("label",{children:[p.name,g("select",{value:G[p.id]??"",onChange:f=>{let w={...G,[p.id]:f.target.value};W(w),U.current=w,Ne(R.current,w)},style:P,children:p.options.map(f=>g("option",{value:f.id,children:f.name},f.id))})]},p.id))}),E("div",{className:"der-de-form-split",children:[g(je,{targetRef:R,formVersion:K}),g("div",{ref:R,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),D&&a==="custom"&&E("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[g(Re,{root:R,formVersion:K}),T&&g("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:T.completed?`Complete${T.completedAt?" \xB7 "+new Date(T.completedAt).toLocaleString():""}`:"Open for edits"}),g("button",{type:"button",onClick:()=>De(R.current,C),style:ae,"data-test":"de-validate-btn",children:"Validate"}),g("button",{type:"button",onClick:ge,disabled:L,style:T?.completed?ae:re,"data-test":"de-complete-btn",children:L?"Saving\u2026":T?.completed?"Reopen":"Mark complete"})]})]})}var Se=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ke=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],B=null,H=null,Q=null;async function Ce(r,e){B||(B=e.listAllDataElements().then(o=>new Map(o.map(t=>[t.id,t])))),H||(H=e.listAllCategoryCombos().then(o=>new Map(o.map(t=>[t.id,t])))),Q||(Q=e.listAllCategoryOptionCombos().then(o=>{let t=new Map;for(let c of o){let l=c.categoryCombo?.id;if(!l)continue;let u=t.get(l);u?u.push(c):t.set(l,[c])}return t}));let[s,d,a]=await Promise.all([B,H,Q]),i=o=>{if(!o?.id)return;let t=d.get(o.id),c=a.get(o.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(t.categories??[]).map(l=>({id:l.id}))}:o},n=o=>{let t=s.get(o.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:i(t.categoryCombo)}:o};return{...r,categoryCombo:i(r.categoryCombo)??r.categoryCombo,dataSetElements:(r.dataSetElements??[]).map(o=>({...o,dataElement:o.dataElement?n(o.dataElement):void 0})),sections:(r.sections??[]).map(o=>({...o,dataElements:(o.dataElements??[]).map(t=>n(t))}))}}function te(r){let e={};for(let o of r.dataSetElements??[])o.dataElement&&(e[o.dataElement.id]=o.dataElement);let s={};for(let o of r.indicators??[])s[o.id]=o;let d=(r.sections??[]).slice().sort((o,t)=>(o.sortOrder??0)-(t.sortOrder??0));if(!d.some(o=>(o.dataElements?.length??0)>0)){let o=(r.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);d=[{id:r.id,name:r.displayName??r.name??"Data entry",sortOrder:0,dataElements:o,indicators:[],greyedFields:[]}]}let i=o=>o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let o of d){let t=new Set;for(let l of o.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&t.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${i(o.name??"")}</h3>`);let c=new Map;for(let l of o.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,x=c.get(m);x||(x={cc:u.categoryCombo,des:[]},c.set(m,x)),x.des.push(u)}for(let l of c.values()){let u=l.cc.categoryOptionCombos??[],m=l.cc.categories??[];n.push('<table class="sectionTable" cellspacing="0">');let x=$e(m,u);if(n.push("<thead>"),x.length>0)for(let y=0;y<x.length;y++){n.push("<tr>"),y===0&&n.push(`<th class="dataElementCell" rowspan="${x.length}">`+i(l.cc.name??"Data element")+"</th>");for(let v of x[y]??[])n.push(`<th colspan="${v.span}">${i(v.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${i(l.cc.name??"Data element")}</th>`);for(let y of u)n.push(`<th>${i(y.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let y of l.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${i(y.id)}-cell">`+i(y.formName??y.name??y.id)+"</td>");for(let v of u){let h=`${y.id}-${v.id}-val`;t.has(`${y.id}:${v.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${i(h)}" name="${i(h)}" dataelementid="${i(y.id)}" optioncomboid="${i(v.id)}"></td>`)}n.push("</tr>")}for(let y of o.indicators??[]){let v=s[y.id];v&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${i(v.name??v.id)}</td>`),n.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${i(v.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table>")}}return n.join(`
`)}function $e(r,e){if(r.length===0)return[];let s=r.map(a=>a.categoryOptions?.length??0);if(s.some(a=>a===0))return[];let d=[];for(let a=0;a<r.length;a++){let i=[],n=1;for(let t=a+1;t<r.length;t++)n*=s[t]??1;let o=1;for(let t=0;t<a;t++)o*=s[t]??1;for(let t=0;t<o;t++)for(let c of r[a]?.categoryOptions??[])i.push({label:c.name??c.id,span:n});d.push(i)}return d}function we(r){let e=globalThis;e.dhis2=e.dhis2??{};let s=e.dhis2;s.de=s.de??{};let d=s.de;d.currentDataSetId=r.dataSetId,d.currentOrganisationUnitId=r.orgUnitId,d.currentPeriodId=r.periodId,d.currentCategorySelections={...r.aocSelections??{}};let a=r.meta??{},i={},n={};if(a.categoryCombo){n[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])i[u.id]=u}d.categories=i,d.categoryCombos=n;let o={},t={};for(let u of a.dataSetElements??[]){let m=u.dataElement;m&&(o[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(n[m.categoryCombo.id]=m.categoryCombo))}d.dataElements=o,d.optionSets=t;let c={};for(let u of a.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};d.indicatorFormulas=c;let l={};for(let u of r.validationRules??[])l[u.id]=u;d.validationRules=l,d.lockExceptions=[],d.emptyOrganisationUnits=[],d.significantZeros=[],d.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:r.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ae(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(e,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let e=r.dhis2.period;e.format="yyyy-mm-dd",e.calendar=r.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Ne(r,e){if(!r)return;for(let[d,a]of Object.entries(e)){let i=r.querySelector(`input[data-der-category="${d}"]`);i||(i=document.createElement("input"),i.type="hidden",i.id=`category-${d}`,i.setAttribute("data-der-category",d),r.appendChild(i)),i.value=a}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...e})}function Te(r,e,s,d,a,i){let n=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},o=new WeakMap,t=r.querySelectorAll('input[name$="-val"]');for(let l of Array.from(t))o.set(l,l.value);let c=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",x=n(m);if(!x)return;let y=e(),v=s(),h=d();if(!y||!v||!h)return;let C=u.value;if(o.get(u)!==C){z(u,"saving");try{let k=await i.submitAggregate({dataSet:y,period:v,orgUnit:h,attributeOptionComboSelections:a(),dataValues:[{dataElement:x.de,categoryOptionCombo:x.coc,value:C}]});o.set(u,C),z(u,k?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{z(u,"error")}}};r.addEventListener("blur",l=>{c(l)},!0)}function _e(r){r.addEventListener("keydown",e=>{let s=e;if(s.key!=="Enter")return;let d=s.target;if(!(d instanceof HTMLInputElement))return;let a=d.getAttribute("name")??"",i=/^(.+)-(.+)-val$/.exec(a);if(!i)return;s.preventDefault();let n=i[2],o=Array.from(r.querySelectorAll(`input[name$="-${n}-val"]`)),t=o.indexOf(d);if(t===-1)return;let c=o[t+(s.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function je({targetRef:r,formVersion:e}){let[s,d]=S([]),[a,i]=S("");return j(()=>{let n=r.current;if(!n)return;let t=Array.from(n.querySelectorAll("h3.formSection")).map((c,l)=>{let u=c.id||`der-de-section-${l}`;return c.id=u,{id:u,label:(c.textContent??"").trim(),el:c}}).filter(c=>c.label);d(t),i(t[0]?.id??"")},[r,e]),j(()=>{if(s.length===0)return;let n=new IntersectionObserver(o=>{let t=null;for(let c of o){if(!c.isIntersecting)continue;let l=c.target.id;l&&(!t||c.intersectionRatio>t.ratio)&&(t={id:l,ratio:c.intersectionRatio})}t&&i(t.id)},{threshold:[0,.2,.4,.6],rootMargin:"-80px 0px -60% 0px"});for(let o of s)n.observe(o.el);return()=>n.disconnect()},[s]),s.length<2?null:E("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[g("div",{className:"der-de-section-nav__title",children:"Sections"}),g("ul",{className:"der-de-section-nav__list",children:s.map(n=>g("li",{children:g("button",{type:"button",className:"der-de-section-nav__item"+(a===n.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>{n.el.scrollIntoView({behavior:"smooth",block:"start"}),i(n.id)},children:n.label})},n.id))})]})}function Re({root:r,formVersion:e}){let[s,d]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(j(()=>{let n=()=>{let t=r.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),l=0,u=0,m=0,x=0,y=0;for(let v of c){v.value.trim()!==""&&l++;let h=v.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?u++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?x++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?m++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&y++}d({total:c.length,filled:l,saving:u,saved:m,queued:x,error:y})};n();let o=window.setInterval(n,800);return()=>window.clearInterval(o)},[r,e]),s.total===0)return g("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${s.filled} of ${s.total} filled`),s.saving>0&&a.push(`${s.saving} saving`),s.queued>0&&a.push(`${s.queued} queued`),s.error>0&&a.push(`${s.error} error`);let i=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return g("span",{className:`der-de-savepill der-de-savepill--${i}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function De(r,e){if(!r)return;let d=globalThis.dhis2?.de?.dataElements??{},a=Array.from(r.querySelectorAll('input[name$="-val"]')),i=[];for(let n of a){n.style.outline="";let o=n.value.trim();if(o==="")continue;let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!t)continue;let c=t[1],l=d[c],u=l?.valueType??"TEXT",m=Oe(o,u);m&&(n.style.outline="2px solid #a93232",i.push(`${l?.valueType?"":"(unknown DE) "}${c}: ${m}`))}i.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${i.length} issue${i.length===1?"":"s"}. First: ${i[0]}`})}function Oe(r,e){let s=Number(r),d=Number.isInteger(s);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(e){case"INTEGER":if(!d)return"must be an integer";break;case"INTEGER_POSITIVE":if(!d||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!d||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!d||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function z(r,e){let s=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";r.style.outline=`2px solid ${s}`,r.style.transition="outline 150ms",e==="queued"?r.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):r.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function Ie(r,e,s,d,a){if(!e||!s||!d)return;let i;try{i=(await a.readAggregateValues(d,s,2e3)).dataValues??[]}catch{return}for(let n of i){let o=n.dataElement,t=n.categoryOptionCombo,c=n.value;if(!o||!t||c==null)continue;let l=r.querySelector(`input[name="${o}-${t}-val"]`);l&&(l.value=c)}}function oe(r){return new Promise((e,s)=>{let d=document.createElement("script");d.src=r,d.async=!1,d.setAttribute("data-der-custom-form",r),d.onload=()=>e(),d.onerror=()=>s(new Error(`failed to load ${r}`)),document.head.appendChild(d)})}function se(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=r,e.setAttribute("data-der-custom-form",r),document.head.appendChild(e)}function ne(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Me(r,e){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let i=a.getAttribute("href")??"";i&&se(ne(i))}else{let i=document.createElement("style");i.textContent=a.textContent??"",i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i)}a.remove()}let d=[];for(let a of Array.from(s.querySelectorAll("script"))){let i=a.getAttribute("src");i?d.push({src:ne(i)}):d.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(s.body.childNodes))r.appendChild(document.adoptNode(a));for(let a of d)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await oe(a.src);else if(a.code){let i=document.createElement("script");i.textContent=a.code,i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i),i.remove()}}var P={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},re={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ae={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Pe={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},qe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Ue(r,e,s){let d={...P},a=Le(r);if(a.length===0)return g("input",{value:e,onChange:m=>s(m.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:d});let i=[...a];if(e&&!i.some(m=>m.id===e)){let m=Fe(r,e)??e;i.unshift({id:e,label:m})}let n=a[0]?.id??null,o=i.findIndex(m=>m.id===e),t=o===-1||o<i.length-1||!!r,c=e!==""&&(o>0||e!==n),l=()=>{if(!r)return;let m=o>=0&&o<i.length-1?i[o+1]?.id??"":ie(r,e||n||"",-1);m&&s(m)},u=()=>{if(!r||!e||e===n)return;let m=o>0?i[o-1]?.id??"":ie(r,e,1);m&&s(m)};return E("span",{className:"der-de-period-nav",children:[g("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),E("select",{value:e,onChange:m=>s(m.target.value),style:d,children:[g("option",{value:"",children:"Select a period\u2026"}),i.map(m=>g("option",{value:m.id,children:m.label},m.id))]}),g("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function ie(r,e,s){let d=a=>String(a).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),i=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),o=new Date(a,i,n+s);return`${o.getFullYear()}${d(o.getMonth()+1)}${d(o.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+s;return n<1?(i-=1,n=J(i)):n>J(i)&&(i+=1,n=1),`${i}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),i=Number(e.slice(4,6))-1,n=a*12+i+s;return`${Math.floor(n/12)}${d((n%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+s;return n<1?(i-=1,n=6):n>6&&(i+=1,n=1),`${i}${d(n)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+s;return n<1?(i-=1,n=4):n>4&&(i+=1,n=1),`${i}Q${n}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+s;return n<1?(i-=1,n=2):n>2&&(i+=1,n=1),`${i}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+s):"";default:return""}}function Fe(r,e){let s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let d=/^(\d{4})W(\d{1,2})$/.exec(e);return d?`${d[1]} W${String(d[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let d=Number(e.slice(4,6))-1;return`${s[d]??""} ${e.slice(0,4)}`}case"BiMonthly":{let d=/^(\d{4})(\d{2})B$/.exec(e);if(!d)return null;let a=(Number(d[2])-1)*2;return`${s[a]}\u2013${s[a+1]} ${d[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let d=/^(\d{4})S(\d)$/.exec(e);return d?`${d[1]} ${d[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Le(r){let e=new Date,s=e.getFullYear(),d=e.getMonth(),a=n=>String(n).padStart(2,"0"),i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":{let n=[];for(let o=0;o<30;o++){let t=new Date(e);t.setDate(t.getDate()-o);let c=`${t.getFullYear()}${a(t.getMonth()+1)}${a(t.getDate())}`,l=`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`;n.push({id:c,label:l})}return n}case"Weekly":{let n=[],o=de(e),t=o.year,c=o.week;for(let l=0;l<12;l++)n.push({id:`${t}W${c}`,label:`${t} W${a(c)}`}),c-=1,c<1&&(t-=1,c=J(t));return n}case"Monthly":{let n=[];for(let o=0;o<24;o++){let t=s,c=d,l=t*12+c-o,u=Math.floor(l/12),m=(l%12+12)%12;n.push({id:`${u}${a(m+1)}`,label:`${i[m]} ${u}`})}return n}case"BiMonthly":{let n=[],o=Math.floor(d/2)+1,t=s,c=o;for(let l=0;l<12;l++){let u=(c-1)*2;n.push({id:`${t}${a(c)}B`,label:`${i[u]}\u2013${i[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return n}case"Quarterly":{let n=[],o=Math.floor(d/3)+1,t=s,c=o;for(let l=0;l<8;l++)n.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return n}case"SixMonthly":{let n=[],o=d<6?1:2,t=s,c=o;for(let l=0;l<6;l++)n.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let o=0;o<10;o++){let t=s-o;n.push({id:String(t),label:String(t)})}return n}default:return[]}}function de(r){let e=new Date(r.getFullYear(),r.getMonth(),r.getDate()),s=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-s);let d=new Date(e.getFullYear(),0,1),i=Math.round((e.getTime()-d.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((i+1)/7)}}function J(r){return de(new Date(r,11,28)).week}var Ve=`
.der-de-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(140%) blur(6px);
  border: 1px solid #eef0f3;
  border-radius: 8px;
  /* ADR-0037 \xA71.2 \u2014 sticky context strip so the operator always
   * sees which dataset/period/OU/AOC they are editing, even when
   * scrolling long section forms. 56 px matches the shell topbar
   * height so the two stack cleanly. */
  position: sticky;
  top: 56px;
  z-index: 5;
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
.der-de-actionbar {
  position: sticky;
  bottom: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(140%) blur(6px);
  border: 1px solid #eef0f3;
  border-radius: 8px;
  box-shadow: 0 -2px 6px rgba(28, 46, 70, 0.04);
}
.der-de-savepill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.der-de-savepill--muted  { background: #eef0f3; color: #6e7a8a; }
.der-de-savepill--saved  { background: #e8f4ee; color: #136436; }
.der-de-savepill--saving { background: #fbf4e0; color: #8a6b00; }
.der-de-savepill--queued { background: #fbeedd; color: #874a00; }
.der-de-savepill--error  { background: #fbeaea; color: #8a2525; }
.der-de-form-split {
  display: block;
}
.der-de-section-nav { display: none; }
@media (min-width: 1024px) {
  .der-de-form-split {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 24px;
    align-items: start;
  }
  .der-de-section-nav {
    display: block;
    position: sticky;
    top: 80px;
    align-self: start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding: 12px 8px;
    background: #fafbfc;
    border: 1px solid #eef0f3;
    border-radius: 6px;
  }
}
.der-de-section-nav__title {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
  margin: 0 8px 8px;
}
.der-de-section-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-section-nav__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  margin: 0;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 4px 4px 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.35;
  cursor: pointer;
}
.der-de-section-nav__item:hover {
  background: #eef0f3;
}
.der-de-section-nav__item--active {
  background: #eef4fa;
  border-left-color: #2c6693;
  color: #1f4d70;
  font-weight: 500;
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
`;export{Ee as default};
