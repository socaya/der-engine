/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as P,useRef as J,useState as w}from"react";import{useAuth as te,useOrgUnitBinding as re,useOnlineStatus as ne,useDerApi as ae,ScreenCard as se,StatusPill as oe}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function ie(){let a=te(),e=re(),i=ne(),s=ae(),[t,r]=w("custom"),[n,l]=w([]),[o,d]=w(""),[c,m]=w(""),[u,f]=w(""),[h,C]=w(""),[_,j]=w({kind:"idle"}),[x,D]=w(null),R=J(null),[Q,L]=w({}),O=J({}),[M,K]=w([]);P(()=>{let g=!1;return(async()=>{try{let y=await s.listDataSets();if(g)return;let S=(y.dataSets??[]).map($=>({id:$.id,label:$.displayName??$.name??$.id,periodType:$.periodType,formType:$.formType})).sort(($,I)=>$.label.localeCompare(I.label));l(S)}catch{}})(),()=>{g=!0}},[]),P(()=>{if(o.trim()===""){D(null);return}let g=!1;return(async()=>{try{let y=await s.getDataSetMeta(o.trim());if(g)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";D({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),r(S?"custom":"structured")}catch{g||D(null)}})(),()=>{g=!0}},[o]),P(()=>{if(t!=="custom"||!x?.hasCustomForm||!x.formId)return;let g=R.current;if(!g)return;let y=!1;return(async()=>{j({kind:"submitting"});try{let S=await s.getDataSetFormMetadata(o.trim());if(y)return;let $="";if(x.formType==="CUSTOM"&&x.formId?$=(await s.getDataEntryFormHtml(x.formId)).htmlCode??"":x.formType==="SECTION"&&($=le(S)),y)return;let I=await s.listValidationRules(o.trim()).catch(()=>({validationRules:[]}));if(y)return;let B=(S.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(A=>({id:A.id,name:A.name??A.id}))}));K(B);let E={};for(let b of B)b.options[0]&&(E[b.id]=b.options[0].id);L(E),O.current=E,g.replaceChildren();for(let[b,A]of[["selectedDataSetId",o.trim()],["selectedPeriodId",c.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let k=document.createElement("input");k.type="hidden",k.id=b,k.value=A,g.appendChild(k)}for(let[b,A]of Object.entries(E)){let k=document.createElement("input");k.type="hidden",k.id=`category-${b}`,k.value=A,k.setAttribute("data-der-category",b),g.appendChild(k)}let N=document.createElement("div");N.id="contentDiv",g.appendChild(N),me({dataSetId:o.trim(),periodId:c.trim(),orgUnitId:e.orgUnitUid??"",meta:S,aocSelections:E,validationRules:I.validationRules??[]});for(let b of ce)G(b);for(let b of de)document.querySelector(`script[data-der-custom-form="${b}"]`)||await z(b);ge(),await be(N,$),await ye(N,o.trim(),c.trim(),e.orgUnitUid??"",s),fe(N,()=>o.trim(),()=>c.trim(),()=>e.orgUnitUid??"",()=>({...O.current}),s),j({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(S){j({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[t,x,o,c,e.orgUnitUid]);let Z=e.bound&&o.trim()!==""&&c.trim()!==""&&u.trim()!==""&&h.trim()!==""&&_.kind!=="submitting";async function ee(g){g.preventDefault(),j({kind:"submitting"});try{await s.submitAggregate({dataSet:o,period:c,orgUnit:e.orgUnitUid,dataValues:[{dataElement:u,value:h}]}),j({kind:"ok",message:`Submitted ${u}=${h} for ${c}.`}),f(""),C("")}catch(y){j({kind:"error",message:y.message??"Submission failed"})}}let H=c.trim()!=="",F=o.trim()!=="",V=F&&H&&e.bound;return v(se,{title:"Aggregate data entry",actions:p(oe,{tone:i.isOnline?"success":"warning",children:i.isOnline?"online":`offline (${i.queuedCount} queued)`}),children:[p("style",{children:ke}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:o,onChange:g=>{d(g.target.value),m("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),n.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",x?.periodType?`\xB7 ${x.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:$e(x?.periodType,c,m)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:a.displayName})]})]}),_.kind==="ok"&&p("div",{style:ve,"data-test":"de-ok",children:_.message}),_.kind==="error"&&p("div",{style:Se,"data-test":"de-err",children:_.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!F&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&F&&!H&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),V&&t==="structured"&&v("form",{onSubmit:ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:u,onChange:g=>f(g.target.value),style:T})]}),v("label",{children:["Value",p("input",{value:h,onChange:g=>C(g.target.value),inputMode:"decimal",style:T})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!Z,style:he,children:_.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),V&&t==="custom"&&v("div",{className:"der-de-form-card",children:[M.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(M.length,3)}, 1fr)`,gap:12,marginBottom:12},children:M.map(g=>v("label",{children:[g.name,p("select",{value:Q[g.id]??"",onChange:y=>{let S={...Q,[g.id]:y.target.value};L(S),O.current=S,pe(R.current,S)},style:T,children:g.options.map(y=>p("option",{value:y.id,children:y.name},y.id))})]},g.id))}),p("div",{ref:R,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var de=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ce=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function le(a){let e={};for(let n of a.dataSetElements??[])n.dataElement&&(e[n.dataElement.id]=n.dataElement);let i={};for(let n of a.indicators??[])i[n.id]=n;let s=(a.sections??[]).slice().sort((n,l)=>(n.sortOrder??0)-(l.sortOrder??0)),t=n=>n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let n of s){let l=new Set;for(let d of n.greyedFields??[])d.dataElement?.id&&d.categoryOptionCombo?.id&&l.add(`${d.dataElement.id}:${d.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${t(n.name??"")}</h3>`);let o=new Map;for(let d of n.dataElements??[]){let c=e[d.id];if(!c?.categoryCombo)continue;let m=c.categoryCombo.id,u=o.get(m);u||(u={cc:c.categoryCombo,des:[]},o.set(m,u)),u.des.push(c)}for(let d of o.values()){let c=d.cc.categoryOptionCombos??[],m=d.cc.categories??[];r.push('<table class="sectionTable" cellspacing="0">');let u=ue(m,c);if(r.push("<thead>"),u.length>0)for(let f=0;f<u.length;f++){r.push("<tr>"),f===0&&r.push(`<th class="dataElementCell" rowspan="${u.length}">`+t(d.cc.name??"Data element")+"</th>");for(let h of u[f]??[])r.push(`<th colspan="${h.span}">${t(h.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${t(d.cc.name??"Data element")}</th>`);for(let f of c)r.push(`<th>${t(f.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let f of d.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let h of c){let C=`${f.id}-${h.id}-val`;l.has(`${f.id}:${h.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${t(C)}" name="${t(C)}" dataelementid="${t(f.id)}" optioncomboid="${t(h.id)}"></td>`)}r.push("</tr>")}for(let f of n.indicators??[]){let h=i[f.id];h&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${t(h.name??h.id)}</td>`),r.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${t(h.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table>")}}return r.join(`
`)}function ue(a,e){if(a.length===0)return[];let i=a.map(t=>t.categoryOptions?.length??0);if(i.some(t=>t===0))return[];let s=[];for(let t=0;t<a.length;t++){let r=[],n=1;for(let o=t+1;o<a.length;o++)n*=i[o]??1;let l=1;for(let o=0;o<t;o++)l*=i[o]??1;for(let o=0;o<l;o++)for(let d of a[t]?.categoryOptions??[])r.push({label:d.name??d.id,span:n});s.push(r)}return s}function me(a){let e=globalThis;e.dhis2=e.dhis2??{};let i=e.dhis2;i.de=i.de??{};let s=i.de;s.currentDataSetId=a.dataSetId,s.currentOrganisationUnitId=a.orgUnitId,s.currentPeriodId=a.periodId,s.currentCategorySelections={...a.aocSelections??{}};let t=a.meta??{},r={},n={};if(t.categoryCombo){n[t.categoryCombo.id]=t.categoryCombo;for(let m of t.categoryCombo.categories??[])r[m.id]=m}s.categories=r,s.categoryCombos=n;let l={},o={};for(let m of t.dataSetElements??[]){let u=m.dataElement;u&&(l[u.id]=u,u.optionSet&&(o[u.optionSet.id]=u.optionSet),u.categoryCombo&&(n[u.categoryCombo.id]=u.categoryCombo))}s.dataElements=l,s.optionSets=o;let d={};for(let m of t.indicators??[])d[m.id]={explodedNumerator:m.numerator,denominator:m.denominator,factor:m.indicatorType?.factor??1};s.indicatorFormulas=d;let c={};for(let m of a.validationRules??[])c[m.id]=m;s.validationRules=c,s.lockExceptions=[],s.emptyOrganisationUnits=[],s.significantZeros=[],s.dataSets={[t.id]:{id:t.id,name:t.name??t.displayName??"",periodType:t.periodType,categoryCombo:t.categoryCombo?.id,periodId:a.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,i.shim=i.shim??{},i.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ge(){let a=globalThis;if(a.$&&typeof a.$.ajaxSetup=="function"&&a.$.ajaxSetup({beforeSend:(e,i)=>{i.xhrFields={...i.xhrFields??{},withCredentials:!0}}}),a.dhis2?.period&&a.$?.calendars?.instance){let e=a.dhis2.period;e.format="yyyy-mm-dd",e.calendar=a.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function pe(a,e){if(!a)return;for(let[s,t]of Object.entries(e)){let r=a.querySelector(`input[data-der-category="${s}"]`);r||(r=document.createElement("input"),r.type="hidden",r.id=`category-${s}`,r.setAttribute("data-der-category",s),a.appendChild(r)),r.value=t}let i=globalThis;i.dhis2?.de&&(i.dhis2.de.currentCategorySelections={...e})}function fe(a,e,i,s,t,r){let n=c=>{let m=/^(.+)-(.+)-val$/.exec(c);return m?{de:m[1],coc:m[2]}:null},l=new WeakMap,o=a.querySelectorAll('input[name$="-val"]');for(let c of Array.from(o))l.set(c,c.value);let d=async c=>{let m=c.target;if(!m||m.tagName!=="INPUT")return;let u=m.getAttribute("name")??"",f=n(u);if(!f)return;let h=e(),C=i(),_=s();if(!h||!C||!_)return;let j=m.value;if(l.get(m)!==j){q(m,"saving");try{await r.submitAggregate({dataSet:h,period:C,orgUnit:_,attributeOptionComboSelections:t(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:j}]}),l.set(m,j),q(m,"saved")}catch{q(m,"error")}}};a.addEventListener("blur",c=>{d(c)},!0)}function q(a,e){let i=e==="saving"?"#b9860a":e==="saved"?"#1a8754":"#a93232";a.style.outline=`2px solid ${i}`,a.style.transition="outline 150ms",e==="saved"&&window.setTimeout(()=>{a.style.outline.includes("#1a8754")&&(a.style.outline="1px solid #b7dcc7")},1200)}async function ye(a,e,i,s,t){if(!e||!i||!s)return;let r;try{r=(await t.readAggregateValues(s,i,2e3)).dataValues??[]}catch{return}for(let n of r){let l=n.dataElement,o=n.categoryOptionCombo,d=n.value;if(!l||!o||d==null)continue;let c=a.querySelector(`input[name="${l}-${o}-val"]`);c&&(c.value=d)}}function z(a){return new Promise((e,i)=>{let s=document.createElement("script");s.src=a,s.async=!1,s.setAttribute("data-der-custom-form",a),s.onload=()=>e(),s.onerror=()=>i(new Error(`failed to load ${a}`)),document.head.appendChild(s)})}function G(a){if(document.querySelector(`link[data-der-custom-form="${a}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=a,e.setAttribute("data-der-custom-form",a),document.head.appendChild(e)}function W(a){return!a||/^https?:\/\//i.test(a)||a.startsWith("/legacy-custom-forms/")||a.startsWith("/")?a:`/legacy-custom-forms/${a.replace(/^(?:\.{1,2}\/)+/,"")}`}async function be(a,e){let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let t of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let r=t.getAttribute("href")??"";r&&G(W(r))}else{let r=document.createElement("style");r.textContent=t.textContent??"",r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r)}t.remove()}let s=[];for(let t of Array.from(i.querySelectorAll("script"))){let r=t.getAttribute("src");r?s.push({src:W(r)}):s.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(i.body.childNodes))a.appendChild(document.adoptNode(t));for(let t of s)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await z(t.src);else if(t.code){let r=document.createElement("script");r.textContent=t.code,r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r),r.remove()}}var T={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},he={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},ve={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},Se={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function $e(a,e,i){let s={...T},t=je(a);if(t.length===0)return p("input",{value:e,onChange:u=>i(u.target.value),placeholder:a?`DHIS2 ${a} period id`:"e.g. 202611",style:s});let r=[...t];if(e&&!r.some(u=>u.id===e)){let u=xe(a,e)??e;r.unshift({id:e,label:u})}let n=t[0]?.id??null,l=r.findIndex(u=>u.id===e),o=l===-1||l<r.length-1||!!a,d=e!==""&&(l>0||e!==n),c=()=>{if(!a)return;let u=l>=0&&l<r.length-1?r[l+1]?.id??"":Y(a,e||n||"",-1);u&&i(u)},m=()=>{if(!a||!e||e===n)return;let u=l>0?r[l-1]?.id??"":Y(a,e,1);u&&i(u)};return v("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:c,disabled:!o,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:e,onChange:u=>i(u.target.value),style:s,children:[p("option",{value:"",children:"Select a period\u2026"}),r.map(u=>p("option",{value:u.id,children:u.label},u.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:m,disabled:!d,className:"der-de-period-btn",children:"\u25B6"})]})}function Y(a,e,i){let s=t=>String(t).padStart(2,"0");switch(a){case"Daily":{if(!/^\d{8}$/.test(e))return"";let t=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),l=new Date(t,r,n+i);return`${l.getFullYear()}${s(l.getMonth()+1)}${s(l.getDate())}`}case"Weekly":{let t=/^(\d{4})W(\d{1,2})$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=U(r)):n>U(r)&&(r+=1,n=1),`${r}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let t=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,n=t*12+r+i;return`${Math.floor(n/12)}${s((n%12+12)%12+1)}`}case"BiMonthly":{let t=/^(\d{4})(\d{2})B$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=6):n>6&&(r+=1,n=1),`${r}${s(n)}B`}case"Quarterly":{let t=/^(\d{4})Q(\d)$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=4):n>4&&(r+=1,n=1),`${r}Q${n}`}case"SixMonthly":{let t=/^(\d{4})S(\d)$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=2):n>2&&(r+=1,n=1),`${r}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+i):"";default:return""}}function xe(a,e){let i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(a){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let s=/^(\d{4})W(\d{1,2})$/.exec(e);return s?`${s[1]} W${String(s[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let s=Number(e.slice(4,6))-1;return`${i[s]??""} ${e.slice(0,4)}`}case"BiMonthly":{let s=/^(\d{4})(\d{2})B$/.exec(e);if(!s)return null;let t=(Number(s[2])-1)*2;return`${i[t]}\u2013${i[t+1]} ${s[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let s=/^(\d{4})S(\d)$/.exec(e);return s?`${s[1]} ${s[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function je(a){let e=new Date,i=e.getFullYear(),s=e.getMonth(),t=n=>String(n).padStart(2,"0"),r=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(a){case"Daily":{let n=[];for(let l=0;l<30;l++){let o=new Date(e);o.setDate(o.getDate()-l);let d=`${o.getFullYear()}${t(o.getMonth()+1)}${t(o.getDate())}`,c=`${o.getFullYear()}-${t(o.getMonth()+1)}-${t(o.getDate())}`;n.push({id:d,label:c})}return n}case"Weekly":{let n=[],l=X(e),o=l.year,d=l.week;for(let c=0;c<12;c++)n.push({id:`${o}W${d}`,label:`${o} W${t(d)}`}),d-=1,d<1&&(o-=1,d=U(o));return n}case"Monthly":{let n=[];for(let l=0;l<24;l++){let o=i,d=s,c=o*12+d-l,m=Math.floor(c/12),u=(c%12+12)%12;n.push({id:`${m}${t(u+1)}`,label:`${r[u]} ${m}`})}return n}case"BiMonthly":{let n=[],l=Math.floor(s/2)+1,o=i,d=l;for(let c=0;c<12;c++){let m=(d-1)*2;n.push({id:`${o}${t(d)}B`,label:`${r[m]}\u2013${r[m+1]} ${o}`}),d-=1,d<1&&(o-=1,d=6)}return n}case"Quarterly":{let n=[],l=Math.floor(s/3)+1,o=i,d=l;for(let c=0;c<8;c++)n.push({id:`${o}Q${d}`,label:`${o} Q${d}`}),d-=1,d<1&&(o-=1,d=4);return n}case"SixMonthly":{let n=[],l=s<6?1:2,o=i,d=l;for(let c=0;c<6;c++)n.push({id:`${o}S${d}`,label:`${o} ${d===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),d-=1,d<1&&(o-=1,d=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let l=0;l<10;l++){let o=i-l;n.push({id:String(o),label:String(o)})}return n}default:return[]}}function X(a){let e=new Date(a.getFullYear(),a.getMonth(),a.getDate()),i=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-i);let s=new Date(e.getFullYear(),0,1),r=Math.round((e.getTime()-s.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((r+1)/7)}}function U(a){return X(new Date(a,11,28)).week}var ke=`
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
`;export{ie as default};
