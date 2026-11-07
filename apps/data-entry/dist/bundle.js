/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as de,useState as N}from"react";import{useAuth as Ae,useOrgUnitBinding as $e,useOnlineStatus as Ie,useDerApi as je,ScreenCard as De}from"@der/app-sdk";import{Fragment as fe,jsx as m,jsxs as h}from"react/jsx-runtime";function Oe(){let s=Ae(),e=$e(),l=Ie(),o=je(),[n,t]=N("custom"),[a,d]=N([]),[r,c]=N(""),[i,u]=N(""),[p,g]=N(""),[f,v]=N(""),[w,_]=N({kind:"idle"}),[x,C]=N(null),T=de(null),[M,O]=N({}),F=de({}),[ve,V]=N([]),[R,z]=N(null),[Q,ae]=N(!1),[ne,xe]=N(0),[U,we]=N([]),[J,W]=N(!1),[_e,Ee]=N(null),[oe,se]=N(!0),[ke,G]=N(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let S=y.target;S&&(S.tagName==="INPUT"||S.tagName==="TEXTAREA")||(y.preventDefault(),G(k=>!k))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[q,Ne]=N(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),I(()=>{let b=!1;return(async()=>{try{let y=await o.listDataSets();if(b)return;let S=(y.dataSets??[]).map(k=>({id:k.id,label:k.displayName??k.name??k.id,periodType:k.periodType,formType:k.formType})).sort((k,j)=>k.label.localeCompare(j.label));d(S)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(r.trim()===""){C(null),V([]),O({}),F.current={};return}let b=!1;return(async()=>{try{let y=await o.getDataSetMeta(r.trim());if(b)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),t(S?"custom":"structured");try{let k=await o.getDataSetFormMetadata(r.trim());if(b)return;let j=await le(k,o);if(b)return;let B=(j.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));V(B);let H={};for(let A of B)A.options[0]&&(H[A.id]=A.options[0].id);O(H),F.current=H}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[r]),I(()=>{if(n!=="custom"||!x?.hasCustomForm||x.formType==="CUSTOM"&&!x.formId)return;let b=T.current;if(!b)return;let y=!1;return(async()=>{_({kind:"submitting"});try{let S=await o.getDataSetFormMetadata(r.trim());if(y)return;let k=await le(S,o);if(y)return;let j="";if(x.formType==="CUSTOM"&&x.formId){try{j=(await o.getDataEntryFormHtml(x.formId)).htmlCode??""}catch(E){j="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",E)}j.trim()||(j=ce(k))}else x.formType==="SECTION"&&(j=ce(k));if(y)return;let B=await o.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(y)return;let H=(k.categoryCombo?.categories??[]).filter(E=>(E.categoryOptions?.length??0)>1).map(E=>({id:E.id,name:E.name??E.id,options:(E.categoryOptions??[]).map(L=>({id:L.id,name:L.name??L.id}))}));V(H);let A={};for(let E of H)E.options[0]&&(A[E.id]=E.options[0].id);O(A),F.current=A,b.replaceChildren();for(let[E,L]of[["selectedDataSetId",r.trim()],["selectedPeriodId",i.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let D=document.createElement("input");D.type="hidden",D.id=E,D.value=L,b.appendChild(D)}for(let[E,L]of Object.entries(A)){let D=document.createElement("input");D.type="hidden",D.id=`category-${E}`,D.value=L,D.setAttribute("data-der-category",E),b.appendChild(D)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),qe({dataSetId:r.trim(),periodId:i.trim(),orgUnitId:e.orgUnitUid??"",meta:k,aocSelections:A,validationRules:B.validationRules??[]});for(let E of Re)ye(E);for(let E of Me)document.querySelector(`script[data-der-custom-form="${E}"]`)||await be(E);Pe(),await at($,j),await rt($,r.trim(),i.trim(),e.orgUnitUid??"",o),Fe($,()=>r.trim(),()=>i.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),o),ze($),Ge($,_),Ze($,k,Ee),Xe($,k),Ke($,k),Ye($,k),xe(E=>E+1),_({kind:"idle"})}catch(S){_({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[n,x,r,i,e.orgUnitUid]);let Se=e.bound&&r.trim()!==""&&i.trim()!==""&&p.trim()!==""&&f.trim()!==""&&w.kind!=="submitting";async function Ce(b){b.preventDefault(),_({kind:"submitting"});try{await o.submitAggregate({dataSet:r,period:i,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),_({kind:"ok",message:`Submitted ${p}=${f} for ${i}.`}),g(""),v("")}catch(y){_({kind:"error",message:y.message??"Submission failed"})}}let ie=i.trim()!=="",Y=r.trim()!=="",P=Y&&ie&&e.bound;I(()=>{if(!P){z(null);return}let b=!1;return(async()=>{try{let y=await o.getCompletion(r.trim(),e.orgUnitUid??"",i.trim());if(b)return;z({completed:!!y.completed,completedAt:y.completedAt})}catch{b||z({completed:!1})}})(),()=>{b=!0}},[r,i,e.orgUnitUid,P]);async function Te(){if(!P||Q)return;let b=!R?.completed;if(b){let y=T.current;if(y){let S=[];for(let k of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))k.value.trim()===""&&S.push(k);if(S.length>0){_({kind:"error",message:`Can't mark complete \u2014 ${S.length} compulsory value${S.length===1?"":"s"} still missing. Run Validate to jump to them.`}),S[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ae(!0);try{let y=await o.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:i.trim(),completed:b});z({completed:!!y.completed,completedAt:y.completedAt}),_({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){_({kind:"error",message:`Completion failed: ${y.message}`})}finally{ae(!1)}}return h(De,{dataTest:"der-aggregate-entry",children:[m("style",{children:lt}),h("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[h("div",{className:"der-de-toolbar__head",children:[m("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),m("span",{className:"der-de-toolbar__status "+(l.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":l.isOnline?"Online":"Offline",children:l.isOnline?"online":`offline \xB7 ${l.queuedCount} queued`}),m("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]}),h("div",{className:"der-de-toolbar__picks",children:[h("label",{className:"der-de-toolbar__field",children:[m("span",{className:"der-de-toolbar__field-label",children:"Data set"}),h("select",{className:"der-de-toolbar__select",value:r,onChange:b=>{c(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),a.map(b=>m("option",{value:b.id,children:b.label},b.id))]})]}),ve.map(b=>h("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-toolbar__field-label",children:b.name}),h("select",{className:"der-de-toolbar__select",value:M[b.id]??"",onChange:y=>{let S={...M,[b.id]:y.target.value};O(S),F.current=S,He(T.current,S)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),b.options.map(y=>m("option",{value:y.id,children:y.name},y.id))]})]},b.id)),h("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[h("span",{className:"der-de-toolbar__field-label",children:["Period",x?.periodType?` \xB7 ${x.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:st(x?.periodType,i,u)})]})]})]}),w.kind==="ok"&&m("div",{style:nt,"data-test":"de-ok",children:w.message}),w.kind==="error"&&m("div",{style:ot,"data-test":"de-err",children:w.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!Y&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&Y&&!ie&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),P&&n==="structured"&&h("form",{onSubmit:Ce,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:b=>g(b.target.value),style:te})]}),h("label",{children:["Value",m("input",{value:f,onChange:b=>v(b.target.value),inputMode:"decimal",style:te})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!Se,style:me,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),P&&n==="custom"&&m("div",{className:`der-de-form-card der-de-density-${q}`,children:h("div",{className:"der-de-form-split",children:[m(Be,{targetRef:T,formVersion:ne}),m("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),P&&n==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Ve,{root:T,formVersion:ne}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Ne(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),R&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:R.completed?`Complete${R.completedAt?" \xB7 "+new Date(R.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{et(T.current,_,b=>{we(b),W(b.length>0)})},style:pe,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!J&&h("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),!oe&&m("button",{type:"button",onClick:()=>se(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:()=>G(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Te,disabled:Q,style:R?.completed?pe:me,"data-test":"de-complete-btn",children:Q?"Saving\u2026":R?.completed?"Reopen":"Mark complete"})]}),m(We,{open:oe&&!J,details:_e,onClose:()=>se(!1)}),m(Je,{open:ke,onClose:()=>G(!1)}),m(Qe,{open:J,issues:U,onClose:()=>W(!1),onPick:b=>{let y=T.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select())}})]})}var Me=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Re=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],K=null,X=null,Z=null;async function le(s,e){K||(K=e.listAllDataElements().then(d=>new Map(d.map(r=>[r.id,r])))),X||(X=e.listAllCategoryCombos().then(d=>new Map(d.map(r=>[r.id,r])))),Z||(Z=e.listAllCategoryOptionCombos().then(d=>{let r=new Map;for(let c of d){let i=c.categoryCombo?.id;if(!i)continue;let u=r.get(i);u?u.push(c):r.set(i,[c])}return r}));let[l,o,n]=await Promise.all([K,X,Z]),t=d=>{if(!d?.id)return;let r=o.get(d.id),c=n.get(d.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:i.categoryOptions??[]})),categories:(r.categories??[]).map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:(i.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:d},a=d=>{let r=l.get(d.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:d};return{...s,categoryCombo:t(s.categoryCombo)??s.categoryCombo,dataSetElements:(s.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?a(d.dataElement):void 0})),sections:(s.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(r=>a(r))}))}}function ce(s){let e={};for(let d of s.dataSetElements??[])d.dataElement&&(e[d.dataElement.id]=d.dataElement);let l={};for(let d of s.indicators??[])l[d.id]=d;let o=(s.sections??[]).slice().sort((d,r)=>(d.sortOrder??0)-(r.sortOrder??0));if(!o.some(d=>(d.dataElements?.length??0)>0)){let d=(s.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);o=[{id:s.id,name:s.displayName??s.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let t=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let d of o){let r=new Set;for(let i of d.greyedFields??[])i.dataElement?.id&&i.categoryOptionCombo?.id&&r.add(`${i.dataElement.id}:${i.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${t(d.name??"")}</h3>`);let c=new Map;for(let i of d.dataElements??[]){let u=e[i.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,g=c.get(p);g||(g={cc:u.categoryCombo,des:[]},c.set(p,g)),g.des.push(u)}for(let i of c.values()){let u=i.cc.categoryOptionCombos??[],p=i.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let g=Le(p,u);if(a.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){a.push("<tr>"),f===0&&a.push(`<th class="dataElementCell" rowspan="${g.length}">`+t(i.cc.name??"Data element")+"</th>");for(let v of g[f]??[])a.push(`<th colspan="${v.span}">${t(v.label)}</th>`);a.push("</tr>")}else{a.push("<tr>"),a.push(`<th class="dataElementCell">${t(i.cc.name??"Data element")}</th>`);for(let f of u)a.push(`<th>${t(f.name??"")}</th>`);a.push("</tr>")}a.push("</thead><tbody>");for(let f of i.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let v of u){let w=`${f.id}-${v.id}-val`;r.has(`${f.id}:${v.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${t(w)}" name="${t(w)}" dataelementid="${t(f.id)}" optioncomboid="${t(v.id)}"></td>`)}a.push("</tr>")}for(let f of d.indicators??[]){let v=l[f.id];v&&(a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),a.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),a.push("</tr>"))}a.push("</tbody></table></div>")}}return a.join(`
`)}function Le(s,e){if(s.length===0||e.length===0)return[];let l=new Map;for(let a of s)for(let d of a.categoryOptions??[])l.set(d.id,{catId:a.id,name:d.name??d.id});let o=s.length,n=e.map(a=>{let d=new Array(o).fill("");for(let r of a.categoryOptions??[]){let c=l.get(r.id);if(!c)continue;let i=s.findIndex(u=>u.id===c.catId);i>=0&&(d[i]=c.name)}return d});for(let a of n)if(a.some(d=>d===""))return[];let t=[];for(let a=0;a<o;a++){let d=[];for(let r=0;r<n.length;){let c=n[r],i=r+1;for(;i<n.length;){let u=n[i],p=!0;for(let g=0;g<=a;g++)if(c[g]!==u[g]){p=!1;break}if(!p)break;i++}d.push({label:c[a]??"",span:i-r}),r=i}t.push(d)}return t}function qe(s){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let o=l.de;o.currentDataSetId=s.dataSetId,o.currentOrganisationUnitId=s.orgUnitId,o.currentPeriodId=s.periodId,o.currentCategorySelections={...s.aocSelections??{}};let n=s.meta??{},t={},a={};if(n.categoryCombo){a[n.categoryCombo.id]=n.categoryCombo;for(let u of n.categoryCombo.categories??[])t[u.id]=u}o.categories=t,o.categoryCombos=a;let d={},r={};for(let u of n.dataSetElements??[]){let p=u.dataElement;p&&(d[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}o.dataElements=d,o.optionSets=r;let c={};for(let u of n.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};o.indicatorFormulas=c;let i={};for(let u of s.validationRules??[])i[u.id]=u;o.validationRules=i,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[n.id]:{id:n.id,name:n.name??n.displayName??"",periodType:n.periodType,categoryCombo:n.categoryCombo?.id,periodId:s.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Pe(){let s=globalThis;if(s.$&&typeof s.$.ajaxSetup=="function"&&s.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),s.dhis2?.period&&s.$?.calendars?.instance){let e=s.dhis2.period;e.format="yyyy-mm-dd",e.calendar=s.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function He(s,e){if(!s)return;for(let[o,n]of Object.entries(e)){let t=s.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),s.appendChild(t)),t.value=n}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function Fe(s,e,l,o,n,t){let a=i=>{let u=/^(.+)-(.+)-val$/.exec(i);return u?{de:u[1],coc:u[2]}:null},d=new WeakMap,r=s.querySelectorAll('input[name$="-val"]');for(let i of Array.from(r))d.set(i,i.value);let c=async i=>{let u=i.target;if(!u||u.tagName!=="INPUT")return;let p=u.getAttribute("name")??"",g=a(p);if(!g)return;let f=e(),v=l(),w=o();if(!f||!v||!w)return;let _=u.value;if(d.get(u)!==_){ee(u,"saving");try{let x=await t.submitAggregate({dataSet:f,period:v,orgUnit:w,attributeOptionComboSelections:n(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:_}]});d.set(u,_),ee(u,x?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ee(u,"error")}}};s.addEventListener("blur",i=>{c(i)},!0)}function ze(s){s.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let o=l.target;if(!(o instanceof HTMLInputElement))return;let n=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;l.preventDefault();let a=t[2],d=Array.from(s.querySelectorAll(`input[name$="-${a}-val"]`)),r=d.indexOf(o);if(r===-1)return;let c=d[r+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Ue(s){let e=Array.from(s.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),o=[],n=(t,a)=>{for(let d of l)if(d!==a&&t.contains(d))return!0;return!1};return e.forEach((t,a)=>{let d=t.id||`der-de-section-${a}`;t.id=d;let r=null,c=t.parentElement,i=null;for(;c&&c!==s&&!n(c,t);)i=c,c=c.parentElement;if(i&&i.children.length>1&&i!==s)r=i,r.classList.add("der-de-section-slot"),r.dataset.sectionId=d;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=d;let u=e[a+1]??null,p=[],g=t;for(;g&&g!==u;){let f=g.nextSibling;p.push(g),g=f}t.parentNode?.insertBefore(r,t);for(let f of p)r.appendChild(f)}o.push({id:d,label:(t.textContent??"").trim(),slot:r})}),o}function Be({targetRef:s,formVersion:e}){let[l,o]=N([]),[n,t]=N(""),[a,d]=N({});return I(()=>{let r=s.current;if(!r)return;let c=Ue(r);o(c),t(c[0]?.id??"")},[s,e]),I(()=>{if(l.length===0)return;let r=()=>{let u={};for(let p of l){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(v=>v.value.trim()!=="").length;u[p.id]={filled:f,total:g.length}}d(u)};r();let c=s.current;if(!c)return;let i=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&r()};return c.addEventListener("input",i,!0),()=>{c.removeEventListener("input",i,!0)}},[s,l]),I(()=>{if(!s.current||l.length===0)return;for(let i of l)i.slot.style.display=i.id===n?"":"none";let c=l.find(i=>i.id===n);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[s,l,n]),l.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:l.map(r=>{let c=a[r.id],i=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return m("li",{children:h("button",{type:"button",className:"der-de-section-nav__item"+(n===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(r.id),children:[m("span",{className:"der-de-section-nav__label",children:r.label}),c&&c.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${i}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:i==="done"?"\u2713":`${c.filled}/${c.total}`})]})},r.id)})})]})}function Ve({root:s,formVersion:e}){let[l,o]=N({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let a=()=>{let r=s.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),i=0,u=0,p=0,g=0,f=0;for(let v of c){v.value.trim()!==""&&i++;let w=v.style.outline||"";w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?u++:w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?g++:w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?p++:(w.includes("rgb(169, 50, 50)")||w.includes("#a93232"))&&f++}o({total:c.length,filled:i,saving:u,saved:p,queued:g,error:f})};a();let d=window.setInterval(a,800);return()=>window.clearInterval(d)},[s,e]),l.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let n=[];n.push(`${l.filled} of ${l.total} filled`),l.saving>0&&n.push(`${l.saving} saving`),l.queued>0&&n.push(`${l.queued} queued`),l.error>0&&n.push(`${l.error} error`);let t=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:n.join(" \xB7 ")})}function Qe({open:s,issues:e,onClose:l,onPick:o}){return I(()=>{if(!s)return;let n=t=>{t.key==="Escape"&&l()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[s,l]),!s||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(n=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>o(n),children:[m("span",{className:"der-de-issues-drawer__de",children:n.deName}),m("span",{className:"der-de-issues-drawer__coc",children:n.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:n.value}),m("span",{children:n.problem})]})]})},`${n.deId}-${n.cocId}`))})]})}function Je({open:s,onClose:e}){return I(()=>{if(!s)return;let o=n=>{n.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[s,e]),s?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:h("div",{className:"der-de-shortcuts",children:[h("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,n])=>h("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:o})}),m("dd",{children:n})]},o))})]})}):null}function We({open:s,details:e,onClose:l}){if(!s)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let o={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},n={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${n[e.saveState]}`,children:o[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(fe,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(fe,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,a)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},a))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Ge(s,e){s.addEventListener("paste",l=>{let o=l.target;if(!o||o.tagName!=="INPUT")return;let n=o.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(n))return;let a=l.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(a),r=/\t/.test(a);if(!d&&!r)return;let c=a.split(/\r?\n/).filter((x,C,T)=>!(C===T.length-1&&x==="")).map(x=>x.split("	").map(C=>C.trim()));if(c.length===0)return;l.preventDefault();let i=o.closest("[data-section-id]")??s,p=Array.from(i.querySelectorAll("tbody tr")).map(x=>Array.from(x.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let x=0;x<p.length;x++){let C=p[x].indexOf(o);if(C!==-1){g=x,f=C;break}}if(g===-1)return;let v=0,w=0;for(let x=0;x<c.length;x++){let C=c[x],T=p[g+x];if(!T){w+=C.length;continue}for(let M=0;M<C.length;M++){let O=T[f+M];if(!O){w++;continue}O.value=C[M]??"",O.dispatchEvent(new Event("input",{bubbles:!0})),O.dispatchEvent(new Event("blur",{bubbles:!0})),v++}}let _=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${v} value${v===1?"":"s"} (${_}${w>0?`, ${w} overflow`:""}).`})},!0)}function Ye(s,e){let l=e.indicators??[];if(l.length===0)return;let o=l.filter(i=>i.numerator&&i.denominator).map(i=>({id:i.id,factor:i.indicatorType?.factor??1,numExpr:i.numerator,denExpr:i.denominator}));if(o.length===0)return;let n=Array.from(s.querySelectorAll("input[indicatorid]")),t=new Map;for(let i of Array.from(s.querySelectorAll('input[name$="-val"]')))t.set(i.getAttribute("name")??"",i);let a=i=>{let u=0;for(let[p,g]of t){if(!p.startsWith(`${i}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},d=i=>i.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,g)=>{if(g){let f=t.get(`${p}-${g}-val`),v=parseFloat(f?.value??"");return Number.isFinite(v)?String(v):"0"}return String(a(p))}),r=i=>{if(!/^[\s\d+\-*/().eE]+$/.test(i))return NaN;try{return Function(`"use strict";return (${i})`)()}catch{return NaN}},c=()=>{for(let i of o){let u=r(d(i.numExpr)),p=r(d(i.denExpr)),g=n.find(v=>v.getAttribute("indicatorid")===i.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){g.value="";continue}let f=u/p*i.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};s.addEventListener("input",i=>{let u=i.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function Ke(s,e){let l={};for(let o of e.dataSetElements??[])o.dataElement&&(l[o.dataElement.id]=o.dataElement);for(let o of Array.from(s.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!n)continue;let t=l[n[1]],a=t?.formName??t?.name??n[1],d=t?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===n[2]),r=d?.name??d?.displayName??n[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",r===n[2]?`${a}`:`${a}, ${r}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function Xe(s,e){let l=e.compulsoryDataElementOperands??[],o=new Set;for(let n of l){let t=n.dimensionItem;if(!t)continue;let a=t.split(".");a.length===2&&o.add(`${a[0]}:${a[1]}`)}if(o.size!==0)for(let n of Array.from(s.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");t&&o.has(`${t[1]}:${t[2]}`)&&n.setAttribute("data-compulsory","1")}}function Ze(s,e,l){let o={};for(let t of e.dataSetElements??[])t.dataElement&&(o[t.dataElement.id]=t.dataElement);let n=t=>{let a=t.getAttribute("name")??t.id??"",d=/^(.+)-(.+)-val$/.exec(a);if(!d)return null;let r=d[1],c=d[2],i=o[r],u=i?.categoryCombo,p=u?.categoryOptionCombos?.find(C=>C.id===c),g=[],f=p?.name??p?.displayName??c,v=f.split(/,\s*/).filter(Boolean),w=u?.categories??[];v.forEach((C,T)=>{g.push({category:w[T]?.name??w[T]?.displayName??"",option:C})});let _=t.style.outline||"",x=_.includes("rgb(185, 134, 10)")||_.includes("#b9860a")?"saving":_.includes("rgb(206, 123, 0)")||_.includes("#ce7b00")?"queued":_.includes("rgb(26, 135, 84)")||_.includes("#1a8754")||_.includes("rgb(183, 220, 199)")||_.includes("#b7dcc7")?"saved":_.includes("rgb(169, 50, 50)")||_.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:c,deName:i?.name??r,deFormName:i?.formName,valueType:i?.valueType??"TEXT",optionSetId:i?.optionSet?.id,cocName:f,categoryBreakdown:g,value:t.value,saveState:x,inputName:a,compulsory:t.getAttribute("data-compulsory")==="1"}};s.addEventListener("focusin",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let d=n(a);d&&l(d)}},!0),s.addEventListener("input",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let d=n(a);d&&l(d)}},!0)}function et(s,e,l){if(!s)return;let o=globalThis,n=o.dhis2?.de?.dataElements??{},t=o.dhis2?.de?.categoryOptionCombos??{},a=Array.from(s.querySelectorAll('input[name$="-val"]')),d=[];for(let r of a){r.style.outline="";let c=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!c)continue;let i=c[1],u=c[2],p=n[i],g=p?.valueType??"TEXT",f=r.value.trim();if(f===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",d.push({deId:i,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??i,cocName:t[u]?.name??u,inputName:r.name}));continue}let v=tt(f,g);v&&(r.style.outline="2px solid #c0392b",d.push({deId:i,cocId:u,valueType:g,value:f,problem:v,deName:p?.name??i,cocName:t[u]?.name??u,inputName:r.name}))}l(d),d.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${d.length} issue${d.length===1?"":"s"}. See the Issues panel.`})}function tt(s,e){let l=Number(s),o=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(s.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(s.toLowerCase()))return"must be yes";break;case"URL":try{new URL(s)}catch{return"must be a valid URL"}break;default:break}return null}function ee(s,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";s.style.outline=`2px solid ${l}`,s.style.transition="outline 150ms",e==="queued"?s.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):s.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{s.style.outline.includes("#1a8754")&&(s.style.outline="1px solid #b7dcc7")},1200)}async function rt(s,e,l,o,n){if(!e||!l||!o)return;let t;try{t=(await n.readAggregateValues(o,l,2e3)).dataValues??[]}catch{return}for(let a of t){let d=a.dataElement,r=a.categoryOptionCombo,c=a.value;if(!d||!r||c==null)continue;let i=s.querySelector(`input[name="${d}-${r}-val"]`);i&&(i.value=c)}}function be(s){return new Promise((e,l)=>{let o=document.createElement("script");o.src=s,o.async=!1,o.setAttribute("data-der-custom-form",s),o.onload=()=>e(),o.onerror=()=>l(new Error(`failed to load ${s}`)),document.head.appendChild(o)})}function ye(s){if(document.querySelector(`link[data-der-custom-form="${s}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=s,e.setAttribute("data-der-custom-form",s),document.head.appendChild(e)}function ue(s){return!s||/^https?:\/\//i.test(s)||s.startsWith("/legacy-custom-forms/")||s.startsWith("/")?s:`/legacy-custom-forms/${s.replace(/^(?:\.{1,2}\/)+/,"")}`}async function at(s,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let n of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(n.tagName==="LINK"){let t=n.getAttribute("href")??"";t&&ye(ue(t))}else{let t=document.createElement("style");t.textContent=n.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}n.remove()}let o=[];for(let n of Array.from(l.querySelectorAll("script"))){let t=n.getAttribute("src");t?o.push({src:ue(t)}):o.push({code:n.textContent??""}),n.remove()}for(let n of Array.from(l.body.querySelectorAll("*")))if(n.removeAttribute("style"),n.tagName==="INPUT"){let t=n.getAttribute("id")??"";t.endsWith("-val")&&n.getAttribute("name")!==t&&n.setAttribute("name",t)}for(let n of Array.from(l.body.childNodes))s.appendChild(document.adoptNode(n));for(let n of o)if(n.src)document.querySelector(`script[data-der-custom-form="${n.src}"]`)||await be(n.src);else if(n.code){let t=document.createElement("script");t.textContent=n.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var te={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},pe={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},nt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},ot={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function st(s,e,l){let o={...te},n=dt(s);if(n.length===0)return m("input",{value:e,onChange:p=>l(p.target.value),placeholder:s?`DHIS2 ${s} period id`:"e.g. 202611",style:o});let t=[...n];if(e&&!t.some(p=>p.id===e)){let p=it(s,e)??e;t.unshift({id:e,label:p})}let a=n[0]?.id??null,d=t.findIndex(p=>p.id===e),r=d===-1||d<t.length-1||!!s,c=e!==""&&(d>0||e!==a),i=()=>{if(!s)return;let p=d>=0&&d<t.length-1?t[d+1]?.id??"":ge(s,e||a||"",-1);p&&l(p)},u=()=>{if(!s||!e||e===a)return;let p=d>0?t[d-1]?.id??"":ge(s,e,1);p&&l(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:i,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>l(p.target.value),style:o,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function ge(s,e,l){let o=n=>String(n).padStart(2,"0");switch(s){case"Daily":{if(!/^\d{8}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=Number(e.slice(6,8)),d=new Date(n,t,a+l);return`${d.getFullYear()}${o(d.getMonth()+1)}${o(d.getDate())}`}case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+l;return a<1?(t-=1,a=re(t)):a>re(t)&&(t+=1,a=1),`${t}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=n*12+t+l;return`${Math.floor(a/12)}${o((a%12+12)%12+1)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+l;return a<1?(t-=1,a=6):a>6&&(t+=1,a=1),`${t}${o(a)}B`}case"Quarterly":{let n=/^(\d{4})Q(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+l;return a<1?(t-=1,a=4):a>4&&(t+=1,a=1),`${t}Q${a}`}case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+l;return a<1?(t-=1,a=2):a>2&&(t+=1,a=1),`${t}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function it(s,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${l[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let n=(Number(o[2])-1)*2;return`${l[n]}\u2013${l[n+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function dt(s){let e=new Date,l=e.getFullYear(),o=e.getMonth(),n=a=>String(a).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(s){case"Daily":{let a=[];for(let d=0;d<30;d++){let r=new Date(e);r.setDate(r.getDate()-d);let c=`${r.getFullYear()}${n(r.getMonth()+1)}${n(r.getDate())}`,i=`${r.getFullYear()}-${n(r.getMonth()+1)}-${n(r.getDate())}`;a.push({id:c,label:i})}return a}case"Weekly":{let a=[],d=he(e),r=d.year,c=d.week;for(let i=0;i<12;i++)a.push({id:`${r}W${c}`,label:`${r} W${n(c)}`}),c-=1,c<1&&(r-=1,c=re(r));return a}case"Monthly":{let a=[];for(let d=0;d<24;d++){let r=l,c=o,i=r*12+c-d,u=Math.floor(i/12),p=(i%12+12)%12;a.push({id:`${u}${n(p+1)}`,label:`${t[p]} ${u}`})}return a}case"BiMonthly":{let a=[],d=Math.floor(o/2)+1,r=l,c=d;for(let i=0;i<12;i++){let u=(c-1)*2;a.push({id:`${r}${n(c)}B`,label:`${t[u]}\u2013${t[u+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return a}case"Quarterly":{let a=[],d=Math.floor(o/3)+1,r=l,c=d;for(let i=0;i<8;i++)a.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return a}case"SixMonthly":{let a=[],d=o<6?1:2,r=l,c=d;for(let i=0;i<6;i++)a.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let d=0;d<10;d++){let r=l-d;a.push({id:String(r),label:String(r)})}return a}default:return[]}}function he(s){let e=new Date(s.getFullYear(),s.getMonth(),s.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let o=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function re(s){return he(new Date(s,11,28)).week}var lt=`
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
