/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as j,useRef as ie,useState as k}from"react";import{useAuth as Ce,useOrgUnitBinding as Te,useOnlineStatus as Ae,useDerApi as $e,ScreenCard as Ie,StatusPill as je}from"@der/app-sdk";import{Fragment as ge,jsx as m,jsxs as h}from"react/jsx-runtime";function De(){let o=Ce(),e=Te(),i=Ae(),d=$e(),[n,t]=k("custom"),[a,s]=k([]),[r,u]=k(""),[l,c]=k(""),[p,y]=k(""),[g,v]=k(""),[x,w]=k({kind:"idle"}),[S,D]=k(null),A=ie(null),[te,P]=k({}),F=ie({}),[he,B]=k([]),[R,H]=k(null),[V,re]=k(!1),[ae,ve]=k(0),[U,xe]=k([]),[Q,J]=k(!1),[we,_e]=k(null),[ne,oe]=k(!0),[M,Ee]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});j(()=>{try{window.localStorage.setItem("der-de-density",M)}catch{}},[M]),j(()=>{let f=!1;return(async()=>{try{let b=await d.listDataSets();if(f)return;let N=(b.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,$)=>E.label.localeCompare($.label));s(N)}catch{}})(),()=>{f=!0}},[]),j(()=>{if(r.trim()===""){D(null),B([]),P({}),F.current={};return}let f=!1;return(async()=>{try{let b=await d.getDataSetMeta(r.trim());if(f)return;let N=!!b.dataEntryForm&&b.formType==="CUSTOM"||b.formType==="SECTION";D({hasCustomForm:N,formId:b.dataEntryForm?.id,displayName:b.displayName??b.name,formType:b.formType,periodType:b.periodType}),t(N?"custom":"structured");try{let E=await d.getDataSetFormMetadata(r.trim());if(f)return;let $=await de(E,d);if(f)return;let z=($.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));B(z);let q={};for(let C of z)C.options[0]&&(q[C.id]=C.options[0].id);P(q),F.current=q}catch{}}catch{f||D(null)}})(),()=>{f=!0}},[r]),j(()=>{if(n!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let f=A.current;if(!f)return;let b=!1;return(async()=>{w({kind:"submitting"});try{let N=await d.getDataSetFormMetadata(r.trim());if(b)return;let E=await de(N,d);if(b)return;let $="";if(S.formType==="CUSTOM"&&S.formId){try{$=(await d.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(_){$="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",_)}$.trim()||($=le(E))}else S.formType==="SECTION"&&($=le(E));if(b)return;let z=await d.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(b)return;let q=(E.categoryCombo?.categories??[]).filter(_=>(_.categoryOptions?.length??0)>1).map(_=>({id:_.id,name:_.name??_.id,options:(_.categoryOptions??[]).map(O=>({id:O.id,name:O.name??O.id}))}));B(q);let C={};for(let _ of q)_.options[0]&&(C[_.id]=_.options[0].id);P(C),F.current=C,f.replaceChildren();for(let[_,O]of[["selectedDataSetId",r.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let I=document.createElement("input");I.type="hidden",I.id=_,I.value=O,f.appendChild(I)}for(let[_,O]of Object.entries(C)){let I=document.createElement("input");I.type="hidden",I.id=`category-${_}`,I.value=O,I.setAttribute("data-der-category",_),f.appendChild(I)}let T=document.createElement("div");T.id="contentDiv",f.appendChild(T),Le({dataSetId:r.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:C,validationRules:z.validationRules??[]});for(let _ of Oe)ye(_);for(let _ of Re)document.querySelector(`script[data-der-custom-form="${_}"]`)||await fe(_);qe(),await Ze(T,$),await Ke(T,r.trim(),l.trim(),e.orgUnitUid??"",d),Pe(T,()=>r.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...F.current}),d),He(T),Ge(T,E,_e),We(T,E),Je(T,E),ve(_=>_+1),w({kind:"idle"})}catch(N){w({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{b=!0}},[n,S,r,l,e.orgUnitUid]);let ke=e.bound&&r.trim()!==""&&l.trim()!==""&&p.trim()!==""&&g.trim()!==""&&x.kind!=="submitting";async function Ne(f){f.preventDefault(),w({kind:"submitting"});try{await d.submitAggregate({dataSet:r,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:g}]}),w({kind:"ok",message:`Submitted ${p}=${g} for ${l}.`}),y(""),v("")}catch(b){w({kind:"error",message:b.message??"Submission failed"})}}let se=l.trim()!=="",W=r.trim()!=="",L=W&&se&&e.bound;j(()=>{if(!L){H(null);return}let f=!1;return(async()=>{try{let b=await d.getCompletion(r.trim(),e.orgUnitUid??"",l.trim());if(f)return;H({completed:!!b.completed,completedAt:b.completedAt})}catch{f||H({completed:!1})}})(),()=>{f=!0}},[r,l,e.orgUnitUid,L]);async function Se(){if(!L||V)return;let f=!R?.completed;if(f){let b=A.current;if(b){let N=[];for(let E of Array.from(b.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&N.push(E);if(N.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${N.length} compulsory value${N.length===1?"":"s"} still missing. Run Validate to jump to them.`}),N[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}re(!0);try{let b=await d.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:f});H({completed:!!b.completed,completedAt:b.completedAt}),w({kind:"ok",message:b.completed?"Dataset marked complete.":"Dataset reopened."})}catch(b){w({kind:"error",message:`Completion failed: ${b.message}`})}finally{re(!1)}}return h(Ie,{title:"Aggregate data entry",actions:m(je,{tone:i.isOnline?"success":"warning",children:i.isOnline?"online":`offline (${i.queuedCount} queued)`}),children:[m("style",{children:ot}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Organisation unit"}),m("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:r,onChange:f=>{u(f.target.value),c("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),a.map(f=>m("option",{value:f.id,children:f.label},f.id))]})]}),he.map(f=>h("div",{className:"der-de-chip","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-chip-label",children:f.name}),h("select",{className:"der-de-select",value:te[f.id]??"",onChange:b=>{let N={...te,[f.id]:b.target.value};P(N),F.current=N,Fe(A.current,N)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),f.options.map(b=>m("option",{value:b.id,children:b.name},b.id))]})]},f.id)),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:rt(S?.periodType,l,c)})]})]}),x.kind==="ok"&&m("div",{style:et,"data-test":"de-ok",children:x.message}),x.kind==="error"&&m("div",{style:tt,"data-test":"de-err",children:x.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!W&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&W&&!se&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),L&&n==="structured"&&h("form",{onSubmit:Ne,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:f=>y(f.target.value),style:Z})]}),h("label",{children:["Value",m("input",{value:g,onChange:f=>v(f.target.value),inputMode:"decimal",style:Z})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!ke,style:ue,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),L&&n==="custom"&&m("div",{className:`der-de-form-card der-de-density-${M}`,children:h("div",{className:"der-de-form-split",children:[m(ze,{targetRef:A,formVersion:ae}),m("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),L&&n==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Be,{root:A,formVersion:ae}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${M==="compact"?"comfortable":"compact"} density`,title:`Density: ${M}. Click to switch.`,onClick:()=>Ee(f=>f==="compact"?"comfortable":"compact"),children:M==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),R&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:R.completed?`Complete${R.completedAt?" \xB7 "+new Date(R.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{Ye(A.current,w,f=>{xe(f),J(f.length>0)})},style:me,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!Q&&h("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),!ne&&m("button",{type:"button",onClick:()=>oe(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:Se,disabled:V,style:R?.completed?me:ue,"data-test":"de-complete-btn",children:V?"Saving\u2026":R?.completed?"Reopen":"Mark complete"})]}),m(Qe,{open:ne&&!Q,details:we,onClose:()=>oe(!1)}),m(Ve,{open:Q,issues:U,onClose:()=>J(!1),onPick:f=>{let b=A.current?.querySelector(`input[name="${f.inputName}"]`);b&&(b.scrollIntoView({behavior:"smooth",block:"center"}),b.focus(),b.select())}})]})}var Re=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Oe=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],G=null,Y=null,X=null;async function de(o,e){G||(G=e.listAllDataElements().then(s=>new Map(s.map(r=>[r.id,r])))),Y||(Y=e.listAllCategoryCombos().then(s=>new Map(s.map(r=>[r.id,r])))),X||(X=e.listAllCategoryOptionCombos().then(s=>{let r=new Map;for(let u of s){let l=u.categoryCombo?.id;if(!l)continue;let c=r.get(l);c?c.push(u):r.set(l,[u])}return r}));let[i,d,n]=await Promise.all([G,Y,X]),t=s=>{if(!s?.id)return;let r=d.get(s.id),u=n.get(s.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:u.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(r.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:s},a=s=>{let r=i.get(s.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:s};return{...o,categoryCombo:t(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(s=>({...s,dataElement:s.dataElement?a(s.dataElement):void 0})),sections:(o.sections??[]).map(s=>({...s,dataElements:(s.dataElements??[]).map(r=>a(r))}))}}function le(o){let e={};for(let s of o.dataSetElements??[])s.dataElement&&(e[s.dataElement.id]=s.dataElement);let i={};for(let s of o.indicators??[])i[s.id]=s;let d=(o.sections??[]).slice().sort((s,r)=>(s.sortOrder??0)-(r.sortOrder??0));if(!d.some(s=>(s.dataElements?.length??0)>0)){let s=(o.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);d=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:s,indicators:[],greyedFields:[]}]}let t=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let s of d){let r=new Set;for(let l of s.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&r.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${t(s.name??"")}</h3>`);let u=new Map;for(let l of s.dataElements??[]){let c=e[l.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,y=u.get(p);y||(y={cc:c.categoryCombo,des:[]},u.set(p,y)),y.des.push(c)}for(let l of u.values()){let c=l.cc.categoryOptionCombos??[],p=l.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let y=Me(p,c);if(a.push("<thead>"),y.length>0)for(let g=0;g<y.length;g++){a.push("<tr>"),g===0&&a.push(`<th class="dataElementCell" rowspan="${y.length}">`+t(l.cc.name??"Data element")+"</th>");for(let v of y[g]??[])a.push(`<th colspan="${v.span}">${t(v.label)}</th>`);a.push("</tr>")}else{a.push("<tr>"),a.push(`<th class="dataElementCell">${t(l.cc.name??"Data element")}</th>`);for(let g of c)a.push(`<th>${t(g.name??"")}</th>`);a.push("</tr>")}a.push("</thead><tbody>");for(let g of l.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${t(g.id)}-cell">`+t(g.formName??g.name??g.id)+"</td>");for(let v of c){let x=`${g.id}-${v.id}-val`;r.has(`${g.id}:${v.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${t(x)}" name="${t(x)}" dataelementid="${t(g.id)}" optioncomboid="${t(v.id)}"></td>`)}a.push("</tr>")}for(let g of s.indicators??[]){let v=i[g.id];v&&(a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),a.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),a.push("</tr>"))}a.push("</tbody></table></div>")}}return a.join(`
`)}function Me(o,e){if(o.length===0)return[];let i=o.map(n=>n.categoryOptions?.length??0);if(i.some(n=>n===0))return[];let d=[];for(let n=0;n<o.length;n++){let t=[],a=1;for(let r=n+1;r<o.length;r++)a*=i[r]??1;let s=1;for(let r=0;r<n;r++)s*=i[r]??1;for(let r=0;r<s;r++)for(let u of o[n]?.categoryOptions??[])t.push({label:u.name??u.id,span:a});d.push(t)}return d}function Le(o){let e=globalThis;e.dhis2=e.dhis2??{};let i=e.dhis2;i.de=i.de??{};let d=i.de;d.currentDataSetId=o.dataSetId,d.currentOrganisationUnitId=o.orgUnitId,d.currentPeriodId=o.periodId,d.currentCategorySelections={...o.aocSelections??{}};let n=o.meta??{},t={},a={};if(n.categoryCombo){a[n.categoryCombo.id]=n.categoryCombo;for(let c of n.categoryCombo.categories??[])t[c.id]=c}d.categories=t,d.categoryCombos=a;let s={},r={};for(let c of n.dataSetElements??[]){let p=c.dataElement;p&&(s[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}d.dataElements=s,d.optionSets=r;let u={};for(let c of n.indicators??[])u[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};d.indicatorFormulas=u;let l={};for(let c of o.validationRules??[])l[c.id]=c;d.validationRules=l,d.lockExceptions=[],d.emptyOrganisationUnits=[],d.significantZeros=[],d.dataSets={[n.id]:{id:n.id,name:n.name??n.displayName??"",periodType:n.periodType,categoryCombo:n.categoryCombo?.id,periodId:o.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,i.shim=i.shim??{},i.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function qe(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(e,i)=>{i.xhrFields={...i.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let e=o.dhis2.period;e.format="yyyy-mm-dd",e.calendar=o.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Fe(o,e){if(!o)return;for(let[d,n]of Object.entries(e)){let t=o.querySelector(`input[data-der-category="${d}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${d}`,t.setAttribute("data-der-category",d),o.appendChild(t)),t.value=n}let i=globalThis;i.dhis2?.de&&(i.dhis2.de.currentCategorySelections={...e})}function Pe(o,e,i,d,n,t){let a=l=>{let c=/^(.+)-(.+)-val$/.exec(l);return c?{de:c[1],coc:c[2]}:null},s=new WeakMap,r=o.querySelectorAll('input[name$="-val"]');for(let l of Array.from(r))s.set(l,l.value);let u=async l=>{let c=l.target;if(!c||c.tagName!=="INPUT")return;let p=c.getAttribute("name")??"",y=a(p);if(!y)return;let g=e(),v=i(),x=d();if(!g||!v||!x)return;let w=c.value;if(s.get(c)!==w){K(c,"saving");try{let S=await t.submitAggregate({dataSet:g,period:v,orgUnit:x,attributeOptionComboSelections:n(),dataValues:[{dataElement:y.de,categoryOptionCombo:y.coc,value:w}]});s.set(c,w),K(c,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{K(c,"error")}}};o.addEventListener("blur",l=>{u(l)},!0)}function He(o){o.addEventListener("keydown",e=>{let i=e;if(i.key!=="Enter")return;let d=i.target;if(!(d instanceof HTMLInputElement))return;let n=d.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;i.preventDefault();let a=t[2],s=Array.from(o.querySelectorAll(`input[name$="-${a}-val"]`)),r=s.indexOf(d);if(r===-1)return;let u=s[r+(i.shiftKey?-1:1)];u?.focus(),u instanceof HTMLInputElement&&u.select()})}function Ue(o){let e=Array.from(o.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let i=new Set(e),d=[],n=(t,a)=>{for(let s of i)if(s!==a&&t.contains(s))return!0;return!1};return e.forEach((t,a)=>{let s=t.id||`der-de-section-${a}`;t.id=s;let r=null,u=t.parentElement,l=null;for(;u&&u!==o&&!n(u,t);)l=u,u=u.parentElement;if(l&&l.children.length>1&&l!==o)r=l,r.classList.add("der-de-section-slot"),r.dataset.sectionId=s;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=s;let c=e[a+1]??null,p=[],y=t;for(;y&&y!==c;){let g=y.nextSibling;p.push(y),y=g}t.parentNode?.insertBefore(r,t);for(let g of p)r.appendChild(g)}d.push({id:s,label:(t.textContent??"").trim(),slot:r})}),d}function ze({targetRef:o,formVersion:e}){let[i,d]=k([]),[n,t]=k("");return j(()=>{let a=o.current;if(!a)return;let s=Ue(a);d(s),t(s[0]?.id??"")},[o,e]),j(()=>{if(!o.current||i.length===0)return;for(let r of i)r.slot.style.display=r.id===n?"":"none";let s=i.find(r=>r.id===n);s&&s.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,i,n]),i.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:i.map(a=>m("li",{children:m("button",{type:"button",className:"der-de-section-nav__item"+(n===a.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(a.id),children:a.label})},a.id))})]})}function Be({root:o,formVersion:e}){let[i,d]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(j(()=>{let a=()=>{let r=o.current;if(!r)return;let u=Array.from(r.querySelectorAll('input[name$="-val"]')),l=0,c=0,p=0,y=0,g=0;for(let v of u){v.value.trim()!==""&&l++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?c++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?y++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?p++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&g++}d({total:u.length,filled:l,saving:c,saved:p,queued:y,error:g})};a();let s=window.setInterval(a,800);return()=>window.clearInterval(s)},[o,e]),i.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let n=[];n.push(`${i.filled} of ${i.total} filled`),i.saving>0&&n.push(`${i.saving} saving`),i.queued>0&&n.push(`${i.queued} queued`),i.error>0&&n.push(`${i.error} error`);let t=i.error>0?"error":i.queued>0?"queued":i.saving>0?"saving":i.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:n.join(" \xB7 ")})}function Ve({open:o,issues:e,onClose:i,onPick:d}){return j(()=>{if(!o)return;let n=t=>{t.key==="Escape"&&i()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[o,i]),!o||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:i,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(n=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>d(n),children:[m("span",{className:"der-de-issues-drawer__de",children:n.deName}),m("span",{className:"der-de-issues-drawer__coc",children:n.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:n.value}),m("span",{children:n.problem})]})]})},`${n.deId}-${n.cocId}`))})]})}function Qe({open:o,details:e,onClose:i}){if(!o)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:i,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let d={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},n={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:i,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${n[e.saveState]}`,children:d[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(ge,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(ge,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,a)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},a))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Je(o,e){let i=e.indicators??[];if(i.length===0)return;let d=i.filter(l=>l.numerator&&l.denominator).map(l=>({id:l.id,factor:l.indicatorType?.factor??1,numExpr:l.numerator,denExpr:l.denominator}));if(d.length===0)return;let n=Array.from(o.querySelectorAll("input[indicatorid]")),t=new Map;for(let l of Array.from(o.querySelectorAll('input[name$="-val"]')))t.set(l.getAttribute("name")??"",l);let a=l=>{let c=0;for(let[p,y]of t){if(!p.startsWith(`${l}-`))continue;let g=parseFloat(y.value);Number.isFinite(g)&&(c+=g)}return c},s=l=>l.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,y)=>{if(y){let g=t.get(`${p}-${y}-val`),v=parseFloat(g?.value??"");return Number.isFinite(v)?String(v):"0"}return String(a(p))}),r=l=>{if(!/^[\s\d+\-*/().eE]+$/.test(l))return NaN;try{return Function(`"use strict";return (${l})`)()}catch{return NaN}},u=()=>{for(let l of d){let c=r(s(l.numExpr)),p=r(s(l.denExpr)),y=n.find(v=>v.getAttribute("indicatorid")===l.id);if(!y)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){y.value="";continue}let g=c/p*l.factor;y.value=Number.isInteger(g)?String(g):g.toFixed(2)}};o.addEventListener("input",l=>{let c=l.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&u()},!0),u()}function We(o,e){let i=e.compulsoryDataElementOperands??[],d=new Set;for(let n of i){let t=n.dimensionItem;if(!t)continue;let a=t.split(".");a.length===2&&d.add(`${a[0]}:${a[1]}`)}if(d.size!==0)for(let n of Array.from(o.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");t&&d.has(`${t[1]}:${t[2]}`)&&n.setAttribute("data-compulsory","1")}}function Ge(o,e,i){let d={};for(let t of e.dataSetElements??[])t.dataElement&&(d[t.dataElement.id]=t.dataElement);let n=t=>{let a=t.getAttribute("name")??t.id??"",s=/^(.+)-(.+)-val$/.exec(a);if(!s)return null;let r=s[1],u=s[2],l=d[r],c=l?.categoryCombo,p=c?.categoryOptionCombos?.find(D=>D.id===u),y=[],g=p?.name??p?.displayName??u,v=g.split(/,\s*/).filter(Boolean),x=c?.categories??[];v.forEach((D,A)=>{y.push({category:x[A]?.name??x[A]?.displayName??"",option:D})});let w=t.style.outline||"",S=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:u,deName:l?.name??r,deFormName:l?.formName,valueType:l?.valueType??"TEXT",optionSetId:l?.optionSet?.id,cocName:g,categoryBreakdown:y,value:t.value,saveState:S,inputName:a,compulsory:t.getAttribute("data-compulsory")==="1"}};o.addEventListener("focusin",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let s=n(a);s&&i(s)}},!0),o.addEventListener("input",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let s=n(a);s&&i(s)}},!0)}function Ye(o,e,i){if(!o)return;let d=globalThis,n=d.dhis2?.de?.dataElements??{},t=d.dhis2?.de?.categoryOptionCombos??{},a=Array.from(o.querySelectorAll('input[name$="-val"]')),s=[];for(let r of a){r.style.outline="";let u=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!u)continue;let l=u[1],c=u[2],p=n[l],y=p?.valueType??"TEXT",g=r.value.trim();if(g===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",s.push({deId:l,cocId:c,valueType:y,value:"",problem:"compulsory value missing",deName:p?.name??l,cocName:t[c]?.name??c,inputName:r.name}));continue}let v=Xe(g,y);v&&(r.style.outline="2px solid #c0392b",s.push({deId:l,cocId:c,valueType:y,value:g,problem:v,deName:p?.name??l,cocName:t[c]?.name??c,inputName:r.name}))}i(s),s.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${s.length} issue${s.length===1?"":"s"}. See the Issues panel.`})}function Xe(o,e){let i=Number(o),d=Number.isInteger(i);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(i))return"must be a number";break}switch(e){case"INTEGER":if(!d)return"must be an integer";break;case"INTEGER_POSITIVE":if(!d||i<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!d||i>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!d||i<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(i<0||i>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(i<0||i>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function K(o,e){let i=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${i}`,o.style.transition="outline 150ms",e==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function Ke(o,e,i,d,n){if(!e||!i||!d)return;let t;try{t=(await n.readAggregateValues(d,i,2e3)).dataValues??[]}catch{return}for(let a of t){let s=a.dataElement,r=a.categoryOptionCombo,u=a.value;if(!s||!r||u==null)continue;let l=o.querySelector(`input[name="${s}-${r}-val"]`);l&&(l.value=u)}}function fe(o){return new Promise((e,i)=>{let d=document.createElement("script");d.src=o,d.async=!1,d.setAttribute("data-der-custom-form",o),d.onload=()=>e(),d.onerror=()=>i(new Error(`failed to load ${o}`)),document.head.appendChild(d)})}function ye(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=o,e.setAttribute("data-der-custom-form",o),document.head.appendChild(e)}function ce(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Ze(o,e){let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let n of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(n.tagName==="LINK"){let t=n.getAttribute("href")??"";t&&ye(ce(t))}else{let t=document.createElement("style");t.textContent=n.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}n.remove()}let d=[];for(let n of Array.from(i.querySelectorAll("script"))){let t=n.getAttribute("src");t?d.push({src:ce(t)}):d.push({code:n.textContent??""}),n.remove()}for(let n of Array.from(i.body.querySelectorAll("*")))if(n.removeAttribute("style"),n.tagName==="INPUT"){let t=n.getAttribute("id")??"";t.endsWith("-val")&&n.getAttribute("name")!==t&&n.setAttribute("name",t)}for(let n of Array.from(i.body.childNodes))o.appendChild(document.adoptNode(n));for(let n of d)if(n.src)document.querySelector(`script[data-der-custom-form="${n.src}"]`)||await fe(n.src);else if(n.code){let t=document.createElement("script");t.textContent=n.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var Z={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ue={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},me={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},et={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},tt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function rt(o,e,i){let d={...Z},n=nt(o);if(n.length===0)return m("input",{value:e,onChange:p=>i(p.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:d});let t=[...n];if(e&&!t.some(p=>p.id===e)){let p=at(o,e)??e;t.unshift({id:e,label:p})}let a=n[0]?.id??null,s=t.findIndex(p=>p.id===e),r=s===-1||s<t.length-1||!!o,u=e!==""&&(s>0||e!==a),l=()=>{if(!o)return;let p=s>=0&&s<t.length-1?t[s+1]?.id??"":pe(o,e||a||"",-1);p&&i(p)},c=()=>{if(!o||!e||e===a)return;let p=s>0?t[s-1]?.id??"":pe(o,e,1);p&&i(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>i(p.target.value),style:d,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:c,disabled:!u,className:"der-de-period-btn",children:"\u25B6"})]})}function pe(o,e,i){let d=n=>String(n).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=Number(e.slice(6,8)),s=new Date(n,t,a+i);return`${s.getFullYear()}${d(s.getMonth()+1)}${d(s.getDate())}`}case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=ee(t)):a>ee(t)&&(t+=1,a=1),`${t}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let n=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,a=n*12+t+i;return`${Math.floor(a/12)}${d((a%12+12)%12+1)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=6):a>6&&(t+=1,a=1),`${t}${d(a)}B`}case"Quarterly":{let n=/^(\d{4})Q(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=4):a>4&&(t+=1,a=1),`${t}Q${a}`}case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(e);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+i;return a<1?(t-=1,a=2):a>2&&(t+=1,a=1),`${t}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+i):"";default:return""}}function at(o,e){let i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let d=/^(\d{4})W(\d{1,2})$/.exec(e);return d?`${d[1]} W${String(d[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let d=Number(e.slice(4,6))-1;return`${i[d]??""} ${e.slice(0,4)}`}case"BiMonthly":{let d=/^(\d{4})(\d{2})B$/.exec(e);if(!d)return null;let n=(Number(d[2])-1)*2;return`${i[n]}\u2013${i[n+1]} ${d[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let d=/^(\d{4})S(\d)$/.exec(e);return d?`${d[1]} ${d[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function nt(o){let e=new Date,i=e.getFullYear(),d=e.getMonth(),n=a=>String(a).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":{let a=[];for(let s=0;s<30;s++){let r=new Date(e);r.setDate(r.getDate()-s);let u=`${r.getFullYear()}${n(r.getMonth()+1)}${n(r.getDate())}`,l=`${r.getFullYear()}-${n(r.getMonth()+1)}-${n(r.getDate())}`;a.push({id:u,label:l})}return a}case"Weekly":{let a=[],s=be(e),r=s.year,u=s.week;for(let l=0;l<12;l++)a.push({id:`${r}W${u}`,label:`${r} W${n(u)}`}),u-=1,u<1&&(r-=1,u=ee(r));return a}case"Monthly":{let a=[];for(let s=0;s<24;s++){let r=i,u=d,l=r*12+u-s,c=Math.floor(l/12),p=(l%12+12)%12;a.push({id:`${c}${n(p+1)}`,label:`${t[p]} ${c}`})}return a}case"BiMonthly":{let a=[],s=Math.floor(d/2)+1,r=i,u=s;for(let l=0;l<12;l++){let c=(u-1)*2;a.push({id:`${r}${n(u)}B`,label:`${t[c]}\u2013${t[c+1]} ${r}`}),u-=1,u<1&&(r-=1,u=6)}return a}case"Quarterly":{let a=[],s=Math.floor(d/3)+1,r=i,u=s;for(let l=0;l<8;l++)a.push({id:`${r}Q${u}`,label:`${r} Q${u}`}),u-=1,u<1&&(r-=1,u=4);return a}case"SixMonthly":{let a=[],s=d<6?1:2,r=i,u=s;for(let l=0;l<6;l++)a.push({id:`${r}S${u}`,label:`${r} ${u===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),u-=1,u<1&&(r-=1,u=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let s=0;s<10;s++){let r=i-s;a.push({id:String(r),label:String(r)})}return a}default:return[]}}function be(o){let e=new Date(o.getFullYear(),o.getMonth(),o.getDate()),i=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-i);let d=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-d.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function ee(o){return be(new Date(o,11,28)).week}var ot=`
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
`;export{De as default};
