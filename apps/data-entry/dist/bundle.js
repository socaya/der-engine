/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as oe,useState as k}from"react";import{useAuth as we,useOrgUnitBinding as ke,useOnlineStatus as Ee,useDerApi as Se,ScreenCard as Ce,StatusPill as _e}from"@der/app-sdk";import{jsx as p,jsxs as h}from"react/jsx-runtime";function Ne(){let n=we(),e=ke(),s=Ee(),i=Se(),[t,d]=k("custom"),[o,a]=k([]),[r,c]=k(""),[l,u]=k(""),[m,w]=k(""),[y,v]=k(""),[x,S]=k({kind:"idle"}),[E,U]=k(null),A=oe(null),[K,X]=k({}),F=oe({}),[V,pe]=k([]),[j,P]=k(null),[z,Z]=k(!1),[ee,ge]=k(0),[L,fe]=k([]),[te,H]=k(!1),[R,ye]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",R)}catch{}},[R]),$(()=>{let g=!1;return(async()=>{try{let f=await i.listDataSets();if(g)return;let _=(f.dataSets??[]).map(C=>({id:C.id,label:C.displayName??C.name??C.id,periodType:C.periodType,formType:C.formType})).sort((C,T)=>C.label.localeCompare(T.label));a(_)}catch{}})(),()=>{g=!0}},[]),$(()=>{if(r.trim()===""){U(null);return}let g=!1;return(async()=>{try{let f=await i.getDataSetMeta(r.trim());if(g)return;let _=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";U({hasCustomForm:_,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),d(_?"custom":"structured")}catch{g||U(null)}})(),()=>{g=!0}},[r]),$(()=>{if(t!=="custom"||!E?.hasCustomForm||E.formType==="CUSTOM"&&!E.formId)return;let g=A.current;if(!g)return;let f=!1;return(async()=>{S({kind:"submitting"});try{let _=await i.getDataSetFormMetadata(r.trim());if(f)return;let C=await Ae(_,i);if(f)return;let T="";if(E.formType==="CUSTOM"&&E.formId){try{T=(await i.getDataEntryFormHtml(E.formId)).htmlCode??""}catch(b){T="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}T.trim()||(T=ae(C))}else E.formType==="SECTION"&&(T=ae(C));if(f)return;let xe=await i.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(f)return;let ne=(C.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));pe(ne);let M={};for(let b of ne)b.options[0]&&(M[b.id]=b.options[0].id);X(M),F.current=M,g.replaceChildren();for(let[b,I]of[["selectedDataSetId",r.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let N=document.createElement("input");N.type="hidden",N.id=b,N.value=I,g.appendChild(N)}for(let[b,I]of Object.entries(M)){let N=document.createElement("input");N.type="hidden",N.id=`category-${b}`,N.value=I,N.setAttribute("data-der-category",b),g.appendChild(N)}let O=document.createElement("div");O.id="contentDiv",g.appendChild(O),Ie({dataSetId:r.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:C,aocSelections:M,validationRules:xe.validationRules??[]});for(let b of Te)ue(b);for(let b of $e)document.querySelector(`script[data-der-custom-form="${b}"]`)||await ce(b);Re(),await He(O,T),await ze(O,r.trim(),l.trim(),e.orgUnitUid??"",i),Oe(O,()=>r.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),i),Me(O),ge(b=>b+1),S({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(_){S({kind:"error",message:`custom form failed to render: ${_.message}`})}})(),()=>{f=!0}},[t,E,r,l,e.orgUnitUid]);let be=e.bound&&r.trim()!==""&&l.trim()!==""&&m.trim()!==""&&y.trim()!==""&&x.kind!=="submitting";async function he(g){g.preventDefault(),S({kind:"submitting"});try{await i.submitAggregate({dataSet:r,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),S({kind:"ok",message:`Submitted ${m}=${y} for ${l}.`}),w(""),v("")}catch(f){S({kind:"error",message:f.message??"Submission failed"})}}let re=l.trim()!=="",B=r.trim()!=="",D=B&&re&&e.bound;$(()=>{if(!D){P(null);return}let g=!1;return(async()=>{try{let f=await i.getCompletion(r.trim(),e.orgUnitUid??"",l.trim());if(g)return;P({completed:!!f.completed,completedAt:f.completedAt})}catch{g||P({completed:!1})}})(),()=>{g=!0}},[r,l,e.orgUnitUid,D]);async function ve(){if(!D||z)return;let g=!j?.completed;Z(!0);try{let f=await i.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:g});P({completed:!!f.completed,completedAt:f.completedAt}),S({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){S({kind:"error",message:`Completion failed: ${f.message}`})}finally{Z(!1)}}return h(Ce,{title:"Aggregate data entry",actions:p(_e,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[p("style",{children:Ye}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:r,onChange:g=>{c(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),o.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",E?.periodType?`\xB7 ${E.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Je(E?.periodType,l,u)})]}),h("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:n.displayName})]})]}),x.kind==="ok"&&p("div",{style:Be,"data-test":"de-ok",children:x.message}),x.kind==="error"&&p("div",{style:Qe,"data-test":"de-err",children:x.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!re&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",E?.formType==="SECTION"?"section":"data entry"," form."]}),D&&t==="structured"&&h("form",{onSubmit:he,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",p("input",{value:m,onChange:g=>w(g.target.value),style:q})]}),h("label",{children:["Value",p("input",{value:y,onChange:g=>v(g.target.value),inputMode:"decimal",style:q})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!be,style:ie,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),D&&t==="custom"&&h("div",{className:`der-de-form-card der-de-density-${R}`,children:[V.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(V.length,3)}, 1fr)`,gap:12,marginBottom:12},children:V.map(g=>h("label",{children:[g.name,p("select",{value:K[g.id]??"",onChange:f=>{let _={...K,[g.id]:f.target.value};X(_),F.current=_,De(A.current,_)},style:q,children:g.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},g.id))}),h("div",{className:"der-de-form-split",children:[p(Le,{targetRef:A,formVersion:ee}),p("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),D&&t==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(qe,{root:A,formVersion:ee}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${R==="compact"?"comfortable":"compact"} density`,title:`Density: ${R}. Click to switch.`,onClick:()=>ye(g=>g==="compact"?"comfortable":"compact"),children:R==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),j&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:j.completed?`Complete${j.completedAt?" \xB7 "+new Date(j.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Fe(A.current,S,g=>{fe(g),H(g.length>0)})},style:de,"data-test":"de-validate-btn",children:"Validate"}),L.length>0&&!te&&h("button",{type:"button",onClick:()=>H(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[L.length," issue",L.length===1?"":"s"]}),p("button",{type:"button",onClick:ve,disabled:z,style:j?.completed?de:ie,"data-test":"de-complete-btn",children:z?"Saving\u2026":j?.completed?"Reopen":"Mark complete"})]}),p(Ue,{open:te,issues:L,onClose:()=>H(!1),onPick:g=>{let f=A.current?.querySelector(`input[name="${g.inputName}"]`);f&&(f.scrollIntoView({behavior:"smooth",block:"center"}),f.focus(),f.select())}})]})}var $e=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Te=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Q=null,J=null,G=null;async function Ae(n,e){Q||(Q=e.listAllDataElements().then(a=>new Map(a.map(r=>[r.id,r])))),J||(J=e.listAllCategoryCombos().then(a=>new Map(a.map(r=>[r.id,r])))),G||(G=e.listAllCategoryOptionCombos().then(a=>{let r=new Map;for(let c of a){let l=c.categoryCombo?.id;if(!l)continue;let u=r.get(l);u?u.push(c):r.set(l,[c])}return r}));let[s,i,t]=await Promise.all([Q,J,G]),d=a=>{if(!a?.id)return;let r=i.get(a.id),c=t.get(a.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(r.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:a},o=a=>{let r=s.get(a.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:d(r.categoryCombo)}:a};return{...n,categoryCombo:d(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(a=>({...a,dataElement:a.dataElement?o(a.dataElement):void 0})),sections:(n.sections??[]).map(a=>({...a,dataElements:(a.dataElements??[]).map(r=>o(r))}))}}function ae(n){let e={};for(let a of n.dataSetElements??[])a.dataElement&&(e[a.dataElement.id]=a.dataElement);let s={};for(let a of n.indicators??[])s[a.id]=a;let i=(n.sections??[]).slice().sort((a,r)=>(a.sortOrder??0)-(r.sortOrder??0));if(!i.some(a=>(a.dataElements?.length??0)>0)){let a=(n.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);i=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:a,indicators:[],greyedFields:[]}]}let d=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),o=[];for(let a of i){let r=new Set;for(let l of a.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&r.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);o.push(`<h3 class="formSection">${d(a.name??"")}</h3>`);let c=new Map;for(let l of a.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,w=c.get(m);w||(w={cc:u.categoryCombo,des:[]},c.set(m,w)),w.des.push(u)}for(let l of c.values()){let u=l.cc.categoryOptionCombos??[],m=l.cc.categories??[];o.push('<div class="der-de-table-scroll">'),o.push('<table class="sectionTable" cellspacing="0">');let w=je(m,u);if(o.push("<thead>"),w.length>0)for(let y=0;y<w.length;y++){o.push("<tr>"),y===0&&o.push(`<th class="dataElementCell" rowspan="${w.length}">`+d(l.cc.name??"Data element")+"</th>");for(let v of w[y]??[])o.push(`<th colspan="${v.span}">${d(v.label)}</th>`);o.push("</tr>")}else{o.push("<tr>"),o.push(`<th class="dataElementCell">${d(l.cc.name??"Data element")}</th>`);for(let y of u)o.push(`<th>${d(y.name??"")}</th>`);o.push("</tr>")}o.push("</thead><tbody>");for(let y of l.des){o.push("<tr>"),o.push(`<td class="dataElementCell" id="${d(y.id)}-cell">`+d(y.formName??y.name??y.id)+"</td>");for(let v of u){let x=`${y.id}-${v.id}-val`;r.has(`${y.id}:${v.id}`)?o.push('<td class="greyed">\u2014</td>'):o.push(`<td><input type="text" id="${d(x)}" name="${d(x)}" dataelementid="${d(y.id)}" optioncomboid="${d(v.id)}"></td>`)}o.push("</tr>")}for(let y of a.indicators??[]){let v=s[y.id];v&&(o.push('<tr class="indicatorRow">'),o.push(`<td class="dataElementCell">${d(v.name??v.id)}</td>`),o.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${d(v.id)}" readonly></td>`),o.push("</tr>"))}o.push("</tbody></table></div>")}}return o.join(`
`)}function je(n,e){if(n.length===0)return[];let s=n.map(t=>t.categoryOptions?.length??0);if(s.some(t=>t===0))return[];let i=[];for(let t=0;t<n.length;t++){let d=[],o=1;for(let r=t+1;r<n.length;r++)o*=s[r]??1;let a=1;for(let r=0;r<t;r++)a*=s[r]??1;for(let r=0;r<a;r++)for(let c of n[t]?.categoryOptions??[])d.push({label:c.name??c.id,span:o});i.push(d)}return i}function Ie(n){let e=globalThis;e.dhis2=e.dhis2??{};let s=e.dhis2;s.de=s.de??{};let i=s.de;i.currentDataSetId=n.dataSetId,i.currentOrganisationUnitId=n.orgUnitId,i.currentPeriodId=n.periodId,i.currentCategorySelections={...n.aocSelections??{}};let t=n.meta??{},d={},o={};if(t.categoryCombo){o[t.categoryCombo.id]=t.categoryCombo;for(let u of t.categoryCombo.categories??[])d[u.id]=u}i.categories=d,i.categoryCombos=o;let a={},r={};for(let u of t.dataSetElements??[]){let m=u.dataElement;m&&(a[m.id]=m,m.optionSet&&(r[m.optionSet.id]=m.optionSet),m.categoryCombo&&(o[m.categoryCombo.id]=m.categoryCombo))}i.dataElements=a,i.optionSets=r;let c={};for(let u of t.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};i.indicatorFormulas=c;let l={};for(let u of n.validationRules??[])l[u.id]=u;i.validationRules=l,i.lockExceptions=[],i.emptyOrganisationUnits=[],i.significantZeros=[],i.dataSets={[t.id]:{id:t.id,name:t.name??t.displayName??"",periodType:t.periodType,categoryCombo:t.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Re(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function De(n,e){if(!n)return;for(let[i,t]of Object.entries(e)){let d=n.querySelector(`input[data-der-category="${i}"]`);d||(d=document.createElement("input"),d.type="hidden",d.id=`category-${i}`,d.setAttribute("data-der-category",i),n.appendChild(d)),d.value=t}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...e})}function Oe(n,e,s,i,t,d){let o=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},a=new WeakMap,r=n.querySelectorAll('input[name$="-val"]');for(let l of Array.from(r))a.set(l,l.value);let c=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",w=o(m);if(!w)return;let y=e(),v=s(),x=i();if(!y||!v||!x)return;let S=u.value;if(a.get(u)!==S){W(u,"saving");try{let E=await d.submitAggregate({dataSet:y,period:v,orgUnit:x,attributeOptionComboSelections:t(),dataValues:[{dataElement:w.de,categoryOptionCombo:w.coc,value:S}]});a.set(u,S),W(u,E?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{W(u,"error")}}};n.addEventListener("blur",l=>{c(l)},!0)}function Me(n){n.addEventListener("keydown",e=>{let s=e;if(s.key!=="Enter")return;let i=s.target;if(!(i instanceof HTMLInputElement))return;let t=i.getAttribute("name")??"",d=/^(.+)-(.+)-val$/.exec(t);if(!d)return;s.preventDefault();let o=d[2],a=Array.from(n.querySelectorAll(`input[name$="-${o}-val"]`)),r=a.indexOf(i);if(r===-1)return;let c=a[r+(s.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe(n){let e=Array.from(n.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let s=[],i=new Set;return e.forEach((t,d)=>{let o=t.id||`der-de-section-${d}`;t.id=o;let a=null,r=t.parentElement;for(;r&&r!==n;){let c=r.parentElement;if(c===n||c&&c.parentElement===n){a=r;break}r=c}if(a){if(i.has(a))return;i.add(a),a.classList.add("der-de-section-slot"),a.dataset.sectionId=o}else{a=document.createElement("div"),a.className="der-de-section-slot",a.dataset.sectionId=o;let c=e[d+1]??null,l=[],u=t;for(;u&&u!==c;){let m=u.nextSibling;l.push(u),u=m}t.parentNode?.insertBefore(a,t);for(let m of l)a.appendChild(m)}s.push({id:o,label:(t.textContent??"").trim(),slot:a})}),s}function Le({targetRef:n,formVersion:e}){let[s,i]=k([]),[t,d]=k("");return $(()=>{let o=n.current;if(!o)return;let a=Pe(o);i(a),d(a[0]?.id??"")},[n,e]),$(()=>{if(!n.current||s.length===0)return;for(let r of s)r.slot.style.display=r.id===t?"":"none";let a=s.find(r=>r.id===t);a&&a.slot.scrollIntoView({behavior:"smooth",block:"start"})},[n,s,t]),s.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:s.map(o=>p("li",{children:p("button",{type:"button",className:"der-de-section-nav__item"+(t===o.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>d(o.id),children:o.label})},o.id))})]})}function qe({root:n,formVersion:e}){let[s,i]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let o=()=>{let r=n.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),l=0,u=0,m=0,w=0,y=0;for(let v of c){v.value.trim()!==""&&l++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?u++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?w++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?m++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&y++}i({total:c.length,filled:l,saving:u,saved:m,queued:w,error:y})};o();let a=window.setInterval(o,800);return()=>window.clearInterval(a)},[n,e]),s.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let t=[];t.push(`${s.filled} of ${s.total} filled`),s.saving>0&&t.push(`${s.saving} saving`),s.queued>0&&t.push(`${s.queued} queued`),s.error>0&&t.push(`${s.error} error`);let d=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${d}`,"data-test":"de-save-state",children:t.join(" \xB7 ")})}function Ue({open:n,issues:e,onClose:s,onPick:i}){return $(()=>{if(!n)return;let t=d=>{d.key==="Escape"&&s()};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[n,s]),!n||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:s,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(t=>p("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>i(t),children:[p("span",{className:"der-de-issues-drawer__de",children:t.deName}),p("span",{className:"der-de-issues-drawer__coc",children:t.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:t.value}),p("span",{children:t.problem})]})]})},`${t.deId}-${t.cocId}`))})]})}function Fe(n,e,s){if(!n)return;let i=globalThis,t=i.dhis2?.de?.dataElements??{},d=i.dhis2?.de?.categoryOptionCombos??{},o=Array.from(n.querySelectorAll('input[name$="-val"]')),a=[];for(let r of o){r.style.outline="";let c=r.value.trim();if(c==="")continue;let l=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!l)continue;let u=l[1],m=l[2],w=t[u],y=w?.valueType??"TEXT",v=Ve(c,y);v&&(r.style.outline="2px solid #a93232",a.push({deId:u,cocId:m,valueType:y,value:c,problem:v,deName:w?.name??u,cocName:d[m]?.name??m,inputName:r.name}))}s(a),a.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${a.length} issue${a.length===1?"":"s"}. See the Issues panel.`})}function Ve(n,e){let s=Number(n),i=Number.isInteger(s);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(e){case"INTEGER":if(!i)return"must be an integer";break;case"INTEGER_POSITIVE":if(!i||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!i||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!i||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function W(n,e){let s=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${s}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function ze(n,e,s,i,t){if(!e||!s||!i)return;let d;try{d=(await t.readAggregateValues(i,s,2e3)).dataValues??[]}catch{return}for(let o of d){let a=o.dataElement,r=o.categoryOptionCombo,c=o.value;if(!a||!r||c==null)continue;let l=n.querySelector(`input[name="${a}-${r}-val"]`);l&&(l.value=c)}}function ce(n){return new Promise((e,s)=>{let i=document.createElement("script");i.src=n,i.async=!1,i.setAttribute("data-der-custom-form",n),i.onload=()=>e(),i.onerror=()=>s(new Error(`failed to load ${n}`)),document.head.appendChild(i)})}function ue(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function se(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function He(n,e){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let t of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let d=t.getAttribute("href")??"";d&&ue(se(d))}else{let d=document.createElement("style");d.textContent=t.textContent??"",d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d)}t.remove()}let i=[];for(let t of Array.from(s.querySelectorAll("script"))){let d=t.getAttribute("src");d?i.push({src:se(d)}):i.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(s.body.querySelectorAll("*")))t instanceof HTMLElement&&t.removeAttribute("style");for(let t of Array.from(s.body.childNodes))n.appendChild(document.adoptNode(t));for(let t of i)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await ce(t.src);else if(t.code){let d=document.createElement("script");d.textContent=t.code,d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d),d.remove()}}var q={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ie={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},de={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Be={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Qe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Je(n,e,s){let i={...q},t=We(n);if(t.length===0)return p("input",{value:e,onChange:m=>s(m.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:i});let d=[...t];if(e&&!d.some(m=>m.id===e)){let m=Ge(n,e)??e;d.unshift({id:e,label:m})}let o=t[0]?.id??null,a=d.findIndex(m=>m.id===e),r=a===-1||a<d.length-1||!!n,c=e!==""&&(a>0||e!==o),l=()=>{if(!n)return;let m=a>=0&&a<d.length-1?d[a+1]?.id??"":le(n,e||o||"",-1);m&&s(m)},u=()=>{if(!n||!e||e===o)return;let m=a>0?d[a-1]?.id??"":le(n,e,1);m&&s(m)};return h("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:m=>s(m.target.value),style:i,children:[p("option",{value:"",children:"Select a period\u2026"}),d.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function le(n,e,s){let i=t=>String(t).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let t=Number(e.slice(0,4)),d=Number(e.slice(4,6))-1,o=Number(e.slice(6,8)),a=new Date(t,d,o+s);return`${a.getFullYear()}${i(a.getMonth()+1)}${i(a.getDate())}`}case"Weekly":{let t=/^(\d{4})W(\d{1,2})$/.exec(e);if(!t)return"";let d=Number(t[1]),o=Number(t[2])+s;return o<1?(d-=1,o=Y(d)):o>Y(d)&&(d+=1,o=1),`${d}W${o}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let t=Number(e.slice(0,4)),d=Number(e.slice(4,6))-1,o=t*12+d+s;return`${Math.floor(o/12)}${i((o%12+12)%12+1)}`}case"BiMonthly":{let t=/^(\d{4})(\d{2})B$/.exec(e);if(!t)return"";let d=Number(t[1]),o=Number(t[2])+s;return o<1?(d-=1,o=6):o>6&&(d+=1,o=1),`${d}${i(o)}B`}case"Quarterly":{let t=/^(\d{4})Q(\d)$/.exec(e);if(!t)return"";let d=Number(t[1]),o=Number(t[2])+s;return o<1?(d-=1,o=4):o>4&&(d+=1,o=1),`${d}Q${o}`}case"SixMonthly":{let t=/^(\d{4})S(\d)$/.exec(e);if(!t)return"";let d=Number(t[1]),o=Number(t[2])+s;return o<1?(d-=1,o=2):o>2&&(d+=1,o=1),`${d}S${o}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+s):"";default:return""}}function Ge(n,e){let s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(e);return i?`${i[1]} W${String(i[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let i=Number(e.slice(4,6))-1;return`${s[i]??""} ${e.slice(0,4)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(e);if(!i)return null;let t=(Number(i[2])-1)*2;return`${s[t]}\u2013${s[t+1]} ${i[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(e);return i?`${i[1]} ${i[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function We(n){let e=new Date,s=e.getFullYear(),i=e.getMonth(),t=o=>String(o).padStart(2,"0"),d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let o=[];for(let a=0;a<30;a++){let r=new Date(e);r.setDate(r.getDate()-a);let c=`${r.getFullYear()}${t(r.getMonth()+1)}${t(r.getDate())}`,l=`${r.getFullYear()}-${t(r.getMonth()+1)}-${t(r.getDate())}`;o.push({id:c,label:l})}return o}case"Weekly":{let o=[],a=me(e),r=a.year,c=a.week;for(let l=0;l<12;l++)o.push({id:`${r}W${c}`,label:`${r} W${t(c)}`}),c-=1,c<1&&(r-=1,c=Y(r));return o}case"Monthly":{let o=[];for(let a=0;a<24;a++){let r=s,c=i,l=r*12+c-a,u=Math.floor(l/12),m=(l%12+12)%12;o.push({id:`${u}${t(m+1)}`,label:`${d[m]} ${u}`})}return o}case"BiMonthly":{let o=[],a=Math.floor(i/2)+1,r=s,c=a;for(let l=0;l<12;l++){let u=(c-1)*2;o.push({id:`${r}${t(c)}B`,label:`${d[u]}\u2013${d[u+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return o}case"Quarterly":{let o=[],a=Math.floor(i/3)+1,r=s,c=a;for(let l=0;l<8;l++)o.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return o}case"SixMonthly":{let o=[],a=i<6?1:2,r=s,c=a;for(let l=0;l<6;l++)o.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return o}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let o=[];for(let a=0;a<10;a++){let r=s-a;o.push({id:String(r),label:String(r)})}return o}default:return[]}}function me(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),s=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-s);let i=new Date(e.getFullYear(),0,1),d=Math.round((e.getTime()-i.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((d+1)/7)}}function Y(n){return me(new Date(n,11,28)).week}var Ye=`
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
/* Each table lives inside a container that normally fits the
   viewport (categories nest with colspan rather than forcing a
   wide flat matrix). Only scroll horizontally as a last resort
   when the operator chose Comfortable density on a very wide
   combo (Age \xD7 Sex \xD7 Status + 50+ DEs). */
.der-de-form-card .der-de-table-scroll {
  overflow-x: auto;
  margin: 6px 0 16px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
}
.der-de-form-card .der-de-table-scroll .sectionTable {
  margin: 0;
  table-layout: fixed;
  width: 100%;
}
.der-de-form-card .der-de-table-scroll .sectionTable td,
.der-de-form-card .der-de-table-scroll .sectionTable th {
  white-space: normal;
  word-break: break-word;
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
`;export{Ne as default};
