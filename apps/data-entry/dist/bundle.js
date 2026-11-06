/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.1","requiresDerApi":"1.0.0"} */
import{useEffect as q,useRef as J,useState as w}from"react";import{useAuth as te,useOrgUnitBinding as re,useOnlineStatus as ne,useDerApi as ae,ScreenCard as oe,StatusPill as se}from"@der/app-sdk";import{jsx as p,jsxs as v}from"react/jsx-runtime";function ie(){let a=te(),e=re(),i=ne(),o=ae(),[t,r]=w("custom"),[n,c]=w([]),[s,d]=w(""),[l,m]=w(""),[u,f]=w(""),[h,_]=w(""),[A,j]=w({kind:"idle"}),[x,D]=w(null),M=J(null),[Q,L]=w({}),O=J({}),[R,X]=w([]);q(()=>{let g=!1;return(async()=>{try{let y=await o.listDataSets();if(g)return;let S=(y.dataSets??[]).map($=>({id:$.id,label:$.displayName??$.name??$.id,periodType:$.periodType,formType:$.formType})).sort(($,I)=>$.label.localeCompare(I.label));c(S)}catch{}})(),()=>{g=!0}},[]),q(()=>{if(s.trim()===""){D(null);return}let g=!1;return(async()=>{try{let y=await o.getDataSetMeta(s.trim());if(g)return;let S=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";D({hasCustomForm:S,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),r(S?"custom":"structured")}catch{g||D(null)}})(),()=>{g=!0}},[s]),q(()=>{if(t!=="custom"||!x?.hasCustomForm||!x.formId)return;let g=M.current;if(!g)return;let y=!1;return(async()=>{j({kind:"submitting"});try{let S=await o.getDataSetFormMetadata(s.trim());if(y)return;let $="";if(x.formType==="CUSTOM"&&x.formId?$=(await o.getDataEntryFormHtml(x.formId)).htmlCode??"":x.formType==="SECTION"&&($=le(S)),y)return;let I=await o.listValidationRules(s.trim()).catch(()=>({validationRules:[]}));if(y)return;let B=(S.categoryCombo?.categories??[]).filter(b=>(b.categoryOptions?.length??0)>1).map(b=>({id:b.id,name:b.name??b.id,options:(b.categoryOptions??[]).map(C=>({id:C.id,name:C.name??C.id}))}));X(B);let T={};for(let b of B)b.options[0]&&(T[b.id]=b.options[0].id);L(T),O.current=T,g.replaceChildren();for(let[b,C]of[["selectedDataSetId",s.trim()],["selectedPeriodId",l.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let k=document.createElement("input");k.type="hidden",k.id=b,k.value=C,g.appendChild(k)}for(let[b,C]of Object.entries(T)){let k=document.createElement("input");k.type="hidden",k.id=`category-${b}`,k.value=C,k.setAttribute("data-der-category",b),g.appendChild(k)}let E=document.createElement("div");E.id="contentDiv",g.appendChild(E),me({dataSetId:s.trim(),periodId:l.trim(),orgUnitId:e.orgUnitUid??"",meta:S,aocSelections:T,validationRules:I.validationRules??[]});for(let b of ce)G(b);for(let b of de)document.querySelector(`script[data-der-custom-form="${b}"]`)||await z(b);ge(),await he(E,$),await be(E,s.trim(),l.trim(),e.orgUnitUid??"",o),fe(E,()=>s.trim(),()=>l.trim(),()=>e.orgUnitUid??"",()=>({...O.current}),o),ye(E),j({kind:"ok",message:"Custom form loaded. Autosave + validation run as in DHIS2."})}catch(S){j({kind:"error",message:`custom form failed to render: ${S.message}`})}})(),()=>{y=!0}},[t,x,s,l,e.orgUnitUid]);let Z=e.bound&&s.trim()!==""&&l.trim()!==""&&u.trim()!==""&&h.trim()!==""&&A.kind!=="submitting";async function ee(g){g.preventDefault(),j({kind:"submitting"});try{await o.submitAggregate({dataSet:s,period:l,orgUnit:e.orgUnitUid,dataValues:[{dataElement:u,value:h}]}),j({kind:"ok",message:`Submitted ${u}=${h} for ${l}.`}),f(""),_("")}catch(y){j({kind:"error",message:y.message??"Submission failed"})}}let H=l.trim()!=="",F=s.trim()!=="",V=F&&H&&e.bound;return v(oe,{title:"Aggregate data entry",actions:p(se,{tone:i.isOnline?"success":"warning",children:i.isOnline?"online":`offline (${i.queuedCount} queued)`}),children:[p("style",{children:we}),v("div",{className:"der-de-context",children:[v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Organisation unit"}),p("span",{className:"der-de-chip-value",title:e.orgUnitPath||e.orgUnitUid||"",children:e.orgUnitDisplayName||e.orgUnitUid||"\u2014"})]}),v("div",{className:"der-de-chip",children:[p("span",{className:"der-de-chip-label",children:"Data set"}),v("select",{className:"der-de-select",value:s,onChange:g=>{d(g.target.value),m("")},"data-test":"der-de-dataset-picker",children:[p("option",{value:"",children:"Select a data set\u2026"}),n.map(g=>p("option",{value:g.id,children:g.label},g.id))]})]}),v("div",{className:"der-de-chip",children:[v("span",{className:"der-de-chip-label",children:["Period ",x?.periodType?`\xB7 ${x.periodType}`:""]}),p("span",{className:"der-de-period-wrap",children:xe(x?.periodType,l,m)})]}),v("div",{className:"der-de-chip der-de-chip-signed",children:[p("span",{className:"der-de-chip-label",children:"Signed in"}),p("span",{className:"der-de-chip-value",children:a.displayName})]})]}),A.kind==="ok"&&p("div",{style:Se,"data-test":"de-ok",children:A.message}),A.kind==="error"&&p("div",{style:$e,"data-test":"de-err",children:A.message}),!e.bound&&p("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!F&&p("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&F&&!H&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",x?.formType==="SECTION"?"section":"data entry"," form."]}),V&&t==="structured"&&v("form",{onSubmit:ee,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",p("input",{value:u,onChange:g=>f(g.target.value),style:N})]}),v("label",{children:["Value",p("input",{value:h,onChange:g=>_(g.target.value),inputMode:"decimal",style:N})]}),p("div",{style:{gridColumn:"1 / -1"},children:p("button",{type:"submit",disabled:!Z,style:ve,children:A.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),V&&t==="custom"&&v("div",{className:"der-de-form-card",children:[R.length>0&&p("div",{style:{display:"grid",gridTemplateColumns:`repeat(${Math.min(R.length,3)}, 1fr)`,gap:12,marginBottom:12},children:R.map(g=>v("label",{children:[g.name,p("select",{value:Q[g.id]??"",onChange:y=>{let S={...Q,[g.id]:y.target.value};L(S),O.current=S,pe(M.current,S)},style:N,children:g.options.map(y=>p("option",{value:y.id,children:y.name},y.id))})]},g.id))}),p("div",{ref:M,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})]})}var de=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],ce=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"];function le(a){let e={};for(let n of a.dataSetElements??[])n.dataElement&&(e[n.dataElement.id]=n.dataElement);let i={};for(let n of a.indicators??[])i[n.id]=n;let o=(a.sections??[]).slice().sort((n,c)=>(n.sortOrder??0)-(c.sortOrder??0)),t=n=>n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let n of o){let c=new Set;for(let d of n.greyedFields??[])d.dataElement?.id&&d.categoryOptionCombo?.id&&c.add(`${d.dataElement.id}:${d.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${t(n.name??"")}</h3>`);let s=new Map;for(let d of n.dataElements??[]){let l=e[d.id];if(!l?.categoryCombo)continue;let m=l.categoryCombo.id,u=s.get(m);u||(u={cc:l.categoryCombo,des:[]},s.set(m,u)),u.des.push(l)}for(let d of s.values()){let l=d.cc.categoryOptionCombos??[],m=d.cc.categories??[];r.push('<table class="sectionTable" cellspacing="0">');let u=ue(m,l);if(r.push("<thead>"),u.length>0)for(let f=0;f<u.length;f++){r.push("<tr>"),f===0&&r.push(`<th class="dataElementCell" rowspan="${u.length}">`+t(d.cc.name??"Data element")+"</th>");for(let h of u[f]??[])r.push(`<th colspan="${h.span}">${t(h.label)}</th>`);r.push("</tr>")}else{r.push("<tr>"),r.push(`<th class="dataElementCell">${t(d.cc.name??"Data element")}</th>`);for(let f of l)r.push(`<th>${t(f.name??"")}</th>`);r.push("</tr>")}r.push("</thead><tbody>");for(let f of d.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${t(f.id)}-cell">`+t(f.formName??f.name??f.id)+"</td>");for(let h of l){let _=`${f.id}-${h.id}-val`;c.has(`${f.id}:${h.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${t(_)}" name="${t(_)}" dataelementid="${t(f.id)}" optioncomboid="${t(h.id)}"></td>`)}r.push("</tr>")}for(let f of n.indicators??[]){let h=i[f.id];h&&(r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${t(h.name??h.id)}</td>`),r.push(`<td colspan="${l.length}"><input type="text" name="indicator" indicatorid="${t(h.id)}" readonly></td>`),r.push("</tr>"))}r.push("</tbody></table>")}}return r.join(`
`)}function ue(a,e){if(a.length===0)return[];let i=a.map(t=>t.categoryOptions?.length??0);if(i.some(t=>t===0))return[];let o=[];for(let t=0;t<a.length;t++){let r=[],n=1;for(let s=t+1;s<a.length;s++)n*=i[s]??1;let c=1;for(let s=0;s<t;s++)c*=i[s]??1;for(let s=0;s<c;s++)for(let d of a[t]?.categoryOptions??[])r.push({label:d.name??d.id,span:n});o.push(r)}return o}function me(a){let e=globalThis;e.dhis2=e.dhis2??{};let i=e.dhis2;i.de=i.de??{};let o=i.de;o.currentDataSetId=a.dataSetId,o.currentOrganisationUnitId=a.orgUnitId,o.currentPeriodId=a.periodId,o.currentCategorySelections={...a.aocSelections??{}};let t=a.meta??{},r={},n={};if(t.categoryCombo){n[t.categoryCombo.id]=t.categoryCombo;for(let m of t.categoryCombo.categories??[])r[m.id]=m}o.categories=r,o.categoryCombos=n;let c={},s={};for(let m of t.dataSetElements??[]){let u=m.dataElement;u&&(c[u.id]=u,u.optionSet&&(s[u.optionSet.id]=u.optionSet),u.categoryCombo&&(n[u.categoryCombo.id]=u.categoryCombo))}o.dataElements=c,o.optionSets=s;let d={};for(let m of t.indicators??[])d[m.id]={explodedNumerator:m.numerator,denominator:m.denominator,factor:m.indicatorType?.factor??1};o.indicatorFormulas=d;let l={};for(let m of a.validationRules??[])l[m.id]=m;o.validationRules=l,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[t.id]:{id:t.id,name:t.name??t.displayName??"",periodType:t.periodType,categoryCombo:t.categoryCombo?.id,periodId:a.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,i.shim=i.shim??{},i.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ge(){let a=globalThis;if(a.$&&typeof a.$.ajaxSetup=="function"&&a.$.ajaxSetup({beforeSend:(e,i)=>{i.xhrFields={...i.xhrFields??{},withCredentials:!0}}}),a.dhis2?.period&&a.$?.calendars?.instance){let e=a.dhis2.period;e.format="yyyy-mm-dd",e.calendar=a.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function pe(a,e){if(!a)return;for(let[o,t]of Object.entries(e)){let r=a.querySelector(`input[data-der-category="${o}"]`);r||(r=document.createElement("input"),r.type="hidden",r.id=`category-${o}`,r.setAttribute("data-der-category",o),a.appendChild(r)),r.value=t}let i=globalThis;i.dhis2?.de&&(i.dhis2.de.currentCategorySelections={...e})}function fe(a,e,i,o,t,r){let n=l=>{let m=/^(.+)-(.+)-val$/.exec(l);return m?{de:m[1],coc:m[2]}:null},c=new WeakMap,s=a.querySelectorAll('input[name$="-val"]');for(let l of Array.from(s))c.set(l,l.value);let d=async l=>{let m=l.target;if(!m||m.tagName!=="INPUT")return;let u=m.getAttribute("name")??"",f=n(u);if(!f)return;let h=e(),_=i(),A=o();if(!h||!_||!A)return;let j=m.value;if(c.get(m)!==j){P(m,"saving");try{await r.submitAggregate({dataSet:h,period:_,orgUnit:A,attributeOptionComboSelections:t(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:j}]}),c.set(m,j),P(m,"saved")}catch{P(m,"error")}}};a.addEventListener("blur",l=>{d(l)},!0)}function ye(a){a.addEventListener("keydown",e=>{let i=e;if(i.key!=="Enter")return;let o=i.target;if(!(o instanceof HTMLInputElement))return;let t=o.getAttribute("name")??"",r=/^(.+)-(.+)-val$/.exec(t);if(!r)return;i.preventDefault();let n=r[2],c=Array.from(a.querySelectorAll(`input[name$="-${n}-val"]`)),s=c.indexOf(o);if(s===-1)return;let d=c[s+(i.shiftKey?-1:1)];d?.focus(),d instanceof HTMLInputElement&&d.select()})}function P(a,e){let i=e==="saving"?"#b9860a":e==="saved"?"#1a8754":"#a93232";a.style.outline=`2px solid ${i}`,a.style.transition="outline 150ms",e==="saved"&&window.setTimeout(()=>{a.style.outline.includes("#1a8754")&&(a.style.outline="1px solid #b7dcc7")},1200)}async function be(a,e,i,o,t){if(!e||!i||!o)return;let r;try{r=(await t.readAggregateValues(o,i,2e3)).dataValues??[]}catch{return}for(let n of r){let c=n.dataElement,s=n.categoryOptionCombo,d=n.value;if(!c||!s||d==null)continue;let l=a.querySelector(`input[name="${c}-${s}-val"]`);l&&(l.value=d)}}function z(a){return new Promise((e,i)=>{let o=document.createElement("script");o.src=a,o.async=!1,o.setAttribute("data-der-custom-form",a),o.onload=()=>e(),o.onerror=()=>i(new Error(`failed to load ${a}`)),document.head.appendChild(o)})}function G(a){if(document.querySelector(`link[data-der-custom-form="${a}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=a,e.setAttribute("data-der-custom-form",a),document.head.appendChild(e)}function W(a){return!a||/^https?:\/\//i.test(a)||a.startsWith("/legacy-custom-forms/")||a.startsWith("/")?a:`/legacy-custom-forms/${a.replace(/^(?:\.{1,2}\/)+/,"")}`}async function he(a,e){let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let t of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let r=t.getAttribute("href")??"";r&&G(W(r))}else{let r=document.createElement("style");r.textContent=t.textContent??"",r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r)}t.remove()}let o=[];for(let t of Array.from(i.querySelectorAll("script"))){let r=t.getAttribute("src");r?o.push({src:W(r)}):o.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(i.body.childNodes))a.appendChild(document.adoptNode(t));for(let t of o)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await z(t.src);else if(t.code){let r=document.createElement("script");r.textContent=t.code,r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r),r.remove()}}var N={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:2,fontSize:13,fontFamily:"inherit"},ve={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:2,fontSize:13,fontWeight:500,cursor:"pointer"},Se={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:3},$e={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:3};function xe(a,e,i){let o={...N},t=ke(a);if(t.length===0)return p("input",{value:e,onChange:u=>i(u.target.value),placeholder:a?`DHIS2 ${a} period id`:"e.g. 202611",style:o});let r=[...t];if(e&&!r.some(u=>u.id===e)){let u=je(a,e)??e;r.unshift({id:e,label:u})}let n=t[0]?.id??null,c=r.findIndex(u=>u.id===e),s=c===-1||c<r.length-1||!!a,d=e!==""&&(c>0||e!==n),l=()=>{if(!a)return;let u=c>=0&&c<r.length-1?r[c+1]?.id??"":Y(a,e||n||"",-1);u&&i(u)},m=()=>{if(!a||!e||e===n)return;let u=c>0?r[c-1]?.id??"":Y(a,e,1);u&&i(u)};return v("span",{className:"der-de-period-nav",children:[p("button",{type:"button","aria-label":"Previous period",onClick:l,disabled:!s,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:e,onChange:u=>i(u.target.value),style:o,children:[p("option",{value:"",children:"Select a period\u2026"}),r.map(u=>p("option",{value:u.id,children:u.label},u.id))]}),p("button",{type:"button","aria-label":"Next period",onClick:m,disabled:!d,className:"der-de-period-btn",children:"\u25B6"})]})}function Y(a,e,i){let o=t=>String(t).padStart(2,"0");switch(a){case"Daily":{if(!/^\d{8}$/.test(e))return"";let t=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,n=Number(e.slice(6,8)),c=new Date(t,r,n+i);return`${c.getFullYear()}${o(c.getMonth()+1)}${o(c.getDate())}`}case"Weekly":{let t=/^(\d{4})W(\d{1,2})$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=U(r)):n>U(r)&&(r+=1,n=1),`${r}W${n}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let t=Number(e.slice(0,4)),r=Number(e.slice(4,6))-1,n=t*12+r+i;return`${Math.floor(n/12)}${o((n%12+12)%12+1)}`}case"BiMonthly":{let t=/^(\d{4})(\d{2})B$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=6):n>6&&(r+=1,n=1),`${r}${o(n)}B`}case"Quarterly":{let t=/^(\d{4})Q(\d)$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=4):n>4&&(r+=1,n=1),`${r}Q${n}`}case"SixMonthly":{let t=/^(\d{4})S(\d)$/.exec(e);if(!t)return"";let r=Number(t[1]),n=Number(t[2])+i;return n<1?(r-=1,n=2):n>2&&(r+=1,n=1),`${r}S${n}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+i):"";default:return""}}function je(a,e){let i=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(a){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${i[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let t=(Number(o[2])-1)*2;return`${i[t]}\u2013${i[t+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function ke(a){let e=new Date,i=e.getFullYear(),o=e.getMonth(),t=n=>String(n).padStart(2,"0"),r=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];switch(a){case"Daily":{let n=[];for(let c=0;c<30;c++){let s=new Date(e);s.setDate(s.getDate()-c);let d=`${s.getFullYear()}${t(s.getMonth()+1)}${t(s.getDate())}`,l=`${s.getFullYear()}-${t(s.getMonth()+1)}-${t(s.getDate())}`;n.push({id:d,label:l})}return n}case"Weekly":{let n=[],c=K(e),s=c.year,d=c.week;for(let l=0;l<12;l++)n.push({id:`${s}W${d}`,label:`${s} W${t(d)}`}),d-=1,d<1&&(s-=1,d=U(s));return n}case"Monthly":{let n=[];for(let c=0;c<24;c++){let s=i,d=o,l=s*12+d-c,m=Math.floor(l/12),u=(l%12+12)%12;n.push({id:`${m}${t(u+1)}`,label:`${r[u]} ${m}`})}return n}case"BiMonthly":{let n=[],c=Math.floor(o/2)+1,s=i,d=c;for(let l=0;l<12;l++){let m=(d-1)*2;n.push({id:`${s}${t(d)}B`,label:`${r[m]}\u2013${r[m+1]} ${s}`}),d-=1,d<1&&(s-=1,d=6)}return n}case"Quarterly":{let n=[],c=Math.floor(o/3)+1,s=i,d=c;for(let l=0;l<8;l++)n.push({id:`${s}Q${d}`,label:`${s} Q${d}`}),d-=1,d<1&&(s-=1,d=4);return n}case"SixMonthly":{let n=[],c=o<6?1:2,s=i,d=c;for(let l=0;l<6;l++)n.push({id:`${s}S${d}`,label:`${s} ${d===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),d-=1,d<1&&(s-=1,d=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let c=0;c<10;c++){let s=i-c;n.push({id:String(s),label:String(s)})}return n}default:return[]}}function K(a){let e=new Date(a.getFullYear(),a.getMonth(),a.getDate()),i=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-i);let o=new Date(e.getFullYear(),0,1),r=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((r+1)/7)}}function U(a){return K(new Date(a,11,28)).week}var we=`
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
