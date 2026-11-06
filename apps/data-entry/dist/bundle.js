/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as N,useRef as te,useState as S}from"react";import{useAuth as be,useOrgUnitBinding as he,useOnlineStatus as ve,useDerApi as xe,ScreenCard as Ee,StatusPill as Se}from"@der/app-sdk";import{jsx as p,jsxs as E}from"react/jsx-runtime";function ke(){let n=be(),e=he(),s=ve(),d=xe(),[o,a]=S("custom"),[r,i]=S([]),[t,c]=S(""),[l,u]=S(""),[m,x]=S(""),[y,v]=S(""),[h,w]=S({kind:"idle"}),[k,U]=S(null),R=te(null),[W,Y]=S({}),F=te({}),[L,ce]=S([]),[_,P]=S(null),[V,K]=S(!1),[X,ue]=S(0),[D,me]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});N(()=>{try{window.localStorage.setItem("der-de-density",D)}catch{}},[D]),N(()=>{let g=!1;return(async()=>{try{let f=await d.listDataSets();if(g)return;let $=(f.dataSets??[]).map(C=>({id:C.id,label:C.displayName??C.name??C.id,periodType:C.periodType,formType:C.formType})).sort((C,A)=>C.label.localeCompare(A.label));i($)}catch{}})(),()=>{g=!0}},[]),N(()=>{if(t.trim()===""){U(null);return}let g=!1;return(async()=>{try{let f=await d.getDataSetMeta(t.trim());if(g)return;let $=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";U({hasCustomForm:$,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),a($?"custom":"structured")}catch{g||U(null)}})(),()=>{g=!0}},[t]),N(()=>{if(o!=="custom"||!k?.hasCustomForm||k.formType==="CUSTOM"&&!k.formId)return;let g=R.current;if(!g)return;let f=!1;return(async()=>{w({kind:"submitting"});try{let $=await d.getDataSetFormMetadata(t.trim());if(f)return;let C=await $e($,d);if(f)return;let A="";if(k.formType==="CUSTOM"&&k.formId){try{A=(await d.getDataEntryFormHtml(k.formId)).htmlCode??""}catch(b){A="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}A.trim()||(A=re(C))}else k.formType==="SECTION"&&(A=re(C));if(f)return;let ye=await d.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(f)return;let ee=(C.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(j=>({id:j.id,name:j.name??j.id}))}));ce(ee);let M={};for(let b of ee)b.options[0]&&(M[b.id]=b.options[0].id);Y(M),F.current=M,g.replaceChildren();for(let[b,j]of[["selectedDataSetId",t.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let T=document.createElement("input");T.type="hidden",T.id=b,T.value=j,g.appendChild(T)}for(let[b,j]of Object.entries(M)){let T=document.createElement("input");T.type="hidden",T.id=`category-${b}`,T.value=j,T.setAttribute("data-der-category",b),g.appendChild(T)}let O=document.createElement("div");O.id="contentDiv",g.appendChild(O),Ae({dataSetId:t.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:C,aocSelections:M,validationRules:ye.validationRules??[]});for(let b of Ce)de(b);for(let b of we)document.querySelector(`script[data-der-custom-form="${b}"]`)||await se(b);Ne(),await qe(O,A),await Pe(O,t.trim(),l.trim(),e.orgUnitUid??"",d),je(O,()=>t.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),d),Re(O),ue(b=>b+1),w({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch($){w({kind:"error",message:`custom form failed to render: ${$.message}`})}})(),()=>{f=!0}},[o,k,t,l,e.orgUnitUid]);let pe=e.bound&&t.trim()!==""&&l.trim()!==""&&m.trim()!==""&&y.trim()!==""&&h.kind!=="submitting";async function ge(g){g.preventDefault(),w({kind:"submitting"});try{await d.submitAggregate({dataSet:t,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),w({kind:"ok",message:`Submitted ${m}=${y} for ${l}.`}),x(""),v("")}catch(f){w({kind:"error",message:f.message??"Submission failed"})}}let Z=l.trim()!=="",B=t.trim()!=="",I=B&&Z&&e.bound;N(()=>{if(!I){P(null);return}let g=!1;return(async()=>{try{let f=await d.getCompletion(t.trim(),e.orgUnitUid??"",l.trim());if(g)return;P({completed:!!f.completed,completedAt:f.completedAt})}catch{g||P({completed:!1})}})(),()=>{g=!0}},[t,l,e.orgUnitUid,I]);async function fe(){if(!I||V)return;let g=!_?.completed;K(!0);try{let f=await d.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:g});P({completed:!!f.completed,completedAt:f.completedAt}),w({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){w({kind:"error",message:`Completion failed: ${f.message}`})}finally{K(!1)}}return E(Ee,{title:"Aggregate data entry",actions:p(Se,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[p("style",{children:He}),E("div",{className:"der-de-context",children:[E("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),E("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),E("select",{className:"der-de-select",value:t,onChange:g=>{c(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),r.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),E("div",{className:"der-de-chip",children:[E("span",{className:"der-de-chip-label",children:["Period ",k?.periodType?`\xB7 ${k.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Le(k?.periodType,l,u)})]}),E("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:n.displayName})]})]}),h.kind==="ok"&&p("div",{style:Ue,"data-test":"de-ok",children:h.message}),h.kind==="error"&&p("div",{style:Fe,"data-test":"de-err",children:h.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!Z&&E("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),I&&o==="structured"&&E("form",{onSubmit:ge,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[E("label",{children:["Data element UID",p("input",{value:m,onChange:g=>x(g.target.value),style:q})]}),E("label",{children:["Value",p("input",{value:y,onChange:g=>v(g.target.value),inputMode:"decimal",style:q})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!pe,style:oe,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),I&&o==="custom"&&E("div",{className:`der-de-form-card der-de-density-${D}`,children:[L.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(L.length,3)}, 1fr)`,gap:12,marginBottom:12},children:L.map(g=>E("label",{children:[g.name,p("select",{value:W[g.id]??"",onChange:f=>{let $={...W,[g.id]:f.target.value};Y($),F.current=$,_e(R.current,$)},style:q,children:g.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},g.id))}),E("div",{className:"der-de-form-split",children:[p(De,{targetRef:R,formVersion:X}),p("div",{ref:R,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),I&&o==="custom"&&E("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(Ie,{root:R,formVersion:X}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${D==="compact"?"comfortable":"compact"} density`,title:`Density: ${D}. Click to switch.`,onClick:()=>me(g=>g==="compact"?"comfortable":"compact"),children:D==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),_&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:_.completed?`Complete${_.completedAt?" \xB7 "+new Date(_.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>Oe(R.current,w),style:ae,"data-test":"de-validate-btn",children:"Validate"}),p("button",{type:"button",onClick:fe,disabled:V,style:_?.completed?ae:oe,"data-test":"de-complete-btn",children:V?"Saving\u2026":_?.completed?"Reopen":"Mark complete"})]})]})}var we=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Ce=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],H=null,z=null,Q=null;async function $e(n,e){H||(H=e.listAllDataElements().then(i=>new Map(i.map(t=>[t.id,t])))),z||(z=e.listAllCategoryCombos().then(i=>new Map(i.map(t=>[t.id,t])))),Q||(Q=e.listAllCategoryOptionCombos().then(i=>{let t=new Map;for(let c of i){let l=c.categoryCombo?.id;if(!l)continue;let u=t.get(l);u?u.push(c):t.set(l,[c])}return t}));let[s,d,o]=await Promise.all([H,z,Q]),a=i=>{if(!i?.id)return;let t=d.get(i.id),c=o.get(i.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(t.categories??[]).map(l=>({id:l.id}))}:i},r=i=>{let t=s.get(i.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:i};return{...n,categoryCombo:a(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(i=>({...i,dataElement:i.dataElement?r(i.dataElement):void 0})),sections:(n.sections??[]).map(i=>({...i,dataElements:(i.dataElements??[]).map(t=>r(t))}))}}function re(n){let e={};for(let i of n.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let s={};for(let i of n.indicators??[])s[i.id]=i;let d=(n.sections??[]).slice().sort((i,t)=>(i.sortOrder??0)-(t.sortOrder??0));if(!d.some(i=>(i.dataElements?.length??0)>0)){let i=(n.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);d=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:i,indicators:[],greyedFields:[]}]}let a=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let i of d){let t=new Set;for(let l of i.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&t.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${a(i.name??"")}</h3>`);let c=new Map;for(let l of i.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,x=c.get(m);x||(x={cc:u.categoryCombo,des:[]},c.set(m,x)),x.des.push(u)}for(let l of c.values()){let u=l.cc.categoryOptionCombos??[],m=l.cc.categories??[];r.push('<div class="der-de-table-scroll">'),r.push('<table class="sectionTable" cellspacing="0">');let x=Te(m,u);if(r.push("<thead>"),x.length>0)for(let y=0;y<x.length;y++){r.push("<tr>"),y===0&&r.push(`<th class="dataElementCell" rowspan="${x.length}">`+a(l.cc.name??"Data element")+"</th>");for(let v of x[y]??[])r.push(`<th colspan="${v.span}">${a(v.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${a(l.cc.name??"Data element")}</th>`);for(let y of u)r.push(`<th>${a(y.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let y of l.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${a(y.id)}-cell">`+a(y.formName??y.name??y.id)+"</td>");for(let v of u){let h=`${y.id}-${v.id}-val`;t.has(`${y.id}:${v.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${a(h)}" name="${a(h)}" dataelementid="${a(y.id)}" optioncomboid="${a(v.id)}"></td>`)}r.push("</tr>")}for(let y of i.indicators??[]){let v=s[y.id];v&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${a(v.name??v.id)}</td>`),r.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(v.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table></div>")}}return r.join(`
`)}function Te(n,e){if(n.length===0)return[];let s=n.map(o=>o.categoryOptions?.length??0);if(s.some(o=>o===0))return[];let d=[];for(let o=0;o<n.length;o++){let a=[],r=1;for(let t=o+1;t<n.length;t++)r*=s[t]??1;let i=1;for(let t=0;t<o;t++)i*=s[t]??1;for(let t=0;t<i;t++)for(let c of n[o]?.categoryOptions??[])a.push({label:c.name??c.id,span:r});d.push(a)}return d}function Ae(n){let e=globalThis;e.dhis2=e.dhis2??{};let s=e.dhis2;s.de=s.de??{};let d=s.de;d.currentDataSetId=n.dataSetId,d.currentOrganisationUnitId=n.orgUnitId,d.currentPeriodId=n.periodId,d.currentCategorySelections={...n.aocSelections??{}};let o=n.meta??{},a={},r={};if(o.categoryCombo){r[o.categoryCombo.id]=o.categoryCombo;for(let u of o.categoryCombo.categories??[])a[u.id]=u}d.categories=a,d.categoryCombos=r;let i={},t={};for(let u of o.dataSetElements??[]){let m=u.dataElement;m&&(i[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(r[m.categoryCombo.id]=m.categoryCombo))}d.dataElements=i,d.optionSets=t;let c={};for(let u of o.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};d.indicatorFormulas=c;let l={};for(let u of n.validationRules??[])l[u.id]=u;d.validationRules=l,d.lockExceptions=[],d.emptyOrganisationUnits=[],d.significantZeros=[],d.dataSets={[o.id]:{id:o.id,name:o.name??o.displayName??"",periodType:o.periodType,categoryCombo:o.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ne(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function _e(n,e){if(!n)return;for(let[d,o]of Object.entries(e)){let a=n.querySelector(`input[data-der-category="${d}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${d}`,a.setAttribute("data-der-category",d),n.appendChild(a)),a.value=o}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...e})}function je(n,e,s,d,o,a){let r=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},i=new WeakMap,t=n.querySelectorAll('input[name$="-val"]');for(let l of Array.from(t))i.set(l,l.value);let c=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",x=r(m);if(!x)return;let y=e(),v=s(),h=d();if(!y||!v||!h)return;let w=u.value;if(i.get(u)!==w){J(u,"saving");try{let k=await a.submitAggregate({dataSet:y,period:v,orgUnit:h,attributeOptionComboSelections:o(),dataValues:[{dataElement:x.de,categoryOptionCombo:x.coc,value:w}]});i.set(u,w),J(u,k?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{J(u,"error")}}};n.addEventListener("blur",l=>{c(l)},!0)}function Re(n){n.addEventListener("keydown",e=>{let s=e;if(s.key!=="Enter")return;let d=s.target;if(!(d instanceof HTMLInputElement))return;let o=d.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(o);if(!a)return;s.preventDefault();let r=a[2],i=Array.from(n.querySelectorAll(`input[name$="-${r}-val"]`)),t=i.indexOf(d);if(t===-1)return;let c=i[t+(s.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function De({targetRef:n,formVersion:e}){let[s,d]=S([]),[o,a]=S("");return N(()=>{let r=n.current;if(!r)return;let t=Array.from(r.querySelectorAll("h3.formSection")).map((c,l)=>{let u=c.id||`der-de-section-${l}`;return c.id=u,{id:u,label:(c.textContent??"").trim(),el:c}}).filter(c=>c.label);d(t),a(t[0]?.id??"")},[n,e]),N(()=>{if(s.length===0)return;let r=new IntersectionObserver(i=>{let t=null;for(let c of i){if(!c.isIntersecting)continue;let l=c.target.id;l&&(!t||c.intersectionRatio>t.ratio)&&(t={id:l,ratio:c.intersectionRatio})}t&&a(t.id)},{threshold:[0,.2,.4,.6],rootMargin:"-80px 0px -60% 0px"});for(let i of s)r.observe(i.el);return()=>r.disconnect()},[s]),s.length<2?null:E("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:s.map(r=>p("li",{children:p("button",{type:"button",className:"der-de-section-nav__item"+(o===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>{r.el.scrollIntoView({behavior:"smooth",block:"start"}),a(r.id)},children:r.label})},r.id))})]})}function Ie({root:n,formVersion:e}){let[s,d]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(N(()=>{let r=()=>{let t=n.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),l=0,u=0,m=0,x=0,y=0;for(let v of c){v.value.trim()!==""&&l++;let h=v.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?u++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?x++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?m++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&y++}d({total:c.length,filled:l,saving:u,saved:m,queued:x,error:y})};r();let i=window.setInterval(r,800);return()=>window.clearInterval(i)},[n,e]),s.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let o=[];o.push(`${s.filled} of ${s.total} filled`),s.saving>0&&o.push(`${s.saving} saving`),s.queued>0&&o.push(`${s.queued} queued`),s.error>0&&o.push(`${s.error} error`);let a=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${a}`,"data-test":"de-save-state",children:o.join(" \xB7 ")})}function Oe(n,e){if(!n)return;let d=globalThis.dhis2?.de?.dataElements??{},o=Array.from(n.querySelectorAll('input[name$="-val"]')),a=[];for(let r of o){r.style.outline="";let i=r.value.trim();if(i==="")continue;let t=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!t)continue;let c=t[1],l=d[c],u=l?.valueType??"TEXT",m=Me(i,u);m&&(r.style.outline="2px solid #a93232",a.push(`${l?.valueType?"":"(unknown DE) "}${c}: ${m}`))}a.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${a.length} issue${a.length===1?"":"s"}. First: ${a[0]}`})}function Me(n,e){let s=Number(n),d=Number.isInteger(s);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(e){case"INTEGER":if(!d)return"must be an integer";break;case"INTEGER_POSITIVE":if(!d||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!d||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!d||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function J(n,e){let s=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${s}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function Pe(n,e,s,d,o){if(!e||!s||!d)return;let a;try{a=(await o.readAggregateValues(d,s,2e3)).dataValues??[]}catch{return}for(let r of a){let i=r.dataElement,t=r.categoryOptionCombo,c=r.value;if(!i||!t||c==null)continue;let l=n.querySelector(`input[name="${i}-${t}-val"]`);l&&(l.value=c)}}function se(n){return new Promise((e,s)=>{let d=document.createElement("script");d.src=n,d.async=!1,d.setAttribute("data-der-custom-form",n),d.onload=()=>e(),d.onerror=()=>s(new Error(`failed to load ${n}`)),document.head.appendChild(d)})}function de(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function ne(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function qe(n,e){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let o of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(o.tagName==="LINK"){let a=o.getAttribute("href")??"";a&&de(ne(a))}else{let a=document.createElement("style");a.textContent=o.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}o.remove()}let d=[];for(let o of Array.from(s.querySelectorAll("script"))){let a=o.getAttribute("src");a?d.push({src:ne(a)}):d.push({code:o.textContent??""}),o.remove()}for(let o of Array.from(s.body.childNodes))n.appendChild(document.adoptNode(o));for(let o of d)if(o.src)document.querySelector(`script[data-der-custom-form="${o.src}"]`)||await se(o.src);else if(o.code){let a=document.createElement("script");a.textContent=o.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var q={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},oe={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ae={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Ue={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Fe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Le(n,e,s){let d={...q},o=Be(n);if(o.length===0)return p("input",{value:e,onChange:m=>s(m.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:d});let a=[...o];if(e&&!a.some(m=>m.id===e)){let m=Ve(n,e)??e;a.unshift({id:e,label:m})}let r=o[0]?.id??null,i=a.findIndex(m=>m.id===e),t=i===-1||i<a.length-1||!!n,c=e!==""&&(i>0||e!==r),l=()=>{if(!n)return;let m=i>=0&&i<a.length-1?a[i+1]?.id??"":ie(n,e||r||"",-1);m&&s(m)},u=()=>{if(!n||!e||e===r)return;let m=i>0?a[i-1]?.id??"":ie(n,e,1);m&&s(m)};return E("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),E("select",{value:e,onChange:m=>s(m.target.value),style:d,children:[p("option",{value:"",children:"Select a period\u2026"}),a.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function ie(n,e,s){let d=o=>String(o).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let o=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,r=Number(e.slice(6,8)),i=new Date(o,a,r+s);return`${i.getFullYear()}${d(i.getMonth()+1)}${d(i.getDate())}`}case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+s;return r<1?(a-=1,r=G(a)):r>G(a)&&(a+=1,r=1),`${a}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let o=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,r=o*12+a+s;return`${Math.floor(r/12)}${d((r%12+12)%12+1)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+s;return r<1?(a-=1,r=6):r>6&&(a+=1,r=1),`${a}${d(r)}B`}case"Quarterly":{let o=/^(\d{4})Q(\d)$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+s;return r<1?(a-=1,r=4):r>4&&(a+=1,r=1),`${a}Q${r}`}case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);if(!o)return"";let a=Number(o[1]),r=Number(o[2])+s;return r<1?(a-=1,r=2):r>2&&(a+=1,r=1),`${a}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+s):"";default:return""}}function Ve(n,e){let s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let d=/^(\d{4})W(\d{1,2})$/.exec(e);return d?`${d[1]} W${String(d[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let d=Number(e.slice(4,6))-1;return`${s[d]??""} ${e.slice(0,4)}`}case"BiMonthly":{let d=/^(\d{4})(\d{2})B$/.exec(e);if(!d)return null;let o=(Number(d[2])-1)*2;return`${s[o]}\u2013${s[o+1]} ${d[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let d=/^(\d{4})S(\d)$/.exec(e);return d?`${d[1]} ${d[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Be(n){let e=new Date,s=e.getFullYear(),d=e.getMonth(),o=r=>String(r).padStart(2,"0"),a=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let r=[];for(let i=0;i<30;i++){let t=new Date(e);t.setDate(t.getDate()-i);let c=`${t.getFullYear()}${o(t.getMonth()+1)}${o(t.getDate())}`,l=`${t.getFullYear()}-${o(t.getMonth()+1)}-${o(t.getDate())}`;r.push({id:c,label:l})}return r}case"Weekly":{let r=[],i=le(e),t=i.year,c=i.week;for(let l=0;l<12;l++)r.push({id:`${t}W${c}`,label:`${t} W${o(c)}`}),c-=1,c<1&&(t-=1,c=G(t));return r}case"Monthly":{let r=[];for(let i=0;i<24;i++){let t=s,c=d,l=t*12+c-i,u=Math.floor(l/12),m=(l%12+12)%12;r.push({id:`${u}${o(m+1)}`,label:`${a[m]} ${u}`})}return r}case"BiMonthly":{let r=[],i=Math.floor(d/2)+1,t=s,c=i;for(let l=0;l<12;l++){let u=(c-1)*2;r.push({id:`${t}${o(c)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return r}case"Quarterly":{let r=[],i=Math.floor(d/3)+1,t=s,c=i;for(let l=0;l<8;l++)r.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return r}case"SixMonthly":{let r=[],i=d<6?1:2,t=s,c=i;for(let l=0;l<6;l++)r.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return r}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let r=[];for(let i=0;i<10;i++){let t=s-i;r.push({id:String(t),label:String(t)})}return r}default:return[]}}function le(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),s=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-s);let d=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-d.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function G(n){return le(new Date(n,11,28)).week}var He=`
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
  border: 1px solid #e5e9ef;
  padding: var(--der-de-cell-pad, 4px 8px);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}
/* Sticky column headers \u2014 stay visible as the grid scrolls down.
   thead stacks above the first-column dataElementCell via z-index. */
.der-de-form-card .sectionTable thead th {
  position: sticky;
  top: 0;
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
  z-index: 2;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #f8fafc;
  min-width: var(--der-de-de-col, 200px);
  max-width: var(--der-de-de-col-max, 320px);
  white-space: normal;
  position: sticky;
  left: 0;
  z-index: 1;
}
.der-de-form-card .sectionTable thead th.dataElementCell {
  z-index: 3; /* corner cell sits above both axes. */
}
/* Each table gets its own horizontal scroll container so wide
   disaggregations don't push the whole form around. */
.der-de-form-card .der-de-table-scroll {
  overflow-x: auto;
  margin: 8px 0 20px;
  border: 1px solid #eef0f3;
  border-radius: 6px;
  background: #fff;
}
.der-de-form-card .der-de-table-scroll .sectionTable {
  margin: 0;
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
/* Compact density \u2014 the default. Dense enough to show large
   multi-dimensional disaggregations without a horizontal
   scroll in most cases. */
.der-de-form-card.der-de-density-compact {
  --der-de-cell-pad: 3px 6px;
  --der-de-de-col: 180px;
  --der-de-de-col-max: 260px;
}
.der-de-form-card.der-de-density-compact .sectionTable {
  font-size: 12px;
}
.der-de-form-card.der-de-density-compact .sectionTable input[type="text"] {
  font-size: 12px;
  padding: 1px 3px;
}
.der-de-form-card.der-de-density-compact h3.formSection {
  font-size: 13px;
}
/* Comfortable density \u2014 roomier spacing for operators on
   tablets or anyone who wants a bigger tap target. */
.der-de-form-card.der-de-density-comfortable {
  --der-de-cell-pad: 8px 10px;
  --der-de-de-col: 240px;
  --der-de-de-col-max: 360px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable {
  font-size: 14px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable input[type="text"] {
  font-size: 14px;
  padding: 4px 6px;
}
.der-de-form-card.der-de-density-comfortable h3.formSection {
  font-size: 17px;
}
.der-de-density-btn {
  padding: 4px 10px;
  border: 1px solid #c0c7cf;
  border-radius: 10px;
  background: #fff;
  color: #404b5a;
  font-size: 12px;
  cursor: pointer;
}
.der-de-density-btn:hover {
  background: #f3f5f7;
}
`;export{ke as default};
