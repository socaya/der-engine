/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as se,useState as N}from"react";import{useAuth as Se,useOrgUnitBinding as Te,useOnlineStatus as Ce,useDerApi as Ae,ScreenCard as $e}from"@der/app-sdk";import{Fragment as dt,jsx as p,jsxs as x}from"react/jsx-runtime";function Ie(){let i=Se(),e=Te(),l=Ce(),o=Ae(),[r,a]=N("custom"),[n,d]=N([]),[t,c]=N(""),[s,u]=N(""),[m,g]=N(""),[f,h]=N(""),[_,w]=N({kind:"idle"}),[v,T]=N(null),C=se(null),[R,M]=N({}),z=se({}),[be,B]=N([]),[O,F]=N(null),[Q,ae]=N(!1),[J,ye]=N(0),[U,he]=N([]),[oe,W]=N(!1),[ve,xe]=N(null),[_e,G]=N(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let S=y.target;S&&(S.tagName==="INPUT"||S.tagName==="TEXTAREA")||(y.preventDefault(),G(E=>!E))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[H,we]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",H)}catch{}},[H]),I(()=>{let b=!1;return(async()=>{try{let y=await o.listDataSets();if(b)return;let S=(y.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,j)=>E.label.localeCompare(j.label));d(S)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(t.trim()===""){T(null),B([]),M({}),z.current={};return}let b=!1;return(async()=>{try{let y=await o.getDataSetMeta(t.trim());if(b)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";T({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),a(S?"custom":"structured");try{let E=await o.getDataSetFormMetadata(t.trim());if(b)return;let j=await ie(E,o);if(b)return;let V=(j.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));B(V);let P={};for(let A of V)A.options[0]&&(P[A.id]=A.options[0].id);M(P),z.current=P}catch{}}catch{b||T(null)}})(),()=>{b=!0}},[t]),I(()=>{if(r!=="custom"||!v?.hasCustomForm||v.formType==="CUSTOM"&&!v.formId)return;let b=C.current;if(!b)return;let y=!1;return(async()=>{w({kind:"submitting"});try{let S=await o.getDataSetFormMetadata(t.trim());if(y)return;let E=await ie(S,o);if(y)return;let j="";if(v.formType==="CUSTOM"&&v.formId){try{j=(await o.getDataEntryFormHtml(v.formId)).htmlCode??""}catch(k){j="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",k)}j.trim()||(j=de(E))}else v.formType==="SECTION"&&(j=de(E));if(y)return;let V=await o.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(y)return;let P=(E.categoryCombo?.categories??[]).filter(k=>(k.categoryOptions?.length??0)>1).map(k=>({id:k.id,name:k.name??k.id,options:(k.categoryOptions??[]).map(L=>({id:L.id,name:L.name??L.id}))}));B(P);let A={};for(let k of P)k.options[0]&&(A[k.id]=k.options[0].id);M(A),z.current=A,b.replaceChildren();for(let[k,L]of[["selectedDataSetId",t.trim()],["selectedPeriodId",s.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let D=document.createElement("input");D.type="hidden",D.id=k,D.value=L,b.appendChild(D)}for(let[k,L]of Object.entries(A)){let D=document.createElement("input");D.type="hidden",D.id=`category-${k}`,D.value=L,D.setAttribute("data-der-category",k),b.appendChild(D)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Re({dataSetId:t.trim(),periodId:s.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:A,validationRules:V.validationRules??[]});for(let k of De)ge(k);for(let k of je)document.querySelector(`script[data-der-custom-form="${k}"]`)||await pe(k);Oe(),await tt($,j),await et($,t.trim(),s.trim(),e.orgUnitUid??"",o),He($,()=>t.trim(),()=>s.trim(),()=>e.orgUnitUid??"",()=>({...z.current}),o),qe($),Qe($,w),Je($),Ke($,E,xe),Ye($,E),Ge($,E),We($,E),ye(k=>k+1),w({kind:"idle"})}catch(S){w({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[r,v,t,s,e.orgUnitUid]);let ke=e.bound&&t.trim()!==""&&s.trim()!==""&&m.trim()!==""&&f.trim()!==""&&_.kind!=="submitting";async function Ee(b){b.preventDefault(),w({kind:"submitting"});try{await o.submitAggregate({dataSet:t,period:s,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:f}]}),w({kind:"ok",message:`Submitted ${m}=${f} for ${s}.`}),g(""),h("")}catch(y){w({kind:"error",message:y.message??"Submission failed"})}}let ne=s.trim()!=="",Y=t.trim()!=="",q=Y&&ne&&e.bound;I(()=>{if(!q){F(null);return}let b=!1;return(async()=>{try{let y=await o.getCompletion(t.trim(),e.orgUnitUid??"",s.trim());if(b)return;F({completed:!!y.completed,completedAt:y.completedAt})}catch{b||F({completed:!1})}})(),()=>{b=!0}},[t,s,e.orgUnitUid,q]);async function Ne(){if(!q||Q)return;let b=!O?.completed;if(b){let y=C.current;if(y){let S=[];for(let E of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&S.push(E);if(S.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${S.length} compulsory value${S.length===1?"":"s"} still missing. Run Validate to jump to them.`}),S[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ae(!0);try{let y=await o.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:s.trim(),completed:b});F({completed:!!y.completed,completedAt:y.completedAt}),w({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){w({kind:"error",message:`Completion failed: ${y.message}`})}finally{ae(!1)}}return x($e,{dataTest:"der-aggregate-entry",children:[p("style",{children:it}),x("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[x("div",{className:"der-de-toolbar__head",children:[p("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),p("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),p("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]}),x("div",{className:"der-de-toolbar__picks",children:[x("label",{className:"der-de-toolbar__field",children:[p("span",{className:"der-de-toolbar__field-label",children:"Data set"}),x("select",{className:"der-de-toolbar__select",value:t,onChange:b=>{c(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),n.map(b=>p("option",{value:b.id,children:b.label},b.id))]})]}),be.map(b=>x("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[p("span",{className:"der-de-toolbar__field-label",children:b.name}),x("select",{className:"der-de-toolbar__select",value:R[b.id]??"",onChange:y=>{let S={...R,[b.id]:y.target.value};M(S),z.current=S,Le(C.current,S)},"data-test":"de-aoc-select",children:[p("option",{value:"",children:"Select\u2026"}),b.options.map(y=>p("option",{value:y.id,children:y.name},y.id))]})]},b.id)),x("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[x("span",{className:"der-de-toolbar__field-label",children:["Period",v?.periodType?` \xB7 ${v.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:ot(v?.periodType,s,u)})]})]})]}),_.kind==="ok"&&p("div",{style:rt,"data-test":"de-ok",children:_.message}),_.kind==="error"&&p("div",{style:at,"data-test":"de-err",children:_.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Y&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Y&&!ne&&x("div",{className:"der-de-placeholder",children:["Pick a period to load the ",v?.formType==="SECTION"?"section":"data entry"," form."]}),q&&r==="structured"&&x("form",{onSubmit:Ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[x("label",{children:["Data element UID",p("input",{value:m,onChange:b=>g(b.target.value),style:te})]}),x("label",{children:["Value",p("input",{value:f,onChange:b=>h(b.target.value),inputMode:"decimal",style:te})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!ke,style:ce,children:_.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),q&&r==="custom"&&x("div",{className:`der-de-form-card der-de-density-${H}`,children:[p(Ue,{root:C,details:ve,formVersion:J}),x("div",{className:"der-de-form-split",children:[p(ze,{targetRef:C,formVersion:J}),p("div",{ref:C,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]}),q&&r==="custom"&&x("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[p(Fe,{root:C,formVersion:J}),p("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${H==="compact"?"comfortable":"compact"} density`,title:`Density: ${H}. Click to switch.`,onClick:()=>we(b=>b==="compact"?"comfortable":"compact"),children:H==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>{Xe(C.current,w,b=>{he(b),W(b.length>0)})},style:ue,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!oe&&x("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),p("button",{type:"button",onClick:()=>G(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),p("button",{type:"button",onClick:Ne,disabled:Q,style:O?.completed?ue:ce,"data-test":"de-complete-btn",children:Q?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),p(Be,{open:_e,onClose:()=>G(!1)}),p(Ve,{open:oe,issues:U,onClose:()=>W(!1),onPick:b=>{let y=C.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select())}})]})}var je=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],De=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],K=null,X=null,Z=null;async function ie(i,e){K||(K=e.listAllDataElements().then(d=>new Map(d.map(t=>[t.id,t])))),X||(X=e.listAllCategoryCombos().then(d=>new Map(d.map(t=>[t.id,t])))),Z||(Z=e.listAllCategoryOptionCombos().then(d=>{let t=new Map;for(let c of d){let s=c.categoryCombo?.id;if(!s)continue;let u=t.get(s);u?u.push(c):t.set(s,[c])}return t}));let[l,o,r]=await Promise.all([K,X,Z]),a=d=>{if(!d?.id)return;let t=o.get(d.id),c=r.get(d.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:c.map(s=>({id:s.id,name:s.name??s.displayName,categoryOptions:s.categoryOptions??[]})),categories:(t.categories??[]).map(s=>({id:s.id,name:s.name??s.displayName,categoryOptions:(s.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:d},n=d=>{let t=l.get(d.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:a(t.categoryCombo)}:d};return{...i,categoryCombo:a(i.categoryCombo)??i.categoryCombo,dataSetElements:(i.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?n(d.dataElement):void 0})),sections:(i.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(t=>n(t))}))}}function de(i){let e={};for(let d of i.dataSetElements??[])d.dataElement&&(e[d.dataElement.id]=d.dataElement);let l={};for(let d of i.indicators??[])l[d.id]=d;let o=(i.sections??[]).slice().sort((d,t)=>(d.sortOrder??0)-(t.sortOrder??0));if(!o.some(d=>(d.dataElements?.length??0)>0)){let d=(i.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);o=[{id:i.id,name:i.displayName??i.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let a=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let d of o){let t=new Set;for(let s of d.greyedFields??[])s.dataElement?.id&&s.categoryOptionCombo?.id&&t.add(`${s.dataElement.id}:${s.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${a(d.name??"")}</h3>`);let c=new Map;for(let s of d.dataElements??[]){let u=e[s.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,g=c.get(m);g||(g={cc:u.categoryCombo,des:[]},c.set(m,g)),g.des.push(u)}for(let s of c.values()){let u=s.cc.categoryOptionCombos??[],m=s.cc.categories??[];n.push('<div class="der-de-table-scroll">'),n.push('<table class="sectionTable" cellspacing="0">');let g=Me(m,u);if(n.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){n.push("<tr>"),f===0&&n.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let h of g[f]??[])n.push(`<th colspan="${h.span}">${a(h.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push('<th class="dataElementCell">Data elements</th>');for(let f of u)n.push(`<th>${a(f.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let f of s.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${a(f.id)}-cell">`+a(f.formName??f.name??f.id)+"</td>");for(let h of u){let _=`${f.id}-${h.id}-val`;t.has(`${f.id}:${h.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${a(_)}" name="${a(_)}" dataelementid="${a(f.id)}" optioncomboid="${a(h.id)}"></td>`)}n.push("</tr>")}for(let f of d.indicators??[]){let h=l[f.id];h&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${a(h.name??h.id)}</td>`),n.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${a(h.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table></div>")}}return n.join(`
`)}function Me(i,e){if(i.length===0||e.length===0)return[];let l=new Map;for(let n of i)for(let d of n.categoryOptions??[])l.set(d.id,{catId:n.id,name:d.name??d.id});let o=i.length,r=e.map(n=>{let d=new Array(o).fill("");for(let t of n.categoryOptions??[]){let c=l.get(t.id);if(!c)continue;let s=i.findIndex(u=>u.id===c.catId);s>=0&&(d[s]=c.name)}return d});for(let n of r)if(n.some(d=>d===""))return[];let a=[];for(let n=0;n<o;n++){let d=[];for(let t=0;t<r.length;){let c=r[t],s=t+1;for(;s<r.length;){let u=r[s],m=!0;for(let g=0;g<=n;g++)if(c[g]!==u[g]){m=!1;break}if(!m)break;s++}d.push({label:c[n]??"",span:s-t}),t=s}a.push(d)}return a}function Re(i){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let o=l.de;o.currentDataSetId=i.dataSetId,o.currentOrganisationUnitId=i.orgUnitId,o.currentPeriodId=i.periodId,o.currentCategorySelections={...i.aocSelections??{}};let r=i.meta??{},a={},n={};if(r.categoryCombo){n[r.categoryCombo.id]=r.categoryCombo;for(let u of r.categoryCombo.categories??[])a[u.id]=u}o.categories=a,o.categoryCombos=n;let d={},t={};for(let u of r.dataSetElements??[]){let m=u.dataElement;m&&(d[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(n[m.categoryCombo.id]=m.categoryCombo))}o.dataElements=d,o.optionSets=t;let c={};for(let u of r.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};o.indicatorFormulas=c;let s={};for(let u of i.validationRules??[])s[u.id]=u;o.validationRules=s,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[r.id]:{id:r.id,name:r.name??r.displayName??"",periodType:r.periodType,categoryCombo:r.categoryCombo?.id,periodId:i.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Oe(){let i=globalThis;if(i.$&&typeof i.$.ajaxSetup=="function"&&i.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),i.dhis2?.period&&i.$?.calendars?.instance){let e=i.dhis2.period;e.format="yyyy-mm-dd",e.calendar=i.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Le(i,e){if(!i)return;for(let[o,r]of Object.entries(e)){let a=i.querySelector(`input[data-der-category="${o}"]`);a||(a=document.createElement("input"),a.type="hidden",a.id=`category-${o}`,a.setAttribute("data-der-category",o),i.appendChild(a)),a.value=r}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function He(i,e,l,o,r,a){let n=s=>{let u=/^(.+)-(.+)-val$/.exec(s);return u?{de:u[1],coc:u[2]}:null},d=new WeakMap,t=i.querySelectorAll('input[name$="-val"]');for(let s of Array.from(t))d.set(s,s.value);let c=async s=>{let u=s.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",g=n(m);if(!g)return;let f=e(),h=l(),_=o();if(!f||!h||!_)return;let w=u.value;if(d.get(u)!==w){ee(u,"saving");try{let v=await a.submitAggregate({dataSet:f,period:h,orgUnit:_,attributeOptionComboSelections:r(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:w}]});d.set(u,w),ee(u,v?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ee(u,"error")}}};i.addEventListener("blur",s=>{c(s)},!0)}function qe(i){i.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let o=l.target;if(!(o instanceof HTMLInputElement))return;let r=o.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(r);if(!a)return;l.preventDefault();let n=a[2],d=Array.from(i.querySelectorAll(`input[name$="-${n}-val"]`)),t=d.indexOf(o);if(t===-1)return;let c=d[t+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Pe(i){let e=Array.from(i.querySelectorAll("h2, h3, h4")).filter(a=>(a.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),o=[],r=(a,n)=>{for(let d of l)if(d!==n&&a.contains(d))return!0;return!1};return e.forEach((a,n)=>{let d=a.id||`der-de-section-${n}`;a.id=d;let t=null,c=a.parentElement,s=null;for(;c&&c!==i&&!r(c,a);)s=c,c=c.parentElement;if(s&&s.children.length>1&&s!==i)t=s,t.classList.add("der-de-section-slot"),t.dataset.sectionId=d;else{t=document.createElement("div"),t.className="der-de-section-slot",t.dataset.sectionId=d;let u=e[n+1]??null,m=[],g=a;for(;g&&g!==u;){let f=g.nextSibling;m.push(g),g=f}a.parentNode?.insertBefore(t,a);for(let f of m)t.appendChild(f)}o.push({id:d,label:(a.textContent??"").trim(),slot:t})}),o}function ze({targetRef:i,formVersion:e}){let[l,o]=N([]),[r,a]=N(""),[n,d]=N({});return I(()=>{let t=i.current;if(!t)return;let c=Pe(t);o(c),a(c[0]?.id??"")},[i,e]),I(()=>{if(l.length===0)return;let t=()=>{let u={};for(let m of l){let g=Array.from(m.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(h=>h.value.trim()!=="").length;u[m.id]={filled:f,total:g.length}}d(u)};t();let c=i.current;if(!c)return;let s=u=>{let m=u.target;m&&m.tagName==="INPUT"&&/-val$/.test(m.getAttribute("name")??"")&&t()};return c.addEventListener("input",s,!0),()=>{c.removeEventListener("input",s,!0)}},[i,l]),I(()=>{if(!i.current||l.length===0)return;for(let s of l)s.slot.style.display=s.id===r?"":"none";let c=l.find(s=>s.id===r);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[i,l,r]),l.length<2?null:x("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:l.map(t=>{let c=n[t.id],s=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return p("li",{children:x("button",{type:"button",className:"der-de-section-nav__item"+(r===t.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>a(t.id),children:[p("span",{className:"der-de-section-nav__label",children:t.label}),c&&c.total>0&&p("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${s}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:s==="done"?"\u2713":`${c.filled}/${c.total}`})]})},t.id)})})]})}function Fe({root:i,formVersion:e}){let[l,o]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let n=()=>{let t=i.current;if(!t)return;let c=Array.from(t.querySelectorAll('input[name$="-val"]')),s=0,u=0,m=0,g=0,f=0;for(let h of c){h.value.trim()!==""&&s++;let _=h.style.outline||"";_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?u++:_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?g++:_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?m++:(_.includes("rgb(169, 50, 50)")||_.includes("#a93232"))&&f++}o({total:c.length,filled:s,saving:u,saved:m,queued:g,error:f})};n();let d=window.setInterval(n,800);return()=>window.clearInterval(d)},[i,e]),l.total===0)return p("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let r=[];r.push(`${l.filled} of ${l.total} filled`),l.saving>0&&r.push(`${l.saving} saving`),l.queued>0&&r.push(`${l.queued} queued`),l.error>0&&r.push(`${l.error} error`);let a=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return p("span",{className:`der-de-savepill der-de-savepill--${a}`,"data-test":"de-save-state",children:r.join(" \xB7 ")})}function Ue({root:i,details:e,formVersion:l}){let[o,r]=N("");I(()=>{let d=i.current;if(!d)return;let t=()=>{let u=Array.from(d.querySelectorAll("[data-section-id]")).find(g=>g.style.display!=="none");if(!u){r("");return}let m=u.querySelector("h2, h3, h4");r((m?.textContent??"").trim())};t();let c=window.setInterval(t,400);return()=>window.clearInterval(c)},[i,l]);let a={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected"},n={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return x("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:[p("div",{className:"der-de-live-strip__section",children:o||"Pick a section"}),p("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:e?x(dt,{children:[p("span",{className:"der-de-live-strip__de",children:e.deName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__coc",children:e.cocName}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:"der-de-live-strip__value",children:e.value||p("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),p("span",{className:"der-de-live-strip__sep",children:"\xB7"}),p("span",{className:`der-de-live-strip__state der-de-live-strip__state--${n[e.saveState]}`,children:a[e.saveState]}),e.compulsory&&p("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):p("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})]})}function Ve({open:i,issues:e,onClose:l,onPick:o}){return I(()=>{if(!i)return;let r=a=>{a.key==="Escape"&&l()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[i,l]),!i||e.length===0?null:x("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[x("header",{className:"der-de-issues-drawer__head",children:[x("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),p("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),p("ul",{className:"der-de-issues-drawer__list",children:e.map(r=>p("li",{children:x("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>o(r),children:[p("span",{className:"der-de-issues-drawer__de",children:r.deName}),p("span",{className:"der-de-issues-drawer__coc",children:r.cocName}),x("span",{className:"der-de-issues-drawer__why",children:[p("code",{className:"der-de-issues-drawer__value",children:r.value}),p("span",{children:r.problem})]})]})},`${r.deId}-${r.cocId}`))})]})}function Be({open:i,onClose:e}){return I(()=>{if(!i)return;let o=r=>{r.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[i,e]),i?p("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:x("div",{className:"der-de-shortcuts",children:[x("header",{className:"der-de-shortcuts__head",children:[p("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),p("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),p("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,r])=>x("div",{className:"der-de-shortcuts__row",children:[p("dt",{children:p("kbd",{children:o})}),p("dd",{children:r})]},o))})]})}):null}function Qe(i,e){i.addEventListener("paste",l=>{let o=l.target;if(!o||o.tagName!=="INPUT")return;let r=o.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(r))return;let n=l.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(n),t=/\t/.test(n);if(!d&&!t)return;let c=n.split(/\r?\n/).filter((v,T,C)=>!(T===C.length-1&&v==="")).map(v=>v.split("	").map(T=>T.trim()));if(c.length===0)return;l.preventDefault();let s=o.closest("[data-section-id]")??i,m=Array.from(s.querySelectorAll("tbody tr")).map(v=>Array.from(v.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let v=0;v<m.length;v++){let T=m[v].indexOf(o);if(T!==-1){g=v,f=T;break}}if(g===-1)return;let h=0,_=0;for(let v=0;v<c.length;v++){let T=c[v],C=m[g+v];if(!C){_+=T.length;continue}for(let R=0;R<T.length;R++){let M=C[f+R];if(!M){_++;continue}M.value=T[R]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),h++}}let w=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${h} value${h===1?"":"s"} (${w}${_>0?`, ${_} overflow`:""}).`})},!0)}function Je(i){let e=Array.from(i.querySelectorAll('input[name="total"][dataelementid]'));if(e.length===0)return;let l=[];for(let o of e){let r=o.getAttribute("dataelementid")??"";if(!r)continue;let a=o.closest("div"),d=(()=>{let s=a??o.parentElement;if(!s)return null;let u=s.previousElementSibling;for(;u;){if(/^(H1|H2|H3|H4)$/.test(u.tagName)||u.tagName==="DIV"&&!u.querySelector("table, input")&&(u.textContent??"").trim().length>0)return u;u=u.previousElementSibling}let m=s.closest("[data-section-id]");if(m){let g=m.querySelector("h2, h3, h4");if(g)return g}return null})();if(!d)continue;a?.remove();let t=document.createElement("span");t.className="der-de-matrix-total",t.setAttribute("data-de",r),d.appendChild(t);let c=()=>{let s=0,u=!1,m=Array.from(i.querySelectorAll(`input[dataelementid="${r}"][name$="-val"],input[name^="${r}-"][name$="-val"]`)),g=new Set;for(let f of m){if(g.has(f))continue;g.add(f);let h=parseFloat(f.value);Number.isFinite(h)&&(s+=h,u=!0)}if(u){let f=Number.isInteger(s)?s:Number(s.toFixed(2));t.textContent=` (Total: ${f})`}else t.textContent=""};l.push(c),c()}l.length!==0&&i.addEventListener("input",o=>{let r=o.target;if(!(!r||r.tagName!=="INPUT")&&/-val$/.test(r.getAttribute("name")??""))for(let a of l)a()},!0)}function We(i,e){let l=e.indicators??[];if(l.length===0)return;let o=l.filter(s=>s.numerator&&s.denominator).map(s=>({id:s.id,factor:s.indicatorType?.factor??1,numExpr:s.numerator,denExpr:s.denominator}));if(o.length===0)return;let r=Array.from(i.querySelectorAll("input[indicatorid]")),a=new Map;for(let s of Array.from(i.querySelectorAll('input[name$="-val"]')))a.set(s.getAttribute("name")??"",s);let n=s=>{let u=0;for(let[m,g]of a){if(!m.startsWith(`${s}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},d=s=>s.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,m,g)=>{if(g){let f=a.get(`${m}-${g}-val`),h=parseFloat(f?.value??"");return Number.isFinite(h)?String(h):"0"}return String(n(m))}),t=s=>{if(!/^[\s\d+\-*/().eE]+$/.test(s))return NaN;try{return Function(`"use strict";return (${s})`)()}catch{return NaN}},c=()=>{for(let s of o){let u=t(d(s.numExpr)),m=t(d(s.denExpr)),g=r.find(h=>h.getAttribute("indicatorid")===s.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(m)||m===0){g.value="";continue}let f=u/m*s.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};i.addEventListener("input",s=>{let u=s.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function Ge(i,e){let l={};for(let o of e.dataSetElements??[])o.dataElement&&(l[o.dataElement.id]=o.dataElement);for(let o of Array.from(i.querySelectorAll('input[name$="-val"]'))){let r=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!r)continue;let a=l[r[1]],n=a?.formName??a?.name??r[1],d=a?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===r[2]),t=d?.name??d?.displayName??r[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",t===r[2]?`${n}`:`${n}, ${t}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function Ye(i,e){let l=e.compulsoryDataElementOperands??[],o=new Set;for(let r of l){let a=r.dimensionItem;if(!a)continue;let n=a.split(".");n.length===2&&o.add(`${n[0]}:${n[1]}`)}if(o.size!==0)for(let r of Array.from(i.querySelectorAll('input[name$="-val"]'))){let a=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");a&&o.has(`${a[1]}:${a[2]}`)&&r.setAttribute("data-compulsory","1")}}function Ke(i,e,l){let o={};for(let a of e.dataSetElements??[])a.dataElement&&(o[a.dataElement.id]=a.dataElement);let r=a=>{let n=a.getAttribute("name")??a.id??"",d=/^(.+)-(.+)-val$/.exec(n);if(!d)return null;let t=d[1],c=d[2],s=o[t],u=s?.categoryCombo,m=u?.categoryOptionCombos?.find(T=>T.id===c),g=[],f=m?.name??m?.displayName??c,h=f.split(/,\s*/).filter(Boolean),_=u?.categories??[];h.forEach((T,C)=>{g.push({category:_[C]?.name??_[C]?.displayName??"",option:T})});let w=a.style.outline||"",v=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":a.value.trim()===""?"empty":"saved";return{deId:t,cocId:c,deName:s?.name??t,deFormName:s?.formName,valueType:s?.valueType??"TEXT",optionSetId:s?.optionSet?.id,cocName:f,categoryBreakdown:g,value:a.value,saveState:v,inputName:n,compulsory:a.getAttribute("data-compulsory")==="1"}};i.addEventListener("focusin",a=>{let n=a.target;if(n&&n.tagName==="INPUT"){let d=r(n);d&&l(d)}},!0),i.addEventListener("input",a=>{let n=a.target;if(n&&n.tagName==="INPUT"){let d=r(n);d&&l(d)}},!0)}function Xe(i,e,l){if(!i)return;let o=globalThis,r=o.dhis2?.de?.dataElements??{},a=o.dhis2?.de?.categoryOptionCombos??{},n=Array.from(i.querySelectorAll('input[name$="-val"]')),d=[];for(let t of n){t.style.outline="";let c=/^(.+)-(.+)-val$/.exec(t.getAttribute("name")??"");if(!c)continue;let s=c[1],u=c[2],m=r[s],g=m?.valueType??"TEXT",f=t.value.trim();if(f===""){t.getAttribute("data-compulsory")==="1"&&(t.style.outline="2px solid #c0392b",d.push({deId:s,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:m?.name??s,cocName:a[u]?.name??u,inputName:t.name}));continue}let h=Ze(f,g);h&&(t.style.outline="2px solid #c0392b",d.push({deId:s,cocId:u,valueType:g,value:f,problem:h,deName:m?.name??s,cocName:a[u]?.name??u,inputName:t.name}))}l(d),d.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${n.length} cells OK.`}):e({kind:"error",message:`Validation found ${d.length} issue${d.length===1?"":"s"}. See the Issues panel.`})}function Ze(i,e){let l=Number(i),o=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(i.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(i.toLowerCase()))return"must be yes";break;case"URL":try{new URL(i)}catch{return"must be a valid URL"}break;default:break}return null}function ee(i,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";i.style.outline=`2px solid ${l}`,i.style.transition="outline 150ms",e==="queued"?i.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):i.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{i.style.outline.includes("#1a8754")&&(i.style.outline="1px solid #b7dcc7")},1200)}async function et(i,e,l,o,r){if(!e||!l||!o)return;let a;try{a=(await r.readAggregateValues(o,l,2e3)).dataValues??[]}catch{return}for(let n of a){let d=n.dataElement,t=n.categoryOptionCombo,c=n.value;if(!d||!t||c==null)continue;let s=i.querySelector(`input[name="${d}-${t}-val"]`);s&&(s.value=c)}}function pe(i){return new Promise((e,l)=>{let o=document.createElement("script");o.src=i,o.async=!1,o.setAttribute("data-der-custom-form",i),o.onload=()=>e(),o.onerror=()=>l(new Error(`failed to load ${i}`)),document.head.appendChild(o)})}function ge(i){if(document.querySelector(`link[data-der-custom-form="${i}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=i,e.setAttribute("data-der-custom-form",i),document.head.appendChild(e)}function le(i){return!i||/^https?:\/\//i.test(i)||i.startsWith("/legacy-custom-forms/")||i.startsWith("/")?i:`/legacy-custom-forms/${i.replace(/^(?:\.{1,2}\/)+/,"")}`}async function tt(i,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let r of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let a=r.getAttribute("href")??"";a&&ge(le(a))}else{let a=document.createElement("style");a.textContent=r.textContent??"",a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a)}r.remove()}let o=[];for(let r of Array.from(l.querySelectorAll("script"))){let a=r.getAttribute("src");a?o.push({src:le(a)}):o.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(l.body.querySelectorAll("*"))){if(r.removeAttribute("style"),r.tagName==="INPUT"){let a=r.getAttribute("id")??"";a.endsWith("-val")&&r.getAttribute("name")!==a&&r.setAttribute("name",a)}if(r.tagName==="TH"){let a=(r.textContent??"").trim();(a==="Reporting item"||a==="Reported count")&&(r.textContent=a==="Reporting item"?"Data elements":"Value")}}for(let r of Array.from(l.body.childNodes))i.appendChild(document.adoptNode(r));for(let r of o)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await pe(r.src);else if(r.code){let a=document.createElement("script");a.textContent=r.code,a.setAttribute("data-der-custom-form","inline"),document.head.appendChild(a),a.remove()}}var te={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},ce={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ue={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},rt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},at={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function ot(i,e,l){let o={...te},r=st(i);if(r.length===0)return p("input",{value:e,onChange:m=>l(m.target.value),placeholder:i?`DHIS2 ${i} period id`:"e.g. 202611",style:o});let a=[...r];if(e&&!a.some(m=>m.id===e)){let m=nt(i,e)??e;a.unshift({id:e,label:m})}let n=r[0]?.id??null,d=a.findIndex(m=>m.id===e),t=d===-1||d<a.length-1||!!i,c=e!==""&&(d>0||e!==n),s=()=>{if(!i)return;let m=d>=0&&d<a.length-1?a[d+1]?.id??"":me(i,e||n||"",-1);m&&l(m)},u=()=>{if(!i||!e||e===n)return;let m=d>0?a[d-1]?.id??"":me(i,e,1);m&&l(m)};return x("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:s,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),x("select",{value:e,onChange:m=>l(m.target.value),style:o,children:[p("option",{value:"",children:"Select a period\u2026"}),a.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function me(i,e,l){let o=r=>String(r).padStart(2,"0");switch(i){case"Daily":{if(!/^\d{8}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),d=new Date(r,a,n+l);return`${d.getFullYear()}${o(d.getMonth()+1)}${o(d.getDate())}`}case"Weekly":{let r=/^(\d{4})W(\d{1,2})$/.exec(e);if(!r)return"";let a=Number(r[1]),n=Number(r[2])+l;return n<1?(a-=1,n=re(a)):n>re(a)&&(a+=1,n=1),`${a}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let r=Number(e.slice(0,4)),a=Number(e.slice(4,6))-1,n=r*12+a+l;return`${Math.floor(n/12)}${o((n%12+12)%12+1)}`}case"BiMonthly":{let r=/^(\d{4})(\d{2})B$/.exec(e);if(!r)return"";let a=Number(r[1]),n=Number(r[2])+l;return n<1?(a-=1,n=6):n>6&&(a+=1,n=1),`${a}${o(n)}B`}case"Quarterly":{let r=/^(\d{4})Q(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),n=Number(r[2])+l;return n<1?(a-=1,n=4):n>4&&(a+=1,n=1),`${a}Q${n}`}case"SixMonthly":{let r=/^(\d{4})S(\d)$/.exec(e);if(!r)return"";let a=Number(r[1]),n=Number(r[2])+l;return n<1?(a-=1,n=2):n>2&&(a+=1,n=1),`${a}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function nt(i,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${l[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let r=(Number(o[2])-1)*2;return`${l[r]}\u2013${l[r+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function st(i){let e=new Date,l=e.getFullYear(),o=e.getMonth(),r=n=>String(n).padStart(2,"0"),a=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":{let n=[];for(let d=0;d<30;d++){let t=new Date(e);t.setDate(t.getDate()-d);let c=`${t.getFullYear()}${r(t.getMonth()+1)}${r(t.getDate())}`,s=`${t.getFullYear()}-${r(t.getMonth()+1)}-${r(t.getDate())}`;n.push({id:c,label:s})}return n}case"Weekly":{let n=[],d=fe(e),t=d.year,c=d.week;for(let s=0;s<12;s++)n.push({id:`${t}W${c}`,label:`${t} W${r(c)}`}),c-=1,c<1&&(t-=1,c=re(t));return n}case"Monthly":{let n=[];for(let d=0;d<24;d++){let t=l,c=o,s=t*12+c-d,u=Math.floor(s/12),m=(s%12+12)%12;n.push({id:`${u}${r(m+1)}`,label:`${a[m]} ${u}`})}return n}case"BiMonthly":{let n=[],d=Math.floor(o/2)+1,t=l,c=d;for(let s=0;s<12;s++){let u=(c-1)*2;n.push({id:`${t}${r(c)}B`,label:`${a[u]}\u2013${a[u+1]} ${t}`}),c-=1,c<1&&(t-=1,c=6)}return n}case"Quarterly":{let n=[],d=Math.floor(o/3)+1,t=l,c=d;for(let s=0;s<8;s++)n.push({id:`${t}Q${c}`,label:`${t} Q${c}`}),c-=1,c<1&&(t-=1,c=4);return n}case"SixMonthly":{let n=[],d=o<6?1:2,t=l,c=d;for(let s=0;s<6;s++)n.push({id:`${t}S${c}`,label:`${t} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(t-=1,c=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let d=0;d<10;d++){let t=l-d;n.push({id:String(t),label:String(t)})}return n}default:return[]}}function fe(i){let e=new Date(i.getFullYear(),i.getMonth(),i.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let o=new Date(e.getFullYear(),0,1),a=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((a+1)/7)}}function re(i){return fe(new Date(i,11,28)).week}var it=`
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
/* Matrix title total badge \u2014 "(Total: 19)" appended to the
 * title of each disaggregated matrix. Updates live from input
 * events on inputs sharing the same dataelementid. */
.der-de-matrix-total {
  margin-left: 6px;
  font-weight: 400;
  color: var(--der-ink-500, #5b6478);
  font-size: 0.92em;
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
