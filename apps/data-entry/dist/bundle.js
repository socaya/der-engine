/* @der-app {"appKey":"data-entry","displayName":"Data Entry","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as D,useRef as se,useState as C}from"react";import{useAuth as tt,useOrgUnitBinding as rt,useOnlineStatus as ot,useDerApi as at,ScreenCard as nt}from"@der/app-sdk";import{Fragment as X,jsx as c,jsxs as y}from"react/jsx-runtime";function it(){let r=tt(),o=rt(),s=ot(),e=at(),[i,n]=C("custom"),[t,l]=C([]),[d,m]=C(""),[a,u]=C(""),[p,f]=C(""),[_,w]=C(""),[h,N]=C({kind:"idle"}),[E,A]=C(null),T=se(null),[O,M]=C({}),H=se({}),[Q,ee]=C([]),[z,K]=C(null),[te,fe]=C(!1),[Pe,re]=C(new Set),[Ue,oe]=C(new Set),[J,ge]=C(""),[V,He]=C(0),[G,ze]=C([]),[be,W]=C(!1),he=se(0),[Fe,qe]=C(null),[Be,ae]=C({localSaved:!1,central:null}),[Ve,Qe]=C(0),[Ke,ne]=C(!1),[ye,Je]=C(null),[Ge,ve]=C(!1);D(()=>{let b=g=>{if(g.key!=="?")return;let x=g.target;x&&(x.tagName==="INPUT"||x.tagName==="TEXTAREA")||(g.preventDefault(),ne(v=>!v))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]),D(()=>{let b=g=>{let x=T.current;x&&x.querySelector('input[data-dirty="1"]')&&(g.preventDefault(),g.returnValue="")};return window.addEventListener("beforeunload",b),()=>window.removeEventListener("beforeunload",b)},[]);let[F,We]=C(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});D(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",F)}catch{}},[F]);let[q,Ze]=C(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});D(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),D(()=>{let b=!1;return(async()=>{if(!o.bound||!o.orgUnitUid){l([]);return}try{let g=await e.listDataSets(o.orgUnitUid);if(b)return;let x=(g.dataSets??[]).map(v=>({id:v.id,label:v.displayName??v.name??v.id,periodType:v.periodType,formType:v.formType})).sort((v,k)=>v.label.localeCompare(k.label));l(x)}catch{}})(),()=>{b=!0}},[o.bound,o.orgUnitUid]),D(()=>{if(d.trim()===""){A(null),ee([]),M({}),H.current={};return}let b=!1;return(async()=>{try{let g=await e.getDataSetMeta(d.trim());if(b)return;let x=!!g.dataEntryForm&&g.formType==="CUSTOM"||g.formType==="SECTION";A({hasCustomForm:x,formId:g.dataEntryForm?.id,displayName:g.displayName??g.name,formType:g.formType,periodType:g.periodType,openFuturePeriods:g.openFuturePeriods??0}),n(x?"custom":"structured");try{let v=await e.getDataSetFormMetadata(d.trim());if(b)return;let k=await Ce(v,e);if(b)return;let j=(k.categoryCombo?.categories??[]).filter(L=>(L.categoryOptions?.length??0)>1).map(L=>({id:L.id,name:L.name??L.id,options:(L.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));ee(j);let U={};for(let L of j)L.options[0]&&(U[L.id]=L.options[0].id);M(U),H.current=U}catch{}}catch{b||A(null)}})(),()=>{b=!0}},[d]),D(()=>{if(i!=="custom"||!E?.hasCustomForm||E.formType==="CUSTOM"&&!E.formId)return;let b=T.current;if(!b)return;let g=!1;return(async()=>{N({kind:"submitting"});try{let x=await e.getDataSetFormMetadata(d.trim());if(g)return;let v=await Ce(x,e);if(g)return;let k="";if(E.formType==="CUSTOM"&&E.formId){try{k=(await e.getDataEntryFormHtml(E.formId)).htmlCode??""}catch(S){k="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",S)}k.trim()||(k=Se(v))}else E.formType==="SECTION"&&(k=Se(v));if(g)return;let j=await e.listValidationRules(d.trim()).catch(()=>({validationRules:[]}));if(g)return;let U=(v.categoryCombo?.categories??[]).filter(S=>(S.categoryOptions?.length??0)>1).map(S=>({id:S.id,name:S.name??S.id,options:(S.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));ee(U);let L={};for(let S of U)S.options[0]&&(L[S.id]=S.options[0].id);M(L),H.current=L,b.replaceChildren();for(let[S,$]of[["selectedDataSetId",d.trim()],["selectedPeriodId",a.trim()],["selectedOrganisationUnitId",o.orgUnitUid??""]]){let R=document.createElement("input");R.type="hidden",R.id=S,R.value=$,b.appendChild(R)}for(let[S,$]of Object.entries(L)){let R=document.createElement("input");R.type="hidden",R.id=`category-${S}`,R.value=$,R.setAttribute("data-der-category",S),b.appendChild(R)}let I=document.createElement("div");I.id="contentDiv",b.appendChild(I),ct({dataSetId:d.trim(),periodId:a.trim(),orgUnitId:o.orgUnitUid??"",meta:v,aocSelections:L,validationRules:j.validationRules??[]}),Je({description:v.description,sectionCount:v.sections?.length??0,dataElementCount:v.dataSetElements?.length??0,compulsoryCount:v.compulsoryDataElementOperands?.length??0,validationRuleCount:j.validationRules?.length??0,indicatorCount:v.indicators?.length??0});for(let S of st)Re(S);for(let S of dt)document.querySelector(`script[data-der-custom-form="${S}"]`)||await Me(S);ut(),await jt(I,k,{stripStyles:F==="der"}),await Rt(I,d.trim(),a.trim(),o.orgUnitUid??"",e),pt(I,()=>d.trim(),()=>a.trim(),()=>o.orgUnitUid??"",()=>({...H.current}),e,S=>{ae($=>({...$,localSaved:!0,central:$.central==="CENTRAL_ACCEPTED"&&S==="saved"?"PENDING":$.central})),Qe($=>$+1)}),I.addEventListener("blur",S=>{let $=S.target;if($&&$.tagName==="INPUT"&&/-val$/.test($.getAttribute("name")??"")&&$.value.trim()!==""){let R=a.trim();oe(de=>de.has(R)?de:new Set(de).add(R))}},!0),ft(I),Nt(I,N),Ct(I),St(I),Lt(I,v,qe),$t(I,v),Dt(I,v),It(I),At(I,v),Tt(I,v),He(S=>S+1),N({kind:"idle"})}catch(x){N({kind:"error",message:`custom form failed to render: ${x.message}`})}})(),()=>{g=!0}},[i,E,d,a,o.orgUnitUid,F]);let Xe=o.bound&&d.trim()!==""&&a.trim()!==""&&p.trim()!==""&&_.trim()!==""&&h.kind!=="submitting";async function Ye(b){b.preventDefault(),N({kind:"submitting"});try{await e.submitAggregate({dataSet:d,period:a,orgUnit:o.orgUnitUid,dataValues:[{dataElement:p,value:_}]}),N({kind:"ok",message:`Submitted ${p}=${_} for ${a}.`}),f(""),w("")}catch(g){N({kind:"error",message:g.message??"Submission failed"})}}let xe=a.trim()!=="",ie=d.trim()!=="",B=ie&&xe&&o.bound;D(()=>{let b=T.current;if(!b)return;let g=J.trim().toLowerCase(),x=Array.from(b.querySelectorAll("tbody tr"));for(let v of x){if(!g){v.style.display="";continue}let j=((v.querySelector(".dataElementCell")??v.querySelector("td"))?.textContent??"").toLowerCase();v.style.display=j.includes(g)?"":"none"}},[J,V]),D(()=>{let b=o.orgUnitUid??"";if(!d.trim()||!b||!a.trim()){ae(k=>k.central==null&&!k.updatedAt?k:{...k,central:null});return}let g=!1,x=null,v=async()=>{try{let k=await e.readAggregateFormSyncState(d.trim(),b,a.trim());if(g)return;ae(U=>({localSaved:U.localSaved||k.state!=null,central:k.state,updatedAt:k.updatedAt})),(k.state==="PENDING"||k.state==="IN_FLIGHT"||k.state==="RETRYABLE")&&(x=setTimeout(()=>void v(),4e3))}catch{}};return v(),()=>{g=!0,x&&clearTimeout(x)}},[d,a,o.orgUnitUid,Ve]),D(()=>{if(!d.trim()||!o.bound||!E?.periodType){re(new Set),oe(new Set);return}let b=!1;return(async()=>{let g=je(E.periodType,E.openFuturePeriods??0).map(k=>k.id),[x,v]=await Promise.all([Promise.all(g.map(async k=>{try{return(await e.getCompletion(d.trim(),o.orgUnitUid??"",k)).completed?k:null}catch{return null}})),Promise.all(g.map(async k=>{try{return((await e.readAggregateValues(o.orgUnitUid??"",k,1)).dataValues?.length??0)>0?k:null}catch{return null}}))]);b||(re(new Set(x.filter(k=>k!==null))),oe(new Set(v.filter(k=>k!==null))))})(),()=>{b=!0}},[d,o.orgUnitUid,E?.periodType]),D(()=>{if(!B){K(null);return}let b=!1;return(async()=>{try{let g=await e.getCompletion(d.trim(),o.orgUnitUid??"",a.trim());if(b)return;K({completed:!!g.completed,completedAt:g.completedAt})}catch{b||K({completed:!1})}})(),()=>{b=!0}},[d,a,o.orgUnitUid,B]);function _e(){Mt(T.current,N,(b,g)=>{ze(b),he.current=g,W(!0)})}let[we,et]=C(0);D(()=>{let b=()=>{let k=T.current;et(k?k.querySelectorAll('input[data-dirty="1"]').length:0)};b();let g=T.current,x=()=>b();g?.addEventListener("input",x,!0),g?.addEventListener("blur",x,!0);let v=window.setInterval(b,1e3);return()=>{g?.removeEventListener("input",x,!0),g?.removeEventListener("blur",x,!0),window.clearInterval(v)}},[V]);function ke(){let b=T.current;if(!b)return;let g=Array.from(b.querySelectorAll('input[data-dirty="1"]'));for(let x of g)x.dispatchEvent(new Event("blur",{bubbles:!0}))}let[P,Ee]=C(()=>({tone:"up",lastPingAt:null,consecutiveFailures:0}));D(()=>{let b=!1,g=null,x=async()=>{try{if(await e.health(),b)return;Ee({tone:"up",lastPingAt:new Date().toISOString(),consecutiveFailures:0})}catch{if(b)return;Ee(v=>{let k=v.consecutiveFailures+1;return{tone:k>=2?"down":"slow",lastPingAt:v.lastPingAt,consecutiveFailures:k}})}finally{b||(g=setTimeout(()=>void x(),5e3))}};return x(),()=>{b=!0,g&&clearTimeout(g)}},[e]);async function Ne(){if(!B||te)return;let b=!z?.completed;if(b){let g=T.current;if(g){let x=[];for(let v of Array.from(g.querySelectorAll('input[data-compulsory="1"]')))v.value.trim()===""&&x.push(v);if(x.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${x.length} compulsory value${x.length===1?"":"s"} still missing. Run Validate to jump to them.`}),x[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}fe(!0);try{let g=await e.markCompletion({dataSet:d.trim(),orgUnit:o.orgUnitUid??"",period:a.trim(),completed:b});K({completed:!!g.completed,completedAt:g.completedAt}),re(x=>{let v=new Set(x);return g.completed?v.add(a.trim()):v.delete(a.trim()),v}),N({kind:"ok",message:g.completed?"Dataset marked complete.":"Dataset reopened."})}catch(g){N({kind:"error",message:`Completion failed: ${g.message}`})}finally{fe(!1)}}return D(()=>{let b=g=>{!g.altKey||g.metaKey||g.ctrlKey||g.shiftKey||(g.code==="KeyV"?(g.preventDefault(),_e()):g.code==="KeyC"?(g.preventDefault(),Ne()):g.code==="KeyS"&&(g.preventDefault(),ke()))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)}),y(nt,{dataTest:"der-aggregate-entry",children:[c("style",{children:zt}),y("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[y("div",{className:"der-de-toolbar__head",children:[c("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:y("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[c("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),c("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),c("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),c("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),c("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),c("h1",{className:"der-de-toolbar__title",children:"Data Entry"}),E&&ye&&c("button",{type:"button",className:"der-de-toolbar__info-btn","data-test":"de-info-btn","aria-label":"About this dataset",title:"About this dataset",onClick:()=>ve(b=>!b),children:y("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[c("circle",{cx:"8",cy:"8",r:"7",fill:"none",stroke:"currentColor",strokeWidth:"1.5"}),c("circle",{cx:"8",cy:"4.5",r:"0.9",fill:"currentColor"}),c("path",{d:"M8 7v5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}),y("span",{className:"der-de-status-icon","data-test":"de-wan-status","data-state":s.isOnline?"up":"down","aria-label":s.isOnline?"Internet online":`Internet offline \u2014 ${s.queuedCount} queued`,title:s.isOnline?"Internet reachable (navigator.onLine)":`Internet offline \xB7 ${s.queuedCount} queued`,children:[c(xt,{}),c("span",{className:"der-de-status-icon__dot is-"+(s.isOnline?"lit":"error"),"aria-hidden":"true"}),!s.isOnline&&s.queuedCount>0&&c("span",{className:"der-de-status-icon__count",children:s.queuedCount})]}),y("span",{className:"der-de-status-icon","data-test":"de-edge-pill","data-state":P.tone,"aria-label":"DER edge "+P.tone,title:P.lastPingAt?`DER edge \xB7 ${P.tone} \xB7 last checked ${Le(P.lastPingAt)}`:`DER edge \xB7 ${P.tone}`,children:[c($e,{}),c("span",{className:"der-de-status-icon__dot is-"+(P.tone==="up"?"lit":P.tone==="slow"?"pending":"error"),"aria-hidden":"true"})]}),y("span",{className:"der-de-toolbar__ou-wrap",children:[c("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),c("span",{className:"der-de-toolbar__ou",title:o.orgUnitPath||o.orgUnitUid||"","data-test":"de-toolbar-ou",children:o.orgUnitDisplayName||o.orgUnitUid||"Not bound to an OU"})]})]}),y("div",{className:"der-de-toolbar__picks",children:[y("label",{className:"der-de-toolbar__field",children:[c("span",{className:"der-de-toolbar__field-label",children:"Data set"}),y("select",{className:"der-de-toolbar__select",value:d,onChange:b=>{m(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[c("option",{value:"",children:"Select a data set\u2026"}),t.map(b=>c("option",{value:b.id,children:b.label},b.id))]})]}),Q.map(b=>y("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[c("span",{className:"der-de-toolbar__field-label",children:b.name}),y("select",{className:"der-de-toolbar__select",value:O[b.id]??"",onChange:g=>{let x={...O,[b.id]:g.target.value};M(x),H.current=x,mt(T.current,x)},"data-test":"de-aoc-select",children:[c("option",{value:"",children:"Select\u2026"}),b.options.map(g=>c("option",{value:g.id,children:g.name},g.id))]})]},b.id)),y("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[y("span",{className:"der-de-toolbar__field-label",children:["Period",E?.periodType?` \xB7 ${E.periodType}`:""]}),c("span",{className:"der-de-period-wrap",children:Ut(E?.periodType,a,u,Pe,Ue,E?.openFuturePeriods??0)})]}),y("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[c("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),y("span",{className:"der-de-toolbar__filter",children:[c("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:J,onChange:b=>ge(b.target.value),"data-test":"de-filter-input"}),J&&c("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>ge(""),children:"\xD7"})]})]}),c("div",{className:"der-de-toolbar__cell-info",children:c(yt,{root:T,details:Fe,formVersion:V,formSync:Be,onClear:b=>{let g=T.current;if(!g)return;let x=g.querySelector(`input[name="${b}"]`);x&&(x.value="",x.dispatchEvent(new Event("input",{bubbles:!0})),x.focus())},onComment:(b,g)=>{let x=T.current;if(!x)return;let v=x.querySelector(`input[name="${b}"]`);v&&(g===""?v.removeAttribute("data-comment"):v.setAttribute("data-comment",g),v.value.trim()!==""&&(v.focus(),v.dispatchEvent(new Event("blur",{bubbles:!0}))))}})})]})]}),h.kind==="ok"&&c("div",{style:Ot,"data-test":"de-ok",children:h.message}),h.kind==="error"&&c("div",{style:Pt,"data-test":"de-err",children:h.message}),!o.bound&&c("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),o.bound&&!ie&&c("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),o.bound&&ie&&!xe&&y("div",{className:"der-de-placeholder",children:["Pick a period to load the ",E?.formType==="SECTION"?"section":"data entry"," form."]}),B&&i==="structured"&&y("form",{onSubmit:Ye,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[y("label",{children:["Data element UID",c("input",{value:p,onChange:b=>f(b.target.value),style:me})]}),y("label",{children:["Value",c("input",{value:_,onChange:b=>w(b.target.value),inputMode:"decimal",style:me})]}),c("div",{style:{gridColumn:"1 / -1"},children:c("button",{type:"submit",disabled:!Xe,style:Ae,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),B&&i==="custom"&&c("div",{className:`der-de-form-card der-de-density-${q}`,children:y("div",{className:"der-de-form-split",children:[c(bt,{targetRef:T,formVersion:V}),c("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),B&&i==="custom"&&y("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[c(ht,{root:T,formVersion:V}),c("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Ze(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),c("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${F==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${F==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>We(b=>b==="der"?"author":"der"),children:F==="der"?"\u2699 DER layout":"\u2699 Author layout"}),z&&c("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:z.completed?`Complete${z.completedAt?" \xB7 "+new Date(z.completedAt).toLocaleString():""}`:"Open for edits"}),we>0&&y("button",{type:"button",onClick:ke,className:"der-de-saveall-btn","data-test":"de-saveall-btn",title:"Flush all unsaved cells to the DER mirror (Alt+S)",children:["Save all \xB7 ",we]}),c("button",{type:"button",onClick:_e,style:De,"data-test":"de-validate-btn",children:"Validate"}),G.length>0&&!be&&y("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[G.length," issue",G.length===1?"":"s"]}),c("button",{type:"button",onClick:()=>ne(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),c("button",{type:"button",onClick:Ne,disabled:te,style:z?.completed?De:Ae,"data-test":"de-complete-btn",children:te?"Saving\u2026":z?.completed?"Reopen":"Mark complete"})]}),c(kt,{open:Ke,onClose:()=>ne(!1)}),c(Et,{open:Ge,onClose:()=>ve(!1),formInfo:E,summary:ye}),c(wt,{open:be,issues:G,totalCells:he.current,onClose:()=>W(!1),onPick:b=>{let g=T.current?.querySelector(`input[name="${b.inputName}"]`);g&&(g.scrollIntoView({behavior:"smooth",block:"center"}),g.focus(),g.select()),W(!1)}})]})}var dt=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],st=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],le=null,ce=null,ue=null;async function Ce(r,o){le||(le=o.listAllDataElements().then(l=>new Map(l.map(d=>[d.id,d])))),ce||(ce=o.listAllCategoryCombos().then(l=>new Map(l.map(d=>[d.id,d])))),ue||(ue=o.listAllCategoryOptionCombos().then(l=>{let d=new Map;for(let m of l){let a=m.categoryCombo?.id;if(!a)continue;let u=d.get(a);u?u.push(m):d.set(a,[m])}return d}));let[s,e,i]=await Promise.all([le,ce,ue]),n=l=>{if(!l?.id)return;let d=e.get(l.id),m=i.get(l.id)??[];return d?{id:d.id,name:d.name??d.displayName,categoryOptionCombos:m.map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:a.categoryOptions??[]})),categories:(d.categories??[]).map(a=>({id:a.id,name:a.name??a.displayName,categoryOptions:(a.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:l},t=l=>{let d=s.get(l.id);return d?{id:d.id,name:d.name??d.displayName,formName:d.formName,valueType:d.valueType,categoryCombo:n(d.categoryCombo)}:l};return{...r,categoryCombo:n(r.categoryCombo)??r.categoryCombo,dataSetElements:(r.dataSetElements??[]).map(l=>({...l,dataElement:l.dataElement?t(l.dataElement):void 0})),sections:(r.sections??[]).map(l=>({...l,dataElements:(l.dataElements??[]).map(d=>t(d))}))}}function Se(r){let o={};for(let l of r.dataSetElements??[])l.dataElement&&(o[l.dataElement.id]=l.dataElement);let s={};for(let l of r.indicators??[])s[l.id]=l;let e=(r.sections??[]).slice().sort((l,d)=>(l.sortOrder??0)-(d.sortOrder??0));if(!e.some(l=>(l.dataElements?.length??0)>0)){let l=(r.dataSetElements??[]).map(d=>d.dataElement).filter(d=>!!d);e=[{id:r.id,name:r.displayName??r.name??"Data entry",sortOrder:0,dataElements:l,indicators:[],greyedFields:[]}]}let n=l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),t=[];for(let l of e){let d=new Set;for(let a of l.greyedFields??[])a.dataElement?.id&&a.categoryOptionCombo?.id&&d.add(`${a.dataElement.id}:${a.categoryOptionCombo.id}`);t.push(`<h3 class="formSection">${n(l.name??"")}</h3>`);let m=new Map;for(let a of l.dataElements??[]){let u=o[a.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,f=m.get(p);f||(f={cc:u.categoryCombo,des:[]},m.set(p,f)),f.des.push(u)}for(let a of m.values()){let u=a.cc.categoryOptionCombos??[],p=a.cc.categories??[];t.push('<div class="der-de-table-scroll">'),t.push('<table class="sectionTable" cellspacing="0">');let f=lt(p,u),_=u.length>=2;if(t.push("<thead>"),f.length>0)for(let w=0;w<f.length;w++){t.push("<tr>"),w===0&&t.push(`<th class="dataElementCell" rowspan="${f.length}">Data elements</th>`);for(let h of f[w]??[])t.push(`<th colspan="${h.span}">${n(h.label)}</th>`);w===0&&_&&t.push(`<th class="der-de-row-total-cell" rowspan="${f.length}">Total</th>`),t.push("</tr>")}else{t.push("<tr>"),t.push('<th class="dataElementCell">Data elements</th>');for(let w of u)t.push(`<th>${n(w.name??"")}</th>`);_&&t.push('<th class="der-de-row-total-cell">Total</th>'),t.push("</tr>")}t.push("</thead><tbody>");for(let w of a.des){t.push("<tr>"),t.push(`<td class="dataElementCell" id="${n(w.id)}-cell">`+n(w.formName??w.name??w.id)+"</td>");for(let h of u){let N=`${w.id}-${h.id}-val`;d.has(`${w.id}:${h.id}`)?t.push('<td class="greyed">\u2014</td>'):t.push(`<td><input type="text" id="${n(N)}" name="${n(N)}" dataelementid="${n(w.id)}" optioncomboid="${n(h.id)}"></td>`)}_&&t.push(`<td class="der-de-row-total-cell" data-de-row-total="${n(w.id)}">\u2014</td>`),t.push("</tr>")}for(let w of l.indicators??[]){let h=s[w.id];if(!h)continue;let N=_?u.length+1:u.length;t.push('<tr class="indicatorRow">'),t.push(`<td class="dataElementCell">${n(h.name??h.id)}</td>`),t.push(`<td colspan="${N}"><input type="text" name="indicator" indicatorid="${n(h.id)}" readonly></td>`),t.push("</tr>")}t.push("</tbody></table></div>")}}return t.join(`
`)}function lt(r,o){if(r.length===0||o.length===0)return[];let s=new Map;for(let t of r)for(let l of t.categoryOptions??[])s.set(l.id,{catId:t.id,name:l.name??l.id});let e=r.length,i=o.map(t=>{let l=new Array(e).fill("");for(let d of t.categoryOptions??[]){let m=s.get(d.id);if(!m)continue;let a=r.findIndex(u=>u.id===m.catId);a>=0&&(l[a]=m.name)}return l});for(let t of i)if(t.some(l=>l===""))return[];let n=[];for(let t=0;t<e;t++){let l=[];for(let d=0;d<i.length;){let m=i[d],a=d+1;for(;a<i.length;){let u=i[a],p=!0;for(let f=0;f<=t;f++)if(m[f]!==u[f]){p=!1;break}if(!p)break;a++}l.push({label:m[t]??"",span:a-d}),d=a}n.push(l)}return n}function ct(r){let o=globalThis;o.dhis2=o.dhis2??{};let s=o.dhis2;s.de=s.de??{};let e=s.de;e.currentDataSetId=r.dataSetId,e.currentOrganisationUnitId=r.orgUnitId,e.currentPeriodId=r.periodId,e.currentCategorySelections={...r.aocSelections??{}};let i=r.meta??{},n={},t={};if(i.categoryCombo){t[i.categoryCombo.id]=i.categoryCombo;for(let u of i.categoryCombo.categories??[])n[u.id]=u}e.categories=n,e.categoryCombos=t;let l={},d={};for(let u of i.dataSetElements??[]){let p=u.dataElement;p&&(l[p.id]=p,p.optionSet&&(d[p.optionSet.id]=p.optionSet),p.categoryCombo&&(t[p.categoryCombo.id]=p.categoryCombo))}e.dataElements=l,e.optionSets=d;let m={};for(let u of i.indicators??[])m[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};e.indicatorFormulas=m;let a={};for(let u of r.validationRules??[])a[u.id]=u;e.validationRules=a,e.lockExceptions=[],e.emptyOrganisationUnits=[],e.significantZeros=[],e.dataSets={[i.id]:{id:i.id,name:i.name??i.displayName??"",periodType:i.periodType,categoryCombo:i.categoryCombo?.id,periodId:r.periodId}},o.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ut(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(o,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let o=r.dhis2.period;o.format="yyyy-mm-dd",o.calendar=r.$.calendars.instance("gregorian"),o.PeriodGenerator&&(o.generator=new o.PeriodGenerator(o.calendar,o.format)),o.DatePicker&&(o.picker=new o.DatePicker(o.calendar,o.format))}}function mt(r,o){if(!r)return;for(let[e,i]of Object.entries(o)){let n=r.querySelector(`input[data-der-category="${e}"]`);n||(n=document.createElement("input"),n.type="hidden",n.id=`category-${e}`,n.setAttribute("data-der-category",e),r.appendChild(n)),n.value=i}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...o})}function pt(r,o,s,e,i,n,t){let l=p=>{let f=/^(.+)-(.+)-val$/.exec(p);return f?{de:f[1],coc:f[2]}:null},d=new WeakMap,m=new WeakMap,a=r.querySelectorAll('input[name$="-val"]');for(let p of Array.from(a))d.set(p,p.value),m.set(p,p.getAttribute("data-comment")??"");let u=async p=>{let f=p.target;if(!f||f.tagName!=="INPUT")return;let _=f.getAttribute("name")??"",w=l(_);if(!w)return;let h=o(),N=s(),E=e();if(!h||!N||!E)return;let A=f.value,T=f.getAttribute("data-comment")??"";if(d.get(f)===A&&(m.get(f)??"")===T)return;let O=f.getAttribute("data-valuetype")??"TEXT";if(A!==""&&pe(A,O)){Z(f,"error");return}Z(f,"saving");try{let M=f.getAttribute("data-comment")??void 0,H=await n.submitAggregate({dataSet:h,period:N,orgUnit:E,attributeOptionComboSelections:i(),dataValues:[{dataElement:w.de,categoryOptionCombo:w.coc,value:A,...M&&M.trim()!==""?{comment:M}:{}}]});d.set(f,A),m.set(f,T);let Q=H?.status==="OFFLINE_QUEUED"?"queued":"saved";Z(f,Q),f.removeAttribute("data-dirty"),t?.(Q)}catch{Z(f,"error")}};r.addEventListener("blur",p=>{u(p)},!0),r.addEventListener("input",p=>{let f=p.target;!f||f.tagName!=="INPUT"||/-val$/.test(f.getAttribute("name")??"")&&(f.value!==d.get(f)?f.setAttribute("data-dirty","1"):f.removeAttribute("data-dirty"))},!0)}function ft(r){let o=(e,i)=>{let n=e.getAttribute("name")??"",t=/^(.+)-(.+)-val$/.exec(n);if(!t)return;let l=t[2],d=Array.from(r.querySelectorAll(`input[name$="-${l}-val"]`)),m=d.indexOf(e);if(m===-1)return;let a=d[m+i];a&&(a.focus(),a.select())},s=(e,i)=>{let n=e.closest("tr");if(!n)return;let t=Array.from(n.querySelectorAll('input[name$="-val"]')),l=t.indexOf(e);if(l===-1)return;let d=t[l+i];d&&(d.focus(),d.select())};r.addEventListener("keydown",e=>{let i=e,n=i.target;if(n instanceof HTMLInputElement&&/-val$/.test(n.getAttribute("name")??"")&&!(i.metaKey||i.ctrlKey||i.altKey)){if(i.key==="Enter"){i.preventDefault(),o(n,i.shiftKey?-1:1);return}if(i.key==="ArrowUp"||i.key==="ArrowDown"){i.preventDefault(),o(n,i.key==="ArrowUp"?-1:1);return}if(i.key==="ArrowLeft"||i.key==="ArrowRight"){let t=n.selectionStart===0&&n.selectionEnd===0,l=n.selectionStart===n.value.length&&n.selectionEnd===n.value.length;i.key==="ArrowLeft"&&t?(i.preventDefault(),s(n,-1)):i.key==="ArrowRight"&&l&&(i.preventDefault(),s(n,1))}}})}function gt(r){let o=Array.from(r.querySelectorAll("h2, h3, h4")).filter(n=>(n.textContent??"").trim().length>0);if(o.length<2)return[];let s=new Set(o),e=[],i=(n,t)=>{for(let l of s)if(l!==t&&n.contains(l))return!0;return!1};return o.forEach((n,t)=>{let l=n.id||`der-de-section-${t}`;n.id=l;let d=null,m=n.parentElement,a=null;for(;m&&m!==r&&!i(m,n);)a=m,m=m.parentElement;if(a&&a.children.length>1&&a!==r)d=a,d.classList.add("der-de-section-slot"),d.dataset.sectionId=l;else{d=document.createElement("div"),d.className="der-de-section-slot",d.dataset.sectionId=l;let u=o[t+1]??null,p=[],f=n;for(;f&&f!==u;){let _=f.nextSibling;p.push(f),f=_}n.parentNode?.insertBefore(d,n);for(let _ of p)d.appendChild(_)}e.push({id:l,label:(n.textContent??"").trim(),slot:d})}),e}function bt({targetRef:r,formVersion:o}){let[s,e]=C([]),[i,n]=C(""),[t,l]=C({});return D(()=>{let d=r.current;if(!d)return;let m=gt(d);e(m),n(m[0]?.id??"")},[r,o]),D(()=>{if(s.length===0)return;let d=m=>{if(!m.altKey||m.metaKey||m.ctrlKey||m.shiftKey)return;let a=/^Digit([1-9])$/.exec(m.code);if(!a)return;let u=Number(a[1]),p=s[u-1];p&&(m.preventDefault(),n(p.id))};return window.addEventListener("keydown",d),()=>window.removeEventListener("keydown",d)},[s]),D(()=>{if(s.length===0)return;let d=()=>{let u={};for(let p of s){let f=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),_=f.filter(w=>w.value.trim()!=="").length;u[p.id]={filled:_,total:f.length}}l(u)};d();let m=r.current;if(!m)return;let a=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&d()};return m.addEventListener("input",a,!0),()=>{m.removeEventListener("input",a,!0)}},[r,s]),D(()=>{if(!r.current||s.length===0)return;for(let a of s)a.slot.style.display=a.id===i?"":"none";let m=s.find(a=>a.id===i);m&&m.slot.scrollIntoView({behavior:"smooth",block:"start"})},[r,s,i]),s.length<2?null:y("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[c("div",{className:"der-de-section-nav__title",children:"Sections"}),c("ul",{className:"der-de-section-nav__list",children:s.map(d=>{let m=t[d.id],a=!m||m.total===0||m.filled===0?"muted":m.filled===m.total?"done":"partial";return c("li",{children:y("button",{type:"button",className:"der-de-section-nav__item"+(i===d.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>n(d.id),children:[c("span",{className:"der-de-section-nav__label",children:d.label}),m&&m.total>0&&c("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${a}`,"data-test":"de-section-nav-ratio",title:`${m.filled} of ${m.total} cells filled`,children:a==="done"?"\u2713":`${m.filled}/${m.total}`})]})},d.id)})})]})}function ht({root:r,formVersion:o}){let[s,e]=C({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(D(()=>{let t=()=>{let d=r.current;if(!d)return;let m=Array.from(d.querySelectorAll('input[name$="-val"]')),a=0,u=0,p=0,f=0,_=0;for(let w of m){w.value.trim()!==""&&a++;let h=w.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?u++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?f++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?p++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&_++}e({total:m.length,filled:a,saving:u,saved:p,queued:f,error:_})};t();let l=window.setInterval(t,800);return()=>window.clearInterval(l)},[r,o]),s.total===0)return c("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let i=[];i.push(`${s.filled} of ${s.total} filled`),s.saving>0&&i.push(`${s.saving} saving`),s.queued>0&&i.push(`${s.queued} queued`),s.error>0&&i.push(`${s.error} error`);let n=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return c("span",{className:`der-de-savepill der-de-savepill--${n}`,"data-test":"de-save-state",children:i.join(" \xB7 ")})}function yt({details:r,formSync:o,onClear:s,onComment:e}){let[i,n]=C(!1),[t,l]=C("");D(()=>{l(r?.comment??""),n(!1)},[r?.inputName,r?.comment]);let d={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},m={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return y("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:[c("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:r?y(X,{children:[c("span",{className:"der-de-live-strip__de",children:r.deName}),c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:"der-de-live-strip__coc",children:r.cocName}),r.value&&y(X,{children:[c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:"der-de-live-strip__value",children:r.value}),c("button",{type:"button",className:"der-de-live-strip__clear","data-test":"de-live-clear","aria-label":"Clear value",title:"Clear this cell",onMouseDown:a=>{a.preventDefault()},onClick:()=>s(r.inputName),children:"\xD7"}),c("button",{type:"button",className:"der-de-live-strip__comment-btn"+(r.comment?" has-comment":""),"data-test":"de-live-comment-btn","aria-label":r.comment?"Edit comment on this cell":"Add a comment to this cell",title:r.comment?`Comment: ${r.comment}`:"Add a comment to this cell",onMouseDown:a=>a.preventDefault(),onClick:()=>{l(r.comment??""),n(a=>!a)},children:y("svg",{viewBox:"0 0 16 16",width:"12",height:"12","aria-hidden":"true",children:[c("path",{d:"M3 3h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3 2.5V4a1 1 0 0 1 1-1z",fill:"none",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"}),r.comment&&c("circle",{cx:"12",cy:"4",r:"2.5",fill:"#1b8243"})]})}),c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:`der-de-live-strip__state der-de-live-strip__state--${m[r.saveState]}`,children:d[r.saveState]}),(r.lastUpdated||r.lastUpdatedBy)&&y(X,{children:[c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),y("span",{className:"der-de-live-strip__audit","data-test":"de-live-audit",title:r.lastUpdated?new Date(r.lastUpdated).toLocaleString():void 0,children:[r.lastUpdated?Le(r.lastUpdated):"earlier",r.lastUpdatedBy&&y(X,{children:[" by ",c("strong",{children:r.lastUpdatedBy})]})]})]})]}),c(vt,{formSync:o,cellState:r.saveState}),r.compulsory&&c("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):c("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})}),r&&i&&c("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Edit cell comment","data-test":"de-comment-popover",onClick:a=>{a.target===a.currentTarget&&n(!1)},children:y("div",{className:"der-de-comment-modal",children:[y("header",{className:"der-de-comment-modal__head",children:[y("div",{className:"der-de-comment-modal__title-wrap",children:[c("span",{className:"der-de-comment-modal__eyebrow",children:"Cell comment"}),c("h3",{className:"der-de-comment-modal__title",children:r.deName}),r.cocName&&r.cocName!=="default"&&c("p",{className:"der-de-comment-modal__sub",children:r.cocName})]}),c("button",{type:"button",className:"der-de-comment-modal__close","aria-label":"Close comment editor",onClick:()=>n(!1),children:"\xD7"})]}),y("div",{className:"der-de-comment-modal__body",children:[c("textarea",{className:"der-de-comment-modal__textarea","data-test":"de-comment-textarea",autoFocus:!0,rows:5,maxLength:400,placeholder:"Add context e.g. stockout, device fault, late reporting\u2026",value:t,onChange:a=>l(a.target.value),onKeyDown:a=>{a.key==="Escape"&&n(!1),a.key==="Enter"&&(a.metaKey||a.ctrlKey)&&(e(r.inputName,t.trim()),n(!1))}}),y("div",{className:"der-de-comment-modal__hint",children:[y("span",{children:[t.length,"/400"]}),c("span",{children:"\u2318/Ctrl + Enter to save \xB7 Esc to close"})]})]}),y("footer",{className:"der-de-comment-modal__foot",children:[r.comment&&c("button",{type:"button",className:"der-de-comment-modal__delete","data-test":"de-comment-delete",onClick:()=>{e(r.inputName,""),n(!1)},children:"Delete"}),c("button",{type:"button",className:"der-de-comment-modal__cancel",onClick:()=>n(!1),children:"Cancel"}),c("button",{type:"button",className:"der-de-comment-modal__save","data-test":"de-comment-save",disabled:t.trim()===(r.comment??""),onClick:()=>{e(r.inputName,t.trim()),n(!1)},children:r.comment?"Update comment":"Save comment"})]})]})})]})}function vt({formSync:r,cellState:o}){let s=o==="saved"||o==="queued",e=o==="saved"||o==="queued"?"lit":o==="saving"?"pending":o==="error"?"error":"muted",i=r.central,n=s?i==="CENTRAL_ACCEPTED"?"lit":i==="PENDING"||i==="IN_FLIGHT"||i==="RETRYABLE"||i==="UNKNOWN_OUTCOME"?"pending":i==="CENTRAL_REJECTED"||i==="CONFLICT_REVIEW"||i==="QUARANTINED"||i==="REQUIRES_APPROVAL"?"error":"muted":"muted",t=e==="lit"?"Saved on edge (DER)":e==="pending"?"Saving on edge\u2026":e==="error"?"Rejected by edge":"No value entered yet",l=n==="lit"?"Synced to Central DHIS2":n==="pending"?`Sync in progress (${i})`:n==="error"?`Central reported ${i}`:s?"Awaiting Central sync":"No value entered yet";return y("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[y("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+e,title:t,"data-test":"de-sync-der","data-state":e,children:[c($e,{}),c("span",{className:"der-de-sync-logos__dot is-"+e,"aria-hidden":"true"})]}),y("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+n,title:l,"data-test":"de-sync-central","data-state":n,children:[c(_t,{}),c("span",{className:"der-de-sync-logos__dot is-"+n,"aria-hidden":"true"})]})]})}function xt(){return c("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"none",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round",children:[c("circle",{cx:"8",cy:"8",r:"6.3"}),c("path",{d:"M1.7 8h12.6"}),c("path",{d:"M8 1.7c2 2 2 10.6 0 12.6"}),c("path",{d:"M8 1.7c-2 2-2 10.6 0 12.6"})]})})}function $e(){return c("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"currentColor",fillRule:"evenodd",children:[c("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),c("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),c("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),c("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),c("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),c("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),c("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),c("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),c("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),c("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),c("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),c("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),c("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function _t(){return c("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"currentColor",children:[c("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),c("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),c("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function wt({open:r,issues:o,totalCells:s,onClose:e,onPick:i}){if(D(()=>{if(!r)return;let t=l=>{l.key==="Escape"&&e()};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[r,e]),!r)return null;let n=o.length===0;return c("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:t=>{t.target===t.currentTarget&&e()},children:y("div",{className:"der-de-validation "+(n?"der-de-validation--ok":"der-de-validation--err"),children:[y("header",{className:"der-de-validation__head",children:[y("div",{className:"der-de-validation__title",children:[c("span",{className:"der-de-validation__badge","aria-hidden":"true",children:n?"\u2713":"!"}),c("h3",{className:"der-de-validation__heading",children:n?`Validation passed \u2014 all ${s} cells OK.`:`Validation found ${o.length} issue${o.length===1?"":"s"} across ${s} cells.`})]}),c("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:e,children:"\xD7"})]}),c("div",{className:"der-de-validation__body",children:n?y("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",c("strong",{children:" Mark complete"})," when you're ready."]}):y("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[c("thead",{children:y("tr",{children:[c("th",{scope:"col",children:"Data element"}),c("th",{scope:"col",children:"Category option combo"}),c("th",{scope:"col",children:"Entered value"}),c("th",{scope:"col",children:"Problem"}),c("th",{scope:"col"})]})}),c("tbody",{children:o.map(t=>y("tr",{"data-test":"de-issues-row",children:[c("td",{children:t.deName}),c("td",{className:"der-de-validation__coc",children:t.cocName}),c("td",{children:c("code",{className:"der-de-validation__value",children:t.value||"\u2014"})}),c("td",{className:"der-de-validation__why",children:t.problem}),c("td",{className:"der-de-validation__jump",children:c("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>i(t),children:"Jump to cell \u2192"})})]},`${t.deId}-${t.cocId}`))})]})})]})})}function kt({open:r,onClose:o}){return D(()=>{if(!r)return;let e=i=>{i.key==="Escape"&&o()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[r,o]),r?c("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:e=>{e.target===e.currentTarget&&o()},children:y("div",{className:"der-de-shortcuts",children:[y("header",{className:"der-de-shortcuts__head",children:[c("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),c("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:o,children:"\xD7"})]}),c("dl",{className:"der-de-shortcuts__list",children:[["Enter / \u2193","Next row (same COC column)"],["Shift + Enter / \u2191","Previous row"],["\u2190 / \u2192","Previous / next COC column (same row)"],["Tab / Shift + Tab","Next / previous cell (DOM order)"],["Alt + 1..9","Jump to section N"],["Alt + S","Save all unsaved cells"],["Alt + V","Run validation"],["Alt + C","Toggle Complete marker"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([e,i])=>y("div",{className:"der-de-shortcuts__row",children:[c("dt",{children:c("kbd",{children:e})}),c("dd",{children:i})]},e))})]})}):null}function Et({open:r,onClose:o,formInfo:s,summary:e}){if(D(()=>{if(!r)return;let t=l=>{l.key==="Escape"&&o()};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[r,o]),!r||!s||!e)return null;let i=s.openFuturePeriods??0,n=[["Period type",s.periodType??"\u2014"],["Form type",s.formType??"\u2014"],["Open future periods",String(i)+(i===0?" (current period closed)":"")],["Sections",String(e.sectionCount)],["Data elements",String(e.dataElementCount)],["Compulsory cells",String(e.compulsoryCount)],["Indicators",String(e.indicatorCount)],["Validation rules",String(e.validationRuleCount)]];return c("div",{className:"der-de-shortcuts-backdrop der-de-info-backdrop",role:"dialog","aria-modal":"true","aria-label":"Dataset info","data-test":"de-info-popover",onClick:t=>{t.target===t.currentTarget&&o()},children:y("div",{className:"der-de-info-modal",children:[y("header",{className:"der-de-info-modal__head",children:[y("div",{className:"der-de-info-modal__title-wrap",children:[c("span",{className:"der-de-info-modal__eyebrow",children:"Dataset"}),c("h2",{className:"der-de-info-modal__title","data-test":"de-info-title",children:s.displayName??"Dataset info"})]}),c("button",{type:"button",className:"der-de-info-modal__close","aria-label":"Close dataset info","data-test":"de-info-close",onClick:o,children:"\xD7"})]}),y("div",{className:"der-de-info-modal__body",children:[e.description&&c("p",{className:"der-de-info-modal__desc","data-test":"de-info-desc",children:e.description}),c("dl",{className:"der-de-info-modal__stats",children:n.map(([t,l])=>y("div",{className:"der-de-info-modal__stat",children:[c("dt",{children:t}),c("dd",{"data-test":`de-info-${t.toLowerCase().replace(/\s+/g,"-")}`,children:l})]},t))})]}),c("footer",{className:"der-de-info-modal__foot",children:c("button",{type:"button",className:"der-de-info-modal__done","data-test":"de-info-done",onClick:o,children:"Done"})})]})})}function Nt(r,o){r.addEventListener("paste",s=>{let e=s.target;if(!e||e.tagName!=="INPUT")return;let i=e.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(i))return;let t=s.clipboardData?.getData("text/plain")??"",l=/\r?\n/.test(t),d=/\t/.test(t);if(!l&&!d)return;let m=t.split(/\r?\n/).filter((E,A,T)=>!(A===T.length-1&&E==="")).map(E=>E.split("	").map(A=>A.trim()));if(m.length===0)return;s.preventDefault();let a=e.closest("[data-section-id]")??r,p=Array.from(a.querySelectorAll("tbody tr")).map(E=>Array.from(E.querySelectorAll('input[name$="-val"]'))),f=-1,_=-1;for(let E=0;E<p.length;E++){let A=p[E].indexOf(e);if(A!==-1){f=E,_=A;break}}if(f===-1)return;let w=0,h=0;for(let E=0;E<m.length;E++){let A=m[E],T=p[f+E];if(!T){h+=A.length;continue}for(let O=0;O<A.length;O++){let M=T[_+O];if(!M){h++;continue}M.value=A[O]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),w++}}let N=m.length===1?`${m[0].length}-cell row`:m[0]?.length===1?`${m.length}-cell column`:`${m.length}\xD7${m[0]?.length??0} block`;o({kind:"ok",message:`Pasted ${w} value${w===1?"":"s"} (${N}${h>0?`, ${h} overflow`:""}).`})},!0)}function Ct(r){let o=Array.from(r.querySelectorAll('input[name="total"][dataelementid]'));if(o.length===0)return;let s=[];for(let e of o){let i=e.getAttribute("dataelementid")??"";if(!i)continue;let n=e.closest("div"),l=(()=>{let a=n??e.parentElement;if(!a)return null;let u=a.previousElementSibling;for(;u;){if(/^(H1|H2|H3|H4)$/.test(u.tagName)||u.tagName==="DIV"&&!u.querySelector("table, input")&&(u.textContent??"").trim().length>0)return u;u=u.previousElementSibling}let p=a.closest("[data-section-id]");if(p){let f=p.querySelector("h2, h3, h4");if(f)return f}return null})();if(!l)continue;n?.remove();let d=document.createElement("span");d.className="der-de-matrix-total",d.setAttribute("data-de",i),l.appendChild(d);let m=()=>{let a=0,u=!1,p=Array.from(r.querySelectorAll(`input[dataelementid="${i}"][name$="-val"],input[name^="${i}-"][name$="-val"]`)),f=new Set;for(let _ of p){if(f.has(_))continue;f.add(_);let w=parseFloat(_.value);Number.isFinite(w)&&(a+=w,u=!0)}if(u){let _=Number.isInteger(a)?a:Number(a.toFixed(2));d.textContent=` (Total: ${_})`}else d.textContent=""};s.push(m),m()}s.length!==0&&r.addEventListener("input",e=>{let i=e.target;if(!(!i||i.tagName!=="INPUT")&&/-val$/.test(i.getAttribute("name")??""))for(let n of s)n()},!0)}function St(r){let o=Array.from(r.querySelectorAll("td.der-de-row-total-cell[data-de-row-total]"));if(o.length===0)return;let s=e=>{let i=e.closest("tr");if(!i)return;let n=0,t=!1;for(let l of Array.from(i.querySelectorAll('input[name$="-val"]'))){let d=l.value.trim();if(d==="")continue;let m=Number(d);Number.isFinite(m)&&(n+=m,t=!0)}if(!t){e.textContent="\u2014";return}e.textContent=Number.isInteger(n)?String(n):n.toFixed(2)};for(let e of o)s(e);r.addEventListener("input",e=>{let i=e.target;if(!i||i.tagName!=="INPUT"||!/-val$/.test(i.getAttribute("name")??""))return;let t=i.closest("tr")?.querySelector("td.der-de-row-total-cell[data-de-row-total]");t&&s(t)},!0)}function Tt(r,o){let s=o.indicators??[];if(s.length===0)return;let e=s.filter(a=>a.numerator&&a.denominator).map(a=>({id:a.id,factor:a.indicatorType?.factor??1,numExpr:a.numerator,denExpr:a.denominator}));if(e.length===0)return;let i=Array.from(r.querySelectorAll("input[indicatorid]")),n=new Map;for(let a of Array.from(r.querySelectorAll('input[name$="-val"]')))n.set(a.getAttribute("name")??"",a);let t=a=>{let u=0;for(let[p,f]of n){if(!p.startsWith(`${a}-`))continue;let _=parseFloat(f.value);Number.isFinite(_)&&(u+=_)}return u},l=a=>a.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,f)=>{if(f){let _=n.get(`${p}-${f}-val`),w=parseFloat(_?.value??"");return Number.isFinite(w)?String(w):"0"}return String(t(p))}),d=a=>{if(!/^[\s\d+\-*/().eE]+$/.test(a))return NaN;try{return Function(`"use strict";return (${a})`)()}catch{return NaN}},m=()=>{for(let a of e){let u=d(l(a.numExpr)),p=d(l(a.denExpr)),f=i.find(w=>w.getAttribute("indicatorid")===a.id);if(!f)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){f.value="";continue}let _=u/p*a.factor;f.value=Number.isInteger(_)?String(_):_.toFixed(2)}};r.addEventListener("input",a=>{let u=a.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&m()},!0),m()}function At(r,o){let s={};for(let e of o.dataSetElements??[])e.dataElement&&(s[e.dataElement.id]=e.dataElement);for(let e of Array.from(r.querySelectorAll('input[name$="-val"]'))){let i=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!i)continue;let n=s[i[1]],t=n?.formName??n?.name??i[1],l=n?.categoryCombo?.categoryOptionCombos?.find(m=>m.id===i[2]),d=l?.name??l?.displayName??i[2];e.hasAttribute("aria-label")||e.setAttribute("aria-label",d===i[2]?`${t}`:`${t}, ${d}`),e.getAttribute("data-compulsory")==="1"&&e.setAttribute("aria-required","true")}}function Dt(r,o){let s={};for(let e of o.dataSetElements??[])e.dataElement&&(s[e.dataElement.id]=e.dataElement);for(let e of Array.from(r.querySelectorAll('input[name$="-val"]'))){let i=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!i)continue;let n=s[i[1]]?.valueType??"TEXT";switch(e.setAttribute("data-valuetype",n),n){case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":e.setAttribute("inputmode","numeric"),e.setAttribute("pattern","-?\\d*");break;case"NUMBER":case"UNIT_INTERVAL":case"PERCENTAGE":e.setAttribute("inputmode","decimal"),e.setAttribute("pattern","-?\\d*(\\.\\d+)?");break;case"EMAIL":e.setAttribute("inputmode","email"),e.setAttribute("type","email");break;case"PHONE_NUMBER":e.setAttribute("inputmode","tel"),e.setAttribute("type","tel");break;case"URL":e.setAttribute("inputmode","url"),e.setAttribute("type","url");break;case"DATE":e.setAttribute("type","date");break;case"TIME":e.setAttribute("type","time");break;case"DATETIME":e.setAttribute("type","datetime-local");break;default:break}}}function It(r){let o=s=>{let e=s.value;if(e===""){s.removeAttribute("data-de-invalid"),s.removeAttribute("title");return}let i=s.getAttribute("data-valuetype")??"TEXT",n=pe(e,i);n?(s.setAttribute("data-de-invalid","1"),s.setAttribute("title",n)):(s.removeAttribute("data-de-invalid"),s.removeAttribute("title"))};r.addEventListener("input",s=>{let e=s.target;!e||e.tagName!=="INPUT"||/-val$/.test(e.getAttribute("name")??"")&&o(e)},!0);for(let s of Array.from(r.querySelectorAll('input[name$="-val"]')))o(s)}function $t(r,o){let s=o.compulsoryDataElementOperands??[],e=new Set;for(let i of s){let n=i.dimensionItem;if(!n)continue;let t=n.split(".");t.length===2&&e.add(`${t[0]}:${t[1]}`)}if(e.size!==0)for(let i of Array.from(r.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(i.getAttribute("name")??"");n&&e.has(`${n[1]}:${n[2]}`)&&i.setAttribute("data-compulsory","1")}}function Lt(r,o,s){let e={};for(let n of o.dataSetElements??[])n.dataElement&&(e[n.dataElement.id]=n.dataElement);let i=n=>{let t=n.getAttribute("name")??n.id??"",l=/^(.+)-(.+)-val$/.exec(t);if(!l)return null;let d=l[1],m=l[2],a=e[d],u=a?.categoryCombo,p=u?.categoryOptionCombos?.find(A=>A.id===m),f=[],_=p?.name??p?.displayName??m,w=_.split(/,\s*/).filter(Boolean),h=u?.categories??[];w.forEach((A,T)=>{f.push({category:h[T]?.name??h[T]?.displayName??"",option:A})});let N=n.style.outline||"",E=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":n.value.trim()===""?"empty":"saved";return{deId:d,cocId:m,deName:a?.name??d,deFormName:a?.formName,valueType:a?.valueType??"TEXT",optionSetId:a?.optionSet?.id,cocName:_,categoryBreakdown:f,value:n.value,saveState:E,inputName:t,compulsory:n.getAttribute("data-compulsory")==="1",lastUpdated:n.getAttribute("data-updated")??void 0,lastUpdatedBy:n.getAttribute("data-updated-by")??void 0,comment:n.getAttribute("data-comment")??void 0}};r.addEventListener("focusin",n=>{let t=n.target;if(t&&t.tagName==="INPUT"){let l=i(t);l&&s(l)}},!0),r.addEventListener("input",n=>{let t=n.target;if(t&&t.tagName==="INPUT"){let l=i(t);l&&s(l)}},!0)}function Mt(r,o,s){if(!r)return;let e=globalThis,i=e.dhis2?.de?.dataElements??{},n=e.dhis2?.de?.categoryOptionCombos??{},t=Array.from(r.querySelectorAll('input[name$="-val"]')),l=[];for(let d of t){d.style.outline="";let m=/^(.+)-(.+)-val$/.exec(d.getAttribute("name")??"");if(!m)continue;let a=m[1],u=m[2],p=i[a],f=p?.valueType??"TEXT",_=d.value.trim();if(_===""){d.getAttribute("data-compulsory")==="1"&&(d.style.outline="2px solid #c0392b",l.push({deId:a,cocId:u,valueType:f,value:"",problem:"compulsory value missing",deName:p?.name??a,cocName:n[u]?.name??u,inputName:d.name}));continue}let w=pe(_,f);w&&(d.style.outline="2px solid #c0392b",l.push({deId:a,cocId:u,valueType:f,value:_,problem:w,deName:p?.name??a,cocName:n[u]?.name??u,inputName:d.name}))}s(l,t.length),o({kind:"idle"})}function pe(r,o){let s=Number(r),e=Number.isInteger(s);switch(o){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(o){case"INTEGER":if(!e)return"must be an integer";break;case"INTEGER_POSITIVE":if(!e||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!e||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!e||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function Z(r,o){let s=o==="saving"?"#b9860a":o==="saved"?"#1a8754":o==="queued"?"#ce7b00":"#a93232";r.style.outline=`2px solid ${s}`,r.style.transition="outline 150ms",o==="queued"?r.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):r.removeAttribute("title"),o==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function Rt(r,o,s,e,i){if(!o||!s||!e)return;let n;try{n=(await i.readAggregateValues(e,s,2e3)).dataValues??[]}catch{return}for(let t of n){let l=t.dataElement,d=t.categoryOptionCombo,m=t.value;if(!l||!d||m==null)continue;let a=r.querySelector(`input[name="${l}-${d}-val"]`);a&&(a.value=m,t.comment&&a.setAttribute("data-comment",t.comment),t.lastUpdated&&a.setAttribute("data-updated",t.lastUpdated),t.storedByUsername&&a.setAttribute("data-updated-by",t.storedByUsername))}}function Le(r){let o=Date.parse(r);if(!Number.isFinite(o))return r;let s=Date.now()-o;if(s<0)return new Date(o).toLocaleString();let e=Math.floor(s/6e4);if(e<1)return"just now";if(e<60)return`${e} min ago`;let i=Math.floor(e/60);if(i<24)return`${i} h ago`;let n=Math.floor(i/24);return n<30?`${n} d ago`:new Date(o).toLocaleDateString()}function Me(r){return new Promise((o,s)=>{let e=document.createElement("script");e.src=r,e.async=!1,e.setAttribute("data-der-custom-form",r),e.onload=()=>o(),e.onerror=()=>s(new Error(`failed to load ${r}`)),document.head.appendChild(e)})}function Re(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let o=document.createElement("link");o.rel="stylesheet",o.href=r,o.setAttribute("data-der-custom-form",r),document.head.appendChild(o)}function Te(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function jt(r,o,s={}){let e=s.stripStyles??!0;r.classList.toggle("der-de-custom-form--author",!e);let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${o}</body></html>`,"text/html");for(let t of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let l=t.getAttribute("href")??"";l&&Re(Te(l))}else{let l=document.createElement("style");l.textContent=t.textContent??"",l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l)}t.remove()}let n=[];for(let t of Array.from(i.querySelectorAll("script"))){let l=t.getAttribute("src");l?n.push({src:Te(l)}):n.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(i.body.querySelectorAll("*"))){if(e&&t.removeAttribute("style"),t.tagName==="INPUT"){let l=t.getAttribute("id")??"";l.endsWith("-val")&&t.getAttribute("name")!==l&&t.setAttribute("name",l)}if(e&&t.tagName==="TH"){let l=(t.textContent??"").trim();(l==="Reporting item"||l==="Reported count")&&(t.textContent=l==="Reporting item"?"Data elements":"Value")}}for(let t of Array.from(i.body.childNodes))r.appendChild(document.adoptNode(t));for(let t of n)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await Me(t.src);else if(t.code){let l=document.createElement("script");l.textContent=t.code,l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l),l.remove()}}var me={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},Ae={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},De={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},Ot={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},Pt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function Ut(r,o,s,e=new Set,i=new Set,n=0){let t=(h,N)=>e.has(h)?`\u2713  ${N}`:i.has(h)?`\u25CF  ${N}`:N,l={...me},d=je(r,n);if(d.length===0)return c("input",{value:o,onChange:h=>s(h.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:l});let m=[...d];if(o&&!m.some(h=>h.id===o)){let h=Ht(r,o)??o;m.unshift({id:o,label:h})}let a=d[0]?.id??null,u=m.findIndex(h=>h.id===o),p=u===-1||u<m.length-1||!!r,f=o!==""&&(u>0||o!==a),_=()=>{if(!r)return;let h=u>=0&&u<m.length-1?m[u+1]?.id??"":Ie(r,o||a||"",-1);h&&s(h)},w=()=>{if(!r||!o||o===a)return;let h=u>0?m[u-1]?.id??"":Ie(r,o,1);h&&s(h)};return y("span",{className:"der-de-period-nav",children:[c("button",{type:"button","aria-label":"Previous period",onClick:_,disabled:!p,className:"der-de-period-btn",children:"\u25C0"}),y("select",{value:o,onChange:h=>s(h.target.value),style:l,children:[c("option",{value:"",children:"Select a period\u2026"}),m.map(h=>c("option",{value:h.id,children:t(h.id,h.label)},h.id))]}),c("button",{type:"button","aria-label":"Next period",onClick:w,disabled:!f,className:"der-de-period-btn",children:"\u25B6"})]})}function Ie(r,o,s){let e=i=>String(i).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(o))return"";let i=Number(o.slice(0,4)),n=Number(o.slice(4,6))-1,t=Number(o.slice(6,8)),l=new Date(i,n,t+s);return`${l.getFullYear()}${e(l.getMonth()+1)}${e(l.getDate())}`}case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(o);if(!i)return"";let n=Number(i[1]),t=Number(i[2])+s;return t<1?(n-=1,t=Y(n)):t>Y(n)&&(n+=1,t=1),`${n}W${t}`}case"Monthly":{if(!/^\d{6}$/.test(o))return"";let i=Number(o.slice(0,4)),n=Number(o.slice(4,6))-1,t=i*12+n+s;return`${Math.floor(t/12)}${e((t%12+12)%12+1)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(o);if(!i)return"";let n=Number(i[1]),t=Number(i[2])+s;return t<1?(n-=1,t=6):t>6&&(n+=1,t=1),`${n}${e(t)}B`}case"Quarterly":{let i=/^(\d{4})Q(\d)$/.exec(o);if(!i)return"";let n=Number(i[1]),t=Number(i[2])+s;return t<1?(n-=1,t=4):t>4&&(n+=1,t=1),`${n}Q${t}`}case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(o);if(!i)return"";let n=Number(i[1]),t=Number(i[2])+s;return t<1?(n-=1,t=2):t>2&&(n+=1,t=1),`${n}S${t}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(o)?String(Number(o)+s):"";default:return""}}function Ht(r,o){let s=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(r){case"Daily":return/^\d{8}$/.test(o)?`${o.slice(0,4)}-${o.slice(4,6)}-${o.slice(6,8)}`:null;case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(o);return e?`${e[1]} W${String(e[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(o))return null;let e=Number(o.slice(4,6))-1;return`${s[e]??""} ${o.slice(0,4)}`}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(o);if(!e)return null;let i=(Number(e[2])-1)*2;return`${s[i]}\u2013${s[i+1]} ${e[1]}`}case"Quarterly":return o.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(o);return e?`${e[1]} ${e[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(o)?o:null;default:return null}}function je(r,o=0){let s=new Date,e=s.getFullYear(),i=s.getMonth(),n=d=>String(d).padStart(2,"0"),t=["January","February","March","April","May","June","July","August","September","October","November","December"],l=Math.max(0,1-Math.max(0,o));switch(r){case"Daily":{let d=[];for(let m=l;m<30+l;m++){let a=new Date(s);a.setDate(a.getDate()-m);let u=`${a.getFullYear()}${n(a.getMonth()+1)}${n(a.getDate())}`,p=`${a.getFullYear()}-${n(a.getMonth()+1)}-${n(a.getDate())}`;d.push({id:u,label:p})}return d}case"Weekly":{let d=[],m=Oe(s),a=m.year,u=m.week;for(let p=0;p<l;p++)u-=1,u<1&&(a-=1,u=Y(a));for(let p=0;p<12;p++)d.push({id:`${a}W${u}`,label:`${a} W${n(u)}`}),u-=1,u<1&&(a-=1,u=Y(a));return d}case"Monthly":{let d=[];for(let m=l;m<24+l;m++){let a=e,u=i,p=a*12+u-m,f=Math.floor(p/12),_=(p%12+12)%12;d.push({id:`${f}${n(_+1)}`,label:`${t[_]} ${f}`})}return d}case"BiMonthly":{let d=[],m=Math.floor(i/2)+1,a=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(a-=1,u=6);for(let p=0;p<12;p++){let f=(u-1)*2;d.push({id:`${a}${n(u)}B`,label:`${t[f]}\u2013${t[f+1]} ${a}`}),u-=1,u<1&&(a-=1,u=6)}return d}case"Quarterly":{let d=[],m=Math.floor(i/3)+1,a=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(a-=1,u=4);for(let p=0;p<8;p++)d.push({id:`${a}Q${u}`,label:`${a} Q${u}`}),u-=1,u<1&&(a-=1,u=4);return d}case"SixMonthly":{let d=[],m=i<6?1:2,a=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(a-=1,u=2);for(let p=0;p<6;p++)d.push({id:`${a}S${u}`,label:`${a} ${u===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),u-=1,u<1&&(a-=1,u=2);return d}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let d=[];for(let m=l;m<10+l;m++){let a=e-m;d.push({id:String(a),label:String(a)})}return d}default:return[]}}function Oe(r){let o=new Date(r.getFullYear(),r.getMonth(),r.getDate()),s=o.getDay()===0?7:o.getDay();o.setDate(o.getDate()+4-s);let e=new Date(o.getFullYear(),0,1),n=Math.round((o.getTime()-e.getTime())/864e5);return{year:o.getFullYear(),week:Math.ceil((n+1)/7)}}function Y(r){return Oe(new Date(r,11,28)).week}var zt=`
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
.der-apphost .der-de-form-card .sectionTable th.der-de-row-total-cell,
.der-apphost .der-de-form-card .sectionTable td.der-de-row-total-cell {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
  background: #f6f8fd !important;
  border-left: 1px solid var(--der-brand-100, #c7dff6) !important;
  padding: 3px 10px !important;
  min-width: 48px;
}
.der-apphost .der-de-form-card .sectionTable th.der-de-row-total-cell {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
  background: transparent !important;
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
.der-de-live-strip__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--der-ink-500, #5b6478);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: background 120ms, color 120ms;
}
.der-de-live-strip__clear:hover,
.der-de-live-strip__clear:focus-visible {
  background: #fbe9e7;
  color: #a3322c;
  outline: 0;
}
.der-de-live-strip__comment-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--der-ink-500, #5b6478);
  cursor: pointer;
  border-radius: 4px;
  transition: background 120ms, color 120ms;
}
.der-de-live-strip__comment-btn:hover,
.der-de-live-strip__comment-btn:focus-visible {
  background: #e6f1fb;
  color: var(--der-brand-500, #147CD7);
  outline: 0;
}
.der-de-live-strip__comment-btn.has-comment {
  color: var(--der-brand-500, #147CD7);
}
/* Cell-comment modal \u2014 centered dialog on the shared
 * .der-de-shortcuts-backdrop (z-index 200). Matches the info-modal
 * aesthetic: eyebrow + large title, tinted header gradient, body
 * with textarea + char counter, footer with Delete/Cancel/Save. */
.der-de-comment-modal {
  background: #ffffff;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(16, 26, 50, 0.28);
  border-radius: 12px;
  overflow: hidden;
}
.der-de-comment-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  background: linear-gradient(180deg, #f6f9ff 0%, #ffffff 100%);
  border-bottom: 1px solid #e5e9ef;
}
.der-de-comment-modal__title-wrap { flex: 1 1 auto; min-width: 0; }
.der-de-comment-modal__eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--der-brand-500, #147CD7);
  margin-bottom: 4px;
}
.der-de-comment-modal__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  line-height: 1.35;
}
.der-de-comment-modal__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--der-ink-500, #5b6478);
}
.der-de-comment-modal__close {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--der-ink-500, #5b6478);
  font-size: 24px;
  line-height: 1;
  padding: 0 6px;
  border-radius: 4px;
  transition: background 120ms, color 120ms;
}
.der-de-comment-modal__close:hover,
.der-de-comment-modal__close:focus-visible {
  background: #e5e9ef;
  color: var(--der-ink-900, #101a32);
  outline: 0;
}
.der-de-comment-modal__body {
  padding: 16px 20px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.der-de-comment-modal__textarea {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  padding: 10px 12px;
  border: 1px solid #aaa;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: var(--der-ink-900, #101a32);
  background: #ffffff;
  line-height: 1.45;
}
.der-de-comment-modal__textarea:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
.der-de-comment-modal__hint {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--der-ink-500, #5b6478);
}
.der-de-comment-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #e5e9ef;
  background: #ffffff;
}
.der-de-comment-modal__delete {
  padding: 7px 14px;
  border: 1px solid #e9b7b2;
  background: #ffffff;
  color: #a3322c;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-right: auto;
}
.der-de-comment-modal__delete:hover { background: #fbe9e7; }
.der-de-comment-modal__cancel {
  padding: 7px 14px;
  border: 1px solid var(--der-border, #d8dee8);
  background: #ffffff;
  color: var(--der-ink-700, #2a3447);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.der-de-comment-modal__cancel:hover { background: #f0f2f6; }
.der-de-comment-modal__save {
  padding: 7px 16px;
  border: 1px solid var(--der-brand-600, #0f68b7);
  background: var(--der-brand-500, #147CD7);
  color: #ffffff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms, opacity 120ms;
}
.der-de-comment-modal__save:hover { background: var(--der-brand-600, #0f68b7); }
.der-de-comment-modal__save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.der-de-live-strip__audit {
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
}
.der-de-live-strip__audit strong {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-de-sync-logos {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}
.der-de-sync-logos__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: 0;
  line-height: 1;
}
.der-de-sync-logos__pin svg { flex-shrink: 0; }
/* Each brand mark keeps its native dark hue \u2014 status is communicated
 * by the small square dot next to it, not by recolouring the logo. */
.der-de-sync-logos__pin--der    { color: #0B3558; }
.der-de-sync-logos__pin--central { color: #0080d4; }
/* Square status dot, 8 px. Green = saved/synced, orange = pending,
 * red = error, gray = empty. */
.der-de-sync-logos__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background: #c6ccd7;
}
.der-de-sync-logos__dot.is-muted   { background: #c6ccd7; }
.der-de-sync-logos__dot.is-lit     { background: #1b8243; }
.der-de-sync-logos__dot.is-pending { background: #c6680a; }
.der-de-sync-logos__dot.is-error   { background: #a3322c; }
.der-de-sync-logos__svg {
  display: block;
  flex-shrink: 0;
}
.der-de-live-strip__hint {
  color: var(--der-ink-500, #5b6478);
  font-style: italic;
}
.der-apphost .der-de-form-card .sectionTable .dataElementCell {
  /* Slice 62 \u2014 freeze the DE label column on both thead + tbody
   * so it stays visible when the operator scrolls horizontally on
   * wide matrix sections. A solid white background is required so
   * data cells don't bleed through on scroll; z-index lifts the
   * sticky column above hover tints + the row-total trailing cell. */
  background: #ffffff !important;
  color: var(--der-ink-900, #101a32);
  font-weight: 400;
  min-width: 220px;
  padding: 4px 8px !important;
  position: sticky;
  left: 0;
  z-index: 2;
  box-shadow: 1px 0 0 var(--der-brand-100, #c7dff6);
}
.der-apphost .der-de-form-card .sectionTable tbody tr:hover .dataElementCell,
.der-apphost .der-de-form-card .sectionTable tbody tr:focus-within .dataElementCell {
  /* Hover wash on the sticky column: pre-blend the row tint with
   * white so the sticky column reads as part of the hovered row
   * rather than a hole against the scrolled-under cells. */
  background: #eef3fa !important;
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
  border: 1px solid #aaa !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 14px;
  color: var(--der-ink-900, #101a32);
}
.der-apphost .der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
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
  background: #e6f1fb;
  flex: 0 0 auto;
}
.der-de-saveall-btn {
  padding: 6px 14px;
  border: 1px solid var(--der-brand-600, #0f68b7);
  background: var(--der-brand-500, #147CD7);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: background 120ms;
}
.der-de-saveall-btn:hover,
.der-de-saveall-btn:focus-visible {
  background: var(--der-brand-600, #0f68b7);
  outline: 0;
}
.der-de-toolbar__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: var(--der-brand-500, #147CD7);
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  transition: color 120ms, background 120ms;
  border-radius: 4px;
}
.der-de-toolbar__info-btn:hover,
.der-de-toolbar__info-btn:focus-visible {
  color: var(--der-brand-700, #0a5497);
  background: #e6f1fb;
  outline: 0;
}
.der-de-info-modal {
  background: #fff;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(16, 26, 50, 0.28);
  border-radius: 12px;
  overflow: hidden;
}
.der-de-info-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e9ef;
  background: linear-gradient(180deg, #f6f9ff 0%, #fff 100%);
}
.der-de-info-modal__title-wrap {
  flex: 1 1 auto;
  min-width: 0;
}
.der-de-info-modal__eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--der-brand-500, #147CD7);
  margin-bottom: 4px;
}
.der-de-info-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  line-height: 1.3;
}
.der-de-info-modal__close {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--der-ink-500, #5b6478);
  font-size: 26px;
  line-height: 1;
  padding: 0 6px;
  border-radius: 4px;
  transition: color 120ms, background 120ms;
}
.der-de-info-modal__close:hover,
.der-de-info-modal__close:focus-visible {
  color: var(--der-ink-900, #101a32);
  background: #e5e9ef;
  outline: 0;
}
.der-de-info-modal__body {
  padding: 20px 24px 8px;
  overflow-y: auto;
}
.der-de-info-modal__desc {
  margin: 0 0 20px;
  color: var(--der-ink-700, #2a3447);
  font-size: 14px;
  line-height: 1.6;
}
.der-de-info-modal__stats {
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.der-de-info-modal__stat {
  background: #f6f8fd;
  border: 1px solid #e0e6f3;
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0;
}
.der-de-info-modal__stat dt {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--der-ink-500, #5b6478);
  margin-bottom: 4px;
}
.der-de-info-modal__stat dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.der-de-info-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px 16px;
  border-top: 1px solid #e5e9ef;
  background: #fff;
}
.der-de-info-modal__done {
  background: var(--der-brand-500, #147CD7);
  color: #fff;
  border: 1px solid var(--der-brand-600, #0f68b7);
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms;
}
.der-de-info-modal__done:hover,
.der-de-info-modal__done:focus-visible {
  background: var(--der-brand-600, #0f68b7);
  outline: 0;
}
.der-de-toolbar__title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: #101a32;
  letter-spacing: -0.01em;
}
/* Toolbar status indicators \u2014 brand mark + 8 px status dot, no
 * pastel pills. Matches the cell-details sync-logos pattern:
 * logo keeps its native hue, meaning sits entirely in the dot. */
.der-de-status-icon {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 12px;
  background: transparent;
  border: 0;
  padding: 0;
  line-height: 1;
}
.der-de-status-icon[data-test="de-wan-status"]  { color: #0a5497; }
.der-de-status-icon[data-test="de-edge-pill"]   { color: #0B3558; }
/* Bigger glyph on the toolbar vs the smaller cell-details strip \u2014
 * these indicators are an always-visible top-bar affordance, not
 * an inline cell annotation, so give them room. */
.der-de-status-icon svg {
  width: 20px;
  height: 20px;
}
.der-de-status-icon__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #c6ccd7;
}
.der-de-status-icon__dot.is-lit     { background: #1b8243; }
.der-de-status-icon__dot.is-pending { background: #c6680a; }
.der-de-status-icon__dot.is-error   { background: #a3322c; }
.der-de-status-icon__count {
  font-size: 10px;
  font-weight: 500;
  color: #a3322c;
  margin-left: 2px;
}
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
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
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
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
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
  border-color: var(--der-brand-500, #147CD7);
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
  color: #147CD7;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  color: #0a5497;
  background: #e6f1fb;
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
  border-left-color: #147CD7;
  color: #0a5497;
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
  color: #0a5497;
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
  border: 1px solid #aaa !important;
  background: #fff !important;
  font-size: 14px !important;
  color: #212934 !important;
  font-family: inherit;
}
.der-de-custom-form input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
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
  border: 1px solid #aaa;
  background: #fff;
  padding: 2px 4px;
  font-size: 14px;
  color: #212934;
  font-family: inherit;
  border-radius: 4px;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
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
  color: #083f72;
  font-weight: 500;
}
/* Custom-form author inputs inherit the same visual language as
 * SECTION-renderer inputs: 1 px border, 4 px radius, indigo
 * focus ring. */
.der-de-custom-form input[name$="-val"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  border: 1px solid #aaa !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  background: #fff !important;
}
.der-de-custom-form input[name$="-val"]:focus,
.der-de-custom-form input[name="entryfield"]:focus,
.der-de-custom-form input[name="total"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Realtime value-type validation \u2014 attachLiveValidation stamps
 * data-de-invalid="1" + title=<reason> on inputs that don't
 * match their data element's valueType. */
.der-de-custom-form input[data-de-invalid="1"],
.der-apphost .der-de-form-card input[data-de-invalid="1"] {
  border-color: #c0392b !important;
  background: #fbeaea !important;
  box-shadow: inset 0 0 0 1px #c0392b;
}
.der-de-custom-form input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card .sectionTable input[type="text"][data-de-invalid="1"]:focus {
  border-color: #c0392b !important;
  box-shadow: inset 0 0 0 2px #c0392b !important;
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
  /* Must sit above .der-topbar (z-index: 100) so click-outside
   * registers on the backdrop near the top of the viewport and
   * the operator doesn't accidentally hit the topbar instead. */
  z-index: 200;
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
  color: #147CD7;
  font-size: 12px;
  cursor: pointer;
}
.der-de-validation__jump-btn:hover { color: #0a5497; }

.der-de-shortcuts-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Above .der-topbar (z-index: 100) so click-outside anywhere
   * on the backdrop closes the popover \u2014 the previous 20 meant
   * the shell topbar intercepted clicks near the top. */
  z-index: 200;
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
  color: #083f72;
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
  color: #083f72;
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
`;export{it as default};
