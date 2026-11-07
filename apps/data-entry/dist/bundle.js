/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as A,useRef as ie,useState as S}from"react";import{useAuth as Ze,useOrgUnitBinding as Ye,useOnlineStatus as Xe,useDerApi as et,ScreenCard as tt}from"@der/app-sdk";import{Fragment as W,jsx as u,jsxs as v}from"react/jsx-runtime";function rt(){let a=Ze(),t=Ye(),d=Xe(),e=et(),[i,o]=S("custom"),[r,l]=S([]),[s,p]=S(""),[n,c]=S(""),[m,b]=S(""),[h,x]=S(""),[y,N]=S({kind:"idle"}),[k,D]=S(null),T=ie(null),[R,j]=S({}),F=ie({}),[Le,Y]=S([]),[H,V]=S(null),[X,pe]=S(!1),[Me,ee]=S(new Set),[Re,te]=S(new Set),[Q,me]=S(""),[B,Oe]=S(0),[K,je]=S([]),[fe,J]=S(!1),ge=ie(0),[Ue,He]=S(null),[Pe,re]=S({localSaved:!1,central:null}),[ze,qe]=S(0),[Fe,oe]=S(!1),[be,Be]=S(null),[Ve,ye]=S(!1);A(()=>{let g=f=>{if(f.key!=="?")return;let _=f.target;_&&(_.tagName==="INPUT"||_.tagName==="TEXTAREA")||(f.preventDefault(),oe(w=>!w))};return window.addEventListener("keydown",g),()=>window.removeEventListener("keydown",g)},[]),A(()=>{let g=f=>{let _=T.current;_&&_.querySelector('input[data-dirty="1"]')&&(f.preventDefault(),f.returnValue="")};return window.addEventListener("beforeunload",g),()=>window.removeEventListener("beforeunload",g)},[]);let[P,Qe]=S(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});A(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",P)}catch{}},[P]);let[z,Ke]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});A(()=>{try{window.localStorage.setItem("der-de-density",z)}catch{}},[z]),A(()=>{let g=!1;return(async()=>{if(!t.bound||!t.orgUnitUid){l([]);return}try{let f=await e.listDataSets(t.orgUnitUid);if(g)return;let _=(f.dataSets??[]).map(w=>({id:w.id,label:w.displayName??w.name??w.id,periodType:w.periodType,formType:w.formType})).sort((w,E)=>w.label.localeCompare(E.label));l(_)}catch{}})(),()=>{g=!0}},[t.bound,t.orgUnitUid]),A(()=>{if(s.trim()===""){D(null),Y([]),j({}),F.current={};return}let g=!1;return(async()=>{try{let f=await e.getDataSetMeta(s.trim());if(g)return;let _=!!f.dataEntryForm&&f.formType==="CUSTOM"||f.formType==="SECTION";D({hasCustomForm:_,formId:f.dataEntryForm?.id,displayName:f.displayName??f.name,formType:f.formType,periodType:f.periodType,openFuturePeriods:f.openFuturePeriods??0}),o(_?"custom":"structured");try{let w=await e.getDataSetFormMetadata(s.trim());if(g)return;let E=await ke(w,e);if(g)return;let O=(E.categoryCombo?.categories??[]).filter(L=>(L.categoryOptions?.length??0)>1).map(L=>({id:L.id,name:L.name??L.id,options:(L.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));Y(O);let U={};for(let L of O)L.options[0]&&(U[L.id]=L.options[0].id);j(U),F.current=U}catch{}}catch{g||D(null)}})(),()=>{g=!0}},[s]),A(()=>{if(i!=="custom"||!k?.hasCustomForm||k.formType==="CUSTOM"&&!k.formId)return;let g=T.current;if(!g)return;let f=!1;return(async()=>{N({kind:"submitting"});try{let _=await e.getDataSetFormMetadata(s.trim());if(f)return;let w=await ke(_,e);if(f)return;let E="";if(k.formType==="CUSTOM"&&k.formId){try{E=(await e.getDataEntryFormHtml(k.formId)).htmlCode??""}catch(C){E="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",C)}E.trim()||(E=Ee(w))}else k.formType==="SECTION"&&(E=Ee(w));if(f)return;let O=await e.listValidationRules(s.trim()).catch(()=>({validationRules:[]}));if(f)return;let U=(w.categoryCombo?.categories??[]).filter(C=>(C.categoryOptions?.length??0)>1).map(C=>({id:C.id,name:C.name??C.id,options:(C.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));Y(U);let L={};for(let C of U)C.options[0]&&(L[C.id]=C.options[0].id);j(L),F.current=L,g.replaceChildren();for(let[C,I]of[["selectedDataSetId",s.trim()],["selectedPeriodId",n.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let M=document.createElement("input");M.type="hidden",M.id=C,M.value=I,g.appendChild(M)}for(let[C,I]of Object.entries(L)){let M=document.createElement("input");M.type="hidden",M.id=`category-${C}`,M.value=I,M.setAttribute("data-der-category",C),g.appendChild(M)}let $=document.createElement("div");$.id="contentDiv",g.appendChild($),it({dataSetId:s.trim(),periodId:n.trim(),orgUnitId:t.orgUnitUid??"",meta:w,aocSelections:L,validationRules:O.validationRules??[]}),Be({description:w.description,sectionCount:w.sections?.length??0,dataElementCount:w.dataSetElements?.length??0,compulsoryCount:w.compulsoryDataElementOperands?.length??0,validationRuleCount:O.validationRules?.length??0,indicatorCount:w.indicators?.length??0});for(let C of at)De(C);for(let C of ot)document.querySelector(`script[data-der-custom-form="${C}"]`)||await Ae(C);st(),await Lt($,E,{stripStyles:P==="der"}),await $t($,s.trim(),n.trim(),t.orgUnitUid??"",e),lt($,()=>s.trim(),()=>n.trim(),()=>t.orgUnitUid??"",()=>({...F.current}),e,C=>{re(I=>({...I,localSaved:!0,central:I.central==="CENTRAL_ACCEPTED"&&C==="saved"?"PENDING":I.central})),qe(I=>I+1)}),$.addEventListener("blur",C=>{let I=C.target;if(I&&I.tagName==="INPUT"&&/-val$/.test(I.getAttribute("name")??"")&&I.value.trim()!==""){let M=n.trim();te(ne=>ne.has(M)?ne:new Set(ne).add(M))}},!0),ct($),_t($,N),wt($),kt($),At($,w,He),Tt($,w),St($,w),Ct($),Nt($,w),Et($,w),Oe(C=>C+1),N({kind:"idle"})}catch(_){N({kind:"error",message:`custom form failed to render: ${_.message}`})}})(),()=>{f=!0}},[i,k,s,n,t.orgUnitUid,P]);let Je=t.bound&&s.trim()!==""&&n.trim()!==""&&m.trim()!==""&&h.trim()!==""&&y.kind!=="submitting";async function Ge(g){g.preventDefault(),N({kind:"submitting"});try{await e.submitAggregate({dataSet:s,period:n,orgUnit:t.orgUnitUid,dataValues:[{dataElement:m,value:h}]}),N({kind:"ok",message:`Submitted ${m}=${h} for ${n}.`}),b(""),x("")}catch(f){N({kind:"error",message:f.message??"Submission failed"})}}let he=n.trim()!=="",ae=s.trim()!=="",q=ae&&he&&t.bound;A(()=>{let g=T.current;if(!g)return;let f=Q.trim().toLowerCase(),_=Array.from(g.querySelectorAll("tbody tr"));for(let w of _){if(!f){w.style.display="";continue}let O=((w.querySelector(".dataElementCell")??w.querySelector("td"))?.textContent??"").toLowerCase();w.style.display=O.includes(f)?"":"none"}},[Q,B]),A(()=>{let g=t.orgUnitUid??"";if(!s.trim()||!g||!n.trim()){re(E=>E.central==null&&!E.updatedAt?E:{...E,central:null});return}let f=!1,_=null,w=async()=>{try{let E=await e.readAggregateFormSyncState(s.trim(),g,n.trim());if(f)return;re(U=>({localSaved:U.localSaved||E.state!=null,central:E.state,updatedAt:E.updatedAt})),(E.state==="PENDING"||E.state==="IN_FLIGHT"||E.state==="RETRYABLE")&&(_=setTimeout(()=>void w(),4e3))}catch{}};return w(),()=>{f=!0,_&&clearTimeout(_)}},[s,n,t.orgUnitUid,ze]),A(()=>{if(!s.trim()||!t.bound||!k?.periodType){ee(new Set),te(new Set);return}let g=!1;return(async()=>{let f=$e(k.periodType,k.openFuturePeriods??0).map(E=>E.id),[_,w]=await Promise.all([Promise.all(f.map(async E=>{try{return(await e.getCompletion(s.trim(),t.orgUnitUid??"",E)).completed?E:null}catch{return null}})),Promise.all(f.map(async E=>{try{return((await e.readAggregateValues(t.orgUnitUid??"",E,1)).dataValues?.length??0)>0?E:null}catch{return null}}))]);g||(ee(new Set(_.filter(E=>E!==null))),te(new Set(w.filter(E=>E!==null))))})(),()=>{g=!0}},[s,t.orgUnitUid,k?.periodType]),A(()=>{if(!q){V(null);return}let g=!1;return(async()=>{try{let f=await e.getCompletion(s.trim(),t.orgUnitUid??"",n.trim());if(g)return;V({completed:!!f.completed,completedAt:f.completedAt})}catch{g||V({completed:!1})}})(),()=>{g=!0}},[s,n,t.orgUnitUid,q]);function ve(){Dt(T.current,N,(g,f)=>{je(g),ge.current=f,J(!0)})}let[xe,We]=S(0);A(()=>{let g=()=>{let E=T.current;We(E?E.querySelectorAll('input[data-dirty="1"]').length:0)};g();let f=T.current,_=()=>g();f?.addEventListener("input",_,!0),f?.addEventListener("blur",_,!0);let w=window.setInterval(g,1e3);return()=>{f?.removeEventListener("input",_,!0),f?.removeEventListener("blur",_,!0),window.clearInterval(w)}},[B]);function _e(){let g=T.current;if(!g)return;let f=Array.from(g.querySelectorAll('input[data-dirty="1"]'));for(let _ of f)_.dispatchEvent(new Event("blur",{bubbles:!0}))}async function we(){if(!q||X)return;let g=!H?.completed;if(g){let f=T.current;if(f){let _=[];for(let w of Array.from(f.querySelectorAll('input[data-compulsory="1"]')))w.value.trim()===""&&_.push(w);if(_.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${_.length} compulsory value${_.length===1?"":"s"} still missing. Run Validate to jump to them.`}),_[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}pe(!0);try{let f=await e.markCompletion({dataSet:s.trim(),orgUnit:t.orgUnitUid??"",period:n.trim(),completed:g});V({completed:!!f.completed,completedAt:f.completedAt}),ee(_=>{let w=new Set(_);return f.completed?w.add(n.trim()):w.delete(n.trim()),w}),N({kind:"ok",message:f.completed?"Dataset marked complete.":"Dataset reopened."})}catch(f){N({kind:"error",message:`Completion failed: ${f.message}`})}finally{pe(!1)}}return A(()=>{let g=f=>{!f.altKey||f.metaKey||f.ctrlKey||f.shiftKey||(f.code==="KeyV"?(f.preventDefault(),ve()):f.code==="KeyC"?(f.preventDefault(),we()):f.code==="KeyS"&&(f.preventDefault(),_e()))};return window.addEventListener("keydown",g),()=>window.removeEventListener("keydown",g)}),v(tt,{dataTest:"der-aggregate-entry",children:[u("style",{children:Ut}),v("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[v("div",{className:"der-de-toolbar__head",children:[u("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:v("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[u("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),u("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),u("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),u("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),u("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),u("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),k&&be&&u("button",{type:"button",className:"der-de-toolbar__info-btn","data-test":"de-info-btn","aria-label":"About this dataset",title:"About this dataset",onClick:()=>ye(g=>!g),children:v("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[u("circle",{cx:"8",cy:"8",r:"7",fill:"none",stroke:"currentColor",strokeWidth:"1.5"}),u("circle",{cx:"8",cy:"4.5",r:"0.9",fill:"currentColor"}),u("path",{d:"M8 7v5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})}),u("span",{className:"der-de-toolbar__status "+(d.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":d.isOnline?"Online":"Offline",children:d.isOnline?"online":`offline \xB7 ${d.queuedCount} queued`}),v("span",{className:"der-de-toolbar__ou-wrap",children:[u("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),u("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),v("div",{className:"der-de-toolbar__picks",children:[v("label",{className:"der-de-toolbar__field",children:[u("span",{className:"der-de-toolbar__field-label",children:"Data set"}),v("select",{className:"der-de-toolbar__select",value:s,onChange:g=>{p(g.target.value),c("")},"data-test":"der-de-dataset-picker",children:[u("option",{value:"",children:"Select a data set\u2026"}),r.map(g=>u("option",{value:g.id,children:g.label},g.id))]})]}),Le.map(g=>v("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[u("span",{className:"der-de-toolbar__field-label",children:g.name}),v("select",{className:"der-de-toolbar__select",value:R[g.id]??"",onChange:f=>{let _={...R,[g.id]:f.target.value};j(_),F.current=_,dt(T.current,_)},"data-test":"de-aoc-select",children:[u("option",{value:"",children:"Select\u2026"}),g.options.map(f=>u("option",{value:f.id,children:f.name},f.id))]})]},g.id)),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[v("span",{className:"der-de-toolbar__field-label",children:["Period",k?.periodType?` \xB7 ${k.periodType}`:""]}),u("span",{className:"der-de-period-wrap",children:Ot(k?.periodType,n,c,Me,Re,k?.openFuturePeriods??0)})]}),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[u("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),v("span",{className:"der-de-toolbar__filter",children:[u("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:Q,onChange:g=>me(g.target.value),"data-test":"de-filter-input"}),Q&&u("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>me(""),children:"\xD7"})]})]}),u("div",{className:"der-de-toolbar__cell-info",children:u(ft,{root:T,details:Ue,formVersion:B,formSync:Pe,onClear:g=>{let f=T.current;if(!f)return;let _=f.querySelector(`input[name="${g}"]`);_&&(_.value="",_.dispatchEvent(new Event("input",{bubbles:!0})),_.focus())}})})]})]}),y.kind==="ok"&&u("div",{style:Mt,"data-test":"de-ok",children:y.message}),y.kind==="error"&&u("div",{style:Rt,"data-test":"de-err",children:y.message}),!t.bound&&u("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!ae&&u("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&ae&&!he&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",k?.formType==="SECTION"?"section":"data entry"," form."]}),q&&i==="structured"&&v("form",{onSubmit:Ge,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",u("input",{value:m,onChange:g=>b(g.target.value),style:ce})]}),v("label",{children:["Value",u("input",{value:h,onChange:g=>x(g.target.value),inputMode:"decimal",style:ce})]}),u("div",{style:{gridColumn:"1 / -1"},children:u("button",{type:"submit",disabled:!Je,style:Se,children:y.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),q&&i==="custom"&&u("div",{className:`der-de-form-card der-de-density-${z}`,children:v("div",{className:"der-de-form-split",children:[u(pt,{targetRef:T,formVersion:B}),u("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),q&&i==="custom"&&v("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[u(mt,{root:T,formVersion:B}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${z==="compact"?"comfortable":"compact"} density`,title:`Density: ${z}. Click to switch.`,onClick:()=>Ke(g=>g==="compact"?"comfortable":"compact"),children:z==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${P==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${P==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>Qe(g=>g==="der"?"author":"der"),children:P==="der"?"\u2699 DER layout":"\u2699 Author layout"}),H&&u("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:H.completed?`Complete${H.completedAt?" \xB7 "+new Date(H.completedAt).toLocaleString():""}`:"Open for edits"}),xe>0&&v("button",{type:"button",onClick:_e,className:"der-de-saveall-btn","data-test":"de-saveall-btn",title:"Flush all unsaved cells to the DER mirror (Alt+S)",children:["Save all \xB7 ",xe]}),u("button",{type:"button",onClick:ve,style:Ce,"data-test":"de-validate-btn",children:"Validate"}),K.length>0&&!fe&&v("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[K.length," issue",K.length===1?"":"s"]}),u("button",{type:"button",onClick:()=>oe(g=>!g),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),u("button",{type:"button",onClick:we,disabled:X,style:H?.completed?Ce:Se,"data-test":"de-complete-btn",children:X?"Saving\u2026":H?.completed?"Reopen":"Mark complete"})]}),u(vt,{open:Fe,onClose:()=>oe(!1)}),u(xt,{open:Ve,onClose:()=>ye(!1),formInfo:k,summary:be}),u(ht,{open:fe,issues:K,totalCells:ge.current,onClose:()=>J(!1),onPick:g=>{let f=T.current?.querySelector(`input[name="${g.inputName}"]`);f&&(f.scrollIntoView({behavior:"smooth",block:"center"}),f.focus(),f.select()),J(!1)}})]})}var ot=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],at=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],se=null,de=null,le=null;async function ke(a,t){se||(se=t.listAllDataElements().then(l=>new Map(l.map(s=>[s.id,s])))),de||(de=t.listAllCategoryCombos().then(l=>new Map(l.map(s=>[s.id,s])))),le||(le=t.listAllCategoryOptionCombos().then(l=>{let s=new Map;for(let p of l){let n=p.categoryCombo?.id;if(!n)continue;let c=s.get(n);c?c.push(p):s.set(n,[p])}return s}));let[d,e,i]=await Promise.all([se,de,le]),o=l=>{if(!l?.id)return;let s=e.get(l.id),p=i.get(l.id)??[];return s?{id:s.id,name:s.name??s.displayName,categoryOptionCombos:p.map(n=>({id:n.id,name:n.name??n.displayName,categoryOptions:n.categoryOptions??[]})),categories:(s.categories??[]).map(n=>({id:n.id,name:n.name??n.displayName,categoryOptions:(n.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:l},r=l=>{let s=d.get(l.id);return s?{id:s.id,name:s.name??s.displayName,formName:s.formName,valueType:s.valueType,categoryCombo:o(s.categoryCombo)}:l};return{...a,categoryCombo:o(a.categoryCombo)??a.categoryCombo,dataSetElements:(a.dataSetElements??[]).map(l=>({...l,dataElement:l.dataElement?r(l.dataElement):void 0})),sections:(a.sections??[]).map(l=>({...l,dataElements:(l.dataElements??[]).map(s=>r(s))}))}}function Ee(a){let t={};for(let l of a.dataSetElements??[])l.dataElement&&(t[l.dataElement.id]=l.dataElement);let d={};for(let l of a.indicators??[])d[l.id]=l;let e=(a.sections??[]).slice().sort((l,s)=>(l.sortOrder??0)-(s.sortOrder??0));if(!e.some(l=>(l.dataElements?.length??0)>0)){let l=(a.dataSetElements??[]).map(s=>s.dataElement).filter(s=>!!s);e=[{id:a.id,name:a.displayName??a.name??"Data entry",sortOrder:0,dataElements:l,indicators:[],greyedFields:[]}]}let o=l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),r=[];for(let l of e){let s=new Set;for(let n of l.greyedFields??[])n.dataElement?.id&&n.categoryOptionCombo?.id&&s.add(`${n.dataElement.id}:${n.categoryOptionCombo.id}`);r.push(`<h3 class="formSection">${o(l.name??"")}</h3>`);let p=new Map;for(let n of l.dataElements??[]){let c=t[n.id];if(!c?.categoryCombo)continue;let m=c.categoryCombo.id,b=p.get(m);b||(b={cc:c.categoryCombo,des:[]},p.set(m,b)),b.des.push(c)}for(let n of p.values()){let c=n.cc.categoryOptionCombos??[],m=n.cc.categories??[];r.push('<div class="der-de-table-scroll">'),r.push('<table class="sectionTable" cellspacing="0">');let b=nt(m,c),h=c.length>=2;if(r.push("<thead>"),b.length>0)for(let x=0;x<b.length;x++){r.push("<tr>"),x===0&&r.push(`<th class="dataElementCell" rowspan="${b.length}">Data elements</th>`);for(let y of b[x]??[])r.push(`<th colspan="${y.span}">${o(y.label)}</th>`);x===0&&h&&r.push(`<th class="der-de-row-total-cell" rowspan="${b.length}">Total</th>`),r.push("</tr>")}else{r.push("<tr>"),r.push('<th class="dataElementCell">Data elements</th>');for(let x of c)r.push(`<th>${o(x.name??"")}</th>`);h&&r.push('<th class="der-de-row-total-cell">Total</th>'),r.push("</tr>")}r.push("</thead><tbody>");for(let x of n.des){r.push("<tr>"),r.push(`<td class="dataElementCell" id="${o(x.id)}-cell">`+o(x.formName??x.name??x.id)+"</td>");for(let y of c){let N=`${x.id}-${y.id}-val`;s.has(`${x.id}:${y.id}`)?r.push('<td class="greyed">\u2014</td>'):r.push(`<td><input type="text" id="${o(N)}" name="${o(N)}" dataelementid="${o(x.id)}" optioncomboid="${o(y.id)}"></td>`)}h&&r.push(`<td class="der-de-row-total-cell" data-de-row-total="${o(x.id)}">\u2014</td>`),r.push("</tr>")}for(let x of l.indicators??[]){let y=d[x.id];if(!y)continue;let N=h?c.length+1:c.length;r.push('<tr class="indicatorRow">'),r.push(`<td class="dataElementCell">${o(y.name??y.id)}</td>`),r.push(`<td colspan="${N}"><input type="text" name="indicator" indicatorid="${o(y.id)}" readonly></td>`),r.push("</tr>")}r.push("</tbody></table></div>")}}return r.join(`
`)}function nt(a,t){if(a.length===0||t.length===0)return[];let d=new Map;for(let r of a)for(let l of r.categoryOptions??[])d.set(l.id,{catId:r.id,name:l.name??l.id});let e=a.length,i=t.map(r=>{let l=new Array(e).fill("");for(let s of r.categoryOptions??[]){let p=d.get(s.id);if(!p)continue;let n=a.findIndex(c=>c.id===p.catId);n>=0&&(l[n]=p.name)}return l});for(let r of i)if(r.some(l=>l===""))return[];let o=[];for(let r=0;r<e;r++){let l=[];for(let s=0;s<i.length;){let p=i[s],n=s+1;for(;n<i.length;){let c=i[n],m=!0;for(let b=0;b<=r;b++)if(p[b]!==c[b]){m=!1;break}if(!m)break;n++}l.push({label:p[r]??"",span:n-s}),s=n}o.push(l)}return o}function it(a){let t=globalThis;t.dhis2=t.dhis2??{};let d=t.dhis2;d.de=d.de??{};let e=d.de;e.currentDataSetId=a.dataSetId,e.currentOrganisationUnitId=a.orgUnitId,e.currentPeriodId=a.periodId,e.currentCategorySelections={...a.aocSelections??{}};let i=a.meta??{},o={},r={};if(i.categoryCombo){r[i.categoryCombo.id]=i.categoryCombo;for(let c of i.categoryCombo.categories??[])o[c.id]=c}e.categories=o,e.categoryCombos=r;let l={},s={};for(let c of i.dataSetElements??[]){let m=c.dataElement;m&&(l[m.id]=m,m.optionSet&&(s[m.optionSet.id]=m.optionSet),m.categoryCombo&&(r[m.categoryCombo.id]=m.categoryCombo))}e.dataElements=l,e.optionSets=s;let p={};for(let c of i.indicators??[])p[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};e.indicatorFormulas=p;let n={};for(let c of a.validationRules??[])n[c.id]=c;e.validationRules=n,e.lockExceptions=[],e.emptyOrganisationUnits=[],e.significantZeros=[],e.dataSets={[i.id]:{id:i.id,name:i.name??i.displayName??"",periodType:i.periodType,categoryCombo:i.categoryCombo?.id,periodId:a.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function st(){let a=globalThis;if(a.$&&typeof a.$.ajaxSetup=="function"&&a.$.ajaxSetup({beforeSend:(t,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),a.dhis2?.period&&a.$?.calendars?.instance){let t=a.dhis2.period;t.format="yyyy-mm-dd",t.calendar=a.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function dt(a,t){if(!a)return;for(let[e,i]of Object.entries(t)){let o=a.querySelector(`input[data-der-category="${e}"]`);o||(o=document.createElement("input"),o.type="hidden",o.id=`category-${e}`,o.setAttribute("data-der-category",e),a.appendChild(o)),o.value=i}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...t})}function lt(a,t,d,e,i,o,r){let l=c=>{let m=/^(.+)-(.+)-val$/.exec(c);return m?{de:m[1],coc:m[2]}:null},s=new WeakMap,p=a.querySelectorAll('input[name$="-val"]');for(let c of Array.from(p))s.set(c,c.value);let n=async c=>{let m=c.target;if(!m||m.tagName!=="INPUT")return;let b=m.getAttribute("name")??"",h=l(b);if(!h)return;let x=t(),y=d(),N=e();if(!x||!y||!N)return;let k=m.value;if(s.get(m)===k)return;let D=m.getAttribute("data-valuetype")??"TEXT";if(k!==""&&ue(k,D)){G(m,"error");return}G(m,"saving");try{let T=await o.submitAggregate({dataSet:x,period:y,orgUnit:N,attributeOptionComboSelections:i(),dataValues:[{dataElement:h.de,categoryOptionCombo:h.coc,value:k}]});s.set(m,k);let R=T?.status==="OFFLINE_QUEUED"?"queued":"saved";G(m,R),m.removeAttribute("data-dirty"),r?.(R)}catch{G(m,"error")}};a.addEventListener("blur",c=>{n(c)},!0),a.addEventListener("input",c=>{let m=c.target;!m||m.tagName!=="INPUT"||/-val$/.test(m.getAttribute("name")??"")&&(m.value!==s.get(m)?m.setAttribute("data-dirty","1"):m.removeAttribute("data-dirty"))},!0)}function ct(a){let t=(e,i)=>{let o=e.getAttribute("name")??"",r=/^(.+)-(.+)-val$/.exec(o);if(!r)return;let l=r[2],s=Array.from(a.querySelectorAll(`input[name$="-${l}-val"]`)),p=s.indexOf(e);if(p===-1)return;let n=s[p+i];n&&(n.focus(),n.select())},d=(e,i)=>{let o=e.closest("tr");if(!o)return;let r=Array.from(o.querySelectorAll('input[name$="-val"]')),l=r.indexOf(e);if(l===-1)return;let s=r[l+i];s&&(s.focus(),s.select())};a.addEventListener("keydown",e=>{let i=e,o=i.target;if(o instanceof HTMLInputElement&&/-val$/.test(o.getAttribute("name")??"")&&!(i.metaKey||i.ctrlKey||i.altKey)){if(i.key==="Enter"){i.preventDefault(),t(o,i.shiftKey?-1:1);return}if(i.key==="ArrowUp"||i.key==="ArrowDown"){i.preventDefault(),t(o,i.key==="ArrowUp"?-1:1);return}if(i.key==="ArrowLeft"||i.key==="ArrowRight"){let r=o.selectionStart===0&&o.selectionEnd===0,l=o.selectionStart===o.value.length&&o.selectionEnd===o.value.length;i.key==="ArrowLeft"&&r?(i.preventDefault(),d(o,-1)):i.key==="ArrowRight"&&l&&(i.preventDefault(),d(o,1))}}})}function ut(a){let t=Array.from(a.querySelectorAll("h2, h3, h4")).filter(o=>(o.textContent??"").trim().length>0);if(t.length<2)return[];let d=new Set(t),e=[],i=(o,r)=>{for(let l of d)if(l!==r&&o.contains(l))return!0;return!1};return t.forEach((o,r)=>{let l=o.id||`der-de-section-${r}`;o.id=l;let s=null,p=o.parentElement,n=null;for(;p&&p!==a&&!i(p,o);)n=p,p=p.parentElement;if(n&&n.children.length>1&&n!==a)s=n,s.classList.add("der-de-section-slot"),s.dataset.sectionId=l;else{s=document.createElement("div"),s.className="der-de-section-slot",s.dataset.sectionId=l;let c=t[r+1]??null,m=[],b=o;for(;b&&b!==c;){let h=b.nextSibling;m.push(b),b=h}o.parentNode?.insertBefore(s,o);for(let h of m)s.appendChild(h)}e.push({id:l,label:(o.textContent??"").trim(),slot:s})}),e}function pt({targetRef:a,formVersion:t}){let[d,e]=S([]),[i,o]=S(""),[r,l]=S({});return A(()=>{let s=a.current;if(!s)return;let p=ut(s);e(p),o(p[0]?.id??"")},[a,t]),A(()=>{if(d.length===0)return;let s=p=>{if(!p.altKey||p.metaKey||p.ctrlKey||p.shiftKey)return;let n=/^Digit([1-9])$/.exec(p.code);if(!n)return;let c=Number(n[1]),m=d[c-1];m&&(p.preventDefault(),o(m.id))};return window.addEventListener("keydown",s),()=>window.removeEventListener("keydown",s)},[d]),A(()=>{if(d.length===0)return;let s=()=>{let c={};for(let m of d){let b=Array.from(m.slot.querySelectorAll('input[name$="-val"]')),h=b.filter(x=>x.value.trim()!=="").length;c[m.id]={filled:h,total:b.length}}l(c)};s();let p=a.current;if(!p)return;let n=c=>{let m=c.target;m&&m.tagName==="INPUT"&&/-val$/.test(m.getAttribute("name")??"")&&s()};return p.addEventListener("input",n,!0),()=>{p.removeEventListener("input",n,!0)}},[a,d]),A(()=>{if(!a.current||d.length===0)return;for(let n of d)n.slot.style.display=n.id===i?"":"none";let p=d.find(n=>n.id===i);p&&p.slot.scrollIntoView({behavior:"smooth",block:"start"})},[a,d,i]),d.length<2?null:v("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[u("div",{className:"der-de-section-nav__title",children:"Sections"}),u("ul",{className:"der-de-section-nav__list",children:d.map(s=>{let p=r[s.id],n=!p||p.total===0||p.filled===0?"muted":p.filled===p.total?"done":"partial";return u("li",{children:v("button",{type:"button",className:"der-de-section-nav__item"+(i===s.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>o(s.id),children:[u("span",{className:"der-de-section-nav__label",children:s.label}),p&&p.total>0&&u("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${n}`,"data-test":"de-section-nav-ratio",title:`${p.filled} of ${p.total} cells filled`,children:n==="done"?"\u2713":`${p.filled}/${p.total}`})]})},s.id)})})]})}function mt({root:a,formVersion:t}){let[d,e]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(A(()=>{let r=()=>{let s=a.current;if(!s)return;let p=Array.from(s.querySelectorAll('input[name$="-val"]')),n=0,c=0,m=0,b=0,h=0;for(let x of p){x.value.trim()!==""&&n++;let y=x.style.outline||"";y.includes("rgb(185, 134, 10)")||y.includes("#b9860a")?c++:y.includes("rgb(206, 123, 0)")||y.includes("#ce7b00")?b++:y.includes("rgb(26, 135, 84)")||y.includes("#1a8754")||y.includes("rgb(183, 220, 199)")||y.includes("#b7dcc7")?m++:(y.includes("rgb(169, 50, 50)")||y.includes("#a93232"))&&h++}e({total:p.length,filled:n,saving:c,saved:m,queued:b,error:h})};r();let l=window.setInterval(r,800);return()=>window.clearInterval(l)},[a,t]),d.total===0)return u("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let i=[];i.push(`${d.filled} of ${d.total} filled`),d.saving>0&&i.push(`${d.saving} saving`),d.queued>0&&i.push(`${d.queued} queued`),d.error>0&&i.push(`${d.error} error`);let o=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return u("span",{className:`der-de-savepill der-de-savepill--${o}`,"data-test":"de-save-state",children:i.join(" \xB7 ")})}function ft({details:a,formSync:t,onClear:d}){let e={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},i={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return u("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:u("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:a?v(W,{children:[u("span",{className:"der-de-live-strip__de",children:a.deName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__coc",children:a.cocName}),a.value&&v(W,{children:[u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__value",children:a.value}),u("button",{type:"button",className:"der-de-live-strip__clear","data-test":"de-live-clear","aria-label":"Clear value",title:"Clear this cell",onMouseDown:o=>{o.preventDefault()},onClick:()=>d(a.inputName),children:"\xD7"}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:`der-de-live-strip__state der-de-live-strip__state--${i[a.saveState]}`,children:e[a.saveState]}),(a.lastUpdated||a.lastUpdatedBy)&&v(W,{children:[u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),v("span",{className:"der-de-live-strip__audit","data-test":"de-live-audit",title:a.lastUpdated?new Date(a.lastUpdated).toLocaleString():void 0,children:[a.lastUpdated?It(a.lastUpdated):"earlier",a.lastUpdatedBy&&v(W,{children:[" by ",u("strong",{children:a.lastUpdatedBy})]})]})]})]}),u(gt,{formSync:t,cellState:a.saveState}),a.compulsory&&u("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):u("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function gt({formSync:a,cellState:t}){let d=t==="saved"||t==="queued",e=t==="saved"||t==="queued"?"lit":t==="saving"?"pending":t==="error"?"error":"muted",i=a.central,o=d?i==="CENTRAL_ACCEPTED"?"lit":i==="PENDING"||i==="IN_FLIGHT"||i==="RETRYABLE"||i==="UNKNOWN_OUTCOME"?"pending":i==="CENTRAL_REJECTED"||i==="CONFLICT_REVIEW"||i==="QUARANTINED"||i==="REQUIRES_APPROVAL"?"error":"muted":"muted",r=e==="lit"?"Saved on edge (DER)":e==="pending"?"Saving on edge\u2026":e==="error"?"Rejected by edge":"No value entered yet",l=o==="lit"?"Synced to Central DHIS2":o==="pending"?`Sync in progress (${i})`:o==="error"?`Central reported ${i}`:d?"Awaiting Central sync":"No value entered yet";return v("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+e,title:r,"data-test":"de-sync-der","data-state":e,children:[u(bt,{}),u("span",{className:"der-de-sync-logos__dot is-"+e,"aria-hidden":"true"})]}),v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+o,title:l,"data-test":"de-sync-central","data-state":o,children:[u(yt,{}),u("span",{className:"der-de-sync-logos__dot is-"+o,"aria-hidden":"true"})]})]})}function bt(){return u("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",fillRule:"evenodd",children:[u("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),u("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),u("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),u("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),u("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),u("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),u("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),u("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),u("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),u("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),u("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),u("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),u("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function yt(){return u("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",children:[u("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),u("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),u("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function ht({open:a,issues:t,totalCells:d,onClose:e,onPick:i}){if(A(()=>{if(!a)return;let r=l=>{l.key==="Escape"&&e()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[a,e]),!a)return null;let o=t.length===0;return u("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:r=>{r.target===r.currentTarget&&e()},children:v("div",{className:"der-de-validation "+(o?"der-de-validation--ok":"der-de-validation--err"),children:[v("header",{className:"der-de-validation__head",children:[v("div",{className:"der-de-validation__title",children:[u("span",{className:"der-de-validation__badge","aria-hidden":"true",children:o?"\u2713":"!"}),u("h3",{className:"der-de-validation__heading",children:o?`Validation passed \u2014 all ${d} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${d} cells.`})]}),u("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:e,children:"\xD7"})]}),u("div",{className:"der-de-validation__body",children:o?v("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",u("strong",{children:" Mark complete"})," when you're ready."]}):v("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[u("thead",{children:v("tr",{children:[u("th",{scope:"col",children:"Data element"}),u("th",{scope:"col",children:"Category option combo"}),u("th",{scope:"col",children:"Entered value"}),u("th",{scope:"col",children:"Problem"}),u("th",{scope:"col"})]})}),u("tbody",{children:t.map(r=>v("tr",{"data-test":"de-issues-row",children:[u("td",{children:r.deName}),u("td",{className:"der-de-validation__coc",children:r.cocName}),u("td",{children:u("code",{className:"der-de-validation__value",children:r.value||"\u2014"})}),u("td",{className:"der-de-validation__why",children:r.problem}),u("td",{className:"der-de-validation__jump",children:u("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>i(r),children:"Jump to cell \u2192"})})]},`${r.deId}-${r.cocId}`))})]})})]})})}function vt({open:a,onClose:t}){return A(()=>{if(!a)return;let e=i=>{i.key==="Escape"&&t()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[a,t]),a?u("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:e=>{e.target===e.currentTarget&&t()},children:v("div",{className:"der-de-shortcuts",children:[v("header",{className:"der-de-shortcuts__head",children:[u("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),u("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),u("dl",{className:"der-de-shortcuts__list",children:[["Enter / \u2193","Next row (same COC column)"],["Shift + Enter / \u2191","Previous row"],["\u2190 / \u2192","Previous / next COC column (same row)"],["Tab / Shift + Tab","Next / previous cell (DOM order)"],["Alt + 1..9","Jump to section N"],["Alt + S","Save all unsaved cells"],["Alt + V","Run validation"],["Alt + C","Toggle Complete marker"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([e,i])=>v("div",{className:"der-de-shortcuts__row",children:[u("dt",{children:u("kbd",{children:e})}),u("dd",{children:i})]},e))})]})}):null}function xt({open:a,onClose:t,formInfo:d,summary:e}){if(A(()=>{if(!a)return;let r=l=>{l.key==="Escape"&&t()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[a,t]),!a||!d||!e)return null;let i=d.openFuturePeriods??0,o=[["Period type",d.periodType??"\u2014"],["Form type",d.formType??"\u2014"],["Open future periods",String(i)+(i===0?" (current period closed)":"")],["Sections",String(e.sectionCount)],["Data elements",String(e.dataElementCount)],["Compulsory cells",String(e.compulsoryCount)],["Indicators",String(e.indicatorCount)],["Validation rules",String(e.validationRuleCount)]];return u("div",{className:"der-de-shortcuts-backdrop der-de-info-backdrop",role:"dialog","aria-modal":"true","aria-label":"Dataset info","data-test":"de-info-popover",onClick:r=>{r.target===r.currentTarget&&t()},children:v("div",{className:"der-de-info-modal",children:[v("header",{className:"der-de-info-modal__head",children:[v("div",{className:"der-de-info-modal__title-wrap",children:[u("span",{className:"der-de-info-modal__eyebrow",children:"Dataset"}),u("h2",{className:"der-de-info-modal__title","data-test":"de-info-title",children:d.displayName??"Dataset info"})]}),u("button",{type:"button",className:"der-de-info-modal__close","aria-label":"Close dataset info","data-test":"de-info-close",onClick:t,children:"\xD7"})]}),v("div",{className:"der-de-info-modal__body",children:[e.description&&u("p",{className:"der-de-info-modal__desc","data-test":"de-info-desc",children:e.description}),u("dl",{className:"der-de-info-modal__stats",children:o.map(([r,l])=>v("div",{className:"der-de-info-modal__stat",children:[u("dt",{children:r}),u("dd",{"data-test":`de-info-${r.toLowerCase().replace(/\s+/g,"-")}`,children:l})]},r))})]}),u("footer",{className:"der-de-info-modal__foot",children:u("button",{type:"button",className:"der-de-info-modal__done","data-test":"de-info-done",onClick:t,children:"Done"})})]})})}function _t(a,t){a.addEventListener("paste",d=>{let e=d.target;if(!e||e.tagName!=="INPUT")return;let i=e.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(i))return;let r=d.clipboardData?.getData("text/plain")??"",l=/\r?\n/.test(r),s=/\t/.test(r);if(!l&&!s)return;let p=r.split(/\r?\n/).filter((k,D,T)=>!(D===T.length-1&&k==="")).map(k=>k.split("	").map(D=>D.trim()));if(p.length===0)return;d.preventDefault();let n=e.closest("[data-section-id]")??a,m=Array.from(n.querySelectorAll("tbody tr")).map(k=>Array.from(k.querySelectorAll('input[name$="-val"]'))),b=-1,h=-1;for(let k=0;k<m.length;k++){let D=m[k].indexOf(e);if(D!==-1){b=k,h=D;break}}if(b===-1)return;let x=0,y=0;for(let k=0;k<p.length;k++){let D=p[k],T=m[b+k];if(!T){y+=D.length;continue}for(let R=0;R<D.length;R++){let j=T[h+R];if(!j){y++;continue}j.value=D[R]??"",j.dispatchEvent(new Event("input",{bubbles:!0})),j.dispatchEvent(new Event("blur",{bubbles:!0})),x++}}let N=p.length===1?`${p[0].length}-cell row`:p[0]?.length===1?`${p.length}-cell column`:`${p.length}\xD7${p[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${x} value${x===1?"":"s"} (${N}${y>0?`, ${y} overflow`:""}).`})},!0)}function wt(a){let t=Array.from(a.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let d=[];for(let e of t){let i=e.getAttribute("dataelementid")??"";if(!i)continue;let o=e.closest("div"),l=(()=>{let n=o??e.parentElement;if(!n)return null;let c=n.previousElementSibling;for(;c;){if(/^(H1|H2|H3|H4)$/.test(c.tagName)||c.tagName==="DIV"&&!c.querySelector("table, input")&&(c.textContent??"").trim().length>0)return c;c=c.previousElementSibling}let m=n.closest("[data-section-id]");if(m){let b=m.querySelector("h2, h3, h4");if(b)return b}return null})();if(!l)continue;o?.remove();let s=document.createElement("span");s.className="der-de-matrix-total",s.setAttribute("data-de",i),l.appendChild(s);let p=()=>{let n=0,c=!1,m=Array.from(a.querySelectorAll(`input[dataelementid="${i}"][name$="-val"],input[name^="${i}-"][name$="-val"]`)),b=new Set;for(let h of m){if(b.has(h))continue;b.add(h);let x=parseFloat(h.value);Number.isFinite(x)&&(n+=x,c=!0)}if(c){let h=Number.isInteger(n)?n:Number(n.toFixed(2));s.textContent=` (Total: ${h})`}else s.textContent=""};d.push(p),p()}d.length!==0&&a.addEventListener("input",e=>{let i=e.target;if(!(!i||i.tagName!=="INPUT")&&/-val$/.test(i.getAttribute("name")??""))for(let o of d)o()},!0)}function kt(a){let t=Array.from(a.querySelectorAll("td.der-de-row-total-cell[data-de-row-total]"));if(t.length===0)return;let d=e=>{let i=e.closest("tr");if(!i)return;let o=0,r=!1;for(let l of Array.from(i.querySelectorAll('input[name$="-val"]'))){let s=l.value.trim();if(s==="")continue;let p=Number(s);Number.isFinite(p)&&(o+=p,r=!0)}if(!r){e.textContent="\u2014";return}e.textContent=Number.isInteger(o)?String(o):o.toFixed(2)};for(let e of t)d(e);a.addEventListener("input",e=>{let i=e.target;if(!i||i.tagName!=="INPUT"||!/-val$/.test(i.getAttribute("name")??""))return;let r=i.closest("tr")?.querySelector("td.der-de-row-total-cell[data-de-row-total]");r&&d(r)},!0)}function Et(a,t){let d=t.indicators??[];if(d.length===0)return;let e=d.filter(n=>n.numerator&&n.denominator).map(n=>({id:n.id,factor:n.indicatorType?.factor??1,numExpr:n.numerator,denExpr:n.denominator}));if(e.length===0)return;let i=Array.from(a.querySelectorAll("input[indicatorid]")),o=new Map;for(let n of Array.from(a.querySelectorAll('input[name$="-val"]')))o.set(n.getAttribute("name")??"",n);let r=n=>{let c=0;for(let[m,b]of o){if(!m.startsWith(`${n}-`))continue;let h=parseFloat(b.value);Number.isFinite(h)&&(c+=h)}return c},l=n=>n.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,m,b)=>{if(b){let h=o.get(`${m}-${b}-val`),x=parseFloat(h?.value??"");return Number.isFinite(x)?String(x):"0"}return String(r(m))}),s=n=>{if(!/^[\s\d+\-*/().eE]+$/.test(n))return NaN;try{return Function(`"use strict";return (${n})`)()}catch{return NaN}},p=()=>{for(let n of e){let c=s(l(n.numExpr)),m=s(l(n.denExpr)),b=i.find(x=>x.getAttribute("indicatorid")===n.id);if(!b)continue;if(!Number.isFinite(c)||!Number.isFinite(m)||m===0){b.value="";continue}let h=c/m*n.factor;b.value=Number.isInteger(h)?String(h):h.toFixed(2)}};a.addEventListener("input",n=>{let c=n.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&p()},!0),p()}function Nt(a,t){let d={};for(let e of t.dataSetElements??[])e.dataElement&&(d[e.dataElement.id]=e.dataElement);for(let e of Array.from(a.querySelectorAll('input[name$="-val"]'))){let i=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!i)continue;let o=d[i[1]],r=o?.formName??o?.name??i[1],l=o?.categoryCombo?.categoryOptionCombos?.find(p=>p.id===i[2]),s=l?.name??l?.displayName??i[2];e.hasAttribute("aria-label")||e.setAttribute("aria-label",s===i[2]?`${r}`:`${r}, ${s}`),e.getAttribute("data-compulsory")==="1"&&e.setAttribute("aria-required","true")}}function St(a,t){let d={};for(let e of t.dataSetElements??[])e.dataElement&&(d[e.dataElement.id]=e.dataElement);for(let e of Array.from(a.querySelectorAll('input[name$="-val"]'))){let i=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!i)continue;let o=d[i[1]]?.valueType??"TEXT";switch(e.setAttribute("data-valuetype",o),o){case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":e.setAttribute("inputmode","numeric"),e.setAttribute("pattern","-?\\d*");break;case"NUMBER":case"UNIT_INTERVAL":case"PERCENTAGE":e.setAttribute("inputmode","decimal"),e.setAttribute("pattern","-?\\d*(\\.\\d+)?");break;case"EMAIL":e.setAttribute("inputmode","email"),e.setAttribute("type","email");break;case"PHONE_NUMBER":e.setAttribute("inputmode","tel"),e.setAttribute("type","tel");break;case"URL":e.setAttribute("inputmode","url"),e.setAttribute("type","url");break;case"DATE":e.setAttribute("type","date");break;case"TIME":e.setAttribute("type","time");break;case"DATETIME":e.setAttribute("type","datetime-local");break;default:break}}}function Ct(a){let t=d=>{let e=d.value;if(e===""){d.removeAttribute("data-de-invalid"),d.removeAttribute("title");return}let i=d.getAttribute("data-valuetype")??"TEXT",o=ue(e,i);o?(d.setAttribute("data-de-invalid","1"),d.setAttribute("title",o)):(d.removeAttribute("data-de-invalid"),d.removeAttribute("title"))};a.addEventListener("input",d=>{let e=d.target;!e||e.tagName!=="INPUT"||/-val$/.test(e.getAttribute("name")??"")&&t(e)},!0);for(let d of Array.from(a.querySelectorAll('input[name$="-val"]')))t(d)}function Tt(a,t){let d=t.compulsoryDataElementOperands??[],e=new Set;for(let i of d){let o=i.dimensionItem;if(!o)continue;let r=o.split(".");r.length===2&&e.add(`${r[0]}:${r[1]}`)}if(e.size!==0)for(let i of Array.from(a.querySelectorAll('input[name$="-val"]'))){let o=/^(.+)-(.+)-val$/.exec(i.getAttribute("name")??"");o&&e.has(`${o[1]}:${o[2]}`)&&i.setAttribute("data-compulsory","1")}}function At(a,t,d){let e={};for(let o of t.dataSetElements??[])o.dataElement&&(e[o.dataElement.id]=o.dataElement);let i=o=>{let r=o.getAttribute("name")??o.id??"",l=/^(.+)-(.+)-val$/.exec(r);if(!l)return null;let s=l[1],p=l[2],n=e[s],c=n?.categoryCombo,m=c?.categoryOptionCombos?.find(D=>D.id===p),b=[],h=m?.name??m?.displayName??p,x=h.split(/,\s*/).filter(Boolean),y=c?.categories??[];x.forEach((D,T)=>{b.push({category:y[T]?.name??y[T]?.displayName??"",option:D})});let N=o.style.outline||"",k=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":o.value.trim()===""?"empty":"saved";return{deId:s,cocId:p,deName:n?.name??s,deFormName:n?.formName,valueType:n?.valueType??"TEXT",optionSetId:n?.optionSet?.id,cocName:h,categoryBreakdown:b,value:o.value,saveState:k,inputName:r,compulsory:o.getAttribute("data-compulsory")==="1",lastUpdated:o.getAttribute("data-updated")??void 0,lastUpdatedBy:o.getAttribute("data-updated-by")??void 0}};a.addEventListener("focusin",o=>{let r=o.target;if(r&&r.tagName==="INPUT"){let l=i(r);l&&d(l)}},!0),a.addEventListener("input",o=>{let r=o.target;if(r&&r.tagName==="INPUT"){let l=i(r);l&&d(l)}},!0)}function Dt(a,t,d){if(!a)return;let e=globalThis,i=e.dhis2?.de?.dataElements??{},o=e.dhis2?.de?.categoryOptionCombos??{},r=Array.from(a.querySelectorAll('input[name$="-val"]')),l=[];for(let s of r){s.style.outline="";let p=/^(.+)-(.+)-val$/.exec(s.getAttribute("name")??"");if(!p)continue;let n=p[1],c=p[2],m=i[n],b=m?.valueType??"TEXT",h=s.value.trim();if(h===""){s.getAttribute("data-compulsory")==="1"&&(s.style.outline="2px solid #c0392b",l.push({deId:n,cocId:c,valueType:b,value:"",problem:"compulsory value missing",deName:m?.name??n,cocName:o[c]?.name??c,inputName:s.name}));continue}let x=ue(h,b);x&&(s.style.outline="2px solid #c0392b",l.push({deId:n,cocId:c,valueType:b,value:h,problem:x,deName:m?.name??n,cocName:o[c]?.name??c,inputName:s.name}))}d(l,r.length),t({kind:"idle"})}function ue(a,t){let d=Number(a),e=Number.isInteger(d);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(t){case"INTEGER":if(!e)return"must be an integer";break;case"INTEGER_POSITIVE":if(!e||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!e||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!e||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(a.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(a.toLowerCase()))return"must be yes";break;case"URL":try{new URL(a)}catch{return"must be a valid URL"}break;default:break}return null}function G(a,t){let d=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";a.style.outline=`2px solid ${d}`,a.style.transition="outline 150ms",t==="queued"?a.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):a.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{a.style.outline.includes("#1a8754")&&(a.style.outline="1px solid #b7dcc7")},1200)}async function $t(a,t,d,e,i){if(!t||!d||!e)return;let o;try{o=(await i.readAggregateValues(e,d,2e3)).dataValues??[]}catch{return}for(let r of o){let l=r.dataElement,s=r.categoryOptionCombo,p=r.value;if(!l||!s||p==null)continue;let n=a.querySelector(`input[name="${l}-${s}-val"]`);n&&(n.value=p,r.lastUpdated&&n.setAttribute("data-updated",r.lastUpdated),r.storedByUsername&&n.setAttribute("data-updated-by",r.storedByUsername))}}function It(a){let t=Date.parse(a);if(!Number.isFinite(t))return a;let d=Date.now()-t;if(d<0)return new Date(t).toLocaleString();let e=Math.floor(d/6e4);if(e<1)return"just now";if(e<60)return`${e} min ago`;let i=Math.floor(e/60);if(i<24)return`${i} h ago`;let o=Math.floor(i/24);return o<30?`${o} d ago`:new Date(t).toLocaleDateString()}function Ae(a){return new Promise((t,d)=>{let e=document.createElement("script");e.src=a,e.async=!1,e.setAttribute("data-der-custom-form",a),e.onload=()=>t(),e.onerror=()=>d(new Error(`failed to load ${a}`)),document.head.appendChild(e)})}function De(a){if(document.querySelector(`link[data-der-custom-form="${a}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=a,t.setAttribute("data-der-custom-form",a),document.head.appendChild(t)}function Ne(a){return!a||/^https?:\/\//i.test(a)||a.startsWith("/legacy-custom-forms/")||a.startsWith("/")?a:`/legacy-custom-forms/${a.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Lt(a,t,d={}){let e=d.stripStyles??!0;a.classList.toggle("der-de-custom-form--author",!e);let i=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let r of Array.from(i.querySelectorAll('link[rel="stylesheet"],style'))){if(r.tagName==="LINK"){let l=r.getAttribute("href")??"";l&&De(Ne(l))}else{let l=document.createElement("style");l.textContent=r.textContent??"",l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l)}r.remove()}let o=[];for(let r of Array.from(i.querySelectorAll("script"))){let l=r.getAttribute("src");l?o.push({src:Ne(l)}):o.push({code:r.textContent??""}),r.remove()}for(let r of Array.from(i.body.querySelectorAll("*"))){if(e&&r.removeAttribute("style"),r.tagName==="INPUT"){let l=r.getAttribute("id")??"";l.endsWith("-val")&&r.getAttribute("name")!==l&&r.setAttribute("name",l)}if(e&&r.tagName==="TH"){let l=(r.textContent??"").trim();(l==="Reporting item"||l==="Reported count")&&(r.textContent=l==="Reporting item"?"Data elements":"Value")}}for(let r of Array.from(i.body.childNodes))a.appendChild(document.adoptNode(r));for(let r of o)if(r.src)document.querySelector(`script[data-der-custom-form="${r.src}"]`)||await Ae(r.src);else if(r.code){let l=document.createElement("script");l.textContent=r.code,l.setAttribute("data-der-custom-form","inline"),document.head.appendChild(l),l.remove()}}var ce={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},Se={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},Ce={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},Mt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},Rt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function Ot(a,t,d,e=new Set,i=new Set,o=0){let r=(y,N)=>e.has(y)?`\u2713  ${N}`:i.has(y)?`\u25CF  ${N}`:N,l={...ce},s=$e(a,o);if(s.length===0)return u("input",{value:t,onChange:y=>d(y.target.value),placeholder:a?`DHIS2 ${a} period id`:"e.g. 202611",style:l});let p=[...s];if(t&&!p.some(y=>y.id===t)){let y=jt(a,t)??t;p.unshift({id:t,label:y})}let n=s[0]?.id??null,c=p.findIndex(y=>y.id===t),m=c===-1||c<p.length-1||!!a,b=t!==""&&(c>0||t!==n),h=()=>{if(!a)return;let y=c>=0&&c<p.length-1?p[c+1]?.id??"":Te(a,t||n||"",-1);y&&d(y)},x=()=>{if(!a||!t||t===n)return;let y=c>0?p[c-1]?.id??"":Te(a,t,1);y&&d(y)};return v("span",{className:"der-de-period-nav",children:[u("button",{type:"button","aria-label":"Previous period",onClick:h,disabled:!m,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:t,onChange:y=>d(y.target.value),style:l,children:[u("option",{value:"",children:"Select a period\u2026"}),p.map(y=>u("option",{value:y.id,children:r(y.id,y.label)},y.id))]}),u("button",{type:"button","aria-label":"Next period",onClick:x,disabled:!b,className:"der-de-period-btn",children:"\u25B6"})]})}function Te(a,t,d){let e=i=>String(i).padStart(2,"0");switch(a){case"Daily":{if(!/^\d{8}$/.test(t))return"";let i=Number(t.slice(0,4)),o=Number(t.slice(4,6))-1,r=Number(t.slice(6,8)),l=new Date(i,o,r+d);return`${l.getFullYear()}${e(l.getMonth()+1)}${e(l.getDate())}`}case"Weekly":{let i=/^(\d{4})W(\d{1,2})$/.exec(t);if(!i)return"";let o=Number(i[1]),r=Number(i[2])+d;return r<1?(o-=1,r=Z(o)):r>Z(o)&&(o+=1,r=1),`${o}W${r}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let i=Number(t.slice(0,4)),o=Number(t.slice(4,6))-1,r=i*12+o+d;return`${Math.floor(r/12)}${e((r%12+12)%12+1)}`}case"BiMonthly":{let i=/^(\d{4})(\d{2})B$/.exec(t);if(!i)return"";let o=Number(i[1]),r=Number(i[2])+d;return r<1?(o-=1,r=6):r>6&&(o+=1,r=1),`${o}${e(r)}B`}case"Quarterly":{let i=/^(\d{4})Q(\d)$/.exec(t);if(!i)return"";let o=Number(i[1]),r=Number(i[2])+d;return r<1?(o-=1,r=4):r>4&&(o+=1,r=1),`${o}Q${r}`}case"SixMonthly":{let i=/^(\d{4})S(\d)$/.exec(t);if(!i)return"";let o=Number(i[1]),r=Number(i[2])+d;return r<1?(o-=1,r=2):r>2&&(o+=1,r=1),`${o}S${r}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+d):"";default:return""}}function jt(a,t){let d=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(a){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(t);return e?`${e[1]} W${String(e[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let e=Number(t.slice(4,6))-1;return`${d[e]??""} ${t.slice(0,4)}`}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(t);if(!e)return null;let i=(Number(e[2])-1)*2;return`${d[i]}\u2013${d[i+1]} ${e[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(t);return e?`${e[1]} ${e[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function $e(a,t=0){let d=new Date,e=d.getFullYear(),i=d.getMonth(),o=s=>String(s).padStart(2,"0"),r=["January","February","March","April","May","June","July","August","September","October","November","December"],l=Math.max(0,1-Math.max(0,t));switch(a){case"Daily":{let s=[];for(let p=l;p<30+l;p++){let n=new Date(d);n.setDate(n.getDate()-p);let c=`${n.getFullYear()}${o(n.getMonth()+1)}${o(n.getDate())}`,m=`${n.getFullYear()}-${o(n.getMonth()+1)}-${o(n.getDate())}`;s.push({id:c,label:m})}return s}case"Weekly":{let s=[],p=Ie(d),n=p.year,c=p.week;for(let m=0;m<l;m++)c-=1,c<1&&(n-=1,c=Z(n));for(let m=0;m<12;m++)s.push({id:`${n}W${c}`,label:`${n} W${o(c)}`}),c-=1,c<1&&(n-=1,c=Z(n));return s}case"Monthly":{let s=[];for(let p=l;p<24+l;p++){let n=e,c=i,m=n*12+c-p,b=Math.floor(m/12),h=(m%12+12)%12;s.push({id:`${b}${o(h+1)}`,label:`${r[h]} ${b}`})}return s}case"BiMonthly":{let s=[],p=Math.floor(i/2)+1,n=e,c=p;for(let m=0;m<l;m++)c-=1,c<1&&(n-=1,c=6);for(let m=0;m<12;m++){let b=(c-1)*2;s.push({id:`${n}${o(c)}B`,label:`${r[b]}\u2013${r[b+1]} ${n}`}),c-=1,c<1&&(n-=1,c=6)}return s}case"Quarterly":{let s=[],p=Math.floor(i/3)+1,n=e,c=p;for(let m=0;m<l;m++)c-=1,c<1&&(n-=1,c=4);for(let m=0;m<8;m++)s.push({id:`${n}Q${c}`,label:`${n} Q${c}`}),c-=1,c<1&&(n-=1,c=4);return s}case"SixMonthly":{let s=[],p=i<6?1:2,n=e,c=p;for(let m=0;m<l;m++)c-=1,c<1&&(n-=1,c=2);for(let m=0;m<6;m++)s.push({id:`${n}S${c}`,label:`${n} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(n-=1,c=2);return s}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let s=[];for(let p=l;p<10+l;p++){let n=e-p;s.push({id:String(n),label:String(n)})}return s}default:return[]}}function Ie(a){let t=new Date(a.getFullYear(),a.getMonth(),a.getDate()),d=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-d);let e=new Date(t.getFullYear(),0,1),o=Math.round((t.getTime()-e.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((o+1)/7)}}function Z(a){return Ie(new Date(a,11,28)).week}var Ut=`
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
`;export{rt as default};
