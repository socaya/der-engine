/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as de,useState as N}from"react";import{useAuth as Ae,useOrgUnitBinding as $e,useOnlineStatus as Ie,useDerApi as je,ScreenCard as De,StatusPill as Oe}from"@der/app-sdk";import{Fragment as fe,jsx as m,jsxs as h}from"react/jsx-runtime";function Re(){let i=Ae(),e=$e(),l=Ie(),o=je(),[n,t]=N("custom"),[r,a]=N([]),[s,u]=N(""),[d,c]=N(""),[p,g]=N(""),[f,v]=N(""),[x,w]=N({kind:"idle"}),[S,D]=N(null),A=de(null),[re,H]=N({}),q=de({}),[ve,B]=N([]),[O,F]=N(null),[V,ne]=N(!1),[ae,xe]=N(0),[z,we]=N([]),[Q,J]=N(!1),[_e,Ee]=N(null),[oe,se]=N(!0),[ke,W]=N(!1);$(()=>{let y=b=>{if(b.key!=="?")return;let k=b.target;k&&(k.tagName==="INPUT"||k.tagName==="TEXTAREA")||(b.preventDefault(),W(E=>!E))};return window.addEventListener("keydown",y),()=>window.removeEventListener("keydown",y)},[]);let[M,Ne]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",M)}catch{}},[M]),$(()=>{let y=!1;return(async()=>{try{let b=await o.listDataSets();if(y)return;let k=(b.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,I)=>E.label.localeCompare(I.label));a(k)}catch{}})(),()=>{y=!0}},[]),$(()=>{if(s.trim()===""){D(null),B([]),H({}),q.current={};return}let y=!1;return(async()=>{try{let b=await o.getDataSetMeta(s.trim());if(y)return;let k=!!b.dataEntryForm&&b.formType==="CUSTOM"||b.formType==="SECTION";D({hasCustomForm:k,formId:b.dataEntryForm?.id,displayName:b.displayName??b.name,formType:b.formType,periodType:b.periodType}),t(k?"custom":"structured");try{let E=await o.getDataSetFormMetadata(s.trim());if(y)return;let I=await le(E,o);if(y)return;let U=(I.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));B(U);let P={};for(let C of U)C.options[0]&&(P[C.id]=C.options[0].id);H(P),q.current=P}catch{}}catch{y||D(null)}})(),()=>{y=!0}},[s]),$(()=>{if(n!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let y=A.current;if(!y)return;let b=!1;return(async()=>{w({kind:"submitting"});try{let k=await o.getDataSetFormMetadata(s.trim());if(b)return;let E=await le(k,o);if(b)return;let I="";if(S.formType==="CUSTOM"&&S.formId){try{I=(await o.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(_){I="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",_)}I.trim()||(I=ce(E))}else S.formType==="SECTION"&&(I=ce(E));if(b)return;let U=await o.listValidationRules(s.trim()).catch(()=>({validationRules:[]}));if(b)return;let P=(E.categoryCombo?.categories??[]).filter(_=>(_.categoryOptions?.length??0)>1).map(_=>({id:_.id,name:_.name??_.id,options:(_.categoryOptions??[]).map(R=>({id:R.id,name:R.name??R.id}))}));B(P);let C={};for(let _ of P)_.options[0]&&(C[_.id]=_.options[0].id);H(C),q.current=C,y.replaceChildren();for(let[_,R]of[["selectedDataSetId",s.trim()],["selectedPeriodId",d.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let j=document.createElement("input");j.type="hidden",j.id=_,j.value=R,y.appendChild(j)}for(let[_,R]of Object.entries(C)){let j=document.createElement("input");j.type="hidden",j.id=`category-${_}`,j.value=R,j.setAttribute("data-der-category",_),y.appendChild(j)}let T=document.createElement("div");T.id="contentDiv",y.appendChild(T),qe({dataSetId:s.trim(),periodId:d.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:C,validationRules:U.validationRules??[]});for(let _ of Le)be(_);for(let _ of Me)document.querySelector(`script[data-der-custom-form="${_}"]`)||await ye(_);He(),await at(T,I),await nt(T,s.trim(),d.trim(),e.orgUnitUid??"",o),ze(T,()=>s.trim(),()=>d.trim(),()=>e.orgUnitUid??"",()=>({...q.current}),o),Ue(T),Ye(T,w),et(T,E,Ee),Ze(T,E),Xe(T,E),Ke(T,E),xe(_=>_+1),w({kind:"idle"})}catch(k){w({kind:"error",message:`custom form failed to render: ${k.message}`})}})(),()=>{b=!0}},[n,S,s,d,e.orgUnitUid]);let Se=e.bound&&s.trim()!==""&&d.trim()!==""&&p.trim()!==""&&f.trim()!==""&&x.kind!=="submitting";async function Ce(y){y.preventDefault(),w({kind:"submitting"});try{await o.submitAggregate({dataSet:s,period:d,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),w({kind:"ok",message:`Submitted ${p}=${f} for ${d}.`}),g(""),v("")}catch(b){w({kind:"error",message:b.message??"Submission failed"})}}let ie=d.trim()!=="",G=s.trim()!=="",L=G&&ie&&e.bound;$(()=>{if(!L){F(null);return}let y=!1;return(async()=>{try{let b=await o.getCompletion(s.trim(),e.orgUnitUid??"",d.trim());if(y)return;F({completed:!!b.completed,completedAt:b.completedAt})}catch{y||F({completed:!1})}})(),()=>{y=!0}},[s,d,e.orgUnitUid,L]);async function Te(){if(!L||V)return;let y=!O?.completed;if(y){let b=A.current;if(b){let k=[];for(let E of Array.from(b.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&k.push(E);if(k.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${k.length} compulsory value${k.length===1?"":"s"} still missing. Run Validate to jump to them.`}),k[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ne(!0);try{let b=await o.markCompletion({dataSet:s.trim(),orgUnit:e.orgUnitUid??"",period:d.trim(),completed:y});F({completed:!!b.completed,completedAt:b.completedAt}),w({kind:"ok",message:b.completed?"Dataset marked complete.":"Dataset reopened."})}catch(b){w({kind:"error",message:`Completion failed: ${b.message}`})}finally{ne(!1)}}return h(De,{title:"Aggregate data entry",actions:m(Oe,{tone:l.isOnline?"success":"warning",children:l.isOnline?"online":`offline (${l.queuedCount} queued)`}),children:[m("style",{children:ct}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Organisation unit"}),m("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:s,onChange:y=>{u(y.target.value),c("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),r.map(y=>m("option",{value:y.id,children:y.label},y.id))]})]}),ve.map(y=>h("div",{className:"der-de-chip","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-chip-label",children:y.name}),h("select",{className:"der-de-select",value:re[y.id]??"",onChange:b=>{let k={...re,[y.id]:b.target.value};H(k),q.current=k,Fe(A.current,k)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),y.options.map(b=>m("option",{value:b.id,children:b.name},b.id))]})]},y.id)),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:it(S?.periodType,d,c)})]})]}),x.kind==="ok"&&m("div",{style:ot,"data-test":"de-ok",children:x.message}),x.kind==="error"&&m("div",{style:st,"data-test":"de-err",children:x.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!G&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&G&&!ie&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),L&&n==="structured"&&h("form",{onSubmit:Ce,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:y=>g(y.target.value),style:ee})]}),h("label",{children:["Value",m("input",{value:f,onChange:y=>v(y.target.value),inputMode:"decimal",style:ee})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!Se,style:me,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),L&&n==="custom"&&m("div",{className:`der-de-form-card der-de-density-${M}`,children:h("div",{className:"der-de-form-split",children:[m(Ve,{targetRef:A,formVersion:ae}),m("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),L&&n==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Qe,{root:A,formVersion:ae}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${M==="compact"?"comfortable":"compact"} density`,title:`Density: ${M}. Click to switch.`,onClick:()=>Ne(y=>y==="compact"?"comfortable":"compact"),children:M==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{tt(A.current,w,y=>{we(y),J(y.length>0)})},style:pe,"data-test":"de-validate-btn",children:"Validate"}),z.length>0&&!Q&&h("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[z.length," issue",z.length===1?"":"s"]}),!oe&&m("button",{type:"button",onClick:()=>se(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:()=>W(y=>!y),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Te,disabled:V,style:O?.completed?pe:me,"data-test":"de-complete-btn",children:V?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),m(Ge,{open:oe&&!Q,details:_e,onClose:()=>se(!1)}),m(We,{open:ke,onClose:()=>W(!1)}),m(Je,{open:Q,issues:z,onClose:()=>J(!1),onPick:y=>{let b=A.current?.querySelector(`input[name="${y.inputName}"]`);b&&(b.scrollIntoView({behavior:"smooth",block:"center"}),b.focus(),b.select())}})]})}var Me=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Le=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Y=null,K=null,X=null;async function le(i,e){Y||(Y=e.listAllDataElements().then(a=>new Map(a.map(s=>[s.id,s])))),K||(K=e.listAllCategoryCombos().then(a=>new Map(a.map(s=>[s.id,s])))),X||(X=e.listAllCategoryOptionCombos().then(a=>{let s=new Map;for(let u of a){let d=u.categoryCombo?.id;if(!d)continue;let c=s.get(d);c?c.push(u):s.set(d,[u])}return s}));let[l,o,n]=await Promise.all([Y,K,X]),t=a=>{if(!a?.id)return;let s=o.get(a.id),u=n.get(a.id)??[];return s?{id:s.id,name:s.name??s.displayName,categoryOptionCombos:u.map(d=>({id:d.id,name:d.name??d.displayName,categoryOptions:d.categoryOptions??[]})),categories:(s.categories??[]).map(d=>({id:d.id,name:d.name??d.displayName,categoryOptions:(d.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:a},r=a=>{let s=l.get(a.id);return s?{id:s.id,name:s.name??s.displayName,formName:s.formName,valueType:s.valueType,categoryCombo:t(s.categoryCombo)}:a};return{...i,categoryCombo:t(i.categoryCombo)??i.categoryCombo,dataSetElements:(i.dataSetElements??[]).map(a=>({...a,dataElement:a.dataElement?r(a.dataElement):void 0})),sections:(i.sections??[]).map(a=>({...a,dataElements:(a.dataElements??[]).map(s=>r(s))}))}}function ce(i){let e={};for(let a of i.dataSetElements??[])a.dataElement&&(e[a.dataElement.id]=a.dataElement);let l={};for(let a of i.indicators??[])l[a.id]=a;let o=(i.sections??[]).slice().sort((a,s)=>(a.sortOrder??0)-(s.sortOrder??0));if(!o.some(a=>(a.dataElements?.length??0)>0)){let a=(i.dataSetElements??[]).map(s=>s.dataElement).filter(s=>!!s);o=[{id:i.id,name:i.displayName??i.name??"Data entry",sortOrder:0,dataElements:a,indicators:[],greyedFields:[]}]}let t=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let a of o){let s=new Set;for(let d of a.greyedFields??[])d.dataElement?.id&&d.categoryOptionCombo?.id&&s.add(`${d.dataElement.id}:${d.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${t(a.name??"")}</h3>`);let u=new Map;for(let d of a.dataElements??[]){let c=e[d.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,g=u.get(p);g||(g={cc:c.categoryCombo,des:[]},u.set(p,g)),g.des.push(c)}for(let d of u.values()){let c=d.cc.categoryOptionCombos??[],p=d.cc.categories??[];r.push('<div class="der-de-table-scroll">'),r.push('<table class="sectionTable" cellspacing="0">');let g=Pe(p,c);if(r.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){r.push("<tr>"),f===0&&r.push(`<th class="dataElementCell" rowspan="${g.length}">`+t(d.cc.name??"Data element")+"</th>");for(let v of g[f]??[])r.push(`<th colspan="${v.span}">${t(v.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${t(d.cc.name??"Data element")}</th>`);for(let f of c)r.push(`<th>${t(f.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let f of d.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let v of c){let x=`${f.id}-${v.id}-val`;s.has(`${f.id}:${v.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${t(x)}" name="${t(x)}" dataelementid="${t(f.id)}" optioncomboid="${t(v.id)}"></td>`)}r.push("</tr>")}for(let f of a.indicators??[]){let v=l[f.id];v&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),r.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table></div>")}}return r.join(`
`)}function Pe(i,e){if(i.length===0||e.length===0)return[];let l=new Map;for(let r of i)for(let a of r.categoryOptions??[])l.set(a.id,{catId:r.id,name:a.name??a.id});let o=i.length,n=e.map(r=>{let a=new Array(o).fill("");for(let s of r.categoryOptions??[]){let u=l.get(s.id);if(!u)continue;let d=i.findIndex(c=>c.id===u.catId);d>=0&&(a[d]=u.name)}return a});for(let r of n)if(r.some(a=>a===""))return[];let t=[];for(let r=0;r<o;r++){let a=[];for(let s=0;s<n.length;){let u=n[s],d=s+1;for(;d<n.length;){let c=n[d],p=!0;for(let g=0;g<=r;g++)if(u[g]!==c[g]){p=!1;break}if(!p)break;d++}a.push({label:u[r]??"",span:d-s}),s=d}t.push(a)}return t}function qe(i){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let o=l.de;o.currentDataSetId=i.dataSetId,o.currentOrganisationUnitId=i.orgUnitId,o.currentPeriodId=i.periodId,o.currentCategorySelections={...i.aocSelections??{}};let n=i.meta??{},t={},r={};if(n.categoryCombo){r[n.categoryCombo.id]=n.categoryCombo;for(let c of n.categoryCombo.categories??[])t[c.id]=c}o.categories=t,o.categoryCombos=r;let a={},s={};for(let c of n.dataSetElements??[]){let p=c.dataElement;p&&(a[p.id]=p,p.optionSet&&(s[p.optionSet.id]=p.optionSet),p.categoryCombo&&(r[p.categoryCombo.id]=p.categoryCombo))}o.dataElements=a,o.optionSets=s;let u={};for(let c of n.indicators??[])u[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};o.indicatorFormulas=u;let d={};for(let c of i.validationRules??[])d[c.id]=c;o.validationRules=d,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[n.id]:{id:n.id,name:n.name??n.displayName??"",periodType:n.periodType,categoryCombo:n.categoryCombo?.id,periodId:i.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function He(){let i=globalThis;if(i.$&&typeof i.$.ajaxSetup=="function"&&i.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),i.dhis2?.period&&i.$?.calendars?.instance){let e=i.dhis2.period;e.format="yyyy-mm-dd",e.calendar=i.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Fe(i,e){if(!i)return;for(let[o,n]of Object.entries(e)){let t=i.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),i.appendChild(t)),t.value=n}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function ze(i,e,l,o,n,t){let r=d=>{let c=/^(.+)-(.+)-val$/.exec(d);return c?{de:c[1],coc:c[2]}:null},a=new WeakMap,s=i.querySelectorAll('input[name$="-val"]');for(let d of Array.from(s))a.set(d,d.value);let u=async d=>{let c=d.target;if(!c||c.tagName!=="INPUT")return;let p=c.getAttribute("name")??"",g=r(p);if(!g)return;let f=e(),v=l(),x=o();if(!f||!v||!x)return;let w=c.value;if(a.get(c)!==w){Z(c,"saving");try{let S=await t.submitAggregate({dataSet:f,period:v,orgUnit:x,attributeOptionComboSelections:n(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:w}]});a.set(c,w),Z(c,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{Z(c,"error")}}};i.addEventListener("blur",d=>{u(d)},!0)}function Ue(i){i.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let o=l.target;if(!(o instanceof HTMLInputElement))return;let n=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;l.preventDefault();let r=t[2],a=Array.from(i.querySelectorAll(`input[name$="-${r}-val"]`)),s=a.indexOf(o);if(s===-1)return;let u=a[s+(l.shiftKey?-1:1)];u?.focus(),u instanceof HTMLInputElement&&u.select()})}function Be(i){let e=Array.from(i.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),o=[],n=(t,r)=>{for(let a of l)if(a!==r&&t.contains(a))return!0;return!1};return e.forEach((t,r)=>{let a=t.id||`der-de-section-${r}`;t.id=a;let s=null,u=t.parentElement,d=null;for(;u&&u!==i&&!n(u,t);)d=u,u=u.parentElement;if(d&&d.children.length>1&&d!==i)s=d,s.classList.add("der-de-section-slot"),s.dataset.sectionId=a;else{s=document.createElement("div"),s.className="der-de-section-slot",s.dataset.sectionId=a;let c=e[r+1]??null,p=[],g=t;for(;g&&g!==c;){let f=g.nextSibling;p.push(g),g=f}t.parentNode?.insertBefore(s,t);for(let f of p)s.appendChild(f)}o.push({id:a,label:(t.textContent??"").trim(),slot:s})}),o}function Ve({targetRef:i,formVersion:e}){let[l,o]=N([]),[n,t]=N("");return $(()=>{let r=i.current;if(!r)return;let a=Be(r);o(a),t(a[0]?.id??"")},[i,e]),$(()=>{if(!i.current||l.length===0)return;for(let s of l)s.slot.style.display=s.id===n?"":"none";let a=l.find(s=>s.id===n);a&&a.slot.scrollIntoView({behavior:"smooth",block:"start"})},[i,l,n]),l.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:l.map(r=>m("li",{children:m("button",{type:"button",className:"der-de-section-nav__item"+(n===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(r.id),children:r.label})},r.id))})]})}function Qe({root:i,formVersion:e}){let[l,o]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let r=()=>{let s=i.current;if(!s)return;let u=Array.from(s.querySelectorAll('input[name$="-val"]')),d=0,c=0,p=0,g=0,f=0;for(let v of u){v.value.trim()!==""&&d++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?c++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?g++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?p++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&f++}o({total:u.length,filled:d,saving:c,saved:p,queued:g,error:f})};r();let a=window.setInterval(r,800);return()=>window.clearInterval(a)},[i,e]),l.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let n=[];n.push(`${l.filled} of ${l.total} filled`),l.saving>0&&n.push(`${l.saving} saving`),l.queued>0&&n.push(`${l.queued} queued`),l.error>0&&n.push(`${l.error} error`);let t=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:n.join(" \xB7 ")})}function Je({open:i,issues:e,onClose:l,onPick:o}){return $(()=>{if(!i)return;let n=t=>{t.key==="Escape"&&l()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[i,l]),!i||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(n=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>o(n),children:[m("span",{className:"der-de-issues-drawer__de",children:n.deName}),m("span",{className:"der-de-issues-drawer__coc",children:n.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:n.value}),m("span",{children:n.problem})]})]})},`${n.deId}-${n.cocId}`))})]})}function We({open:i,onClose:e}){return $(()=>{if(!i)return;let o=n=>{n.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[i,e]),i?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:h("div",{className:"der-de-shortcuts",children:[h("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,n])=>h("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:o})}),m("dd",{children:n})]},o))})]})}):null}function Ge({open:i,details:e,onClose:l}){if(!i)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let o={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},n={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${n[e.saveState]}`,children:o[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(fe,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(fe,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,r)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},r))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Ye(i,e){i.addEventListener("paste",l=>{let o=l.target;if(!o||o.tagName!=="INPUT")return;let n=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;let r=l.clipboardData?.getData("text/plain")??"";if(!/\r?\n/.test(r))return;let a=r.split(/\r?\n/).map(g=>g.trim()).filter((g,f,v)=>!(f===v.length-1&&g===""));if(a.length===0)return;l.preventDefault();let s=t[2],u=o.closest("[data-section-id]")??i,d=Array.from(u.querySelectorAll(`input[name$="-${s}-val"]`)),c=d.indexOf(o);if(c===-1)return;let p=0;for(let g=0;g<a.length;g++){let f=d[c+g];if(!f)break;f.value=a[g]??"",f.dispatchEvent(new Event("input",{bubbles:!0})),f.dispatchEvent(new Event("blur",{bubbles:!0})),p++}e({kind:"ok",message:`Pasted ${p} value${p===1?"":"s"} into the column (${a.length-p} overflow).`})},!0)}function Ke(i,e){let l=e.indicators??[];if(l.length===0)return;let o=l.filter(d=>d.numerator&&d.denominator).map(d=>({id:d.id,factor:d.indicatorType?.factor??1,numExpr:d.numerator,denExpr:d.denominator}));if(o.length===0)return;let n=Array.from(i.querySelectorAll("input[indicatorid]")),t=new Map;for(let d of Array.from(i.querySelectorAll('input[name$="-val"]')))t.set(d.getAttribute("name")??"",d);let r=d=>{let c=0;for(let[p,g]of t){if(!p.startsWith(`${d}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(c+=f)}return c},a=d=>d.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,g)=>{if(g){let f=t.get(`${p}-${g}-val`),v=parseFloat(f?.value??"");return Number.isFinite(v)?String(v):"0"}return String(r(p))}),s=d=>{if(!/^[\s\d+\-*/().eE]+$/.test(d))return NaN;try{return Function(`"use strict";return (${d})`)()}catch{return NaN}},u=()=>{for(let d of o){let c=s(a(d.numExpr)),p=s(a(d.denExpr)),g=n.find(v=>v.getAttribute("indicatorid")===d.id);if(!g)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){g.value="";continue}let f=c/p*d.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};i.addEventListener("input",d=>{let c=d.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&u()},!0),u()}function Xe(i,e){let l={};for(let o of e.dataSetElements??[])o.dataElement&&(l[o.dataElement.id]=o.dataElement);for(let o of Array.from(i.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!n)continue;let t=l[n[1]],r=t?.formName??t?.name??n[1],a=t?.categoryCombo?.categoryOptionCombos?.find(u=>u.id===n[2]),s=a?.name??a?.displayName??n[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",s===n[2]?`${r}`:`${r}, ${s}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function Ze(i,e){let l=e.compulsoryDataElementOperands??[],o=new Set;for(let n of l){let t=n.dimensionItem;if(!t)continue;let r=t.split(".");r.length===2&&o.add(`${r[0]}:${r[1]}`)}if(o.size!==0)for(let n of Array.from(i.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");t&&o.has(`${t[1]}:${t[2]}`)&&n.setAttribute("data-compulsory","1")}}function et(i,e,l){let o={};for(let t of e.dataSetElements??[])t.dataElement&&(o[t.dataElement.id]=t.dataElement);let n=t=>{let r=t.getAttribute("name")??t.id??"",a=/^(.+)-(.+)-val$/.exec(r);if(!a)return null;let s=a[1],u=a[2],d=o[s],c=d?.categoryCombo,p=c?.categoryOptionCombos?.find(D=>D.id===u),g=[],f=p?.name??p?.displayName??u,v=f.split(/,\s*/).filter(Boolean),x=c?.categories??[];v.forEach((D,A)=>{g.push({category:x[A]?.name??x[A]?.displayName??"",option:D})});let w=t.style.outline||"",S=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:s,cocId:u,deName:d?.name??s,deFormName:d?.formName,valueType:d?.valueType??"TEXT",optionSetId:d?.optionSet?.id,cocName:f,categoryBreakdown:g,value:t.value,saveState:S,inputName:r,compulsory:t.getAttribute("data-compulsory")==="1"}};i.addEventListener("focusin",t=>{let r=t.target;if(r&&r.tagName==="INPUT"){let a=n(r);a&&l(a)}},!0),i.addEventListener("input",t=>{let r=t.target;if(r&&r.tagName==="INPUT"){let a=n(r);a&&l(a)}},!0)}function tt(i,e,l){if(!i)return;let o=globalThis,n=o.dhis2?.de?.dataElements??{},t=o.dhis2?.de?.categoryOptionCombos??{},r=Array.from(i.querySelectorAll('input[name$="-val"]')),a=[];for(let s of r){s.style.outline="";let u=/^(.+)-(.+)-val$/.exec(s.getAttribute("name")??"");if(!u)continue;let d=u[1],c=u[2],p=n[d],g=p?.valueType??"TEXT",f=s.value.trim();if(f===""){s.getAttribute("data-compulsory")==="1"&&(s.style.outline="2px solid #c0392b",a.push({deId:d,cocId:c,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??d,cocName:t[c]?.name??c,inputName:s.name}));continue}let v=rt(f,g);v&&(s.style.outline="2px solid #c0392b",a.push({deId:d,cocId:c,valueType:g,value:f,problem:v,deName:p?.name??d,cocName:t[c]?.name??c,inputName:s.name}))}l(a),a.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${r.length} cells OK.`}):e({kind:"error",message:`Validation found ${a.length} issue${a.length===1?"":"s"}. See the Issues panel.`})}function rt(i,e){let l=Number(i),o=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(i.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(i.toLowerCase()))return"must be yes";break;case"URL":try{new URL(i)}catch{return"must be a valid URL"}break;default:break}return null}function Z(i,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";i.style.outline=`2px solid ${l}`,i.style.transition="outline 150ms",e==="queued"?i.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):i.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{i.style.outline.includes("#1a8754")&&(i.style.outline="1px solid #b7dcc7")},1200)}async function nt(i,e,l,o,n){if(!e||!l||!o)return;let t;try{t=(await n.readAggregateValues(o,l,2e3)).dataValues??[]}catch{return}for(let r of t){let a=r.dataElement,s=r.categoryOptionCombo,u=r.value;if(!a||!s||u==null)continue;let d=i.querySelector(`input[name="${a}-${s}-val"]`);d&&(d.value=u)}}function ye(i){return new Promise((e,l)=>{let o=document.createElement("script");o.src=i,o.async=!1,o.setAttribute("data-der-custom-form",i),o.onload=()=>e(),o.onerror=()=>l(new Error(`failed to load ${i}`)),document.head.appendChild(o)})}function be(i){if(document.querySelector(`link[data-der-custom-form="${i}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=i,e.setAttribute("data-der-custom-form",i),document.head.appendChild(e)}function ue(i){return!i||/^https?:\/\//i.test(i)||i.startsWith("/legacy-custom-forms/")||i.startsWith("/")?i:`/legacy-custom-forms/${i.replace(/^(?:\.{1,2}\/)+/,"")}`}async function at(i,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let n of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(n.tagName==="LINK"){let t=n.getAttribute("href")??"";t&&be(ue(t))}else{let t=document.createElement("style");t.textContent=n.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}n.remove()}let o=[];for(let n of Array.from(l.querySelectorAll("script"))){let t=n.getAttribute("src");t?o.push({src:ue(t)}):o.push({code:n.textContent??""}),n.remove()}for(let n of Array.from(l.body.querySelectorAll("*")))if(n.removeAttribute("style"),n.tagName==="INPUT"){let t=n.getAttribute("id")??"";t.endsWith("-val")&&n.getAttribute("name")!==t&&n.setAttribute("name",t)}for(let n of Array.from(l.body.childNodes))i.appendChild(document.adoptNode(n));for(let n of o)if(n.src)document.querySelector(`script[data-der-custom-form="${n.src}"]`)||await ye(n.src);else if(n.code){let t=document.createElement("script");t.textContent=n.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var ee={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},pe={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ot={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},st={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function it(i,e,l){let o={...ee},n=lt(i);if(n.length===0)return m("input",{value:e,onChange:p=>l(p.target.value),placeholder:i?`DHIS2 ${i} period id`:"e.g. 202611",style:o});let t=[...n];if(e&&!t.some(p=>p.id===e)){let p=dt(i,e)??e;t.unshift({id:e,label:p})}let r=n[0]?.id??null,a=t.findIndex(p=>p.id===e),s=a===-1||a<t.length-1||!!i,u=e!==""&&(a>0||e!==r),d=()=>{if(!i)return;let p=a>=0&&a<t.length-1?t[a+1]?.id??"":ge(i,e||r||"",-1);p&&l(p)},c=()=>{if(!i||!e||e===r)return;let p=a>0?t[a-1]?.id??"":ge(i,e,1);p&&l(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:d,disabled:!s,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>l(p.target.value),style:o,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:c,disabled:!u,className:"der-de-period-btn",children:"\u25B6"})]})}function ge(i,e,l){let o=n=>String(n).padStart(2,"0");switch(i){case"Daily":{if(!/^\d{8}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,r=Number(e.slice(6,8)),a=new Date(n,t,r+l);return`${a.getFullYear()}${o(a.getMonth()+1)}${o(a.getDate())}`}case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);if(!n)return"";let t=Number(n[1]),r=Number(n[2])+l;return r<1?(t-=1,r=te(t)):r>te(t)&&(t+=1,r=1),`${t}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,r=n*12+t+l;return`${Math.floor(r/12)}${o((r%12+12)%12+1)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return"";let t=Number(n[1]),r=Number(n[2])+l;return r<1?(t-=1,r=6):r>6&&(t+=1,r=1),`${t}${o(r)}B`}case"Quarterly":{let n=/^(\d{4})Q(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),r=Number(n[2])+l;return r<1?(t-=1,r=4):r>4&&(t+=1,r=1),`${t}Q${r}`}case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),r=Number(n[2])+l;return r<1?(t-=1,r=2):r>2&&(t+=1,r=1),`${t}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function dt(i,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${l[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let n=(Number(o[2])-1)*2;return`${l[n]}\u2013${l[n+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function lt(i){let e=new Date,l=e.getFullYear(),o=e.getMonth(),n=r=>String(r).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":{let r=[];for(let a=0;a<30;a++){let s=new Date(e);s.setDate(s.getDate()-a);let u=`${s.getFullYear()}${n(s.getMonth()+1)}${n(s.getDate())}`,d=`${s.getFullYear()}-${n(s.getMonth()+1)}-${n(s.getDate())}`;r.push({id:u,label:d})}return r}case"Weekly":{let r=[],a=he(e),s=a.year,u=a.week;for(let d=0;d<12;d++)r.push({id:`${s}W${u}`,label:`${s} W${n(u)}`}),u-=1,u<1&&(s-=1,u=te(s));return r}case"Monthly":{let r=[];for(let a=0;a<24;a++){let s=l,u=o,d=s*12+u-a,c=Math.floor(d/12),p=(d%12+12)%12;r.push({id:`${c}${n(p+1)}`,label:`${t[p]} ${c}`})}return r}case"BiMonthly":{let r=[],a=Math.floor(o/2)+1,s=l,u=a;for(let d=0;d<12;d++){let c=(u-1)*2;r.push({id:`${s}${n(u)}B`,label:`${t[c]}\u2013${t[c+1]} ${s}`}),u-=1,u<1&&(s-=1,u=6)}return r}case"Quarterly":{let r=[],a=Math.floor(o/3)+1,s=l,u=a;for(let d=0;d<8;d++)r.push({id:`${s}Q${u}`,label:`${s} Q${u}`}),u-=1,u<1&&(s-=1,u=4);return r}case"SixMonthly":{let r=[],a=o<6?1:2,s=l,u=a;for(let d=0;d<6;d++)r.push({id:`${s}S${u}`,label:`${s} ${u===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),u-=1,u<1&&(s-=1,u=2);return r}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let r=[];for(let a=0;a<10;a++){let s=l-a;r.push({id:String(s),label:String(s)})}return r}default:return[]}}function he(i){let e=new Date(i.getFullYear(),i.getMonth(),i.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let o=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function te(i){return he(new Date(i,11,28)).week}var ct=`
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
/* Compulsory cells \u2014 DHIS2 marks these with an amber left
 * rule so operators can tell at a glance which fields block
 * "Mark complete". Applies to both SECTION-renderer inputs and
 * CUSTOM author inputs (we tag them the same way). */
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"],
.der-de-custom-form input[data-compulsory="1"] {
  border-left: 3px solid #9b5a00 !important;
}
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"]:placeholder-shown,
.der-de-custom-form input[data-compulsory="1"]:placeholder-shown {
  background: #fef0d8 !important;
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
.der-de-shortcuts-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}
.der-de-shortcuts {
  background: #fff;
  border-radius: 12px;
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
  overflow: hidden;
}
.der-de-shortcuts__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-shortcuts__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2779;
}
.der-de-shortcuts__close {
  background: transparent; border: 0; cursor: pointer;
  font-size: 22px; line-height: 1; color: #6e7a8a;
}
.der-de-shortcuts__list {
  margin: 0;
  padding: 10px 18px 16px;
}
.der-de-shortcuts__row {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f5f7;
}
.der-de-shortcuts__row:last-child { border-bottom: 0; }
.der-de-shortcuts__row dt { margin: 0; }
.der-de-shortcuts__row dd { margin: 0; color: #404b5a; font-size: 13px; }
.der-de-shortcuts kbd {
  display: inline-block;
  padding: 2px 8px;
  background: #eef0f5;
  border: 1px solid #d8dee8;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #101a32;
  box-shadow: 0 1px 0 rgba(16, 26, 50, 0.1);
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
.der-de-details-drawer__compulsory {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #fef0d8;
  color: #9b5a00;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  vertical-align: middle;
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
`;export{Re as default};
