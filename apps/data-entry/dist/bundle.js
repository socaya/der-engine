/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as se,useState as k}from"react";import{useAuth as Se,useOrgUnitBinding as Ce,useOnlineStatus as Te,useDerApi as $e,ScreenCard as Ae,StatusPill as je}from"@der/app-sdk";import{Fragment as ue,jsx as c,jsxs as b}from"react/jsx-runtime";function Ie(){let o=Se(),e=Ce(),i=Te(),d=$e(),[n,t]=k("custom"),[a,s]=k([]),[r,m]=k(""),[l,u]=k(""),[p,h]=k(""),[y,x]=k(""),[v,_]=k({kind:"idle"}),[E,j]=k(null),C=se(null),[K,Z]=k({}),F=se({}),[z,ye]=k([]),[I,P]=k(null),[V,ee]=k(!1),[te,be]=k(0),[q,he]=k([]),[B,H]=k(!1),[ve,xe]=k(null),[re,ae]=k(!0),[O,we]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",O)}catch{}},[O]),$(()=>{let g=!1;return(async()=>{try{let f=await d.listDataSets();if(g)return;let S=(f.dataSets??[]).map(N=>({id:N.id,label:N.displayName??N.name??N.id,periodType:N.periodType,formType:N.formType})).sort((N,A)=>N.label.localeCompare(A.label));s(S)}catch{}})(),()=>{g=!0}},[]),$(()=>{if(r.trim()===""){j(null);return}let g=!1;return(async()=>{try{let f=await d.getDataSetMeta(r.trim());if(g)return;let S=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";j({hasCustomForm:S,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),t(S?"custom":"structured")}catch{g||j(null)}})(),()=>{g=!0}},[r]),$(()=>{if(n!=="custom"||!E?.hasCustomForm||E.formType==="CUSTOM"&&!E.formId)return;let g=C.current;if(!g)return;let f=!1;return(async()=>{_({kind:"submitting"});try{let S=await d.getDataSetFormMetadata(r.trim());if(f)return;let N=await Oe(S,d);if(f)return;let A="";if(E.formType==="CUSTOM"&&E.formId){try{A=(await d.getDataEntryFormHtml(E.formId)).htmlCode??""}catch(w){A="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",w)}A.trim()||(A=ie(N))}else E.formType==="SECTION"&&(A=ie(N));if(f)return;let Ne=await d.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(f)return;let oe=(N.categoryCombo?.categories??[]).filter(w=>(w.categoryOptions?.length??0)>1).map(w=>({id:w.id,name:w.name??w.id,options:(w.categoryOptions??[]).map(R=>({id:R.id,name:R.name??R.id}))}));ye(oe);let L={};for(let w of oe)w.options[0]&&(L[w.id]=w.options[0].id);Z(L),F.current=L,g.replaceChildren();for(let[w,R]of[["selectedDataSetId",r.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let T=document.createElement("input");T.type="hidden",T.id=w,T.value=R,g.appendChild(T)}for(let[w,R]of Object.entries(L)){let T=document.createElement("input");T.type="hidden",T.id=`category-${w}`,T.value=R,T.setAttribute("data-der-category",w),g.appendChild(T)}let D=document.createElement("div");D.id="contentDiv",g.appendChild(D),Le({dataSetId:r.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:N,aocSelections:L,validationRules:Ne.validationRules??[]});for(let w of Re)ge(w);for(let w of De)document.querySelector(`script[data-der-custom-form="${w}"]`)||await pe(w);Pe(),await Xe(D,A),await Ye(D,r.trim(),l.trim(),e.orgUnitUid??"",d),Ue(D,()=>r.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),d),Fe(D),Je(D,N,xe),be(w=>w+1),_({kind:"idle"})}catch(S){_({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{f=!0}},[n,E,r,l,e.orgUnitUid]);let _e=e.bound&&r.trim()!==""&&l.trim()!==""&&p.trim()!==""&&y.trim()!==""&&v.kind!=="submitting";async function ke(g){g.preventDefault(),_({kind:"submitting"});try{await d.submitAggregate({dataSet:r,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:y}]}),_({kind:"ok",message:`Submitted ${p}=${y} for ${l}.`}),h(""),x("")}catch(f){_({kind:"error",message:f.message??"Submission failed"})}}let ne=l.trim()!=="",Q=r.trim()!=="",M=Q&&ne&&e.bound;$(()=>{if(!M){P(null);return}let g=!1;return(async()=>{try{let f=await d.getCompletion(r.trim(),e.orgUnitUid??"",l.trim());if(g)return;P({completed:!!f.completed,completedAt:f.completedAt})}catch{g||P({completed:!1})}})(),()=>{g=!0}},[r,l,e.orgUnitUid,M]);async function Ee(){if(!M||V)return;let g=!I?.completed;ee(!0);try{let f=await d.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:g});P({completed:!!f.completed,completedAt:f.completedAt}),_({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){_({kind:"error",message:`Completion failed: ${f.message}`})}finally{ee(!1)}}return b(Ae,{title:"Aggregate data entry",actions:c(je,{tone:i.isOnline?"success":"warning",children:i.isOnline?"online":`offline (${i.queuedCount} queued)`}),children:[c("style",{children:at}),b("div",{className:"der-de-context",children:[b("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Organisation unit"}),c("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),b("div",{className:"der-de-chip",children:[c("span",{className:"der-de-chip-label",children:"Data set"}),b("select",{className:"der-de-select",value:r,onChange:g=>{m(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[c("option",{value:"",children:"Select a data set\u2026"}),a.map(g=>c("option",{value:g.id,children:g.label},g.id))]})]}),b("div",{className:"der-de-chip",children:[b("span",{className:"der-de-chip-label",children:["Period ",E?.periodType?`\xB7 ${E.periodType}`:""]}),c("span",{className:"der-de-period-wrap",children:et(E?.periodType,l,u)})]}),b("div",{className:"der-de-chip der-de-chip-signed",children:[c("span",{className:"der-de-chip-label",children:"Signed in"}),c("span",{className:"der-de-chip-value",children:o.displayName})]})]}),v.kind==="ok"&&c("div",{style:Ke,"data-test":"de-ok",children:v.message}),v.kind==="error"&&c("div",{style:Ze,"data-test":"de-err",children:v.message}),!e.bound&&c("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Q&&c("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Q&&!ne&&b("div",{className:"der-de-placeholder",children:["Pick a period to load the ",E?.formType==="SECTION"?"section":"data entry"," form."]}),M&&n==="structured"&&b("form",{onSubmit:ke,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[b("label",{children:["Data element UID",c("input",{value:p,onChange:g=>h(g.target.value),style:U})]}),b("label",{children:["Value",c("input",{value:y,onChange:g=>x(g.target.value),inputMode:"decimal",style:U})]}),c("div",{style:{gridColumn:"1 / -1"},children:c("button",{type:"submit",disabled:!_e,style:le,children:v.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),M&&n==="custom"&&b("div",{className:`der-de-form-card der-de-density-${O}`,children:[z.length>0&&c("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(z.length,3)}, 1fr)`,gap:12,marginBottom:12},children:z.map(g=>b("label",{children:[g.name,c("select",{value:K[g.id]??"",onChange:f=>{let S={...K,[g.id]:f.target.value};Z(S),F.current=S,qe(C.current,S)},style:U,children:g.options.map(f=>c("option",{value:f.id,children:f.name},f.id))})]},g.id))}),b("div",{className:"der-de-form-split",children:[c(Ve,{targetRef:C,formVersion:te}),c("div",{ref:C,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),M&&n==="custom"&&b("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[c(Be,{root:C,formVersion:te}),c("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${O==="compact"?"comfortable":"compact"} density`,title:`Density: ${O}. Click to switch.`,onClick:()=>we(g=>g==="compact"?"comfortable":"compact"),children:O==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),I&&c("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:I.completed?`Complete${I.completedAt?" \xB7 "+new Date(I.completedAt).toLocaleString():""}`:"Open for edits"}),c("button",{type:"button",onClick:()=>{We(C.current,_,g=>{he(g),H(g.length>0)})},style:ce,"data-test":"de-validate-btn",children:"Validate"}),q.length>0&&!B&&b("button",{type:"button",onClick:()=>H(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[q.length," issue",q.length===1?"":"s"]}),!re&&c("button",{type:"button",onClick:()=>ae(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),c("button",{type:"button",onClick:Ee,disabled:V,style:I?.completed?ce:le,"data-test":"de-complete-btn",children:V?"Saving\u2026":I?.completed?"Reopen":"Mark complete"})]}),c(Qe,{open:re&&!B,details:ve,onClose:()=>ae(!1)}),c(He,{open:B,issues:q,onClose:()=>H(!1),onPick:g=>{let f=C.current?.querySelector(`input[name="${g.inputName}"]`);f&&(f.scrollIntoView({behavior:"smooth",block:"center"}),f.focus(),f.select())}})]})}var De=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Re=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],J=null,W=null,G=null;async function Oe(o,e){J||(J=e.listAllDataElements().then(s=>new Map(s.map(r=>[r.id,r])))),W||(W=e.listAllCategoryCombos().then(s=>new Map(s.map(r=>[r.id,r])))),G||(G=e.listAllCategoryOptionCombos().then(s=>{let r=new Map;for(let m of s){let l=m.categoryCombo?.id;if(!l)continue;let u=r.get(l);u?u.push(m):r.set(l,[m])}return r}));let[i,d,n]=await Promise.all([J,W,G]),t=s=>{if(!s?.id)return;let r=d.get(s.id),m=n.get(s.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:m.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(r.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:s},a=s=>{let r=i.get(s.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:s};return{...o,categoryCombo:t(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(s=>({...s,dataElement:s.dataElement?a(s.dataElement):void 0})),sections:(o.sections??[]).map(s=>({...s,dataElements:(s.dataElements??[]).map(r=>a(r))}))}}function ie(o){let e={};for(let s of o.dataSetElements??[])s.dataElement&&(e[s.dataElement.id]=s.dataElement);let i={};for(let s of o.indicators??[])i[s.id]=s;let d=(o.sections??[]).slice().sort((s,r)=>(s.sortOrder??0)-(r.sortOrder??0));if(!d.some(s=>(s.dataElements?.length??0)>0)){let s=(o.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);d=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:s,indicators:[],greyedFields:[]}]}let t=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let s of d){let r=new Set;for(let l of s.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&r.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${t(s.name??"")}</h3>`);let m=new Map;for(let l of s.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,h=m.get(p);h||(h={cc:u.categoryCombo,des:[]},m.set(p,h)),h.des.push(u)}for(let l of m.values()){let u=l.cc.categoryOptionCombos??[],p=l.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let h=Me(p,u);if(a.push("<thead>"),h.length>0)for(let y=0;y<h.length;y++){a.push("<tr>"),y===0&&a.push(`<th class="dataElementCell" rowspan="${h.length}">`+t(l.cc.name??"Data element")+"</th>");for(let x of h[y]??[])a.push(`<th colspan="${x.span}">${t(x.label)}</th>`);a.push("</tr>")}else{a.push("<tr>"),a.push(`<th class="dataElementCell">${t(l.cc.name??"Data element")}</th>`);for(let y of u)a.push(`<th>${t(y.name??"")}</th>`);a.push("</tr>")}a.push("</thead><tbody>");for(let y of l.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${t(y.id)}-cell">`+t(y.formName??y.name??y.id)+"</td>");for(let x of u){let v=`${y.id}-${x.id}-val`;r.has(`${y.id}:${x.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${t(v)}" name="${t(v)}" dataelementid="${t(y.id)}" optioncomboid="${t(x.id)}"></td>`)}a.push("</tr>")}for(let y of s.indicators??[]){let x=i[y.id];x&&(a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${t(x.name??x.id)}</td>`),a.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${t(x.id)}" readonly></td>`),a.push("</tr>"))}a.push("</tbody></table></div>")}}return a.join(`
`)}function Me(o,e){if(o.length===0)return[];let i=o.map(n=>n.categoryOptions?.length??0);if(i.some(n=>n===0))return[];let d=[];for(let n=0;n<o.length;n++){let t=[],a=1;for(let r=n+1;r<o.length;r++)a*=i[r]??1;let s=1;for(let r=0;r<n;r++)s*=i[r]??1;for(let r=0;r<s;r++)for(let m of o[n]?.categoryOptions??[])t.push({label:m.name??m.id,span:a});d.push(t)}return d}function Le(o){let e=globalThis;e.dhis2=e.dhis2??{};let i=e.dhis2;i.de=i.de??{};let d=i.de;d.currentDataSetId=o.dataSetId,d.currentOrganisationUnitId=o.orgUnitId,d.currentPeriodId=o.periodId,d.currentCategorySelections={...o.aocSelections??{}};let n=o.meta??{},t={},a={};if(n.categoryCombo){a[n.categoryCombo.id]=n.categoryCombo;for(let u of n.categoryCombo.categories??[])t[u.id]=u}d.categories=t,d.categoryCombos=a;let s={},r={};for(let u of n.dataSetElements??[]){let p=u.dataElement;p&&(s[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}d.dataElements=s,d.optionSets=r;let m={};for(let u of n.indicators??[])m[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};d.indicatorFormulas=m;let l={};for(let u of o.validationRules??[])l[u.id]=u;d.validationRules=l,d.lockExceptions=[],d.emptyOrganisationUnits=[],d.significantZeros=[],d.dataSets={[n.id]:{id:n.id,name:n.name??n.displayName??"",periodType:n.periodType,categoryCombo:n.categoryCombo?.id,periodId:o.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,i.shim=i.shim??{},i.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Pe(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(e,i)=>{i.xhrFields={...i.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let e=o.dhis2.period;e.format="yyyy-mm-dd",e.calendar=o.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function qe(o,e){if(!o)return;for(let[d,n]of Object.entries(e)){let t=o.querySelector(`input[data-der-category="${d}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${d}`,t.setAttribute("data-der-category",d),o.appendChild(t)),t.value=n}let i=globalThis;i.dhis2?.de&&(i.dhis2.de.currentCategorySelections={...e})}function Ue(o,e,i,d,n,t){let a=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},s=new WeakMap,r=o.querySelectorAll('input[name$="-val"]');for(let l of Array.from(r))s.set(l,l.value);let m=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let p=u.getAttribute("name")??"",h=a(p);if(!h)return;let y=e(),x=i(),v=d();if(!y||!x||!v)return;let _=u.value;if(s.get(u)!==_){Y(u,"saving");try{let E=await t.submitAggregate({dataSet:y,period:x,orgUnit:v,attributeOptionComboSelections:n(),dataValues:[{dataElement:h.de,categoryOptionCombo:h.coc,value:_}]});s.set(u,_),Y(u,E?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{Y(u,"error")}}};o.addEventListener("blur",l=>{m(l)},!0)}function Fe(o){o.addEventListener("keydown",e=>{let i=e;if(i.key!=="Enter")return;let d=i.target;if(!(d instanceof HTMLInputElement))return;let n=d.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;i.preventDefault();let a=t[2],s=Array.from(o.querySelectorAll(`input[name$="-${a}-val"]`)),r=s.indexOf(d);if(r===-1)return;let m=s[r+(i.shiftKey?-1:1)];m?.focus(),m instanceof HTMLInputElement&&m.select()})}function ze(o){let e=Array.from(o.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let i=new Set(e),d=[],n=(t,a)=>{for(let s of i)if(s!==a&&t.contains(s))return!0;return!1};return e.forEach((t,a)=>{let s=t.id||`der-de-section-${a}`;t.id=s;let r=null,m=t.parentElement,l=null;for(;m&&m!==o&&!n(m,t);)l=m,m=m.parentElement;if(l&&l.children.length>1&&l!==o)r=l,r.classList.add("der-de-section-slot"),r.dataset.sectionId=s;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=s;let u=e[a+1]??null,p=[],h=t;for(;h&&h!==u;){let y=h.nextSibling;p.push(h),h=y}t.parentNode?.insertBefore(r,t);for(let y of p)r.appendChild(y)}d.push({id:s,label:(t.textContent??"").trim(),slot:r})}),d}function Ve({targetRef:o,formVersion:e}){let[i,d]=k([]),[n,t]=k("");return $(()=>{let a=o.current;if(!a)return;let s=ze(a);d(s),t(s[0]?.id??"")},[o,e]),$(()=>{if(!o.current||i.length===0)return;for(let r of i)r.slot.style.display=r.id===n?"":"none";let s=i.find(r=>r.id===n);s&&s.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,i,n]),i.length<2?null:b("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[c("div",{className:"der-de-section-nav__title",children:"Sections"}),c("ul",{className:"der-de-section-nav__list",children:i.map(a=>c("li",{children:c("button",{type:"button",className:"der-de-section-nav__item"+(n===a.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(a.id),children:a.label})},a.id))})]})}function Be({root:o,formVersion:e}){let[i,d]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let a=()=>{let r=o.current;if(!r)return;let m=Array.from(r.querySelectorAll('input[name$="-val"]')),l=0,u=0,p=0,h=0,y=0;for(let x of m){x.value.trim()!==""&&l++;let v=x.style.outline||"";v.includes("rgb(185, 134, 10)")||v.includes("#b9860a")?u++:v.includes("rgb(206, 123, 0)")||v.includes("#ce7b00")?h++:v.includes("rgb(26, 135, 84)")||v.includes("#1a8754")||v.includes("rgb(183, 220, 199)")||v.includes("#b7dcc7")?p++:(v.includes("rgb(169, 50, 50)")||v.includes("#a93232"))&&y++}d({total:m.length,filled:l,saving:u,saved:p,queued:h,error:y})};a();let s=window.setInterval(a,800);return()=>window.clearInterval(s)},[o,e]),i.total===0)return c("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let n=[];n.push(`${i.filled} of ${i.total} filled`),i.saving>0&&n.push(`${i.saving} saving`),i.queued>0&&n.push(`${i.queued} queued`),i.error>0&&n.push(`${i.error} error`);let t=i.error>0?"error":i.queued>0?"queued":i.saving>0?"saving":i.filled>0?"saved":"muted";return c("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:n.join(" \xB7 ")})}function He({open:o,issues:e,onClose:i,onPick:d}){return $(()=>{if(!o)return;let n=t=>{t.key==="Escape"&&i()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[o,i]),!o||e.length===0?null:b("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[b("header",{className:"der-de-issues-drawer__head",children:[b("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),c("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:i,children:"\xD7"})]}),c("ul",{className:"der-de-issues-drawer__list",children:e.map(n=>c("li",{children:b("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>d(n),children:[c("span",{className:"der-de-issues-drawer__de",children:n.deName}),c("span",{className:"der-de-issues-drawer__coc",children:n.cocName}),b("span",{className:"der-de-issues-drawer__why",children:[c("code",{className:"der-de-issues-drawer__value",children:n.value}),c("span",{children:n.problem})]})]})},`${n.deId}-${n.cocId}`))})]})}function Qe({open:o,details:e,onClose:i}){if(!o)return null;if(!e)return b("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[b("header",{className:"der-de-details-drawer__head",children:[c("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),c("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:i,children:"\xD7"})]}),c("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let d={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},n={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return b("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[b("header",{className:"der-de-details-drawer__head",children:[c("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),c("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:i,children:"\xD7"})]}),b("div",{className:"der-de-details-drawer__body",children:[c("div",{className:"der-de-details-drawer__de",children:e.deName}),c("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${n[e.saveState]}`,children:d[e.saveState]}),b("dl",{className:"der-de-details-drawer__meta",children:[c("dt",{children:"Value type"}),c("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&b(ue,{children:[c("dt",{children:"Form name"}),c("dd",{children:e.deFormName})]}),c("dt",{children:"Data element"}),c("dd",{children:c("code",{children:e.deId})}),c("dt",{children:"Category combo"}),c("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&b(ue,{children:[c("dt",{children:"Breakdown"}),c("dd",{children:c("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,a)=>b("li",{children:[c("span",{className:"der-de-details-drawer__cat",children:t.category}),c("span",{className:"der-de-details-drawer__opt",children:t.option})]},a))})})]}),c("dt",{children:"COC id"}),c("dd",{children:c("code",{children:e.cocId})}),c("dt",{children:"Current value"}),c("dd",{children:e.value||c("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Je(o,e,i){let d={};for(let t of e.dataSetElements??[])t.dataElement&&(d[t.dataElement.id]=t.dataElement);let n=t=>{let a=t.getAttribute("name")??t.id??"",s=/^(.+)-(.+)-val$/.exec(a);if(!s)return null;let r=s[1],m=s[2],l=d[r],u=l?.categoryCombo,p=u?.categoryOptionCombos?.find(j=>j.id===m),h=[],y=p?.name??p?.displayName??m,x=y.split(/,\s*/).filter(Boolean),v=u?.categories??[];x.forEach((j,C)=>{h.push({category:v[C]?.name??v[C]?.displayName??"",option:j})});let _=t.style.outline||"",E=_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?"saving":_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?"queued":_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?"saved":_.includes("rgb(169, 50, 50)")||_.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:m,deName:l?.name??r,deFormName:l?.formName,valueType:l?.valueType??"TEXT",optionSetId:l?.optionSet?.id,cocName:y,categoryBreakdown:h,value:t.value,saveState:E,inputName:a}};o.addEventListener("focusin",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let s=n(a);s&&i(s)}},!0),o.addEventListener("input",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let s=n(a);s&&i(s)}},!0)}function We(o,e,i){if(!o)return;let d=globalThis,n=d.dhis2?.de?.dataElements??{},t=d.dhis2?.de?.categoryOptionCombos??{},a=Array.from(o.querySelectorAll('input[name$="-val"]')),s=[];for(let r of a){r.style.outline="";let m=r.value.trim();if(m==="")continue;let l=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!l)continue;let u=l[1],p=l[2],h=n[u],y=h?.valueType??"TEXT",x=Ge(m,y);x&&(r.style.outline="2px solid #a93232",s.push({deId:u,cocId:p,valueType:y,value:m,problem:x,deName:h?.name??u,cocName:t[p]?.name??p,inputName:r.name}))}i(s),s.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${s.length} issue${s.length===1?"":"s"}. See the Issues panel.`})}function Ge(o,e){let i=Number(o),d=Number.isInteger(i);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(i))return"must be a number";break}switch(e){case"INTEGER":if(!d)return"must be an integer";break;case"INTEGER_POSITIVE":if(!d||i<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!d||i>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!d||i<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(i<0||i>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(i<0||i>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function Y(o,e){let i=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${i}`,o.style.transition="outline 150ms",e==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function Ye(o,e,i,d,n){if(!e||!i||!d)return;let t;try{t=(await n.readAggregateValues(d,i,2e3)).dataValues??[]}catch{return}for(let a of t){let s=a.dataElement,r=a.categoryOptionCombo,m=a.value;if(!s||!r||m==null)continue;let l=o.querySelector(`input[name="${s}-${r}-val"]`);l&&(l.value=m)}}function pe(o){return new Promise((e,i)=>{let d=document.createElement("script");d.src=o,d.async=!1,d.setAttribute("data-der-custom-form",o),d.onload=()=>e(),d.onerror=()=>i(new Error(`failed to load ${o}`)),document.head.appendChild(d)})}function ge(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=o,e.setAttribute("data-der-custom-form",o),document.head.appendChild(e)}function de(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Xe(o,e){let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let n of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(n.tagName==="LINK"){let t=n.getAttribute("href")??"";t&&ge(de(t))}else{let t=document.createElement("style");t.textContent=n.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}n.remove()}let d=[];for(let n of Array.from(i.querySelectorAll("script"))){let t=n.getAttribute("src");t?d.push({src:de(t)}):d.push({code:n.textContent??""}),n.remove()}for(let n of Array.from(i.body.querySelectorAll("*")))if(n.removeAttribute("style"),n.tagName==="INPUT"){let t=n.getAttribute("id")??"";t.endsWith("-val")&&n.getAttribute("name")!==t&&n.setAttribute("name",t)}for(let n of Array.from(i.body.childNodes))o.appendChild(document.adoptNode(n));for(let n of d)if(n.src)document.querySelector(`script[data-der-custom-form="${n.src}"]`)||await pe(n.src);else if(n.code){let t=document.createElement("script");t.textContent=n.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var U={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},le={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ce={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Ke={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Ze={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function et(o,e,i){let d={...U},n=rt(o);if(n.length===0)return c("input",{value:e,onChange:p=>i(p.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:d});let t=[...n];if(e&&!t.some(p=>p.id===e)){let p=tt(o,e)??e;t.unshift({id:e,label:p})}let a=n[0]?.id??null,s=t.findIndex(p=>p.id===e),r=s===-1||s<t.length-1||!!o,m=e!==""&&(s>0||e!==a),l=()=>{if(!o)return;let p=s>=0&&s<t.length-1?t[s+1]?.id??"":me(o,e||a||"",-1);p&&i(p)},u=()=>{if(!o||!e||e===a)return;let p=s>0?t[s-1]?.id??"":me(o,e,1);p&&i(p)};return b("span",{className:"der-de-period-nav",children:[c("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),b("select",{value:e,onChange:p=>i(p.target.value),style:d,children:[c("option",{value:"",children:"Select a period\u2026"}),t.map(p=>c("option",{value:p.id,children:p.label},p.id))]}),c("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!m,className:"der-de-period-btn",children:"\u25B6"})]})}function me(o,e,i){let d=n=>String(n).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=Number(e.slice(6,8)),s=new Date(n,t,a+i);return`${s.getFullYear()}${d(s.getMonth()+1)}${d(s.getDate())}`}case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=X(t)):a>X(t)&&(t+=1,a=1),`${t}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=n*12+t+i;return`${Math.floor(a/12)}${d((a%12+12)%12+1)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=6):a>6&&(t+=1,a=1),`${t}${d(a)}B`}case"Quarterly":{let n=/^(\d{4})Q(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=4):a>4&&(t+=1,a=1),`${t}Q${a}`}case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=2):a>2&&(t+=1,a=1),`${t}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+i):"";default:return""}}function tt(o,e){let i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let d=/^(\d{4})W(\d{1,2})$/.exec(e);return d?`${d[1]} W${String(d[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let d=Number(e.slice(4,6))-1;return`${i[d]??""} ${e.slice(0,4)}`}case"BiMonthly":{let d=/^(\d{4})(\d{2})B$/.exec(e);if(!d)return null;let n=(Number(d[2])-1)*2;return`${i[n]}\u2013${i[n+1]} ${d[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let d=/^(\d{4})S(\d)$/.exec(e);return d?`${d[1]} ${d[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function rt(o){let e=new Date,i=e.getFullYear(),d=e.getMonth(),n=a=>String(a).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":{let a=[];for(let s=0;s<30;s++){let r=new Date(e);r.setDate(r.getDate()-s);let m=`${r.getFullYear()}${n(r.getMonth()+1)}${n(r.getDate())}`,l=`${r.getFullYear()}-${n(r.getMonth()+1)}-${n(r.getDate())}`;a.push({id:m,label:l})}return a}case"Weekly":{let a=[],s=fe(e),r=s.year,m=s.week;for(let l=0;l<12;l++)a.push({id:`${r}W${m}`,label:`${r} W${n(m)}`}),m-=1,m<1&&(r-=1,m=X(r));return a}case"Monthly":{let a=[];for(let s=0;s<24;s++){let r=i,m=d,l=r*12+m-s,u=Math.floor(l/12),p=(l%12+12)%12;a.push({id:`${u}${n(p+1)}`,label:`${t[p]} ${u}`})}return a}case"BiMonthly":{let a=[],s=Math.floor(d/2)+1,r=i,m=s;for(let l=0;l<12;l++){let u=(m-1)*2;a.push({id:`${r}${n(m)}B`,label:`${t[u]}\u2013${t[u+1]} ${r}`}),m-=1,m<1&&(r-=1,m=6)}return a}case"Quarterly":{let a=[],s=Math.floor(d/3)+1,r=i,m=s;for(let l=0;l<8;l++)a.push({id:`${r}Q${m}`,label:`${r} Q${m}`}),m-=1,m<1&&(r-=1,m=4);return a}case"SixMonthly":{let a=[],s=d<6?1:2,r=i,m=s;for(let l=0;l<6;l++)a.push({id:`${r}S${m}`,label:`${r} ${m===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),m-=1,m<1&&(r-=1,m=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let s=0;s<10;s++){let r=i-s;a.push({id:String(r),label:String(r)})}return a}default:return[]}}function fe(o){let e=new Date(o.getFullYear(),o.getMonth(),o.getDate()),i=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-i);let d=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-d.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function X(o){return fe(new Date(o,11,28)).week}var at=`
.der-de-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 0 0 16px;
  padding: 10px 0 12px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(140%) blur(6px);
  border-bottom: 1px solid #e5e9ef;
  /* ADR-0037 \xA71.2 \u2014 sticky context strip so the operator always
   * sees which dataset/period/OU/AOC they are editing, even when
   * scrolling long section forms. 52 px matches the shell topbar
   * height so the two stack cleanly. */
  position: sticky;
  top: 52px;
  z-index: 5;
}
.der-de-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #f7f8fc;
  border-radius: 8px;
}
.der-de-chip-signed {
  background: #eef0f5;
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
  padding: 0;
  background: transparent;
}
.der-de-actionbar {
  position: sticky;
  bottom: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 -24px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: saturate(140%) blur(6px);
  border-top: 1px solid #e5e9ef;
  box-shadow: 0 -2px 6px rgba(16, 26, 50, 0.04);
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
    top: 140px;
    align-self: start;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    padding: 10px 6px;
    background: #f7f8fc;
    border-radius: 10px;
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
/* One section at a time. Each slot stretches to fill the form
 * column so the operator sees exactly the section they picked
 * \u2014 no accidental scroll into neighbours. */
.der-de-section-slot {
  margin: 0 0 12px;
}
/* Custom form visual integration. The inline-style strip in
 * applyFormAssets neutralises TBLP/legacy template colours +
 * rounded chrome; these rules give the author's table structure
 * DER's compact grid design back. */
.der-de-custom-form h1,
.der-de-custom-form h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: #1f4d70;
  border-bottom: 1px solid #e5e9ef;
  padding-bottom: 6px;
}
.der-de-custom-form .tblep-root,
.der-de-custom-form .tblep-head,
.der-de-custom-form .tblep-panel {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  margin: 0 0 16px !important;
}
.der-de-custom-form .tblep-kicker,
.der-de-custom-form .tblep-num {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  background: #eef4fa;
  color: #1f4d70;
  border-radius: 10px;
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 500;
}
.der-de-custom-form .tblep-lead,
.der-de-custom-form .tblep-note,
.der-de-custom-form .tblep-muted {
  color: #6e7a8a;
  font-size: 12px;
  margin: 4px 0 8px;
}
.der-de-custom-form .tblep-foot {
  display: none;
}
.der-de-custom-form .tblep-table,
.der-de-custom-form table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 12px;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form .tblep-table td,
.der-de-custom-form table th,
.der-de-custom-form table td {
  padding: 4px 8px !important;
  border: 1px solid #e5e9ef !important;
  text-align: left !important;
  vertical-align: middle;
  background: transparent !important;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form table th {
  background: #f3f5f7 !important;
  font-weight: 500;
  color: #404b5a;
}
.der-de-custom-form .tblep-table input[type="text"],
.der-de-custom-form table input[type="text"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  width: 100% !important;
  padding: 2px 4px !important;
  border: 0;
  background: transparent !important;
  font-size: 12px !important;
  color: #212934 !important;
  font-family: inherit;
}
.der-de-custom-form input[type="text"]:focus {
  outline: 1px solid #2c6693;
  background: #fff !important;
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
  padding: var(--der-de-cell-pad, 6px 8px);
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable thead th {
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
  text-align: center;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #fafbfd;
  min-width: var(--der-de-de-col, 200px);
  text-align: left;
}
/* Each table lives inside a container that normally fits the
   viewport (categories nest with colspan rather than forcing a
   wide flat matrix). Only scroll horizontally as a last resort
   when the operator chose Comfortable density on a very wide
   combo (Age \xD7 Sex \xD7 Status + 50+ DEs). */
.der-de-form-card .der-de-table-scroll {
  overflow-x: auto;
  margin: 6px 0 16px;
  background: transparent;
}
.der-de-form-card .der-de-table-scroll .sectionTable {
  margin: 0;
  width: 100%;
  border-collapse: collapse;
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
  border: 1px solid #e5e9ef;
  background: #fff;
  padding: 2px 4px;
  font-size: 13px;
  color: #212934;
  font-family: inherit;
  border-radius: 4px;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 3px rgba(74, 85, 206, 0.15);
}
/* Row-level focus tint \u2014 SECTION renderer tables + CUSTOM
 * author tables both get a subtle indigo wash when the row
 * contains focus or is being hovered, so the operator always
 * knows which row they are typing into. */
.der-de-form-card .sectionTable tbody tr:hover,
.der-de-form-card .sectionTable tbody tr:focus-within,
.der-de-custom-form table tbody tr:hover,
.der-de-custom-form table tbody tr:focus-within {
  background: #eef4fa;
}
.der-de-form-card .sectionTable tbody tr:focus-within
  .dataElementCell,
.der-de-custom-form table tbody tr:focus-within td:first-child {
  color: #1f2779;
  font-weight: 500;
}
/* Custom-form author inputs inherit the same visual language as
 * SECTION-renderer inputs: 1 px border, 4 px radius, indigo
 * focus ring. */
.der-de-custom-form input[name$="-val"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  border: 1px solid #e5e9ef !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  background: #fff !important;
}
.der-de-custom-form input[name$="-val"]:focus,
.der-de-custom-form input[name="entryfield"]:focus,
.der-de-custom-form input[name="total"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce) !important;
  box-shadow: 0 0 0 3px rgba(74, 85, 206, 0.15);
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
.der-de-issues-chip {
  padding: 4px 10px;
  border: 1px solid #e0bcbc;
  border-radius: 10px;
  background: #fbeaea;
  color: #8a2525;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.der-de-details-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 320px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e5e9ef;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(16, 26, 50, 0.08);
  z-index: 8;
}
.der-de-details-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-details-drawer__title {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
}
.der-de-details-drawer__close {
  padding: 0 6px;
  background: transparent; border: 0; cursor: pointer;
  color: #6e7a8a; font-size: 20px; line-height: 1;
}
.der-de-details-drawer__body {
  padding: 12px 14px;
  overflow-y: auto;
}
.der-de-details-drawer__empty {
  padding: 16px 14px;
  margin: 0;
  color: #6e7a8a;
  font-size: 13px;
}
.der-de-details-drawer__de {
  font-size: 14px;
  font-weight: 500;
  color: #1f2779;
  margin-bottom: 6px;
}
.der-de-details-drawer__state {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  margin-bottom: 12px;
}
.der-de-details-drawer__state--muted  { background: #eef0f5; color: #475061; }
.der-de-details-drawer__state--saved  { background: #e3f7eb; color: #1b8243; }
.der-de-details-drawer__state--saving { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--queued { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--error  { background: #fee2e2; color: #c0392b; }
.der-de-details-drawer__meta {
  display: grid;
  grid-template-columns: 90px 1fr;
  row-gap: 6px;
  column-gap: 10px;
  margin: 0;
  font-size: 12px;
}
.der-de-details-drawer__meta dt {
  color: #6e7a8a;
  font-weight: 400;
}
.der-de-details-drawer__meta dd {
  margin: 0;
  color: #101a32;
  overflow-wrap: anywhere;
}
.der-de-details-drawer__meta dd code {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #475061;
}
.der-de-details-drawer__empty-val {
  color: #9097a8;
}
.der-de-details-drawer__breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-details-drawer__breakdown li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
  font-size: 12px;
}
.der-de-details-drawer__cat {
  color: #6e7a8a;
}
.der-de-details-drawer__opt {
  color: #101a32;
  font-weight: 500;
}
.der-de-issues-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 360px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e0bcbc;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(28, 46, 70, 0.12);
  z-index: 10;
}
.der-de-issues-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fbeaea;
  border-bottom: 1px solid #e0bcbc;
}
.der-de-issues-drawer__title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #8a2525;
}
.der-de-issues-drawer__close {
  padding: 0 6px;
  background: transparent;
  border: 0;
  color: #8a2525;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.der-de-issues-drawer__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.der-de-issues-drawer__item {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  border: 0;
  border-bottom: 1px solid #eef0f3;
  background: transparent;
  color: #212934;
  cursor: pointer;
}
.der-de-issues-drawer__item:hover {
  background: #fdf5f5;
}
.der-de-issues-drawer__de {
  font-size: 13px;
  font-weight: 500;
}
.der-de-issues-drawer__coc {
  font-size: 11px;
  color: #6e7a8a;
}
.der-de-issues-drawer__why {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #8a2525;
}
.der-de-issues-drawer__value {
  padding: 1px 6px;
  border-radius: 3px;
  background: #fbeaea;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #8a2525;
}
`;export{Ie as default};
