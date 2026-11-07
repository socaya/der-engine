/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as oe,useState as E}from"react";import{useAuth as we,useOrgUnitBinding as Ee,useOnlineStatus as ke,useDerApi as Se,ScreenCard as Ce,StatusPill as Ne}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function _e(){let n=we(),e=Ee(),i=ke(),d=Se(),[r,a]=E("custom"),[o,s]=E([]),[t,c]=E(""),[l,u]=E(""),[m,b]=E(""),[y,x]=E(""),[w,S]=E({kind:"idle"}),[k,U]=E(null),A=oe(null),[K,X]=E({}),F=oe({}),[V,pe]=E([]),[j,P]=E(null),[z,Z]=E(!1),[ee,ge]=E(0),[L,fe]=E([]),[te,H]=E(!1),[R,ye]=E(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",R)}catch{}},[R]),$(()=>{let g=!1;return(async()=>{try{let f=await d.listDataSets();if(g)return;let N=(f.dataSets??[]).map(C=>({id:C.id,label:C.displayName??C.name??C.id,periodType:C.periodType,formType:C.formType})).sort((C,T)=>C.label.localeCompare(T.label));s(N)}catch{}})(),()=>{g=!0}},[]),$(()=>{if(t.trim()===""){U(null);return}let g=!1;return(async()=>{try{let f=await d.getDataSetMeta(t.trim());if(g)return;let N=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";U({hasCustomForm:N,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),a(N?"custom":"structured")}catch{g||U(null)}})(),()=>{g=!0}},[t]),$(()=>{if(r!=="custom"||!k?.hasCustomForm||k.formType==="CUSTOM"&&!k.formId)return;let g=A.current;if(!g)return;let f=!1;return(async()=>{S({kind:"submitting"});try{let N=await d.getDataSetFormMetadata(t.trim());if(f)return;let C=await Ae(N,d);if(f)return;let T="";if(k.formType==="CUSTOM"&&k.formId){try{T=(await d.getDataEntryFormHtml(k.formId)).htmlCode??""}catch(h){T="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",h)}T.trim()||(T=ae(C))}else k.formType==="SECTION"&&(T=ae(C));if(f)return;let xe=await d.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(f)return;let ne=(C.categoryCombo?.categories??[]).filter(h=>(h.categoryOptions?.length??0)>1).map(h=>({id:h.id,name:h.name??h.id,options:(h.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));pe(ne);let M={};for(let h of ne)h.options[0]&&(M[h.id]=h.options[0].id);X(M),F.current=M,g.replaceChildren();for(let[h,I]of[["selectedDataSetId",t.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let _=document.createElement("input");_.type="hidden",_.id=h,_.value=I,g.appendChild(_)}for(let[h,I]of Object.entries(M)){let _=document.createElement("input");_.type="hidden",_.id=`category-${h}`,_.value=I,_.setAttribute("data-der-category",h),g.appendChild(_)}let D=document.createElement("div");D.id="contentDiv",g.appendChild(D),Ie({dataSetId:t.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:C,aocSelections:M,validationRules:xe.validationRules??[]});for(let h of Te)ue(h);for(let h of $e)document.querySelector(`script[data-der-custom-form="${h}"]`)||await ce(h);Re(),await He(D,T),await ze(D,t.trim(),l.trim(),e.orgUnitUid??"",d),De(D,()=>t.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),d),Me(D),ge(h=>h+1),S({kind:"idle"})}catch(N){S({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{f=!0}},[r,k,t,l,e.orgUnitUid]);let be=e.bound&&t.trim()!==""&&l.trim()!==""&&m.trim()!==""&&y.trim()!==""&&w.kind!=="submitting";async function he(g){g.preventDefault(),S({kind:"submitting"});try{await d.submitAggregate({dataSet:t,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),S({kind:"ok",message:`Submitted ${m}=${y} for ${l}.`}),b(""),x("")}catch(f){S({kind:"error",message:f.message??"Submission failed"})}}let re=l.trim()!=="",B=t.trim()!=="",O=B&&re&&e.bound;$(()=>{if(!O){P(null);return}let g=!1;return(async()=>{try{let f=await d.getCompletion(t.trim(),e.orgUnitUid??"",l.trim());if(g)return;P({completed:!!f.completed,completedAt:f.completedAt})}catch{g||P({completed:!1})}})(),()=>{g=!0}},[t,l,e.orgUnitUid,O]);async function ve(){if(!O||z)return;let g=!j?.completed;Z(!0);try{let f=await d.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:g});P({completed:!!f.completed,completedAt:f.completedAt}),S({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){S({kind:"error",message:`Completion failed: ${f.message}`})}finally{Z(!1)}}return v(Ce,{title:"Aggregate data entry",actions:p(Ne,{tone:i.isOnline?"success":"warning",children:i.isOnline?"online":`offline (${i.queuedCount} queued)`}),children:[p("style",{children:Ye}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:t,onChange:g=>{c(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),o.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",k?.periodType?`\xB7 ${k.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Je(k?.periodType,l,u)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:n.displayName})]})]}),w.kind==="ok"&&p("div",{style:Be,"data-test":"de-ok",children:w.message}),w.kind==="error"&&p("div",{style:Qe,"data-test":"de-err",children:w.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!re&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),O&&r==="structured"&&v("form",{onSubmit:he,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:m,onChange:g=>b(g.target.value),style:q})]}),v("label",{children:["Value",p("input",{value:y,onChange:g=>x(g.target.value),inputMode:"decimal",style:q})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!be,style:ie,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),O&&r==="custom"&&v("div",{className:`der-de-form-card der-de-density-${R}`,children:[V.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(V.length,3)}, 1fr)`,gap:12,marginBottom:12},children:V.map(g=>v("label",{children:[g.name,p("select",{value:K[g.id]??"",onChange:f=>{let N={...K,[g.id]:f.target.value};X(N),F.current=N,Oe(A.current,N)},style:q,children:g.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},g.id))}),v("div",{className:"der-de-form-split",children:[p(Le,{targetRef:A,formVersion:ee}),p("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),O&&r==="custom"&&v("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(qe,{root:A,formVersion:ee}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${R==="compact"?"comfortable":"compact"} density`,title:`Density: ${R}. Click to switch.`,onClick:()=>ye(g=>g==="compact"?"comfortable":"compact"),children:R==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),j&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:j.completed?`Complete${j.completedAt?" \xB7 "+new Date(j.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Fe(A.current,S,g=>{fe(g),H(g.length>0)})},style:de,"data-test":"de-validate-btn",children:"Validate"}),L.length>0&&!te&&v("button",{type:"button",onClick:()=>H(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[L.length," issue",L.length===1?"":"s"]}),p("button",{type:"button",onClick:ve,disabled:z,style:j?.completed?de:ie,"data-test":"de-complete-btn",children:z?"Saving\u2026":j?.completed?"Reopen":"Mark complete"})]}),p(Ue,{open:te,issues:L,onClose:()=>H(!1),onPick:g=>{let f=A.current?.querySelector(`input[name="${g.inputName}"]`);f&&(f.scrollIntoView({behavior:"smooth",block:"center"}),f.focus(),f.select())}})]})}var $e=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Te=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Q=null,J=null,W=null;async function Ae(n,e){Q||(Q=e.listAllDataElements().then(s=>new Map(s.map(t=>[t.id,t])))),J||(J=e.listAllCategoryCombos().then(s=>new Map(s.map(t=>[t.id,t])))),W||(W=e.listAllCategoryOptionCombos().then(s=>{let t=new Map;for(let c of s){let l=c.categoryCombo?.id;if(!l)continue;let u=t.get(l);u?u.push(c):t.set(l,[c])}return t}));let[i,d,r]=await Promise.all([Q,J,W]),a=s=>{if(!s?.id)return;let t=d.get(s.id),c=r.get(s.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(t.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:s},o=s=>{let t=i.get(s.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:s};return{...n,categoryCombo:a(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(s=>({...s,dataElement:s.dataElement?o(s.dataElement):void 0})),sections:(n.sections??[]).map(s=>({...s,dataElements:(s.dataElements??[]).map(t=>o(t))}))}}function ae(n){let e={};for(let s of n.dataSetElements??[])s.dataElement&&(e[s.dataElement.id]=s.dataElement);let i={};for(let s of n.indicators??[])i[s.id]=s;let d=(n.sections??[]).slice().sort((s,t)=>(s.sortOrder??0)-(t.sortOrder??0));if(!d.some(s=>(s.dataElements?.length??0)>0)){let s=(n.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);d=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:s,indicators:[],greyedFields:[]}]}let a=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),o=[];for(let s of d){let t=new Set;for(let l of s.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&t.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);o.push(`<h3 class="formSection">${a(s.name??"")}</h3>`);let c=new Map;for(let l of s.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,b=c.get(m);b||(b={cc:u.categoryCombo,des:[]},c.set(m,b)),b.des.push(u)}for(let l of c.values()){let u=l.cc.categoryOptionCombos??[],m=l.cc.categories??[];o.push('<div class="der-de-table-scroll">'),o.push('<table class="sectionTable" cellspacing="0">');let b=je(m,u);if(o.push("<thead>"),b.length>0)for(let y=0;y<b.length;y++){o.push("<tr>"),y===0&&o.push(`<th class="dataElementCell" rowspan="${b.length}">`+a(l.cc.name??"Data element")+"</th>");for(let x of b[y]??[])o.push(`<th colspan="${x.span}">${a(x.label)}</th>`);o.push("</tr>")}else{o.push("<tr>"),o.push(`<th class="dataElementCell">${a(l.cc.name??"Data element")}</th>`);for(let y of u)o.push(`<th>${a(y.name??"")}</th>`);o.push("</tr>")}o.push("</thead><tbody>");for(let y of l.des){o.push("<tr>"),o.push(`<td class="dataElementCell" id="${a(y.id)}-cell">`+a(y.formName??y.name??y.id)+"</td>");for(let x of u){let w=`${y.id}-${x.id}-val`;t.has(`${y.id}:${x.id}`)?o.push('<td class="greyed">\u2014</td>'):o.push(`<td><input type="text" id="${a(w)}" name="${a(w)}" dataelementid="${a(y.id)}" optioncomboid="${a(x.id)}"></td>`)}o.push("</tr>")}for(let y of s.indicators??[]){let x=i[y.id];x&&(o.push('<tr class="indicatorRow">'),o.push(`<td class="dataElementCell">${a(x.name??x.id)}</td>`),o.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(x.id)}" readonly></td>`),o.push("</tr>"))}o.push("</tbody></table></div>")}}return o.join(`
`)}function je(n,e){if(n.length===0)return[];let i=n.map(r=>r.categoryOptions?.length??0);if(i.some(r=>r===0))return[];let d=[];for(let r=0;r<n.length;r++){let a=[],o=1;for(let t=r+1;t<n.length;t++)o*=i[t]??1;let s=1;for(let t=0;t<r;t++)s*=i[t]??1;for(let t=0;t<s;t++)for(let c of n[r]?.categoryOptions??[])a.push({label:c.name??c.id,span:o});d.push(a)}return d}function Ie(n){let e=globalThis;e.dhis2=e.dhis2??{};let i=e.dhis2;i.de=i.de??{};let d=i.de;d.currentDataSetId=n.dataSetId,d.currentOrganisationUnitId=n.orgUnitId,d.currentPeriodId=n.periodId,d.currentCategorySelections={...n.aocSelections??{}};let r=n.meta??{},a={},o={};if(r.categoryCombo){o[r.categoryCombo.id]=r.categoryCombo;for(let u of r.categoryCombo.categories??[])a[u.id]=u}d.categories=a,d.categoryCombos=o;let s={},t={};for(let u of r.dataSetElements??[]){let m=u.dataElement;m&&(s[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(o[m.categoryCombo.id]=m.categoryCombo))}d.dataElements=s,d.optionSets=t;let c={};for(let u of r.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};d.indicatorFormulas=c;let l={};for(let u of n.validationRules??[])l[u.id]=u;d.validationRules=l,d.lockExceptions=[],d.emptyOrganisationUnits=[],d.significantZeros=[],d.dataSets={[r.id]:{id:r.id,name:r.name??r.displayName??"",periodType:r.periodType,categoryCombo:r.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,i.shim=i.shim??{},i.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Re(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,i)=>{i.xhrFields={...i.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Oe(n,e){if(!n)return;for(let[d,r]of Object.entries(e)){let a=n.querySelector(`input[data-der-category="${d}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${d}`,a.setAttribute("data-der-category",d),n.appendChild(a)),a.value=r}let i=globalThis;i.dhis2?.de&&(i.dhis2.de.currentCategorySelections={...e})}function De(n,e,i,d,r,a){let o=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},s=new WeakMap,t=n.querySelectorAll('input[name$="-val"]');for(let l of Array.from(t))s.set(l,l.value);let c=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",b=o(m);if(!b)return;let y=e(),x=i(),w=d();if(!y||!x||!w)return;let S=u.value;if(s.get(u)!==S){G(u,"saving");try{let k=await a.submitAggregate({dataSet:y,period:x,orgUnit:w,attributeOptionComboSelections:r(),dataValues:[{dataElement:b.de,categoryOptionCombo:b.coc,value:S}]});s.set(u,S),G(u,k?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{G(u,"error")}}};n.addEventListener("blur",l=>{c(l)},!0)}function Me(n){n.addEventListener("keydown",e=>{let i=e;if(i.key!=="Enter")return;let d=i.target;if(!(d instanceof HTMLInputElement))return;let r=d.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(r);if(!a)return;i.preventDefault();let o=a[2],s=Array.from(n.querySelectorAll(`input[name$="-${o}-val"]`)),t=s.indexOf(d);if(t===-1)return;let c=s[t+(i.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe(n){let e=Array.from(n.querySelectorAll("h2, h3, h4")).filter(a=>(a.textContent??"").trim().length>0);if(e.length<2)return[];let i=new Set(e),d=[],r=(a,o)=>{for(let s of i)if(s!==o&&a.contains(s))return!0;return!1};return e.forEach((a,o)=>{let s=a.id||`der-de-section-${o}`;a.id=s;let t=null,c=a.parentElement,l=null;for(;c&&c!==n&&!r(c,a);)l=c,c=c.parentElement;if(l&&l.children.length>1&&l!==n)t=l,t.classList.add("der-de-section-slot"),t.dataset.sectionId=s;else{t=document.createElement("div"),t.className="der-de-section-slot",t.dataset.sectionId=s;let u=e[o+1]??null,m=[],b=a;for(;b&&b!==u;){let y=b.nextSibling;m.push(b),b=y}a.parentNode?.insertBefore(t,a);for(let y of m)t.appendChild(y)}d.push({id:s,label:(a.textContent??"").trim(),slot:t})}),d}function Le({targetRef:n,formVersion:e}){let[i,d]=E([]),[r,a]=E("");return $(()=>{let o=n.current;if(!o)return;let s=Pe(o);d(s),a(s[0]?.id??"")},[n,e]),$(()=>{if(!n.current||i.length===0)return;for(let t of i)t.slot.style.display=t.id===r?"":"none";let s=i.find(t=>t.id===r);s&&s.slot.scrollIntoView({behavior:"smooth",block:"start"})},[n,i,r]),i.length<2?null:v("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:i.map(o=>p("li",{children:p("button",{type:"button",className:"der-de-section-nav__item"+(r===o.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>a(o.id),children:o.label})},o.id))})]})}function qe({root:n,formVersion:e}){let[i,d]=E({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let o=()=>{let t=n.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),l=0,u=0,m=0,b=0,y=0;for(let x of c){x.value.trim()!==""&&l++;let w=x.style.outline||"";w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?u++:w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?b++:w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?m++:(w.includes("rgb(169, 50, 50)")||w.includes("#a93232"))&&y++}d({total:c.length,filled:l,saving:u,saved:m,queued:b,error:y})};o();let s=window.setInterval(o,800);return()=>window.clearInterval(s)},[n,e]),i.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let r=[];r.push(`${i.filled} of ${i.total} filled`),i.saving>0&&r.push(`${i.saving} saving`),i.queued>0&&r.push(`${i.queued} queued`),i.error>0&&r.push(`${i.error} error`);let a=i.error>0?"error":i.queued>0?"queued":i.saving>0?"saving":i.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${a}`,"data-test":"de-save-state",children:r.join(" \xB7 ")})}function Ue({open:n,issues:e,onClose:i,onPick:d}){return $(()=>{if(!n)return;let r=a=>{a.key==="Escape"&&i()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[n,i]),!n||e.length===0?null:v("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[v("header",{className:"der-de-issues-drawer__head",children:[v("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:i,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(r=>p("li",{children:v("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>d(r),children:[p("span",{className:"der-de-issues-drawer__de",children:r.deName}),p("span",{className:"der-de-issues-drawer__coc",children:r.cocName}),v("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:r.value}),p("span",{children:r.problem})]})]})},`${r.deId}-${r.cocId}`))})]})}function Fe(n,e,i){if(!n)return;let d=globalThis,r=d.dhis2?.de?.dataElements??{},a=d.dhis2?.de?.categoryOptionCombos??{},o=Array.from(n.querySelectorAll('input[name$="-val"]')),s=[];for(let t of o){t.style.outline="";let c=t.value.trim();if(c==="")continue;let l=/^(.+)-(.+)-val$/.exec(t.getAttribute("name")??"");if(!l)continue;let u=l[1],m=l[2],b=r[u],y=b?.valueType??"TEXT",x=Ve(c,y);x&&(t.style.outline="2px solid #a93232",s.push({deId:u,cocId:m,valueType:y,value:c,problem:x,deName:b?.name??u,cocName:a[m]?.name??m,inputName:t.name}))}i(s),s.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${s.length} issue${s.length===1?"":"s"}. See the Issues panel.`})}function Ve(n,e){let i=Number(n),d=Number.isInteger(i);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(i))return"must be a number";break}switch(e){case"INTEGER":if(!d)return"must be an integer";break;case"INTEGER_POSITIVE":if(!d||i<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!d||i>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!d||i<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(i<0||i>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(i<0||i>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function G(n,e){let i=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${i}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function ze(n,e,i,d,r){if(!e||!i||!d)return;let a;try{a=(await r.readAggregateValues(d,i,2e3)).dataValues??[]}catch{return}for(let o of a){let s=o.dataElement,t=o.categoryOptionCombo,c=o.value;if(!s||!t||c==null)continue;let l=n.querySelector(`input[name="${s}-${t}-val"]`);l&&(l.value=c)}}function ce(n){return new Promise((e,i)=>{let d=document.createElement("script");d.src=n,d.async=!1,d.setAttribute("data-der-custom-form",n),d.onload=()=>e(),d.onerror=()=>i(new Error(`failed to load ${n}`)),document.head.appendChild(d)})}function ue(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function se(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function He(n,e){let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let r of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let a=r.getAttribute("href")??"";a&&ue(se(a))}else{let a=document.createElement("style");a.textContent=r.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}r.remove()}let d=[];for(let r of Array.from(i.querySelectorAll("script"))){let a=r.getAttribute("src");a?d.push({src:se(a)}):d.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(i.body.querySelectorAll("*")))if(r.removeAttribute("style"),r.tagName==="INPUT"){let a=r.getAttribute("id")??"";a.endsWith("-val")&&r.getAttribute("name")!==a&&r.setAttribute("name",a)}for(let r of Array.from(i.body.childNodes))n.appendChild(document.adoptNode(r));for(let r of d)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await ce(r.src);else if(r.code){let a=document.createElement("script");a.textContent=r.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var q={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ie={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},de={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Be={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Qe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Je(n,e,i){let d={...q},r=Ge(n);if(r.length===0)return p("input",{value:e,onChange:m=>i(m.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:d});let a=[...r];if(e&&!a.some(m=>m.id===e)){let m=We(n,e)??e;a.unshift({id:e,label:m})}let o=r[0]?.id??null,s=a.findIndex(m=>m.id===e),t=s===-1||s<a.length-1||!!n,c=e!==""&&(s>0||e!==o),l=()=>{if(!n)return;let m=s>=0&&s<a.length-1?a[s+1]?.id??"":le(n,e||o||"",-1);m&&i(m)},u=()=>{if(!n||!e||e===o)return;let m=s>0?a[s-1]?.id??"":le(n,e,1);m&&i(m)};return v("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:e,onChange:m=>i(m.target.value),style:d,children:[p("option",{value:"",children:"Select a period\u2026"}),a.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function le(n,e,i){let d=r=>String(r).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,o=Number(e.slice(6,8)),s=new Date(r,a,o+i);return`${s.getFullYear()}${d(s.getMonth()+1)}${d(s.getDate())}`}case"Weekly":{let r=/^(\d{4})W(\d{1,2})$/.exec(e);if(!r)return"";let a=Number(r[1]),o=Number(r[2])+i;return o<1?(a-=1,o=Y(a)):o>Y(a)&&(a+=1,o=1),`${a}W${o}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,o=r*12+a+i;return`${Math.floor(o/12)}${d((o%12+12)%12+1)}`}case"BiMonthly":{let r=/^(\d{4})(\d{2})B$/.exec(e);if(!r)return"";let a=Number(r[1]),o=Number(r[2])+i;return o<1?(a-=1,o=6):o>6&&(a+=1,o=1),`${a}${d(o)}B`}case"Quarterly":{let r=/^(\d{4})Q(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),o=Number(r[2])+i;return o<1?(a-=1,o=4):o>4&&(a+=1,o=1),`${a}Q${o}`}case"SixMonthly":{let r=/^(\d{4})S(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),o=Number(r[2])+i;return o<1?(a-=1,o=2):o>2&&(a+=1,o=1),`${a}S${o}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+i):"";default:return""}}function We(n,e){let i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let d=/^(\d{4})W(\d{1,2})$/.exec(e);return d?`${d[1]} W${String(d[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let d=Number(e.slice(4,6))-1;return`${i[d]??""} ${e.slice(0,4)}`}case"BiMonthly":{let d=/^(\d{4})(\d{2})B$/.exec(e);if(!d)return null;let r=(Number(d[2])-1)*2;return`${i[r]}\u2013${i[r+1]} ${d[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let d=/^(\d{4})S(\d)$/.exec(e);return d?`${d[1]} ${d[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Ge(n){let e=new Date,i=e.getFullYear(),d=e.getMonth(),r=o=>String(o).padStart(2,"0"),a=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let o=[];for(let s=0;s<30;s++){let t=new Date(e);t.setDate(t.getDate()-s);let c=`${t.getFullYear()}${r(t.getMonth()+1)}${r(t.getDate())}`,l=`${t.getFullYear()}-${r(t.getMonth()+1)}-${r(t.getDate())}`;o.push({id:c,label:l})}return o}case"Weekly":{let o=[],s=me(e),t=s.year,c=s.week;for(let l=0;l<12;l++)o.push({id:`${t}W${c}`,label:`${t} W${r(c)}`}),c-=1,c<1&&(t-=1,c=Y(t));return o}case"Monthly":{let o=[];for(let s=0;s<24;s++){let t=i,c=d,l=t*12+c-s,u=Math.floor(l/12),m=(l%12+12)%12;o.push({id:`${u}${r(m+1)}`,label:`${a[m]} ${u}`})}return o}case"BiMonthly":{let o=[],s=Math.floor(d/2)+1,t=i,c=s;for(let l=0;l<12;l++){let u=(c-1)*2;o.push({id:`${t}${r(c)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return o}case"Quarterly":{let o=[],s=Math.floor(d/3)+1,t=i,c=s;for(let l=0;l<8;l++)o.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return o}case"SixMonthly":{let o=[],s=d<6?1:2,t=i,c=s;for(let l=0;l<6;l++)o.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return o}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let o=[];for(let s=0;s<10;s++){let t=i-s;o.push({id:String(t),label:String(t)})}return o}default:return[]}}function me(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),i=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-i);let d=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-d.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function Y(n){return me(new Date(n,11,28)).week}var Ye=`
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
`;export{_e as default};
