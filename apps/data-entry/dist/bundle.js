/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as $,useRef as de,useState as N}from"react";import{useAuth as Ae,useOrgUnitBinding as $e,useOnlineStatus as Ie,useDerApi as De,ScreenCard as je,StatusPill as Oe}from"@der/app-sdk";import{Fragment as fe,jsx as u,jsxs as h}from"react/jsx-runtime";function Re(){let s=Ae(),e=$e(),d=Ie(),o=De(),[r,t]=N("custom"),[a,i]=N([]),[n,m]=N(""),[l,c]=N(""),[p,y]=N(""),[g,v]=N(""),[x,w]=N({kind:"idle"}),[S,j]=N(null),A=de(null),[re,H]=N({}),q=de({}),[ve,B]=N([]),[O,F]=N(null),[V,ne]=N(!1),[ae,xe]=N(0),[z,we]=N([]),[Q,J]=N(!1),[_e,Ee]=N(null),[oe,se]=N(!0),[ke,W]=N(!1);$(()=>{let f=b=>{if(b.key!=="?")return;let k=b.target;k&&(k.tagName==="INPUT"||k.tagName==="TEXTAREA")||(b.preventDefault(),W(E=>!E))};return window.addEventListener("keydown",f),()=>window.removeEventListener("keydown",f)},[]);let[M,Ne]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});$(()=>{try{window.localStorage.setItem("der-de-density",M)}catch{}},[M]),$(()=>{let f=!1;return(async()=>{try{let b=await o.listDataSets();if(f)return;let k=(b.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,I)=>E.label.localeCompare(I.label));i(k)}catch{}})(),()=>{f=!0}},[]),$(()=>{if(n.trim()===""){j(null),B([]),H({}),q.current={};return}let f=!1;return(async()=>{try{let b=await o.getDataSetMeta(n.trim());if(f)return;let k=!!b.dataEntryForm&&b.formType==="CUSTOM"||b.formType==="SECTION";j({hasCustomForm:k,formId:b.dataEntryForm?.id,displayName:b.displayName??b.name,formType:b.formType,periodType:b.periodType}),t(k?"custom":"structured");try{let E=await o.getDataSetFormMetadata(n.trim());if(f)return;let I=await le(E,o);if(f)return;let U=(I.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));B(U);let P={};for(let C of U)C.options[0]&&(P[C.id]=C.options[0].id);H(P),q.current=P}catch{}}catch{f||j(null)}})(),()=>{f=!0}},[n]),$(()=>{if(r!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let f=A.current;if(!f)return;let b=!1;return(async()=>{w({kind:"submitting"});try{let k=await o.getDataSetFormMetadata(n.trim());if(b)return;let E=await le(k,o);if(b)return;let I="";if(S.formType==="CUSTOM"&&S.formId){try{I=(await o.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(_){I="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",_)}I.trim()||(I=ce(E))}else S.formType==="SECTION"&&(I=ce(E));if(b)return;let U=await o.listValidationRules(n.trim()).catch(()=>({validationRules:[]}));if(b)return;let P=(E.categoryCombo?.categories??[]).filter(_=>(_.categoryOptions?.length??0)>1).map(_=>({id:_.id,name:_.name??_.id,options:(_.categoryOptions??[]).map(R=>({id:R.id,name:R.name??R.id}))}));B(P);let C={};for(let _ of P)_.options[0]&&(C[_.id]=_.options[0].id);H(C),q.current=C,f.replaceChildren();for(let[_,R]of[["selectedDataSetId",n.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let D=document.createElement("input");D.type="hidden",D.id=_,D.value=R,f.appendChild(D)}for(let[_,R]of Object.entries(C)){let D=document.createElement("input");D.type="hidden",D.id=`category-${_}`,D.value=R,D.setAttribute("data-der-category",_),f.appendChild(D)}let T=document.createElement("div");T.id="contentDiv",f.appendChild(T),qe({dataSetId:n.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:C,validationRules:U.validationRules??[]});for(let _ of Le)be(_);for(let _ of Me)document.querySelector(`script[data-der-custom-form="${_}"]`)||await ye(_);He(),await at(T,I),await nt(T,n.trim(),l.trim(),e.orgUnitUid??"",o),ze(T,()=>n.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...q.current}),o),Ue(T),Ye(T,w),et(T,E,Ee),Ze(T,E),Xe(T,E),Ke(T,E),xe(_=>_+1),w({kind:"idle"})}catch(k){w({kind:"error",message:`custom form failed to render: ${k.message}`})}})(),()=>{b=!0}},[r,S,n,l,e.orgUnitUid]);let Se=e.bound&&n.trim()!==""&&l.trim()!==""&&p.trim()!==""&&g.trim()!==""&&x.kind!=="submitting";async function Ce(f){f.preventDefault(),w({kind:"submitting"});try{await o.submitAggregate({dataSet:n,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:g}]}),w({kind:"ok",message:`Submitted ${p}=${g} for ${l}.`}),y(""),v("")}catch(b){w({kind:"error",message:b.message??"Submission failed"})}}let ie=l.trim()!=="",G=n.trim()!=="",L=G&&ie&&e.bound;$(()=>{if(!L){F(null);return}let f=!1;return(async()=>{try{let b=await o.getCompletion(n.trim(),e.orgUnitUid??"",l.trim());if(f)return;F({completed:!!b.completed,completedAt:b.completedAt})}catch{f||F({completed:!1})}})(),()=>{f=!0}},[n,l,e.orgUnitUid,L]);async function Te(){if(!L||V)return;let f=!O?.completed;if(f){let b=A.current;if(b){let k=[];for(let E of Array.from(b.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&k.push(E);if(k.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${k.length} compulsory value${k.length===1?"":"s"} still missing. Run Validate to jump to them.`}),k[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ne(!0);try{let b=await o.markCompletion({dataSet:n.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:f});F({completed:!!b.completed,completedAt:b.completedAt}),w({kind:"ok",message:b.completed?"Dataset marked complete.":"Dataset reopened."})}catch(b){w({kind:"error",message:`Completion failed: ${b.message}`})}finally{ne(!1)}}return h(je,{title:"Aggregate data entry",actions:u(Oe,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[u("style",{children:ct}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[u("span",{className:"der-de-chip-label",children:"Organisation unit"}),u("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[u("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:n,onChange:f=>{m(f.target.value),c("")},"data-test":"der-de-dataset-picker",children:[u("option",{value:"",children:"Select a data set\u2026"}),a.map(f=>u("option",{value:f.id,children:f.label},f.id))]})]}),ve.map(f=>h("div",{className:"der-de-chip","data-test":"de-aoc-chip",children:[u("span",{className:"der-de-chip-label",children:f.name}),h("select",{className:"der-de-select",value:re[f.id]??"",onChange:b=>{let k={...re,[f.id]:b.target.value};H(k),q.current=k,Fe(A.current,k)},"data-test":"de-aoc-select",children:[u("option",{value:"",children:"Select\u2026"}),f.options.map(b=>u("option",{value:b.id,children:b.name},b.id))]})]},f.id)),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),u("span",{className:"der-de-period-wrap",children:it(S?.periodType,l,c)})]})]}),x.kind==="ok"&&u("div",{style:ot,"data-test":"de-ok",children:x.message}),x.kind==="error"&&u("div",{style:st,"data-test":"de-err",children:x.message}),!e.bound&&u("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!G&&u("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&G&&!ie&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),L&&r==="structured"&&h("form",{onSubmit:Ce,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",u("input",{value:p,onChange:f=>y(f.target.value),style:ee})]}),h("label",{children:["Value",u("input",{value:g,onChange:f=>v(f.target.value),inputMode:"decimal",style:ee})]}),u("div",{style:{gridColumn:"1 / -1"},children:u("button",{type:"submit",disabled:!Se,style:me,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),L&&r==="custom"&&u("div",{className:`der-de-form-card der-de-density-${M}`,children:h("div",{className:"der-de-form-split",children:[u(Ve,{targetRef:A,formVersion:ae}),u("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),L&&r==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[u(Qe,{root:A,formVersion:ae}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${M==="compact"?"comfortable":"compact"} density`,title:`Density: ${M}. Click to switch.`,onClick:()=>Ne(f=>f==="compact"?"comfortable":"compact"),children:M==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&u("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),u("button",{type:"button",onClick:()=>{tt(A.current,w,f=>{we(f),J(f.length>0)})},style:pe,"data-test":"de-validate-btn",children:"Validate"}),z.length>0&&!Q&&h("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[z.length," issue",z.length===1?"":"s"]}),!oe&&u("button",{type:"button",onClick:()=>se(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),u("button",{type:"button",onClick:()=>W(f=>!f),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),u("button",{type:"button",onClick:Te,disabled:V,style:O?.completed?pe:me,"data-test":"de-complete-btn",children:V?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),u(Ge,{open:oe&&!Q,details:_e,onClose:()=>se(!1)}),u(We,{open:ke,onClose:()=>W(!1)}),u(Je,{open:Q,issues:z,onClose:()=>J(!1),onPick:f=>{let b=A.current?.querySelector(`input[name="${f.inputName}"]`);b&&(b.scrollIntoView({behavior:"smooth",block:"center"}),b.focus(),b.select())}})]})}var Me=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Le=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Y=null,K=null,X=null;async function le(s,e){Y||(Y=e.listAllDataElements().then(i=>new Map(i.map(n=>[n.id,n])))),K||(K=e.listAllCategoryCombos().then(i=>new Map(i.map(n=>[n.id,n])))),X||(X=e.listAllCategoryOptionCombos().then(i=>{let n=new Map;for(let m of i){let l=m.categoryCombo?.id;if(!l)continue;let c=n.get(l);c?c.push(m):n.set(l,[m])}return n}));let[d,o,r]=await Promise.all([Y,K,X]),t=i=>{if(!i?.id)return;let n=o.get(i.id),m=r.get(i.id)??[];return n?{id:n.id,name:n.name??n.displayName,categoryOptionCombos:m.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(n.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:i},a=i=>{let n=d.get(i.id);return n?{id:n.id,name:n.name??n.displayName,formName:n.formName,valueType:n.valueType,categoryCombo:t(n.categoryCombo)}:i};return{...s,categoryCombo:t(s.categoryCombo)??s.categoryCombo,dataSetElements:(s.dataSetElements??[]).map(i=>({...i,dataElement:i.dataElement?a(i.dataElement):void 0})),sections:(s.sections??[]).map(i=>({...i,dataElements:(i.dataElements??[]).map(n=>a(n))}))}}function ce(s){let e={};for(let i of s.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let d={};for(let i of s.indicators??[])d[i.id]=i;let o=(s.sections??[]).slice().sort((i,n)=>(i.sortOrder??0)-(n.sortOrder??0));if(!o.some(i=>(i.dataElements?.length??0)>0)){let i=(s.dataSetElements??[]).map(n=>n.dataElement).filter(n=>!!n);o=[{id:s.id,name:s.displayName??s.name??"Data entry",sortOrder:0,dataElements:i,indicators:[],greyedFields:[]}]}let t=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let i of o){let n=new Set;for(let l of i.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&n.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${t(i.name??"")}</h3>`);let m=new Map;for(let l of i.dataElements??[]){let c=e[l.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,y=m.get(p);y||(y={cc:c.categoryCombo,des:[]},m.set(p,y)),y.des.push(c)}for(let l of m.values()){let c=l.cc.categoryOptionCombos??[],p=l.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let y=Pe(p,c);if(a.push("<thead>"),y.length>0)for(let g=0;g<y.length;g++){a.push("<tr>"),g===0&&a.push(`<th class="dataElementCell" rowspan="${y.length}">`+t(l.cc.name??"Data element")+"</th>");for(let v of y[g]??[])a.push(`<th colspan="${v.span}">${t(v.label)}</th>`);a.push("</tr>")}else{a.push("<tr>"),a.push(`<th class="dataElementCell">${t(l.cc.name??"Data element")}</th>`);for(let g of c)a.push(`<th>${t(g.name??"")}</th>`);a.push("</tr>")}a.push("</thead><tbody>");for(let g of l.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${t(g.id)}-cell">`+t(g.formName??g.name??g.id)+"</td>");for(let v of c){let x=`${g.id}-${v.id}-val`;n.has(`${g.id}:${v.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${t(x)}" name="${t(x)}" dataelementid="${t(g.id)}" optioncomboid="${t(v.id)}"></td>`)}a.push("</tr>")}for(let g of i.indicators??[]){let v=d[g.id];v&&(a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),a.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),a.push("</tr>"))}a.push("</tbody></table></div>")}}return a.join(`
`)}function Pe(s,e){if(s.length===0)return[];let d=s.map(r=>r.categoryOptions?.length??0);if(d.some(r=>r===0))return[];let o=[];for(let r=0;r<s.length;r++){let t=[],a=1;for(let n=r+1;n<s.length;n++)a*=d[n]??1;let i=1;for(let n=0;n<r;n++)i*=d[n]??1;for(let n=0;n<i;n++)for(let m of s[r]?.categoryOptions??[])t.push({label:m.name??m.id,span:a});o.push(t)}return o}function qe(s){let e=globalThis;e.dhis2=e.dhis2??{};let d=e.dhis2;d.de=d.de??{};let o=d.de;o.currentDataSetId=s.dataSetId,o.currentOrganisationUnitId=s.orgUnitId,o.currentPeriodId=s.periodId,o.currentCategorySelections={...s.aocSelections??{}};let r=s.meta??{},t={},a={};if(r.categoryCombo){a[r.categoryCombo.id]=r.categoryCombo;for(let c of r.categoryCombo.categories??[])t[c.id]=c}o.categories=t,o.categoryCombos=a;let i={},n={};for(let c of r.dataSetElements??[]){let p=c.dataElement;p&&(i[p.id]=p,p.optionSet&&(n[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}o.dataElements=i,o.optionSets=n;let m={};for(let c of r.indicators??[])m[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};o.indicatorFormulas=m;let l={};for(let c of s.validationRules??[])l[c.id]=c;o.validationRules=l,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[r.id]:{id:r.id,name:r.name??r.displayName??"",periodType:r.periodType,categoryCombo:r.categoryCombo?.id,periodId:s.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function He(){let s=globalThis;if(s.$&&typeof s.$.ajaxSetup=="function"&&s.$.ajaxSetup({beforeSend:(e,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),s.dhis2?.period&&s.$?.calendars?.instance){let e=s.dhis2.period;e.format="yyyy-mm-dd",e.calendar=s.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Fe(s,e){if(!s)return;for(let[o,r]of Object.entries(e)){let t=s.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),s.appendChild(t)),t.value=r}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...e})}function ze(s,e,d,o,r,t){let a=l=>{let c=/^(.+)-(.+)-val$/.exec(l);return c?{de:c[1],coc:c[2]}:null},i=new WeakMap,n=s.querySelectorAll('input[name$="-val"]');for(let l of Array.from(n))i.set(l,l.value);let m=async l=>{let c=l.target;if(!c||c.tagName!=="INPUT")return;let p=c.getAttribute("name")??"",y=a(p);if(!y)return;let g=e(),v=d(),x=o();if(!g||!v||!x)return;let w=c.value;if(i.get(c)!==w){Z(c,"saving");try{let S=await t.submitAggregate({dataSet:g,period:v,orgUnit:x,attributeOptionComboSelections:r(),dataValues:[{dataElement:y.de,categoryOptionCombo:y.coc,value:w}]});i.set(c,w),Z(c,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{Z(c,"error")}}};s.addEventListener("blur",l=>{m(l)},!0)}function Ue(s){s.addEventListener("keydown",e=>{let d=e;if(d.key!=="Enter")return;let o=d.target;if(!(o instanceof HTMLInputElement))return;let r=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(r);if(!t)return;d.preventDefault();let a=t[2],i=Array.from(s.querySelectorAll(`input[name$="-${a}-val"]`)),n=i.indexOf(o);if(n===-1)return;let m=i[n+(d.shiftKey?-1:1)];m?.focus(),m instanceof HTMLInputElement&&m.select()})}function Be(s){let e=Array.from(s.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let d=new Set(e),o=[],r=(t,a)=>{for(let i of d)if(i!==a&&t.contains(i))return!0;return!1};return e.forEach((t,a)=>{let i=t.id||`der-de-section-${a}`;t.id=i;let n=null,m=t.parentElement,l=null;for(;m&&m!==s&&!r(m,t);)l=m,m=m.parentElement;if(l&&l.children.length>1&&l!==s)n=l,n.classList.add("der-de-section-slot"),n.dataset.sectionId=i;else{n=document.createElement("div"),n.className="der-de-section-slot",n.dataset.sectionId=i;let c=e[a+1]??null,p=[],y=t;for(;y&&y!==c;){let g=y.nextSibling;p.push(y),y=g}t.parentNode?.insertBefore(n,t);for(let g of p)n.appendChild(g)}o.push({id:i,label:(t.textContent??"").trim(),slot:n})}),o}function Ve({targetRef:s,formVersion:e}){let[d,o]=N([]),[r,t]=N("");return $(()=>{let a=s.current;if(!a)return;let i=Be(a);o(i),t(i[0]?.id??"")},[s,e]),$(()=>{if(!s.current||d.length===0)return;for(let n of d)n.slot.style.display=n.id===r?"":"none";let i=d.find(n=>n.id===r);i&&i.slot.scrollIntoView({behavior:"smooth",block:"start"})},[s,d,r]),d.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[u("div",{className:"der-de-section-nav__title",children:"Sections"}),u("ul",{className:"der-de-section-nav__list",children:d.map(a=>u("li",{children:u("button",{type:"button",className:"der-de-section-nav__item"+(r===a.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(a.id),children:a.label})},a.id))})]})}function Qe({root:s,formVersion:e}){let[d,o]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if($(()=>{let a=()=>{let n=s.current;if(!n)return;let m=Array.from(n.querySelectorAll('input[name$="-val"]')),l=0,c=0,p=0,y=0,g=0;for(let v of m){v.value.trim()!==""&&l++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?c++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?y++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?p++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&g++}o({total:m.length,filled:l,saving:c,saved:p,queued:y,error:g})};a();let i=window.setInterval(a,800);return()=>window.clearInterval(i)},[s,e]),d.total===0)return u("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let r=[];r.push(`${d.filled} of ${d.total} filled`),d.saving>0&&r.push(`${d.saving} saving`),d.queued>0&&r.push(`${d.queued} queued`),d.error>0&&r.push(`${d.error} error`);let t=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return u("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:r.join(" \xB7 ")})}function Je({open:s,issues:e,onClose:d,onPick:o}){return $(()=>{if(!s)return;let r=t=>{t.key==="Escape"&&d()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[s,d]),!s||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),u("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:d,children:"\xD7"})]}),u("ul",{className:"der-de-issues-drawer__list",children:e.map(r=>u("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>o(r),children:[u("span",{className:"der-de-issues-drawer__de",children:r.deName}),u("span",{className:"der-de-issues-drawer__coc",children:r.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[u("code",{className:"der-de-issues-drawer__value",children:r.value}),u("span",{children:r.problem})]})]})},`${r.deId}-${r.cocId}`))})]})}function We({open:s,onClose:e}){return $(()=>{if(!s)return;let o=r=>{r.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[s,e]),s?u("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:h("div",{className:"der-de-shortcuts",children:[h("header",{className:"der-de-shortcuts__head",children:[u("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),u("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),u("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,r])=>h("div",{className:"der-de-shortcuts__row",children:[u("dt",{children:u("kbd",{children:o})}),u("dd",{children:r})]},o))})]})}):null}function Ge({open:s,details:e,onClose:d}){if(!s)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[u("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),u("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:d,children:"\xD7"})]}),u("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let o={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},r={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[u("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),u("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:d,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&u("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),u("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${r[e.saveState]}`,children:o[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[u("dt",{children:"Value type"}),u("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(fe,{children:[u("dt",{children:"Form name"}),u("dd",{children:e.deFormName})]}),u("dt",{children:"Data element"}),u("dd",{children:u("code",{children:e.deId})}),u("dt",{children:"Category combo"}),u("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(fe,{children:[u("dt",{children:"Breakdown"}),u("dd",{children:u("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,a)=>h("li",{children:[u("span",{className:"der-de-details-drawer__cat",children:t.category}),u("span",{className:"der-de-details-drawer__opt",children:t.option})]},a))})})]}),u("dt",{children:"COC id"}),u("dd",{children:u("code",{children:e.cocId})}),u("dt",{children:"Current value"}),u("dd",{children:e.value||u("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Ye(s,e){s.addEventListener("paste",d=>{let o=d.target;if(!o||o.tagName!=="INPUT")return;let r=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(r);if(!t)return;let a=d.clipboardData?.getData("text/plain")??"";if(!/\r?\n/.test(a))return;let i=a.split(/\r?\n/).map(y=>y.trim()).filter((y,g,v)=>!(g===v.length-1&&y===""));if(i.length===0)return;d.preventDefault();let n=t[2],m=o.closest("[data-section-id]")??s,l=Array.from(m.querySelectorAll(`input[name$="-${n}-val"]`)),c=l.indexOf(o);if(c===-1)return;let p=0;for(let y=0;y<i.length;y++){let g=l[c+y];if(!g)break;g.value=i[y]??"",g.dispatchEvent(new Event("input",{bubbles:!0})),g.dispatchEvent(new Event("blur",{bubbles:!0})),p++}e({kind:"ok",message:`Pasted ${p} value${p===1?"":"s"} into the column (${i.length-p} overflow).`})},!0)}function Ke(s,e){let d=e.indicators??[];if(d.length===0)return;let o=d.filter(l=>l.numerator&&l.denominator).map(l=>({id:l.id,factor:l.indicatorType?.factor??1,numExpr:l.numerator,denExpr:l.denominator}));if(o.length===0)return;let r=Array.from(s.querySelectorAll("input[indicatorid]")),t=new Map;for(let l of Array.from(s.querySelectorAll('input[name$="-val"]')))t.set(l.getAttribute("name")??"",l);let a=l=>{let c=0;for(let[p,y]of t){if(!p.startsWith(`${l}-`))continue;let g=parseFloat(y.value);Number.isFinite(g)&&(c+=g)}return c},i=l=>l.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,y)=>{if(y){let g=t.get(`${p}-${y}-val`),v=parseFloat(g?.value??"");return Number.isFinite(v)?String(v):"0"}return String(a(p))}),n=l=>{if(!/^[\s\d+\-*/().eE]+$/.test(l))return NaN;try{return Function(`"use strict";return (${l})`)()}catch{return NaN}},m=()=>{for(let l of o){let c=n(i(l.numExpr)),p=n(i(l.denExpr)),y=r.find(v=>v.getAttribute("indicatorid")===l.id);if(!y)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){y.value="";continue}let g=c/p*l.factor;y.value=Number.isInteger(g)?String(g):g.toFixed(2)}};s.addEventListener("input",l=>{let c=l.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&m()},!0),m()}function Xe(s,e){let d={};for(let o of e.dataSetElements??[])o.dataElement&&(d[o.dataElement.id]=o.dataElement);for(let o of Array.from(s.querySelectorAll('input[name$="-val"]'))){let r=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!r)continue;let t=d[r[1]],a=t?.formName??t?.name??r[1],i=t?.categoryCombo?.categoryOptionCombos?.find(m=>m.id===r[2]),n=i?.name??i?.displayName??r[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",n===r[2]?`${a}`:`${a}, ${n}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function Ze(s,e){let d=e.compulsoryDataElementOperands??[],o=new Set;for(let r of d){let t=r.dimensionItem;if(!t)continue;let a=t.split(".");a.length===2&&o.add(`${a[0]}:${a[1]}`)}if(o.size!==0)for(let r of Array.from(s.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");t&&o.has(`${t[1]}:${t[2]}`)&&r.setAttribute("data-compulsory","1")}}function et(s,e,d){let o={};for(let t of e.dataSetElements??[])t.dataElement&&(o[t.dataElement.id]=t.dataElement);let r=t=>{let a=t.getAttribute("name")??t.id??"",i=/^(.+)-(.+)-val$/.exec(a);if(!i)return null;let n=i[1],m=i[2],l=o[n],c=l?.categoryCombo,p=c?.categoryOptionCombos?.find(j=>j.id===m),y=[],g=p?.name??p?.displayName??m,v=g.split(/,\s*/).filter(Boolean),x=c?.categories??[];v.forEach((j,A)=>{y.push({category:x[A]?.name??x[A]?.displayName??"",option:j})});let w=t.style.outline||"",S=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:n,cocId:m,deName:l?.name??n,deFormName:l?.formName,valueType:l?.valueType??"TEXT",optionSetId:l?.optionSet?.id,cocName:g,categoryBreakdown:y,value:t.value,saveState:S,inputName:a,compulsory:t.getAttribute("data-compulsory")==="1"}};s.addEventListener("focusin",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let i=r(a);i&&d(i)}},!0),s.addEventListener("input",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let i=r(a);i&&d(i)}},!0)}function tt(s,e,d){if(!s)return;let o=globalThis,r=o.dhis2?.de?.dataElements??{},t=o.dhis2?.de?.categoryOptionCombos??{},a=Array.from(s.querySelectorAll('input[name$="-val"]')),i=[];for(let n of a){n.style.outline="";let m=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!m)continue;let l=m[1],c=m[2],p=r[l],y=p?.valueType??"TEXT",g=n.value.trim();if(g===""){n.getAttribute("data-compulsory")==="1"&&(n.style.outline="2px solid #c0392b",i.push({deId:l,cocId:c,valueType:y,value:"",problem:"compulsory value missing",deName:p?.name??l,cocName:t[c]?.name??c,inputName:n.name}));continue}let v=rt(g,y);v&&(n.style.outline="2px solid #c0392b",i.push({deId:l,cocId:c,valueType:y,value:g,problem:v,deName:p?.name??l,cocName:t[c]?.name??c,inputName:n.name}))}d(i),i.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${i.length} issue${i.length===1?"":"s"}. See the Issues panel.`})}function rt(s,e){let d=Number(s),o=Number.isInteger(d);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(s.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(s.toLowerCase()))return"must be yes";break;case"URL":try{new URL(s)}catch{return"must be a valid URL"}break;default:break}return null}function Z(s,e){let d=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";s.style.outline=`2px solid ${d}`,s.style.transition="outline 150ms",e==="queued"?s.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):s.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{s.style.outline.includes("#1a8754")&&(s.style.outline="1px solid #b7dcc7")},1200)}async function nt(s,e,d,o,r){if(!e||!d||!o)return;let t;try{t=(await r.readAggregateValues(o,d,2e3)).dataValues??[]}catch{return}for(let a of t){let i=a.dataElement,n=a.categoryOptionCombo,m=a.value;if(!i||!n||m==null)continue;let l=s.querySelector(`input[name="${i}-${n}-val"]`);l&&(l.value=m)}}function ye(s){return new Promise((e,d)=>{let o=document.createElement("script");o.src=s,o.async=!1,o.setAttribute("data-der-custom-form",s),o.onload=()=>e(),o.onerror=()=>d(new Error(`failed to load ${s}`)),document.head.appendChild(o)})}function be(s){if(document.querySelector(`link[data-der-custom-form="${s}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=s,e.setAttribute("data-der-custom-form",s),document.head.appendChild(e)}function ue(s){return!s||/^https?:\/\//i.test(s)||s.startsWith("/legacy-custom-forms/")||s.startsWith("/")?s:`/legacy-custom-forms/${s.replace(/^(?:\.{1,2}\/)+/,"")}`}async function at(s,e){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let r of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let t=r.getAttribute("href")??"";t&&be(ue(t))}else{let t=document.createElement("style");t.textContent=r.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}r.remove()}let o=[];for(let r of Array.from(d.querySelectorAll("script"))){let t=r.getAttribute("src");t?o.push({src:ue(t)}):o.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(d.body.querySelectorAll("*")))if(r.removeAttribute("style"),r.tagName==="INPUT"){let t=r.getAttribute("id")??"";t.endsWith("-val")&&r.getAttribute("name")!==t&&r.setAttribute("name",t)}for(let r of Array.from(d.body.childNodes))s.appendChild(document.adoptNode(r));for(let r of o)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await ye(r.src);else if(r.code){let t=document.createElement("script");t.textContent=r.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var ee={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},pe={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ot={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},st={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function it(s,e,d){let o={...ee},r=lt(s);if(r.length===0)return u("input",{value:e,onChange:p=>d(p.target.value),placeholder:s?`DHIS2 ${s} period id`:"e.g. 202611",style:o});let t=[...r];if(e&&!t.some(p=>p.id===e)){let p=dt(s,e)??e;t.unshift({id:e,label:p})}let a=r[0]?.id??null,i=t.findIndex(p=>p.id===e),n=i===-1||i<t.length-1||!!s,m=e!==""&&(i>0||e!==a),l=()=>{if(!s)return;let p=i>=0&&i<t.length-1?t[i+1]?.id??"":ge(s,e||a||"",-1);p&&d(p)},c=()=>{if(!s||!e||e===a)return;let p=i>0?t[i-1]?.id??"":ge(s,e,1);p&&d(p)};return h("span",{className:"der-de-period-nav",children:[u("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!n,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>d(p.target.value),style:o,children:[u("option",{value:"",children:"Select a period\u2026"}),t.map(p=>u("option",{value:p.id,children:p.label},p.id))]}),u("button",{type:"button","aria-label":"Next period",onClick:c,disabled:!m,className:"der-de-period-btn",children:"\u25B6"})]})}function ge(s,e,d){let o=r=>String(r).padStart(2,"0");switch(s){case"Daily":{if(!/^\d{8}$/.test(e))return"";let r=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=Number(e.slice(6,8)),i=new Date(r,t,a+d);return`${i.getFullYear()}${o(i.getMonth()+1)}${o(i.getDate())}`}case"Weekly":{let r=/^(\d{4})W(\d{1,2})$/.exec(e);if(!r)return"";let t=Number(r[1]),a=Number(r[2])+d;return a<1?(t-=1,a=te(t)):a>te(t)&&(t+=1,a=1),`${t}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let r=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=r*12+t+d;return`${Math.floor(a/12)}${o((a%12+12)%12+1)}`}case"BiMonthly":{let r=/^(\d{4})(\d{2})B$/.exec(e);if(!r)return"";let t=Number(r[1]),a=Number(r[2])+d;return a<1?(t-=1,a=6):a>6&&(t+=1,a=1),`${t}${o(a)}B`}case"Quarterly":{let r=/^(\d{4})Q(\d)$/.exec(e);if(!r)return"";let t=Number(r[1]),a=Number(r[2])+d;return a<1?(t-=1,a=4):a>4&&(t+=1,a=1),`${t}Q${a}`}case"SixMonthly":{let r=/^(\d{4})S(\d)$/.exec(e);if(!r)return"";let t=Number(r[1]),a=Number(r[2])+d;return a<1?(t-=1,a=2):a>2&&(t+=1,a=1),`${t}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+d):"";default:return""}}function dt(s,e){let d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${d[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let r=(Number(o[2])-1)*2;return`${d[r]}\u2013${d[r+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function lt(s){let e=new Date,d=e.getFullYear(),o=e.getMonth(),r=a=>String(a).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":{let a=[];for(let i=0;i<30;i++){let n=new Date(e);n.setDate(n.getDate()-i);let m=`${n.getFullYear()}${r(n.getMonth()+1)}${r(n.getDate())}`,l=`${n.getFullYear()}-${r(n.getMonth()+1)}-${r(n.getDate())}`;a.push({id:m,label:l})}return a}case"Weekly":{let a=[],i=he(e),n=i.year,m=i.week;for(let l=0;l<12;l++)a.push({id:`${n}W${m}`,label:`${n} W${r(m)}`}),m-=1,m<1&&(n-=1,m=te(n));return a}case"Monthly":{let a=[];for(let i=0;i<24;i++){let n=d,m=o,l=n*12+m-i,c=Math.floor(l/12),p=(l%12+12)%12;a.push({id:`${c}${r(p+1)}`,label:`${t[p]} ${c}`})}return a}case"BiMonthly":{let a=[],i=Math.floor(o/2)+1,n=d,m=i;for(let l=0;l<12;l++){let c=(m-1)*2;a.push({id:`${n}${r(m)}B`,label:`${t[c]}\u2013${t[c+1]} ${n}`}),m-=1,m<1&&(n-=1,m=6)}return a}case"Quarterly":{let a=[],i=Math.floor(o/3)+1,n=d,m=i;for(let l=0;l<8;l++)a.push({id:`${n}Q${m}`,label:`${n} Q${m}`}),m-=1,m<1&&(n-=1,m=4);return a}case"SixMonthly":{let a=[],i=o<6?1:2,n=d,m=i;for(let l=0;l<6;l++)a.push({id:`${n}S${m}`,label:`${n} ${m===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),m-=1,m<1&&(n-=1,m=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let i=0;i<10;i++){let n=d-i;a.push({id:String(n),label:String(n)})}return a}default:return[]}}function he(s){let e=new Date(s.getFullYear(),s.getMonth(),s.getDate()),d=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-d);let o=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function te(s){return he(new Date(s,11,28)).week}var ct=`
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
