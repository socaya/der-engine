/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as D,useRef as ae,useState as S}from"react";import{useAuth as qe,useOrgUnitBinding as Fe,useOnlineStatus as Ue,useDerApi as Ve,ScreenCard as Be}from"@der/app-sdk";import{Fragment as kt,jsx as u,jsxs as v}from"react/jsx-runtime";function Qe(){let o=qe(),t=Fe(),d=Ue(),a=Ve(),[l,s]=S("custom"),[e,n]=S([]),[r,c]=S(""),[i,m]=S(""),[p,y]=S(""),[b,f]=S(""),[w,C]=S({kind:"idle"}),[_,A]=S(null),T=ae(null),[H,M]=S({}),U=ae({}),[Ne,W]=S([]),[P,V]=S(null),[Y,ce]=S(!1),[Se,K]=S(new Set),[Ce,X]=S(new Set),[B,ue]=S(""),[Q,Te]=S(0),[J,Ae]=S([]),[me,G]=S(!1),pe=ae(0),[$e,Ie]=S(null),[Re,Z]=S({localSaved:!1,central:null}),[De,Le]=S(0),[Me,ee]=S(!1);D(()=>{let g=h=>{if(h.key!=="?")return;let k=h.target;k&&(k.tagName==="INPUT"||k.tagName==="TEXTAREA")||(h.preventDefault(),ee(x=>!x))};return window.addEventListener("keydown",g),()=>window.removeEventListener("keydown",g)},[]);let[z,je]=S(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});D(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",z)}catch{}},[z]);let[q,Oe]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});D(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),D(()=>{let g=!1;return(async()=>{try{let h=await a.listDataSets();if(g)return;let k=(h.dataSets??[]).map(x=>({id:x.id,label:x.displayName??x.name??x.id,periodType:x.periodType,formType:x.formType})).sort((x,E)=>x.label.localeCompare(E.label));n(k)}catch{}})(),()=>{g=!0}},[]),D(()=>{if(r.trim()===""){A(null),W([]),M({}),U.current={};return}let g=!1;return(async()=>{try{let h=await a.getDataSetMeta(r.trim());if(g)return;let k=!!h.dataEntryForm&&h.formType==="CUSTOM"||h.formType==="SECTION";A({hasCustomForm:k,formId:h.dataEntryForm?.id,displayName:h.displayName??h.name,formType:h.formType,periodType:h.periodType}),s(k?"custom":"structured");try{let x=await a.getDataSetFormMetadata(r.trim());if(g)return;let E=await fe(x,a);if(g)return;let j=(E.categoryCombo?.categories??[]).filter(R=>(R.categoryOptions?.length??0)>1).map(R=>({id:R.id,name:R.name??R.id,options:(R.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));W(j);let O={};for(let R of j)R.options[0]&&(O[R.id]=R.options[0].id);M(O),U.current=O}catch{}}catch{g||A(null)}})(),()=>{g=!0}},[r]),D(()=>{if(l!=="custom"||!_?.hasCustomForm||_.formType==="CUSTOM"&&!_.formId)return;let g=T.current;if(!g)return;let h=!1;return(async()=>{C({kind:"submitting"});try{let k=await a.getDataSetFormMetadata(r.trim());if(h)return;let x=await fe(k,a);if(h)return;let E="";if(_.formType==="CUSTOM"&&_.formId){try{E=(await a.getDataEntryFormHtml(_.formId)).htmlCode??""}catch(N){E="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",N)}E.trim()||(E=be(x))}else _.formType==="SECTION"&&(E=be(x));if(h)return;let j=await a.listValidationRules(r.trim()).catch(()=>({validationRules:[]}));if(h)return;let O=(x.categoryCombo?.categories??[]).filter(N=>(N.categoryOptions?.length??0)>1).map(N=>({id:N.id,name:N.name??N.id,options:(N.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));W(O);let R={};for(let N of O)N.options[0]&&(R[N.id]=N.options[0].id);M(R),U.current=R,g.replaceChildren();for(let[N,$]of[["selectedDataSetId",r.trim()],["selectedPeriodId",i.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let L=document.createElement("input");L.type="hidden",L.id=N,L.value=$,g.appendChild(L)}for(let[N,$]of Object.entries(R)){let L=document.createElement("input");L.type="hidden",L.id=`category-${N}`,L.value=$,L.setAttribute("data-der-category",N),g.appendChild(L)}let I=document.createElement("div");I.id="contentDiv",g.appendChild(I),Ye({dataSetId:r.trim(),periodId:i.trim(),orgUnitId:t.orgUnitUid??"",meta:x,aocSelections:R,validationRules:j.validationRules??[]});for(let N of Ge)we(N);for(let N of Je)document.querySelector(`script[data-der-custom-form="${N}"]`)||await _e(N);Ke(),await yt(I,E,{stripStyles:z==="der"}),await bt(I,r.trim(),i.trim(),t.orgUnitUid??"",a),Ze(I,()=>r.trim(),()=>i.trim(),()=>t.orgUnitUid??"",()=>({...U.current}),a,N=>{Z($=>({...$,localSaved:!0,central:$.central==="CENTRAL_ACCEPTED"&&N==="saved"?"PENDING":$.central})),Le($=>$+1)}),I.addEventListener("blur",N=>{let $=N.target;if($&&$.tagName==="INPUT"&&/-val$/.test($.getAttribute("name")??"")&&$.value.trim()!==""){let L=i.trim();X(re=>re.has(L)?re:new Set(re).add(L))}},!0),et(I),dt(I,C),lt(I),pt(I,x,Ie),mt(I,x),ut(I,x),ct(I,x),Te(N=>N+1),C({kind:"idle"})}catch(k){C({kind:"error",message:`custom form failed to render: ${k.message}`})}})(),()=>{h=!0}},[l,_,r,i,t.orgUnitUid,z]);let He=t.bound&&r.trim()!==""&&i.trim()!==""&&p.trim()!==""&&b.trim()!==""&&w.kind!=="submitting";async function Pe(g){g.preventDefault(),C({kind:"submitting"});try{await a.submitAggregate({dataSet:r,period:i,orgUnit:t.orgUnitUid,dataValues:[{dataElement:p,value:b}]}),C({kind:"ok",message:`Submitted ${p}=${b} for ${i}.`}),y(""),f("")}catch(h){C({kind:"error",message:h.message??"Submission failed"})}}let ge=i.trim()!=="",te=r.trim()!=="",F=te&&ge&&t.bound;D(()=>{let g=T.current;if(!g)return;let h=B.trim().toLowerCase(),k=Array.from(g.querySelectorAll("tbody tr"));for(let x of k){if(!h){x.style.display="";continue}let j=((x.querySelector(".dataElementCell")??x.querySelector("td"))?.textContent??"").toLowerCase();x.style.display=j.includes(h)?"":"none"}},[B,Q]),D(()=>{let g=t.orgUnitUid??"";if(!r.trim()||!g||!i.trim()){Z(E=>({...E,central:null}));return}let h=!1,k=null,x=async()=>{try{let E=await a.readAggregateFormSyncState(r.trim(),g,i.trim());if(h)return;Z(O=>({localSaved:O.localSaved||E.state!=null,central:E.state,updatedAt:E.updatedAt})),(E.state==="PENDING"||E.state==="IN_FLIGHT"||E.state==="RETRYABLE")&&(k=setTimeout(()=>void x(),4e3))}catch{}};return x(),()=>{h=!0,k&&clearTimeout(k)}},[a,r,i,t.orgUnitUid,De]),D(()=>{if(!r.trim()||!t.bound||!_?.periodType){K(new Set),X(new Set);return}let g=!1;return(async()=>{let h=ke(_.periodType).map(E=>E.id),[k,x]=await Promise.all([Promise.all(h.map(async E=>{try{return(await a.getCompletion(r.trim(),t.orgUnitUid??"",E)).completed?E:null}catch{return null}})),Promise.all(h.map(async E=>{try{return((await a.readAggregateValues(t.orgUnitUid??"",E,1)).dataValues?.length??0)>0?E:null}catch{return null}}))]);g||(K(new Set(k.filter(E=>E!==null))),X(new Set(x.filter(E=>E!==null))))})(),()=>{g=!0}},[r,t.orgUnitUid,_?.periodType]),D(()=>{if(!F){V(null);return}let g=!1;return(async()=>{try{let h=await a.getCompletion(r.trim(),t.orgUnitUid??"",i.trim());if(g)return;V({completed:!!h.completed,completedAt:h.completedAt})}catch{g||V({completed:!1})}})(),()=>{g=!0}},[r,i,t.orgUnitUid,F]);async function ze(){if(!F||Y)return;let g=!P?.completed;if(g){let h=T.current;if(h){let k=[];for(let x of Array.from(h.querySelectorAll('input[data-compulsory="1"]')))x.value.trim()===""&&k.push(x);if(k.length>0){C({kind:"error",message:`Can't mark complete \u2014 ${k.length} compulsory value${k.length===1?"":"s"} still missing. Run Validate to jump to them.`}),k[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ce(!0);try{let h=await a.markCompletion({dataSet:r.trim(),orgUnit:t.orgUnitUid??"",period:i.trim(),completed:g});V({completed:!!h.completed,completedAt:h.completedAt}),K(k=>{let x=new Set(k);return h.completed?x.add(i.trim()):x.delete(i.trim()),x}),C({kind:"ok",message:h.completed?"Dataset marked complete.":"Dataset reopened."})}catch(h){C({kind:"error",message:`Completion failed: ${h.message}`})}finally{ce(!1)}}return v(Be,{dataTest:"der-aggregate-entry",children:[u("style",{children:wt}),v("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[v("div",{className:"der-de-toolbar__head",children:[u("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:v("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[u("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#eef1ff",stroke:"#4a55ce","stroke-width":"5"}),u("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#4a55ce","stroke-width":"5"}),u("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#4a55ce","stroke-width":"3"}),u("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#4a55ce","stroke-width":"3"}),u("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#4a55ce","stroke-width":"3"})]})}),u("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),u("span",{className:"der-de-toolbar__status "+(d.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":d.isOnline?"Online":"Offline",children:d.isOnline?"online":`offline \xB7 ${d.queuedCount} queued`}),v("span",{className:"der-de-toolbar__ou-wrap",children:[u("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),u("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),v("div",{className:"der-de-toolbar__picks",children:[v("label",{className:"der-de-toolbar__field",children:[u("span",{className:"der-de-toolbar__field-label",children:"Data set"}),v("select",{className:"der-de-toolbar__select",value:r,onChange:g=>{c(g.target.value),m("")},"data-test":"der-de-dataset-picker",children:[u("option",{value:"",children:"Select a data set\u2026"}),e.map(g=>u("option",{value:g.id,children:g.label},g.id))]})]}),Ne.map(g=>v("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[u("span",{className:"der-de-toolbar__field-label",children:g.name}),v("select",{className:"der-de-toolbar__select",value:H[g.id]??"",onChange:h=>{let k={...H,[g.id]:h.target.value};M(k),U.current=k,Xe(T.current,k)},"data-test":"de-aoc-select",children:[u("option",{value:"",children:"Select\u2026"}),g.options.map(h=>u("option",{value:h.id,children:h.name},h.id))]})]},g.id)),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[v("span",{className:"der-de-toolbar__field-label",children:["Period",_?.periodType?` \xB7 ${_.periodType}`:""]}),u("span",{className:"der-de-period-wrap",children:xt(_?.periodType,i,m,Se,Ce)})]}),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[u("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),v("span",{className:"der-de-toolbar__filter",children:[u("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:B,onChange:g=>ue(g.target.value),"data-test":"de-filter-input"}),B&&u("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>ue(""),children:"\xD7"})]})]}),u("div",{className:"der-de-toolbar__cell-info",children:u(ot,{root:T,details:$e,formVersion:Q,formSync:Re})})]})]}),w.kind==="ok"&&u("div",{style:ht,"data-test":"de-ok",children:w.message}),w.kind==="error"&&u("div",{style:vt,"data-test":"de-err",children:w.message}),!t.bound&&u("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!te&&u("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&te&&!ge&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",_?.formType==="SECTION"?"section":"data entry"," form."]}),F&&l==="structured"&&v("form",{onSubmit:Pe,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",u("input",{value:p,onChange:g=>y(g.target.value),style:de})]}),v("label",{children:["Value",u("input",{value:b,onChange:g=>f(g.target.value),inputMode:"decimal",style:de})]}),u("div",{style:{gridColumn:"1 / -1"},children:u("button",{type:"submit",disabled:!He,style:he,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),F&&l==="custom"&&u("div",{className:`der-de-form-card der-de-density-${q}`,children:v("div",{className:"der-de-form-split",children:[u(rt,{targetRef:T,formVersion:Q}),u("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),F&&l==="custom"&&v("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[u(at,{root:T,formVersion:Q}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Oe(g=>g==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${z==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${z==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>je(g=>g==="der"?"author":"der"),children:z==="der"?"\u2699 DER layout":"\u2699 Author layout"}),P&&u("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:P.completed?`Complete${P.completedAt?" \xB7 "+new Date(P.completedAt).toLocaleString():""}`:"Open for edits"}),u("button",{type:"button",onClick:()=>{gt(T.current,C,(g,h)=>{Ae(g),pe.current=h,G(!0)})},style:ve,"data-test":"de-validate-btn",children:"Validate"}),J.length>0&&!me&&v("button",{type:"button",onClick:()=>G(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[J.length," issue",J.length===1?"":"s"]}),u("button",{type:"button",onClick:()=>ee(g=>!g),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),u("button",{type:"button",onClick:ze,disabled:Y,style:P?.completed?ve:he,"data-test":"de-complete-btn",children:Y?"Saving\u2026":P?.completed?"Reopen":"Mark complete"})]}),u(st,{open:Me,onClose:()=>ee(!1)}),u(it,{open:me,issues:J,totalCells:pe.current,onClose:()=>G(!1),onPick:g=>{let h=T.current?.querySelector(`input[name="${g.inputName}"]`);h&&(h.scrollIntoView({behavior:"smooth",block:"center"}),h.focus(),h.select()),G(!1)}})]})}var Je=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Ge=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],oe=null,ne=null,ie=null;async function fe(o,t){oe||(oe=t.listAllDataElements().then(n=>new Map(n.map(r=>[r.id,r])))),ne||(ne=t.listAllCategoryCombos().then(n=>new Map(n.map(r=>[r.id,r])))),ie||(ie=t.listAllCategoryOptionCombos().then(n=>{let r=new Map;for(let c of n){let i=c.categoryCombo?.id;if(!i)continue;let m=r.get(i);m?m.push(c):r.set(i,[c])}return r}));let[d,a,l]=await Promise.all([oe,ne,ie]),s=n=>{if(!n?.id)return;let r=a.get(n.id),c=l.get(n.id)??[];return r?{id:r.id,name:r.name??r.displayName,categoryOptionCombos:c.map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:i.categoryOptions??[]})),categories:(r.categories??[]).map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:(i.categoryOptions??[]).map(m=>({id:m.id,name:m.name??m.displayName}))}))}:n},e=n=>{let r=d.get(n.id);return r?{id:r.id,name:r.name??r.displayName,formName:r.formName,valueType:r.valueType,categoryCombo:s(r.categoryCombo)}:n};return{...o,categoryCombo:s(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(n=>({...n,dataElement:n.dataElement?e(n.dataElement):void 0})),sections:(o.sections??[]).map(n=>({...n,dataElements:(n.dataElements??[]).map(r=>e(r))}))}}function be(o){let t={};for(let n of o.dataSetElements??[])n.dataElement&&(t[n.dataElement.id]=n.dataElement);let d={};for(let n of o.indicators??[])d[n.id]=n;let a=(o.sections??[]).slice().sort((n,r)=>(n.sortOrder??0)-(r.sortOrder??0));if(!a.some(n=>(n.dataElements?.length??0)>0)){let n=(o.dataSetElements??[]).map(r=>r.dataElement).filter(r=>!!r);a=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:n,indicators:[],greyedFields:[]}]}let s=n=>n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),e=[];for(let n of a){let r=new Set;for(let i of n.greyedFields??[])i.dataElement?.id&&i.categoryOptionCombo?.id&&r.add(`${i.dataElement.id}:${i.categoryOptionCombo.id}`);e.push(`<h3 class="formSection">${s(n.name??"")}</h3>`);let c=new Map;for(let i of n.dataElements??[]){let m=t[i.id];if(!m?.categoryCombo)continue;let p=m.categoryCombo.id,y=c.get(p);y||(y={cc:m.categoryCombo,des:[]},c.set(p,y)),y.des.push(m)}for(let i of c.values()){let m=i.cc.categoryOptionCombos??[],p=i.cc.categories??[];e.push('<div class="der-de-table-scroll">'),e.push('<table class="sectionTable" cellspacing="0">');let y=We(p,m);if(e.push("<thead>"),y.length>0)for(let b=0;b<y.length;b++){e.push("<tr>"),b===0&&e.push(`<th class="dataElementCell" rowspan="${y.length}">Data elements</th>`);for(let f of y[b]??[])e.push(`<th colspan="${f.span}">${s(f.label)}</th>`);e.push("</tr>")}else{e.push("<tr>"),e.push('<th class="dataElementCell">Data elements</th>');for(let b of m)e.push(`<th>${s(b.name??"")}</th>`);e.push("</tr>")}e.push("</thead><tbody>");for(let b of i.des){e.push("<tr>"),e.push(`<td class="dataElementCell" id="${s(b.id)}-cell">`+s(b.formName??b.name??b.id)+"</td>");for(let f of m){let w=`${b.id}-${f.id}-val`;r.has(`${b.id}:${f.id}`)?e.push('<td class="greyed">\u2014</td>'):e.push(`<td><input type="text" id="${s(w)}" name="${s(w)}" dataelementid="${s(b.id)}" optioncomboid="${s(f.id)}"></td>`)}e.push("</tr>")}for(let b of n.indicators??[]){let f=d[b.id];f&&(e.push('<tr class="indicatorRow">'),e.push(`<td class="dataElementCell">${s(f.name??f.id)}</td>`),e.push(`<td colspan="${m.length}"><input type="text" name="indicator" indicatorid="${s(f.id)}" readonly></td>`),e.push("</tr>"))}e.push("</tbody></table></div>")}}return e.join(`
`)}function We(o,t){if(o.length===0||t.length===0)return[];let d=new Map;for(let e of o)for(let n of e.categoryOptions??[])d.set(n.id,{catId:e.id,name:n.name??n.id});let a=o.length,l=t.map(e=>{let n=new Array(a).fill("");for(let r of e.categoryOptions??[]){let c=d.get(r.id);if(!c)continue;let i=o.findIndex(m=>m.id===c.catId);i>=0&&(n[i]=c.name)}return n});for(let e of l)if(e.some(n=>n===""))return[];let s=[];for(let e=0;e<a;e++){let n=[];for(let r=0;r<l.length;){let c=l[r],i=r+1;for(;i<l.length;){let m=l[i],p=!0;for(let y=0;y<=e;y++)if(c[y]!==m[y]){p=!1;break}if(!p)break;i++}n.push({label:c[e]??"",span:i-r}),r=i}s.push(n)}return s}function Ye(o){let t=globalThis;t.dhis2=t.dhis2??{};let d=t.dhis2;d.de=d.de??{};let a=d.de;a.currentDataSetId=o.dataSetId,a.currentOrganisationUnitId=o.orgUnitId,a.currentPeriodId=o.periodId,a.currentCategorySelections={...o.aocSelections??{}};let l=o.meta??{},s={},e={};if(l.categoryCombo){e[l.categoryCombo.id]=l.categoryCombo;for(let m of l.categoryCombo.categories??[])s[m.id]=m}a.categories=s,a.categoryCombos=e;let n={},r={};for(let m of l.dataSetElements??[]){let p=m.dataElement;p&&(n[p.id]=p,p.optionSet&&(r[p.optionSet.id]=p.optionSet),p.categoryCombo&&(e[p.categoryCombo.id]=p.categoryCombo))}a.dataElements=n,a.optionSets=r;let c={};for(let m of l.indicators??[])c[m.id]={explodedNumerator:m.numerator,denominator:m.denominator,factor:m.indicatorType?.factor??1};a.indicatorFormulas=c;let i={};for(let m of o.validationRules??[])i[m.id]=m;a.validationRules=i,a.lockExceptions=[],a.emptyOrganisationUnits=[],a.significantZeros=[],a.dataSets={[l.id]:{id:l.id,name:l.name??l.displayName??"",periodType:l.periodType,categoryCombo:l.categoryCombo?.id,periodId:o.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ke(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(t,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let t=o.dhis2.period;t.format="yyyy-mm-dd",t.calendar=o.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function Xe(o,t){if(!o)return;for(let[a,l]of Object.entries(t)){let s=o.querySelector(`input[data-der-category="${a}"]`);s||(s=document.createElement("input"),s.type="hidden",s.id=`category-${a}`,s.setAttribute("data-der-category",a),o.appendChild(s)),s.value=l}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...t})}function Ze(o,t,d,a,l,s,e){let n=m=>{let p=/^(.+)-(.+)-val$/.exec(m);return p?{de:p[1],coc:p[2]}:null},r=new WeakMap,c=o.querySelectorAll('input[name$="-val"]');for(let m of Array.from(c))r.set(m,m.value);let i=async m=>{let p=m.target;if(!p||p.tagName!=="INPUT")return;let y=p.getAttribute("name")??"",b=n(y);if(!b)return;let f=t(),w=d(),C=a();if(!f||!w||!C)return;let _=p.value;if(r.get(p)!==_){se(p,"saving");try{let A=await s.submitAggregate({dataSet:f,period:w,orgUnit:C,attributeOptionComboSelections:l(),dataValues:[{dataElement:b.de,categoryOptionCombo:b.coc,value:_}]});r.set(p,_);let T=A?.status==="OFFLINE_QUEUED"?"queued":"saved";se(p,T),e?.(T)}catch{se(p,"error")}}};o.addEventListener("blur",m=>{i(m)},!0)}function et(o){o.addEventListener("keydown",t=>{let d=t;if(d.key!=="Enter")return;let a=d.target;if(!(a instanceof HTMLInputElement))return;let l=a.getAttribute("name")??"",s=/^(.+)-(.+)-val$/.exec(l);if(!s)return;d.preventDefault();let e=s[2],n=Array.from(o.querySelectorAll(`input[name$="-${e}-val"]`)),r=n.indexOf(a);if(r===-1)return;let c=n[r+(d.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function tt(o){let t=Array.from(o.querySelectorAll("h2, h3, h4")).filter(s=>(s.textContent??"").trim().length>0);if(t.length<2)return[];let d=new Set(t),a=[],l=(s,e)=>{for(let n of d)if(n!==e&&s.contains(n))return!0;return!1};return t.forEach((s,e)=>{let n=s.id||`der-de-section-${e}`;s.id=n;let r=null,c=s.parentElement,i=null;for(;c&&c!==o&&!l(c,s);)i=c,c=c.parentElement;if(i&&i.children.length>1&&i!==o)r=i,r.classList.add("der-de-section-slot"),r.dataset.sectionId=n;else{r=document.createElement("div"),r.className="der-de-section-slot",r.dataset.sectionId=n;let m=t[e+1]??null,p=[],y=s;for(;y&&y!==m;){let b=y.nextSibling;p.push(y),y=b}s.parentNode?.insertBefore(r,s);for(let b of p)r.appendChild(b)}a.push({id:n,label:(s.textContent??"").trim(),slot:r})}),a}function rt({targetRef:o,formVersion:t}){let[d,a]=S([]),[l,s]=S(""),[e,n]=S({});return D(()=>{let r=o.current;if(!r)return;let c=tt(r);a(c),s(c[0]?.id??"")},[o,t]),D(()=>{if(d.length===0)return;let r=()=>{let m={};for(let p of d){let y=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),b=y.filter(f=>f.value.trim()!=="").length;m[p.id]={filled:b,total:y.length}}n(m)};r();let c=o.current;if(!c)return;let i=m=>{let p=m.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&r()};return c.addEventListener("input",i,!0),()=>{c.removeEventListener("input",i,!0)}},[o,d]),D(()=>{if(!o.current||d.length===0)return;for(let i of d)i.slot.style.display=i.id===l?"":"none";let c=d.find(i=>i.id===l);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,d,l]),d.length<2?null:v("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[u("div",{className:"der-de-section-nav__title",children:"Sections"}),u("ul",{className:"der-de-section-nav__list",children:d.map(r=>{let c=e[r.id],i=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return u("li",{children:v("button",{type:"button",className:"der-de-section-nav__item"+(l===r.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>s(r.id),children:[u("span",{className:"der-de-section-nav__label",children:r.label}),c&&c.total>0&&u("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${i}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:i==="done"?"\u2713":`${c.filled}/${c.total}`})]})},r.id)})})]})}function at({root:o,formVersion:t}){let[d,a]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(D(()=>{let e=()=>{let r=o.current;if(!r)return;let c=Array.from(r.querySelectorAll('input[name$="-val"]')),i=0,m=0,p=0,y=0,b=0;for(let f of c){f.value.trim()!==""&&i++;let w=f.style.outline||"";w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?m++:w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?y++:w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?p++:(w.includes("rgb(169, 50, 50)")||w.includes("#a93232"))&&b++}a({total:c.length,filled:i,saving:m,saved:p,queued:y,error:b})};e();let n=window.setInterval(e,800);return()=>window.clearInterval(n)},[o,t]),d.total===0)return u("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let l=[];l.push(`${d.filled} of ${d.total} filled`),d.saving>0&&l.push(`${d.saving} saving`),d.queued>0&&l.push(`${d.queued} queued`),d.error>0&&l.push(`${d.error} error`);let s=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return u("span",{className:`der-de-savepill der-de-savepill--${s}`,"data-test":"de-save-state",children:l.join(" \xB7 ")})}function ot({details:o,formSync:t}){let d={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},a={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return u("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:u("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:o?v(kt,{children:[u("span",{className:"der-de-live-strip__de",children:o.deName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__coc",children:o.cocName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__value",children:o.value||u("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:`der-de-live-strip__state der-de-live-strip__state--${a[o.saveState]}`,children:d[o.saveState]}),u(nt,{formSync:t,cellSaved:o.saveState==="saved"||o.saveState==="queued"}),o.compulsory&&u("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):u("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function nt({formSync:o,cellSaved:t}){let d=t||o.localSaved,a=o.central,l=a==="CENTRAL_ACCEPTED"?"lit":a==="PENDING"||a==="IN_FLIGHT"||a==="RETRYABLE"||a==="UNKNOWN_OUTCOME"?"pending":a==="CENTRAL_REJECTED"||a==="CONFLICT_REVIEW"||a==="QUARANTINED"||a==="REQUIRES_APPROVAL"?"error":"muted",s=d?"Saved on edge (DER)":"Not yet saved on edge",e=l==="lit"?"Synced to Central DHIS2":l==="pending"?`Sync in progress (${a})`:l==="error"?`Central reported ${a}`:"Not yet synced to Central";return v("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der "+(d?"is-lit":"is-muted"),title:s,"data-test":"de-sync-der","data-state":d?"lit":"muted",children:[v("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[u("circle",{cx:"8",cy:"8",r:"7",fill:"currentColor",opacity:"0.14"}),u("path",{d:"M4.5 4.5h3.2a3.2 3.2 0 0 1 0 6.4H4.5zM6.2 6v3.4h1.3a1.7 1.7 0 0 0 0-3.4z",fill:"currentColor"})]}),u("span",{className:"der-de-sync-logos__label",children:"DER"})]}),v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+l,title:e,"data-test":"de-sync-central","data-state":l,children:[v("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[u("circle",{cx:"8",cy:"8",r:"7",fill:"currentColor",opacity:"0.14"}),u("path",{d:"M8 3.2 4.1 6.2v3.6L8 12.8l3.9-3V6.2zM8 5l2.4 1.9v2L8 10.8 5.6 8.9v-2z",fill:"currentColor"})]}),u("span",{className:"der-de-sync-logos__label",children:"DHIS2"})]})]})}function it({open:o,issues:t,totalCells:d,onClose:a,onPick:l}){if(D(()=>{if(!o)return;let e=n=>{n.key==="Escape"&&a()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[o,a]),!o)return null;let s=t.length===0;return u("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:e=>{e.target===e.currentTarget&&a()},children:v("div",{className:"der-de-validation "+(s?"der-de-validation--ok":"der-de-validation--err"),children:[v("header",{className:"der-de-validation__head",children:[v("div",{className:"der-de-validation__title",children:[u("span",{className:"der-de-validation__badge","aria-hidden":"true",children:s?"\u2713":"!"}),u("h3",{className:"der-de-validation__heading",children:s?`Validation passed \u2014 all ${d} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${d} cells.`})]}),u("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:a,children:"\xD7"})]}),u("div",{className:"der-de-validation__body",children:s?v("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",u("strong",{children:" Mark complete"})," when you're ready."]}):v("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[u("thead",{children:v("tr",{children:[u("th",{scope:"col",children:"Data element"}),u("th",{scope:"col",children:"Category option combo"}),u("th",{scope:"col",children:"Entered value"}),u("th",{scope:"col",children:"Problem"}),u("th",{scope:"col"})]})}),u("tbody",{children:t.map(e=>v("tr",{"data-test":"de-issues-row",children:[u("td",{children:e.deName}),u("td",{className:"der-de-validation__coc",children:e.cocName}),u("td",{children:u("code",{className:"der-de-validation__value",children:e.value||"\u2014"})}),u("td",{className:"der-de-validation__why",children:e.problem}),u("td",{className:"der-de-validation__jump",children:u("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>l(e),children:"Jump to cell \u2192"})})]},`${e.deId}-${e.cocId}`))})]})})]})})}function st({open:o,onClose:t}){return D(()=>{if(!o)return;let a=l=>{l.key==="Escape"&&t()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[o,t]),o?u("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:a=>{a.target===a.currentTarget&&t()},children:v("div",{className:"der-de-shortcuts",children:[v("header",{className:"der-de-shortcuts__head",children:[u("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),u("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),u("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([a,l])=>v("div",{className:"der-de-shortcuts__row",children:[u("dt",{children:u("kbd",{children:a})}),u("dd",{children:l})]},a))})]})}):null}function dt(o,t){o.addEventListener("paste",d=>{let a=d.target;if(!a||a.tagName!=="INPUT")return;let l=a.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(l))return;let e=d.clipboardData?.getData("text/plain")??"",n=/\r?\n/.test(e),r=/\t/.test(e);if(!n&&!r)return;let c=e.split(/\r?\n/).filter((_,A,T)=>!(A===T.length-1&&_==="")).map(_=>_.split("	").map(A=>A.trim()));if(c.length===0)return;d.preventDefault();let i=a.closest("[data-section-id]")??o,p=Array.from(i.querySelectorAll("tbody tr")).map(_=>Array.from(_.querySelectorAll('input[name$="-val"]'))),y=-1,b=-1;for(let _=0;_<p.length;_++){let A=p[_].indexOf(a);if(A!==-1){y=_,b=A;break}}if(y===-1)return;let f=0,w=0;for(let _=0;_<c.length;_++){let A=c[_],T=p[y+_];if(!T){w+=A.length;continue}for(let H=0;H<A.length;H++){let M=T[b+H];if(!M){w++;continue}M.value=A[H]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),f++}}let C=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${f} value${f===1?"":"s"} (${C}${w>0?`, ${w} overflow`:""}).`})},!0)}function lt(o){let t=Array.from(o.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let d=[];for(let a of t){let l=a.getAttribute("dataelementid")??"";if(!l)continue;let s=a.closest("div"),n=(()=>{let i=s??a.parentElement;if(!i)return null;let m=i.previousElementSibling;for(;m;){if(/^(H1|H2|H3|H4)$/.test(m.tagName)||m.tagName==="DIV"&&!m.querySelector("table, input")&&(m.textContent??"").trim().length>0)return m;m=m.previousElementSibling}let p=i.closest("[data-section-id]");if(p){let y=p.querySelector("h2, h3, h4");if(y)return y}return null})();if(!n)continue;s?.remove();let r=document.createElement("span");r.className="der-de-matrix-total",r.setAttribute("data-de",l),n.appendChild(r);let c=()=>{let i=0,m=!1,p=Array.from(o.querySelectorAll(`input[dataelementid="${l}"][name$="-val"],input[name^="${l}-"][name$="-val"]`)),y=new Set;for(let b of p){if(y.has(b))continue;y.add(b);let f=parseFloat(b.value);Number.isFinite(f)&&(i+=f,m=!0)}if(m){let b=Number.isInteger(i)?i:Number(i.toFixed(2));r.textContent=` (Total: ${b})`}else r.textContent=""};d.push(c),c()}d.length!==0&&o.addEventListener("input",a=>{let l=a.target;if(!(!l||l.tagName!=="INPUT")&&/-val$/.test(l.getAttribute("name")??""))for(let s of d)s()},!0)}function ct(o,t){let d=t.indicators??[];if(d.length===0)return;let a=d.filter(i=>i.numerator&&i.denominator).map(i=>({id:i.id,factor:i.indicatorType?.factor??1,numExpr:i.numerator,denExpr:i.denominator}));if(a.length===0)return;let l=Array.from(o.querySelectorAll("input[indicatorid]")),s=new Map;for(let i of Array.from(o.querySelectorAll('input[name$="-val"]')))s.set(i.getAttribute("name")??"",i);let e=i=>{let m=0;for(let[p,y]of s){if(!p.startsWith(`${i}-`))continue;let b=parseFloat(y.value);Number.isFinite(b)&&(m+=b)}return m},n=i=>i.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(m,p,y)=>{if(y){let b=s.get(`${p}-${y}-val`),f=parseFloat(b?.value??"");return Number.isFinite(f)?String(f):"0"}return String(e(p))}),r=i=>{if(!/^[\s\d+\-*/().eE]+$/.test(i))return NaN;try{return Function(`"use strict";return (${i})`)()}catch{return NaN}},c=()=>{for(let i of a){let m=r(n(i.numExpr)),p=r(n(i.denExpr)),y=l.find(f=>f.getAttribute("indicatorid")===i.id);if(!y)continue;if(!Number.isFinite(m)||!Number.isFinite(p)||p===0){y.value="";continue}let b=m/p*i.factor;y.value=Number.isInteger(b)?String(b):b.toFixed(2)}};o.addEventListener("input",i=>{let m=i.target;m&&m.tagName==="INPUT"&&m.hasAttribute("name")&&/-val$/.test(m.getAttribute("name")??"")&&c()},!0),c()}function ut(o,t){let d={};for(let a of t.dataSetElements??[])a.dataElement&&(d[a.dataElement.id]=a.dataElement);for(let a of Array.from(o.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");if(!l)continue;let s=d[l[1]],e=s?.formName??s?.name??l[1],n=s?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===l[2]),r=n?.name??n?.displayName??l[2];a.hasAttribute("aria-label")||a.setAttribute("aria-label",r===l[2]?`${e}`:`${e}, ${r}`),a.getAttribute("data-compulsory")==="1"&&a.setAttribute("aria-required","true")}}function mt(o,t){let d=t.compulsoryDataElementOperands??[],a=new Set;for(let l of d){let s=l.dimensionItem;if(!s)continue;let e=s.split(".");e.length===2&&a.add(`${e[0]}:${e[1]}`)}if(a.size!==0)for(let l of Array.from(o.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(l.getAttribute("name")??"");s&&a.has(`${s[1]}:${s[2]}`)&&l.setAttribute("data-compulsory","1")}}function pt(o,t,d){let a={};for(let s of t.dataSetElements??[])s.dataElement&&(a[s.dataElement.id]=s.dataElement);let l=s=>{let e=s.getAttribute("name")??s.id??"",n=/^(.+)-(.+)-val$/.exec(e);if(!n)return null;let r=n[1],c=n[2],i=a[r],m=i?.categoryCombo,p=m?.categoryOptionCombos?.find(A=>A.id===c),y=[],b=p?.name??p?.displayName??c,f=b.split(/,\s*/).filter(Boolean),w=m?.categories??[];f.forEach((A,T)=>{y.push({category:w[T]?.name??w[T]?.displayName??"",option:A})});let C=s.style.outline||"",_=C.includes("rgb(185, 134, 10)")||C.includes("#b9860a")?"saving":C.includes("rgb(206, 123, 0)")||C.includes("#ce7b00")?"queued":C.includes("rgb(26, 135, 84)")||C.includes("#1a8754")||C.includes("rgb(183, 220, 199)")||C.includes("#b7dcc7")?"saved":C.includes("rgb(169, 50, 50)")||C.includes("#a93232")?"error":s.value.trim()===""?"empty":"saved";return{deId:r,cocId:c,deName:i?.name??r,deFormName:i?.formName,valueType:i?.valueType??"TEXT",optionSetId:i?.optionSet?.id,cocName:b,categoryBreakdown:y,value:s.value,saveState:_,inputName:e,compulsory:s.getAttribute("data-compulsory")==="1"}};o.addEventListener("focusin",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let n=l(e);n&&d(n)}},!0),o.addEventListener("input",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let n=l(e);n&&d(n)}},!0)}function gt(o,t,d){if(!o)return;let a=globalThis,l=a.dhis2?.de?.dataElements??{},s=a.dhis2?.de?.categoryOptionCombos??{},e=Array.from(o.querySelectorAll('input[name$="-val"]')),n=[];for(let r of e){r.style.outline="";let c=/^(.+)-(.+)-val$/.exec(r.getAttribute("name")??"");if(!c)continue;let i=c[1],m=c[2],p=l[i],y=p?.valueType??"TEXT",b=r.value.trim();if(b===""){r.getAttribute("data-compulsory")==="1"&&(r.style.outline="2px solid #c0392b",n.push({deId:i,cocId:m,valueType:y,value:"",problem:"compulsory value missing",deName:p?.name??i,cocName:s[m]?.name??m,inputName:r.name}));continue}let f=ft(b,y);f&&(r.style.outline="2px solid #c0392b",n.push({deId:i,cocId:m,valueType:y,value:b,problem:f,deName:p?.name??i,cocName:s[m]?.name??m,inputName:r.name}))}d(n,e.length),t({kind:"idle"})}function ft(o,t){let d=Number(o),a=Number.isInteger(d);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(t){case"INTEGER":if(!a)return"must be an integer";break;case"INTEGER_POSITIVE":if(!a||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!a||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!a||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function se(o,t){let d=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${d}`,o.style.transition="outline 150ms",t==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function bt(o,t,d,a,l){if(!t||!d||!a)return;let s;try{s=(await l.readAggregateValues(a,d,2e3)).dataValues??[]}catch{return}for(let e of s){let n=e.dataElement,r=e.categoryOptionCombo,c=e.value;if(!n||!r||c==null)continue;let i=o.querySelector(`input[name="${n}-${r}-val"]`);i&&(i.value=c)}}function _e(o){return new Promise((t,d)=>{let a=document.createElement("script");a.src=o,a.async=!1,a.setAttribute("data-der-custom-form",o),a.onload=()=>t(),a.onerror=()=>d(new Error(`failed to load ${o}`)),document.head.appendChild(a)})}function we(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=o,t.setAttribute("data-der-custom-form",o),document.head.appendChild(t)}function ye(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function yt(o,t,d={}){let a=d.stripStyles??!0;o.classList.toggle("der-de-custom-form--author",!a);let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let e of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let n=e.getAttribute("href")??"";n&&we(ye(n))}else{let n=document.createElement("style");n.textContent=e.textContent??"",n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n)}e.remove()}let s=[];for(let e of Array.from(l.querySelectorAll("script"))){let n=e.getAttribute("src");n?s.push({src:ye(n)}):s.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(l.body.querySelectorAll("*"))){if(a&&e.removeAttribute("style"),e.tagName==="INPUT"){let n=e.getAttribute("id")??"";n.endsWith("-val")&&e.getAttribute("name")!==n&&e.setAttribute("name",n)}if(a&&e.tagName==="TH"){let n=(e.textContent??"").trim();(n==="Reporting item"||n==="Reported count")&&(e.textContent=n==="Reporting item"?"Data elements":"Value")}}for(let e of Array.from(l.body.childNodes))o.appendChild(document.adoptNode(e));for(let e of s)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await _e(e.src);else if(e.code){let n=document.createElement("script");n.textContent=e.code,n.setAttribute("data-der-custom-form","inline"),document.head.appendChild(n),n.remove()}}var de={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},he={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ve={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ht={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},vt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function xt(o,t,d,a=new Set,l=new Set){let s=(f,w)=>a.has(f)?`\u2713  ${w}`:l.has(f)?`\u25CF  ${w}`:w,e={...de},n=ke(o);if(n.length===0)return u("input",{value:t,onChange:f=>d(f.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:e});let r=[...n];if(t&&!r.some(f=>f.id===t)){let f=_t(o,t)??t;r.unshift({id:t,label:f})}let c=n[0]?.id??null,i=r.findIndex(f=>f.id===t),m=i===-1||i<r.length-1||!!o,p=t!==""&&(i>0||t!==c),y=()=>{if(!o)return;let f=i>=0&&i<r.length-1?r[i+1]?.id??"":xe(o,t||c||"",-1);f&&d(f)},b=()=>{if(!o||!t||t===c)return;let f=i>0?r[i-1]?.id??"":xe(o,t,1);f&&d(f)};return v("span",{className:"der-de-period-nav",children:[u("button",{type:"button","aria-label":"Previous period",onClick:y,disabled:!m,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:t,onChange:f=>d(f.target.value),style:e,children:[u("option",{value:"",children:"Select a period\u2026"}),r.map(f=>u("option",{value:f.id,children:s(f.id,f.label)},f.id))]}),u("button",{type:"button","aria-label":"Next period",onClick:b,disabled:!p,className:"der-de-period-btn",children:"\u25B6"})]})}function xe(o,t,d){let a=l=>String(l).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=Number(t.slice(6,8)),n=new Date(l,s,e+d);return`${n.getFullYear()}${a(n.getMonth()+1)}${a(n.getDate())}`}case"Weekly":{let l=/^(\d{4})W(\d{1,2})$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=le(s)):e>le(s)&&(s+=1,e=1),`${s}W${e}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=l*12+s+d;return`${Math.floor(e/12)}${a((e%12+12)%12+1)}`}case"BiMonthly":{let l=/^(\d{4})(\d{2})B$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=6):e>6&&(s+=1,e=1),`${s}${a(e)}B`}case"Quarterly":{let l=/^(\d{4})Q(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=4):e>4&&(s+=1,e=1),`${s}Q${e}`}case"SixMonthly":{let l=/^(\d{4})S(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=2):e>2&&(s+=1,e=1),`${s}S${e}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+d):"";default:return""}}function _t(o,t){let d=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let a=/^(\d{4})W(\d{1,2})$/.exec(t);return a?`${a[1]} W${String(a[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let a=Number(t.slice(4,6))-1;return`${d[a]??""} ${t.slice(0,4)}`}case"BiMonthly":{let a=/^(\d{4})(\d{2})B$/.exec(t);if(!a)return null;let l=(Number(a[2])-1)*2;return`${d[l]}\u2013${d[l+1]} ${a[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let a=/^(\d{4})S(\d)$/.exec(t);return a?`${a[1]} ${a[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function ke(o){let t=new Date,d=t.getFullYear(),a=t.getMonth(),l=e=>String(e).padStart(2,"0"),s=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":{let e=[];for(let n=0;n<30;n++){let r=new Date(t);r.setDate(r.getDate()-n);let c=`${r.getFullYear()}${l(r.getMonth()+1)}${l(r.getDate())}`,i=`${r.getFullYear()}-${l(r.getMonth()+1)}-${l(r.getDate())}`;e.push({id:c,label:i})}return e}case"Weekly":{let e=[],n=Ee(t),r=n.year,c=n.week;for(let i=0;i<12;i++)e.push({id:`${r}W${c}`,label:`${r} W${l(c)}`}),c-=1,c<1&&(r-=1,c=le(r));return e}case"Monthly":{let e=[];for(let n=0;n<24;n++){let r=d,c=a,i=r*12+c-n,m=Math.floor(i/12),p=(i%12+12)%12;e.push({id:`${m}${l(p+1)}`,label:`${s[p]} ${m}`})}return e}case"BiMonthly":{let e=[],n=Math.floor(a/2)+1,r=d,c=n;for(let i=0;i<12;i++){let m=(c-1)*2;e.push({id:`${r}${l(c)}B`,label:`${s[m]}\u2013${s[m+1]} ${r}`}),c-=1,c<1&&(r-=1,c=6)}return e}case"Quarterly":{let e=[],n=Math.floor(a/3)+1,r=d,c=n;for(let i=0;i<8;i++)e.push({id:`${r}Q${c}`,label:`${r} Q${c}`}),c-=1,c<1&&(r-=1,c=4);return e}case"SixMonthly":{let e=[],n=a<6?1:2,r=d,c=n;for(let i=0;i<6;i++)e.push({id:`${r}S${c}`,label:`${r} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(r-=1,c=2);return e}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let e=[];for(let n=0;n<10;n++){let r=d-n;e.push({id:String(r),label:String(r)})}return e}default:return[]}}function Ee(o){let t=new Date(o.getFullYear(),o.getMonth(),o.getDate()),d=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-d);let a=new Date(t.getFullYear(),0,1),s=Math.round((t.getTime()-a.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((s+1)/7)}}function le(o){return Ee(new Date(o,11,28)).week}var wt=`
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
  font-size: 14px;
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
  color: var(--der-ink-700, #2a3447);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #f0f3fb !important;
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
.der-de-sync-logos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
}
.der-de-sync-logos__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
  border: 1px solid transparent;
  transition: color 160ms, background 160ms, border-color 160ms;
}
.der-de-sync-logos__pin svg { flex-shrink: 0; }
.der-de-sync-logos__label {
  text-transform: uppercase;
  font-size: 9px;
}
.der-de-sync-logos__pin.is-muted {
  color: var(--der-ink-300, #9097a8);
  background: var(--der-surface-200, #f0f2f6);
  border-color: var(--der-border-100, #e5e8ef);
}
.der-de-sync-logos__pin.is-lit {
  color: #136c3c;
  background: #e5f4ea;
  border-color: #b5dec4;
}
.der-de-sync-logos__pin.is-pending {
  color: #8d5a00;
  background: #fbf2db;
  border-color: #ead7a4;
}
.der-de-sync-logos__pin.is-error {
  color: #a3322c;
  background: #fbe9e7;
  border-color: #e9b7b2;
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
  line-height: 1.4;
  font-size: 14px;
}
/* Blocked / not-applicable cells \u2014 DHIS2 greyedFields. Soft
 * indigo-tinted wash + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f9,
    #eef0f9 6px,
    #dde3f1 6px,
    #dde3f1 7px
  ) !important;
  color: #8893b1 !important;
  text-align: center;
}
/* Indicator rows \u2014 computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f0f3fb !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid var(--der-border, #d8dee8) !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 14px;
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
.der-de-toolbar__field--filter {
  min-width: 240px;
  max-width: 320px;
}
.der-de-toolbar__filter {
  display: inline-flex;
  width: 100%;
  position: relative;
}
.der-de-toolbar__filter-input {
  width: 100%;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  background: #fff;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__filter-input:hover { border-color: #9aa3b8; }
.der-de-toolbar__filter-input:focus {
  outline: 0;
  border-color: var(--der-brand-500, #4a55ce);
  box-shadow: 0 0 0 1px var(--der-brand-500, #4a55ce);
}
.der-de-toolbar__filter-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  cursor: pointer;
  color: #6e7a8a;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
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
  font-size: 14px;
  line-height: 1.45;
}
.der-de-form-card h2,
.der-de-form-card h3,
.der-de-form-card h4,
.der-de-custom-form h3,
.der-de-custom-form .formSection,
.der-de-custom-form h3.formSection {
  font-size: 16px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  letter-spacing: 0;
}
.der-de-custom-form p,
.der-de-custom-form label,
.der-de-custom-form td,
.der-de-custom-form th,
.der-de-form-card p,
.der-de-form-card label {
  font-size: 14px;
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
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-kicker,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-num,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-h1,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-lead,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-note,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-muted,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-head,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-foot {
  display: none !important;
}
/* Author mode \u2014 let the DHIS2 custom-form HTML render natively.
 * Only the .tblep-table border suppression in DER mode is
 * undone; author tables retain their own 1 px row borders +
 * background accents. */
.der-de-custom-form--author .tblep-root,
.der-de-custom-form--author .tblep-head,
.der-de-custom-form--author .tblep-panel,
.der-de-custom-form--author .tblep-table th,
.der-de-custom-form--author .tblep-table td,
.der-de-custom-form--author table th,
.der-de-custom-form--author table td {
  padding: revert !important;
  border: revert !important;
  background: revert !important;
  color: revert !important;
  margin: revert !important;
  border-radius: revert !important;
}
.der-de-custom-form--author input[name$="-val"],
.der-de-custom-form--author input[name="entryfield"],
.der-de-custom-form--author input[name="total"] {
  border: revert !important;
  border-radius: revert !important;
  padding: revert !important;
  background: revert !important;
  font-size: revert !important;
  color: revert !important;
}
.der-de-custom-form .tblep-table,
.der-de-custom-form table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 14px;
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
  font-size: 14px;
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  color: var(--der-ink-700, #2a3447) !important;
  font-weight: 500;
  font-size: 14px;
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
  background: transparent !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
.der-de-custom-form .tblep-table input[type="text"],
.der-de-custom-form table input[type="text"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  width: 100% !important;
  padding: 2px 4px !important;
  border: 0;
  background: transparent !important;
  font-size: 14px !important;
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
  font-size: 14px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #e5e9ef;
  padding: var(--der-de-cell-pad, 6px 8px);
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable thead th {
  background: transparent;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
  text-align: center;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: transparent;
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
  background: #f0f3fb;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f9;
  color: #8893b1;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #e5e9ef;
  background: #fff;
  padding: 2px 4px;
  font-size: 14px;
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
/* Validation modal \u2014 large centered dialog. Replaces the
 * right-rail drawer: easier to read many issues at once +
 * surfaces a clean success state. */
.der-de-validation-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.der-de-validation {
  background: #fff;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
}
.der-de-validation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-validation__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.der-de-validation__heading {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #101a32;
}
.der-de-validation__badge {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.der-de-validation--ok .der-de-validation__badge {
  background: #1b8243;
}
.der-de-validation--err .der-de-validation__badge {
  background: #c0392b;
}
.der-de-validation__close {
  background: transparent; border: 0; cursor: pointer;
  color: #5b6478; font-size: 22px; line-height: 1;
}
.der-de-validation__body {
  padding: 16px 20px 20px;
  overflow-y: auto;
}
.der-de-validation__ok-prose {
  margin: 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.5;
}
.der-de-validation__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.der-de-validation__table th,
.der-de-validation__table td {
  padding: 8px 10px;
  text-align: left;
  color: #101a32;
  border-bottom: 1px solid #eef0f3;
}
.der-de-validation__table thead th {
  font-size: 12px;
  font-weight: 500;
  color: #5b6478;
  border-bottom: 2px solid #d8dee8;
}
.der-de-validation__coc { color: #5b6478; }
.der-de-validation__value {
  display: inline-block;
  padding: 1px 6px;
  background: #fbeaea;
  color: #8a2525;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.der-de-validation__why { color: #8a2525; }
.der-de-validation__jump-btn {
  background: transparent;
  border: 0;
  color: #4a55ce;
  font-size: 12px;
  cursor: pointer;
}
.der-de-validation__jump-btn:hover { color: #2c3597; }

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
`;export{Qe as default};
