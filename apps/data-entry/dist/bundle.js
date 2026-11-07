/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as de,useState as N}from"react";import{useAuth as Ae,useOrgUnitBinding as $e,useOnlineStatus as Ie,useDerApi as je,ScreenCard as De}from"@der/app-sdk";import{Fragment as fe,jsx as m,jsxs as h}from"react/jsx-runtime";function Oe(){let s=Ae(),e=$e(),l=Ie(),n=je(),[a,t]=N("custom"),[o,d]=N([]),[r,c]=N(""),[i,u]=N(""),[p,g]=N(""),[f,v]=N(""),[w,_]=N({kind:"idle"}),[x,C]=N(null),T=de(null),[R,O]=N({}),z=de({}),[ve,V]=N([]),[M,F]=N(null),[Q,ae]=N(!1),[oe,xe]=N(0),[U,we]=N([]),[J,W]=N(!1),[_e,ke]=N(null),[ne,se]=N(!0),[Ee,G]=N(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let S=y.target;S&&(S.tagName==="INPUT"||S.tagName==="TEXTAREA")||(y.preventDefault(),G(E=>!E))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[q,Ne]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),I(()=>{let b=!1;return(async()=>{try{let y=await n.listDataSets();if(b)return;let S=(y.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,j)=>E.label.localeCompare(j.label));d(S)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(r.trim()===""){C(null),V([]),O({}),z.current={};return}let b=!1;return(async()=>{try{let y=await n.getDataSetMeta(r.trim());if(b)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),t(S?"custom":"structured");try{let E=await n.getDataSetFormMetadata(r.trim());if(b)return;let j=await le(E,n);if(b)return;let B=(j.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));V(B);let P={};for(let A of B)A.options[0]&&(P[A.id]=A.options[0].id);O(P),z.current=P}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[r]),I(()=>{if(a!=="custom"||!x?.hasCustomForm||x.formType==="CUSTOM"&&!x.formId)return;let b=T.current;if(!b)return;let y=!1;return(async()=>{_({kind:"submitting"});try{let S=await n.getDataSetFormMetadata(r.trim());if(y)return;let E=await le(S,n);if(y)return;let j="";if(x.formType==="CUSTOM"&&x.formId){try{j=(await n.getDataEntryFormHtml(x.formId)).htmlCode??""}catch(k){j="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",k)}j.trim()||(j=ce(E))}else x.formType==="SECTION"&&(j=ce(E));if(y)return;let B=await n.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(y)return;let P=(E.categoryCombo?.categories??[]).filter(k=>(k.categoryOptions?.length??0)>1).map(k=>({id:k.id,name:k.name??k.id,options:(k.categoryOptions??[]).map(L=>({id:L.id,name:L.name??L.id}))}));V(P);let A={};for(let k of P)k.options[0]&&(A[k.id]=k.options[0].id);O(A),z.current=A,b.replaceChildren();for(let[k,L]of[["selectedDataSetId",r.trim()],["selectedPeriodId",i.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let D=document.createElement("input");D.type="hidden",D.id=k,D.value=L,b.appendChild(D)}for(let[k,L]of Object.entries(A)){let D=document.createElement("input");D.type="hidden",D.id=`category-${k}`,D.value=L,D.setAttribute("data-der-category",k),b.appendChild(D)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),qe({dataSetId:r.trim(),periodId:i.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:A,validationRules:B.validationRules??[]});for(let k of Me)ye(k);for(let k of Re)document.querySelector(`script[data-der-custom-form="${k}"]`)||await be(k);He(),await at($,j),await rt($,r.trim(),i.trim(),e.orgUnitUid??"",n),ze($,()=>r.trim(),()=>i.trim(),()=>e.orgUnitUid??"",()=>({...z.current}),n),Fe($),Ge($,_),Ze($,E,ke),Xe($,E),Ke($,E),Ye($,E),xe(k=>k+1),_({kind:"idle"})}catch(S){_({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[a,x,r,i,e.orgUnitUid]);let Se=e.bound&&r.trim()!==""&&i.trim()!==""&&p.trim()!==""&&f.trim()!==""&&w.kind!=="submitting";async function Ce(b){b.preventDefault(),_({kind:"submitting"});try{await n.submitAggregate({dataSet:r,period:i,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),_({kind:"ok",message:`Submitted ${p}=${f} for ${i}.`}),g(""),v("")}catch(y){_({kind:"error",message:y.message??"Submission failed"})}}let ie=i.trim()!=="",Y=r.trim()!=="",H=Y&&ie&&e.bound;I(()=>{if(!H){F(null);return}let b=!1;return(async()=>{try{let y=await n.getCompletion(r.trim(),e.orgUnitUid??"",i.trim());if(b)return;F({completed:!!y.completed,completedAt:y.completedAt})}catch{b||F({completed:!1})}})(),()=>{b=!0}},[r,i,e.orgUnitUid,H]);async function Te(){if(!H||Q)return;let b=!M?.completed;if(b){let y=T.current;if(y){let S=[];for(let E of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&S.push(E);if(S.length>0){_({kind:"error",message:`Can't mark complete \u2014 ${S.length} compulsory value${S.length===1?"":"s"} still missing. Run Validate to jump to them.`}),S[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ae(!0);try{let y=await n.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:i.trim(),completed:b});F({completed:!!y.completed,completedAt:y.completedAt}),_({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){_({kind:"error",message:`Completion failed: ${y.message}`})}finally{ae(!1)}}return h(De,{dataTest:"der-aggregate-entry",children:[m("style",{children:lt}),h("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[h("div",{className:"der-de-toolbar__head",children:[m("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),m("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),m("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]}),h("div",{className:"der-de-toolbar__picks",children:[h("label",{className:"der-de-toolbar__field",children:[m("span",{className:"der-de-toolbar__field-label",children:"Data set"}),h("select",{className:"der-de-toolbar__select",value:r,onChange:b=>{c(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),o.map(b=>m("option",{value:b.id,children:b.label},b.id))]})]}),ve.map(b=>h("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-toolbar__field-label",children:b.name}),h("select",{className:"der-de-toolbar__select",value:R[b.id]??"",onChange:y=>{let S={...R,[b.id]:y.target.value};O(S),z.current=S,Pe(T.current,S)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),b.options.map(y=>m("option",{value:y.id,children:y.name},y.id))]})]},b.id)),h("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[h("span",{className:"der-de-toolbar__field-label",children:["Period",x?.periodType?` \xB7 ${x.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:st(x?.periodType,i,u)})]})]})]}),w.kind==="ok"&&m("div",{style:ot,"data-test":"de-ok",children:w.message}),w.kind==="error"&&m("div",{style:nt,"data-test":"de-err",children:w.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Y&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Y&&!ie&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),H&&a==="structured"&&h("form",{onSubmit:Ce,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:b=>g(b.target.value),style:te})]}),h("label",{children:["Value",m("input",{value:f,onChange:b=>v(b.target.value),inputMode:"decimal",style:te})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!Se,style:me,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),H&&a==="custom"&&m("div",{className:`der-de-form-card der-de-density-${q}`,children:h("div",{className:"der-de-form-split",children:[m(Be,{targetRef:T,formVersion:oe}),m("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),H&&a==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Ve,{root:T,formVersion:oe}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Ne(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),M&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:M.completed?`Complete${M.completedAt?" \xB7 "+new Date(M.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{et(T.current,_,b=>{we(b),W(b.length>0)})},style:pe,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!J&&h("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),!ne&&m("button",{type:"button",onClick:()=>se(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:()=>G(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Te,disabled:Q,style:M?.completed?pe:me,"data-test":"de-complete-btn",children:Q?"Saving\u2026":M?.completed?"Reopen":"Mark complete"})]}),m(We,{open:ne&&!J,details:_e,onClose:()=>se(!1)}),m(Je,{open:Ee,onClose:()=>G(!1)}),m(Qe,{open:J,issues:U,onClose:()=>W(!1),onPick:b=>{let y=T.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select())}})]})}var Re=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Me=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],K=null,X=null,Z=null;async function le(s,e){K||(K=e.listAllDataElements().then(d=>new Map(d.map(r=>[r.id,r])))),X||(X=e.listAllCategoryCombos().then(d=>new Map(d.map(r=>[r.id,r])))),Z||(Z=e.listAllCategoryOptionCombos().then(d=>{let r=new Map;for(let c of d){let i=c.categoryCombo?.id;if(!i)continue;let u=r.get(i);u?u.push(c):r.set(i,[c])}return r}));let[l,n,a]=await Promise.all([K,X,Z]),t=d=>{if(!d?.id)return;let r=n.get(d.id),c=a.get(d.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:i.categoryOptions??[]})),categories:(r.categories??[]).map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:(i.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:d},o=d=>{let r=l.get(d.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:d};return{...s,categoryCombo:t(s.categoryCombo)??s.categoryCombo,dataSetElements:(s.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?o(d.dataElement):void 0})),sections:(s.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(r=>o(r))}))}}function ce(s){let e={};for(let d of s.dataSetElements??[])d.dataElement&&(e[d.dataElement.id]=d.dataElement);let l={};for(let d of s.indicators??[])l[d.id]=d;let n=(s.sections??[]).slice().sort((d,r)=>(d.sortOrder??0)-(r.sortOrder??0));if(!n.some(d=>(d.dataElements?.length??0)>0)){let d=(s.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);n=[{id:s.id,name:s.displayName??s.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let t=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),o=[];for(let d of n){let r=new Set;for(let i of d.greyedFields??[])i.dataElement?.id&&i.categoryOptionCombo?.id&&r.add(`${i.dataElement.id}:${i.categoryOptionCombo.id}`);o.push(`<h3 class="formSection">${t(d.name??"")}</h3>`);let c=new Map;for(let i of d.dataElements??[]){let u=e[i.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,g=c.get(p);g||(g={cc:u.categoryCombo,des:[]},c.set(p,g)),g.des.push(u)}for(let i of c.values()){let u=i.cc.categoryOptionCombos??[],p=i.cc.categories??[];o.push('<div class="der-de-table-scroll">'),o.push('<table class="sectionTable" cellspacing="0">');let g=Le(p,u);if(o.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){o.push("<tr>"),f===0&&o.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let v of g[f]??[])o.push(`<th colspan="${v.span}">${t(v.label)}</th>`);o.push("</tr>")}else{o.push("<tr>"),o.push('<th class="dataElementCell">Data elements</th>');for(let f of u)o.push(`<th>${t(f.name??"")}</th>`);o.push("</tr>")}o.push("</thead><tbody>");for(let f of i.des){o.push("<tr>"),o.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let v of u){let w=`${f.id}-${v.id}-val`;r.has(`${f.id}:${v.id}`)?o.push('<td class="greyed">\u2014</td>'):o.push(`<td><input type="text" id="${t(w)}" name="${t(w)}" dataelementid="${t(f.id)}" optioncomboid="${t(v.id)}"></td>`)}o.push("</tr>")}for(let f of d.indicators??[]){let v=l[f.id];v&&(o.push('<tr class="indicatorRow">'),o.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),o.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),o.push("</tr>"))}o.push("</tbody></table></div>")}}return o.join(`
`)}function Le(s,e){if(s.length===0||e.length===0)return[];let l=new Map;for(let o of s)for(let d of o.categoryOptions??[])l.set(d.id,{catId:o.id,name:d.name??d.id});let n=s.length,a=e.map(o=>{let d=new Array(n).fill("");for(let r of o.categoryOptions??[]){let c=l.get(r.id);if(!c)continue;let i=s.findIndex(u=>u.id===c.catId);i>=0&&(d[i]=c.name)}return d});for(let o of a)if(o.some(d=>d===""))return[];let t=[];for(let o=0;o<n;o++){let d=[];for(let r=0;r<a.length;){let c=a[r],i=r+1;for(;i<a.length;){let u=a[i],p=!0;for(let g=0;g<=o;g++)if(c[g]!==u[g]){p=!1;break}if(!p)break;i++}d.push({label:c[o]??"",span:i-r}),r=i}t.push(d)}return t}function qe(s){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let n=l.de;n.currentDataSetId=s.dataSetId,n.currentOrganisationUnitId=s.orgUnitId,n.currentPeriodId=s.periodId,n.currentCategorySelections={...s.aocSelections??{}};let a=s.meta??{},t={},o={};if(a.categoryCombo){o[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])t[u.id]=u}n.categories=t,n.categoryCombos=o;let d={},r={};for(let u of a.dataSetElements??[]){let p=u.dataElement;p&&(d[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(o[p.categoryCombo.id]=p.categoryCombo))}n.dataElements=d,n.optionSets=r;let c={};for(let u of a.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};n.indicatorFormulas=c;let i={};for(let u of s.validationRules??[])i[u.id]=u;n.validationRules=i,n.lockExceptions=[],n.emptyOrganisationUnits=[],n.significantZeros=[],n.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:s.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function He(){let s=globalThis;if(s.$&&typeof s.$.ajaxSetup=="function"&&s.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),s.dhis2?.period&&s.$?.calendars?.instance){let e=s.dhis2.period;e.format="yyyy-mm-dd",e.calendar=s.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Pe(s,e){if(!s)return;for(let[n,a]of Object.entries(e)){let t=s.querySelector(`input[data-der-category="${n}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${n}`,t.setAttribute("data-der-category",n),s.appendChild(t)),t.value=a}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function ze(s,e,l,n,a,t){let o=i=>{let u=/^(.+)-(.+)-val$/.exec(i);return u?{de:u[1],coc:u[2]}:null},d=new WeakMap,r=s.querySelectorAll('input[name$="-val"]');for(let i of Array.from(r))d.set(i,i.value);let c=async i=>{let u=i.target;if(!u||u.tagName!=="INPUT")return;let p=u.getAttribute("name")??"",g=o(p);if(!g)return;let f=e(),v=l(),w=n();if(!f||!v||!w)return;let _=u.value;if(d.get(u)!==_){ee(u,"saving");try{let x=await t.submitAggregate({dataSet:f,period:v,orgUnit:w,attributeOptionComboSelections:a(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:_}]});d.set(u,_),ee(u,x?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ee(u,"error")}}};s.addEventListener("blur",i=>{c(i)},!0)}function Fe(s){s.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let n=l.target;if(!(n instanceof HTMLInputElement))return;let a=n.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(a);if(!t)return;l.preventDefault();let o=t[2],d=Array.from(s.querySelectorAll(`input[name$="-${o}-val"]`)),r=d.indexOf(n);if(r===-1)return;let c=d[r+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Ue(s){let e=Array.from(s.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),n=[],a=(t,o)=>{for(let d of l)if(d!==o&&t.contains(d))return!0;return!1};return e.forEach((t,o)=>{let d=t.id||`der-de-section-${o}`;t.id=d;let r=null,c=t.parentElement,i=null;for(;c&&c!==s&&!a(c,t);)i=c,c=c.parentElement;if(i&&i.children.length>1&&i!==s)r=i,r.classList.add("der-de-section-slot"),r.dataset.sectionId=d;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=d;let u=e[o+1]??null,p=[],g=t;for(;g&&g!==u;){let f=g.nextSibling;p.push(g),g=f}t.parentNode?.insertBefore(r,t);for(let f of p)r.appendChild(f)}n.push({id:d,label:(t.textContent??"").trim(),slot:r})}),n}function Be({targetRef:s,formVersion:e}){let[l,n]=N([]),[a,t]=N(""),[o,d]=N({});return I(()=>{let r=s.current;if(!r)return;let c=Ue(r);n(c),t(c[0]?.id??"")},[s,e]),I(()=>{if(l.length===0)return;let r=()=>{let u={};for(let p of l){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(v=>v.value.trim()!=="").length;u[p.id]={filled:f,total:g.length}}d(u)};r();let c=s.current;if(!c)return;let i=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&r()};return c.addEventListener("input",i,!0),()=>{c.removeEventListener("input",i,!0)}},[s,l]),I(()=>{if(!s.current||l.length===0)return;for(let i of l)i.slot.style.display=i.id===a?"":"none";let c=l.find(i=>i.id===a);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[s,l,a]),l.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:l.map(r=>{let c=o[r.id],i=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return m("li",{children:h("button",{type:"button",className:"der-de-section-nav__item"+(a===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(r.id),children:[m("span",{className:"der-de-section-nav__label",children:r.label}),c&&c.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${i}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:i==="done"?"\u2713":`${c.filled}/${c.total}`})]})},r.id)})})]})}function Ve({root:s,formVersion:e}){let[l,n]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let o=()=>{let r=s.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),i=0,u=0,p=0,g=0,f=0;for(let v of c){v.value.trim()!==""&&i++;let w=v.style.outline||"";w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?u++:w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?g++:w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?p++:(w.includes("rgb(169, 50, 50)")||w.includes("#a93232"))&&f++}n({total:c.length,filled:i,saving:u,saved:p,queued:g,error:f})};o();let d=window.setInterval(o,800);return()=>window.clearInterval(d)},[s,e]),l.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${l.filled} of ${l.total} filled`),l.saving>0&&a.push(`${l.saving} saving`),l.queued>0&&a.push(`${l.queued} queued`),l.error>0&&a.push(`${l.error} error`);let t=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function Qe({open:s,issues:e,onClose:l,onPick:n}){return I(()=>{if(!s)return;let a=t=>{t.key==="Escape"&&l()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[s,l]),!s||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(a=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>n(a),children:[m("span",{className:"der-de-issues-drawer__de",children:a.deName}),m("span",{className:"der-de-issues-drawer__coc",children:a.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:a.value}),m("span",{children:a.problem})]})]})},`${a.deId}-${a.cocId}`))})]})}function Je({open:s,onClose:e}){return I(()=>{if(!s)return;let n=a=>{a.key==="Escape"&&e()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[s,e]),s?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:n=>{n.target===n.currentTarget&&e()},children:h("div",{className:"der-de-shortcuts",children:[h("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([n,a])=>h("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:n})}),m("dd",{children:a})]},n))})]})}):null}function We({open:s,details:e,onClose:l}){if(!s)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let n={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},a={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${a[e.saveState]}`,children:n[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(fe,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(fe,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,o)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},o))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Ge(s,e){s.addEventListener("paste",l=>{let n=l.target;if(!n||n.tagName!=="INPUT")return;let a=n.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(a))return;let o=l.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(o),r=/\t/.test(o);if(!d&&!r)return;let c=o.split(/\r?\n/).filter((x,C,T)=>!(C===T.length-1&&x==="")).map(x=>x.split("	").map(C=>C.trim()));if(c.length===0)return;l.preventDefault();let i=n.closest("[data-section-id]")??s,p=Array.from(i.querySelectorAll("tbody tr")).map(x=>Array.from(x.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let x=0;x<p.length;x++){let C=p[x].indexOf(n);if(C!==-1){g=x,f=C;break}}if(g===-1)return;let v=0,w=0;for(let x=0;x<c.length;x++){let C=c[x],T=p[g+x];if(!T){w+=C.length;continue}for(let R=0;R<C.length;R++){let O=T[f+R];if(!O){w++;continue}O.value=C[R]??"",O.dispatchEvent(new Event("input",{bubbles:!0})),O.dispatchEvent(new Event("blur",{bubbles:!0})),v++}}let _=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${v} value${v===1?"":"s"} (${_}${w>0?`, ${w} overflow`:""}).`})},!0)}function Ye(s,e){let l=e.indicators??[];if(l.length===0)return;let n=l.filter(i=>i.numerator&&i.denominator).map(i=>({id:i.id,factor:i.indicatorType?.factor??1,numExpr:i.numerator,denExpr:i.denominator}));if(n.length===0)return;let a=Array.from(s.querySelectorAll("input[indicatorid]")),t=new Map;for(let i of Array.from(s.querySelectorAll('input[name$="-val"]')))t.set(i.getAttribute("name")??"",i);let o=i=>{let u=0;for(let[p,g]of t){if(!p.startsWith(`${i}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},d=i=>i.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,g)=>{if(g){let f=t.get(`${p}-${g}-val`),v=parseFloat(f?.value??"");return Number.isFinite(v)?String(v):"0"}return String(o(p))}),r=i=>{if(!/^[\s\d+\-*/().eE]+$/.test(i))return NaN;try{return Function(`"use strict";return (${i})`)()}catch{return NaN}},c=()=>{for(let i of n){let u=r(d(i.numExpr)),p=r(d(i.denExpr)),g=a.find(v=>v.getAttribute("indicatorid")===i.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){g.value="";continue}let f=u/p*i.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};s.addEventListener("input",i=>{let u=i.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function Ke(s,e){let l={};for(let n of e.dataSetElements??[])n.dataElement&&(l[n.dataElement.id]=n.dataElement);for(let n of Array.from(s.querySelectorAll('input[name$="-val"]'))){let a=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!a)continue;let t=l[a[1]],o=t?.formName??t?.name??a[1],d=t?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===a[2]),r=d?.name??d?.displayName??a[2];n.hasAttribute("aria-label")||n.setAttribute("aria-label",r===a[2]?`${o}`:`${o}, ${r}`),n.getAttribute("data-compulsory")==="1"&&n.setAttribute("aria-required","true")}}function Xe(s,e){let l=e.compulsoryDataElementOperands??[],n=new Set;for(let a of l){let t=a.dimensionItem;if(!t)continue;let o=t.split(".");o.length===2&&n.add(`${o[0]}:${o[1]}`)}if(n.size!==0)for(let a of Array.from(s.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");t&&n.has(`${t[1]}:${t[2]}`)&&a.setAttribute("data-compulsory","1")}}function Ze(s,e,l){let n={};for(let t of e.dataSetElements??[])t.dataElement&&(n[t.dataElement.id]=t.dataElement);let a=t=>{let o=t.getAttribute("name")??t.id??"",d=/^(.+)-(.+)-val$/.exec(o);if(!d)return null;let r=d[1],c=d[2],i=n[r],u=i?.categoryCombo,p=u?.categoryOptionCombos?.find(C=>C.id===c),g=[],f=p?.name??p?.displayName??c,v=f.split(/,\s*/).filter(Boolean),w=u?.categories??[];v.forEach((C,T)=>{g.push({category:w[T]?.name??w[T]?.displayName??"",option:C})});let _=t.style.outline||"",x=_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?"saving":_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?"queued":_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?"saved":_.includes("rgb(169, 50, 50)")||_.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:c,deName:i?.name??r,deFormName:i?.formName,valueType:i?.valueType??"TEXT",optionSetId:i?.optionSet?.id,cocName:f,categoryBreakdown:g,value:t.value,saveState:x,inputName:o,compulsory:t.getAttribute("data-compulsory")==="1"}};s.addEventListener("focusin",t=>{let o=t.target;if(o&&o.tagName==="INPUT"){let d=a(o);d&&l(d)}},!0),s.addEventListener("input",t=>{let o=t.target;if(o&&o.tagName==="INPUT"){let d=a(o);d&&l(d)}},!0)}function et(s,e,l){if(!s)return;let n=globalThis,a=n.dhis2?.de?.dataElements??{},t=n.dhis2?.de?.categoryOptionCombos??{},o=Array.from(s.querySelectorAll('input[name$="-val"]')),d=[];for(let r of o){r.style.outline="";let c=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!c)continue;let i=c[1],u=c[2],p=a[i],g=p?.valueType??"TEXT",f=r.value.trim();if(f===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",d.push({deId:i,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??i,cocName:t[u]?.name??u,inputName:r.name}));continue}let v=tt(f,g);v&&(r.style.outline="2px solid #c0392b",d.push({deId:i,cocId:u,valueType:g,value:f,problem:v,deName:p?.name??i,cocName:t[u]?.name??u,inputName:r.name}))}l(d),d.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${o.length} cells OK.`}):e({kind:"error",message:`Validation found ${d.length} issue${d.length===1?"":"s"}. See the Issues panel.`})}function tt(s,e){let l=Number(s),n=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!n)return"must be an integer";break;case"INTEGER_POSITIVE":if(!n||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!n||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!n||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(s.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(s.toLowerCase()))return"must be yes";break;case"URL":try{new URL(s)}catch{return"must be a valid URL"}break;default:break}return null}function ee(s,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";s.style.outline=`2px solid ${l}`,s.style.transition="outline 150ms",e==="queued"?s.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):s.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{s.style.outline.includes("#1a8754")&&(s.style.outline="1px solid #b7dcc7")},1200)}async function rt(s,e,l,n,a){if(!e||!l||!n)return;let t;try{t=(await a.readAggregateValues(n,l,2e3)).dataValues??[]}catch{return}for(let o of t){let d=o.dataElement,r=o.categoryOptionCombo,c=o.value;if(!d||!r||c==null)continue;let i=s.querySelector(`input[name="${d}-${r}-val"]`);i&&(i.value=c)}}function be(s){return new Promise((e,l)=>{let n=document.createElement("script");n.src=s,n.async=!1,n.setAttribute("data-der-custom-form",s),n.onload=()=>e(),n.onerror=()=>l(new Error(`failed to load ${s}`)),document.head.appendChild(n)})}function ye(s){if(document.querySelector(`link[data-der-custom-form="${s}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=s,e.setAttribute("data-der-custom-form",s),document.head.appendChild(e)}function ue(s){return!s||/^https?:\/\//i.test(s)||s.startsWith("/legacy-custom-forms/")||s.startsWith("/")?s:`/legacy-custom-forms/${s.replace(/^(?:\.{1,2}\/)+/,"")}`}async function at(s,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let t=a.getAttribute("href")??"";t&&ye(ue(t))}else{let t=document.createElement("style");t.textContent=a.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}a.remove()}let n=[];for(let a of Array.from(l.querySelectorAll("script"))){let t=a.getAttribute("src");t?n.push({src:ue(t)}):n.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(l.body.querySelectorAll("*"))){if(a.removeAttribute("style"),a.tagName==="INPUT"){let t=a.getAttribute("id")??"";t.endsWith("-val")&&a.getAttribute("name")!==t&&a.setAttribute("name",t)}if(a.tagName==="TH"){let t=(a.textContent??"").trim();(t==="Reporting item"||t==="Reported count")&&(a.textContent=t==="Reporting item"?"Data elements":"Value")}}for(let a of Array.from(l.body.childNodes))s.appendChild(document.adoptNode(a));for(let a of n)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await be(a.src);else if(a.code){let t=document.createElement("script");t.textContent=a.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var te={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},pe={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ot={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},nt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function st(s,e,l){let n={...te},a=dt(s);if(a.length===0)return m("input",{value:e,onChange:p=>l(p.target.value),placeholder:s?`DHIS2 ${s} period id`:"e.g. 202611",style:n});let t=[...a];if(e&&!t.some(p=>p.id===e)){let p=it(s,e)??e;t.unshift({id:e,label:p})}let o=a[0]?.id??null,d=t.findIndex(p=>p.id===e),r=d===-1||d<t.length-1||!!s,c=e!==""&&(d>0||e!==o),i=()=>{if(!s)return;let p=d>=0&&d<t.length-1?t[d+1]?.id??"":ge(s,e||o||"",-1);p&&l(p)},u=()=>{if(!s||!e||e===o)return;let p=d>0?t[d-1]?.id??"":ge(s,e,1);p&&l(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:i,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>l(p.target.value),style:n,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function ge(s,e,l){let n=a=>String(a).padStart(2,"0");switch(s){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,o=Number(e.slice(6,8)),d=new Date(a,t,o+l);return`${d.getFullYear()}${n(d.getMonth()+1)}${n(d.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let t=Number(a[1]),o=Number(a[2])+l;return o<1?(t-=1,o=re(t)):o>re(t)&&(t+=1,o=1),`${t}W${o}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,o=a*12+t+l;return`${Math.floor(o/12)}${n((o%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let t=Number(a[1]),o=Number(a[2])+l;return o<1?(t-=1,o=6):o>6&&(t+=1,o=1),`${t}${n(o)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),o=Number(a[2])+l;return o<1?(t-=1,o=4):o>4&&(t+=1,o=1),`${t}Q${o}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),o=Number(a[2])+l;return o<1?(t-=1,o=2):o>2&&(t+=1,o=1),`${t}S${o}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function it(s,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);return n?`${n[1]} W${String(n[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let n=Number(e.slice(4,6))-1;return`${l[n]??""} ${e.slice(0,4)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return null;let a=(Number(n[2])-1)*2;return`${l[a]}\u2013${l[a+1]} ${n[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);return n?`${n[1]} ${n[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function dt(s){let e=new Date,l=e.getFullYear(),n=e.getMonth(),a=o=>String(o).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":{let o=[];for(let d=0;d<30;d++){let r=new Date(e);r.setDate(r.getDate()-d);let c=`${r.getFullYear()}${a(r.getMonth()+1)}${a(r.getDate())}`,i=`${r.getFullYear()}-${a(r.getMonth()+1)}-${a(r.getDate())}`;o.push({id:c,label:i})}return o}case"Weekly":{let o=[],d=he(e),r=d.year,c=d.week;for(let i=0;i<12;i++)o.push({id:`${r}W${c}`,label:`${r} W${a(c)}`}),c-=1,c<1&&(r-=1,c=re(r));return o}case"Monthly":{let o=[];for(let d=0;d<24;d++){let r=l,c=n,i=r*12+c-d,u=Math.floor(i/12),p=(i%12+12)%12;o.push({id:`${u}${a(p+1)}`,label:`${t[p]} ${u}`})}return o}case"BiMonthly":{let o=[],d=Math.floor(n/2)+1,r=l,c=d;for(let i=0;i<12;i++){let u=(c-1)*2;o.push({id:`${r}${a(c)}B`,label:`${t[u]}\u2013${t[u+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return o}case"Quarterly":{let o=[],d=Math.floor(n/3)+1,r=l,c=d;for(let i=0;i<8;i++)o.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return o}case"SixMonthly":{let o=[],d=n<6?1:2,r=l,c=d;for(let i=0;i<6;i++)o.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return o}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let o=[];for(let d=0;d<10;d++){let r=l-d;o.push({id:String(r),label:String(r)})}return o}default:return[]}}function he(s){let e=new Date(s.getFullYear(),s.getMonth(),s.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let n=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-n.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function re(s){return he(new Date(s,11,28)).week}var lt=`
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
  background: #fff !important;
  color: var(--der-ink-700, #2a3447);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  border-bottom: 2px solid var(--der-border, #d8dee8) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable .dataElementCell {
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
`;export{Oe as default};
