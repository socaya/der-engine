/* @der-app {"appKey":"data-entry","displayName":"Data Entry","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as D,useRef as se,useState as C}from"react";import{useAuth as tt,useOrgUnitBinding as rt,useOnlineStatus as ot,useDerApi as at,ScreenCard as nt}from"@der/app-sdk";import{Fragment as Z,jsx as c,jsxs as y}from"react/jsx-runtime";function it(){let o=tt(),r=rt(),d=ot(),e=at(),[n,t]=C("custom"),[a,l]=C([]),[s,m]=C(""),[i,u]=C(""),[p,f]=C(""),[_,w]=C(""),[h,N]=C({kind:"idle"}),[k,T]=C(null),A=se(null),[j,M]=C({}),H=se({}),[Q,ee]=C([]),[z,K]=C(null),[te,ge]=C(!1),[Ue,re]=C(new Set),[Pe,oe]=C(new Set),[J,be]=C(""),[V,He]=C(0),[G,ze]=C([]),[he,W]=C(!1),ye=se(0),[Fe,qe]=C(null),[Be,ae]=C({localSaved:!1,central:null}),[Ve,Qe]=C(0),[Ke,ne]=C(!1),[ve,Je]=C(null),[Ge,xe]=C(!1);D(()=>{let b=g=>{if(g.key!=="?")return;let x=g.target;x&&(x.tagName==="INPUT"||x.tagName==="TEXTAREA")||(g.preventDefault(),ne(v=>!v))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]),D(()=>{let b=g=>{let x=A.current;x&&x.querySelector('input[data-dirty="1"]')&&(g.preventDefault(),g.returnValue="")};return window.addEventListener("beforeunload",b),()=>window.removeEventListener("beforeunload",b)},[]);let[F,We]=C(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});D(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",F)}catch{}},[F]);let[q,Ye]=C(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});D(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),D(()=>{let b=!1;return(async()=>{if(!r.bound||!r.orgUnitUid){l([]);return}try{let g=await e.listDataSets(r.orgUnitUid);if(b)return;let x=(g.dataSets??[]).map(v=>({id:v.id,label:v.displayName??v.name??v.id,periodType:v.periodType,formType:v.formType})).sort((v,E)=>v.label.localeCompare(E.label));l(x)}catch{}})(),()=>{b=!0}},[r.bound,r.orgUnitUid]),D(()=>{if(s.trim()===""){T(null),ee([]),M({}),H.current={};return}let b=!1;return(async()=>{try{let g=await e.getDataSetMeta(s.trim());if(b)return;let x=!!g.dataEntryForm&&g.formType==="CUSTOM"||g.formType==="SECTION";T({hasCustomForm:x,formId:g.dataEntryForm?.id,displayName:g.displayName??g.name,formType:g.formType,periodType:g.periodType,openFuturePeriods:g.openFuturePeriods??0}),t(x?"custom":"structured");try{let v=await e.getDataSetFormMetadata(s.trim());if(b)return;let E=await Se(v,e);if(b)return;let O=(E.categoryCombo?.categories??[]).filter(L=>(L.categoryOptions?.length??0)>1).map(L=>({id:L.id,name:L.name??L.id,options:(L.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));ee(O);let P={};for(let L of O)L.options[0]&&(P[L.id]=L.options[0].id);M(P),H.current=P}catch{}}catch{b||T(null)}})(),()=>{b=!0}},[s]),D(()=>{if(n!=="custom"||!k?.hasCustomForm||k.formType==="CUSTOM"&&!k.formId)return;let b=A.current;if(!b)return;let g=!1;return(async()=>{N({kind:"submitting"});try{let x=await e.getDataSetFormMetadata(s.trim());if(g)return;let v=await Se(x,e);if(g)return;let E="";if(k.formType==="CUSTOM"&&k.formId){try{E=(await e.getDataEntryFormHtml(k.formId)).htmlCode??""}catch(S){E="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",S)}E.trim()||(E=Te(v))}else k.formType==="SECTION"&&(E=Te(v));if(g)return;let O=await e.listValidationRules(s.trim()).catch(()=>({validationRules:[]}));if(g)return;let P=(v.categoryCombo?.categories??[]).filter(S=>(S.categoryOptions?.length??0)>1).map(S=>({id:S.id,name:S.name??S.id,options:(S.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));ee(P);let L={};for(let S of P)S.options[0]&&(L[S.id]=S.options[0].id);M(L),H.current=L,b.replaceChildren();for(let[S,I]of[["selectedDataSetId",s.trim()],["selectedPeriodId",i.trim()],["selectedOrganisationUnitId",r.orgUnitUid??""]]){let R=document.createElement("input");R.type="hidden",R.id=S,R.value=I,b.appendChild(R)}for(let[S,I]of Object.entries(L)){let R=document.createElement("input");R.type="hidden",R.id=`category-${S}`,R.value=I,R.setAttribute("data-der-category",S),b.appendChild(R)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),ct({dataSetId:s.trim(),periodId:i.trim(),orgUnitId:r.orgUnitUid??"",meta:v,aocSelections:L,validationRules:O.validationRules??[]}),Je({description:v.description,sectionCount:v.sections?.length??0,dataElementCount:v.dataSetElements?.length??0,compulsoryCount:v.compulsoryDataElementOperands?.length??0,validationRuleCount:O.validationRules?.length??0,indicatorCount:v.indicators?.length??0});for(let S of st)Oe(S);for(let S of dt)document.querySelector(`script[data-der-custom-form="${S}"]`)||await Re(S);ut(),await Ot($,E,{stripStyles:F==="der"}),await Rt($,s.trim(),i.trim(),r.orgUnitUid??"",e),pt($,()=>s.trim(),()=>i.trim(),()=>r.orgUnitUid??"",()=>({...H.current}),e,S=>{ae(I=>({...I,localSaved:!0,central:I.central==="CENTRAL_ACCEPTED"&&S==="saved"?"PENDING":I.central})),Qe(I=>I+1)}),$.addEventListener("blur",S=>{let I=S.target;if(I&&I.tagName==="INPUT"&&/-val$/.test(I.getAttribute("name")??"")&&I.value.trim()!==""){let R=i.trim();oe(de=>de.has(R)?de:new Set(de).add(R))}},!0),ft($),Nt($,N),Ct($),St($),Lt($,v,qe),It($,v),Dt($,v),$t($),At($,v),Tt($,v),He(S=>S+1),N({kind:"idle"})}catch(x){N({kind:"error",message:`custom form failed to render: ${x.message}`})}})(),()=>{g=!0}},[n,k,s,i,r.orgUnitUid,F]);let Ze=r.bound&&s.trim()!==""&&i.trim()!==""&&p.trim()!==""&&_.trim()!==""&&h.kind!=="submitting";async function Xe(b){b.preventDefault(),N({kind:"submitting"});try{await e.submitAggregate({dataSet:s,period:i,orgUnit:r.orgUnitUid,dataValues:[{dataElement:p,value:_}]}),N({kind:"ok",message:`Submitted ${p}=${_} for ${i}.`}),f(""),w("")}catch(g){N({kind:"error",message:g.message??"Submission failed"})}}let _e=i.trim()!=="",ie=s.trim()!=="",B=ie&&_e&&r.bound;D(()=>{let b=A.current;if(!b)return;let g=J.trim().toLowerCase(),x=Array.from(b.querySelectorAll("tbody tr"));for(let v of x){if(!g){v.style.display="";continue}let O=((v.querySelector(".dataElementCell")??v.querySelector("td"))?.textContent??"").toLowerCase();v.style.display=O.includes(g)?"":"none"}},[J,V]),D(()=>{let b=r.orgUnitUid??"";if(!s.trim()||!b||!i.trim()){ae(E=>E.central==null&&!E.updatedAt?E:{...E,central:null});return}let g=!1,x=null,v=async()=>{try{let E=await e.readAggregateFormSyncState(s.trim(),b,i.trim());if(g)return;ae(P=>({localSaved:P.localSaved||E.state!=null,central:E.state,updatedAt:E.updatedAt})),(E.state==="PENDING"||E.state==="IN_FLIGHT"||E.state==="RETRYABLE")&&(x=setTimeout(()=>void v(),4e3))}catch{}};return v(),()=>{g=!0,x&&clearTimeout(x)}},[s,i,r.orgUnitUid,Ve]),D(()=>{if(!s.trim()||!r.bound||!k?.periodType){re(new Set),oe(new Set);return}let b=!1;return(async()=>{let g=je(k.periodType,k.openFuturePeriods??0).map(E=>E.id),[x,v]=await Promise.all([Promise.all(g.map(async E=>{try{return(await e.getCompletion(s.trim(),r.orgUnitUid??"",E)).completed?E:null}catch{return null}})),Promise.all(g.map(async E=>{try{return((await e.readAggregateValues(r.orgUnitUid??"",E,1)).dataValues?.length??0)>0?E:null}catch{return null}}))]);b||(re(new Set(x.filter(E=>E!==null))),oe(new Set(v.filter(E=>E!==null))))})(),()=>{b=!0}},[s,r.orgUnitUid,k?.periodType]),D(()=>{if(!B){K(null);return}let b=!1;return(async()=>{try{let g=await e.getCompletion(s.trim(),r.orgUnitUid??"",i.trim());if(b)return;K({completed:!!g.completed,completedAt:g.completedAt})}catch{b||K({completed:!1})}})(),()=>{b=!0}},[s,i,r.orgUnitUid,B]);function we(){Mt(A.current,N,(b,g)=>{ze(b),ye.current=g,W(!0)})}let[ke,et]=C(0);D(()=>{let b=()=>{let E=A.current;et(E?E.querySelectorAll('input[data-dirty="1"]').length:0)};b();let g=A.current,x=()=>b();g?.addEventListener("input",x,!0),g?.addEventListener("blur",x,!0);let v=window.setInterval(b,1e3);return()=>{g?.removeEventListener("input",x,!0),g?.removeEventListener("blur",x,!0),window.clearInterval(v)}},[V]);function Ee(){let b=A.current;if(!b)return;let g=Array.from(b.querySelectorAll('input[data-dirty="1"]'));for(let x of g)x.dispatchEvent(new Event("blur",{bubbles:!0}))}let[U,Ne]=C(()=>({tone:"up",lastPingAt:null,consecutiveFailures:0}));D(()=>{let b=!1,g=null,x=async()=>{try{if(await e.health(),b)return;Ne({tone:"up",lastPingAt:new Date().toISOString(),consecutiveFailures:0})}catch{if(b)return;Ne(v=>{let E=v.consecutiveFailures+1;return{tone:E>=2?"down":"slow",lastPingAt:v.lastPingAt,consecutiveFailures:E}})}finally{b||(g=setTimeout(()=>void x(),5e3))}};return x(),()=>{b=!0,g&&clearTimeout(g)}},[e]);async function Ce(){if(!B||te)return;let b=!z?.completed;if(b){let g=A.current;if(g){let x=[];for(let v of Array.from(g.querySelectorAll('input[data-compulsory="1"]')))v.value.trim()===""&&x.push(v);if(x.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${x.length} compulsory value${x.length===1?"":"s"} still missing. Run Validate to jump to them.`}),x[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ge(!0);try{let g=await e.markCompletion({dataSet:s.trim(),orgUnit:r.orgUnitUid??"",period:i.trim(),completed:b});K({completed:!!g.completed,completedAt:g.completedAt}),re(x=>{let v=new Set(x);return g.completed?v.add(i.trim()):v.delete(i.trim()),v}),N({kind:"ok",message:g.completed?"Dataset marked complete.":"Dataset reopened."})}catch(g){N({kind:"error",message:`Completion failed: ${g.message}`})}finally{ge(!1)}}return D(()=>{let b=g=>{!g.altKey||g.metaKey||g.ctrlKey||g.shiftKey||(g.code==="KeyV"?(g.preventDefault(),we()):g.code==="KeyC"?(g.preventDefault(),Ce()):g.code==="KeyS"&&(g.preventDefault(),Ee()))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)}),y(nt,{dataTest:"der-aggregate-entry",children:[c("style",{children:Ft}),y("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[y("div",{className:"der-de-toolbar__head",children:[c("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:y("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[c("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),c("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),c("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),c("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),c("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),c("h1",{className:"der-de-toolbar__title",children:"Data Entry"}),k&&ve&&c("button",{type:"button",className:"der-de-toolbar__info-btn","data-test":"de-info-btn","aria-label":"About this dataset",title:"About this dataset",onClick:()=>xe(b=>!b),children:y("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[c("circle",{cx:"8",cy:"8",r:"7",fill:"none",stroke:"currentColor",strokeWidth:"1.5"}),c("circle",{cx:"8",cy:"4.5",r:"0.9",fill:"currentColor"}),c("path",{d:"M8 7v5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}),y("span",{className:"der-de-status-icon","data-test":"de-wan-status","data-state":d.isOnline?"up":"down","aria-label":d.isOnline?"Internet online":`Internet offline \u2014 ${d.queuedCount} queued`,title:d.isOnline?"Internet reachable (navigator.onLine)":`Internet offline \xB7 ${d.queuedCount} queued`,children:[c(xt,{}),c("span",{className:"der-de-status-icon__dot is-"+(d.isOnline?"lit":"error"),"aria-hidden":"true"}),!d.isOnline&&d.queuedCount>0&&c("span",{className:"der-de-status-icon__count",children:d.queuedCount})]}),y("span",{className:"der-de-status-icon","data-test":"de-edge-pill","data-state":U.tone,"aria-label":"DER edge "+U.tone,title:U.lastPingAt?`DER edge \xB7 ${U.tone} \xB7 last checked ${Me(U.lastPingAt)}`:`DER edge \xB7 ${U.tone}`,children:[c(Le,{}),c("span",{className:"der-de-status-icon__dot is-"+(U.tone==="up"?"lit":U.tone==="slow"?"pending":"error"),"aria-hidden":"true"})]}),y("span",{className:"der-de-toolbar__ou-wrap",children:[c("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),c("span",{className:"der-de-toolbar__ou",title:r.orgUnitPath||r.orgUnitUid||"","data-test":"de-toolbar-ou",children:r.orgUnitDisplayName||r.orgUnitUid||"Not bound to an OU"})]})]}),y("div",{className:"der-de-toolbar__picks",children:[y("label",{className:"der-de-toolbar__field",children:[c("span",{className:"der-de-toolbar__field-label",children:"Data set"}),y("select",{className:"der-de-toolbar__select",value:s,onChange:b=>{m(b.target.value),u("")},"data-test":"der-de-dataset-picker",children:[c("option",{value:"",children:"Select a data set\u2026"}),a.map(b=>c("option",{value:b.id,children:b.label},b.id))]})]}),Q.map(b=>y("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[c("span",{className:"der-de-toolbar__field-label",children:b.name}),y("select",{className:"der-de-toolbar__select",value:j[b.id]??"",onChange:g=>{let x={...j,[b.id]:g.target.value};M(x),H.current=x,mt(A.current,x)},"data-test":"de-aoc-select",children:[c("option",{value:"",children:"Select\u2026"}),b.options.map(g=>c("option",{value:g.id,children:g.name},g.id))]})]},b.id)),y("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[y("span",{className:"der-de-toolbar__field-label",children:["Period",k?.periodType?` \xB7 ${k.periodType}`:""]}),c("span",{className:"der-de-period-wrap",children:Pt(k?.periodType,i,u,Ue,Pe,k?.openFuturePeriods??0)})]}),y("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[c("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),y("span",{className:"der-de-toolbar__filter",children:[c("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:J,onChange:b=>be(b.target.value),"data-test":"de-filter-input"}),J&&c("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>be(""),children:"\xD7"})]})]}),c("div",{className:"der-de-toolbar__cell-info",children:c(yt,{root:A,details:Fe,formVersion:V,formSync:Be,onClear:b=>{let g=A.current;if(!g)return;let x=g.querySelector(`input[name="${b}"]`);x&&(x.value="",x.dispatchEvent(new Event("input",{bubbles:!0})),x.focus())},onComment:(b,g)=>{let x=A.current;if(!x)return;let v=x.querySelector(`input[name="${b}"]`);v&&(g===""?v.removeAttribute("data-comment"):v.setAttribute("data-comment",g),v.value.trim()!==""&&(v.focus(),v.dispatchEvent(new Event("blur",{bubbles:!0}))))}})})]})]}),h.kind==="ok"&&c("div",{style:jt,"data-test":"de-ok",children:h.message}),h.kind==="error"&&c("div",{style:Ut,"data-test":"de-err",children:h.message}),!r.bound&&c("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),r.bound&&!ie&&c("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),r.bound&&ie&&!_e&&y("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),B&&n==="structured"&&y("form",{onSubmit:Xe,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[y("label",{children:["Data element UID",c("input",{value:p,onChange:b=>f(b.target.value),style:me})]}),y("label",{children:["Value",c("input",{value:_,onChange:b=>w(b.target.value),inputMode:"decimal",style:me})]}),c("div",{style:{gridColumn:"1 / -1"},children:c("button",{type:"submit",disabled:!Ze,style:De,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),B&&n==="custom"&&c("div",{className:`der-de-form-card der-de-density-${q}`,children:y("div",{className:"der-de-form-split",children:[c(bt,{targetRef:A,formVersion:V}),c("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),B&&n==="custom"&&y("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[c(ht,{root:A,formVersion:V}),c("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Ye(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),c("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${F==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${F==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>We(b=>b==="der"?"author":"der"),children:F==="der"?"\u2699 DER layout":"\u2699 Author layout"}),z&&c("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:z.completed?`Complete${z.completedAt?" \xB7 "+new Date(z.completedAt).toLocaleString():""}`:"Open for edits"}),ke>0&&y("button",{type:"button",onClick:Ee,className:"der-de-saveall-btn","data-test":"de-saveall-btn",title:"Flush all unsaved cells to the DER mirror (Alt+S)",children:["Save all \xB7 ",ke]}),c("button",{type:"button",onClick:we,style:$e,"data-test":"de-validate-btn",children:"Validate"}),G.length>0&&!he&&y("button",{type:"button",onClick:()=>W(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[G.length," issue",G.length===1?"":"s"]}),c("button",{type:"button",onClick:()=>ne(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),c("button",{type:"button",onClick:Ce,disabled:te,style:z?.completed?$e:De,"data-test":"de-complete-btn",children:te?"Saving\u2026":z?.completed?"Reopen":"Mark complete"})]}),c(kt,{open:Ke,onClose:()=>ne(!1)}),c(Et,{open:Ge,onClose:()=>xe(!1),formInfo:k,summary:ve}),c(wt,{open:he,issues:G,totalCells:ye.current,onClose:()=>W(!1),onPick:b=>{let g=A.current?.querySelector(`input[name="${b.inputName}"]`);g&&(g.scrollIntoView({behavior:"smooth",block:"center"}),g.focus(),g.select()),W(!1)}})]})}var dt=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],st=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],le=null,ce=null,ue=null;async function Se(o,r){le||(le=r.listAllDataElements().then(l=>new Map(l.map(s=>[s.id,s])))),ce||(ce=r.listAllCategoryCombos().then(l=>new Map(l.map(s=>[s.id,s])))),ue||(ue=r.listAllCategoryOptionCombos().then(l=>{let s=new Map;for(let m of l){let i=m.categoryCombo?.id;if(!i)continue;let u=s.get(i);u?u.push(m):s.set(i,[m])}return s}));let[d,e,n]=await Promise.all([le,ce,ue]),t=l=>{if(!l?.id)return;let s=e.get(l.id),m=n.get(l.id)??[];return s?{id:s.id,name:s.name??s.displayName,categoryOptionCombos:m.map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:i.categoryOptions??[]})),categories:(s.categories??[]).map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:(i.categoryOptions??[]).map(u=>({id:u.id,name:u.name??u.displayName}))}))}:l},a=l=>{let s=d.get(l.id);return s?{id:s.id,name:s.name??s.displayName,formName:s.formName,valueType:s.valueType,categoryCombo:t(s.categoryCombo)}:l};return{...o,categoryCombo:t(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(l=>({...l,dataElement:l.dataElement?a(l.dataElement):void 0})),sections:(o.sections??[]).map(l=>({...l,dataElements:(l.dataElements??[]).map(s=>a(s))}))}}function Te(o){let r={};for(let l of o.dataSetElements??[])l.dataElement&&(r[l.dataElement.id]=l.dataElement);let d={};for(let l of o.indicators??[])d[l.id]=l;let e=(o.sections??[]).slice().sort((l,s)=>(l.sortOrder??0)-(s.sortOrder??0));if(!e.some(l=>(l.dataElements?.length??0)>0)){let l=(o.dataSetElements??[]).map(s=>s.dataElement).filter(s=>!!s);e=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:l,indicators:[],greyedFields:[]}]}let t=l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let l of e){let s=new Set;for(let i of l.greyedFields??[])i.dataElement?.id&&i.categoryOptionCombo?.id&&s.add(`${i.dataElement.id}:${i.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${t(l.name??"")}</h3>`);let m=new Map;for(let i of l.dataElements??[]){let u=r[i.id];if(!u?.categoryCombo)continue;let p=u.categoryCombo.id,f=m.get(p);f||(f={cc:u.categoryCombo,des:[]},m.set(p,f)),f.des.push(u)}for(let i of m.values()){let u=i.cc.categoryOptionCombos??[],p=i.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let f=lt(p,u),_=u.length>=2;if(a.push("<thead>"),f.length>0)for(let w=0;w<f.length;w++){a.push("<tr>"),w===0&&a.push(`<th class="dataElementCell" rowspan="${f.length}">Data elements</th>`);for(let h of f[w]??[])a.push(`<th colspan="${h.span}">${t(h.label)}</th>`);w===0&&_&&a.push(`<th class="der-de-row-total-cell" rowspan="${f.length}">Total</th>`),a.push("</tr>")}else{a.push("<tr>"),a.push('<th class="dataElementCell">Data elements</th>');for(let w of u)a.push(`<th>${t(w.name??"")}</th>`);_&&a.push('<th class="der-de-row-total-cell">Total</th>'),a.push("</tr>")}a.push("</thead><tbody>");for(let w of i.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${t(w.id)}-cell">`+t(w.formName??w.name??w.id)+"</td>");for(let h of u){let N=`${w.id}-${h.id}-val`;s.has(`${w.id}:${h.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${t(N)}" name="${t(N)}" dataelementid="${t(w.id)}" optioncomboid="${t(h.id)}"></td>`)}_&&a.push(`<td class="der-de-row-total-cell" data-de-row-total="${t(w.id)}">\u2014</td>`),a.push("</tr>")}for(let w of l.indicators??[]){let h=d[w.id];if(!h)continue;let N=_?u.length+1:u.length;a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${t(h.name??h.id)}</td>`),a.push(`<td colspan="${N}"><input type="text" name="indicator" indicatorid="${t(h.id)}" readonly></td>`),a.push("</tr>")}a.push("</tbody></table></div>")}}return a.join(`
`)}function lt(o,r){if(o.length===0||r.length===0)return[];let d=new Map;for(let a of o)for(let l of a.categoryOptions??[])d.set(l.id,{catId:a.id,name:l.name??l.id});let e=o.length,n=r.map(a=>{let l=new Array(e).fill("");for(let s of a.categoryOptions??[]){let m=d.get(s.id);if(!m)continue;let i=o.findIndex(u=>u.id===m.catId);i>=0&&(l[i]=m.name)}return l});for(let a of n)if(a.some(l=>l===""))return[];let t=[];for(let a=0;a<e;a++){let l=[];for(let s=0;s<n.length;){let m=n[s],i=s+1;for(;i<n.length;){let u=n[i],p=!0;for(let f=0;f<=a;f++)if(m[f]!==u[f]){p=!1;break}if(!p)break;i++}l.push({label:m[a]??"",span:i-s}),s=i}t.push(l)}return t}function ct(o){let r=globalThis;r.dhis2=r.dhis2??{};let d=r.dhis2;d.de=d.de??{};let e=d.de;e.currentDataSetId=o.dataSetId,e.currentOrganisationUnitId=o.orgUnitId,e.currentPeriodId=o.periodId,e.currentCategorySelections={...o.aocSelections??{}};let n=o.meta??{},t={},a={};if(n.categoryCombo){a[n.categoryCombo.id]=n.categoryCombo;for(let u of n.categoryCombo.categories??[])t[u.id]=u}e.categories=t,e.categoryCombos=a;let l={},s={};for(let u of n.dataSetElements??[]){let p=u.dataElement;p&&(l[p.id]=p,p.optionSet&&(s[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}e.dataElements=l,e.optionSets=s;let m={};for(let u of n.indicators??[])m[u.id]={explodedNumerator:u.numerator,denominator:u.denominator,factor:u.indicatorType?.factor??1};e.indicatorFormulas=m;let i={};for(let u of o.validationRules??[])i[u.id]=u;e.validationRules=i,e.lockExceptions=[],e.emptyOrganisationUnits=[],e.significantZeros=[],e.dataSets={[n.id]:{id:n.id,name:n.name??n.displayName??"",periodType:n.periodType,categoryCombo:n.categoryCombo?.id,periodId:o.periodId}},r.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function ut(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(r,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let r=o.dhis2.period;r.format="yyyy-mm-dd",r.calendar=o.$.calendars.instance("gregorian"),r.PeriodGenerator&&(r.generator=new r.PeriodGenerator(r.calendar,r.format)),r.DatePicker&&(r.picker=new r.DatePicker(r.calendar,r.format))}}function mt(o,r){if(!o)return;for(let[e,n]of Object.entries(r)){let t=o.querySelector(`input[data-der-category="${e}"]`);t||(t=document.createElement("input"),t.type="hidden",t.id=`category-${e}`,t.setAttribute("data-der-category",e),o.appendChild(t)),t.value=n}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...r})}function pt(o,r,d,e,n,t,a){let l=p=>{let f=/^(.+)-(.+)-val$/.exec(p);return f?{de:f[1],coc:f[2]}:null},s=new WeakMap,m=new WeakMap,i=o.querySelectorAll('input[name$="-val"]');for(let p of Array.from(i))s.set(p,p.value),m.set(p,p.getAttribute("data-comment")??"");let u=async p=>{let f=p.target;if(!f||f.tagName!=="INPUT")return;let _=f.getAttribute("name")??"",w=l(_);if(!w)return;let h=r(),N=d(),k=e();if(!h||!N||!k)return;let T=f.value,A=f.getAttribute("data-comment")??"";if(s.get(f)===T&&(m.get(f)??"")===A)return;let j=f.getAttribute("data-valuetype")??"TEXT";if(T!==""&&pe(T,j)){Y(f,"error");return}Y(f,"saving");try{let M=f.getAttribute("data-comment")??void 0,H=await t.submitAggregate({dataSet:h,period:N,orgUnit:k,attributeOptionComboSelections:n(),dataValues:[{dataElement:w.de,categoryOptionCombo:w.coc,value:T,...M&&M.trim()!==""?{comment:M}:{}}]});s.set(f,T),m.set(f,A);let Q=H?.status==="OFFLINE_QUEUED"?"queued":"saved";Y(f,Q),f.removeAttribute("data-dirty"),a?.(Q)}catch{Y(f,"error")}};o.addEventListener("blur",p=>{u(p)},!0),o.addEventListener("input",p=>{let f=p.target;!f||f.tagName!=="INPUT"||/-val$/.test(f.getAttribute("name")??"")&&(f.value!==s.get(f)?f.setAttribute("data-dirty","1"):f.removeAttribute("data-dirty"))},!0)}function ft(o){let r=(e,n)=>{let t=e.getAttribute("name")??"",a=/^(.+)-(.+)-val$/.exec(t);if(!a)return;let l=a[2],s=Array.from(o.querySelectorAll(`input[name$="-${l}-val"]`)),m=s.indexOf(e);if(m===-1)return;let i=s[m+n];i&&(i.focus(),i.select())},d=(e,n)=>{let t=e.closest("tr");if(!t)return;let a=Array.from(t.querySelectorAll('input[name$="-val"]')),l=a.indexOf(e);if(l===-1)return;let s=a[l+n];s&&(s.focus(),s.select())};o.addEventListener("keydown",e=>{let n=e,t=n.target;if(t instanceof HTMLInputElement&&/-val$/.test(t.getAttribute("name")??"")&&!(n.metaKey||n.ctrlKey||n.altKey)){if(n.key==="Enter"){n.preventDefault(),r(t,n.shiftKey?-1:1);return}if(n.key==="ArrowUp"||n.key==="ArrowDown"){n.preventDefault(),r(t,n.key==="ArrowUp"?-1:1);return}if(n.key==="ArrowLeft"||n.key==="ArrowRight"){let a=t.selectionStart===0&&t.selectionEnd===0,l=t.selectionStart===t.value.length&&t.selectionEnd===t.value.length;n.key==="ArrowLeft"&&a?(n.preventDefault(),d(t,-1)):n.key==="ArrowRight"&&l&&(n.preventDefault(),d(t,1))}}})}function gt(o){let r=Array.from(o.querySelectorAll("h2, h3, h4")).filter(t=>(t.textContent??"").trim().length>0);if(r.length<2)return[];let d=new Set(r),e=[],n=(t,a)=>{for(let l of d)if(l!==a&&t.contains(l))return!0;return!1};return r.forEach((t,a)=>{let l=t.id||`der-de-section-${a}`;t.id=l;let s=null,m=t.parentElement,i=null;for(;m&&m!==o&&!n(m,t);)i=m,m=m.parentElement;if(i&&i.children.length>1&&i!==o)s=i,s.classList.add("der-de-section-slot"),s.dataset.sectionId=l;else{s=document.createElement("div"),s.className="der-de-section-slot",s.dataset.sectionId=l;let u=r[a+1]??null,p=[],f=t;for(;f&&f!==u;){let _=f.nextSibling;p.push(f),f=_}t.parentNode?.insertBefore(s,t);for(let _ of p)s.appendChild(_)}e.push({id:l,label:(t.textContent??"").trim(),slot:s})}),e}function bt({targetRef:o,formVersion:r}){let[d,e]=C([]),[n,t]=C(""),[a,l]=C({});return D(()=>{let s=o.current;if(!s)return;let m=gt(s);e(m),t(m[0]?.id??"")},[o,r]),D(()=>{if(d.length===0)return;let s=m=>{if(!m.altKey||m.metaKey||m.ctrlKey||m.shiftKey)return;let i=/^Digit([1-9])$/.exec(m.code);if(!i)return;let u=Number(i[1]),p=d[u-1];p&&(m.preventDefault(),t(p.id))};return window.addEventListener("keydown",s),()=>window.removeEventListener("keydown",s)},[d]),D(()=>{if(d.length===0)return;let s=()=>{let u={};for(let p of d){let f=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),_=f.filter(w=>w.value.trim()!=="").length;u[p.id]={filled:_,total:f.length}}l(u)};s();let m=o.current;if(!m)return;let i=u=>{let p=u.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&s()};return m.addEventListener("input",i,!0),()=>{m.removeEventListener("input",i,!0)}},[o,d]),D(()=>{if(!o.current||d.length===0)return;for(let i of d)i.slot.style.display=i.id===n?"":"none";let m=d.find(i=>i.id===n);m&&m.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,d,n]),d.length<2?null:y("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[c("div",{className:"der-de-section-nav__title",children:"Sections"}),c("ul",{className:"der-de-section-nav__list",children:d.map(s=>{let m=a[s.id],i=!m||m.total===0||m.filled===0?"muted":m.filled===m.total?"done":"partial";return c("li",{children:y("button",{type:"button",className:"der-de-section-nav__item"+(n===s.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>t(s.id),children:[c("span",{className:"der-de-section-nav__label",children:s.label}),m&&m.total>0&&c("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${i}`,"data-test":"de-section-nav-ratio",title:`${m.filled} of ${m.total} cells filled`,children:i==="done"?"\u2713":`${m.filled}/${m.total}`})]})},s.id)})})]})}function ht({root:o,formVersion:r}){let[d,e]=C({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(D(()=>{let a=()=>{let s=o.current;if(!s)return;let m=Array.from(s.querySelectorAll('input[name$="-val"]')),i=0,u=0,p=0,f=0,_=0;for(let w of m){w.value.trim()!==""&&i++;let h=w.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?u++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?f++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?p++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&_++}e({total:m.length,filled:i,saving:u,saved:p,queued:f,error:_})};a();let l=window.setInterval(a,800);return()=>window.clearInterval(l)},[o,r]),d.total===0)return c("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let n=[];n.push(`${d.filled} of ${d.total} filled`),d.saving>0&&n.push(`${d.saving} saving`),d.queued>0&&n.push(`${d.queued} queued`),d.error>0&&n.push(`${d.error} error`);let t=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return c("span",{className:`der-de-savepill der-de-savepill--${t}`,"data-test":"de-save-state",children:n.join(" \xB7 ")})}function yt({details:o,formSync:r,onClear:d,onComment:e}){let[n,t]=C(!1),[a,l]=C("");D(()=>{l(o?.comment??""),t(!1)},[o?.inputName,o?.comment]);let s={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},m={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return y("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:[c("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:o?y(Z,{children:[c("span",{className:"der-de-live-strip__de",children:o.deName}),c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:"der-de-live-strip__coc",children:o.cocName}),o.value&&y(Z,{children:[c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:"der-de-live-strip__value",children:o.value}),c("button",{type:"button",className:"der-de-live-strip__clear","data-test":"de-live-clear","aria-label":"Clear value",title:"Clear this cell",onMouseDown:i=>{i.preventDefault()},onClick:()=>d(o.inputName),children:"\xD7"}),c("button",{type:"button",className:"der-de-live-strip__comment-btn"+(o.comment?" has-comment":""),"data-test":"de-live-comment-btn","aria-label":o.comment?"Edit comment on this cell":"Add a comment to this cell",title:o.comment?`Comment: ${o.comment}`:"Add a comment to this cell",onMouseDown:i=>i.preventDefault(),onClick:()=>{l(o.comment??""),t(i=>!i)},children:y("svg",{viewBox:"0 0 16 16",width:"12",height:"12","aria-hidden":"true",children:[c("path",{d:"M3 3h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3 2.5V4a1 1 0 0 1 1-1z",fill:"none",stroke:"currentColor",strokeWidth:"1.4",strokeLinejoin:"round"}),o.comment&&c("circle",{cx:"12",cy:"4",r:"2.5",fill:"#1b8243"})]})}),c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),c("span",{className:`der-de-live-strip__state der-de-live-strip__state--${m[o.saveState]}`,children:s[o.saveState]}),(o.lastUpdated||o.lastUpdatedBy)&&y(Z,{children:[c("span",{className:"der-de-live-strip__sep",children:"\xB7"}),y("span",{className:"der-de-live-strip__audit","data-test":"de-live-audit",title:o.lastUpdated?new Date(o.lastUpdated).toLocaleString():void 0,children:[o.lastUpdated?Me(o.lastUpdated):"earlier",o.lastUpdatedBy&&y(Z,{children:[" by ",c("strong",{children:o.lastUpdatedBy})]})]})]})]}),c(vt,{formSync:r,cellState:o.saveState}),o.compulsory&&c("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):c("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})}),o&&n&&c("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Edit cell comment","data-test":"de-comment-popover",onClick:i=>{i.target===i.currentTarget&&t(!1)},children:y("div",{className:"der-de-comment-modal",children:[y("header",{className:"der-de-comment-modal__head",children:[y("div",{className:"der-de-comment-modal__title-wrap",children:[c("span",{className:"der-de-comment-modal__eyebrow",children:"Cell comment"}),c("h3",{className:"der-de-comment-modal__title",children:o.deName}),o.cocName&&o.cocName!=="default"&&c("p",{className:"der-de-comment-modal__sub",children:o.cocName})]}),c("button",{type:"button",className:"der-de-comment-modal__close","aria-label":"Close comment editor",onClick:()=>t(!1),children:"\xD7"})]}),y("div",{className:"der-de-comment-modal__body",children:[c("textarea",{className:"der-de-comment-modal__textarea","data-test":"de-comment-textarea",autoFocus:!0,rows:5,maxLength:400,placeholder:"Add context e.g. stockout, device fault, late reporting\u2026",value:a,onChange:i=>l(i.target.value),onKeyDown:i=>{i.key==="Escape"&&t(!1),i.key==="Enter"&&(i.metaKey||i.ctrlKey)&&(e(o.inputName,a.trim()),t(!1))}}),y("div",{className:"der-de-comment-modal__hint",children:[y("span",{children:[a.length,"/400"]}),c("span",{children:"\u2318/Ctrl + Enter to save \xB7 Esc to close"})]})]}),y("footer",{className:"der-de-comment-modal__foot",children:[o.comment&&c("button",{type:"button",className:"der-de-comment-modal__delete","data-test":"de-comment-delete",onClick:()=>{e(o.inputName,""),t(!1)},children:"Delete"}),c("button",{type:"button",className:"der-de-comment-modal__cancel",onClick:()=>t(!1),children:"Cancel"}),c("button",{type:"button",className:"der-de-comment-modal__save","data-test":"de-comment-save",disabled:a.trim()===(o.comment??""),onClick:()=>{e(o.inputName,a.trim()),t(!1)},children:o.comment?"Update comment":"Save comment"})]})]})})]})}function vt({formSync:o,cellState:r}){let d=r==="saved"||r==="queued",e=r==="saved"||r==="queued"?"lit":r==="saving"?"pending":r==="error"?"error":"muted",n=o.central,t=d?n==="CENTRAL_ACCEPTED"?"lit":n==="PENDING"||n==="IN_FLIGHT"||n==="RETRYABLE"||n==="UNKNOWN_OUTCOME"?"pending":n==="CENTRAL_REJECTED"||n==="CONFLICT_REVIEW"||n==="QUARANTINED"||n==="REQUIRES_APPROVAL"?"error":"muted":"muted",a=e==="lit"?"Saved on edge (DER)":e==="pending"?"Saving on edge\u2026":e==="error"?"Rejected by edge":"No value entered yet",l=t==="lit"?"Synced to Central DHIS2":t==="pending"?`Sync in progress (${n})`:t==="error"?`Central reported ${n}`:d?"Awaiting Central sync":"No value entered yet";return y("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[y("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+e,title:a,"data-test":"de-sync-der","data-state":e,children:[c(Le,{}),c("span",{className:"der-de-sync-logos__dot is-"+e,"aria-hidden":"true"})]}),y("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+t,title:l,"data-test":"de-sync-central","data-state":t,children:[c(_t,{}),c("span",{className:"der-de-sync-logos__dot is-"+t,"aria-hidden":"true"})]})]})}function xt(){return c("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"none",stroke:"currentColor",strokeWidth:"1.3",strokeLinecap:"round",strokeLinejoin:"round",children:[c("circle",{cx:"8",cy:"8",r:"6.3"}),c("path",{d:"M1.7 8h12.6"}),c("path",{d:"M8 1.7c2 2 2 10.6 0 12.6"}),c("path",{d:"M8 1.7c-2 2-2 10.6 0 12.6"})]})})}function Le(){return c("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"currentColor",fillRule:"evenodd",children:[c("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),c("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),c("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),c("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),c("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),c("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),c("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),c("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),c("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),c("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),c("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),c("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),c("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function _t(){return c("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:y("g",{fill:"currentColor",children:[c("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),c("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),c("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function wt({open:o,issues:r,totalCells:d,onClose:e,onPick:n}){if(D(()=>{if(!o)return;let a=l=>{l.key==="Escape"&&e()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[o,e]),!o)return null;let t=r.length===0;return c("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:a=>{a.target===a.currentTarget&&e()},children:y("div",{className:"der-de-validation "+(t?"der-de-validation--ok":"der-de-validation--err"),children:[y("header",{className:"der-de-validation__head",children:[y("div",{className:"der-de-validation__title",children:[c("span",{className:"der-de-validation__badge","aria-hidden":"true",children:t?"\u2713":"!"}),c("h3",{className:"der-de-validation__heading",children:t?`Validation passed \u2014 all ${d} cells OK.`:`Validation found ${r.length} issue${r.length===1?"":"s"} across ${d} cells.`})]}),c("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:e,children:"\xD7"})]}),c("div",{className:"der-de-validation__body",children:t?y("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",c("strong",{children:" Mark complete"})," when you're ready."]}):y("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[c("thead",{children:y("tr",{children:[c("th",{scope:"col",children:"Data element"}),c("th",{scope:"col",children:"Category option combo"}),c("th",{scope:"col",children:"Entered value"}),c("th",{scope:"col",children:"Problem"}),c("th",{scope:"col"})]})}),c("tbody",{children:r.map(a=>y("tr",{"data-test":"de-issues-row",children:[c("td",{children:a.deName}),c("td",{className:"der-de-validation__coc",children:a.cocName}),c("td",{children:c("code",{className:"der-de-validation__value",children:a.value||"\u2014"})}),c("td",{className:"der-de-validation__why",children:a.problem}),c("td",{className:"der-de-validation__jump",children:c("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>n(a),children:"Jump to cell \u2192"})})]},`${a.deId}-${a.cocId}`))})]})})]})})}function kt({open:o,onClose:r}){return D(()=>{if(!o)return;let e=n=>{n.key==="Escape"&&r()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[o,r]),o?c("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:e=>{e.target===e.currentTarget&&r()},children:y("div",{className:"der-de-shortcuts",children:[y("header",{className:"der-de-shortcuts__head",children:[c("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),c("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:r,children:"\xD7"})]}),c("dl",{className:"der-de-shortcuts__list",children:[["Enter / \u2193","Next row (same COC column)"],["Shift + Enter / \u2191","Previous row"],["\u2190 / \u2192","Previous / next COC column (same row)"],["Tab / Shift + Tab","Next / previous cell (DOM order)"],["Alt + 1..9","Jump to section N"],["Alt + S","Save all unsaved cells"],["Alt + V","Run validation"],["Alt + C","Toggle Complete marker"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([e,n])=>y("div",{className:"der-de-shortcuts__row",children:[c("dt",{children:c("kbd",{children:e})}),c("dd",{children:n})]},e))})]})}):null}function Et({open:o,onClose:r,formInfo:d,summary:e}){if(D(()=>{if(!o)return;let a=l=>{l.key==="Escape"&&r()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[o,r]),!o||!d||!e)return null;let n=d.openFuturePeriods??0,t=[["Period type",d.periodType??"\u2014"],["Form type",d.formType??"\u2014"],["Open future periods",String(n)+(n===0?" (current period closed)":"")],["Sections",String(e.sectionCount)],["Data elements",String(e.dataElementCount)],["Compulsory cells",String(e.compulsoryCount)],["Indicators",String(e.indicatorCount)],["Validation rules",String(e.validationRuleCount)]];return c("div",{className:"der-de-shortcuts-backdrop der-de-info-backdrop",role:"dialog","aria-modal":"true","aria-label":"Dataset info","data-test":"de-info-popover",onClick:a=>{a.target===a.currentTarget&&r()},children:y("div",{className:"der-de-info-modal",children:[y("header",{className:"der-de-info-modal__head",children:[y("div",{className:"der-de-info-modal__title-wrap",children:[c("span",{className:"der-de-info-modal__eyebrow",children:"Dataset"}),c("h2",{className:"der-de-info-modal__title","data-test":"de-info-title",children:d.displayName??"Dataset info"})]}),c("button",{type:"button",className:"der-de-info-modal__close","aria-label":"Close dataset info","data-test":"de-info-close",onClick:r,children:"\xD7"})]}),y("div",{className:"der-de-info-modal__body",children:[e.description&&c("p",{className:"der-de-info-modal__desc","data-test":"de-info-desc",children:e.description}),c("dl",{className:"der-de-info-modal__stats",children:t.map(([a,l])=>y("div",{className:"der-de-info-modal__stat",children:[c("dt",{children:a}),c("dd",{"data-test":`de-info-${a.toLowerCase().replace(/\s+/g,"-")}`,children:l})]},a))})]}),c("footer",{className:"der-de-info-modal__foot",children:c("button",{type:"button",className:"der-de-info-modal__done","data-test":"de-info-done",onClick:r,children:"Done"})})]})})}function Nt(o,r){o.addEventListener("paste",d=>{let e=d.target;if(!e||e.tagName!=="INPUT")return;let n=e.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(n))return;let a=d.clipboardData?.getData("text/plain")??"",l=/\r?\n/.test(a),s=/\t/.test(a);if(!l&&!s)return;let m=a.split(/\r?\n/).filter((k,T,A)=>!(T===A.length-1&&k==="")).map(k=>k.split("	").map(T=>T.trim()));if(m.length===0)return;d.preventDefault();let i=e.closest("[data-section-id]")??o,p=Array.from(i.querySelectorAll("tbody tr")).map(k=>Array.from(k.querySelectorAll('input[name$="-val"]'))),f=-1,_=-1;for(let k=0;k<p.length;k++){let T=p[k].indexOf(e);if(T!==-1){f=k,_=T;break}}if(f===-1)return;let w=0,h=0;for(let k=0;k<m.length;k++){let T=m[k],A=p[f+k];if(!A){h+=T.length;continue}for(let j=0;j<T.length;j++){let M=A[_+j];if(!M){h++;continue}M.value=T[j]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),w++}}let N=m.length===1?`${m[0].length}-cell row`:m[0]?.length===1?`${m.length}-cell column`:`${m.length}\xD7${m[0]?.length??0} block`;r({kind:"ok",message:`Pasted ${w} value${w===1?"":"s"} (${N}${h>0?`, ${h} overflow`:""}).`})},!0)}function Ct(o){let r=Array.from(o.querySelectorAll('input[name="total"][dataelementid]'));if(r.length===0)return;let d=[];for(let e of r){let n=e.getAttribute("dataelementid")??"";if(!n)continue;let t=e.closest("div"),l=(()=>{let i=t??e.parentElement;if(!i)return null;let u=i.previousElementSibling;for(;u;){if(/^(H1|H2|H3|H4)$/.test(u.tagName)||u.tagName==="DIV"&&!u.querySelector("table, input")&&(u.textContent??"").trim().length>0)return u;u=u.previousElementSibling}let p=i.closest("[data-section-id]");if(p){let f=p.querySelector("h2, h3, h4");if(f)return f}return null})();if(!l)continue;t?.remove();let s=document.createElement("span");s.className="der-de-matrix-total",s.setAttribute("data-de",n),l.appendChild(s);let m=()=>{let i=0,u=!1,p=Array.from(o.querySelectorAll(`input[dataelementid="${n}"][name$="-val"],input[name^="${n}-"][name$="-val"]`)),f=new Set;for(let _ of p){if(f.has(_))continue;f.add(_);let w=parseFloat(_.value);Number.isFinite(w)&&(i+=w,u=!0)}if(u){let _=Number.isInteger(i)?i:Number(i.toFixed(2));s.textContent=` (Total: ${_})`}else s.textContent=""};d.push(m),m()}d.length!==0&&o.addEventListener("input",e=>{let n=e.target;if(!(!n||n.tagName!=="INPUT")&&/-val$/.test(n.getAttribute("name")??""))for(let t of d)t()},!0)}function St(o){let r=Array.from(o.querySelectorAll("td.der-de-row-total-cell[data-de-row-total]"));if(r.length===0)return;let d=e=>{let n=e.closest("tr");if(!n)return;let t=0,a=!1;for(let l of Array.from(n.querySelectorAll('input[name$="-val"]'))){let s=l.value.trim();if(s==="")continue;let m=Number(s);Number.isFinite(m)&&(t+=m,a=!0)}if(!a){e.textContent="\u2014";return}e.textContent=Number.isInteger(t)?String(t):t.toFixed(2)};for(let e of r)d(e);o.addEventListener("input",e=>{let n=e.target;if(!n||n.tagName!=="INPUT"||!/-val$/.test(n.getAttribute("name")??""))return;let a=n.closest("tr")?.querySelector("td.der-de-row-total-cell[data-de-row-total]");a&&d(a)},!0)}function Tt(o,r){let d=r.indicators??[];if(d.length===0)return;let e=d.filter(i=>i.numerator&&i.denominator).map(i=>({id:i.id,factor:i.indicatorType?.factor??1,numExpr:i.numerator,denExpr:i.denominator}));if(e.length===0)return;let n=Array.from(o.querySelectorAll("input[indicatorid]")),t=new Map;for(let i of Array.from(o.querySelectorAll('input[name$="-val"]')))t.set(i.getAttribute("name")??"",i);let a=i=>{let u=0;for(let[p,f]of t){if(!p.startsWith(`${i}-`))continue;let _=parseFloat(f.value);Number.isFinite(_)&&(u+=_)}return u},l=i=>i.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(u,p,f)=>{if(f){let _=t.get(`${p}-${f}-val`),w=parseFloat(_?.value??"");return Number.isFinite(w)?String(w):"0"}return String(a(p))}),s=i=>{if(!/^[\s\d+\-*/().eE]+$/.test(i))return NaN;try{return Function(`"use strict";return (${i})`)()}catch{return NaN}},m=()=>{for(let i of e){let u=s(l(i.numExpr)),p=s(l(i.denExpr)),f=n.find(w=>w.getAttribute("indicatorid")===i.id);if(!f)continue;if(!Number.isFinite(u)||!Number.isFinite(p)||p===0){f.value="";continue}let _=u/p*i.factor;f.value=Number.isInteger(_)?String(_):_.toFixed(2)}};o.addEventListener("input",i=>{let u=i.target;u&&u.tagName==="INPUT"&&u.hasAttribute("name")&&/-val$/.test(u.getAttribute("name")??"")&&m()},!0),m()}function At(o,r){let d={};for(let e of r.dataSetElements??[])e.dataElement&&(d[e.dataElement.id]=e.dataElement);for(let e of Array.from(o.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!n)continue;let t=d[n[1]],a=t?.formName??t?.name??n[1],l=t?.categoryCombo?.categoryOptionCombos?.find(m=>m.id===n[2]),s=l?.name??l?.displayName??n[2];e.hasAttribute("aria-label")||e.setAttribute("aria-label",s===n[2]?`${a}`:`${a}, ${s}`),e.getAttribute("data-compulsory")==="1"&&e.setAttribute("aria-required","true")}}function Dt(o,r){let d={};for(let e of r.dataSetElements??[])e.dataElement&&(d[e.dataElement.id]=e.dataElement);for(let e of Array.from(o.querySelectorAll('input[name$="-val"]'))){let n=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!n)continue;let t=d[n[1]]?.valueType??"TEXT";switch(e.setAttribute("data-valuetype",t),t){case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":e.setAttribute("inputmode","numeric"),e.setAttribute("pattern","-?\\d*");break;case"NUMBER":case"UNIT_INTERVAL":case"PERCENTAGE":e.setAttribute("inputmode","decimal"),e.setAttribute("pattern","-?\\d*(\\.\\d+)?");break;case"EMAIL":e.setAttribute("inputmode","email"),e.setAttribute("type","email");break;case"PHONE_NUMBER":e.setAttribute("inputmode","tel"),e.setAttribute("type","tel");break;case"URL":e.setAttribute("inputmode","url"),e.setAttribute("type","url");break;case"DATE":e.setAttribute("type","date");break;case"TIME":e.setAttribute("type","time");break;case"DATETIME":e.setAttribute("type","datetime-local");break;default:break}}}function $t(o){let r=d=>{let e=d.value;if(e===""){d.removeAttribute("data-de-invalid"),d.removeAttribute("title");return}let n=d.getAttribute("data-valuetype")??"TEXT",t=pe(e,n);t?(d.setAttribute("data-de-invalid","1"),d.setAttribute("title",t)):(d.removeAttribute("data-de-invalid"),d.removeAttribute("title"))};o.addEventListener("input",d=>{let e=d.target;!e||e.tagName!=="INPUT"||/-val$/.test(e.getAttribute("name")??"")&&r(e)},!0);for(let d of Array.from(o.querySelectorAll('input[name$="-val"]')))r(d)}function It(o,r){let d=r.compulsoryDataElementOperands??[],e=new Set;for(let n of d){let t=n.dimensionItem;if(!t)continue;let a=t.split(".");a.length===2&&e.add(`${a[0]}:${a[1]}`)}if(e.size!==0)for(let n of Array.from(o.querySelectorAll('input[name$="-val"]'))){let t=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");t&&e.has(`${t[1]}:${t[2]}`)&&n.setAttribute("data-compulsory","1")}}function Lt(o,r,d){let e={};for(let t of r.dataSetElements??[])t.dataElement&&(e[t.dataElement.id]=t.dataElement);let n=t=>{let a=t.getAttribute("name")??t.id??"",l=/^(.+)-(.+)-val$/.exec(a);if(!l)return null;let s=l[1],m=l[2],i=e[s],u=i?.categoryCombo,p=u?.categoryOptionCombos?.find(T=>T.id===m),f=[],_=p?.name??p?.displayName??m,w=_.split(/,\s*/).filter(Boolean),h=u?.categories??[];w.forEach((T,A)=>{f.push({category:h[A]?.name??h[A]?.displayName??"",option:T})});let N=t.style.outline||"",k=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":t.value.trim()===""?"empty":"saved";return{deId:s,cocId:m,deName:i?.name??s,deFormName:i?.formName,valueType:i?.valueType??"TEXT",optionSetId:i?.optionSet?.id,cocName:_,categoryBreakdown:f,value:t.value,saveState:k,inputName:a,compulsory:t.getAttribute("data-compulsory")==="1",lastUpdated:t.getAttribute("data-updated")??void 0,lastUpdatedBy:t.getAttribute("data-updated-by")??void 0,comment:t.getAttribute("data-comment")??void 0}};o.addEventListener("focusin",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let l=n(a);l&&d(l)}},!0),o.addEventListener("input",t=>{let a=t.target;if(a&&a.tagName==="INPUT"){let l=n(a);l&&d(l)}},!0)}function Mt(o,r,d){if(!o)return;let e=globalThis,n=e.dhis2?.de?.dataElements??{},t=e.dhis2?.de?.categoryOptionCombos??{},a=Array.from(o.querySelectorAll('input[name$="-val"]')),l=[];for(let s of a){s.style.outline="";let m=/^(.+)-(.+)-val$/.exec(s.getAttribute("name")??"");if(!m)continue;let i=m[1],u=m[2],p=n[i],f=p?.valueType??"TEXT",_=s.value.trim();if(_===""){s.getAttribute("data-compulsory")==="1"&&(s.style.outline="2px solid #c0392b",l.push({deId:i,cocId:u,valueType:f,value:"",problem:"compulsory value missing",deName:p?.name??i,cocName:t[u]?.name??u,inputName:s.name}));continue}let w=pe(_,f);w&&(s.style.outline="2px solid #c0392b",l.push({deId:i,cocId:u,valueType:f,value:_,problem:w,deName:p?.name??i,cocName:t[u]?.name??u,inputName:s.name}))}d(l,a.length),r({kind:"idle"})}function pe(o,r){let d=Number(o),e=Number.isInteger(d);switch(r){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(r){case"INTEGER":if(!e)return"must be an integer";break;case"INTEGER_POSITIVE":if(!e||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!e||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!e||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function Y(o,r){let d=r==="saving"?"#b9860a":r==="saved"?"#1a8754":r==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${d}`,o.style.transition="outline 150ms",r==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),r==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function Rt(o,r,d,e,n){if(!r||!d||!e)return;let t;try{t=(await n.readAggregateValues(e,d,2e3)).dataValues??[]}catch{return}for(let a of t){let l=a.dataElement,s=a.categoryOptionCombo,m=a.value;if(!l||!s||m==null)continue;let i=o.querySelector(`input[name="${l}-${s}-val"]`);i&&(i.value=m,a.comment&&i.setAttribute("data-comment",a.comment),a.lastUpdated&&i.setAttribute("data-updated",a.lastUpdated),a.storedByUsername&&i.setAttribute("data-updated-by",a.storedByUsername))}}function Me(o){let r=Date.parse(o);if(!Number.isFinite(r))return o;let d=Date.now()-r;if(d<0)return new Date(r).toLocaleString();let e=Math.floor(d/6e4);if(e<1)return"just now";if(e<60)return`${e} min ago`;let n=Math.floor(e/60);if(n<24)return`${n} h ago`;let t=Math.floor(n/24);return t<30?`${t} d ago`:new Date(r).toLocaleDateString()}function Re(o){return new Promise((r,d)=>{let e=document.createElement("script");e.src=o,e.async=!1,e.setAttribute("data-der-custom-form",o),e.onload=()=>r(),e.onerror=()=>d(new Error(`failed to load ${o}`)),document.head.appendChild(e)})}function Oe(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let r=document.createElement("link");r.rel="stylesheet",r.href=o,r.setAttribute("data-der-custom-form",o),document.head.appendChild(r)}function Ae(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Ot(o,r,d={}){let e=d.stripStyles??!0;o.classList.toggle("der-de-custom-form--author",!e);let n=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${r}</body></html>`,"text/html");for(let a of Array.from(n.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let l=a.getAttribute("href")??"";l&&Oe(Ae(l))}else{let l=document.createElement("style");l.textContent=a.textContent??"",l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l)}a.remove()}let t=[];for(let a of Array.from(n.querySelectorAll("script"))){let l=a.getAttribute("src");l?t.push({src:Ae(l)}):t.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(n.body.querySelectorAll("*"))){if(e&&a.removeAttribute("style"),a.tagName==="INPUT"){let l=a.getAttribute("id")??"";l.endsWith("-val")&&a.getAttribute("name")!==l&&a.setAttribute("name",l)}if(e&&a.tagName==="TH"){let l=(a.textContent??"").trim();(l==="Reporting item"||l==="Reported count")&&(a.textContent=l==="Reporting item"?"Data elements":"Value")}}for(let a of Array.from(n.body.childNodes))o.appendChild(document.adoptNode(a));for(let a of t)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await Re(a.src);else if(a.code){let l=document.createElement("script");l.textContent=a.code,l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l),l.remove()}}var me={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},De={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},$e={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},jt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},Ut={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function Pt(o,r,d,e=new Set,n=new Set,t=0){let a=(h,N)=>{let k=zt(o,h),T=k?`${N}  \xB7  ${k}`:N;return e.has(h)?`\u2713  ${T}`:n.has(h)?`\u25CF  ${T}`:T},l={...me},s=je(o,t);if(s.length===0)return c("input",{value:r,onChange:h=>d(h.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:l});let m=[...s];if(r&&!m.some(h=>h.id===r)){let h=Ht(o,r)??r;m.unshift({id:r,label:h})}let i=s[0]?.id??null,u=m.findIndex(h=>h.id===r),p=u===-1||u<m.length-1||!!o,f=r!==""&&(u>0||r!==i),_=()=>{if(!o)return;let h=u>=0&&u<m.length-1?m[u+1]?.id??"":Ie(o,r||i||"",-1);h&&d(h)},w=()=>{if(!o||!r||r===i)return;let h=u>0?m[u-1]?.id??"":Ie(o,r,1);h&&d(h)};return y("span",{className:"der-de-period-nav",children:[c("button",{type:"button","aria-label":"Previous period",onClick:_,disabled:!p,className:"der-de-period-btn",children:"\u25C0"}),y("select",{value:r,onChange:h=>d(h.target.value),style:l,children:[c("option",{value:"",children:"Select a period\u2026"}),m.map(h=>c("option",{value:h.id,children:a(h.id,h.label)},h.id))]}),c("button",{type:"button","aria-label":"Next period",onClick:w,disabled:!f,className:"der-de-period-btn",children:"\u25B6"})]})}function Ie(o,r,d){let e=n=>String(n).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(r))return"";let n=Number(r.slice(0,4)),t=Number(r.slice(4,6))-1,a=Number(r.slice(6,8)),l=new Date(n,t,a+d);return`${l.getFullYear()}${e(l.getMonth()+1)}${e(l.getDate())}`}case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(r);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+d;return a<1?(t-=1,a=X(t)):a>X(t)&&(t+=1,a=1),`${t}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(r))return"";let n=Number(r.slice(0,4)),t=Number(r.slice(4,6))-1,a=n*12+t+d;return`${Math.floor(a/12)}${e((a%12+12)%12+1)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(r);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+d;return a<1?(t-=1,a=6):a>6&&(t+=1,a=1),`${t}${e(a)}B`}case"Quarterly":{let n=/^(\d{4})Q(\d)$/.exec(r);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+d;return a<1?(t-=1,a=4):a>4&&(t+=1,a=1),`${t}Q${a}`}case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(r);if(!n)return"";let t=Number(n[1]),a=Number(n[2])+d;return a<1?(t-=1,a=2):a>2&&(t+=1,a=1),`${t}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(r)?String(Number(r)+d):"";default:return""}}function Ht(o,r){let d=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":return/^\d{8}$/.test(r)?`${r.slice(0,4)}-${r.slice(4,6)}-${r.slice(6,8)}`:null;case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(r);return e?`${e[1]} W${String(e[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(r))return null;let e=Number(r.slice(4,6))-1;return`${d[e]??""} ${r.slice(0,4)}`}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(r);if(!e)return null;let n=(Number(e[2])-1)*2;return`${d[n]}\u2013${d[n+1]} ${e[1]}`}case"Quarterly":return r.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(r);return e?`${e[1]} ${e[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(r)?r:null;default:return null}}function zt(o,r){if(!o||!r)return null;let d=new Date;switch(o){case"Daily":{let e=/^(\d{4})(\d{2})(\d{2})$/.exec(r);if(!e)return null;let n=new Date(Number(e[1]),Number(e[2])-1,Number(e[3])),t=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-n.getTime())/864e5);return t===0?"today":t===1?"yesterday":t>0&&t<30?`${t} days ago`:t<0?"future":null}case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(r);if(!e)return null;let n=fe(d),t=(n.year-Number(e[1]))*52+(n.week-Number(e[2]));return t===0?"this week":t===1?"last week":t>1&&t<52?`${t} weeks ago`:t<0?"future":null}case"Monthly":{let e=/^(\d{4})(\d{2})$/.exec(r);if(!e)return null;let n=(d.getFullYear()-Number(e[1]))*12+(d.getMonth()-(Number(e[2])-1));if(n===0)return"this month";if(n===1)return"last month";if(n>1&&n<12)return`${n} months ago`;if(n>=12&&n%12===0){let t=n/12;return t===1?"1 year ago":`${t} years ago`}return n>=12?`${n} months ago`:n<0?"future":null}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(r);if(!e)return null;let n=Math.floor(d.getMonth()/2)+1,t=(d.getFullYear()-Number(e[1]))*6+(n-Number(e[2]));return t===0?"this bi-month":t===1?"last bi-month":t>1?`${t} bi-months ago`:"future"}case"Quarterly":{let e=/^(\d{4})Q(\d)$/.exec(r);if(!e)return null;let n=Math.floor(d.getMonth()/3)+1,t=(d.getFullYear()-Number(e[1]))*4+(n-Number(e[2]));return t===0?"this quarter":t===1?"last quarter":t>1?`${t} quarters ago`:"future"}case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(r);if(!e)return null;let n=d.getMonth()<6?1:2,t=(d.getFullYear()-Number(e[1]))*2+(n-Number(e[2]));return t===0?"this half":t===1?"last half":t>1?`${t} halves ago`:"future"}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{if(!/^\d{4}$/.test(r))return null;let e=d.getFullYear()-Number(r);return e===0?"this year":e===1?"last year":e>1?`${e} years ago`:"future"}default:return null}}function je(o,r=0){let d=new Date,e=d.getFullYear(),n=d.getMonth(),t=s=>String(s).padStart(2,"0"),a=["January","February","March","April","May","June","July","August","September","October","November","December"],l=Math.max(0,1-Math.max(0,r));switch(o){case"Daily":{let s=[];for(let m=l;m<30+l;m++){let i=new Date(d);i.setDate(i.getDate()-m);let u=`${i.getFullYear()}${t(i.getMonth()+1)}${t(i.getDate())}`,p=`${i.getFullYear()}-${t(i.getMonth()+1)}-${t(i.getDate())}`;s.push({id:u,label:p})}return s}case"Weekly":{let s=[],m=fe(d),i=m.year,u=m.week;for(let p=0;p<l;p++)u-=1,u<1&&(i-=1,u=X(i));for(let p=0;p<12;p++)s.push({id:`${i}W${u}`,label:`${i} W${t(u)}`}),u-=1,u<1&&(i-=1,u=X(i));return s}case"Monthly":{let s=[];for(let m=l;m<24+l;m++){let i=e,u=n,p=i*12+u-m,f=Math.floor(p/12),_=(p%12+12)%12;s.push({id:`${f}${t(_+1)}`,label:`${a[_]} ${f}`})}return s}case"BiMonthly":{let s=[],m=Math.floor(n/2)+1,i=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(i-=1,u=6);for(let p=0;p<12;p++){let f=(u-1)*2;s.push({id:`${i}${t(u)}B`,label:`${a[f]}\u2013${a[f+1]} ${i}`}),u-=1,u<1&&(i-=1,u=6)}return s}case"Quarterly":{let s=[],m=Math.floor(n/3)+1,i=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(i-=1,u=4);for(let p=0;p<8;p++)s.push({id:`${i}Q${u}`,label:`${i} Q${u}`}),u-=1,u<1&&(i-=1,u=4);return s}case"SixMonthly":{let s=[],m=n<6?1:2,i=e,u=m;for(let p=0;p<l;p++)u-=1,u<1&&(i-=1,u=2);for(let p=0;p<6;p++)s.push({id:`${i}S${u}`,label:`${i} ${u===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),u-=1,u<1&&(i-=1,u=2);return s}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let s=[];for(let m=l;m<10+l;m++){let i=e-m;s.push({id:String(i),label:String(i)})}return s}default:return[]}}function fe(o){let r=new Date(o.getFullYear(),o.getMonth(),o.getDate()),d=r.getDay()===0?7:r.getDay();r.setDate(r.getDate()+4-d);let e=new Date(r.getFullYear(),0,1),t=Math.round((r.getTime()-e.getTime())/864e5);return{year:r.getFullYear(),week:Math.ceil((t+1)/7)}}function X(o){return fe(new Date(o,11,28)).week}var Ft=`
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
