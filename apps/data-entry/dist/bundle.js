/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as L,useRef as ie,useState as T}from"react";import{useAuth as ze,useOrgUnitBinding as Be,useOnlineStatus as Ve,useDerApi as Qe,ScreenCard as Ge}from"@der/app-sdk";import{Fragment as W,jsx as m,jsxs as v}from"react/jsx-runtime";function Je(){let r=ze(),t=Be(),s=Ve(),e=Qe(),[l,i]=T("custom"),[a,d]=T([]),[n,u]=T(""),[o,c]=T(""),[p,g]=T(""),[f,x]=T(""),[h,N]=T({kind:"idle"}),[_,C]=T(null),A=ie(null),[M,j]=T({}),z=ie({}),[Te,X]=T([]),[P,B]=T(null),[K,me]=T(!1),[Ce,ee]=T(new Set),[Ae,te]=T(new Set),[V,pe]=T(""),[Q,$e]=T(0),[G,Ie]=T([]),[ge,J]=T(!1),fe=ie(0),[De,Le]=T(null),[Re,re]=T({localSaved:!1,central:null}),[Me,je]=T(0),[Oe,ae]=T(!1);L(()=>{let b=y=>{if(y.key!=="?")return;let k=y.target;k&&(k.tagName==="INPUT"||k.tagName==="TEXTAREA")||(y.preventDefault(),ae(w=>!w))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[H,Ue]=T(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});L(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",H)}catch{}},[H]);let[F,Pe]=T(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});L(()=>{try{window.localStorage.setItem("der-de-density",F)}catch{}},[F]),L(()=>{let b=!1;return(async()=>{if(!t.bound||!t.orgUnitUid){d([]);return}try{let y=await e.listDataSets(t.orgUnitUid);if(b)return;let k=(y.dataSets??[]).map(w=>({id:w.id,label:w.displayName??w.name??w.id,periodType:w.periodType,formType:w.formType})).sort((w,E)=>w.label.localeCompare(E.label));d(k)}catch{}})(),()=>{b=!0}},[t.bound,t.orgUnitUid]),L(()=>{if(n.trim()===""){C(null),X([]),j({}),z.current={};return}let b=!1;return(async()=>{try{let y=await e.getDataSetMeta(n.trim());if(b)return;let k=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:k,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType,openFuturePeriods:y.openFuturePeriods??0}),i(k?"custom":"structured");try{let w=await e.getDataSetFormMetadata(n.trim());if(b)return;let E=await ye(w,e);if(b)return;let O=(E.categoryCombo?.categories??[]).filter(D=>(D.categoryOptions?.length??0)>1).map(D=>({id:D.id,name:D.name??D.id,options:(D.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));X(O);let U={};for(let D of O)D.options[0]&&(U[D.id]=D.options[0].id);j(U),z.current=U}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[n]),L(()=>{if(l!=="custom"||!_?.hasCustomForm||_.formType==="CUSTOM"&&!_.formId)return;let b=A.current;if(!b)return;let y=!1;return(async()=>{N({kind:"submitting"});try{let k=await e.getDataSetFormMetadata(n.trim());if(y)return;let w=await ye(k,e);if(y)return;let E="";if(_.formType==="CUSTOM"&&_.formId){try{E=(await e.getDataEntryFormHtml(_.formId)).htmlCode??""}catch(S){E="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",S)}E.trim()||(E=he(w))}else _.formType==="SECTION"&&(E=he(w));if(y)return;let O=await e.listValidationRules(n.trim()).catch(()=>({validationRules:[]}));if(y)return;let U=(w.categoryCombo?.categories??[]).filter(S=>(S.categoryOptions?.length??0)>1).map(S=>({id:S.id,name:S.name??S.id,options:(S.categoryOptions??[]).map(I=>({id:I.id,name:I.name??I.id}))}));X(U);let D={};for(let S of U)S.options[0]&&(D[S.id]=S.options[0].id);j(D),z.current=D,b.replaceChildren();for(let[S,I]of[["selectedDataSetId",n.trim()],["selectedPeriodId",o.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let R=document.createElement("input");R.type="hidden",R.id=S,R.value=I,b.appendChild(R)}for(let[S,I]of Object.entries(D)){let R=document.createElement("input");R.type="hidden",R.id=`category-${S}`,R.value=I,R.setAttribute("data-der-category",S),b.appendChild(R)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Xe({dataSetId:n.trim(),periodId:o.trim(),orgUnitId:t.orgUnitUid??"",meta:w,aocSelections:D,validationRules:O.validationRules??[]});for(let S of We)ke(S);for(let S of Ze)document.querySelector(`script[data-der-custom-form="${S}"]`)||await Ee(S);Ke(),await Et($,E,{stripStyles:H==="der"}),await _t($,n.trim(),o.trim(),t.orgUnitUid??"",e),tt($,()=>n.trim(),()=>o.trim(),()=>t.orgUnitUid??"",()=>({...z.current}),e,S=>{re(I=>({...I,localSaved:!0,central:I.central==="CENTRAL_ACCEPTED"&&S==="saved"?"PENDING":I.central})),je(I=>I+1)}),$.addEventListener("blur",S=>{let I=S.target;if(I&&I.tagName==="INPUT"&&/-val$/.test(I.getAttribute("name")??"")&&I.value.trim()!==""){let R=o.trim();te(ne=>ne.has(R)?ne:new Set(ne).add(R))}},!0),rt($),mt($,N),pt($),vt($,w,Le),ht($,w),bt($,w),yt($),ft($,w),gt($,w),$e(S=>S+1),N({kind:"idle"})}catch(k){N({kind:"error",message:`custom form failed to render: ${k.message}`})}})(),()=>{y=!0}},[l,_,n,o,t.orgUnitUid,H]);let He=t.bound&&n.trim()!==""&&o.trim()!==""&&p.trim()!==""&&f.trim()!==""&&h.kind!=="submitting";async function Fe(b){b.preventDefault(),N({kind:"submitting"});try{await e.submitAggregate({dataSet:n,period:o,orgUnit:t.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),N({kind:"ok",message:`Submitted ${p}=${f} for ${o}.`}),g(""),x("")}catch(y){N({kind:"error",message:y.message??"Submission failed"})}}let be=o.trim()!=="",oe=n.trim()!=="",q=oe&&be&&t.bound;L(()=>{let b=A.current;if(!b)return;let y=V.trim().toLowerCase(),k=Array.from(b.querySelectorAll("tbody tr"));for(let w of k){if(!y){w.style.display="";continue}let O=((w.querySelector(".dataElementCell")??w.querySelector("td"))?.textContent??"").toLowerCase();w.style.display=O.includes(y)?"":"none"}},[V,Q]),L(()=>{let b=t.orgUnitUid??"";if(!n.trim()||!b||!o.trim()){re(E=>E.central==null&&!E.updatedAt?E:{...E,central:null});return}let y=!1,k=null,w=async()=>{try{let E=await e.readAggregateFormSyncState(n.trim(),b,o.trim());if(y)return;re(U=>({localSaved:U.localSaved||E.state!=null,central:E.state,updatedAt:E.updatedAt})),(E.state==="PENDING"||E.state==="IN_FLIGHT"||E.state==="RETRYABLE")&&(k=setTimeout(()=>void w(),4e3))}catch{}};return w(),()=>{y=!0,k&&clearTimeout(k)}},[n,o,t.orgUnitUid,Me]),L(()=>{if(!n.trim()||!t.bound||!_?.periodType){ee(new Set),te(new Set);return}let b=!1;return(async()=>{let y=Ne(_.periodType,_.openFuturePeriods??0).map(E=>E.id),[k,w]=await Promise.all([Promise.all(y.map(async E=>{try{return(await e.getCompletion(n.trim(),t.orgUnitUid??"",E)).completed?E:null}catch{return null}})),Promise.all(y.map(async E=>{try{return((await e.readAggregateValues(t.orgUnitUid??"",E,1)).dataValues?.length??0)>0?E:null}catch{return null}}))]);b||(ee(new Set(k.filter(E=>E!==null))),te(new Set(w.filter(E=>E!==null))))})(),()=>{b=!0}},[n,t.orgUnitUid,_?.periodType]),L(()=>{if(!q){B(null);return}let b=!1;return(async()=>{try{let y=await e.getCompletion(n.trim(),t.orgUnitUid??"",o.trim());if(b)return;B({completed:!!y.completed,completedAt:y.completedAt})}catch{b||B({completed:!1})}})(),()=>{b=!0}},[n,o,t.orgUnitUid,q]);async function qe(){if(!q||K)return;let b=!P?.completed;if(b){let y=A.current;if(y){let k=[];for(let w of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))w.value.trim()===""&&k.push(w);if(k.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${k.length} compulsory value${k.length===1?"":"s"} still missing. Run Validate to jump to them.`}),k[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}me(!0);try{let y=await e.markCompletion({dataSet:n.trim(),orgUnit:t.orgUnitUid??"",period:o.trim(),completed:b});B({completed:!!y.completed,completedAt:y.completedAt}),ee(k=>{let w=new Set(k);return y.completed?w.add(o.trim()):w.delete(o.trim()),w}),N({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){N({kind:"error",message:`Completion failed: ${y.message}`})}finally{me(!1)}}return v(Ge,{dataTest:"der-aggregate-entry",children:[m("style",{children:Ct}),v("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[v("div",{className:"der-de-toolbar__head",children:[m("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:v("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[m("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),m("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),m("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),m("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),m("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),m("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),m("span",{className:"der-de-toolbar__status "+(s.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":s.isOnline?"Online":"Offline",children:s.isOnline?"online":`offline \xB7 ${s.queuedCount} queued`}),v("span",{className:"der-de-toolbar__ou-wrap",children:[m("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),m("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),v("div",{className:"der-de-toolbar__picks",children:[v("label",{className:"der-de-toolbar__field",children:[m("span",{className:"der-de-toolbar__field-label",children:"Data set"}),v("select",{className:"der-de-toolbar__select",value:n,onChange:b=>{u(b.target.value),c("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),a.map(b=>m("option",{value:b.id,children:b.label},b.id))]})]}),Te.map(b=>v("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-toolbar__field-label",children:b.name}),v("select",{className:"der-de-toolbar__select",value:M[b.id]??"",onChange:y=>{let k={...M,[b.id]:y.target.value};j(k),z.current=k,et(A.current,k)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),b.options.map(y=>m("option",{value:y.id,children:y.name},y.id))]})]},b.id)),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[v("span",{className:"der-de-toolbar__field-label",children:["Period",_?.periodType?` \xB7 ${_.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:St(_?.periodType,o,c,Ce,Ae,_?.openFuturePeriods??0)})]}),v("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[m("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),v("span",{className:"der-de-toolbar__filter",children:[m("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:V,onChange:b=>pe(b.target.value),"data-test":"de-filter-input"}),V&&m("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>pe(""),children:"\xD7"})]})]}),m("div",{className:"der-de-toolbar__cell-info",children:m(it,{root:A,details:De,formVersion:Q,formSync:Re})})]})]}),h.kind==="ok"&&m("div",{style:kt,"data-test":"de-ok",children:h.message}),h.kind==="error"&&m("div",{style:Nt,"data-test":"de-err",children:h.message}),!t.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!oe&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&oe&&!be&&v("div",{className:"der-de-placeholder",children:["Pick a period to load the ",_?.formType==="SECTION"?"section":"data entry"," form."]}),q&&l==="structured"&&v("form",{onSubmit:Fe,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[v("label",{children:["Data element UID",m("input",{value:p,onChange:b=>g(b.target.value),style:ce})]}),v("label",{children:["Value",m("input",{value:f,onChange:b=>x(b.target.value),inputMode:"decimal",style:ce})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!He,style:xe,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),q&&l==="custom"&&m("div",{className:`der-de-form-card der-de-density-${F}`,children:v("div",{className:"der-de-form-split",children:[m(ot,{targetRef:A,formVersion:Q}),m("div",{ref:A,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),q&&l==="custom"&&v("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(nt,{root:A,formVersion:Q}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${F==="compact"?"comfortable":"compact"} density`,title:`Density: ${F}. Click to switch.`,onClick:()=>Pe(b=>b==="compact"?"comfortable":"compact"),children:F==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${H==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${H==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>Ue(b=>b==="der"?"author":"der"),children:H==="der"?"\u2699 DER layout":"\u2699 Author layout"}),P&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:P.completed?`Complete${P.completedAt?" \xB7 "+new Date(P.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{xt(A.current,N,(b,y)=>{Ie(b),fe.current=y,J(!0)})},style:_e,"data-test":"de-validate-btn",children:"Validate"}),G.length>0&&!ge&&v("button",{type:"button",onClick:()=>J(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[G.length," issue",G.length===1?"":"s"]}),m("button",{type:"button",onClick:()=>ae(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:qe,disabled:K,style:P?.completed?_e:xe,"data-test":"de-complete-btn",children:K?"Saving\u2026":P?.completed?"Reopen":"Mark complete"})]}),m(ut,{open:Oe,onClose:()=>ae(!1)}),m(ct,{open:ge,issues:G,totalCells:fe.current,onClose:()=>J(!1),onPick:b=>{let y=A.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select()),J(!1)}})]})}var Ze=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],We=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],se=null,de=null,le=null;async function ye(r,t){se||(se=t.listAllDataElements().then(d=>new Map(d.map(n=>[n.id,n])))),de||(de=t.listAllCategoryCombos().then(d=>new Map(d.map(n=>[n.id,n])))),le||(le=t.listAllCategoryOptionCombos().then(d=>{let n=new Map;for(let u of d){let o=u.categoryCombo?.id;if(!o)continue;let c=n.get(o);c?c.push(u):n.set(o,[u])}return n}));let[s,e,l]=await Promise.all([se,de,le]),i=d=>{if(!d?.id)return;let n=e.get(d.id),u=l.get(d.id)??[];return n?{id:n.id,name:n.name??n.displayName,categoryOptionCombos:u.map(o=>({id:o.id,name:o.name??o.displayName,categoryOptions:o.categoryOptions??[]})),categories:(n.categories??[]).map(o=>({id:o.id,name:o.name??o.displayName,categoryOptions:(o.categoryOptions??[]).map(c=>({id:c.id,name:c.name??c.displayName}))}))}:d},a=d=>{let n=s.get(d.id);return n?{id:n.id,name:n.name??n.displayName,formName:n.formName,valueType:n.valueType,categoryCombo:i(n.categoryCombo)}:d};return{...r,categoryCombo:i(r.categoryCombo)??r.categoryCombo,dataSetElements:(r.dataSetElements??[]).map(d=>({...d,dataElement:d.dataElement?a(d.dataElement):void 0})),sections:(r.sections??[]).map(d=>({...d,dataElements:(d.dataElements??[]).map(n=>a(n))}))}}function he(r){let t={};for(let d of r.dataSetElements??[])d.dataElement&&(t[d.dataElement.id]=d.dataElement);let s={};for(let d of r.indicators??[])s[d.id]=d;let e=(r.sections??[]).slice().sort((d,n)=>(d.sortOrder??0)-(n.sortOrder??0));if(!e.some(d=>(d.dataElements?.length??0)>0)){let d=(r.dataSetElements??[]).map(n=>n.dataElement).filter(n=>!!n);e=[{id:r.id,name:r.displayName??r.name??"Data entry",sortOrder:0,dataElements:d,indicators:[],greyedFields:[]}]}let i=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),a=[];for(let d of e){let n=new Set;for(let o of d.greyedFields??[])o.dataElement?.id&&o.categoryOptionCombo?.id&&n.add(`${o.dataElement.id}:${o.categoryOptionCombo.id}`);a.push(`<h3 class="formSection">${i(d.name??"")}</h3>`);let u=new Map;for(let o of d.dataElements??[]){let c=t[o.id];if(!c?.categoryCombo)continue;let p=c.categoryCombo.id,g=u.get(p);g||(g={cc:c.categoryCombo,des:[]},u.set(p,g)),g.des.push(c)}for(let o of u.values()){let c=o.cc.categoryOptionCombos??[],p=o.cc.categories??[];a.push('<div class="der-de-table-scroll">'),a.push('<table class="sectionTable" cellspacing="0">');let g=Ye(p,c);if(a.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){a.push("<tr>"),f===0&&a.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let x of g[f]??[])a.push(`<th colspan="${x.span}">${i(x.label)}</th>`);a.push("</tr>")}else{a.push("<tr>"),a.push('<th class="dataElementCell">Data elements</th>');for(let f of c)a.push(`<th>${i(f.name??"")}</th>`);a.push("</tr>")}a.push("</thead><tbody>");for(let f of o.des){a.push("<tr>"),a.push(`<td class="dataElementCell" id="${i(f.id)}-cell">`+i(f.formName??f.name??f.id)+"</td>");for(let x of c){let h=`${f.id}-${x.id}-val`;n.has(`${f.id}:${x.id}`)?a.push('<td class="greyed">\u2014</td>'):a.push(`<td><input type="text" id="${i(h)}" name="${i(h)}" dataelementid="${i(f.id)}" optioncomboid="${i(x.id)}"></td>`)}a.push("</tr>")}for(let f of d.indicators??[]){let x=s[f.id];x&&(a.push('<tr class="indicatorRow">'),a.push(`<td class="dataElementCell">${i(x.name??x.id)}</td>`),a.push(`<td colspan="${c.length}"><input type="text" name="indicator" indicatorid="${i(x.id)}" readonly></td>`),a.push("</tr>"))}a.push("</tbody></table></div>")}}return a.join(`
`)}function Ye(r,t){if(r.length===0||t.length===0)return[];let s=new Map;for(let a of r)for(let d of a.categoryOptions??[])s.set(d.id,{catId:a.id,name:d.name??d.id});let e=r.length,l=t.map(a=>{let d=new Array(e).fill("");for(let n of a.categoryOptions??[]){let u=s.get(n.id);if(!u)continue;let o=r.findIndex(c=>c.id===u.catId);o>=0&&(d[o]=u.name)}return d});for(let a of l)if(a.some(d=>d===""))return[];let i=[];for(let a=0;a<e;a++){let d=[];for(let n=0;n<l.length;){let u=l[n],o=n+1;for(;o<l.length;){let c=l[o],p=!0;for(let g=0;g<=a;g++)if(u[g]!==c[g]){p=!1;break}if(!p)break;o++}d.push({label:u[a]??"",span:o-n}),n=o}i.push(d)}return i}function Xe(r){let t=globalThis;t.dhis2=t.dhis2??{};let s=t.dhis2;s.de=s.de??{};let e=s.de;e.currentDataSetId=r.dataSetId,e.currentOrganisationUnitId=r.orgUnitId,e.currentPeriodId=r.periodId,e.currentCategorySelections={...r.aocSelections??{}};let l=r.meta??{},i={},a={};if(l.categoryCombo){a[l.categoryCombo.id]=l.categoryCombo;for(let c of l.categoryCombo.categories??[])i[c.id]=c}e.categories=i,e.categoryCombos=a;let d={},n={};for(let c of l.dataSetElements??[]){let p=c.dataElement;p&&(d[p.id]=p,p.optionSet&&(n[p.optionSet.id]=p.optionSet),p.categoryCombo&&(a[p.categoryCombo.id]=p.categoryCombo))}e.dataElements=d,e.optionSets=n;let u={};for(let c of l.indicators??[])u[c.id]={explodedNumerator:c.numerator,denominator:c.denominator,factor:c.indicatorType?.factor??1};e.indicatorFormulas=u;let o={};for(let c of r.validationRules??[])o[c.id]=c;e.validationRules=o,e.lockExceptions=[],e.emptyOrganisationUnits=[],e.significantZeros=[],e.dataSets={[l.id]:{id:l.id,name:l.name??l.displayName??"",periodType:l.periodType,categoryCombo:l.categoryCombo?.id,periodId:r.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,s.shim=s.shim??{},s.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ke(){let r=globalThis;if(r.$&&typeof r.$.ajaxSetup=="function"&&r.$.ajaxSetup({beforeSend:(t,s)=>{s.xhrFields={...s.xhrFields??{},withCredentials:!0}}}),r.dhis2?.period&&r.$?.calendars?.instance){let t=r.dhis2.period;t.format="yyyy-mm-dd",t.calendar=r.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function et(r,t){if(!r)return;for(let[e,l]of Object.entries(t)){let i=r.querySelector(`input[data-der-category="${e}"]`);i||(i=document.createElement("input"),i.type="hidden",i.id=`category-${e}`,i.setAttribute("data-der-category",e),r.appendChild(i)),i.value=l}let s=globalThis;s.dhis2?.de&&(s.dhis2.de.currentCategorySelections={...t})}function tt(r,t,s,e,l,i,a){let d=c=>{let p=/^(.+)-(.+)-val$/.exec(c);return p?{de:p[1],coc:p[2]}:null},n=new WeakMap,u=r.querySelectorAll('input[name$="-val"]');for(let c of Array.from(u))n.set(c,c.value);let o=async c=>{let p=c.target;if(!p||p.tagName!=="INPUT")return;let g=p.getAttribute("name")??"",f=d(g);if(!f)return;let x=t(),h=s(),N=e();if(!x||!h||!N)return;let _=p.value;if(n.get(p)===_)return;let C=p.getAttribute("data-valuetype")??"TEXT";if(_!==""&&ue(_,C)){Z(p,"error");return}Z(p,"saving");try{let A=await i.submitAggregate({dataSet:x,period:h,orgUnit:N,attributeOptionComboSelections:l(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:_}]});n.set(p,_);let M=A?.status==="OFFLINE_QUEUED"?"queued":"saved";Z(p,M),a?.(M)}catch{Z(p,"error")}};r.addEventListener("blur",c=>{o(c)},!0)}function rt(r){r.addEventListener("keydown",t=>{let s=t;if(s.key!=="Enter")return;let e=s.target;if(!(e instanceof HTMLInputElement))return;let l=e.getAttribute("name")??"",i=/^(.+)-(.+)-val$/.exec(l);if(!i)return;s.preventDefault();let a=i[2],d=Array.from(r.querySelectorAll(`input[name$="-${a}-val"]`)),n=d.indexOf(e);if(n===-1)return;let u=d[n+(s.shiftKey?-1:1)];u?.focus(),u instanceof HTMLInputElement&&u.select()})}function at(r){let t=Array.from(r.querySelectorAll("h2, h3, h4")).filter(i=>(i.textContent??"").trim().length>0);if(t.length<2)return[];let s=new Set(t),e=[],l=(i,a)=>{for(let d of s)if(d!==a&&i.contains(d))return!0;return!1};return t.forEach((i,a)=>{let d=i.id||`der-de-section-${a}`;i.id=d;let n=null,u=i.parentElement,o=null;for(;u&&u!==r&&!l(u,i);)o=u,u=u.parentElement;if(o&&o.children.length>1&&o!==r)n=o,n.classList.add("der-de-section-slot"),n.dataset.sectionId=d;else{n=document.createElement("div"),n.className="der-de-section-slot",n.dataset.sectionId=d;let c=t[a+1]??null,p=[],g=i;for(;g&&g!==c;){let f=g.nextSibling;p.push(g),g=f}i.parentNode?.insertBefore(n,i);for(let f of p)n.appendChild(f)}e.push({id:d,label:(i.textContent??"").trim(),slot:n})}),e}function ot({targetRef:r,formVersion:t}){let[s,e]=T([]),[l,i]=T(""),[a,d]=T({});return L(()=>{let n=r.current;if(!n)return;let u=at(n);e(u),i(u[0]?.id??"")},[r,t]),L(()=>{if(s.length===0)return;let n=()=>{let c={};for(let p of s){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(x=>x.value.trim()!=="").length;c[p.id]={filled:f,total:g.length}}d(c)};n();let u=r.current;if(!u)return;let o=c=>{let p=c.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&n()};return u.addEventListener("input",o,!0),()=>{u.removeEventListener("input",o,!0)}},[r,s]),L(()=>{if(!r.current||s.length===0)return;for(let o of s)o.slot.style.display=o.id===l?"":"none";let u=s.find(o=>o.id===l);u&&u.slot.scrollIntoView({behavior:"smooth",block:"start"})},[r,s,l]),s.length<2?null:v("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:s.map(n=>{let u=a[n.id],o=!u||u.total===0||u.filled===0?"muted":u.filled===u.total?"done":"partial";return m("li",{children:v("button",{type:"button",className:"der-de-section-nav__item"+(l===n.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>i(n.id),children:[m("span",{className:"der-de-section-nav__label",children:n.label}),u&&u.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${o}`,"data-test":"de-section-nav-ratio",title:`${u.filled} of ${u.total} cells filled`,children:o==="done"?"\u2713":`${u.filled}/${u.total}`})]})},n.id)})})]})}function nt({root:r,formVersion:t}){let[s,e]=T({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(L(()=>{let a=()=>{let n=r.current;if(!n)return;let u=Array.from(n.querySelectorAll('input[name$="-val"]')),o=0,c=0,p=0,g=0,f=0;for(let x of u){x.value.trim()!==""&&o++;let h=x.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?c++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?g++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?p++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&f++}e({total:u.length,filled:o,saving:c,saved:p,queued:g,error:f})};a();let d=window.setInterval(a,800);return()=>window.clearInterval(d)},[r,t]),s.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let l=[];l.push(`${s.filled} of ${s.total} filled`),s.saving>0&&l.push(`${s.saving} saving`),s.queued>0&&l.push(`${s.queued} queued`),s.error>0&&l.push(`${s.error} error`);let i=s.error>0?"error":s.queued>0?"queued":s.saving>0?"saving":s.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${i}`,"data-test":"de-save-state",children:l.join(" \xB7 ")})}function it({details:r,formSync:t}){let s={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},e={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return m("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:m("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:r?v(W,{children:[m("span",{className:"der-de-live-strip__de",children:r.deName}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__coc",children:r.cocName}),r.value&&v(W,{children:[m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__value",children:r.value}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:`der-de-live-strip__state der-de-live-strip__state--${e[r.saveState]}`,children:s[r.saveState]}),(r.lastUpdated||r.lastUpdatedBy)&&v(W,{children:[m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),v("span",{className:"der-de-live-strip__audit","data-test":"de-live-audit",title:r.lastUpdated?new Date(r.lastUpdated).toLocaleString():void 0,children:[r.lastUpdated?wt(r.lastUpdated):"earlier",r.lastUpdatedBy&&v(W,{children:[" by ",m("strong",{children:r.lastUpdatedBy})]})]})]})]}),m(st,{formSync:t,cellState:r.saveState}),r.compulsory&&m("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):m("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function st({formSync:r,cellState:t}){let s=t==="saved"||t==="queued",e=t==="saved"||t==="queued"?"lit":t==="saving"?"pending":t==="error"?"error":"muted",l=r.central,i=s?l==="CENTRAL_ACCEPTED"?"lit":l==="PENDING"||l==="IN_FLIGHT"||l==="RETRYABLE"||l==="UNKNOWN_OUTCOME"?"pending":l==="CENTRAL_REJECTED"||l==="CONFLICT_REVIEW"||l==="QUARANTINED"||l==="REQUIRES_APPROVAL"?"error":"muted":"muted",a=e==="lit"?"Saved on edge (DER)":e==="pending"?"Saving on edge\u2026":e==="error"?"Rejected by edge":"No value entered yet",d=i==="lit"?"Synced to Central DHIS2":i==="pending"?`Sync in progress (${l})`:i==="error"?`Central reported ${l}`:s?"Awaiting Central sync":"No value entered yet";return v("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+e,title:a,"data-test":"de-sync-der","data-state":e,children:[m(dt,{}),m("span",{className:"der-de-sync-logos__dot is-"+e,"aria-hidden":"true"})]}),v("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+i,title:d,"data-test":"de-sync-central","data-state":i,children:[m(lt,{}),m("span",{className:"der-de-sync-logos__dot is-"+i,"aria-hidden":"true"})]})]})}function dt(){return m("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",fillRule:"evenodd",children:[m("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),m("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),m("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),m("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),m("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),m("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),m("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),m("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),m("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),m("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),m("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),m("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),m("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function lt(){return m("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:v("g",{fill:"currentColor",children:[m("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),m("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),m("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function ct({open:r,issues:t,totalCells:s,onClose:e,onPick:l}){if(L(()=>{if(!r)return;let a=d=>{d.key==="Escape"&&e()};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[r,e]),!r)return null;let i=t.length===0;return m("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:a=>{a.target===a.currentTarget&&e()},children:v("div",{className:"der-de-validation "+(i?"der-de-validation--ok":"der-de-validation--err"),children:[v("header",{className:"der-de-validation__head",children:[v("div",{className:"der-de-validation__title",children:[m("span",{className:"der-de-validation__badge","aria-hidden":"true",children:i?"\u2713":"!"}),m("h3",{className:"der-de-validation__heading",children:i?`Validation passed \u2014 all ${s} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${s} cells.`})]}),m("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:e,children:"\xD7"})]}),m("div",{className:"der-de-validation__body",children:i?v("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",m("strong",{children:" Mark complete"})," when you're ready."]}):v("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[m("thead",{children:v("tr",{children:[m("th",{scope:"col",children:"Data element"}),m("th",{scope:"col",children:"Category option combo"}),m("th",{scope:"col",children:"Entered value"}),m("th",{scope:"col",children:"Problem"}),m("th",{scope:"col"})]})}),m("tbody",{children:t.map(a=>v("tr",{"data-test":"de-issues-row",children:[m("td",{children:a.deName}),m("td",{className:"der-de-validation__coc",children:a.cocName}),m("td",{children:m("code",{className:"der-de-validation__value",children:a.value||"\u2014"})}),m("td",{className:"der-de-validation__why",children:a.problem}),m("td",{className:"der-de-validation__jump",children:m("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>l(a),children:"Jump to cell \u2192"})})]},`${a.deId}-${a.cocId}`))})]})})]})})}function ut({open:r,onClose:t}){return L(()=>{if(!r)return;let e=l=>{l.key==="Escape"&&t()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[r,t]),r?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:e=>{e.target===e.currentTarget&&t()},children:v("div",{className:"der-de-shortcuts",children:[v("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([e,l])=>v("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:e})}),m("dd",{children:l})]},e))})]})}):null}function mt(r,t){r.addEventListener("paste",s=>{let e=s.target;if(!e||e.tagName!=="INPUT")return;let l=e.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(l))return;let a=s.clipboardData?.getData("text/plain")??"",d=/\r?\n/.test(a),n=/\t/.test(a);if(!d&&!n)return;let u=a.split(/\r?\n/).filter((_,C,A)=>!(C===A.length-1&&_==="")).map(_=>_.split("	").map(C=>C.trim()));if(u.length===0)return;s.preventDefault();let o=e.closest("[data-section-id]")??r,p=Array.from(o.querySelectorAll("tbody tr")).map(_=>Array.from(_.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let _=0;_<p.length;_++){let C=p[_].indexOf(e);if(C!==-1){g=_,f=C;break}}if(g===-1)return;let x=0,h=0;for(let _=0;_<u.length;_++){let C=u[_],A=p[g+_];if(!A){h+=C.length;continue}for(let M=0;M<C.length;M++){let j=A[f+M];if(!j){h++;continue}j.value=C[M]??"",j.dispatchEvent(new Event("input",{bubbles:!0})),j.dispatchEvent(new Event("blur",{bubbles:!0})),x++}}let N=u.length===1?`${u[0].length}-cell row`:u[0]?.length===1?`${u.length}-cell column`:`${u.length}\xD7${u[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${x} value${x===1?"":"s"} (${N}${h>0?`, ${h} overflow`:""}).`})},!0)}function pt(r){let t=Array.from(r.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let s=[];for(let e of t){let l=e.getAttribute("dataelementid")??"";if(!l)continue;let i=e.closest("div"),d=(()=>{let o=i??e.parentElement;if(!o)return null;let c=o.previousElementSibling;for(;c;){if(/^(H1|H2|H3|H4)$/.test(c.tagName)||c.tagName==="DIV"&&!c.querySelector("table, input")&&(c.textContent??"").trim().length>0)return c;c=c.previousElementSibling}let p=o.closest("[data-section-id]");if(p){let g=p.querySelector("h2, h3, h4");if(g)return g}return null})();if(!d)continue;i?.remove();let n=document.createElement("span");n.className="der-de-matrix-total",n.setAttribute("data-de",l),d.appendChild(n);let u=()=>{let o=0,c=!1,p=Array.from(r.querySelectorAll(`input[dataelementid="${l}"][name$="-val"],input[name^="${l}-"][name$="-val"]`)),g=new Set;for(let f of p){if(g.has(f))continue;g.add(f);let x=parseFloat(f.value);Number.isFinite(x)&&(o+=x,c=!0)}if(c){let f=Number.isInteger(o)?o:Number(o.toFixed(2));n.textContent=` (Total: ${f})`}else n.textContent=""};s.push(u),u()}s.length!==0&&r.addEventListener("input",e=>{let l=e.target;if(!(!l||l.tagName!=="INPUT")&&/-val$/.test(l.getAttribute("name")??""))for(let i of s)i()},!0)}function gt(r,t){let s=t.indicators??[];if(s.length===0)return;let e=s.filter(o=>o.numerator&&o.denominator).map(o=>({id:o.id,factor:o.indicatorType?.factor??1,numExpr:o.numerator,denExpr:o.denominator}));if(e.length===0)return;let l=Array.from(r.querySelectorAll("input[indicatorid]")),i=new Map;for(let o of Array.from(r.querySelectorAll('input[name$="-val"]')))i.set(o.getAttribute("name")??"",o);let a=o=>{let c=0;for(let[p,g]of i){if(!p.startsWith(`${o}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(c+=f)}return c},d=o=>o.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(c,p,g)=>{if(g){let f=i.get(`${p}-${g}-val`),x=parseFloat(f?.value??"");return Number.isFinite(x)?String(x):"0"}return String(a(p))}),n=o=>{if(!/^[\s\d+\-*/().eE]+$/.test(o))return NaN;try{return Function(`"use strict";return (${o})`)()}catch{return NaN}},u=()=>{for(let o of e){let c=n(d(o.numExpr)),p=n(d(o.denExpr)),g=l.find(x=>x.getAttribute("indicatorid")===o.id);if(!g)continue;if(!Number.isFinite(c)||!Number.isFinite(p)||p===0){g.value="";continue}let f=c/p*o.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};r.addEventListener("input",o=>{let c=o.target;c&&c.tagName==="INPUT"&&c.hasAttribute("name")&&/-val$/.test(c.getAttribute("name")??"")&&u()},!0),u()}function ft(r,t){let s={};for(let e of t.dataSetElements??[])e.dataElement&&(s[e.dataElement.id]=e.dataElement);for(let e of Array.from(r.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!l)continue;let i=s[l[1]],a=i?.formName??i?.name??l[1],d=i?.categoryCombo?.categoryOptionCombos?.find(u=>u.id===l[2]),n=d?.name??d?.displayName??l[2];e.hasAttribute("aria-label")||e.setAttribute("aria-label",n===l[2]?`${a}`:`${a}, ${n}`),e.getAttribute("data-compulsory")==="1"&&e.setAttribute("aria-required","true")}}function bt(r,t){let s={};for(let e of t.dataSetElements??[])e.dataElement&&(s[e.dataElement.id]=e.dataElement);for(let e of Array.from(r.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(e.getAttribute("name")??"");if(!l)continue;let i=s[l[1]]?.valueType??"TEXT";switch(e.setAttribute("data-valuetype",i),i){case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":e.setAttribute("inputmode","numeric"),e.setAttribute("pattern","-?\\d*");break;case"NUMBER":case"UNIT_INTERVAL":case"PERCENTAGE":e.setAttribute("inputmode","decimal"),e.setAttribute("pattern","-?\\d*(\\.\\d+)?");break;case"EMAIL":e.setAttribute("inputmode","email"),e.setAttribute("type","email");break;case"PHONE_NUMBER":e.setAttribute("inputmode","tel"),e.setAttribute("type","tel");break;case"URL":e.setAttribute("inputmode","url"),e.setAttribute("type","url");break;case"DATE":e.setAttribute("type","date");break;case"TIME":e.setAttribute("type","time");break;case"DATETIME":e.setAttribute("type","datetime-local");break;default:break}}}function yt(r){let t=s=>{let e=s.value;if(e===""){s.removeAttribute("data-de-invalid"),s.removeAttribute("title");return}let l=s.getAttribute("data-valuetype")??"TEXT",i=ue(e,l);i?(s.setAttribute("data-de-invalid","1"),s.setAttribute("title",i)):(s.removeAttribute("data-de-invalid"),s.removeAttribute("title"))};r.addEventListener("input",s=>{let e=s.target;!e||e.tagName!=="INPUT"||/-val$/.test(e.getAttribute("name")??"")&&t(e)},!0);for(let s of Array.from(r.querySelectorAll('input[name$="-val"]')))t(s)}function ht(r,t){let s=t.compulsoryDataElementOperands??[],e=new Set;for(let l of s){let i=l.dimensionItem;if(!i)continue;let a=i.split(".");a.length===2&&e.add(`${a[0]}:${a[1]}`)}if(e.size!==0)for(let l of Array.from(r.querySelectorAll('input[name$="-val"]'))){let i=/^(.+)-(.+)-val$/.exec(l.getAttribute("name")??"");i&&e.has(`${i[1]}:${i[2]}`)&&l.setAttribute("data-compulsory","1")}}function vt(r,t,s){let e={};for(let i of t.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let l=i=>{let a=i.getAttribute("name")??i.id??"",d=/^(.+)-(.+)-val$/.exec(a);if(!d)return null;let n=d[1],u=d[2],o=e[n],c=o?.categoryCombo,p=c?.categoryOptionCombos?.find(C=>C.id===u),g=[],f=p?.name??p?.displayName??u,x=f.split(/,\s*/).filter(Boolean),h=c?.categories??[];x.forEach((C,A)=>{g.push({category:h[A]?.name??h[A]?.displayName??"",option:C})});let N=i.style.outline||"",_=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":i.value.trim()===""?"empty":"saved";return{deId:n,cocId:u,deName:o?.name??n,deFormName:o?.formName,valueType:o?.valueType??"TEXT",optionSetId:o?.optionSet?.id,cocName:f,categoryBreakdown:g,value:i.value,saveState:_,inputName:a,compulsory:i.getAttribute("data-compulsory")==="1",lastUpdated:i.getAttribute("data-updated")??void 0,lastUpdatedBy:i.getAttribute("data-updated-by")??void 0}};r.addEventListener("focusin",i=>{let a=i.target;if(a&&a.tagName==="INPUT"){let d=l(a);d&&s(d)}},!0),r.addEventListener("input",i=>{let a=i.target;if(a&&a.tagName==="INPUT"){let d=l(a);d&&s(d)}},!0)}function xt(r,t,s){if(!r)return;let e=globalThis,l=e.dhis2?.de?.dataElements??{},i=e.dhis2?.de?.categoryOptionCombos??{},a=Array.from(r.querySelectorAll('input[name$="-val"]')),d=[];for(let n of a){n.style.outline="";let u=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!u)continue;let o=u[1],c=u[2],p=l[o],g=p?.valueType??"TEXT",f=n.value.trim();if(f===""){n.getAttribute("data-compulsory")==="1"&&(n.style.outline="2px solid #c0392b",d.push({deId:o,cocId:c,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??o,cocName:i[c]?.name??c,inputName:n.name}));continue}let x=ue(f,g);x&&(n.style.outline="2px solid #c0392b",d.push({deId:o,cocId:c,valueType:g,value:f,problem:x,deName:p?.name??o,cocName:i[c]?.name??c,inputName:n.name}))}s(d,a.length),t({kind:"idle"})}function ue(r,t){let s=Number(r),e=Number.isInteger(s);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(s))return"must be a number";break}switch(t){case"INTEGER":if(!e)return"must be an integer";break;case"INTEGER_POSITIVE":if(!e||s<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!e||s>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!e||s<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(s<0||s>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(s<0||s>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(r.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(r.toLowerCase()))return"must be yes";break;case"URL":try{new URL(r)}catch{return"must be a valid URL"}break;default:break}return null}function Z(r,t){let s=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";r.style.outline=`2px solid ${s}`,r.style.transition="outline 150ms",t==="queued"?r.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):r.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{r.style.outline.includes("#1a8754")&&(r.style.outline="1px solid #b7dcc7")},1200)}async function _t(r,t,s,e,l){if(!t||!s||!e)return;let i;try{i=(await l.readAggregateValues(e,s,2e3)).dataValues??[]}catch{return}for(let a of i){let d=a.dataElement,n=a.categoryOptionCombo,u=a.value;if(!d||!n||u==null)continue;let o=r.querySelector(`input[name="${d}-${n}-val"]`);o&&(o.value=u,a.lastUpdated&&o.setAttribute("data-updated",a.lastUpdated),a.storedByUsername&&o.setAttribute("data-updated-by",a.storedByUsername))}}function wt(r){let t=Date.parse(r);if(!Number.isFinite(t))return r;let s=Date.now()-t;if(s<0)return new Date(t).toLocaleString();let e=Math.floor(s/6e4);if(e<1)return"just now";if(e<60)return`${e} min ago`;let l=Math.floor(e/60);if(l<24)return`${l} h ago`;let i=Math.floor(l/24);return i<30?`${i} d ago`:new Date(t).toLocaleDateString()}function Ee(r){return new Promise((t,s)=>{let e=document.createElement("script");e.src=r,e.async=!1,e.setAttribute("data-der-custom-form",r),e.onload=()=>t(),e.onerror=()=>s(new Error(`failed to load ${r}`)),document.head.appendChild(e)})}function ke(r){if(document.querySelector(`link[data-der-custom-form="${r}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=r,t.setAttribute("data-der-custom-form",r),document.head.appendChild(t)}function ve(r){return!r||/^https?:\/\//i.test(r)||r.startsWith("/legacy-custom-forms/")||r.startsWith("/")?r:`/legacy-custom-forms/${r.replace(/^(?:\.{1,2}\/)+/,"")}`}async function Et(r,t,s={}){let e=s.stripStyles??!0;r.classList.toggle("der-de-custom-form--author",!e);let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let a of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(a.tagName==="LINK"){let d=a.getAttribute("href")??"";d&&ke(ve(d))}else{let d=document.createElement("style");d.textContent=a.textContent??"",d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d)}a.remove()}let i=[];for(let a of Array.from(l.querySelectorAll("script"))){let d=a.getAttribute("src");d?i.push({src:ve(d)}):i.push({code:a.textContent??""}),a.remove()}for(let a of Array.from(l.body.querySelectorAll("*"))){if(e&&a.removeAttribute("style"),a.tagName==="INPUT"){let d=a.getAttribute("id")??"";d.endsWith("-val")&&a.getAttribute("name")!==d&&a.setAttribute("name",d)}if(e&&a.tagName==="TH"){let d=(a.textContent??"").trim();(d==="Reporting item"||d==="Reported count")&&(a.textContent=d==="Reporting item"?"Data elements":"Value")}}for(let a of Array.from(l.body.childNodes))r.appendChild(document.adoptNode(a));for(let a of i)if(a.src)document.querySelector(`script[data-der-custom-form="${a.src}"]`)||await Ee(a.src);else if(a.code){let d=document.createElement("script");d.textContent=a.code,d.setAttribute("data-der-custom-form","inline"),document.head.appendChild(d),d.remove()}}var ce={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},xe={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},_e={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},kt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},Nt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function St(r,t,s,e=new Set,l=new Set,i=0){let a=(h,N)=>e.has(h)?`\u2713  ${N}`:l.has(h)?`\u25CF  ${N}`:N,d={...ce},n=Ne(r,i);if(n.length===0)return m("input",{value:t,onChange:h=>s(h.target.value),placeholder:r?`DHIS2 ${r} period id`:"e.g. 202611",style:d});let u=[...n];if(t&&!u.some(h=>h.id===t)){let h=Tt(r,t)??t;u.unshift({id:t,label:h})}let o=n[0]?.id??null,c=u.findIndex(h=>h.id===t),p=c===-1||c<u.length-1||!!r,g=t!==""&&(c>0||t!==o),f=()=>{if(!r)return;let h=c>=0&&c<u.length-1?u[c+1]?.id??"":we(r,t||o||"",-1);h&&s(h)},x=()=>{if(!r||!t||t===o)return;let h=c>0?u[c-1]?.id??"":we(r,t,1);h&&s(h)};return v("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:f,disabled:!p,className:"der-de-period-btn",children:"\u25C0"}),v("select",{value:t,onChange:h=>s(h.target.value),style:d,children:[m("option",{value:"",children:"Select a period\u2026"}),u.map(h=>m("option",{value:h.id,children:a(h.id,h.label)},h.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:x,disabled:!g,className:"der-de-period-btn",children:"\u25B6"})]})}function we(r,t,s){let e=l=>String(l).padStart(2,"0");switch(r){case"Daily":{if(!/^\d{8}$/.test(t))return"";let l=Number(t.slice(0,4)),i=Number(t.slice(4,6))-1,a=Number(t.slice(6,8)),d=new Date(l,i,a+s);return`${d.getFullYear()}${e(d.getMonth()+1)}${e(d.getDate())}`}case"Weekly":{let l=/^(\d{4})W(\d{1,2})$/.exec(t);if(!l)return"";let i=Number(l[1]),a=Number(l[2])+s;return a<1?(i-=1,a=Y(i)):a>Y(i)&&(i+=1,a=1),`${i}W${a}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let l=Number(t.slice(0,4)),i=Number(t.slice(4,6))-1,a=l*12+i+s;return`${Math.floor(a/12)}${e((a%12+12)%12+1)}`}case"BiMonthly":{let l=/^(\d{4})(\d{2})B$/.exec(t);if(!l)return"";let i=Number(l[1]),a=Number(l[2])+s;return a<1?(i-=1,a=6):a>6&&(i+=1,a=1),`${i}${e(a)}B`}case"Quarterly":{let l=/^(\d{4})Q(\d)$/.exec(t);if(!l)return"";let i=Number(l[1]),a=Number(l[2])+s;return a<1?(i-=1,a=4):a>4&&(i+=1,a=1),`${i}Q${a}`}case"SixMonthly":{let l=/^(\d{4})S(\d)$/.exec(t);if(!l)return"";let i=Number(l[1]),a=Number(l[2])+s;return a<1?(i-=1,a=2):a>2&&(i+=1,a=1),`${i}S${a}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+s):"";default:return""}}function Tt(r,t){let s=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(r){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let e=/^(\d{4})W(\d{1,2})$/.exec(t);return e?`${e[1]} W${String(e[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let e=Number(t.slice(4,6))-1;return`${s[e]??""} ${t.slice(0,4)}`}case"BiMonthly":{let e=/^(\d{4})(\d{2})B$/.exec(t);if(!e)return null;let l=(Number(e[2])-1)*2;return`${s[l]}\u2013${s[l+1]} ${e[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let e=/^(\d{4})S(\d)$/.exec(t);return e?`${e[1]} ${e[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function Ne(r,t=0){let s=new Date,e=s.getFullYear(),l=s.getMonth(),i=n=>String(n).padStart(2,"0"),a=["January","February","March","April","May","June","July","August","September","October","November","December"],d=Math.max(0,1-Math.max(0,t));switch(r){case"Daily":{let n=[];for(let u=d;u<30+d;u++){let o=new Date(s);o.setDate(o.getDate()-u);let c=`${o.getFullYear()}${i(o.getMonth()+1)}${i(o.getDate())}`,p=`${o.getFullYear()}-${i(o.getMonth()+1)}-${i(o.getDate())}`;n.push({id:c,label:p})}return n}case"Weekly":{let n=[],u=Se(s),o=u.year,c=u.week;for(let p=0;p<d;p++)c-=1,c<1&&(o-=1,c=Y(o));for(let p=0;p<12;p++)n.push({id:`${o}W${c}`,label:`${o} W${i(c)}`}),c-=1,c<1&&(o-=1,c=Y(o));return n}case"Monthly":{let n=[];for(let u=d;u<24+d;u++){let o=e,c=l,p=o*12+c-u,g=Math.floor(p/12),f=(p%12+12)%12;n.push({id:`${g}${i(f+1)}`,label:`${a[f]} ${g}`})}return n}case"BiMonthly":{let n=[],u=Math.floor(l/2)+1,o=e,c=u;for(let p=0;p<d;p++)c-=1,c<1&&(o-=1,c=6);for(let p=0;p<12;p++){let g=(c-1)*2;n.push({id:`${o}${i(c)}B`,label:`${a[g]}\u2013${a[g+1]} ${o}`}),c-=1,c<1&&(o-=1,c=6)}return n}case"Quarterly":{let n=[],u=Math.floor(l/3)+1,o=e,c=u;for(let p=0;p<d;p++)c-=1,c<1&&(o-=1,c=4);for(let p=0;p<8;p++)n.push({id:`${o}Q${c}`,label:`${o} Q${c}`}),c-=1,c<1&&(o-=1,c=4);return n}case"SixMonthly":{let n=[],u=l<6?1:2,o=e,c=u;for(let p=0;p<d;p++)c-=1,c<1&&(o-=1,c=2);for(let p=0;p<6;p++)n.push({id:`${o}S${c}`,label:`${o} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(o-=1,c=2);return n}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let n=[];for(let u=d;u<10+d;u++){let o=e-u;n.push({id:String(o),label:String(o)})}return n}default:return[]}}function Se(r){let t=new Date(r.getFullYear(),r.getMonth(),r.getDate()),s=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-s);let e=new Date(t.getFullYear(),0,1),i=Math.round((t.getTime()-e.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((i+1)/7)}}function Y(r){return Se(new Date(r,11,28)).week}var Ct=`
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
`;export{Je as default};
