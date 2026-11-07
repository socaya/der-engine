/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as j,useRef as ie,useState as k}from"react";import{useAuth as Ce,useOrgUnitBinding as Te,useOnlineStatus as Ae,useDerApi as $e,ScreenCard as Ie,StatusPill as je}from"@der/app-sdk";import{Fragment as ge,jsx as m,jsxs as h}from"react/jsx-runtime";function De(){let o=Ce(),e=Te(),d=Ae(),i=$e(),[a,t]=k("custom"),[n,s]=k([]),[r,u]=k(""),[l,c]=k(""),[p,f]=k(""),[g,v]=k(""),[x,w]=k({kind:"idle"}),[S,D]=k(null),A=ie(null),[te,F]=k({}),P=ie({}),[he,B]=k([]),[O,H]=k(null),[V,re]=k(!1),[ne,ve]=k(0),[U,xe]=k([]),[Q,J]=k(!1),[we,Ee]=k(null),[ae,oe]=k(!0),[M,_e]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});j(()=>{try{window.localStorage.setItem("der-de-density",M)}catch{}},[M]),j(()=>{let y=!1;return(async()=>{try{let b=await i.listDataSets();if(y)return;let N=(b.dataSets??[]).map(_=>({id:_.id,label:_.displayName??_.name??_.id,periodType:_.periodType,formType:_.formType})).sort((_,$)=>_.label.localeCompare($.label));s(N)}catch{}})(),()=>{y=!0}},[]),j(()=>{if(r.trim()===""){D(null),B([]),F({}),P.current={};return}let y=!1;return(async()=>{try{let b=await i.getDataSetMeta(r.trim());if(y)return;let N=!!b.dataEntryForm&&b.formType==="CUSTOM"||b.formType==="SECTION";D({hasCustomForm:N,formId:b.dataEntryForm?.id,displayName:b.displayName??b.name,formType:b.formType,periodType:b.periodType}),t(N?"custom":"structured");try{let _=await i.getDataSetFormMetadata(r.trim());if(y)return;let $=await de(_,i);if(y)return;let z=($.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));B(z);let q={};for(let C of z)C.options[0]&&(q[C.id]=C.options[0].id);F(q),P.current=q}catch{}}catch{y||D(null)}})(),()=>{y=!0}},[r]),j(()=>{if(a!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let y=A.current;if(!y)return;let b=!1;return(async()=>{w({kind:"submitting"});try{let N=await i.getDataSetFormMetadata(r.trim());if(b)return;let _=await de(N,i);if(b)return;let $="";if(S.formType==="CUSTOM"&&S.formId){try{$=(await i.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(E){$="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",E)}$.trim()||($=le(_))}else S.formType==="SECTION"&&($=le(_));if(b)return;let z=await i.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(b)return;let q=(_.categoryCombo?.categories??[]).filter(E=>(E.categoryOptions?.length??0)>1).map(E=>({id:E.id,name:E.name??E.id,options:(E.categoryOptions??[]).map(R=>({id:R.id,name:R.name??R.id}))}));B(q);let C={};for(let E of q)E.options[0]&&(C[E.id]=E.options[0].id);F(C),P.current=C,y.replaceChildren();for(let[E,R]of[["selectedDataSetId",r.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let I=document.createElement("input");I.type="hidden",I.id=E,I.value=R,y.appendChild(I)}for(let[E,R]of Object.entries(C)){let I=document.createElement("input");I.type="hidden",I.id=`category-${E}`,I.value=R,I.setAttribute("data-der-category",E),y.appendChild(I)}let T=document.createElement("div");T.id="contentDiv",y.appendChild(T),Le({dataSetId:r.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:_,aocSelections:C,validationRules:z.validationRules??[]});for(let E of Re)ye(E);for(let E of Oe)document.querySelector(`script[data-der-custom-form="${E}"]`)||await fe(E);qe(),await et(T,$),await Ze(T,r.trim(),l.trim(),e.orgUnitUid??"",i),Fe(T,()=>r.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...P.current}),i),He(T),Je(T,w),Ye(T,_,Ee),Ge(T,_),We(T,_),ve(E=>E+1),w({kind:"idle"})}catch(N){w({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{b=!0}},[a,S,r,l,e.orgUnitUid]);let ke=e.bound&&r.trim()!==""&&l.trim()!==""&&p.trim()!==""&&g.trim()!==""&&x.kind!=="submitting";async function Ne(y){y.preventDefault(),w({kind:"submitting"});try{await i.submitAggregate({dataSet:r,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:g}]}),w({kind:"ok",message:`Submitted ${p}=${g} for ${l}.`}),f(""),v("")}catch(b){w({kind:"error",message:b.message??"Submission failed"})}}let se=l.trim()!=="",W=r.trim()!=="",L=W&&se&&e.bound;j(()=>{if(!L){H(null);return}let y=!1;return(async()=>{try{let b=await i.getCompletion(r.trim(),e.orgUnitUid??"",l.trim());if(y)return;H({completed:!!b.completed,completedAt:b.completedAt})}catch{y||H({completed:!1})}})(),()=>{y=!0}},[r,l,e.orgUnitUid,L]);async function Se(){if(!L||V)return;let y=!O?.completed;if(y){let b=A.current;if(b){let N=[];for(let _ of Array.from(b.querySelectorAll('input[data-compulsory="1"]')))_.value.trim()===""&&N.push(_);if(N.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${N.length} compulsory value${N.length===1?"":"s"} still missing. Run Validate to jump to them.`}),N[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}re(!0);try{let b=await i.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:l.trim(),completed:y});H({completed:!!b.completed,completedAt:b.completedAt}),w({kind:"ok",message:b.completed?"Dataset marked complete.":"Dataset reopened."})}catch(b){w({kind:"error",message:`Completion failed: ${b.message}`})}finally{re(!1)}}return h(Ie,{title:"Aggregate data entry",actions:m(je,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[m("style",{children:st}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Organisation unit"}),m("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:r,onChange:y=>{u(y.target.value),c("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),n.map(y=>m("option",{value:y.id,children:y.label},y.id))]})]}),he.map(y=>h("div",{className:"der-de-chip","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-chip-label",children:y.name}),h("select",{className:"der-de-select",value:te[y.id]??"",onChange:b=>{let N={...te,[y.id]:b.target.value};F(N),P.current=N,Pe(A.current,N)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),y.options.map(b=>m("option",{value:b.id,children:b.name},b.id))]})]},y.id)),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:nt(S?.periodType,l,c)})]})]}),x.kind==="ok"&&m("div",{style:tt,"data-test":"de-ok",children:x.message}),x.kind==="error"&&m("div",{style:rt,"data-test":"de-err",children:x.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!W&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&W&&!se&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),L&&a==="structured"&&h("form",{onSubmit:Ne,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:y=>f(y.target.value),style:Z})]}),h("label",{children:["Value",m("input",{value:g,onChange:y=>v(y.target.value),inputMode:"decimal",style:Z})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!ke,style:ue,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),L&&a==="custom"&&m("div",{className:`der-de-form-card der-de-density-${M}`,children:h("div",{className:"der-de-form-split",children:[m(ze,{targetRef:A,formVersion:ne}),m("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),L&&a==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Be,{root:A,formVersion:ne}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${M==="compact"?"comfortable":"compact"} density`,title:`Density: ${M}. Click to switch.`,onClick:()=>_e(y=>y==="compact"?"comfortable":"compact"),children:M==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{Xe(A.current,w,y=>{xe(y),J(y.length>0)})},style:me,"data-test":"de-validate-btn",children:"Validate"}),U.length>0&&!Q&&h("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[U.length," issue",U.length===1?"":"s"]}),!ae&&m("button",{type:"button",onClick:()=>oe(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:Se,disabled:V,style:O?.completed?me:ue,"data-test":"de-complete-btn",children:V?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),m(Qe,{open:ae&&!Q,details:we,onClose:()=>oe(!1)}),m(Ve,{open:Q,issues:U,onClose:()=>J(!1),onPick:y=>{let b=A.current?.querySelector(`input[name="${y.inputName}"]`);b&&(b.scrollIntoView({behavior:"smooth",block:"center"}),b.focus(),b.select())}})]})}var Oe=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Re=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],G=null,Y=null,X=null;async function de(o,e){G||(G=e.listAllDataElements().then(s=>new Map(s.map(r=>[r.id,r])))),Y||(Y=e.listAllCategoryCombos().then(s=>new Map(s.map(r=>[r.id,r])))),X||(X=e.listAllCategoryOptionCombos().then(s=>{let r=new Map;for(let u of s){let l=u.categoryCombo?.id;if(!l)continue;let c=r.get(l);c?c.push(u):r.set(l,[u])}return r}));let[d,i,a]=await Promise.all([G,Y,X]),t=s=>{if(!s?.id)return;let r=i.get(s.id),u=a.get(s.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:u.map(l=>({id:l.id,name:l.name??l.displayName})),categories:(r.categories??[]).map(l=>({id:l.id,name:l.name??l.displayName,categoryOptions:(l.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:s},n=s=>{let r=d.get(s.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:s};return{...o,categoryCombo:t(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(s=>({...s,dataElement:s.dataElement?n(s.dataElement):void 0})),sections:(o.sections??[]).map(s=>({...s,dataElements:(s.dataElements??[]).map(r=>n(r))}))}}function le(o){let e={};for(let s of o.dataSetElements??[])s.dataElement&&(e[s.dataElement.id]=s.dataElement);let d={};for(let s of o.indicators??[])d[s.id]=s;let i=(o.sections??[]).slice().sort((s,r)=>(s.sortOrder??0)-(r.sortOrder??0));if(!i.some(s=>(s.dataElements?.length??0)>0)){let s=(o.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);i=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:s,indicators:[],greyedFields:[]}]}let t=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let s of i){let r=new Set;for(let l of s.greyedFields??[])l.dataElement?.id&&l.categoryOptionCombo?.id&&r.add(`${l.dataElement.id}:${l.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${t(s.name??"")}</h3>`);let u=new Map;for(let l of s.dataElements??[]){let c=e[l.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,f=u.get(p);f||(f={cc:c.categoryCombo,des:[]},u.set(p,f)),f.des.push(c)}for(let l of u.values()){let c=l.cc.categoryOptionCombos??[],p=l.cc.categories??[];n.push('<div class="der-de-table-scroll">'),n.push('<table class="sectionTable" cellspacing="0">');let f=Me(p,c);if(n.push("<thead>"),f.length>0)for(let g=0;g<f.length;g++){n.push("<tr>"),g===0&&n.push(`<th class="dataElementCell" rowspan="${f.length}">`+t(l.cc.name??"Data element")+"</th>");for(let v of f[g]??[])n.push(`<th colspan="${v.span}">${t(v.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${t(l.cc.name??"Data element")}</th>`);for(let g of c)n.push(`<th>${t(g.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let g of l.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${t(g.id)}-cell">`+t(g.formName??g.name??g.id)+"</td>");for(let v of c){let x=`${g.id}-${v.id}-val`;r.has(`${g.id}:${v.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${t(x)}" name="${t(x)}" dataelementid="${t(g.id)}" optioncomboid="${t(v.id)}"></td>`)}n.push("</tr>")}for(let g of s.indicators??[]){let v=d[g.id];v&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),n.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table></div>")}}return n.join(`
`)}function Me(o,e){if(o.length===0)return[];let d=o.map(a=>a.categoryOptions?.length??0);if(d.some(a=>a===0))return[];let i=[];for(let a=0;a<o.length;a++){let t=[],n=1;for(let r=a+1;r<o.length;r++)n*=d[r]??1;let s=1;for(let r=0;r<a;r++)s*=d[r]??1;for(let r=0;r<s;r++)for(let u of o[a]?.categoryOptions??[])t.push({label:u.name??u.id,span:n});i.push(t)}return i}function Le(o){let e=globalThis;e.dhis2=e.dhis2??{};let d=e.dhis2;d.de=d.de??{};let i=d.de;i.currentDataSetId=o.dataSetId,i.currentOrganisationUnitId=o.orgUnitId,i.currentPeriodId=o.periodId,i.currentCategorySelections={...o.aocSelections??{}};let a=o.meta??{},t={},n={};if(a.categoryCombo){n[a.categoryCombo.id]=a.categoryCombo;for(let c of a.categoryCombo.categories??[])t[c.id]=c}i.categories=t,i.categoryCombos=n;let s={},r={};for(let c of a.dataSetElements??[]){let p=c.dataElement;p&&(s[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(n[p.categoryCombo.id]=p.categoryCombo))}i.dataElements=s,i.optionSets=r;let u={};for(let c of a.indicators??[])u[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};i.indicatorFormulas=u;let l={};for(let c of o.validationRules??[])l[c.id]=c;i.validationRules=l,i.lockExceptions=[],i.emptyOrganisationUnits=[],i.significantZeros=[],i.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:o.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function qe(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(e,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let e=o.dhis2.period;e.format="yyyy-mm-dd",e.calendar=o.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Pe(o,e){if(!o)return;for(let[i,a]of Object.entries(e)){let t=o.querySelector(`input[data-der-category="${i}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${i}`,t.setAttribute("data-der-category",i),o.appendChild(t)),t.value=a}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...e})}function Fe(o,e,d,i,a,t){let n=l=>{let c=/^(.+)-(.+)-val$/.exec(l);return c?{de:c[1],coc:c[2]}:null},s=new WeakMap,r=o.querySelectorAll('input[name$="-val"]');for(let l of Array.from(r))s.set(l,l.value);let u=async l=>{let c=l.target;if(!c||c.tagName!=="INPUT")return;let p=c.getAttribute("name")??"",f=n(p);if(!f)return;let g=e(),v=d(),x=i();if(!g||!v||!x)return;let w=c.value;if(s.get(c)!==w){K(c,"saving");try{let S=await t.submitAggregate({dataSet:g,period:v,orgUnit:x,attributeOptionComboSelections:a(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:w}]});s.set(c,w),K(c,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{K(c,"error")}}};o.addEventListener("blur",l=>{u(l)},!0)}function He(o){o.addEventListener("keydown",e=>{let d=e;if(d.key!=="Enter")return;let i=d.target;if(!(i instanceof HTMLInputElement))return;let a=i.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(a);if(!t)return;d.preventDefault();let n=t[2],s=Array.from(o.querySelectorAll(`input[name$="-${n}-val"]`)),r=s.indexOf(i);if(r===-1)return;let u=s[r+(d.shiftKey?-1:1)];u?.focus(),u instanceof HTMLInputElement&&u.select()})}function Ue(o){let e=Array.from(o.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let d=new Set(e),i=[],a=(t,n)=>{for(let s of d)if(s!==n&&t.contains(s))return!0;return!1};return e.forEach((t,n)=>{let s=t.id||`der-de-section-${n}`;t.id=s;let r=null,u=t.parentElement,l=null;for(;u&&u!==o&&!a(u,t);)l=u,u=u.parentElement;if(l&&l.children.length>1&&l!==o)r=l,r.classList.add("der-de-section-slot"),r.dataset.sectionId=s;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=s;let c=e[n+1]??null,p=[],f=t;for(;f&&f!==c;){let g=f.nextSibling;p.push(f),f=g}t.parentNode?.insertBefore(r,t);for(let g of p)r.appendChild(g)}i.push({id:s,label:(t.textContent??"").trim(),slot:r})}),i}function ze({targetRef:o,formVersion:e}){let[d,i]=k([]),[a,t]=k("");return j(()=>{let n=o.current;if(!n)return;let s=Ue(n);i(s),t(s[0]?.id??"")},[o,e]),j(()=>{if(!o.current||d.length===0)return;for(let r of d)r.slot.style.display=r.id===a?"":"none";let s=d.find(r=>r.id===a);s&&s.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,d,a]),d.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:d.map(n=>m("li",{children:m("button",{type:"button",className:"der-de-section-nav__item"+(a===n.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(n.id),children:n.label})},n.id))})]})}function Be({root:o,formVersion:e}){let[d,i]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(j(()=>{let n=()=>{let r=o.current;if(!r)return;let u=Array.from(r.querySelectorAll('input[name$="-val"]')),l=0,c=0,p=0,f=0,g=0;for(let v of u){v.value.trim()!==""&&l++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?c++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?f++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?p++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&g++}i({total:u.length,filled:l,saving:c,saved:p,queued:f,error:g})};n();let s=window.setInterval(n,800);return()=>window.clearInterval(s)},[o,e]),d.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${d.filled} of ${d.total} filled`),d.saving>0&&a.push(`${d.saving} saving`),d.queued>0&&a.push(`${d.queued} queued`),d.error>0&&a.push(`${d.error} error`);let t=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function Ve({open:o,issues:e,onClose:d,onPick:i}){return j(()=>{if(!o)return;let a=t=>{t.key==="Escape"&&d()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[o,d]),!o||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:d,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(a=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>i(a),children:[m("span",{className:"der-de-issues-drawer__de",children:a.deName}),m("span",{className:"der-de-issues-drawer__coc",children:a.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:a.value}),m("span",{children:a.problem})]})]})},`${a.deId}-${a.cocId}`))})]})}function Qe({open:o,details:e,onClose:d}){if(!o)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:d,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let i={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},a={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:d,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${a[e.saveState]}`,children:i[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(ge,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(ge,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,n)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},n))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Je(o,e){o.addEventListener("paste",d=>{let i=d.target;if(!i||i.tagName!=="INPUT")return;let a=i.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(a);if(!t)return;let n=d.clipboardData?.getData("text/plain")??"";if(!/\r?\n/.test(n))return;let s=n.split(/\r?\n/).map(f=>f.trim()).filter((f,g,v)=>!(g===v.length-1&&f===""));if(s.length===0)return;d.preventDefault();let r=t[2],u=i.closest("[data-section-id]")??o,l=Array.from(u.querySelectorAll(`input[name$="-${r}-val"]`)),c=l.indexOf(i);if(c===-1)return;let p=0;for(let f=0;f<s.length;f++){let g=l[c+f];if(!g)break;g.value=s[f]??"",g.dispatchEvent(new Event("input",{bubbles:!0})),g.dispatchEvent(new Event("blur",{bubbles:!0})),p++}e({kind:"ok",message:`Pasted ${p} value${p===1?"":"s"} into the column (${s.length-p} overflow).`})},!0)}function We(o,e){let d=e.indicators??[];if(d.length===0)return;let i=d.filter(l=>l.numerator&&l.denominator).map(l=>({id:l.id,factor:l.indicatorType?.factor??1,numExpr:l.numerator,denExpr:l.denominator}));if(i.length===0)return;let a=Array.from(o.querySelectorAll("input[indicatorid]")),t=new Map;for(let l of Array.from(o.querySelectorAll('input[name$="-val"]')))t.set(l.getAttribute("name")??"",l);let n=l=>{let c=0;for(let[p,f]of t){if(!p.startsWith(`${l}-`))continue;let g=parseFloat(f.value);Number.isFinite(g)&&(c+=g)}return c},s=l=>l.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,f)=>{if(f){let g=t.get(`${p}-${f}-val`),v=parseFloat(g?.value??"");return Number.isFinite(v)?String(v):"0"}return String(n(p))}),r=l=>{if(!/^[\s\d+\-*/().eE]+$/.test(l))return NaN;try{return Function(`"use strict";return (${l})`)()}catch{return NaN}},u=()=>{for(let l of i){let c=r(s(l.numExpr)),p=r(s(l.denExpr)),f=a.find(v=>v.getAttribute("indicatorid")===l.id);if(!f)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){f.value="";continue}let g=c/p*l.factor;f.value=Number.isInteger(g)?String(g):g.toFixed(2)}};o.addEventListener("input",l=>{let c=l.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&u()},!0),u()}function Ge(o,e){let d=e.compulsoryDataElementOperands??[],i=new Set;for(let a of d){let t=a.dimensionItem;if(!t)continue;let n=t.split(".");n.length===2&&i.add(`${n[0]}:${n[1]}`)}if(i.size!==0)for(let a of Array.from(o.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");t&&i.has(`${t[1]}:${t[2]}`)&&a.setAttribute("data-compulsory","1")}}function Ye(o,e,d){let i={};for(let t of e.dataSetElements??[])t.dataElement&&(i[t.dataElement.id]=t.dataElement);let a=t=>{let n=t.getAttribute("name")??t.id??"",s=/^(.+)-(.+)-val$/.exec(n);if(!s)return null;let r=s[1],u=s[2],l=i[r],c=l?.categoryCombo,p=c?.categoryOptionCombos?.find(D=>D.id===u),f=[],g=p?.name??p?.displayName??u,v=g.split(/,\s*/).filter(Boolean),x=c?.categories??[];v.forEach((D,A)=>{f.push({category:x[A]?.name??x[A]?.displayName??"",option:D})});let w=t.style.outline||"",S=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:u,deName:l?.name??r,deFormName:l?.formName,valueType:l?.valueType??"TEXT",optionSetId:l?.optionSet?.id,cocName:g,categoryBreakdown:f,value:t.value,saveState:S,inputName:n,compulsory:t.getAttribute("data-compulsory")==="1"}};o.addEventListener("focusin",t=>{let n=t.target;if(n&&n.tagName==="INPUT"){let s=a(n);s&&d(s)}},!0),o.addEventListener("input",t=>{let n=t.target;if(n&&n.tagName==="INPUT"){let s=a(n);s&&d(s)}},!0)}function Xe(o,e,d){if(!o)return;let i=globalThis,a=i.dhis2?.de?.dataElements??{},t=i.dhis2?.de?.categoryOptionCombos??{},n=Array.from(o.querySelectorAll('input[name$="-val"]')),s=[];for(let r of n){r.style.outline="";let u=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!u)continue;let l=u[1],c=u[2],p=a[l],f=p?.valueType??"TEXT",g=r.value.trim();if(g===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",s.push({deId:l,cocId:c,valueType:f,value:"",problem:"compulsory value missing",deName:p?.name??l,cocName:t[c]?.name??c,inputName:r.name}));continue}let v=Ke(g,f);v&&(r.style.outline="2px solid #c0392b",s.push({deId:l,cocId:c,valueType:f,value:g,problem:v,deName:p?.name??l,cocName:t[c]?.name??c,inputName:r.name}))}d(s),s.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${n.length} cells OK.`}):e({kind:"error",message:`Validation found ${s.length} issue${s.length===1?"":"s"}. See the Issues panel.`})}function Ke(o,e){let d=Number(o),i=Number.isInteger(d);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(e){case"INTEGER":if(!i)return"must be an integer";break;case"INTEGER_POSITIVE":if(!i||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!i||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!i||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function K(o,e){let d=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${d}`,o.style.transition="outline 150ms",e==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function Ze(o,e,d,i,a){if(!e||!d||!i)return;let t;try{t=(await a.readAggregateValues(i,d,2e3)).dataValues??[]}catch{return}for(let n of t){let s=n.dataElement,r=n.categoryOptionCombo,u=n.value;if(!s||!r||u==null)continue;let l=o.querySelector(`input[name="${s}-${r}-val"]`);l&&(l.value=u)}}function fe(o){return new Promise((e,d)=>{let i=document.createElement("script");i.src=o,i.async=!1,i.setAttribute("data-der-custom-form",o),i.onload=()=>e(),i.onerror=()=>d(new Error(`failed to load ${o}`)),document.head.appendChild(i)})}function ye(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=o,e.setAttribute("data-der-custom-form",o),document.head.appendChild(e)}function ce(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function et(o,e){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let t=a.getAttribute("href")??"";t&&ye(ce(t))}else{let t=document.createElement("style");t.textContent=a.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}a.remove()}let i=[];for(let a of Array.from(d.querySelectorAll("script"))){let t=a.getAttribute("src");t?i.push({src:ce(t)}):i.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(d.body.querySelectorAll("*")))if(a.removeAttribute("style"),a.tagName==="INPUT"){let t=a.getAttribute("id")??"";t.endsWith("-val")&&a.getAttribute("name")!==t&&a.setAttribute("name",t)}for(let a of Array.from(d.body.childNodes))o.appendChild(document.adoptNode(a));for(let a of i)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await fe(a.src);else if(a.code){let t=document.createElement("script");t.textContent=a.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var Z={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ue={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},me={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},tt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},rt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function nt(o,e,d){let i={...Z},a=ot(o);if(a.length===0)return m("input",{value:e,onChange:p=>d(p.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:i});let t=[...a];if(e&&!t.some(p=>p.id===e)){let p=at(o,e)??e;t.unshift({id:e,label:p})}let n=a[0]?.id??null,s=t.findIndex(p=>p.id===e),r=s===-1||s<t.length-1||!!o,u=e!==""&&(s>0||e!==n),l=()=>{if(!o)return;let p=s>=0&&s<t.length-1?t[s+1]?.id??"":pe(o,e||n||"",-1);p&&d(p)},c=()=>{if(!o||!e||e===n)return;let p=s>0?t[s-1]?.id??"":pe(o,e,1);p&&d(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>d(p.target.value),style:i,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:c,disabled:!u,className:"der-de-period-btn",children:"\u25B6"})]})}function pe(o,e,d){let i=a=>String(a).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),s=new Date(a,t,n+d);return`${s.getFullYear()}${i(s.getMonth()+1)}${i(s.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+d;return n<1?(t-=1,n=ee(t)):n>ee(t)&&(t+=1,n=1),`${t}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,n=a*12+t+d;return`${Math.floor(n/12)}${i((n%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+d;return n<1?(t-=1,n=6):n>6&&(t+=1,n=1),`${t}${i(n)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+d;return n<1?(t-=1,n=4):n>4&&(t+=1,n=1),`${t}Q${n}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+d;return n<1?(t-=1,n=2):n>2&&(t+=1,n=1),`${t}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+d):"";default:return""}}function at(o,e){let d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(e);return i?`${i[1]} W${String(i[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let i=Number(e.slice(4,6))-1;return`${d[i]??""} ${e.slice(0,4)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(e);if(!i)return null;let a=(Number(i[2])-1)*2;return`${d[a]}\u2013${d[a+1]} ${i[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(e);return i?`${i[1]} ${i[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function ot(o){let e=new Date,d=e.getFullYear(),i=e.getMonth(),a=n=>String(n).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(o){case"Daily":{let n=[];for(let s=0;s<30;s++){let r=new Date(e);r.setDate(r.getDate()-s);let u=`${r.getFullYear()}${a(r.getMonth()+1)}${a(r.getDate())}`,l=`${r.getFullYear()}-${a(r.getMonth()+1)}-${a(r.getDate())}`;n.push({id:u,label:l})}return n}case"Weekly":{let n=[],s=be(e),r=s.year,u=s.week;for(let l=0;l<12;l++)n.push({id:`${r}W${u}`,label:`${r} W${a(u)}`}),u-=1,u<1&&(r-=1,u=ee(r));return n}case"Monthly":{let n=[];for(let s=0;s<24;s++){let r=d,u=i,l=r*12+u-s,c=Math.floor(l/12),p=(l%12+12)%12;n.push({id:`${c}${a(p+1)}`,label:`${t[p]} ${c}`})}return n}case"BiMonthly":{let n=[],s=Math.floor(i/2)+1,r=d,u=s;for(let l=0;l<12;l++){let c=(u-1)*2;n.push({id:`${r}${a(u)}B`,label:`${t[c]}\u2013${t[c+1]} ${r}`}),u-=1,u<1&&(r-=1,u=6)}return n}case"Quarterly":{let n=[],s=Math.floor(i/3)+1,r=d,u=s;for(let l=0;l<8;l++)n.push({id:`${r}Q${u}`,label:`${r} Q${u}`}),u-=1,u<1&&(r-=1,u=4);return n}case"SixMonthly":{let n=[],s=i<6?1:2,r=d,u=s;for(let l=0;l<6;l++)n.push({id:`${r}S${u}`,label:`${r} ${u===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),u-=1,u<1&&(r-=1,u=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let s=0;s<10;s++){let r=d-s;n.push({id:String(r),label:String(r)})}return n}default:return[]}}function be(o){let e=new Date(o.getFullYear(),o.getMonth(),o.getDate()),d=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-d);let i=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-i.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function ee(o){return be(new Date(o,11,28)).week}var st=`
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
