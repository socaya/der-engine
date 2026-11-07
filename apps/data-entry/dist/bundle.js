/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as se,useState as N}from"react";import{useAuth as Se,useOrgUnitBinding as Ce,useOnlineStatus as Te,useDerApi as Ae,ScreenCard as $e}from"@der/app-sdk";import{Fragment as it,jsx as p,jsxs as x}from"react/jsx-runtime";function Ie(){let s=Se(),e=Ce(),l=Te(),n=Ae(),[a,r]=N("custom"),[o,i]=N([]),[t,c]=N(""),[d,u]=N(""),[m,g]=N(""),[f,h]=N(""),[_,w]=N({kind:"idle"}),[v,C]=N(null),T=se(null),[O,R]=N({}),z=se({}),[be,B]=N([]),[M,F]=N(null),[Q,ae]=N(!1),[J,ye]=N(0),[U,he]=N([]),[oe,W]=N(!1),[ve,xe]=N(null),[_e,G]=N(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let S=y.target;S&&(S.tagName==="INPUT"||S.tagName==="TEXTAREA")||(y.preventDefault(),G(E=>!E))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[q,we]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),I(()=>{let b=!1;return(async()=>{try{let y=await n.listDataSets();if(b)return;let S=(y.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,j)=>E.label.localeCompare(j.label));i(S)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(t.trim()===""){C(null),B([]),R({}),z.current={};return}let b=!1;return(async()=>{try{let y=await n.getDataSetMeta(t.trim());if(b)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),r(S?"custom":"structured");try{let E=await n.getDataSetFormMetadata(t.trim());if(b)return;let j=await ie(E,n);if(b)return;let V=(j.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));B(V);let P={};for(let A of V)A.options[0]&&(P[A.id]=A.options[0].id);R(P),z.current=P}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[t]),I(()=>{if(a!=="custom"||!v?.hasCustomForm||v.formType==="CUSTOM"&&!v.formId)return;let b=T.current;if(!b)return;let y=!1;return(async()=>{w({kind:"submitting"});try{let S=await n.getDataSetFormMetadata(t.trim());if(y)return;let E=await ie(S,n);if(y)return;let j="";if(v.formType==="CUSTOM"&&v.formId){try{j=(await n.getDataEntryFormHtml(v.formId)).htmlCode??""}catch(k){j="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",k)}j.trim()||(j=de(E))}else v.formType==="SECTION"&&(j=de(E));if(y)return;let V=await n.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(y)return;let P=(E.categoryCombo?.categories??[]).filter(k=>(k.categoryOptions?.length??0)>1).map(k=>({id:k.id,name:k.name??k.id,options:(k.categoryOptions??[]).map(L=>({id:L.id,name:L.name??L.id}))}));B(P);let A={};for(let k of P)k.options[0]&&(A[k.id]=k.options[0].id);R(A),z.current=A,b.replaceChildren();for(let[k,L]of[["selectedDataSetId",t.trim()],["selectedPeriodId",d.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let D=document.createElement("input");D.type="hidden",D.id=k,D.value=L,b.appendChild(D)}for(let[k,L]of Object.entries(A)){let D=document.createElement("input");D.type="hidden",D.id=`category-${k}`,D.value=L,D.setAttribute("data-der-category",k),b.appendChild(D)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Oe({dataSetId:t.trim(),periodId:d.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:A,validationRules:V.validationRules??[]});for(let k of De)ge(k);for(let k of je)document.querySelector(`script[data-der-custom-form="${k}"]`)||await pe(k);Me(),await et($,j),await Ze($,t.trim(),d.trim(),e.orgUnitUid??"",n),qe($,()=>t.trim(),()=>d.trim(),()=>e.orgUnitUid??"",()=>({...z.current}),n),He($),Qe($,w),Ye($,E,xe),Ge($,E),We($,E),Je($,E),ye(k=>k+1),w({kind:"idle"})}catch(S){w({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[a,v,t,d,e.orgUnitUid]);let ke=e.bound&&t.trim()!==""&&d.trim()!==""&&m.trim()!==""&&f.trim()!==""&&_.kind!=="submitting";async function Ee(b){b.preventDefault(),w({kind:"submitting"});try{await n.submitAggregate({dataSet:t,period:d,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:f}]}),w({kind:"ok",message:`Submitted ${m}=${f} for ${d}.`}),g(""),h("")}catch(y){w({kind:"error",message:y.message??"Submission failed"})}}let ne=d.trim()!=="",Y=t.trim()!=="",H=Y&&ne&&e.bound;I(()=>{if(!H){F(null);return}let b=!1;return(async()=>{try{let y=await n.getCompletion(t.trim(),e.orgUnitUid??"",d.trim());if(b)return;F({completed:!!y.completed,completedAt:y.completedAt})}catch{b||F({completed:!1})}})(),()=>{b=!0}},[t,d,e.orgUnitUid,H]);async function Ne(){if(!H||Q)return;let b=!M?.completed;if(b){let y=T.current;if(y){let S=[];for(let E of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&S.push(E);if(S.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${S.length} compulsory value${S.length===1?"":"s"} still missing. Run Validate to jump to them.`}),S[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ae(!0);try{let y=await n.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:d.trim(),completed:b});F({completed:!!y.completed,completedAt:y.completedAt}),w({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){w({kind:"error",message:`Completion failed: ${y.message}`})}finally{ae(!1)}}return x($e,{dataTest:"der-aggregate-entry",children:[p("style",{children:st}),x("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[x("div",{className:"der-de-toolbar__head",children:[p("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),p("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),p("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]}),x("div",{className:"der-de-toolbar__picks",children:[x("label",{className:"der-de-toolbar__field",children:[p("span",{className:"der-de-toolbar__field-label",children:"Data set"}),x("select",{className:"der-de-toolbar__select",value:t,onChange:b=>{c(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),o.map(b=>p("option",{value:b.id,children:b.label},b.id))]})]}),be.map(b=>x("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[p("span",{className:"der-de-toolbar__field-label",children:b.name}),x("select",{className:"der-de-toolbar__select",value:O[b.id]??"",onChange:y=>{let S={...O,[b.id]:y.target.value};R(S),z.current=S,Le(T.current,S)},"data-test":"de-aoc-select",children:[p("option",{value:"",children:"Select\u2026"}),b.options.map(y=>p("option",{value:y.id,children:y.name},y.id))]})]},b.id)),x("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[x("span",{className:"der-de-toolbar__field-label",children:["Period",v?.periodType?` \xB7 ${v.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:at(v?.periodType,d,u)})]})]})]}),_.kind==="ok"&&p("div",{style:tt,"data-test":"de-ok",children:_.message}),_.kind==="error"&&p("div",{style:rt,"data-test":"de-err",children:_.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Y&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Y&&!ne&&x("div",{className:"der-de-placeholder",children:["Pick a period to load the ",v?.formType==="SECTION"?"section":"data entry"," form."]}),H&&a==="structured"&&x("form",{onSubmit:Ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[x("label",{children:["Data element UID",p("input",{value:m,onChange:b=>g(b.target.value),style:te})]}),x("label",{children:["Value",p("input",{value:f,onChange:b=>h(b.target.value),inputMode:"decimal",style:te})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!ke,style:ce,children:_.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),H&&a==="custom"&&x("div",{className:`der-de-form-card der-de-density-${q}`,children:[p(Ue,{root:T,details:ve,formVersion:J}),x("div",{className:"der-de-form-split",children:[p(ze,{targetRef:T,formVersion:J}),p("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),H&&a==="custom"&&x("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(Fe,{root:T,formVersion:J}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>we(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),M&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:M.completed?`Complete${M.completedAt?" \xB7 "+new Date(M.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Ke(T.current,w,b=>{he(b),W(b.length>0)})},style:ue,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!oe&&x("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),p("button",{type:"button",onClick:()=>G(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),p("button",{type:"button",onClick:Ne,disabled:Q,style:M?.completed?ue:ce,"data-test":"de-complete-btn",children:Q?"Saving\u2026":M?.completed?"Reopen":"Mark complete"})]}),p(Be,{open:_e,onClose:()=>G(!1)}),p(Ve,{open:oe,issues:U,onClose:()=>W(!1),onPick:b=>{let y=T.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select())}})]})}var je=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],De=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],K=null,X=null,Z=null;async function ie(s,e){K||(K=e.listAllDataElements().then(i=>new Map(i.map(t=>[t.id,t])))),X||(X=e.listAllCategoryCombos().then(i=>new Map(i.map(t=>[t.id,t])))),Z||(Z=e.listAllCategoryOptionCombos().then(i=>{let t=new Map;for(let c of i){let d=c.categoryCombo?.id;if(!d)continue;let u=t.get(d);u?u.push(c):t.set(d,[c])}return t}));let[l,n,a]=await Promise.all([K,X,Z]),r=i=>{if(!i?.id)return;let t=n.get(i.id),c=a.get(i.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(d=>({id:d.id,name:d.name??d.displayName,categoryOptions:d.categoryOptions??[]})),categories:(t.categories??[]).map(d=>({id:d.id,name:d.name??d.displayName,categoryOptions:(d.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:i},o=i=>{let t=l.get(i.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:r(t.categoryCombo)}:i};return{...s,categoryCombo:r(s.categoryCombo)??s.categoryCombo,dataSetElements:(s.dataSetElements??[]).map(i=>({...i,dataElement:i.dataElement?o(i.dataElement):void 0})),sections:(s.sections??[]).map(i=>({...i,dataElements:(i.dataElements??[]).map(t=>o(t))}))}}function de(s){let e={};for(let i of s.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let l={};for(let i of s.indicators??[])l[i.id]=i;let n=(s.sections??[]).slice().sort((i,t)=>(i.sortOrder??0)-(t.sortOrder??0));if(!n.some(i=>(i.dataElements?.length??0)>0)){let i=(s.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);n=[{id:s.id,name:s.displayName??s.name??"Data entry",sortOrder:0,dataElements:i,indicators:[],greyedFields:[]}]}let r=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),o=[];for(let i of n){let t=new Set;for(let d of i.greyedFields??[])d.dataElement?.id&&d.categoryOptionCombo?.id&&t.add(`${d.dataElement.id}:${d.categoryOptionCombo.id}`);o.push(`<h3 class="formSection">${r(i.name??"")}</h3>`);let c=new Map;for(let d of i.dataElements??[]){let u=e[d.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,g=c.get(m);g||(g={cc:u.categoryCombo,des:[]},c.set(m,g)),g.des.push(u)}for(let d of c.values()){let u=d.cc.categoryOptionCombos??[],m=d.cc.categories??[];o.push('<div class="der-de-table-scroll">'),o.push('<table class="sectionTable" cellspacing="0">');let g=Re(m,u);if(o.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){o.push("<tr>"),f===0&&o.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let h of g[f]??[])o.push(`<th colspan="${h.span}">${r(h.label)}</th>`);o.push("</tr>")}else{o.push("<tr>"),o.push('<th class="dataElementCell">Data elements</th>');for(let f of u)o.push(`<th>${r(f.name??"")}</th>`);o.push("</tr>")}o.push("</thead><tbody>");for(let f of d.des){o.push("<tr>"),o.push(`<td class="dataElementCell" id="${r(f.id)}-cell">`+r(f.formName??f.name??f.id)+"</td>");for(let h of u){let _=`${f.id}-${h.id}-val`;t.has(`${f.id}:${h.id}`)?o.push('<td class="greyed">\u2014</td>'):o.push(`<td><input type="text" id="${r(_)}" name="${r(_)}" dataelementid="${r(f.id)}" optioncomboid="${r(h.id)}"></td>`)}o.push("</tr>")}for(let f of i.indicators??[]){let h=l[f.id];h&&(o.push('<tr class="indicatorRow">'),o.push(`<td class="dataElementCell">${r(h.name??h.id)}</td>`),o.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${r(h.id)}" readonly></td>`),o.push("</tr>"))}o.push("</tbody></table></div>")}}return o.join(`
`)}function Re(s,e){if(s.length===0||e.length===0)return[];let l=new Map;for(let o of s)for(let i of o.categoryOptions??[])l.set(i.id,{catId:o.id,name:i.name??i.id});let n=s.length,a=e.map(o=>{let i=new Array(n).fill("");for(let t of o.categoryOptions??[]){let c=l.get(t.id);if(!c)continue;let d=s.findIndex(u=>u.id===c.catId);d>=0&&(i[d]=c.name)}return i});for(let o of a)if(o.some(i=>i===""))return[];let r=[];for(let o=0;o<n;o++){let i=[];for(let t=0;t<a.length;){let c=a[t],d=t+1;for(;d<a.length;){let u=a[d],m=!0;for(let g=0;g<=o;g++)if(c[g]!==u[g]){m=!1;break}if(!m)break;d++}i.push({label:c[o]??"",span:d-t}),t=d}r.push(i)}return r}function Oe(s){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let n=l.de;n.currentDataSetId=s.dataSetId,n.currentOrganisationUnitId=s.orgUnitId,n.currentPeriodId=s.periodId,n.currentCategorySelections={...s.aocSelections??{}};let a=s.meta??{},r={},o={};if(a.categoryCombo){o[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])r[u.id]=u}n.categories=r,n.categoryCombos=o;let i={},t={};for(let u of a.dataSetElements??[]){let m=u.dataElement;m&&(i[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(o[m.categoryCombo.id]=m.categoryCombo))}n.dataElements=i,n.optionSets=t;let c={};for(let u of a.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};n.indicatorFormulas=c;let d={};for(let u of s.validationRules??[])d[u.id]=u;n.validationRules=d,n.lockExceptions=[],n.emptyOrganisationUnits=[],n.significantZeros=[],n.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:s.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Me(){let s=globalThis;if(s.$&&typeof s.$.ajaxSetup=="function"&&s.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),s.dhis2?.period&&s.$?.calendars?.instance){let e=s.dhis2.period;e.format="yyyy-mm-dd",e.calendar=s.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Le(s,e){if(!s)return;for(let[n,a]of Object.entries(e)){let r=s.querySelector(`input[data-der-category="${n}"]`);r||(r=document.createElement("input"),r.type="hidden",r.id=`category-${n}`,r.setAttribute("data-der-category",n),s.appendChild(r)),r.value=a}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function qe(s,e,l,n,a,r){let o=d=>{let u=/^(.+)-(.+)-val$/.exec(d);return u?{de:u[1],coc:u[2]}:null},i=new WeakMap,t=s.querySelectorAll('input[name$="-val"]');for(let d of Array.from(t))i.set(d,d.value);let c=async d=>{let u=d.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",g=o(m);if(!g)return;let f=e(),h=l(),_=n();if(!f||!h||!_)return;let w=u.value;if(i.get(u)!==w){ee(u,"saving");try{let v=await r.submitAggregate({dataSet:f,period:h,orgUnit:_,attributeOptionComboSelections:a(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:w}]});i.set(u,w),ee(u,v?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ee(u,"error")}}};s.addEventListener("blur",d=>{c(d)},!0)}function He(s){s.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let n=l.target;if(!(n instanceof HTMLInputElement))return;let a=n.getAttribute("name")??"",r=/^(.+)-(.+)-val$/.exec(a);if(!r)return;l.preventDefault();let o=r[2],i=Array.from(s.querySelectorAll(`input[name$="-${o}-val"]`)),t=i.indexOf(n);if(t===-1)return;let c=i[t+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe(s){let e=Array.from(s.querySelectorAll("h2, h3, h4")).filter(r=>(r.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),n=[],a=(r,o)=>{for(let i of l)if(i!==o&&r.contains(i))return!0;return!1};return e.forEach((r,o)=>{let i=r.id||`der-de-section-${o}`;r.id=i;let t=null,c=r.parentElement,d=null;for(;c&&c!==s&&!a(c,r);)d=c,c=c.parentElement;if(d&&d.children.length>1&&d!==s)t=d,t.classList.add("der-de-section-slot"),t.dataset.sectionId=i;else{t=document.createElement("div"),t.className="der-de-section-slot",t.dataset.sectionId=i;let u=e[o+1]??null,m=[],g=r;for(;g&&g!==u;){let f=g.nextSibling;m.push(g),g=f}r.parentNode?.insertBefore(t,r);for(let f of m)t.appendChild(f)}n.push({id:i,label:(r.textContent??"").trim(),slot:t})}),n}function ze({targetRef:s,formVersion:e}){let[l,n]=N([]),[a,r]=N(""),[o,i]=N({});return I(()=>{let t=s.current;if(!t)return;let c=Pe(t);n(c),r(c[0]?.id??"")},[s,e]),I(()=>{if(l.length===0)return;let t=()=>{let u={};for(let m of l){let g=Array.from(m.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(h=>h.value.trim()!=="").length;u[m.id]={filled:f,total:g.length}}i(u)};t();let c=s.current;if(!c)return;let d=u=>{let m=u.target;m&&m.tagName==="INPUT"&&/-val$/.test(m.getAttribute("name")??"")&&t()};return c.addEventListener("input",d,!0),()=>{c.removeEventListener("input",d,!0)}},[s,l]),I(()=>{if(!s.current||l.length===0)return;for(let d of l)d.slot.style.display=d.id===a?"":"none";let c=l.find(d=>d.id===a);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[s,l,a]),l.length<2?null:x("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:l.map(t=>{let c=o[t.id],d=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return p("li",{children:x("button",{type:"button",className:"der-de-section-nav__item"+(a===t.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>r(t.id),children:[p("span",{className:"der-de-section-nav__label",children:t.label}),c&&c.total>0&&p("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${d}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:d==="done"?"\u2713":`${c.filled}/${c.total}`})]})},t.id)})})]})}function Fe({root:s,formVersion:e}){let[l,n]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let o=()=>{let t=s.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),d=0,u=0,m=0,g=0,f=0;for(let h of c){h.value.trim()!==""&&d++;let _=h.style.outline||"";_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?u++:_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?g++:_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?m++:(_.includes("rgb(169, 50, 50)")||_.includes("#a93232"))&&f++}n({total:c.length,filled:d,saving:u,saved:m,queued:g,error:f})};o();let i=window.setInterval(o,800);return()=>window.clearInterval(i)},[s,e]),l.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${l.filled} of ${l.total} filled`),l.saving>0&&a.push(`${l.saving} saving`),l.queued>0&&a.push(`${l.queued} queued`),l.error>0&&a.push(`${l.error} error`);let r=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${r}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function Ue({root:s,details:e,formVersion:l}){let[n,a]=N("");I(()=>{let i=s.current;if(!i)return;let t=()=>{let u=Array.from(i.querySelectorAll("[data-section-id]")).find(g=>g.style.display!=="none");if(!u){a("");return}let m=u.querySelector("h2, h3, h4");a((m?.textContent??"").trim())};t();let c=window.setInterval(t,400);return()=>window.clearInterval(c)},[s,l]);let r={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected"},o={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return x("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:[p("div",{className:"der-de-live-strip__section",children:n||"Pick a section"}),p("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:e?x(it,{children:[p("span",{className:"der-de-live-strip__de",children:e.deName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__coc",children:e.cocName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__value",children:e.value||p("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:`der-de-live-strip__state der-de-live-strip__state--${o[e.saveState]}`,children:r[e.saveState]}),e.compulsory&&p("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):p("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})]})}function Ve({open:s,issues:e,onClose:l,onPick:n}){return I(()=>{if(!s)return;let a=r=>{r.key==="Escape"&&l()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[s,l]),!s||e.length===0?null:x("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[x("header",{className:"der-de-issues-drawer__head",children:[x("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(a=>p("li",{children:x("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>n(a),children:[p("span",{className:"der-de-issues-drawer__de",children:a.deName}),p("span",{className:"der-de-issues-drawer__coc",children:a.cocName}),x("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:a.value}),p("span",{children:a.problem})]})]})},`${a.deId}-${a.cocId}`))})]})}function Be({open:s,onClose:e}){return I(()=>{if(!s)return;let n=a=>{a.key==="Escape"&&e()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[s,e]),s?p("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:n=>{n.target===n.currentTarget&&e()},children:x("div",{className:"der-de-shortcuts",children:[x("header",{className:"der-de-shortcuts__head",children:[p("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),p("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),p("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([n,a])=>x("div",{className:"der-de-shortcuts__row",children:[p("dt",{children:p("kbd",{children:n})}),p("dd",{children:a})]},n))})]})}):null}function Qe(s,e){s.addEventListener("paste",l=>{let n=l.target;if(!n||n.tagName!=="INPUT")return;let a=n.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(a))return;let o=l.clipboardData?.getData("text/plain")??"",i=/\r?\n/.test(o),t=/\t/.test(o);if(!i&&!t)return;let c=o.split(/\r?\n/).filter((v,C,T)=>!(C===T.length-1&&v==="")).map(v=>v.split("	").map(C=>C.trim()));if(c.length===0)return;l.preventDefault();let d=n.closest("[data-section-id]")??s,m=Array.from(d.querySelectorAll("tbody tr")).map(v=>Array.from(v.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let v=0;v<m.length;v++){let C=m[v].indexOf(n);if(C!==-1){g=v,f=C;break}}if(g===-1)return;let h=0,_=0;for(let v=0;v<c.length;v++){let C=c[v],T=m[g+v];if(!T){_+=C.length;continue}for(let O=0;O<C.length;O++){let R=T[f+O];if(!R){_++;continue}R.value=C[O]??"",R.dispatchEvent(new Event("input",{bubbles:!0})),R.dispatchEvent(new Event("blur",{bubbles:!0})),h++}}let w=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${h} value${h===1?"":"s"} (${w}${_>0?`, ${_} overflow`:""}).`})},!0)}function Je(s,e){let l=e.indicators??[];if(l.length===0)return;let n=l.filter(d=>d.numerator&&d.denominator).map(d=>({id:d.id,factor:d.indicatorType?.factor??1,numExpr:d.numerator,denExpr:d.denominator}));if(n.length===0)return;let a=Array.from(s.querySelectorAll("input[indicatorid]")),r=new Map;for(let d of Array.from(s.querySelectorAll('input[name$="-val"]')))r.set(d.getAttribute("name")??"",d);let o=d=>{let u=0;for(let[m,g]of r){if(!m.startsWith(`${d}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},i=d=>d.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,m,g)=>{if(g){let f=r.get(`${m}-${g}-val`),h=parseFloat(f?.value??"");return Number.isFinite(h)?String(h):"0"}return String(o(m))}),t=d=>{if(!/^[\s\d+\-*/().eE]+$/.test(d))return NaN;try{return Function(`"use strict";return (${d})`)()}catch{return NaN}},c=()=>{for(let d of n){let u=t(i(d.numExpr)),m=t(i(d.denExpr)),g=a.find(h=>h.getAttribute("indicatorid")===d.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(m)||m===0){g.value="";continue}let f=u/m*d.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};s.addEventListener("input",d=>{let u=d.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function We(s,e){let l={};for(let n of e.dataSetElements??[])n.dataElement&&(l[n.dataElement.id]=n.dataElement);for(let n of Array.from(s.querySelectorAll('input[name$="-val"]'))){let a=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!a)continue;let r=l[a[1]],o=r?.formName??r?.name??a[1],i=r?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===a[2]),t=i?.name??i?.displayName??a[2];n.hasAttribute("aria-label")||n.setAttribute("aria-label",t===a[2]?`${o}`:`${o}, ${t}`),n.getAttribute("data-compulsory")==="1"&&n.setAttribute("aria-required","true")}}function Ge(s,e){let l=e.compulsoryDataElementOperands??[],n=new Set;for(let a of l){let r=a.dimensionItem;if(!r)continue;let o=r.split(".");o.length===2&&n.add(`${o[0]}:${o[1]}`)}if(n.size!==0)for(let a of Array.from(s.querySelectorAll('input[name$="-val"]'))){let r=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");r&&n.has(`${r[1]}:${r[2]}`)&&a.setAttribute("data-compulsory","1")}}function Ye(s,e,l){let n={};for(let r of e.dataSetElements??[])r.dataElement&&(n[r.dataElement.id]=r.dataElement);let a=r=>{let o=r.getAttribute("name")??r.id??"",i=/^(.+)-(.+)-val$/.exec(o);if(!i)return null;let t=i[1],c=i[2],d=n[t],u=d?.categoryCombo,m=u?.categoryOptionCombos?.find(C=>C.id===c),g=[],f=m?.name??m?.displayName??c,h=f.split(/,\s*/).filter(Boolean),_=u?.categories??[];h.forEach((C,T)=>{g.push({category:_[T]?.name??_[T]?.displayName??"",option:C})});let w=r.style.outline||"",v=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":r.value.trim()===""?"empty":"saved";return{deId:t,cocId:c,deName:d?.name??t,deFormName:d?.formName,valueType:d?.valueType??"TEXT",optionSetId:d?.optionSet?.id,cocName:f,categoryBreakdown:g,value:r.value,saveState:v,inputName:o,compulsory:r.getAttribute("data-compulsory")==="1"}};s.addEventListener("focusin",r=>{let o=r.target;if(o&&o.tagName==="INPUT"){let i=a(o);i&&l(i)}},!0),s.addEventListener("input",r=>{let o=r.target;if(o&&o.tagName==="INPUT"){let i=a(o);i&&l(i)}},!0)}function Ke(s,e,l){if(!s)return;let n=globalThis,a=n.dhis2?.de?.dataElements??{},r=n.dhis2?.de?.categoryOptionCombos??{},o=Array.from(s.querySelectorAll('input[name$="-val"]')),i=[];for(let t of o){t.style.outline="";let c=/^(.+)-(.+)-val$/.exec(t.getAttribute("name")??"");if(!c)continue;let d=c[1],u=c[2],m=a[d],g=m?.valueType??"TEXT",f=t.value.trim();if(f===""){t.getAttribute("data-compulsory")==="1"&&(t.style.outline="2px solid #c0392b",i.push({deId:d,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:m?.name??d,cocName:r[u]?.name??u,inputName:t.name}));continue}let h=Xe(f,g);h&&(t.style.outline="2px solid #c0392b",i.push({deId:d,cocId:u,valueType:g,value:f,problem:h,deName:m?.name??d,cocName:r[u]?.name??u,inputName:t.name}))}l(i),i.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${i.length} issue${i.length===1?"":"s"}. See the Issues panel.`})}function Xe(s,e){let l=Number(s),n=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!n)return"must be an integer";break;case"INTEGER_POSITIVE":if(!n||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!n||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!n||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(s.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(s.toLowerCase()))return"must be yes";break;case"URL":try{new URL(s)}catch{return"must be a valid URL"}break;default:break}return null}function ee(s,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";s.style.outline=`2px solid ${l}`,s.style.transition="outline 150ms",e==="queued"?s.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):s.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{s.style.outline.includes("#1a8754")&&(s.style.outline="1px solid #b7dcc7")},1200)}async function Ze(s,e,l,n,a){if(!e||!l||!n)return;let r;try{r=(await a.readAggregateValues(n,l,2e3)).dataValues??[]}catch{return}for(let o of r){let i=o.dataElement,t=o.categoryOptionCombo,c=o.value;if(!i||!t||c==null)continue;let d=s.querySelector(`input[name="${i}-${t}-val"]`);d&&(d.value=c)}}function pe(s){return new Promise((e,l)=>{let n=document.createElement("script");n.src=s,n.async=!1,n.setAttribute("data-der-custom-form",s),n.onload=()=>e(),n.onerror=()=>l(new Error(`failed to load ${s}`)),document.head.appendChild(n)})}function ge(s){if(document.querySelector(`link[data-der-custom-form="${s}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=s,e.setAttribute("data-der-custom-form",s),document.head.appendChild(e)}function le(s){return!s||/^https?:\/\//i.test(s)||s.startsWith("/legacy-custom-forms/")||s.startsWith("/")?s:`/legacy-custom-forms/${s.replace(/^(?:\.{1,2}\/)+/,"")}`}async function et(s,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let r=a.getAttribute("href")??"";r&&ge(le(r))}else{let r=document.createElement("style");r.textContent=a.textContent??"",r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r)}a.remove()}let n=[];for(let a of Array.from(l.querySelectorAll("script"))){let r=a.getAttribute("src");r?n.push({src:le(r)}):n.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(l.body.querySelectorAll("*"))){if(a.removeAttribute("style"),a.tagName==="INPUT"){let r=a.getAttribute("id")??"";r.endsWith("-val")&&a.getAttribute("name")!==r&&a.setAttribute("name",r)}if(a.tagName==="TH"){let r=(a.textContent??"").trim();(r==="Reporting item"||r==="Reported count")&&(a.textContent=r==="Reporting item"?"Data elements":"Value")}}for(let a of Array.from(l.body.childNodes))s.appendChild(document.adoptNode(a));for(let a of n)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await pe(a.src);else if(a.code){let r=document.createElement("script");r.textContent=a.code,r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r),r.remove()}}var te={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},ce={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ue={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},tt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},rt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function at(s,e,l){let n={...te},a=nt(s);if(a.length===0)return p("input",{value:e,onChange:m=>l(m.target.value),placeholder:s?`DHIS2 ${s} period id`:"e.g. 202611",style:n});let r=[...a];if(e&&!r.some(m=>m.id===e)){let m=ot(s,e)??e;r.unshift({id:e,label:m})}let o=a[0]?.id??null,i=r.findIndex(m=>m.id===e),t=i===-1||i<r.length-1||!!s,c=e!==""&&(i>0||e!==o),d=()=>{if(!s)return;let m=i>=0&&i<r.length-1?r[i+1]?.id??"":me(s,e||o||"",-1);m&&l(m)},u=()=>{if(!s||!e||e===o)return;let m=i>0?r[i-1]?.id??"":me(s,e,1);m&&l(m)};return x("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:d,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),x("select",{value:e,onChange:m=>l(m.target.value),style:n,children:[p("option",{value:"",children:"Select a period\u2026"}),r.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function me(s,e,l){let n=a=>String(a).padStart(2,"0");switch(s){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,o=Number(e.slice(6,8)),i=new Date(a,r,o+l);return`${i.getFullYear()}${n(i.getMonth()+1)}${n(i.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let r=Number(a[1]),o=Number(a[2])+l;return o<1?(r-=1,o=re(r)):o>re(r)&&(r+=1,o=1),`${r}W${o}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,o=a*12+r+l;return`${Math.floor(o/12)}${n((o%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let r=Number(a[1]),o=Number(a[2])+l;return o<1?(r-=1,o=6):o>6&&(r+=1,o=1),`${r}${n(o)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let r=Number(a[1]),o=Number(a[2])+l;return o<1?(r-=1,o=4):o>4&&(r+=1,o=1),`${r}Q${o}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let r=Number(a[1]),o=Number(a[2])+l;return o<1?(r-=1,o=2):o>2&&(r+=1,o=1),`${r}S${o}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function ot(s,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);return n?`${n[1]} W${String(n[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let n=Number(e.slice(4,6))-1;return`${l[n]??""} ${e.slice(0,4)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return null;let a=(Number(n[2])-1)*2;return`${l[a]}\u2013${l[a+1]} ${n[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);return n?`${n[1]} ${n[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function nt(s){let e=new Date,l=e.getFullYear(),n=e.getMonth(),a=o=>String(o).padStart(2,"0"),r=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":{let o=[];for(let i=0;i<30;i++){let t=new Date(e);t.setDate(t.getDate()-i);let c=`${t.getFullYear()}${a(t.getMonth()+1)}${a(t.getDate())}`,d=`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`;o.push({id:c,label:d})}return o}case"Weekly":{let o=[],i=fe(e),t=i.year,c=i.week;for(let d=0;d<12;d++)o.push({id:`${t}W${c}`,label:`${t} W${a(c)}`}),c-=1,c<1&&(t-=1,c=re(t));return o}case"Monthly":{let o=[];for(let i=0;i<24;i++){let t=l,c=n,d=t*12+c-i,u=Math.floor(d/12),m=(d%12+12)%12;o.push({id:`${u}${a(m+1)}`,label:`${r[m]} ${u}`})}return o}case"BiMonthly":{let o=[],i=Math.floor(n/2)+1,t=l,c=i;for(let d=0;d<12;d++){let u=(c-1)*2;o.push({id:`${t}${a(c)}B`,label:`${r[u]}\u2013${r[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return o}case"Quarterly":{let o=[],i=Math.floor(n/3)+1,t=l,c=i;for(let d=0;d<8;d++)o.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return o}case"SixMonthly":{let o=[],i=n<6?1:2,t=l,c=i;for(let d=0;d<6;d++)o.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return o}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let o=[];for(let i=0;i<10;i++){let t=l-i;o.push({id:String(t),label:String(t)})}return o}default:return[]}}function fe(s){let e=new Date(s.getFullYear(),s.getMonth(),s.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let n=new Date(e.getFullYear(),0,1),r=Math.round((e.getTime()-n.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((r+1)/7)}}function re(s){return fe(new Date(s,11,28)).week}var st=`
/* Flat-UI reset \u2014 the data-entry app renders inside the AppHost
 * wrapper and matches the admin-ui's zero-radius / solid-ink
 * table language. Any radius we still want on an individual
 * element must re-declare it explicitly after this rule. */
.der-apphost .der-de-toolbar *,
.der-apphost .der-de-actionbar *,
.der-apphost .der-de-form-card *,
.der-apphost .der-de-section-nav *,
.der-apphost .der-de-details-drawer,
.der-apphost .der-de-details-drawer * {
  border-radius: 0 !important;
}

/* Section tables \u2014 adopt the admin-ui ea-table look: collapsed
 * borders, uppercase 13 px sticky thead with a 2 px underline,
 * no cell borders, subtle hover tint. */
.der-apphost .der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  table-layout: auto;
  font-size: 13px;
  margin: 0;
}
.der-apphost .der-de-form-card .sectionTable th,
.der-apphost .der-de-form-card .sectionTable td {
  padding: 6px 8px;
  border: 0 !important;
  text-align: left;
  vertical-align: middle;
  background: transparent !important;
}
.der-apphost .der-de-form-card .sectionTable thead th {
  background: #fafbfd !important;
  color: var(--der-ink-700, #2a3447);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  border-bottom: 1px solid var(--der-border, #d8dee8) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #fafbfd !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
/* Top-row live strip \u2014 replaces the right-rail Cell Details
 * drawer. Left shows the active section heading; right shows
 * DE \xB7 COC \xB7 Value \xB7 Save state for the focused cell, updating
 * as the operator tabs between cells. */
.der-de-live-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--der-border, #d8dee8);
  font-size: 13px;
  color: var(--der-ink-700, #2a3447);
}
.der-de-live-strip__section {
  font-weight: 500;
  color: var(--der-ink-900, #101a32);
  flex: 0 0 auto;
}
.der-de-live-strip__cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--der-ink-700, #2a3447);
  font-size: 12px;
}
.der-de-live-strip__de {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-de-live-strip__coc {
  color: var(--der-ink-500, #5b6478);
}
.der-de-live-strip__value {
  color: var(--der-ink-900, #101a32);
  font-family: ui-monospace, monospace;
}
.der-de-live-strip__empty {
  color: var(--der-ink-300, #9097a8);
  font-style: normal;
}
.der-de-live-strip__sep {
  color: var(--der-ink-300, #9097a8);
}
.der-de-live-strip__state--muted  { color: #5b6478; }
.der-de-live-strip__state--saved  { color: #1b8243; }
.der-de-live-strip__state--saving { color: #9b5a00; }
.der-de-live-strip__state--queued { color: #9b5a00; }
.der-de-live-strip__state--error  { color: #c0392b; }
.der-de-live-strip__required {
  color: #9b5a00;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.der-de-live-strip__hint {
  color: var(--der-ink-500, #5b6478);
  font-style: italic;
}
.der-apphost .der-de-form-card .sectionTable .dataElementCell {
  background: #f7f8fc !important;
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
  min-width: 220px;
}
.der-apphost .der-de-form-card .sectionTable tbody tr {
  border-bottom: 1px solid rgba(216, 222, 232, 0.6) !important;
}
.der-apphost .der-de-form-card .sectionTable tbody tr:hover td,
.der-apphost .der-de-form-card .sectionTable tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
/* Blocked / not-applicable cells \u2014 DHIS2 greyedFields. Soft
 * neutral background + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f5,
    #eef0f5 6px,
    #e5e9ef 6px,
    #e5e9ef 7px
  ) !important;
  color: #9097a8 !important;
  text-align: center;
}
/* Indicator rows \u2014 computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f4f6fa !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid var(--der-border, #d8dee8) !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 13px;
  color: var(--der-ink-900, #101a32);
}
.der-apphost .der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce) !important;
  box-shadow: 0 0 0 2px rgba(74, 85, 206, 0.18);
}

/* Solid-ink pills \u2014 no pastel tint, just coloured text on
 * transparent background with a thin bottom underline. */
.der-apphost .der-de-toolbar__status,
.der-apphost .der-de-savepill,
.der-apphost .der-de-section-nav__ratio,
.der-apphost .der-de-completion-pill,
.der-apphost .der-de-issues-chip {
  background: transparent !important;
  padding: 0 4px !important;
  border: 0 !important;
}
.der-apphost .der-de-toolbar__status--on    { color: #1b8243 !important; }
.der-apphost .der-de-toolbar__status--off   { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--saved        { color: #1b8243 !important; }
.der-apphost .der-de-savepill--saving       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--queued       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--error        { color: #c0392b !important; }
.der-apphost .der-de-section-nav__ratio--muted   { color: #5b6478 !important; }
.der-apphost .der-de-section-nav__ratio--partial { color: #9b5a00 !important; }
.der-apphost .der-de-section-nav__ratio--done    { color: #1b8243 !important; }

/* Single sticky toolbar \u2014 replaces the old title + chip strip. */
.der-de-toolbar {
  position: sticky;
  top: 52px;
  z-index: 5;
  margin: 0 -20px 12px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(140%) blur(6px);
  border-bottom: 1px solid #e5e9ef;
}
.der-de-toolbar__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}
.der-de-toolbar__title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #101a32;
  letter-spacing: -0.01em;
}
.der-de-toolbar__status {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 8px;
  border-radius: 10px;
}
.der-de-toolbar__status--on  { background: #e3f7eb; color: #1b8243; }
.der-de-toolbar__status--off { background: #fef0d8; color: #9b5a00; }
.der-de-toolbar__ou {
  margin-left: auto;
  color: #5b6478;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
.der-de-toolbar__picks {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.der-de-toolbar__field {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
}
.der-de-toolbar__field--period {
  min-width: 260px;
}
.der-de-toolbar__field-label {
  font-size: 11px;
  color: #6e7a8a;
  letter-spacing: 0.04em;
}
.der-de-toolbar__select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d8dee8;
  background: #fff;
  border-radius: 4px;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
}
.der-de-toolbar__select:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 3px rgba(74, 85, 206, 0.15);
}
/* Back-compat kill switch for legacy .der-de-chip classes. */
.der-de-chip, .der-de-chip-signed,
.der-de-chip-label, .der-de-chip-value {
  display: none !important;
}
.der-de-select,
.der-de-period-wrap > * {
  font-size: 13px;
  font-family: inherit;
}
.der-de-select:focus,
.der-de-period-wrap > *:focus {
  outline: none;
  border-color: var(--der-brand-500, #4a55ce);
}
/* Compound prev-[select]-next. No wrapping border; each child
 * carries its own 1 px outline so the three items read as one
 * unit without a second enclosing frame. */
.der-de-period-nav {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  width: 100%;
}
.der-de-period-nav select {
  flex: 1 1 auto;
  padding: 4px 8px;
  border: 1px solid #d8dee8;
  background: #fff;
  color: #101a32;
  border-radius: 4px;
}
.der-de-period-btn {
  background: transparent;
  border: 0;
  color: #4a55ce;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  color: #2c3597;
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
/* Layout envelope \u2014 the AppHost's ScreenCard body is a flex
 * column whose height fills the viewport below the shell topbar
 * + sticky toolbar. The form card grows to fill the remaining
 * space (flex: 1) so a short form still pushes the actionbar to
 * the screen bottom; a long form grows the column naturally and
 * the actionbar follows the content (not the viewport). */
.der-apphost .der-screen-card__body {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--der-topbar-h, 52px));
}
.der-de-form-card {
  padding: 0;
  background: transparent;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
.der-de-form-split {
  flex: 1 1 auto;
}
.der-de-actionbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px -20px 0;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e5e9ef;
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
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
.der-de-section-nav__label {
  flex: 1 1 auto;
}
.der-de-section-nav__ratio {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.der-de-section-nav__ratio--muted   { background: #eef0f5; color: #6e7a8a; }
.der-de-section-nav__ratio--partial { background: #fef0d8; color: #9b5a00; }
.der-de-section-nav__ratio--done    { background: #e3f7eb; color: #1b8243; }
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
  margin: 0 0 8px;
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--der-ink-900, #101a32);
  border: 0;
  letter-spacing: -0.01em;
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
  font-size: 15px;
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
`;export{Ie as default};
