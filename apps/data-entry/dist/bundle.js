/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as se,useState as S}from"react";import{useAuth as Se,useOrgUnitBinding as Te,useOnlineStatus as Ce,useDerApi as Ae,ScreenCard as $e}from"@der/app-sdk";import{Fragment as dt,jsx as p,jsxs as x}from"react/jsx-runtime";function Ie(){let o=Se(),e=Te(),l=Ce(),s=Ae(),[r,a]=S("custom"),[i,d]=S([]),[t,c]=S(""),[n,u]=S(""),[m,g]=S(""),[f,h]=S(""),[_,w]=S({kind:"idle"}),[v,T]=S(null),C=se(null),[R,M]=S({}),z=se({}),[be,V]=S([]),[O,F]=S(null),[Q,ae]=S(!1),[J,ye]=S(0),[U,he]=S([]),[oe,W]=S(!1),[ve,xe]=S(null),[_e,G]=S(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let N=y.target;N&&(N.tagName==="INPUT"||N.tagName==="TEXTAREA")||(y.preventDefault(),G(E=>!E))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[H,we]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",H)}catch{}},[H]),I(()=>{let b=!1;return(async()=>{try{let y=await s.listDataSets();if(b)return;let N=(y.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,D)=>E.label.localeCompare(D.label));d(N)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(t.trim()===""){T(null),V([]),M({}),z.current={};return}let b=!1;return(async()=>{try{let y=await s.getDataSetMeta(t.trim());if(b)return;let N=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";T({hasCustomForm:N,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),a(N?"custom":"structured");try{let E=await s.getDataSetFormMetadata(t.trim());if(b)return;let D=await ie(E,s);if(b)return;let B=(D.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));V(B);let P={};for(let A of B)A.options[0]&&(P[A.id]=A.options[0].id);M(P),z.current=P}catch{}}catch{b||T(null)}})(),()=>{b=!0}},[t]),I(()=>{if(r!=="custom"||!v?.hasCustomForm||v.formType==="CUSTOM"&&!v.formId)return;let b=C.current;if(!b)return;let y=!1;return(async()=>{w({kind:"submitting"});try{let N=await s.getDataSetFormMetadata(t.trim());if(y)return;let E=await ie(N,s);if(y)return;let D="";if(v.formType==="CUSTOM"&&v.formId){try{D=(await s.getDataEntryFormHtml(v.formId)).htmlCode??""}catch(k){D="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",k)}D.trim()||(D=de(E))}else v.formType==="SECTION"&&(D=de(E));if(y)return;let B=await s.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(y)return;let P=(E.categoryCombo?.categories??[]).filter(k=>(k.categoryOptions?.length??0)>1).map(k=>({id:k.id,name:k.name??k.id,options:(k.categoryOptions??[]).map(L=>({id:L.id,name:L.name??L.id}))}));V(P);let A={};for(let k of P)k.options[0]&&(A[k.id]=k.options[0].id);M(A),z.current=A,b.replaceChildren();for(let[k,L]of[["selectedDataSetId",t.trim()],["selectedPeriodId",n.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let j=document.createElement("input");j.type="hidden",j.id=k,j.value=L,b.appendChild(j)}for(let[k,L]of Object.entries(A)){let j=document.createElement("input");j.type="hidden",j.id=`category-${k}`,j.value=L,j.setAttribute("data-der-category",k),b.appendChild(j)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Re({dataSetId:t.trim(),periodId:n.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:A,validationRules:B.validationRules??[]});for(let k of je)ge(k);for(let k of De)document.querySelector(`script[data-der-custom-form="${k}"]`)||await pe(k);Oe(),await tt($,D),await et($,t.trim(),n.trim(),e.orgUnitUid??"",s),He($,()=>t.trim(),()=>n.trim(),()=>e.orgUnitUid??"",()=>({...z.current}),s),qe($),Qe($,w),Je($),Ke($,E,xe),Ye($,E),Ge($,E),We($,E),ye(k=>k+1),w({kind:"idle"})}catch(N){w({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{y=!0}},[r,v,t,n,e.orgUnitUid]);let ke=e.bound&&t.trim()!==""&&n.trim()!==""&&m.trim()!==""&&f.trim()!==""&&_.kind!=="submitting";async function Ee(b){b.preventDefault(),w({kind:"submitting"});try{await s.submitAggregate({dataSet:t,period:n,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:f}]}),w({kind:"ok",message:`Submitted ${m}=${f} for ${n}.`}),g(""),h("")}catch(y){w({kind:"error",message:y.message??"Submission failed"})}}let ne=n.trim()!=="",Y=t.trim()!=="",q=Y&&ne&&e.bound;I(()=>{if(!q){F(null);return}let b=!1;return(async()=>{try{let y=await s.getCompletion(t.trim(),e.orgUnitUid??"",n.trim());if(b)return;F({completed:!!y.completed,completedAt:y.completedAt})}catch{b||F({completed:!1})}})(),()=>{b=!0}},[t,n,e.orgUnitUid,q]);async function Ne(){if(!q||Q)return;let b=!O?.completed;if(b){let y=C.current;if(y){let N=[];for(let E of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&N.push(E);if(N.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${N.length} compulsory value${N.length===1?"":"s"} still missing. Run Validate to jump to them.`}),N[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ae(!0);try{let y=await s.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:n.trim(),completed:b});F({completed:!!y.completed,completedAt:y.completedAt}),w({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){w({kind:"error",message:`Completion failed: ${y.message}`})}finally{ae(!1)}}return x($e,{dataTest:"der-aggregate-entry",children:[p("style",{children:it}),x("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[x("div",{className:"der-de-toolbar__head",children:[p("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:x("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[p("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#eef1ff",stroke:"#4a55ce","stroke-width":"5"}),p("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#4a55ce","stroke-width":"5"}),p("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#4a55ce","stroke-width":"3"}),p("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#4a55ce","stroke-width":"3"}),p("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#4a55ce","stroke-width":"3"})]})}),p("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),p("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),x("span",{className:"der-de-toolbar__ou-wrap",children:[p("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),p("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]})]}),x("div",{className:"der-de-toolbar__picks",children:[x("label",{className:"der-de-toolbar__field",children:[p("span",{className:"der-de-toolbar__field-label",children:"Data set"}),x("select",{className:"der-de-toolbar__select",value:t,onChange:b=>{c(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),i.map(b=>p("option",{value:b.id,children:b.label},b.id))]})]}),be.map(b=>x("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[p("span",{className:"der-de-toolbar__field-label",children:b.name}),x("select",{className:"der-de-toolbar__select",value:R[b.id]??"",onChange:y=>{let N={...R,[b.id]:y.target.value};M(N),z.current=N,Le(C.current,N)},"data-test":"de-aoc-select",children:[p("option",{value:"",children:"Select\u2026"}),b.options.map(y=>p("option",{value:y.id,children:y.name},y.id))]})]},b.id)),x("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[x("span",{className:"der-de-toolbar__field-label",children:["Period",v?.periodType?` \xB7 ${v.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:ot(v?.periodType,n,u)})]}),p("div",{className:"der-de-toolbar__cell-info",children:p(Ue,{root:C,details:ve,formVersion:J})})]})]}),_.kind==="ok"&&p("div",{style:rt,"data-test":"de-ok",children:_.message}),_.kind==="error"&&p("div",{style:at,"data-test":"de-err",children:_.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Y&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Y&&!ne&&x("div",{className:"der-de-placeholder",children:["Pick a period to load the ",v?.formType==="SECTION"?"section":"data entry"," form."]}),q&&r==="structured"&&x("form",{onSubmit:Ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[x("label",{children:["Data element UID",p("input",{value:m,onChange:b=>g(b.target.value),style:te})]}),x("label",{children:["Value",p("input",{value:f,onChange:b=>h(b.target.value),inputMode:"decimal",style:te})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!ke,style:ce,children:_.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),q&&r==="custom"&&p("div",{className:`der-de-form-card der-de-density-${H}`,children:x("div",{className:"der-de-form-split",children:[p(ze,{targetRef:C,formVersion:J}),p("div",{ref:C,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),q&&r==="custom"&&x("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(Fe,{root:C,formVersion:J}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${H==="compact"?"comfortable":"compact"} density`,title:`Density: ${H}. Click to switch.`,onClick:()=>we(b=>b==="compact"?"comfortable":"compact"),children:H==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Xe(C.current,w,b=>{he(b),W(b.length>0)})},style:ue,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!oe&&x("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),p("button",{type:"button",onClick:()=>G(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),p("button",{type:"button",onClick:Ne,disabled:Q,style:O?.completed?ue:ce,"data-test":"de-complete-btn",children:Q?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),p(Ve,{open:_e,onClose:()=>G(!1)}),p(Be,{open:oe,issues:U,onClose:()=>W(!1),onPick:b=>{let y=C.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select())}})]})}var De=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],je=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],K=null,X=null,Z=null;async function ie(o,e){K||(K=e.listAllDataElements().then(d=>new Map(d.map(t=>[t.id,t])))),X||(X=e.listAllCategoryCombos().then(d=>new Map(d.map(t=>[t.id,t])))),Z||(Z=e.listAllCategoryOptionCombos().then(d=>{let t=new Map;for(let c of d){let n=c.categoryCombo?.id;if(!n)continue;let u=t.get(n);u?u.push(c):t.set(n,[c])}return t}));let[l,s,r]=await Promise.all([K,X,Z]),a=d=>{if(!d?.id)return;let t=s.get(d.id),c=r.get(d.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(n=>({id:n.id,name:n.name??n.displayName,categoryOptions:n.categoryOptions??[]})),categories:(t.categories??[]).map(n=>({id:n.id,name:n.name??n.displayName,categoryOptions:(n.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:d},i=d=>{let t=l.get(d.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:d};return{...o,categoryCombo:a(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?i(d.dataElement):void 0})),sections:(o.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(t=>i(t))}))}}function de(o){let e={};for(let d of o.dataSetElements??[])d.dataElement&&(e[d.dataElement.id]=d.dataElement);let l={};for(let d of o.indicators??[])l[d.id]=d;let s=(o.sections??[]).slice().sort((d,t)=>(d.sortOrder??0)-(t.sortOrder??0));if(!s.some(d=>(d.dataElements?.length??0)>0)){let d=(o.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);s=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let a=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),i=[];for(let d of s){let t=new Set;for(let n of d.greyedFields??[])n.dataElement?.id&&n.categoryOptionCombo?.id&&t.add(`${n.dataElement.id}:${n.categoryOptionCombo.id}`);i.push(`<h3 class="formSection">${a(d.name??"")}</h3>`);let c=new Map;for(let n of d.dataElements??[]){let u=e[n.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,g=c.get(m);g||(g={cc:u.categoryCombo,des:[]},c.set(m,g)),g.des.push(u)}for(let n of c.values()){let u=n.cc.categoryOptionCombos??[],m=n.cc.categories??[];i.push('<div class="der-de-table-scroll">'),i.push('<table class="sectionTable" cellspacing="0">');let g=Me(m,u);if(i.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){i.push("<tr>"),f===0&&i.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let h of g[f]??[])i.push(`<th colspan="${h.span}">${a(h.label)}</th>`);i.push("</tr>")}else{i.push("<tr>"),i.push('<th class="dataElementCell">Data elements</th>');for(let f of u)i.push(`<th>${a(f.name??"")}</th>`);i.push("</tr>")}i.push("</thead><tbody>");for(let f of n.des){i.push("<tr>"),i.push(`<td class="dataElementCell" id="${a(f.id)}-cell">`+a(f.formName??f.name??f.id)+"</td>");for(let h of u){let _=`${f.id}-${h.id}-val`;t.has(`${f.id}:${h.id}`)?i.push('<td class="greyed">\u2014</td>'):i.push(`<td><input type="text" id="${a(_)}" name="${a(_)}" dataelementid="${a(f.id)}" optioncomboid="${a(h.id)}"></td>`)}i.push("</tr>")}for(let f of d.indicators??[]){let h=l[f.id];h&&(i.push('<tr class="indicatorRow">'),i.push(`<td class="dataElementCell">${a(h.name??h.id)}</td>`),i.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(h.id)}" readonly></td>`),i.push("</tr>"))}i.push("</tbody></table></div>")}}return i.join(`
`)}function Me(o,e){if(o.length===0||e.length===0)return[];let l=new Map;for(let i of o)for(let d of i.categoryOptions??[])l.set(d.id,{catId:i.id,name:d.name??d.id});let s=o.length,r=e.map(i=>{let d=new Array(s).fill("");for(let t of i.categoryOptions??[]){let c=l.get(t.id);if(!c)continue;let n=o.findIndex(u=>u.id===c.catId);n>=0&&(d[n]=c.name)}return d});for(let i of r)if(i.some(d=>d===""))return[];let a=[];for(let i=0;i<s;i++){let d=[];for(let t=0;t<r.length;){let c=r[t],n=t+1;for(;n<r.length;){let u=r[n],m=!0;for(let g=0;g<=i;g++)if(c[g]!==u[g]){m=!1;break}if(!m)break;n++}d.push({label:c[i]??"",span:n-t}),t=n}a.push(d)}return a}function Re(o){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let s=l.de;s.currentDataSetId=o.dataSetId,s.currentOrganisationUnitId=o.orgUnitId,s.currentPeriodId=o.periodId,s.currentCategorySelections={...o.aocSelections??{}};let r=o.meta??{},a={},i={};if(r.categoryCombo){i[r.categoryCombo.id]=r.categoryCombo;for(let u of r.categoryCombo.categories??[])a[u.id]=u}s.categories=a,s.categoryCombos=i;let d={},t={};for(let u of r.dataSetElements??[]){let m=u.dataElement;m&&(d[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(i[m.categoryCombo.id]=m.categoryCombo))}s.dataElements=d,s.optionSets=t;let c={};for(let u of r.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};s.indicatorFormulas=c;let n={};for(let u of o.validationRules??[])n[u.id]=u;s.validationRules=n,s.lockExceptions=[],s.emptyOrganisationUnits=[],s.significantZeros=[],s.dataSets={[r.id]:{id:r.id,name:r.name??r.displayName??"",periodType:r.periodType,categoryCombo:r.categoryCombo?.id,periodId:o.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Oe(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let e=o.dhis2.period;e.format="yyyy-mm-dd",e.calendar=o.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Le(o,e){if(!o)return;for(let[s,r]of Object.entries(e)){let a=o.querySelector(`input[data-der-category="${s}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${s}`,a.setAttribute("data-der-category",s),o.appendChild(a)),a.value=r}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function He(o,e,l,s,r,a){let i=n=>{let u=/^(.+)-(.+)-val$/.exec(n);return u?{de:u[1],coc:u[2]}:null},d=new WeakMap,t=o.querySelectorAll('input[name$="-val"]');for(let n of Array.from(t))d.set(n,n.value);let c=async n=>{let u=n.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",g=i(m);if(!g)return;let f=e(),h=l(),_=s();if(!f||!h||!_)return;let w=u.value;if(d.get(u)!==w){ee(u,"saving");try{let v=await a.submitAggregate({dataSet:f,period:h,orgUnit:_,attributeOptionComboSelections:r(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:w}]});d.set(u,w),ee(u,v?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ee(u,"error")}}};o.addEventListener("blur",n=>{c(n)},!0)}function qe(o){o.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let s=l.target;if(!(s instanceof HTMLInputElement))return;let r=s.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(r);if(!a)return;l.preventDefault();let i=a[2],d=Array.from(o.querySelectorAll(`input[name$="-${i}-val"]`)),t=d.indexOf(s);if(t===-1)return;let c=d[t+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe(o){let e=Array.from(o.querySelectorAll("h2, h3, h4")).filter(a=>(a.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),s=[],r=(a,i)=>{for(let d of l)if(d!==i&&a.contains(d))return!0;return!1};return e.forEach((a,i)=>{let d=a.id||`der-de-section-${i}`;a.id=d;let t=null,c=a.parentElement,n=null;for(;c&&c!==o&&!r(c,a);)n=c,c=c.parentElement;if(n&&n.children.length>1&&n!==o)t=n,t.classList.add("der-de-section-slot"),t.dataset.sectionId=d;else{t=document.createElement("div"),t.className="der-de-section-slot",t.dataset.sectionId=d;let u=e[i+1]??null,m=[],g=a;for(;g&&g!==u;){let f=g.nextSibling;m.push(g),g=f}a.parentNode?.insertBefore(t,a);for(let f of m)t.appendChild(f)}s.push({id:d,label:(a.textContent??"").trim(),slot:t})}),s}function ze({targetRef:o,formVersion:e}){let[l,s]=S([]),[r,a]=S(""),[i,d]=S({});return I(()=>{let t=o.current;if(!t)return;let c=Pe(t);s(c),a(c[0]?.id??"")},[o,e]),I(()=>{if(l.length===0)return;let t=()=>{let u={};for(let m of l){let g=Array.from(m.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(h=>h.value.trim()!=="").length;u[m.id]={filled:f,total:g.length}}d(u)};t();let c=o.current;if(!c)return;let n=u=>{let m=u.target;m&&m.tagName==="INPUT"&&/-val$/.test(m.getAttribute("name")??"")&&t()};return c.addEventListener("input",n,!0),()=>{c.removeEventListener("input",n,!0)}},[o,l]),I(()=>{if(!o.current||l.length===0)return;for(let n of l)n.slot.style.display=n.id===r?"":"none";let c=l.find(n=>n.id===r);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,l,r]),l.length<2?null:x("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:l.map(t=>{let c=i[t.id],n=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return p("li",{children:x("button",{type:"button",className:"der-de-section-nav__item"+(r===t.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>a(t.id),children:[p("span",{className:"der-de-section-nav__label",children:t.label}),c&&c.total>0&&p("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${n}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:n==="done"?"\u2713":`${c.filled}/${c.total}`})]})},t.id)})})]})}function Fe({root:o,formVersion:e}){let[l,s]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let i=()=>{let t=o.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),n=0,u=0,m=0,g=0,f=0;for(let h of c){h.value.trim()!==""&&n++;let _=h.style.outline||"";_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?u++:_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?g++:_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?m++:(_.includes("rgb(169, 50, 50)")||_.includes("#a93232"))&&f++}s({total:c.length,filled:n,saving:u,saved:m,queued:g,error:f})};i();let d=window.setInterval(i,800);return()=>window.clearInterval(d)},[o,e]),l.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let r=[];r.push(`${l.filled} of ${l.total} filled`),l.saving>0&&r.push(`${l.saving} saving`),l.queued>0&&r.push(`${l.queued} queued`),l.error>0&&r.push(`${l.error} error`);let a=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${a}`,"data-test":"de-save-state",children:r.join(" \xB7 ")})}function Ue({details:o}){let e={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected"},l={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return p("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:p("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:o?x(dt,{children:[p("span",{className:"der-de-live-strip__de",children:o.deName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__coc",children:o.cocName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__value",children:o.value||p("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:`der-de-live-strip__state der-de-live-strip__state--${l[o.saveState]}`,children:e[o.saveState]}),o.compulsory&&p("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):p("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function Be({open:o,issues:e,onClose:l,onPick:s}){return I(()=>{if(!o)return;let r=a=>{a.key==="Escape"&&l()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[o,l]),!o||e.length===0?null:x("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[x("header",{className:"der-de-issues-drawer__head",children:[x("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(r=>p("li",{children:x("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>s(r),children:[p("span",{className:"der-de-issues-drawer__de",children:r.deName}),p("span",{className:"der-de-issues-drawer__coc",children:r.cocName}),x("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:r.value}),p("span",{children:r.problem})]})]})},`${r.deId}-${r.cocId}`))})]})}function Ve({open:o,onClose:e}){return I(()=>{if(!o)return;let s=r=>{r.key==="Escape"&&e()};return window.addEventListener("keydown",s),()=>window.removeEventListener("keydown",s)},[o,e]),o?p("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:s=>{s.target===s.currentTarget&&e()},children:x("div",{className:"der-de-shortcuts",children:[x("header",{className:"der-de-shortcuts__head",children:[p("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),p("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),p("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([s,r])=>x("div",{className:"der-de-shortcuts__row",children:[p("dt",{children:p("kbd",{children:s})}),p("dd",{children:r})]},s))})]})}):null}function Qe(o,e){o.addEventListener("paste",l=>{let s=l.target;if(!s||s.tagName!=="INPUT")return;let r=s.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(r))return;let i=l.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(i),t=/\t/.test(i);if(!d&&!t)return;let c=i.split(/\r?\n/).filter((v,T,C)=>!(T===C.length-1&&v==="")).map(v=>v.split("	").map(T=>T.trim()));if(c.length===0)return;l.preventDefault();let n=s.closest("[data-section-id]")??o,m=Array.from(n.querySelectorAll("tbody tr")).map(v=>Array.from(v.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let v=0;v<m.length;v++){let T=m[v].indexOf(s);if(T!==-1){g=v,f=T;break}}if(g===-1)return;let h=0,_=0;for(let v=0;v<c.length;v++){let T=c[v],C=m[g+v];if(!C){_+=T.length;continue}for(let R=0;R<T.length;R++){let M=C[f+R];if(!M){_++;continue}M.value=T[R]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),h++}}let w=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${h} value${h===1?"":"s"} (${w}${_>0?`, ${_} overflow`:""}).`})},!0)}function Je(o){let e=Array.from(o.querySelectorAll('input[name="total"][dataelementid]'));if(e.length===0)return;let l=[];for(let s of e){let r=s.getAttribute("dataelementid")??"";if(!r)continue;let a=s.closest("div"),d=(()=>{let n=a??s.parentElement;if(!n)return null;let u=n.previousElementSibling;for(;u;){if(/^(H1|H2|H3|H4)$/.test(u.tagName)||u.tagName==="DIV"&&!u.querySelector("table, input")&&(u.textContent??"").trim().length>0)return u;u=u.previousElementSibling}let m=n.closest("[data-section-id]");if(m){let g=m.querySelector("h2, h3, h4");if(g)return g}return null})();if(!d)continue;a?.remove();let t=document.createElement("span");t.className="der-de-matrix-total",t.setAttribute("data-de",r),d.appendChild(t);let c=()=>{let n=0,u=!1,m=Array.from(o.querySelectorAll(`input[dataelementid="${r}"][name$="-val"],input[name^="${r}-"][name$="-val"]`)),g=new Set;for(let f of m){if(g.has(f))continue;g.add(f);let h=parseFloat(f.value);Number.isFinite(h)&&(n+=h,u=!0)}if(u){let f=Number.isInteger(n)?n:Number(n.toFixed(2));t.textContent=` (Total: ${f})`}else t.textContent=""};l.push(c),c()}l.length!==0&&o.addEventListener("input",s=>{let r=s.target;if(!(!r||r.tagName!=="INPUT")&&/-val$/.test(r.getAttribute("name")??""))for(let a of l)a()},!0)}function We(o,e){let l=e.indicators??[];if(l.length===0)return;let s=l.filter(n=>n.numerator&&n.denominator).map(n=>({id:n.id,factor:n.indicatorType?.factor??1,numExpr:n.numerator,denExpr:n.denominator}));if(s.length===0)return;let r=Array.from(o.querySelectorAll("input[indicatorid]")),a=new Map;for(let n of Array.from(o.querySelectorAll('input[name$="-val"]')))a.set(n.getAttribute("name")??"",n);let i=n=>{let u=0;for(let[m,g]of a){if(!m.startsWith(`${n}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},d=n=>n.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,m,g)=>{if(g){let f=a.get(`${m}-${g}-val`),h=parseFloat(f?.value??"");return Number.isFinite(h)?String(h):"0"}return String(i(m))}),t=n=>{if(!/^[\s\d+\-*/().eE]+$/.test(n))return NaN;try{return Function(`"use strict";return (${n})`)()}catch{return NaN}},c=()=>{for(let n of s){let u=t(d(n.numExpr)),m=t(d(n.denExpr)),g=r.find(h=>h.getAttribute("indicatorid")===n.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(m)||m===0){g.value="";continue}let f=u/m*n.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};o.addEventListener("input",n=>{let u=n.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function Ge(o,e){let l={};for(let s of e.dataSetElements??[])s.dataElement&&(l[s.dataElement.id]=s.dataElement);for(let s of Array.from(o.querySelectorAll('input[name$="-val"]'))){let r=/^(.+)-(.+)-val$/.exec(s.getAttribute("name")??"");if(!r)continue;let a=l[r[1]],i=a?.formName??a?.name??r[1],d=a?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===r[2]),t=d?.name??d?.displayName??r[2];s.hasAttribute("aria-label")||s.setAttribute("aria-label",t===r[2]?`${i}`:`${i}, ${t}`),s.getAttribute("data-compulsory")==="1"&&s.setAttribute("aria-required","true")}}function Ye(o,e){let l=e.compulsoryDataElementOperands??[],s=new Set;for(let r of l){let a=r.dimensionItem;if(!a)continue;let i=a.split(".");i.length===2&&s.add(`${i[0]}:${i[1]}`)}if(s.size!==0)for(let r of Array.from(o.querySelectorAll('input[name$="-val"]'))){let a=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");a&&s.has(`${a[1]}:${a[2]}`)&&r.setAttribute("data-compulsory","1")}}function Ke(o,e,l){let s={};for(let a of e.dataSetElements??[])a.dataElement&&(s[a.dataElement.id]=a.dataElement);let r=a=>{let i=a.getAttribute("name")??a.id??"",d=/^(.+)-(.+)-val$/.exec(i);if(!d)return null;let t=d[1],c=d[2],n=s[t],u=n?.categoryCombo,m=u?.categoryOptionCombos?.find(T=>T.id===c),g=[],f=m?.name??m?.displayName??c,h=f.split(/,\s*/).filter(Boolean),_=u?.categories??[];h.forEach((T,C)=>{g.push({category:_[C]?.name??_[C]?.displayName??"",option:T})});let w=a.style.outline||"",v=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":a.value.trim()===""?"empty":"saved";return{deId:t,cocId:c,deName:n?.name??t,deFormName:n?.formName,valueType:n?.valueType??"TEXT",optionSetId:n?.optionSet?.id,cocName:f,categoryBreakdown:g,value:a.value,saveState:v,inputName:i,compulsory:a.getAttribute("data-compulsory")==="1"}};o.addEventListener("focusin",a=>{let i=a.target;if(i&&i.tagName==="INPUT"){let d=r(i);d&&l(d)}},!0),o.addEventListener("input",a=>{let i=a.target;if(i&&i.tagName==="INPUT"){let d=r(i);d&&l(d)}},!0)}function Xe(o,e,l){if(!o)return;let s=globalThis,r=s.dhis2?.de?.dataElements??{},a=s.dhis2?.de?.categoryOptionCombos??{},i=Array.from(o.querySelectorAll('input[name$="-val"]')),d=[];for(let t of i){t.style.outline="";let c=/^(.+)-(.+)-val$/.exec(t.getAttribute("name")??"");if(!c)continue;let n=c[1],u=c[2],m=r[n],g=m?.valueType??"TEXT",f=t.value.trim();if(f===""){t.getAttribute("data-compulsory")==="1"&&(t.style.outline="2px solid #c0392b",d.push({deId:n,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:m?.name??n,cocName:a[u]?.name??u,inputName:t.name}));continue}let h=Ze(f,g);h&&(t.style.outline="2px solid #c0392b",d.push({deId:n,cocId:u,valueType:g,value:f,problem:h,deName:m?.name??n,cocName:a[u]?.name??u,inputName:t.name}))}l(d),d.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${i.length} cells OK.`}):e({kind:"error",message:`Validation found ${d.length} issue${d.length===1?"":"s"}. See the Issues panel.`})}function Ze(o,e){let l=Number(o),s=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!s)return"must be an integer";break;case"INTEGER_POSITIVE":if(!s||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!s||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!s||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function ee(o,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${l}`,o.style.transition="outline 150ms",e==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function et(o,e,l,s,r){if(!e||!l||!s)return;let a;try{a=(await r.readAggregateValues(s,l,2e3)).dataValues??[]}catch{return}for(let i of a){let d=i.dataElement,t=i.categoryOptionCombo,c=i.value;if(!d||!t||c==null)continue;let n=o.querySelector(`input[name="${d}-${t}-val"]`);n&&(n.value=c)}}function pe(o){return new Promise((e,l)=>{let s=document.createElement("script");s.src=o,s.async=!1,s.setAttribute("data-der-custom-form",o),s.onload=()=>e(),s.onerror=()=>l(new Error(`failed to load ${o}`)),document.head.appendChild(s)})}function ge(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=o,e.setAttribute("data-der-custom-form",o),document.head.appendChild(e)}function le(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function tt(o,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let r of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let a=r.getAttribute("href")??"";a&&ge(le(a))}else{let a=document.createElement("style");a.textContent=r.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}r.remove()}let s=[];for(let r of Array.from(l.querySelectorAll("script"))){let a=r.getAttribute("src");a?s.push({src:le(a)}):s.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(l.body.querySelectorAll("*"))){if(r.removeAttribute("style"),r.tagName==="INPUT"){let a=r.getAttribute("id")??"";a.endsWith("-val")&&r.getAttribute("name")!==a&&r.setAttribute("name",a)}if(r.tagName==="TH"){let a=(r.textContent??"").trim();(a==="Reporting item"||a==="Reported count")&&(r.textContent=a==="Reporting item"?"Data elements":"Value")}}for(let r of Array.from(l.body.childNodes))o.appendChild(document.adoptNode(r));for(let r of s)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await pe(r.src);else if(r.code){let a=document.createElement("script");a.textContent=r.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var te={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},ce={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ue={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},rt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},at={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function ot(o,e,l){let s={...te},r=st(o);if(r.length===0)return p("input",{value:e,onChange:m=>l(m.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:s});let a=[...r];if(e&&!a.some(m=>m.id===e)){let m=nt(o,e)??e;a.unshift({id:e,label:m})}let i=r[0]?.id??null,d=a.findIndex(m=>m.id===e),t=d===-1||d<a.length-1||!!o,c=e!==""&&(d>0||e!==i),n=()=>{if(!o)return;let m=d>=0&&d<a.length-1?a[d+1]?.id??"":me(o,e||i||"",-1);m&&l(m)},u=()=>{if(!o||!e||e===i)return;let m=d>0?a[d-1]?.id??"":me(o,e,1);m&&l(m)};return x("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:n,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),x("select",{value:e,onChange:m=>l(m.target.value),style:s,children:[p("option",{value:"",children:"Select a period\u2026"}),a.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function me(o,e,l){let s=r=>String(r).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,i=Number(e.slice(6,8)),d=new Date(r,a,i+l);return`${d.getFullYear()}${s(d.getMonth()+1)}${s(d.getDate())}`}case"Weekly":{let r=/^(\d{4})W(\d{1,2})$/.exec(e);if(!r)return"";let a=Number(r[1]),i=Number(r[2])+l;return i<1?(a-=1,i=re(a)):i>re(a)&&(a+=1,i=1),`${a}W${i}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,i=r*12+a+l;return`${Math.floor(i/12)}${s((i%12+12)%12+1)}`}case"BiMonthly":{let r=/^(\d{4})(\d{2})B$/.exec(e);if(!r)return"";let a=Number(r[1]),i=Number(r[2])+l;return i<1?(a-=1,i=6):i>6&&(a+=1,i=1),`${a}${s(i)}B`}case"Quarterly":{let r=/^(\d{4})Q(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),i=Number(r[2])+l;return i<1?(a-=1,i=4):i>4&&(a+=1,i=1),`${a}Q${i}`}case"SixMonthly":{let r=/^(\d{4})S(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),i=Number(r[2])+l;return i<1?(a-=1,i=2):i>2&&(a+=1,i=1),`${a}S${i}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function nt(o,e){let l=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(e);return s?`${s[1]} W${String(s[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let s=Number(e.slice(4,6))-1;return`${l[s]??""} ${e.slice(0,4)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(e);if(!s)return null;let r=(Number(s[2])-1)*2;return`${l[r]}\u2013${l[r+1]} ${s[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(e);return s?`${s[1]} ${s[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function st(o){let e=new Date,l=e.getFullYear(),s=e.getMonth(),r=i=>String(i).padStart(2,"0"),a=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":{let i=[];for(let d=0;d<30;d++){let t=new Date(e);t.setDate(t.getDate()-d);let c=`${t.getFullYear()}${r(t.getMonth()+1)}${r(t.getDate())}`,n=`${t.getFullYear()}-${r(t.getMonth()+1)}-${r(t.getDate())}`;i.push({id:c,label:n})}return i}case"Weekly":{let i=[],d=fe(e),t=d.year,c=d.week;for(let n=0;n<12;n++)i.push({id:`${t}W${c}`,label:`${t} W${r(c)}`}),c-=1,c<1&&(t-=1,c=re(t));return i}case"Monthly":{let i=[];for(let d=0;d<24;d++){let t=l,c=s,n=t*12+c-d,u=Math.floor(n/12),m=(n%12+12)%12;i.push({id:`${u}${r(m+1)}`,label:`${a[m]} ${u}`})}return i}case"BiMonthly":{let i=[],d=Math.floor(s/2)+1,t=l,c=d;for(let n=0;n<12;n++){let u=(c-1)*2;i.push({id:`${t}${r(c)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return i}case"Quarterly":{let i=[],d=Math.floor(s/3)+1,t=l,c=d;for(let n=0;n<8;n++)i.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return i}case"SixMonthly":{let i=[],d=s<6?1:2,t=l,c=d;for(let n=0;n<6;n++)i.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return i}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let i=[];for(let d=0;d<10;d++){let t=l-d;i.push({id:String(t),label:String(t)})}return i}default:return[]}}function fe(o){let e=new Date(o.getFullYear(),o.getMonth(),o.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let s=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-s.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function re(o){return fe(new Date(o,11,28)).week}var it=`
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
  background: transparent !important;
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-border, #d8dee8) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #fafbfd !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
/* Matrix title total badge \u2014 "(Total: 19)" appended to the
 * title of each disaggregated matrix. Updates live from input
 * events on inputs sharing the same dataelementid. */
.der-de-matrix-total {
  margin-left: 6px;
  font-weight: 400;
  color: var(--der-ink-500, #5b6478);
  font-size: 0.92em;
}

/* Inline live strip \u2014 mounted on the right of the picks row
 * (Dataset \xB7 AOC \xB7 Period). No row of its own; shares the
 * baseline of the selects. */
.der-de-toolbar__cell-info {
  margin-left: auto;
  align-self: flex-end;
  padding-bottom: 4px;
  max-width: 560px;
  overflow: hidden;
}
.der-de-live-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--der-ink-700, #2a3447);
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
  background: transparent !important;
  color: var(--der-ink-900, #101a32);
  font-weight: 400;
  min-width: 220px;
  padding: 4px 8px !important;
}
.der-apphost .der-de-form-card .sectionTable tbody tr {
  border: 0 !important;
  min-height: 32px;
}
.der-apphost .der-de-form-card .sectionTable tbody tr:hover td,
.der-apphost .der-de-form-card .sectionTable tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
.der-apphost .der-de-form-card .sectionTable tbody td {
  padding: 3px 8px !important;
  color: var(--der-ink-900, #101a32) !important;
  line-height: 1.35;
  font-size: 13px;
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

/* Single sticky toolbar \u2014 replaces the old title + chip strip.
 * SOLID background so scrolling long forms doesn't show the
 * grid through the header. */
.der-de-toolbar {
  position: sticky;
  top: 52px;
  z-index: 5;
  margin: 0 -20px 12px;
  padding: 10px 20px 10px;
  background: #ffffff;
  border-bottom: 1px solid #e5e9ef;
  box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
}
.der-de-toolbar__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.der-de-toolbar__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #eef1ff;
  flex: 0 0 auto;
}
.der-de-toolbar__title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: #101a32;
  letter-spacing: -0.01em;
}
.der-de-toolbar__status {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0;
  background: transparent;
}
.der-de-toolbar__status::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  vertical-align: 1px;
  background: currentColor;
}
.der-de-toolbar__status--on  { color: #1b8243; }
.der-de-toolbar__status--off { color: #9b5a00; }
.der-de-toolbar__ou-wrap {
  margin-left: auto;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  max-width: 360px;
}
.der-de-toolbar__ou-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9097a8;
}
.der-de-toolbar__ou {
  color: #101a32;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.der-de-toolbar__select,
.der-apphost .der-de-period-nav select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  border-radius: 0;
  background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='%235b6478' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>")
    no-repeat right 8px center;
  background-size: 10px 6px;
  box-shadow: none;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__select:hover,
.der-apphost .der-de-period-nav select:hover {
  border-color: #9aa3b8;
}
.der-de-toolbar__select:focus,
.der-apphost .der-de-period-nav select:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 1px var(--der-brand-500, #4a55ce);
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
    gap: 15px;
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
/* Author-authored decorations shipped inside CUSTOM
 * dataEntryForm.htmlCode (TBLP + legacy DHIS2 custom forms).
 * These duplicate signal the DER data-entry chrome already
 * surfaces \u2014 dataset title (toolbar), section nav numbering,
 * section headers \u2014 and introduce visual styles that fight the
 * shared DER UI. Hide everything but the semantic structure
 * (sections + tables + inputs) so operators see one consistent
 * language regardless of who authored the form. */
.der-de-custom-form .tblep-kicker,
.der-de-custom-form .tblep-num,
.der-de-custom-form .tblep-h1,
.der-de-custom-form .tblep-lead,
.der-de-custom-form .tblep-note,
.der-de-custom-form .tblep-muted,
.der-de-custom-form .tblep-head,
.der-de-custom-form .tblep-foot {
  display: none !important;
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
  border: 0 !important;
  text-align: left !important;
  vertical-align: middle;
  background: transparent !important;
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid #d8dee8 !important;
  color: #5b6478 !important;
  font-weight: 500;
}
.der-de-custom-form .tblep-table tbody tr {
  border: 0 !important;
}
.der-de-custom-form .tblep-table tbody tr:hover td,
.der-de-custom-form .tblep-table tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
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
