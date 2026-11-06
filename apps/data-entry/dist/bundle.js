/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as R,useRef as Z,useState as x}from"react";import{useAuth as fe,useOrgUnitBinding as ye,useOnlineStatus as be,useDerApi as he,ScreenCard as ve,StatusPill as Ee}from"@der/app-sdk";import{jsx as p,jsxs as h}from"react/jsx-runtime";function xe(){let r=fe(),e=ye(),d=be(),s=he(),[a,i]=x("custom"),[n,o]=x([]),[t,l]=x(""),[c,u]=x(""),[m,E]=x(""),[b,v]=x(""),[$,k]=x({kind:"idle"}),[S,F]=x(null),D=Z(null),[G,W]=x({}),U=Z({}),[L,de]=x([]),[_,M]=x(null),[q,Y]=x(!1),[ce,le]=x(0);R(()=>{let g=!1;return(async()=>{try{let f=await s.listDataSets();if(g)return;let w=(f.dataSets??[]).map(C=>({id:C.id,label:C.displayName??C.name??C.id,periodType:C.periodType,formType:C.formType})).sort((C,N)=>C.label.localeCompare(N.label));o(w)}catch{}})(),()=>{g=!0}},[]),R(()=>{if(t.trim()===""){F(null);return}let g=!1;return(async()=>{try{let f=await s.getDataSetMeta(t.trim());if(g)return;let w=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";F({hasCustomForm:w,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType}),i(w?"custom":"structured")}catch{g||F(null)}})(),()=>{g=!0}},[t]),R(()=>{if(a!=="custom"||!S?.hasCustomForm||S.formType==="CUSTOM"&&!S.formId)return;let g=D.current;if(!g)return;let f=!1;return(async()=>{k({kind:"submitting"});try{let w=await s.getDataSetFormMetadata(t.trim());if(f)return;let C=await Ce(w,s);if(f)return;let N="";if(S.formType==="CUSTOM"&&S.formId){try{N=(await s.getDataEntryFormHtml(S.formId)).htmlCode??""}catch(y){N="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",y)}N.trim()||(N=ee(C))}else S.formType==="SECTION"&&(N=ee(C));if(f)return;let pe=await s.listValidationRules(t.trim()).catch(()=>({validationRules:[]}));if(f)return;let X=(C.categoryCombo?.categories??[]).filter(y=>(y.categoryOptions?.length??0)>1).map(y=>({id:y.id,name:y.name??y.id,options:(y.categoryOptions??[]).map(T=>({id:T.id,name:T.name??T.id}))}));de(X);let I={};for(let y of X)y.options[0]&&(I[y.id]=y.options[0].id);W(I),U.current=I,g.replaceChildren();for(let[y,T]of[["selectedDataSetId",t.trim()],["selectedPeriodId",c.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let A=document.createElement("input");A.type="hidden",A.id=y,A.value=T,g.appendChild(A)}for(let[y,T]of Object.entries(I)){let A=document.createElement("input");A.type="hidden",A.id=`category-${y}`,A.value=T,A.setAttribute("data-der-category",y),g.appendChild(A)}let j=document.createElement("div");j.id="contentDiv",g.appendChild(j),we({dataSetId:t.trim(),periodId:c.trim(),orgUnitId:e.orgUnitUid??"",meta:C,aocSelections:I,validationRules:pe.validationRules??[]});for(let y of ke)ae(y);for(let y of Se)document.querySelector(`script[data-der-custom-form="${y}"]`)||await oe(y);Ae(),await Ie(j,N),await Oe(j,t.trim(),c.trim(),e.orgUnitUid??"",s),_e(j,()=>t.trim(),()=>c.trim(),()=>e.orgUnitUid??"",()=>({...U.current}),s),Te(j),le(y=>y+1),k({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(w){k({kind:"error",message:`custom form failed to render: ${w.message}`})}})(),()=>{f=!0}},[a,S,t,c,e.orgUnitUid]);let ue=e.bound&&t.trim()!==""&&c.trim()!==""&&m.trim()!==""&&b.trim()!==""&&$.kind!=="submitting";async function me(g){g.preventDefault(),k({kind:"submitting"});try{await s.submitAggregate({dataSet:t,period:c,orgUnit:e.orgUnitUid,dataValues:[{dataElement:m,value:b}]}),k({kind:"ok",message:`Submitted ${m}=${b} for ${c}.`}),E(""),v("")}catch(f){k({kind:"error",message:f.message??"Submission failed"})}}let K=c.trim()!=="",B=t.trim()!=="",O=B&&K&&e.bound;R(()=>{if(!O){M(null);return}let g=!1;return(async()=>{try{let f=await s.getCompletion(t.trim(),e.orgUnitUid??"",c.trim());if(g)return;M({completed:!!f.completed,completedAt:f.completedAt})}catch{g||M({completed:!1})}})(),()=>{g=!0}},[t,c,e.orgUnitUid,O]);async function ge(){if(!O||q)return;let g=!_?.completed;Y(!0);try{let f=await s.markCompletion({dataSet:t.trim(),orgUnit:e.orgUnitUid??"",period:c.trim(),completed:g});M({completed:!!f.completed,completedAt:f.completedAt}),k({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){k({kind:"error",message:`Completion failed: ${f.message}`})}finally{Y(!1)}}return h(ve,{title:"Aggregate data entry",actions:p(Ee,{tone:d.isOnline?"success":"warning",children:d.isOnline?"online":`offline (${d.queuedCount} queued)`}),children:[p("style",{children:qe}),h("div",{className:"der-de-context",children:[h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),h("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),h("select",{className:"der-de-select",value:t,onChange:g=>{l(g.target.value),u("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),n.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),h("div",{className:"der-de-chip",children:[h("span",{className:"der-de-chip-label",children:["Period ",S?.periodType?`\xB7 ${S.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:Fe(S?.periodType,c,u)})]}),h("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:r.displayName})]})]}),$.kind==="ok"&&p("div",{style:Me,"data-test":"de-ok",children:$.message}),$.kind==="error"&&p("div",{style:Pe,"data-test":"de-err",children:$.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!B&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&B&&!K&&h("div",{className:"der-de-placeholder",children:["Pick a period to load the ",S?.formType==="SECTION"?"section":"data entry"," form."]}),O&&a==="structured"&&h("form",{onSubmit:me,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[h("label",{children:["Data element UID",p("input",{value:m,onChange:g=>E(g.target.value),style:P})]}),h("label",{children:["Value",p("input",{value:b,onChange:g=>v(g.target.value),inputMode:"decimal",style:P})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!ue,style:ne,children:$.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),O&&a==="custom"&&h("div",{className:"der-de-form-card",children:[L.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(L.length,3)}, 1fr)`,gap:12,marginBottom:12},children:L.map(g=>h("label",{children:[g.name,p("select",{value:G[g.id]??"",onChange:f=>{let w={...G,[g.id]:f.target.value};W(w),U.current=w,Ne(D.current,w)},style:P,children:g.options.map(f=>p("option",{value:f.id,children:f.name},f.id))})]},g.id))}),h("div",{className:"der-de-form-split",children:[p(je,{targetRef:D,formVersion:ce}),p("div",{ref:D,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]}),h("div",{className:"der-de-form-actions",children:[_&&p("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:_.completed?`Complete${_.completedAt?" \xB7 "+new Date(_.completedAt).toLocaleString():""}`:"Open for edits"}),p("button",{type:"button",onClick:()=>Re(D.current,k),style:re,"data-test":"de-validate-btn",children:"Validate"}),p("button",{type:"button",onClick:ge,disabled:q,style:_?.completed?re:ne,"data-test":"de-complete-btn",children:q?"Saving\u2026":_?.completed?"Reopen":"Mark complete"})]})]})]})}var Se=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ke=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],V=null,H=null,Q=null;async function Ce(r,e){V||(V=e.listAllDataElements().then(o=>new Map(o.map(t=>[t.id,t])))),H||(H=e.listAllCategoryCombos().then(o=>new Map(o.map(t=>[t.id,t])))),Q||(Q=e.listAllCategoryOptionCombos().then(o=>{let t=new Map;for(let l of o){let c=l.categoryCombo?.id;if(!c)continue;let u=t.get(c);u?u.push(l):t.set(c,[l])}return t}));let[d,s,a]=await Promise.all([V,H,Q]),i=o=>{if(!o?.id)return;let t=s.get(o.id),l=a.get(o.id)??[];return t?{id:t.id,name:t.name??t.displayName,categoryOptionCombos:l.map(c=>({id:c.id,name:c.name??c.displayName})),categories:(t.categories??[]).map(c=>({id:c.id}))}:o},n=o=>{let t=d.get(o.id);return t?{id:t.id,name:t.name??t.displayName,formName:t.formName,valueType:t.valueType,categoryCombo:i(t.categoryCombo)}:o};return{...r,categoryCombo:i(r.categoryCombo)??r.categoryCombo,dataSetElements:(r.dataSetElements??[]).map(o=>({...o,dataElement:o.dataElement?n(o.dataElement):void 0})),sections:(r.sections??[]).map(o=>({...o,dataElements:(o.dataElements??[]).map(t=>n(t))}))}}function ee(r){let e={};for(let o of r.dataSetElements??[])o.dataElement&&(e[o.dataElement.id]=o.dataElement);let d={};for(let o of r.indicators??[])d[o.id]=o;let s=(r.sections??[]).slice().sort((o,t)=>(o.sortOrder??0)-(t.sortOrder??0));if(!s.some(o=>(o.dataElements?.length??0)>0)){let o=(r.dataSetElements??[]).map(t=>t.dataElement).filter(t=>!!t);s=[{id:r.id,name:r.displayName??r.name??"Data entry",sortOrder:0,dataElements:o,indicators:[],greyedFields:[]}]}let i=o=>o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),n=[];for(let o of s){let t=new Set;for(let c of o.greyedFields??[])c.dataElement?.id&&c.categoryOptionCombo?.id&&t.add(`${c.dataElement.id}:${c.categoryOptionCombo.id}`);n.push(`<h3 class="formSection">${i(o.name??"")}</h3>`);let l=new Map;for(let c of o.dataElements??[]){let u=e[c.id];if(!u?.categoryCombo)continue;let m=u.categoryCombo.id,E=l.get(m);E||(E={cc:u.categoryCombo,des:[]},l.set(m,E)),E.des.push(u)}for(let c of l.values()){let u=c.cc.categoryOptionCombos??[],m=c.cc.categories??[];n.push('<table class="sectionTable" cellspacing="0">');let E=$e(m,u);if(n.push("<thead>"),E.length>0)for(let b=0;b<E.length;b++){n.push("<tr>"),b===0&&n.push(`<th class="dataElementCell" rowspan="${E.length}">`+i(c.cc.name??"Data element")+"</th>");for(let v of E[b]??[])n.push(`<th colspan="${v.span}">${i(v.label)}</th>`);n.push("</tr>")}else{n.push("<tr>"),n.push(`<th class="dataElementCell">${i(c.cc.name??"Data element")}</th>`);for(let b of u)n.push(`<th>${i(b.name??"")}</th>`);n.push("</tr>")}n.push("</thead><tbody>");for(let b of c.des){n.push("<tr>"),n.push(`<td class="dataElementCell" id="${i(b.id)}-cell">`+i(b.formName??b.name??b.id)+"</td>");for(let v of u){let $=`${b.id}-${v.id}-val`;t.has(`${b.id}:${v.id}`)?n.push('<td class="greyed">\u2014</td>'):n.push(`<td><input type="text" id="${i($)}" name="${i($)}" dataelementid="${i(b.id)}" optioncomboid="${i(v.id)}"></td>`)}n.push("</tr>")}for(let b of o.indicators??[]){let v=d[b.id];v&&(n.push('<tr class="indicatorRow">'),n.push(`<td class="dataElementCell">${i(v.name??v.id)}</td>`),n.push(`<td colspan="${u.length}"><input type="text" name="indicator" indicatorid="${i(v.id)}" readonly></td>`),n.push("</tr>"))}n.push("</tbody></table>")}}return n.join(`
`)}function $e(r,e){if(r.length===0)return[];let d=r.map(a=>a.categoryOptions?.length??0);if(d.some(a=>a===0))return[];let s=[];for(let a=0;a<r.length;a++){let i=[],n=1;for(let t=a+1;t<r.length;t++)n*=d[t]??1;let o=1;for(let t=0;t<a;t++)o*=d[t]??1;for(let t=0;t<o;t++)for(let l of r[a]?.categoryOptions??[])i.push({label:l.name??l.id,span:n});s.push(i)}return s}function we(r){let e=globalThis;e.dhis2=e.dhis2??{};let d=e.dhis2;d.de=d.de??{};let s=d.de;s.currentDataSetId=r.dataSetId,s.currentOrganisationUnitId=r.orgUnitId,s.currentPeriodId=r.periodId,s.currentCategorySelections={...r.aocSelections??{}};let a=r.meta??{},i={},n={};if(a.categoryCombo){n[a.categoryCombo.id]=a.categoryCombo;for(let u of a.categoryCombo.categories??[])i[u.id]=u}s.categories=i,s.categoryCombos=n;let o={},t={};for(let u of a.dataSetElements??[]){let m=u.dataElement;m&&(o[m.id]=m,m.optionSet&&(t[m.optionSet.id]=m.optionSet),m.categoryCombo&&(n[m.categoryCombo.id]=m.categoryCombo))}s.dataElements=o,s.optionSets=t;let l={};for(let u of a.indicators??[])l[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};s.indicatorFormulas=l;let c={};for(let u of r.validationRules??[])c[u.id]=u;s.validationRules=c,s.lockExceptions=[],s.emptyOrganisationUnits=[],s.significantZeros=[],s.dataSets={[a.id]:{id:a.id,name:a.name??a.displayName??"",periodType:a.periodType,categoryCombo:a.categoryCombo?.id,periodId:r.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ae(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(e,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let e=r.dhis2.period;e.format="yyyy-mm-dd",e.calendar=r.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Ne(r,e){if(!r)return;for(let[s,a]of Object.entries(e)){let i=r.querySelector(`input[data-der-category="${s}"]`);i||(i=document.createElement("input"),i.type="hidden",i.id=`category-${s}`,i.setAttribute("data-der-category",s),r.appendChild(i)),i.value=a}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...e})}function _e(r,e,d,s,a,i){let n=c=>{let u=/^(.+)-(.+)-val$/.exec(c);return u?{de:u[1],coc:u[2]}:null},o=new WeakMap,t=r.querySelectorAll('input[name$="-val"]');for(let c of Array.from(t))o.set(c,c.value);let l=async c=>{let u=c.target;if(!u||u.tagName!=="INPUT")return;let m=u.getAttribute("name")??"",E=n(m);if(!E)return;let b=e(),v=d(),$=s();if(!b||!v||!$)return;let k=u.value;if(o.get(u)!==k){z(u,"saving");try{let S=await i.submitAggregate({dataSet:b,period:v,orgUnit:$,attributeOptionComboSelections:a(),dataValues:[{dataElement:E.de,categoryOptionCombo:E.coc,value:k}]});o.set(u,k),z(u,S?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{z(u,"error")}}};r.addEventListener("blur",c=>{l(c)},!0)}function Te(r){r.addEventListener("keydown",e=>{let d=e;if(d.key!=="Enter")return;let s=d.target;if(!(s instanceof HTMLInputElement))return;let a=s.getAttribute("name")??"",i=/^(.+)-(.+)-val$/.exec(a);if(!i)return;d.preventDefault();let n=i[2],o=Array.from(r.querySelectorAll(`input[name$="-${n}-val"]`)),t=o.indexOf(s);if(t===-1)return;let l=o[t+(d.shiftKey?-1:1)];l?.focus(),l instanceof HTMLInputElement&&l.select()})}function je({targetRef:r,formVersion:e}){let[d,s]=x([]),[a,i]=x("");return R(()=>{let n=r.current;if(!n)return;let t=Array.from(n.querySelectorAll("h3.formSection")).map((l,c)=>{let u=l.id||`der-de-section-${c}`;return l.id=u,{id:u,label:(l.textContent??"").trim(),el:l}}).filter(l=>l.label);s(t),i(t[0]?.id??"")},[r,e]),R(()=>{if(d.length===0)return;let n=new IntersectionObserver(o=>{let t=null;for(let l of o){if(!l.isIntersecting)continue;let c=l.target.id;c&&(!t||l.intersectionRatio>t.ratio)&&(t={id:c,ratio:l.intersectionRatio})}t&&i(t.id)},{threshold:[0,.2,.4,.6],rootMargin:"-80px 0px -60% 0px"});for(let o of d)n.observe(o.el);return()=>n.disconnect()},[d]),d.length<2?null:h("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[p("div",{className:"der-de-section-nav__title",children:"Sections"}),p("ul",{className:"der-de-section-nav__list",children:d.map(n=>p("li",{children:p("button",{type:"button",className:"der-de-section-nav__item"+(a===n.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>{n.el.scrollIntoView({behavior:"smooth",block:"start"}),i(n.id)},children:n.label})},n.id))})]})}function Re(r,e){if(!r)return;let s=globalThis.dhis2?.de?.dataElements??{},a=Array.from(r.querySelectorAll('input[name$="-val"]')),i=[];for(let n of a){n.style.outline="";let o=n.value.trim();if(o==="")continue;let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!t)continue;let l=t[1],c=s[l],u=c?.valueType??"TEXT",m=De(o,u);m&&(n.style.outline="2px solid #a93232",i.push(`${c?.valueType?"":"(unknown DE) "}${l}: ${m}`))}i.length===0?e({kind:"ok",message:`Validation passed \u2014 all ${a.length} cells OK.`}):e({kind:"error",message:`Validation found ${i.length} issue${i.length===1?"":"s"}. First: ${i[0]}`})}function De(r,e){let d=Number(r),s=Number.isInteger(d);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(e){case"INTEGER":if(!s)return"must be an integer";break;case"INTEGER_POSITIVE":if(!s||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!s||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!s||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function z(r,e){let d=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";r.style.outline=`2px solid ${d}`,r.style.transition="outline 150ms",e==="queued"?r.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):r.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function Oe(r,e,d,s,a){if(!e||!d||!s)return;let i;try{i=(await a.readAggregateValues(s,d,2e3)).dataValues??[]}catch{return}for(let n of i){let o=n.dataElement,t=n.categoryOptionCombo,l=n.value;if(!o||!t||l==null)continue;let c=r.querySelector(`input[name="${o}-${t}-val"]`);c&&(c.value=l)}}function oe(r){return new Promise((e,d)=>{let s=document.createElement("script");s.src=r,s.async=!1,s.setAttribute("data-der-custom-form",r),s.onload=()=>e(),s.onerror=()=>d(new Error(`failed to load ${r}`)),document.head.appendChild(s)})}function ae(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=r,e.setAttribute("data-der-custom-form",r),document.head.appendChild(e)}function te(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Ie(r,e){let d=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let a of Array.from(d.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let i=a.getAttribute("href")??"";i&&ae(te(i))}else{let i=document.createElement("style");i.textContent=a.textContent??"",i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i)}a.remove()}let s=[];for(let a of Array.from(d.querySelectorAll("script"))){let i=a.getAttribute("src");i?s.push({src:te(i)}):s.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(d.body.childNodes))r.appendChild(document.adoptNode(a));for(let a of s)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await oe(a.src);else if(a.code){let i=document.createElement("script");i.textContent=a.code,i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i),i.remove()}}var P={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ne={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},re={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Me={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Pe={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function Fe(r,e,d){let s={...P},a=Le(r);if(a.length===0)return p("input",{value:e,onChange:m=>d(m.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:s});let i=[...a];if(e&&!i.some(m=>m.id===e)){let m=Ue(r,e)??e;i.unshift({id:e,label:m})}let n=a[0]?.id??null,o=i.findIndex(m=>m.id===e),t=o===-1||o<i.length-1||!!r,l=e!==""&&(o>0||e!==n),c=()=>{if(!r)return;let m=o>=0&&o<i.length-1?i[o+1]?.id??"":ie(r,e||n||"",-1);m&&d(m)},u=()=>{if(!r||!e||e===n)return;let m=o>0?i[o-1]?.id??"":ie(r,e,1);m&&d(m)};return h("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:c,disabled:!t,className:"der-de-period-btn",children:"\u25C0"}),h("select",{value:e,onChange:m=>d(m.target.value),style:s,children:[p("option",{value:"",children:"Select a period\u2026"}),i.map(m=>p("option",{value:m.id,children:m.label},m.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:u,disabled:!l,className:"der-de-period-btn",children:"\u25B6"})]})}function ie(r,e,d){let s=a=>String(a).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(e))return"";let a=Number(e.slice(0,4)),i=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),o=new Date(a,i,n+d);return`${o.getFullYear()}${s(o.getMonth()+1)}${s(o.getDate())}`}case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+d;return n<1?(i-=1,n=J(i)):n>J(i)&&(i+=1,n=1),`${i}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let a=Number(e.slice(0,4)),i=Number(e.slice(4,6))-1,n=a*12+i+d;return`${Math.floor(n/12)}${s((n%12+12)%12+1)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+d;return n<1?(i-=1,n=6):n>6&&(i+=1,n=1),`${i}${s(n)}B`}case"Quarterly":{let a=/^(\d{4})Q(\d)$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+d;return n<1?(i-=1,n=4):n>4&&(i+=1,n=1),`${i}Q${n}`}case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(e);if(!a)return"";let i=Number(a[1]),n=Number(a[2])+d;return n<1?(i-=1,n=2):n>2&&(i+=1,n=1),`${i}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+d):"";default:return""}}function Ue(r,e){let d=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(e);return s?`${s[1]} W${String(s[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let s=Number(e.slice(4,6))-1;return`${d[s]??""} ${e.slice(0,4)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(e);if(!s)return null;let a=(Number(s[2])-1)*2;return`${d[a]}\u2013${d[a+1]} ${s[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(e);return s?`${s[1]} ${s[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function Le(r){let e=new Date,d=e.getFullYear(),s=e.getMonth(),a=n=>String(n).padStart(2,"0"),i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(r){case"Daily":{let n=[];for(let o=0;o<30;o++){let t=new Date(e);t.setDate(t.getDate()-o);let l=`${t.getFullYear()}${a(t.getMonth()+1)}${a(t.getDate())}`,c=`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`;n.push({id:l,label:c})}return n}case"Weekly":{let n=[],o=se(e),t=o.year,l=o.week;for(let c=0;c<12;c++)n.push({id:`${t}W${l}`,label:`${t} W${a(l)}`}),l-=1,l<1&&(t-=1,l=J(t));return n}case"Monthly":{let n=[];for(let o=0;o<24;o++){let t=d,l=s,c=t*12+l-o,u=Math.floor(c/12),m=(c%12+12)%12;n.push({id:`${u}${a(m+1)}`,label:`${i[m]} ${u}`})}return n}case"BiMonthly":{let n=[],o=Math.floor(s/2)+1,t=d,l=o;for(let c=0;c<12;c++){let u=(l-1)*2;n.push({id:`${t}${a(l)}B`,label:`${i[u]}\u2013${i[u+1]} ${t}`}),l-=1,l<1&&(t-=1,l=6)}return n}case"Quarterly":{let n=[],o=Math.floor(s/3)+1,t=d,l=o;for(let c=0;c<8;c++)n.push({id:`${t}Q${l}`,label:`${t} Q${l}`}),l-=1,l<1&&(t-=1,l=4);return n}case"SixMonthly":{let n=[],o=s<6?1:2,t=d,l=o;for(let c=0;c<6;c++)n.push({id:`${t}S${l}`,label:`${t} ${l===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),l-=1,l<1&&(t-=1,l=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let o=0;o<10;o++){let t=d-o;n.push({id:String(t),label:String(t)})}return n}default:return[]}}function se(r){let e=new Date(r.getFullYear(),r.getMonth(),r.getDate()),d=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-d);let s=new Date(e.getFullYear(),0,1),i=Math.round((e.getTime()-s.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((i+1)/7)}}function J(r){return se(new Date(r,11,28)).week}var qe=`
.der-de-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
}
.der-de-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-chip-signed {
  background: #f3f5f7;
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
  padding: 20px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-form-card .der-de-form-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef0f3;
  gap: 8px;
}
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
    top: 80px;
    align-self: start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding: 12px 8px;
    background: #fafbfc;
    border: 1px solid #eef0f3;
    border-radius: 6px;
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
  border: 1px solid #d7dde5;
  padding: 6px 8px;
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable th {
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #f8fafc;
  min-width: 220px;
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
  border: 0;
  background: transparent;
  padding: 2px 4px;
  font-size: 13px;
  color: #212934;
  font-family: inherit;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 1px solid #2c6693;
  background: #fff;
}
.der-de-form-card h3.formSection {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: #1f4d70;
  border-bottom: 1px solid #d7dde5;
  padding-bottom: 4px;
}
`;export{xe as default};
