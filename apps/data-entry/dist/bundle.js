/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as A,useRef as de,useState as k}from"react";import{useAuth as Ae,useOrgUnitBinding as $e,useOnlineStatus as Ie,useDerApi as je,ScreenCard as De,StatusPill as Oe}from"@der/app-sdk";import{Fragment as fe,jsx as m,jsxs as h}from"react/jsx-runtime";function Me(){let i=Ae(),e=$e(),l=Ie(),o=je(),[a,t]=k("custom"),[n,d]=k([]),[r,c]=k(""),[s,u]=k(""),[p,g]=k(""),[f,v]=k(""),[x,w]=k({kind:"idle"}),[S,D]=k(null),$=de(null),[re,H]=k({}),q=de({}),[ve,B]=k([]),[O,F]=k(null),[V,ne]=k(!1),[ae,xe]=k(0),[z,we]=k([]),[Q,J]=k(!1),[_e,Ee]=k(null),[oe,se]=k(!0),[ke,W]=k(!1);A(()=>{let y=b=>{if(b.key!=="?")return;let N=b.target;N&&(N.tagName==="INPUT"||N.tagName==="TEXTAREA")||(b.preventDefault(),W(E=>!E))};return window.addEventListener("keydown",y),()=>window.removeEventListener("keydown",y)},[]);let[R,Ne]=k(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});A(()=>{try{window.localStorage.setItem("der-de-density",R)}catch{}},[R]),A(()=>{let y=!1;return(async()=>{try{let b=await o.listDataSets();if(y)return;let N=(b.dataSets??[]).map(E=>({id:E.id,label:E.displayName??E.name??E.id,periodType:E.periodType,formType:E.formType})).sort((E,I)=>E.label.localeCompare(I.label));d(N)}catch{}})(),()=>{y=!0}},[]),A(()=>{if(r.trim()===""){D(null),B([]),H({}),q.current={};return}let y=!1;return(async()=>{try{let b=await o.getDataSetMeta(r.trim());if(y)return;let N=!!b.dataEntryForm&&b.formType==="CUSTOM"||b.formType==="SECTION";D({hasCustomForm:N,formId:b.dataEntryForm?.id,displayName:b.displayName??b.name,formType:b.formType,periodType:b.periodType}),t(N?"custom":"structured");try{let E=await o.getDataSetFormMetadata(r.trim());if(y)return;let I=await le(E,o);if(y)return;let U=(I.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));B(U);let P={};for(let C of U)C.options[0]&&(P[C.id]=C.options[0].id);H(P),q.current=P}catch{}}catch{y||D(null)}})(),()=>{y=!0}},[r]),A(()=>{if(a!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let y=$.current;if(!y)return;let b=!1;return(async()=>{w({kind:"submitting"});try{let N=await o.getDataSetFormMetadata(r.trim());if(b)return;let E=await le(N,o);if(b)return;let I="";if(S.formType==="CUSTOM"&&S.formId){try{I=(await o.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(_){I="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",_)}I.trim()||(I=ce(E))}else S.formType==="SECTION"&&(I=ce(E));if(b)return;let U=await o.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(b)return;let P=(E.categoryCombo?.categories??[]).filter(_=>(_.categoryOptions?.length??0)>1).map(_=>({id:_.id,name:_.name??_.id,options:(_.categoryOptions??[]).map(M=>({id:M.id,name:M.name??M.id}))}));B(P);let C={};for(let _ of P)_.options[0]&&(C[_.id]=_.options[0].id);H(C),q.current=C,y.replaceChildren();for(let[_,M]of[["selectedDataSetId",r.trim()],["selectedPeriodId",s.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let j=document.createElement("input");j.type="hidden",j.id=_,j.value=M,y.appendChild(j)}for(let[_,M]of Object.entries(C)){let j=document.createElement("input");j.type="hidden",j.id=`category-${_}`,j.value=M,j.setAttribute("data-der-category",_),y.appendChild(j)}let T=document.createElement("div");T.id="contentDiv",y.appendChild(T),qe({dataSetId:r.trim(),periodId:s.trim(),orgUnitId:e.orgUnitUid??"",meta:E,aocSelections:C,validationRules:U.validationRules??[]});for(let _ of Le)be(_);for(let _ of Re)document.querySelector(`script[data-der-custom-form="${_}"]`)||await ye(_);He(),await at(T,I),await nt(T,r.trim(),s.trim(),e.orgUnitUid??"",o),ze(T,()=>r.trim(),()=>s.trim(),()=>e.orgUnitUid??"",()=>({...q.current}),o),Ue(T),Ye(T,w),et(T,E,Ee),Ze(T,E),Xe(T,E),Ke(T,E),xe(_=>_+1),w({kind:"idle"})}catch(N){w({kind:"error",message:`custom form failed to render: ${N.message}`})}})(),()=>{b=!0}},[a,S,r,s,e.orgUnitUid]);let Se=e.bound&&r.trim()!==""&&s.trim()!==""&&p.trim()!==""&&f.trim()!==""&&x.kind!=="submitting";async function Ce(y){y.preventDefault(),w({kind:"submitting"});try{await o.submitAggregate({dataSet:r,period:s,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),w({kind:"ok",message:`Submitted ${p}=${f} for ${s}.`}),g(""),v("")}catch(b){w({kind:"error",message:b.message??"Submission failed"})}}let ie=s.trim()!=="",G=r.trim()!=="",L=G&&ie&&e.bound;A(()=>{if(!L){F(null);return}let y=!1;return(async()=>{try{let b=await o.getCompletion(r.trim(),e.orgUnitUid??"",s.trim());if(y)return;F({completed:!!b.completed,completedAt:b.completedAt})}catch{y||F({completed:!1})}})(),()=>{y=!0}},[r,s,e.orgUnitUid,L]);async function Te(){if(!L||V)return;let y=!O?.completed;if(y){let b=$.current;if(b){let N=[];for(let E of Array.from(b.querySelectorAll('input[data-compulsory="1"]')))E.value.trim()===""&&N.push(E);if(N.length>0){w({kind:"error",message:`Can't mark complete \u2014 ${N.length} compulsory value${N.length===1?"":"s"} still missing. Run Validate to jump to them.`}),N[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ne(!0);try{let b=await o.markCompletion({dataSet:r.trim(),orgUnit:e.orgUnitUid??"",period:s.trim(),completed:y});F({completed:!!b.completed,completedAt:b.completedAt}),w({kind:"ok",message:b.completed?"Dataset marked complete.":"Dataset reopened."})}catch(b){w({kind:"error",message:`Completion failed: ${b.message}`})}finally{ne(!1)}}return h(De,{title:"Aggregate data entry",actions:m(Oe,{tone:l.isOnline?"success":"warning",children:l.isOnline?"online":`offline (${l.queuedCount} queued)`}),children:[m("style",{children:ct}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Organisation unit"}),m("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[m("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:r,onChange:y=>{c(y.target.value),u("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),n.map(y=>m("option",{value:y.id,children:y.label},y.id))]})]}),ve.map(y=>h("div",{className:"der-de-chip","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-chip-label",children:y.name}),h("select",{className:"der-de-select",value:re[y.id]??"",onChange:b=>{let N={...re,[y.id]:b.target.value};H(N),q.current=N,Fe($.current,N)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),y.options.map(b=>m("option",{value:b.id,children:b.name},b.id))]})]},y.id)),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:it(S?.periodType,s,u)})]})]}),x.kind==="ok"&&m("div",{style:ot,"data-test":"de-ok",children:x.message}),x.kind==="error"&&m("div",{style:st,"data-test":"de-err",children:x.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!G&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&G&&!ie&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),L&&a==="structured"&&h("form",{onSubmit:Ce,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",m("input",{value:p,onChange:y=>g(y.target.value),style:ee})]}),h("label",{children:["Value",m("input",{value:f,onChange:y=>v(y.target.value),inputMode:"decimal",style:ee})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!Se,style:me,children:x.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),L&&a==="custom"&&m("div",{className:`der-de-form-card der-de-density-${R}`,children:h("div",{className:"der-de-form-split",children:[m(Ve,{targetRef:$,formVersion:ae}),m("div",{ref:$,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),L&&a==="custom"&&h("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(Qe,{root:$,formVersion:ae}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${R==="compact"?"comfortable":"compact"} density`,title:`Density: ${R}. Click to switch.`,onClick:()=>Ne(y=>y==="compact"?"comfortable":"compact"),children:R==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),O&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{tt($.current,w,y=>{we(y),J(y.length>0)})},style:pe,"data-test":"de-validate-btn",children:"Validate"}),z.length>0&&!Q&&h("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[z.length," issue",z.length===1?"":"s"]}),!oe&&m("button",{type:"button",onClick:()=>se(!0),className:"der-de-density-btn","data-test":"de-details-toggle","aria-label":"Open cell details panel",children:"Details"}),m("button",{type:"button",onClick:()=>W(y=>!y),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Te,disabled:V,style:O?.completed?pe:me,"data-test":"de-complete-btn",children:V?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),m(Ge,{open:oe&&!Q,details:_e,onClose:()=>se(!1)}),m(We,{open:ke,onClose:()=>W(!1)}),m(Je,{open:Q,issues:z,onClose:()=>J(!1),onPick:y=>{let b=$.current?.querySelector(`input[name="${y.inputName}"]`);b&&(b.scrollIntoView({behavior:"smooth",block:"center"}),b.focus(),b.select())}})]})}var Re=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Le=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],Y=null,K=null,X=null;async function le(i,e){Y||(Y=e.listAllDataElements().then(d=>new Map(d.map(r=>[r.id,r])))),K||(K=e.listAllCategoryCombos().then(d=>new Map(d.map(r=>[r.id,r])))),X||(X=e.listAllCategoryOptionCombos().then(d=>{let r=new Map;for(let c of d){let s=c.categoryCombo?.id;if(!s)continue;let u=r.get(s);u?u.push(c):r.set(s,[c])}return r}));let[l,o,a]=await Promise.all([Y,K,X]),t=d=>{if(!d?.id)return;let r=o.get(d.id),c=a.get(d.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(s=>({id:s.id,name:s.name??s.displayName,categoryOptions:s.categoryOptions??[]})),categories:(r.categories??[]).map(s=>({id:s.id,name:s.name??s.displayName,categoryOptions:(s.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:d},n=d=>{let r=l.get(d.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:t(r.categoryCombo)}:d};return{...i,categoryCombo:t(i.categoryCombo)??i.categoryCombo,dataSetElements:(i.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?n(d.dataElement):void 0})),sections:(i.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(r=>n(r))}))}}function ce(i){let e={};for(let d of i.dataSetElements??[])d.dataElement&&(e[d.dataElement.id]=d.dataElement);let l={};for(let d of i.indicators??[])l[d.id]=d;let o=(i.sections??[]).slice().sort((d,r)=>(d.sortOrder??0)-(r.sortOrder??0));if(!o.some(d=>(d.dataElements?.length??0)>0)){let d=(i.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);o=[{id:i.id,name:i.displayName??i.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let t=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let d of o){let r=new Set;for(let s of d.greyedFields??[])s.dataElement?.id&&s.categoryOptionCombo?.id&&r.add(`${s.dataElement.id}:${s.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${t(d.name??"")}</h3>`);let c=new Map;for(let s of d.dataElements??[]){let u=e[s.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,g=c.get(p);g||(g={cc:u.categoryCombo,des:[]},c.set(p,g)),g.des.push(u)}for(let s of c.values()){let u=s.cc.categoryOptionCombos??[],p=s.cc.categories??[];n.push('<div class="der-de-table-scroll">'),n.push('<table class="sectionTable" cellspacing="0">');let g=Pe(p,u);if(n.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){n.push("<tr>"),f===0&&n.push(`<th class="dataElementCell" rowspan="${g.length}">`+t(s.cc.name??"Data element")+"</th>");for(let v of g[f]??[])n.push(`<th colspan="${v.span}">${t(v.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${t(s.cc.name??"Data element")}</th>`);for(let f of u)n.push(`<th>${t(f.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let f of s.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let v of u){let x=`${f.id}-${v.id}-val`;r.has(`${f.id}:${v.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${t(x)}" name="${t(x)}" dataelementid="${t(f.id)}" optioncomboid="${t(v.id)}"></td>`)}n.push("</tr>")}for(let f of d.indicators??[]){let v=l[f.id];v&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${t(v.name??v.id)}</td>`),n.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${t(v.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table></div>")}}return n.join(`
`)}function Pe(i,e){if(i.length===0||e.length===0)return[];let l=new Map;for(let n of i)for(let d of n.categoryOptions??[])l.set(d.id,{catId:n.id,name:d.name??d.id});let o=i.length,a=e.map(n=>{let d=new Array(o).fill("");for(let r of n.categoryOptions??[]){let c=l.get(r.id);if(!c)continue;let s=i.findIndex(u=>u.id===c.catId);s>=0&&(d[s]=c.name)}return d});for(let n of a)if(n.some(d=>d===""))return[];let t=[];for(let n=0;n<o;n++){let d=[];for(let r=0;r<a.length;){let c=a[r],s=r+1;for(;s<a.length;){let u=a[s],p=!0;for(let g=0;g<=n;g++)if(c[g]!==u[g]){p=!1;break}if(!p)break;s++}d.push({label:c[n]??"",span:s-r}),r=s}t.push(d)}return t}function qe(i){let e=globalThis;e.dhis2=e.dhis2??{};let l=e.dhis2;l.de=l.de??{};let o=l.de;o.currentDataSetId=i.dataSetId,o.currentOrganisationUnitId=i.orgUnitId,o.currentPeriodId=i.periodId,o.currentCategorySelections={...i.aocSelections??{}};let a=i.meta??{},t={},n={};if(a.categoryCombo){n[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])t[u.id]=u}o.categories=t,o.categoryCombos=n;let d={},r={};for(let u of a.dataSetElements??[]){let p=u.dataElement;p&&(d[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(n[p.categoryCombo.id]=p.categoryCombo))}o.dataElements=d,o.optionSets=r;let c={};for(let u of a.indicators??[])c[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};o.indicatorFormulas=c;let s={};for(let u of i.validationRules??[])s[u.id]=u;o.validationRules=s,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:i.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,l.shim=l.shim??{},l.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function He(){let i=globalThis;if(i.$&&typeof i.$.ajaxSetup=="function"&&i.$.ajaxSetup({beforeSend:(e,l)=>{l.xhrFields={...l.xhrFields??{},withCredentials:!0}}}),i.dhis2?.period&&i.$?.calendars?.instance){let e=i.dhis2.period;e.format="yyyy-mm-dd",e.calendar=i.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Fe(i,e){if(!i)return;for(let[o,a]of Object.entries(e)){let t=i.querySelector(`input[data-der-category="${o}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${o}`,t.setAttribute("data-der-category",o),i.appendChild(t)),t.value=a}let l=globalThis;l.dhis2?.de&&(l.dhis2.de.currentCategorySelections={...e})}function ze(i,e,l,o,a,t){let n=s=>{let u=/^(.+)-(.+)-val$/.exec(s);return u?{de:u[1],coc:u[2]}:null},d=new WeakMap,r=i.querySelectorAll('input[name$="-val"]');for(let s of Array.from(r))d.set(s,s.value);let c=async s=>{let u=s.target;if(!u||u.tagName!=="INPUT")return;let p=u.getAttribute("name")??"",g=n(p);if(!g)return;let f=e(),v=l(),x=o();if(!f||!v||!x)return;let w=u.value;if(d.get(u)!==w){Z(u,"saving");try{let S=await t.submitAggregate({dataSet:f,period:v,orgUnit:x,attributeOptionComboSelections:a(),dataValues:[{dataElement:g.de,categoryOptionCombo:g.coc,value:w}]});d.set(u,w),Z(u,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{Z(u,"error")}}};i.addEventListener("blur",s=>{c(s)},!0)}function Ue(i){i.addEventListener("keydown",e=>{let l=e;if(l.key!=="Enter")return;let o=l.target;if(!(o instanceof HTMLInputElement))return;let a=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(a);if(!t)return;l.preventDefault();let n=t[2],d=Array.from(i.querySelectorAll(`input[name$="-${n}-val"]`)),r=d.indexOf(o);if(r===-1)return;let c=d[r+(l.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Be(i){let e=Array.from(i.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(e.length<2)return[];let l=new Set(e),o=[],a=(t,n)=>{for(let d of l)if(d!==n&&t.contains(d))return!0;return!1};return e.forEach((t,n)=>{let d=t.id||`der-de-section-${n}`;t.id=d;let r=null,c=t.parentElement,s=null;for(;c&&c!==i&&!a(c,t);)s=c,c=c.parentElement;if(s&&s.children.length>1&&s!==i)r=s,r.classList.add("der-de-section-slot"),r.dataset.sectionId=d;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=d;let u=e[n+1]??null,p=[],g=t;for(;g&&g!==u;){let f=g.nextSibling;p.push(g),g=f}t.parentNode?.insertBefore(r,t);for(let f of p)r.appendChild(f)}o.push({id:d,label:(t.textContent??"").trim(),slot:r})}),o}function Ve({targetRef:i,formVersion:e}){let[l,o]=k([]),[a,t]=k(""),[n,d]=k({});return A(()=>{let r=i.current;if(!r)return;let c=Be(r);o(c),t(c[0]?.id??"")},[i,e]),A(()=>{if(l.length===0)return;let r=()=>{let u={};for(let p of l){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(v=>v.value.trim()!=="").length;u[p.id]={filled:f,total:g.length}}d(u)};r();let c=i.current;if(!c)return;let s=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&r()};return c.addEventListener("input",s,!0),()=>{c.removeEventListener("input",s,!0)}},[i,l]),A(()=>{if(!i.current||l.length===0)return;for(let s of l)s.slot.style.display=s.id===a?"":"none";let c=l.find(s=>s.id===a);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[i,l,a]),l.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:l.map(r=>{let c=n[r.id],s=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return m("li",{children:h("button",{type:"button",className:"der-de-section-nav__item"+(a===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(r.id),children:[m("span",{className:"der-de-section-nav__label",children:r.label}),c&&c.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${s}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:s==="done"?"\u2713":`${c.filled}/${c.total}`})]})},r.id)})})]})}function Qe({root:i,formVersion:e}){let[l,o]=k({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(A(()=>{let n=()=>{let r=i.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),s=0,u=0,p=0,g=0,f=0;for(let v of c){v.value.trim()!==""&&s++;let x=v.style.outline||"";x.includes("rgb(185, 134, 10)")||x.includes("#b9860a")?u++:x.includes("rgb(206, 123, 0)")||x.includes("#ce7b00")?g++:x.includes("rgb(26, 135, 84)")||x.includes("#1a8754")||x.includes("rgb(183, 220, 199)")||x.includes("#b7dcc7")?p++:(x.includes("rgb(169, 50, 50)")||x.includes("#a93232"))&&f++}o({total:c.length,filled:s,saving:u,saved:p,queued:g,error:f})};n();let d=window.setInterval(n,800);return()=>window.clearInterval(d)},[i,e]),l.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let a=[];a.push(`${l.filled} of ${l.total} filled`),l.saving>0&&a.push(`${l.saving} saving`),l.queued>0&&a.push(`${l.queued} queued`),l.error>0&&a.push(`${l.error} error`);let t=l.error>0?"error":l.queued>0?"queued":l.saving>0?"saving":l.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:a.join(" \xB7 ")})}function Je({open:i,issues:e,onClose:l,onPick:o}){return A(()=>{if(!i)return;let a=t=>{t.key==="Escape"&&l()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[i,l]),!i||e.length===0?null:h("aside",{className:"der-de-issues-drawer","data-test":"de-issues-drawer",role:"complementary","aria-label":"Validation issues",children:[h("header",{className:"der-de-issues-drawer__head",children:[h("h4",{className:"der-de-issues-drawer__title",children:[e.length," validation issue",e.length===1?"":"s"]}),m("button",{type:"button",className:"der-de-issues-drawer__close","aria-label":"Close issues panel","data-test":"de-issues-close",onClick:l,children:"\xD7"})]}),m("ul",{className:"der-de-issues-drawer__list",children:e.map(a=>m("li",{children:h("button",{type:"button",className:"der-de-issues-drawer__item","data-test":"de-issues-item",onClick:()=>o(a),children:[m("span",{className:"der-de-issues-drawer__de",children:a.deName}),m("span",{className:"der-de-issues-drawer__coc",children:a.cocName}),h("span",{className:"der-de-issues-drawer__why",children:[m("code",{className:"der-de-issues-drawer__value",children:a.value}),m("span",{children:a.problem})]})]})},`${a.deId}-${a.cocId}`))})]})}function We({open:i,onClose:e}){return A(()=>{if(!i)return;let o=a=>{a.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[i,e]),i?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:h("div",{className:"der-de-shortcuts",children:[h("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,a])=>h("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:o})}),m("dd",{children:a})]},o))})]})}):null}function Ge({open:i,details:e,onClose:l}){if(!i)return null;if(!e)return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),m("p",{className:"der-de-details-drawer__empty",children:"Click a value cell to inspect its data element, category breakdown and save state."})]});let o={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected \u2014 fix and retry"},a={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return h("aside",{className:"der-de-details-drawer","data-test":"de-details-drawer",role:"complementary","aria-label":"Cell details",children:[h("header",{className:"der-de-details-drawer__head",children:[m("h4",{className:"der-de-details-drawer__title",children:"Cell details"}),m("button",{type:"button",className:"der-de-details-drawer__close","aria-label":"Close details panel",onClick:l,children:"\xD7"})]}),h("div",{className:"der-de-details-drawer__body",children:[h("div",{className:"der-de-details-drawer__de",children:[e.deName,e.compulsory&&m("span",{className:"der-de-details-drawer__compulsory",title:"Compulsory \u2014 a value is required before this dataset can be marked complete.",children:"Compulsory"})]}),m("span",{className:`der-de-details-drawer__state der-de-details-drawer__state--${a[e.saveState]}`,children:o[e.saveState]}),h("dl",{className:"der-de-details-drawer__meta",children:[m("dt",{children:"Value type"}),m("dd",{children:e.valueType}),e.deFormName&&e.deFormName!==e.deName&&h(fe,{children:[m("dt",{children:"Form name"}),m("dd",{children:e.deFormName})]}),m("dt",{children:"Data element"}),m("dd",{children:m("code",{children:e.deId})}),m("dt",{children:"Category combo"}),m("dd",{children:e.cocName}),e.categoryBreakdown.length>0&&h(fe,{children:[m("dt",{children:"Breakdown"}),m("dd",{children:m("ul",{className:"der-de-details-drawer__breakdown",children:e.categoryBreakdown.map((t,n)=>h("li",{children:[m("span",{className:"der-de-details-drawer__cat",children:t.category}),m("span",{className:"der-de-details-drawer__opt",children:t.option})]},n))})})]}),m("dt",{children:"COC id"}),m("dd",{children:m("code",{children:e.cocId})}),m("dt",{children:"Current value"}),m("dd",{children:e.value||m("span",{className:"der-de-details-drawer__empty-val",children:"\u2014"})})]})]})]})}function Ye(i,e){i.addEventListener("paste",l=>{let o=l.target;if(!o||o.tagName!=="INPUT")return;let a=o.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(a);if(!t)return;let n=l.clipboardData?.getData("text/plain")??"";if(!/\r?\n/.test(n))return;let d=n.split(/\r?\n/).map(g=>g.trim()).filter((g,f,v)=>!(f===v.length-1&&g===""));if(d.length===0)return;l.preventDefault();let r=t[2],c=o.closest("[data-section-id]")??i,s=Array.from(c.querySelectorAll(`input[name$="-${r}-val"]`)),u=s.indexOf(o);if(u===-1)return;let p=0;for(let g=0;g<d.length;g++){let f=s[u+g];if(!f)break;f.value=d[g]??"",f.dispatchEvent(new Event("input",{bubbles:!0})),f.dispatchEvent(new Event("blur",{bubbles:!0})),p++}e({kind:"ok",message:`Pasted ${p} value${p===1?"":"s"} into the column (${d.length-p} overflow).`})},!0)}function Ke(i,e){let l=e.indicators??[];if(l.length===0)return;let o=l.filter(s=>s.numerator&&s.denominator).map(s=>({id:s.id,factor:s.indicatorType?.factor??1,numExpr:s.numerator,denExpr:s.denominator}));if(o.length===0)return;let a=Array.from(i.querySelectorAll("input[indicatorid]")),t=new Map;for(let s of Array.from(i.querySelectorAll('input[name$="-val"]')))t.set(s.getAttribute("name")??"",s);let n=s=>{let u=0;for(let[p,g]of t){if(!p.startsWith(`${s}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(u+=f)}return u},d=s=>s.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,g)=>{if(g){let f=t.get(`${p}-${g}-val`),v=parseFloat(f?.value??"");return Number.isFinite(v)?String(v):"0"}return String(n(p))}),r=s=>{if(!/^[\s\d+\-*/().eE]+$/.test(s))return NaN;try{return Function(`"use strict";return (${s})`)()}catch{return NaN}},c=()=>{for(let s of o){let u=r(d(s.numExpr)),p=r(d(s.denExpr)),g=a.find(v=>v.getAttribute("indicatorid")===s.id);if(!g)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){g.value="";continue}let f=u/p*s.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};i.addEventListener("input",s=>{let u=s.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&c()},!0),c()}function Xe(i,e){let l={};for(let o of e.dataSetElements??[])o.dataElement&&(l[o.dataElement.id]=o.dataElement);for(let o of Array.from(i.querySelectorAll('input[name$="-val"]'))){let a=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!a)continue;let t=l[a[1]],n=t?.formName??t?.name??a[1],d=t?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===a[2]),r=d?.name??d?.displayName??a[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",r===a[2]?`${n}`:`${n}, ${r}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function Ze(i,e){let l=e.compulsoryDataElementOperands??[],o=new Set;for(let a of l){let t=a.dimensionItem;if(!t)continue;let n=t.split(".");n.length===2&&o.add(`${n[0]}:${n[1]}`)}if(o.size!==0)for(let a of Array.from(i.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");t&&o.has(`${t[1]}:${t[2]}`)&&a.setAttribute("data-compulsory","1")}}function et(i,e,l){let o={};for(let t of e.dataSetElements??[])t.dataElement&&(o[t.dataElement.id]=t.dataElement);let a=t=>{let n=t.getAttribute("name")??t.id??"",d=/^(.+)-(.+)-val$/.exec(n);if(!d)return null;let r=d[1],c=d[2],s=o[r],u=s?.categoryCombo,p=u?.categoryOptionCombos?.find(D=>D.id===c),g=[],f=p?.name??p?.displayName??c,v=f.split(/,\s*/).filter(Boolean),x=u?.categories??[];v.forEach((D,$)=>{g.push({category:x[$]?.name??x[$]?.displayName??"",option:D})});let w=t.style.outline||"",S=w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?"saving":w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?"queued":w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?"saved":w.includes("rgb(169, 50, 50)")||w.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:r,cocId:c,deName:s?.name??r,deFormName:s?.formName,valueType:s?.valueType??"TEXT",optionSetId:s?.optionSet?.id,cocName:f,categoryBreakdown:g,value:t.value,saveState:S,inputName:n,compulsory:t.getAttribute("data-compulsory")==="1"}};i.addEventListener("focusin",t=>{let n=t.target;if(n&&n.tagName==="INPUT"){let d=a(n);d&&l(d)}},!0),i.addEventListener("input",t=>{let n=t.target;if(n&&n.tagName==="INPUT"){let d=a(n);d&&l(d)}},!0)}function tt(i,e,l){if(!i)return;let o=globalThis,a=o.dhis2?.de?.dataElements??{},t=o.dhis2?.de?.categoryOptionCombos??{},n=Array.from(i.querySelectorAll('input[name$="-val"]')),d=[];for(let r of n){r.style.outline="";let c=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!c)continue;let s=c[1],u=c[2],p=a[s],g=p?.valueType??"TEXT",f=r.value.trim();if(f===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",d.push({deId:s,cocId:u,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??s,cocName:t[u]?.name??u,inputName:r.name}));continue}let v=rt(f,g);v&&(r.style.outline="2px solid #c0392b",d.push({deId:s,cocId:u,valueType:g,value:f,problem:v,deName:p?.name??s,cocName:t[u]?.name??u,inputName:r.name}))}l(d),d.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${n.length} cells OK.`}):e({kind:"error",message:`Validation found ${d.length} issue${d.length===1?"":"s"}. See the Issues panel.`})}function rt(i,e){let l=Number(i),o=Number.isInteger(l);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(l))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||l<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||l>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||l<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(l<0||l>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(l<0||l>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(i.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(i.toLowerCase()))return"must be yes";break;case"URL":try{new URL(i)}catch{return"must be a valid URL"}break;default:break}return null}function Z(i,e){let l=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";i.style.outline=`2px solid ${l}`,i.style.transition="outline 150ms",e==="queued"?i.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):i.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{i.style.outline.includes("#1a8754")&&(i.style.outline="1px solid #b7dcc7")},1200)}async function nt(i,e,l,o,a){if(!e||!l||!o)return;let t;try{t=(await a.readAggregateValues(o,l,2e3)).dataValues??[]}catch{return}for(let n of t){let d=n.dataElement,r=n.categoryOptionCombo,c=n.value;if(!d||!r||c==null)continue;let s=i.querySelector(`input[name="${d}-${r}-val"]`);s&&(s.value=c)}}function ye(i){return new Promise((e,l)=>{let o=document.createElement("script");o.src=i,o.async=!1,o.setAttribute("data-der-custom-form",i),o.onload=()=>e(),o.onerror=()=>l(new Error(`failed to load ${i}`)),document.head.appendChild(o)})}function be(i){if(document.querySelector(`link[data-der-custom-form="${i}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=i,e.setAttribute("data-der-custom-form",i),document.head.appendChild(e)}function ue(i){return!i||/^https?:\/\//i.test(i)||i.startsWith("/legacy-custom-forms/")||i.startsWith("/")?i:`/legacy-custom-forms/${i.replace(/^(?:\.{1,2}\/)+/,"")}`}async function at(i,e){let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let t=a.getAttribute("href")??"";t&&be(ue(t))}else{let t=document.createElement("style");t.textContent=a.textContent??"",t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t)}a.remove()}let o=[];for(let a of Array.from(l.querySelectorAll("script"))){let t=a.getAttribute("src");t?o.push({src:ue(t)}):o.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(l.body.querySelectorAll("*")))if(a.removeAttribute("style"),a.tagName==="INPUT"){let t=a.getAttribute("id")??"";t.endsWith("-val")&&a.getAttribute("name")!==t&&a.setAttribute("name",t)}for(let a of Array.from(l.body.childNodes))i.appendChild(document.adoptNode(a));for(let a of o)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await ye(a.src);else if(a.code){let t=document.createElement("script");t.textContent=a.code,t.setAttribute("data-der-custom-form","inline"),document.head.appendChild(t),t.remove()}}var ee={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},me={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},pe={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ot={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},st={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function it(i,e,l){let o={...ee},a=lt(i);if(a.length===0)return m("input",{value:e,onChange:p=>l(p.target.value),placeholder:i?`DHIS2 ${i} period id`:"e.g. 202611",style:o});let t=[...a];if(e&&!t.some(p=>p.id===e)){let p=dt(i,e)??e;t.unshift({id:e,label:p})}let n=a[0]?.id??null,d=t.findIndex(p=>p.id===e),r=d===-1||d<t.length-1||!!i,c=e!==""&&(d>0||e!==n),s=()=>{if(!i)return;let p=d>=0&&d<t.length-1?t[d+1]?.id??"":ge(i,e||n||"",-1);p&&l(p)},u=()=>{if(!i||!e||e===n)return;let p=d>0?t[d-1]?.id??"":ge(i,e,1);p&&l(p)};return h("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:s,disabled:!r,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:p=>l(p.target.value),style:o,children:[m("option",{value:"",children:"Select a period\u2026"}),t.map(p=>m("option",{value:p.id,children:p.label},p.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!c,className:"der-de-period-btn",children:"\u25B6"})]})}function ge(i,e,l){let o=a=>String(a).padStart(2,"0");switch(i){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),d=new Date(a,t,n+l);return`${d.getFullYear()}${o(d.getMonth()+1)}${o(d.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+l;return n<1?(t-=1,n=te(t)):n>te(t)&&(t+=1,n=1),`${t}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),t=Number(e.slice(4,6))-1,n=a*12+t+l;return`${Math.floor(n/12)}${o((n%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+l;return n<1?(t-=1,n=6):n>6&&(t+=1,n=1),`${t}${o(n)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+l;return n<1?(t-=1,n=4):n>4&&(t+=1,n=1),`${t}Q${n}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let t=Number(a[1]),n=Number(a[2])+l;return n<1?(t-=1,n=2):n>2&&(t+=1,n=1),`${t}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+l):"";default:return""}}function dt(i,e){let l=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${l[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let a=(Number(o[2])-1)*2;return`${l[a]}\u2013${l[a+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function lt(i){let e=new Date,l=e.getFullYear(),o=e.getMonth(),a=n=>String(n).padStart(2,"0"),t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(i){case"Daily":{let n=[];for(let d=0;d<30;d++){let r=new Date(e);r.setDate(r.getDate()-d);let c=`${r.getFullYear()}${a(r.getMonth()+1)}${a(r.getDate())}`,s=`${r.getFullYear()}-${a(r.getMonth()+1)}-${a(r.getDate())}`;n.push({id:c,label:s})}return n}case"Weekly":{let n=[],d=he(e),r=d.year,c=d.week;for(let s=0;s<12;s++)n.push({id:`${r}W${c}`,label:`${r} W${a(c)}`}),c-=1,c<1&&(r-=1,c=te(r));return n}case"Monthly":{let n=[];for(let d=0;d<24;d++){let r=l,c=o,s=r*12+c-d,u=Math.floor(s/12),p=(s%12+12)%12;n.push({id:`${u}${a(p+1)}`,label:`${t[p]} ${u}`})}return n}case"BiMonthly":{let n=[],d=Math.floor(o/2)+1,r=l,c=d;for(let s=0;s<12;s++){let u=(c-1)*2;n.push({id:`${r}${a(c)}B`,label:`${t[u]}\u2013${t[u+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return n}case"Quarterly":{let n=[],d=Math.floor(o/3)+1,r=l,c=d;for(let s=0;s<8;s++)n.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return n}case"SixMonthly":{let n=[],d=o<6?1:2,r=l,c=d;for(let s=0;s<6;s++)n.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let d=0;d<10;d++){let r=l-d;n.push({id:String(r),label:String(r)})}return n}default:return[]}}function he(i){let e=new Date(i.getFullYear(),i.getMonth(),i.getDate()),l=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-l);let o=new Date(e.getFullYear(),0,1),t=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((t+1)/7)}}function te(i){return he(new Date(i,11,28)).week}var ct=`
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
`;export{Me as default};
