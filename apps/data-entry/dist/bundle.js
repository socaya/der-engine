/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as ae,useState as k}from"react";import{useAuth as we,useOrgUnitBinding as ke,useOnlineStatus as Ee,useDerApi as Se,ScreenCard as _e,StatusPill as Ce}from"@der/app-sdk";import{jsx as p,jsxs as h}from"react/jsx-runtime";function Ne(){let n=we(),e=ke(),s=Ee(),i=Se(),[a,d]=k("custom"),[r,o]=k([]),[t,c]=k(""),[l,u]=k(""),[m,w]=k(""),[y,v]=k(""),[x,S]=k({kind:"idle"}),[E,U]=k(null),A=ae(null),[K,X]=k({}),V=ae({}),[F,pe]=k([]),[j,P]=k(null),[z,Z]=k(!1),[ee,ge]=k(0),[q,fe]=k([]),[te,H]=k(!1),[I,ye]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",I)}catch{}},[I]),$(()=>{let g=!1;return(async()=>{try{let f=await i.listDataSets();if(g)return;let C=(f.dataSets??[]).map(_=>({id:_.id,label:_.displayName??_.name??_.id,periodType:_.periodType,formType:_.formType})).sort((_,T)=>_.label.localeCompare(T.label));o(C)}catch{}})(),()=>{g=!0}},[]),$(()=>{if(t.trim()===""){U(null);return}let g=!1;return(async()=>{try{let f=await i.getDataSetMeta(t.trim());if(g)return;let C=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";U({hasCustomForm:C,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),d(C?"custom":"structured")}catch{g||U(null)}})(),()=>{g=!0}},[t]),$(()=>{if(a!=="custom"||!E?.hasCustomForm||E.formType==="CUSTOM"&&!E.formId)return;let g=A.current;if(!g)return;let f=!1;return(async()=>{S({kind:"submitting"});try{let C=await i.getDataSetFormMetadata(t.trim());if(f)return;let _=await Ae(C,i);if(f)return;let T="";if(E.formType==="CUSTOM"&&E.formId){try{T=(await i.getDataEntryFormHtml(E.formId)).htmlCode??""}catch(b){T="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",b)}T.trim()||(T=oe(_))}else E.formType==="SECTION"&&(T=oe(_));if(f)return;let xe=await i.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(f)return;let ne=(_.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(R=>({id:R.id,name:R.name??R.id}))}));pe(ne);let M={};for(let b of ne)b.options[0]&&(M[b.id]=b.options[0].id);X(M),V.current=M,g.replaceChildren();for(let[b,R]of[["selectedDataSetId",t.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let N=document.createElement("input");N.type="hidden",N.id=b,N.value=R,g.appendChild(N)}for(let[b,R]of Object.entries(M)){let N=document.createElement("input");N.type="hidden",N.id=`category-${b}`,N.value=R,N.setAttribute("data-der-category",b),g.appendChild(N)}let O=document.createElement("div");O.id="contentDiv",g.appendChild(O),Re({dataSetId:t.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:_,aocSelections:M,validationRules:xe.validationRules??[]});for(let b of Te)ue(b);for(let b of $e)document.querySelector(`script[data-der-custom-form="${b}"]`)||await ce(b);Ie(),await ze(O,T),await Fe(O,t.trim(),l.trim(),e.orgUnitUid??"",i),Oe(O,()=>t.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...V.current}),i),Me(O),ge(b=>b+1),S({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(C){S({kind:"error",message:`custom form failed to render: ${C.message}`})}})(),()=>{f=!0}},[a,E,t,l,e.orgUnitUid]);let be=e.bound&&t.trim()!==""&&l.trim()!==""&&m.trim()!==""&&y.trim()!==""&&x.kind!=="submitting";async function he(g){g.preventDefault(),S({kind:"submitting"});try{await i.submitAggregate({dataSet:t,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:y}]}),S({kind:"ok",message:`Submitted ${m}=${y} for ${l}.`}),w(""),v("")}catch(f){S({kind:"error",message:f.message??"Submission failed"})}}let re=l.trim()!=="",B=t.trim()!=="",D=B&&re&&e.bound;$(()=>{if(!D){P(null);return}let g=!1;return(async()=>{try{let f=await i.getCompletion(t.trim(),e.orgUnitUid??"",l.trim());if(g)return;P({completed:!!f.completed,completedAt:f.completedAt})}catch{g||P({completed:!1})}})(),()=>{g=!0}},[t,l,e.orgUnitUid,D]);async function ve(){if(!D||z)return;let g=!j?.completed;Z(!0);try{let f=await i.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:g});P({completed:!!f.completed,completedAt:f.completedAt}),S({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){S({kind:"error",message:`Completion failed: ${f.message}`})}finally{Z(!1)}}return h(_e,{title:"Aggregate data entry",actions:p(Ce,{tone:s.isOnline?"success":"warning",children:s.isOnline?"online":`offline (${s.queuedCount} queued)`}),children:[p("style",{children:We}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:t,onChange:g=>{c(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),r.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",E?.periodType?`\xB7 ${E.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Qe(E?.periodType,l,u)})]}),h("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:n.displayName})]})]}),x.kind==="ok"&&p("div",{style:He,"data-test":"de-ok",children:x.message}),x.kind==="error"&&p("div",{style:Be,"data-test":"de-err",children:x.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!re&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",E?.formType==="SECTION"?"section":"data entry"," form."]}),D&&a==="structured"&&h("form",{onSubmit:he,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",p("input",{value:m,onChange:g=>w(g.target.value),style:L})]}),h("label",{children:["Value",p("input",{value:y,onChange:g=>v(g.target.value),inputMode:"decimal",style:L})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!be,style:ie,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),D&&a==="custom"&&h("div",{className:`der-de-form-card der-de-density-${I}`,children:[F.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(F.length,3)}, 1fr)`,gap:12,marginBottom:12},children:F.map(g=>h("label",{children:[g.name,p("select",{value:K[g.id]??"",onChange:f=>{let C={...K,[g.id]:f.target.value};X(C),V.current=C,De(A.current,C)},style:L,children:g.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},g.id))}),h("div",{className:"der-de-form-split",children:[p(Pe,{targetRef:A,formVersion:ee}),p("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),D&&a==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(qe,{root:A,formVersion:ee}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${I==="compact"?"comfortable":"compact"} density`,title:`Density: ${I}. Click to switch.`,onClick:()=>ye(g=>g==="compact"?"comfortable":"compact"),children:I==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),j&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:j.completed?`Complete${j.completedAt?" \xB7 "+new Date(j.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Ue(A.current,S,g=>{fe(g),H(g.length>0)})},style:de,"data-test":"de-validate-btn",children:"Validate"}),q.length>0&&!te&&h("button",{type:"button",onClick:()=>H(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[q.length," issue",q.length===1?"":"s"]}),p("button",{type:"button",onClick:ve,disabled:z,style:j?.completed?de:ie,"data-test":"de-complete-btn",children:z?"Saving\u2026":j?.completed?"Reopen":"Mark complete"})]}),p(Le,{open:te,issues:q,onClose:()=>H(!1),onPick:g=>{let f=A.current?.querySelector(`input[name="${g.inputName}"]`);f&&(f.scrollIntoView({behavior:"smooth",block:"center"}),f.focus(),f.select())}})]})}var $e=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Te=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Q=null,J=null,G=null;async function Ae(n,e){Q||(Q=e.listAllDataElements().then(o=>new Map(o.map(t=>[t.id,t])))),J||(J=e.listAllCategoryCombos().then(o=>new Map(o.map(t=>[t.id,t])))),G||(G=e.listAllCategoryOptionCombos().then(o=>{let t=new Map;for(let c of o){let l=c.categoryCombo?.id;if(!l)continue;let u=t.get(l);u?u.push(c):t.set(l,[c])}return t}));let[s,i,a]=await Promise.all([Q,J,G]),d=o=>{if(!o?.id)return;let t=i.get(o.id),c=a.get(o.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(t.categories??[]).map(l=>({id:l.id}))}:o},r=o=>{let t=s.get(o.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:d(t.categoryCombo)}:o};return{...n,categoryCombo:d(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(o=>({...o,dataElement:o.dataElement?r(o.dataElement):void 0})),sections:(n.sections??[]).map(o=>({...o,dataElements:(o.dataElements??[]).map(t=>r(t))}))}}function oe(n){let e={};for(let o of n.dataSetElements??[])o.dataElement&&(e[o.dataElement.id]=o.dataElement);let s={};for(let o of n.indicators??[])s[o.id]=o;let i=(n.sections??[]).slice().sort((o,t)=>(o.sortOrder??0)-(t.sortOrder??0));if(!i.some(o=>(o.dataElements?.length??0)>0)){let o=(n.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);i=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:o,indicators:[],greyedFields:[]}]}let d=o=>o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let o of i){let t=new Set;for(let l of o.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&t.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${d(o.name??"")}</h3>`);let c=new Map;for(let l of o.dataElements??[]){let u=e[l.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,w=c.get(m);w||(w={cc:u.categoryCombo,des:[]},c.set(m,w)),w.des.push(u)}for(let l of c.values()){let u=l.cc.categoryOptionCombos??[],m=l.cc.categories??[];r.push('<div class="der-de-table-scroll">'),r.push('<table class="sectionTable" cellspacing="0">');let w=je(m,u);if(r.push("<thead>"),w.length>0)for(let y=0;y<w.length;y++){r.push("<tr>"),y===0&&r.push(`<th class="dataElementCell" rowspan="${w.length}">`+d(l.cc.name??"Data element")+"</th>");for(let v of w[y]??[])r.push(`<th colspan="${v.span}">${d(v.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${d(l.cc.name??"Data element")}</th>`);for(let y of u)r.push(`<th>${d(y.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let y of l.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${d(y.id)}-cell">`+d(y.formName??y.name??y.id)+"</td>");for(let v of u){let x=`${y.id}-${v.id}-val`;t.has(`${y.id}:${v.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${d(x)}" name="${d(x)}" dataelementid="${d(y.id)}" optioncomboid="${d(v.id)}"></td>`)}r.push("</tr>")}for(let y of o.indicators??[]){let v=s[y.id];v&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${d(v.name??v.id)}</td>`),r.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${d(v.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table></div>")}}return r.join(`
`)}function je(n,e){if(n.length===0)return[];let s=n.map(a=>a.categoryOptions?.length??0);if(s.some(a=>a===0))return[];let i=[];for(let a=0;a<n.length;a++){let d=[],r=1;for(let t=a+1;t<n.length;t++)r*=s[t]??1;let o=1;for(let t=0;t<a;t++)o*=s[t]??1;for(let t=0;t<o;t++)for(let c of n[a]?.categoryOptions??[])d.push({label:c.name??c.id,span:r});i.push(d)}return i}function Re(n){let e=globalThis;e.dhis2=e.dhis2??{};let s=e.dhis2;s.de=s.de??{};let i=s.de;i.currentDataSetId=n.dataSetId,i.currentOrganisationUnitId=n.orgUnitId,i.currentPeriodId=n.periodId,i.currentCategorySelections={...n.aocSelections??{}};let a=n.meta??{},d={},r={};if(a.categoryCombo){r[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])d[u.id]=u}i.categories=d,i.categoryCombos=r;let o={},t={};for(let u of a.dataSetElements??[]){let m=u.dataElement;m&&(o[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(r[m.categoryCombo.id]=m.categoryCombo))}i.dataElements=o,i.optionSets=t;let c={};for(let u of a.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};i.indicatorFormulas=c;let l={};for(let u of n.validationRules??[])l[u.id]=u;i.validationRules=l,i.lockExceptions=[],i.emptyOrganisationUnits=[],i.significantZeros=[],i.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ie(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function De(n,e){if(!n)return;for(let[i,a]of Object.entries(e)){let d=n.querySelector(`input[data-der-category="${i}"]`);d||(d=document.createElement("input"),d.type="hidden",d.id=`category-${i}`,d.setAttribute("data-der-category",i),n.appendChild(d)),d.value=a}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...e})}function Oe(n,e,s,i,a,d){let r=l=>{let u=/^(.+)-(.+)-val$/.exec(l);return u?{de:u[1],coc:u[2]}:null},o=new WeakMap,t=n.querySelectorAll('input[name$="-val"]');for(let l of Array.from(t))o.set(l,l.value);let c=async l=>{let u=l.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",w=r(m);if(!w)return;let y=e(),v=s(),x=i();if(!y||!v||!x)return;let S=u.value;if(o.get(u)!==S){W(u,"saving");try{let E=await d.submitAggregate({dataSet:y,period:v,orgUnit:x,attributeOptionComboSelections:a(),dataValues:[{dataElement:w.de,categoryOptionCombo:w.coc,value:S}]});o.set(u,S),W(u,E?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{W(u,"error")}}};n.addEventListener("blur",l=>{c(l)},!0)}function Me(n){n.addEventListener("keydown",e=>{let s=e;if(s.key!=="Enter")return;let i=s.target;if(!(i instanceof HTMLInputElement))return;let a=i.getAttribute("name")??"",d=/^(.+)-(.+)-val$/.exec(a);if(!d)return;s.preventDefault();let r=d[2],o=Array.from(n.querySelectorAll(`input[name$="-${r}-val"]`)),t=o.indexOf(i);if(t===-1)return;let c=o[t+(s.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe({targetRef:n,formVersion:e}){let[s,i]=k([]),[a,d]=k("");return $(()=>{let r=n.current;if(!r)return;let t=Array.from(r.querySelectorAll("h3.formSection")).map((c,l)=>{let u=c.id||`der-de-section-${l}`;return c.id=u,{id:u,label:(c.textContent??"").trim(),el:c}}).filter(c=>c.label);i(t),d(t[0]?.id??"")},[n,e]),$(()=>{if(s.length===0)return;let r=new IntersectionObserver(o=>{let t=null;for(let c of o){if(!c.isIntersecting)continue;let l=c.target.id;l&&(!t||c.intersectionRatio>t.ratio)&&(t={id:l,ratio:c.intersectionRatio})}t&&d(t.id)},{threshold:[0,.2,.4,.6],rootMargin:"-80px 0px -60% 0px"});for(let o of s)r.observe(o.el);return()=>r.disconnect()},[s]),s.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:s.map(r=>p("li",{children:p("button",{type:"button",className:"der-de-section-nav__item"+(a===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>{r.el.scrollIntoView({behavior:"smooth",block:"start"}),d(r.id)},children:r.label})},r.id))})]})}function qe({root:n,formVersion:e}){let[s,i]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let r=()=>{let t=n.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),l=0,u=0,m=0,w=0,y=0;for(let v of c){v.value.trim()!==""&&l++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?u++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?w++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?m++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&y++}i({total:c.length,filled:l,saving:u,saved:m,queued:w,error:y})};r();let o=window.setInterval(r,800);return()=>window.clearInterval(o)},[n,e]),s.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${s.filled} of ${s.total} filled`),s.saving>0&&a.push(`${s.saving} saving`),s.queued>0&&a.push(`${s.queued} queued`),s.error>0&&a.push(`${s.error} error`);let d=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${d}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function Le({open:n,issues:e,onClose:s,onPick:i}){return $(()=>{if(!n)return;let a=d=>{d.key==="Escape"&&s()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[n,s]),!n||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:s,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(a=>p("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>i(a),children:[p("span",{className:"der-de-issues-drawer__de",children:a.deName}),p("span",{className:"der-de-issues-drawer__coc",children:a.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:a.value}),p("span",{children:a.problem})]})]})},`${a.deId}-${a.cocId}`))})]})}function Ue(n,e,s){if(!n)return;let i=globalThis,a=i.dhis2?.de?.dataElements??{},d=i.dhis2?.de?.categoryOptionCombos??{},r=Array.from(n.querySelectorAll('input[name$="-val"]')),o=[];for(let t of r){t.style.outline="";let c=t.value.trim();if(c==="")continue;let l=/^(.+)-(.+)-val$/.exec(t.getAttribute("name")??"");if(!l)continue;let u=l[1],m=l[2],w=a[u],y=w?.valueType??"TEXT",v=Ve(c,y);v&&(t.style.outline="2px solid #a93232",o.push({deId:u,cocId:m,valueType:y,value:c,problem:v,deName:w?.name??u,cocName:d[m]?.name??m,inputName:t.name}))}s(o),o.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${r.length} cells OK.`}):e({kind:"error",message:`Validation found ${o.length} issue${o.length===1?"":"s"}. See the Issues panel.`})}function Ve(n,e){let s=Number(n),i=Number.isInteger(s);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(e){case"INTEGER":if(!i)return"must be an integer";break;case"INTEGER_POSITIVE":if(!i||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!i||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!i||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function W(n,e){let s=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${s}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function Fe(n,e,s,i,a){if(!e||!s||!i)return;let d;try{d=(await a.readAggregateValues(i,s,2e3)).dataValues??[]}catch{return}for(let r of d){let o=r.dataElement,t=r.categoryOptionCombo,c=r.value;if(!o||!t||c==null)continue;let l=n.querySelector(`input[name="${o}-${t}-val"]`);l&&(l.value=c)}}function ce(n){return new Promise((e,s)=>{let i=document.createElement("script");i.src=n,i.async=!1,i.setAttribute("data-der-custom-form",n),i.onload=()=>e(),i.onerror=()=>s(new Error(`failed to load ${n}`)),document.head.appendChild(i)})}function ue(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function se(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function ze(n,e){let s=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(s.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let d=a.getAttribute("href")??"";d&&ue(se(d))}else{let d=document.createElement("style");d.textContent=a.textContent??"",d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d)}a.remove()}let i=[];for(let a of Array.from(s.querySelectorAll("script"))){let d=a.getAttribute("src");d?i.push({src:se(d)}):i.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(s.body.childNodes))n.appendChild(document.adoptNode(a));for(let a of i)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await ce(a.src);else if(a.code){let d=document.createElement("script");d.textContent=a.code,d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d),d.remove()}}var L={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ie={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},de={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},He={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Be={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Qe(n,e,s){let i={...L},a=Ge(n);if(a.length===0)return p("input",{value:e,onChange:m=>s(m.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:i});let d=[...a];if(e&&!d.some(m=>m.id===e)){let m=Je(n,e)??e;d.unshift({id:e,label:m})}let r=a[0]?.id??null,o=d.findIndex(m=>m.id===e),t=o===-1||o<d.length-1||!!n,c=e!==""&&(o>0||e!==r),l=()=>{if(!n)return;let m=o>=0&&o<d.length-1?d[o+1]?.id??"":le(n,e||r||"",-1);m&&s(m)},u=()=>{if(!n||!e||e===r)return;let m=o>0?d[o-1]?.id??"":le(n,e,1);m&&s(m)};return h("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:m=>s(m.target.value),style:i,children:[p("option",{value:"",children:"Select a period\u2026"}),d.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function le(n,e,s){let i=a=>String(a).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),d=Number(e.slice(4,6))-1,r=Number(e.slice(6,8)),o=new Date(a,d,r+s);return`${o.getFullYear()}${i(o.getMonth()+1)}${i(o.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let d=Number(a[1]),r=Number(a[2])+s;return r<1?(d-=1,r=Y(d)):r>Y(d)&&(d+=1,r=1),`${d}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),d=Number(e.slice(4,6))-1,r=a*12+d+s;return`${Math.floor(r/12)}${i((r%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let d=Number(a[1]),r=Number(a[2])+s;return r<1?(d-=1,r=6):r>6&&(d+=1,r=1),`${d}${i(r)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let d=Number(a[1]),r=Number(a[2])+s;return r<1?(d-=1,r=4):r>4&&(d+=1,r=1),`${d}Q${r}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let d=Number(a[1]),r=Number(a[2])+s;return r<1?(d-=1,r=2):r>2&&(d+=1,r=1),`${d}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+s):"";default:return""}}function Je(n,e){let s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(e);return i?`${i[1]} W${String(i[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let i=Number(e.slice(4,6))-1;return`${s[i]??""} ${e.slice(0,4)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(e);if(!i)return null;let a=(Number(i[2])-1)*2;return`${s[a]}\u2013${s[a+1]} ${i[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(e);return i?`${i[1]} ${i[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Ge(n){let e=new Date,s=e.getFullYear(),i=e.getMonth(),a=r=>String(r).padStart(2,"0"),d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(n){case"Daily":{let r=[];for(let o=0;o<30;o++){let t=new Date(e);t.setDate(t.getDate()-o);let c=`${t.getFullYear()}${a(t.getMonth()+1)}${a(t.getDate())}`,l=`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`;r.push({id:c,label:l})}return r}case"Weekly":{let r=[],o=me(e),t=o.year,c=o.week;for(let l=0;l<12;l++)r.push({id:`${t}W${c}`,label:`${t} W${a(c)}`}),c-=1,c<1&&(t-=1,c=Y(t));return r}case"Monthly":{let r=[];for(let o=0;o<24;o++){let t=s,c=i,l=t*12+c-o,u=Math.floor(l/12),m=(l%12+12)%12;r.push({id:`${u}${a(m+1)}`,label:`${d[m]} ${u}`})}return r}case"BiMonthly":{let r=[],o=Math.floor(i/2)+1,t=s,c=o;for(let l=0;l<12;l++){let u=(c-1)*2;r.push({id:`${t}${a(c)}B`,label:`${d[u]}\u2013${d[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return r}case"Quarterly":{let r=[],o=Math.floor(i/3)+1,t=s,c=o;for(let l=0;l<8;l++)r.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return r}case"SixMonthly":{let r=[],o=i<6?1:2,t=s,c=o;for(let l=0;l<6;l++)r.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return r}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let r=[];for(let o=0;o<10;o++){let t=s-o;r.push({id:String(t),label:String(t)})}return r}default:return[]}}function me(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),s=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-s);let i=new Date(e.getFullYear(),0,1),d=Math.round((e.getTime()-i.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((d+1)/7)}}function Y(n){return me(new Date(n,11,28)).week}var We=`
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
