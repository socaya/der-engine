/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as R,useRef as ae,useState as C}from"react";import{useAuth as Ue,useOrgUnitBinding as qe,useOnlineStatus as ze,useDerApi as Be,ScreenCard as Ve}from"@der/app-sdk";import{Fragment as Nt,jsx as m,jsxs as x}from"react/jsx-runtime";function Qe(){let n=Ue(),e=qe(),c=ze(),o=Be(),[l,s]=C("custom"),[t,i]=C([]),[a,u]=C(""),[r,d]=C(""),[p,g]=C(""),[f,v]=C(""),[h,N]=C({kind:"idle"}),[_,A]=C(null),T=ae(null),[P,M]=C({}),z=ae({}),[Ne,Z]=C([]),[H,B]=C(null),[Y,ce]=C(!1),[Se,X]=C(new Set),[Ce,K]=C(new Set),[V,ue]=C(""),[Q,Te]=C(0),[J,Ae]=C([]),[me,G]=C(!1),pe=ae(0),[$e,De]=C(null),[Ie,ee]=C({localSaved:!1,central:null}),[Re,Le]=C(0),[Me,te]=C(!1);R(()=>{let b=y=>{if(y.key!=="?")return;let E=y.target;E&&(E.tagName==="INPUT"||E.tagName==="TEXTAREA")||(y.preventDefault(),te(w=>!w))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[F,je]=C(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});R(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",F)}catch{}},[F]);let[U,Oe]=C(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});R(()=>{try{window.localStorage.setItem("der-de-density",U)}catch{}},[U]),R(()=>{let b=!1;return(async()=>{if(!e.bound||!e.orgUnitUid){i([]);return}try{let y=await o.listDataSets(e.orgUnitUid);if(b)return;let E=(y.dataSets??[]).map(w=>({id:w.id,label:w.displayName??w.name??w.id,periodType:w.periodType,formType:w.formType})).sort((w,k)=>w.label.localeCompare(k.label));i(E)}catch{}})(),()=>{b=!0}},[e.bound,e.orgUnitUid]),R(()=>{if(a.trim()===""){A(null),Z([]),M({}),z.current={};return}let b=!1;return(async()=>{try{let y=await o.getDataSetMeta(a.trim());if(b)return;let E=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";A({hasCustomForm:E,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType,openFuturePeriods:y.openFuturePeriods??0}),s(E?"custom":"structured");try{let w=await o.getDataSetFormMetadata(a.trim());if(b)return;let k=await fe(w,o);if(b)return;let j=(k.categoryCombo?.categories??[]).filter(I=>(I.categoryOptions?.length??0)>1).map(I=>({id:I.id,name:I.name??I.id,options:(I.categoryOptions??[]).map(D=>({id:D.id,name:D.name??D.id}))}));Z(j);let O={};for(let I of j)I.options[0]&&(O[I.id]=I.options[0].id);M(O),z.current=O}catch{}}catch{b||A(null)}})(),()=>{b=!0}},[a]),R(()=>{if(l!=="custom"||!_?.hasCustomForm||_.formType==="CUSTOM"&&!_.formId)return;let b=T.current;if(!b)return;let y=!1;return(async()=>{N({kind:"submitting"});try{let E=await o.getDataSetFormMetadata(a.trim());if(y)return;let w=await fe(E,o);if(y)return;let k="";if(_.formType==="CUSTOM"&&_.formId){try{k=(await o.getDataEntryFormHtml(_.formId)).htmlCode??""}catch(S){k="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",S)}k.trim()||(k=be(w))}else _.formType==="SECTION"&&(k=be(w));if(y)return;let j=await o.listValidationRules(a.trim()).catch(()=>({validationRules:[]}));if(y)return;let O=(w.categoryCombo?.categories??[]).filter(S=>(S.categoryOptions?.length??0)>1).map(S=>({id:S.id,name:S.name??S.id,options:(S.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));Z(O);let I={};for(let S of O)S.options[0]&&(I[S.id]=S.options[0].id);M(I),z.current=I,b.replaceChildren();for(let[S,$]of[["selectedDataSetId",a.trim()],["selectedPeriodId",r.trim()],["selectedOrganisationUnitId",e.orgUnitUid??""]]){let L=document.createElement("input");L.type="hidden",L.id=S,L.value=$,b.appendChild(L)}for(let[S,$]of Object.entries(I)){let L=document.createElement("input");L.type="hidden",L.id=`category-${S}`,L.value=$,L.setAttribute("data-der-category",S),b.appendChild(L)}let D=document.createElement("div");D.id="contentDiv",b.appendChild(D),Ze({dataSetId:a.trim(),periodId:r.trim(),orgUnitId:e.orgUnitUid??"",meta:w,aocSelections:I,validationRules:j.validationRules??[]});for(let S of Ge)we(S);for(let S of Je)document.querySelector(`script[data-der-custom-form="${S}"]`)||await _e(S);Ye(),await vt(D,k,{stripStyles:F==="der"}),await ht(D,a.trim(),r.trim(),e.orgUnitUid??"",o),Ke(D,()=>a.trim(),()=>r.trim(),()=>e.orgUnitUid??"",()=>({...z.current}),o,S=>{ee($=>({...$,localSaved:!0,central:$.central==="CENTRAL_ACCEPTED"&&S==="saved"?"PENDING":$.central})),Le($=>$+1)}),D.addEventListener("blur",S=>{let $=S.target;if($&&$.tagName==="INPUT"&&/-val$/.test($.getAttribute("name")??"")&&$.value.trim()!==""){let L=r.trim();K(oe=>oe.has(L)?oe:new Set(oe).add(L))}},!0),et(D),ct(D,N),ut(D),ft(D,w,De),gt(D,w),pt(D,w),mt(D,w),Te(S=>S+1),N({kind:"idle"})}catch(E){N({kind:"error",message:`custom form failed to render: ${E.message}`})}})(),()=>{y=!0}},[l,_,a,r,e.orgUnitUid,F]);let Pe=e.bound&&a.trim()!==""&&r.trim()!==""&&p.trim()!==""&&f.trim()!==""&&h.kind!=="submitting";async function He(b){b.preventDefault(),N({kind:"submitting"});try{await o.submitAggregate({dataSet:a,period:r,orgUnit:e.orgUnitUid,dataValues:[{dataElement:p,value:f}]}),N({kind:"ok",message:`Submitted ${p}=${f} for ${r}.`}),g(""),v("")}catch(y){N({kind:"error",message:y.message??"Submission failed"})}}let ge=r.trim()!=="",re=a.trim()!=="",q=re&&ge&&e.bound;R(()=>{let b=T.current;if(!b)return;let y=V.trim().toLowerCase(),E=Array.from(b.querySelectorAll("tbody tr"));for(let w of E){if(!y){w.style.display="";continue}let j=((w.querySelector(".dataElementCell")??w.querySelector("td"))?.textContent??"").toLowerCase();w.style.display=j.includes(y)?"":"none"}},[V,Q]),R(()=>{let b=e.orgUnitUid??"";if(!a.trim()||!b||!r.trim()){ee(k=>k.central==null&&!k.updatedAt?k:{...k,central:null});return}let y=!1,E=null,w=async()=>{try{let k=await o.readAggregateFormSyncState(a.trim(),b,r.trim());if(y)return;ee(O=>({localSaved:O.localSaved||k.state!=null,central:k.state,updatedAt:k.updatedAt})),(k.state==="PENDING"||k.state==="IN_FLIGHT"||k.state==="RETRYABLE")&&(E=setTimeout(()=>void w(),4e3))}catch{}};return w(),()=>{y=!0,E&&clearTimeout(E)}},[a,r,e.orgUnitUid,Re]),R(()=>{if(!a.trim()||!e.bound||!_?.periodType){X(new Set),K(new Set);return}let b=!1;return(async()=>{let y=ke(_.periodType,_.openFuturePeriods??0).map(k=>k.id),[E,w]=await Promise.all([Promise.all(y.map(async k=>{try{return(await o.getCompletion(a.trim(),e.orgUnitUid??"",k)).completed?k:null}catch{return null}})),Promise.all(y.map(async k=>{try{return((await o.readAggregateValues(e.orgUnitUid??"",k,1)).dataValues?.length??0)>0?k:null}catch{return null}}))]);b||(X(new Set(E.filter(k=>k!==null))),K(new Set(w.filter(k=>k!==null))))})(),()=>{b=!0}},[a,e.orgUnitUid,_?.periodType]),R(()=>{if(!q){B(null);return}let b=!1;return(async()=>{try{let y=await o.getCompletion(a.trim(),e.orgUnitUid??"",r.trim());if(b)return;B({completed:!!y.completed,completedAt:y.completedAt})}catch{b||B({completed:!1})}})(),()=>{b=!0}},[a,r,e.orgUnitUid,q]);async function Fe(){if(!q||Y)return;let b=!H?.completed;if(b){let y=T.current;if(y){let E=[];for(let w of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))w.value.trim()===""&&E.push(w);if(E.length>0){N({kind:"error",message:`Can't mark complete \u2014 ${E.length} compulsory value${E.length===1?"":"s"} still missing. Run Validate to jump to them.`}),E[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ce(!0);try{let y=await o.markCompletion({dataSet:a.trim(),orgUnit:e.orgUnitUid??"",period:r.trim(),completed:b});B({completed:!!y.completed,completedAt:y.completedAt}),X(E=>{let w=new Set(E);return y.completed?w.add(r.trim()):w.delete(r.trim()),w}),N({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){N({kind:"error",message:`Completion failed: ${y.message}`})}finally{ce(!1)}}return x(Ve,{dataTest:"der-aggregate-entry",children:[m("style",{children:Et}),x("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[x("div",{className:"der-de-toolbar__head",children:[m("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:x("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[m("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#e6f1fb",stroke:"#147CD7","stroke-width":"5"}),m("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#147CD7","stroke-width":"5"}),m("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#147CD7","stroke-width":"3"}),m("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#147CD7","stroke-width":"3"}),m("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#147CD7","stroke-width":"3"})]})}),m("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),m("span",{className:"der-de-toolbar__status "+(c.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":c.isOnline?"Online":"Offline",children:c.isOnline?"online":`offline \xB7 ${c.queuedCount} queued`}),x("span",{className:"der-de-toolbar__ou-wrap",children:[m("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),m("span",{className:"der-de-toolbar__ou",title:e.orgUnitPath||e.orgUnitUid||"","data-test":"de-toolbar-ou",children:e.orgUnitDisplayName||e.orgUnitUid||"Not bound to an OU"})]})]}),x("div",{className:"der-de-toolbar__picks",children:[x("label",{className:"der-de-toolbar__field",children:[m("span",{className:"der-de-toolbar__field-label",children:"Data set"}),x("select",{className:"der-de-toolbar__select",value:a,onChange:b=>{u(b.target.value),d("")},"data-test":"der-de-dataset-picker",children:[m("option",{value:"",children:"Select a data set\u2026"}),t.map(b=>m("option",{value:b.id,children:b.label},b.id))]})]}),Ne.map(b=>x("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[m("span",{className:"der-de-toolbar__field-label",children:b.name}),x("select",{className:"der-de-toolbar__select",value:P[b.id]??"",onChange:y=>{let E={...P,[b.id]:y.target.value};M(E),z.current=E,Xe(T.current,E)},"data-test":"de-aoc-select",children:[m("option",{value:"",children:"Select\u2026"}),b.options.map(y=>m("option",{value:y.id,children:y.name},y.id))]})]},b.id)),x("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[x("span",{className:"der-de-toolbar__field-label",children:["Period",_?.periodType?` \xB7 ${_.periodType}`:""]}),m("span",{className:"der-de-period-wrap",children:wt(_?.periodType,r,d,Se,Ce,_?.openFuturePeriods??0)})]}),x("label",{className:"der-de-toolbar__field der-de-toolbar__field--filter",children:[m("span",{className:"der-de-toolbar__field-label",children:"Filter data elements"}),x("span",{className:"der-de-toolbar__filter",children:[m("input",{className:"der-de-toolbar__filter-input",type:"search",placeholder:"type to narrow rows\u2026",value:V,onChange:b=>ue(b.target.value),"data-test":"de-filter-input"}),V&&m("button",{type:"button",className:"der-de-toolbar__filter-clear","aria-label":"Clear filter","data-test":"de-filter-clear",onClick:()=>ue(""),children:"\xD7"})]})]}),m("div",{className:"der-de-toolbar__cell-info",children:m(at,{root:T,details:$e,formVersion:Q,formSync:Ie})})]})]}),h.kind==="ok"&&m("div",{style:xt,"data-test":"de-ok",children:h.message}),h.kind==="error"&&m("div",{style:_t,"data-test":"de-err",children:h.message}),!e.bound&&m("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),e.bound&&!re&&m("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),e.bound&&re&&!ge&&x("div",{className:"der-de-placeholder",children:["Pick a period to load the ",_?.formType==="SECTION"?"section":"data entry"," form."]}),q&&l==="structured"&&x("form",{onSubmit:He,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[x("label",{children:["Data element UID",m("input",{value:p,onChange:b=>g(b.target.value),style:le})]}),x("label",{children:["Value",m("input",{value:f,onChange:b=>v(b.target.value),inputMode:"decimal",style:le})]}),m("div",{style:{gridColumn:"1 / -1"},children:m("button",{type:"submit",disabled:!Pe,style:he,children:h.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),q&&l==="custom"&&m("div",{className:`der-de-form-card der-de-density-${U}`,children:x("div",{className:"der-de-form-split",children:[m(rt,{targetRef:T,formVersion:Q}),m("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),q&&l==="custom"&&x("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[m(ot,{root:T,formVersion:Q}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${U==="compact"?"comfortable":"compact"} density`,title:`Density: ${U}. Click to switch.`,onClick:()=>Oe(b=>b==="compact"?"comfortable":"compact"),children:U==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),m("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${F==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${F==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>je(b=>b==="der"?"author":"der"),children:F==="der"?"\u2699 DER layout":"\u2699 Author layout"}),H&&m("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:H.completed?`Complete${H.completedAt?" \xB7 "+new Date(H.completedAt).toLocaleString():""}`:"Open for edits"}),m("button",{type:"button",onClick:()=>{bt(T.current,N,(b,y)=>{Ae(b),pe.current=y,G(!0)})},style:ve,"data-test":"de-validate-btn",children:"Validate"}),J.length>0&&!me&&x("button",{type:"button",onClick:()=>G(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[J.length," issue",J.length===1?"":"s"]}),m("button",{type:"button",onClick:()=>te(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),m("button",{type:"button",onClick:Fe,disabled:Y,style:H?.completed?ve:he,"data-test":"de-complete-btn",children:Y?"Saving\u2026":H?.completed?"Reopen":"Mark complete"})]}),m(lt,{open:Me,onClose:()=>te(!1)}),m(dt,{open:me,issues:J,totalCells:pe.current,onClose:()=>G(!1),onPick:b=>{let y=T.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select()),G(!1)}})]})}var Je=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],Ge=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],ne=null,ie=null,se=null;async function fe(n,e){ne||(ne=e.listAllDataElements().then(i=>new Map(i.map(a=>[a.id,a])))),ie||(ie=e.listAllCategoryCombos().then(i=>new Map(i.map(a=>[a.id,a])))),se||(se=e.listAllCategoryOptionCombos().then(i=>{let a=new Map;for(let u of i){let r=u.categoryCombo?.id;if(!r)continue;let d=a.get(r);d?d.push(u):a.set(r,[u])}return a}));let[c,o,l]=await Promise.all([ne,ie,se]),s=i=>{if(!i?.id)return;let a=o.get(i.id),u=l.get(i.id)??[];return a?{id:a.id,name:a.name??a.displayName,categoryOptionCombos:u.map(r=>({id:r.id,name:r.name??r.displayName,categoryOptions:r.categoryOptions??[]})),categories:(a.categories??[]).map(r=>({id:r.id,name:r.name??r.displayName,categoryOptions:(r.categoryOptions??[]).map(d=>({id:d.id,name:d.name??d.displayName}))}))}:i},t=i=>{let a=c.get(i.id);return a?{id:a.id,name:a.name??a.displayName,formName:a.formName,valueType:a.valueType,categoryCombo:s(a.categoryCombo)}:i};return{...n,categoryCombo:s(n.categoryCombo)??n.categoryCombo,dataSetElements:(n.dataSetElements??[]).map(i=>({...i,dataElement:i.dataElement?t(i.dataElement):void 0})),sections:(n.sections??[]).map(i=>({...i,dataElements:(i.dataElements??[]).map(a=>t(a))}))}}function be(n){let e={};for(let i of n.dataSetElements??[])i.dataElement&&(e[i.dataElement.id]=i.dataElement);let c={};for(let i of n.indicators??[])c[i.id]=i;let o=(n.sections??[]).slice().sort((i,a)=>(i.sortOrder??0)-(a.sortOrder??0));if(!o.some(i=>(i.dataElements?.length??0)>0)){let i=(n.dataSetElements??[]).map(a=>a.dataElement).filter(a=>!!a);o=[{id:n.id,name:n.displayName??n.name??"Data entry",sortOrder:0,dataElements:i,indicators:[],greyedFields:[]}]}let s=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),t=[];for(let i of o){let a=new Set;for(let r of i.greyedFields??[])r.dataElement?.id&&r.categoryOptionCombo?.id&&a.add(`${r.dataElement.id}:${r.categoryOptionCombo.id}`);t.push(`<h3 class="formSection">${s(i.name??"")}</h3>`);let u=new Map;for(let r of i.dataElements??[]){let d=e[r.id];if(!d?.categoryCombo)continue;let p=d.categoryCombo.id,g=u.get(p);g||(g={cc:d.categoryCombo,des:[]},u.set(p,g)),g.des.push(d)}for(let r of u.values()){let d=r.cc.categoryOptionCombos??[],p=r.cc.categories??[];t.push('<div class="der-de-table-scroll">'),t.push('<table class="sectionTable" cellspacing="0">');let g=We(p,d);if(t.push("<thead>"),g.length>0)for(let f=0;f<g.length;f++){t.push("<tr>"),f===0&&t.push(`<th class="dataElementCell" rowspan="${g.length}">Data elements</th>`);for(let v of g[f]??[])t.push(`<th colspan="${v.span}">${s(v.label)}</th>`);t.push("</tr>")}else{t.push("<tr>"),t.push('<th class="dataElementCell">Data elements</th>');for(let f of d)t.push(`<th>${s(f.name??"")}</th>`);t.push("</tr>")}t.push("</thead><tbody>");for(let f of r.des){t.push("<tr>"),t.push(`<td class="dataElementCell" id="${s(f.id)}-cell">`+s(f.formName??f.name??f.id)+"</td>");for(let v of d){let h=`${f.id}-${v.id}-val`;a.has(`${f.id}:${v.id}`)?t.push('<td class="greyed">\u2014</td>'):t.push(`<td><input type="text" id="${s(h)}" name="${s(h)}" dataelementid="${s(f.id)}" optioncomboid="${s(v.id)}"></td>`)}t.push("</tr>")}for(let f of i.indicators??[]){let v=c[f.id];v&&(t.push('<tr class="indicatorRow">'),t.push(`<td class="dataElementCell">${s(v.name??v.id)}</td>`),t.push(`<td colspan="${d.length}"><input type="text" name="indicator" indicatorid="${s(v.id)}" readonly></td>`),t.push("</tr>"))}t.push("</tbody></table></div>")}}return t.join(`
`)}function We(n,e){if(n.length===0||e.length===0)return[];let c=new Map;for(let t of n)for(let i of t.categoryOptions??[])c.set(i.id,{catId:t.id,name:i.name??i.id});let o=n.length,l=e.map(t=>{let i=new Array(o).fill("");for(let a of t.categoryOptions??[]){let u=c.get(a.id);if(!u)continue;let r=n.findIndex(d=>d.id===u.catId);r>=0&&(i[r]=u.name)}return i});for(let t of l)if(t.some(i=>i===""))return[];let s=[];for(let t=0;t<o;t++){let i=[];for(let a=0;a<l.length;){let u=l[a],r=a+1;for(;r<l.length;){let d=l[r],p=!0;for(let g=0;g<=t;g++)if(u[g]!==d[g]){p=!1;break}if(!p)break;r++}i.push({label:u[t]??"",span:r-a}),a=r}s.push(i)}return s}function Ze(n){let e=globalThis;e.dhis2=e.dhis2??{};let c=e.dhis2;c.de=c.de??{};let o=c.de;o.currentDataSetId=n.dataSetId,o.currentOrganisationUnitId=n.orgUnitId,o.currentPeriodId=n.periodId,o.currentCategorySelections={...n.aocSelections??{}};let l=n.meta??{},s={},t={};if(l.categoryCombo){t[l.categoryCombo.id]=l.categoryCombo;for(let d of l.categoryCombo.categories??[])s[d.id]=d}o.categories=s,o.categoryCombos=t;let i={},a={};for(let d of l.dataSetElements??[]){let p=d.dataElement;p&&(i[p.id]=p,p.optionSet&&(a[p.optionSet.id]=p.optionSet),p.categoryCombo&&(t[p.categoryCombo.id]=p.categoryCombo))}o.dataElements=i,o.optionSets=a;let u={};for(let d of l.indicators??[])u[d.id]={explodedNumerator:d.numerator,denominator:d.denominator,factor:d.indicatorType?.factor??1};o.indicatorFormulas=u;let r={};for(let d of n.validationRules??[])r[d.id]=d;o.validationRules=r,o.lockExceptions=[],o.emptyOrganisationUnits=[],o.significantZeros=[],o.dataSets={[l.id]:{id:l.id,name:l.name??l.displayName??"",periodType:l.periodType,categoryCombo:l.categoryCombo?.id,periodId:n.periodId}},e.DHIS2_BASE_URL=`${window.location.origin}/`,c.shim=c.shim??{},c.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Ye(){let n=globalThis;if(n.$&&typeof n.$.ajaxSetup=="function"&&n.$.ajaxSetup({beforeSend:(e,c)=>{c.xhrFields={...c.xhrFields??{},withCredentials:!0}}}),n.dhis2?.period&&n.$?.calendars?.instance){let e=n.dhis2.period;e.format="yyyy-mm-dd",e.calendar=n.$.calendars.instance("gregorian"),e.PeriodGenerator&&(e.generator=new e.PeriodGenerator(e.calendar,e.format)),e.DatePicker&&(e.picker=new e.DatePicker(e.calendar,e.format))}}function Xe(n,e){if(!n)return;for(let[o,l]of Object.entries(e)){let s=n.querySelector(`input[data-der-category="${o}"]`);s||(s=document.createElement("input"),s.type="hidden",s.id=`category-${o}`,s.setAttribute("data-der-category",o),n.appendChild(s)),s.value=l}let c=globalThis;c.dhis2?.de&&(c.dhis2.de.currentCategorySelections={...e})}function Ke(n,e,c,o,l,s,t){let i=d=>{let p=/^(.+)-(.+)-val$/.exec(d);return p?{de:p[1],coc:p[2]}:null},a=new WeakMap,u=n.querySelectorAll('input[name$="-val"]');for(let d of Array.from(u))a.set(d,d.value);let r=async d=>{let p=d.target;if(!p||p.tagName!=="INPUT")return;let g=p.getAttribute("name")??"",f=i(g);if(!f)return;let v=e(),h=c(),N=o();if(!v||!h||!N)return;let _=p.value;if(a.get(p)!==_){de(p,"saving");try{let A=await s.submitAggregate({dataSet:v,period:h,orgUnit:N,attributeOptionComboSelections:l(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:_}]});a.set(p,_);let T=A?.status==="OFFLINE_QUEUED"?"queued":"saved";de(p,T),t?.(T)}catch{de(p,"error")}}};n.addEventListener("blur",d=>{r(d)},!0)}function et(n){n.addEventListener("keydown",e=>{let c=e;if(c.key!=="Enter")return;let o=c.target;if(!(o instanceof HTMLInputElement))return;let l=o.getAttribute("name")??"",s=/^(.+)-(.+)-val$/.exec(l);if(!s)return;c.preventDefault();let t=s[2],i=Array.from(n.querySelectorAll(`input[name$="-${t}-val"]`)),a=i.indexOf(o);if(a===-1)return;let u=i[a+(c.shiftKey?-1:1)];u?.focus(),u instanceof HTMLInputElement&&u.select()})}function tt(n){let e=Array.from(n.querySelectorAll("h2, h3, h4")).filter(s=>(s.textContent??"").trim().length>0);if(e.length<2)return[];let c=new Set(e),o=[],l=(s,t)=>{for(let i of c)if(i!==t&&s.contains(i))return!0;return!1};return e.forEach((s,t)=>{let i=s.id||`der-de-section-${t}`;s.id=i;let a=null,u=s.parentElement,r=null;for(;u&&u!==n&&!l(u,s);)r=u,u=u.parentElement;if(r&&r.children.length>1&&r!==n)a=r,a.classList.add("der-de-section-slot"),a.dataset.sectionId=i;else{a=document.createElement("div"),a.className="der-de-section-slot",a.dataset.sectionId=i;let d=e[t+1]??null,p=[],g=s;for(;g&&g!==d;){let f=g.nextSibling;p.push(g),g=f}s.parentNode?.insertBefore(a,s);for(let f of p)a.appendChild(f)}o.push({id:i,label:(s.textContent??"").trim(),slot:a})}),o}function rt({targetRef:n,formVersion:e}){let[c,o]=C([]),[l,s]=C(""),[t,i]=C({});return R(()=>{let a=n.current;if(!a)return;let u=tt(a);o(u),s(u[0]?.id??"")},[n,e]),R(()=>{if(c.length===0)return;let a=()=>{let d={};for(let p of c){let g=Array.from(p.slot.querySelectorAll('input[name$="-val"]')),f=g.filter(v=>v.value.trim()!=="").length;d[p.id]={filled:f,total:g.length}}i(d)};a();let u=n.current;if(!u)return;let r=d=>{let p=d.target;p&&p.tagName==="INPUT"&&/-val$/.test(p.getAttribute("name")??"")&&a()};return u.addEventListener("input",r,!0),()=>{u.removeEventListener("input",r,!0)}},[n,c]),R(()=>{if(!n.current||c.length===0)return;for(let r of c)r.slot.style.display=r.id===l?"":"none";let u=c.find(r=>r.id===l);u&&u.slot.scrollIntoView({behavior:"smooth",block:"start"})},[n,c,l]),c.length<2?null:x("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[m("div",{className:"der-de-section-nav__title",children:"Sections"}),m("ul",{className:"der-de-section-nav__list",children:c.map(a=>{let u=t[a.id],r=!u||u.total===0||u.filled===0?"muted":u.filled===u.total?"done":"partial";return m("li",{children:x("button",{type:"button",className:"der-de-section-nav__item"+(l===a.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>s(a.id),children:[m("span",{className:"der-de-section-nav__label",children:a.label}),u&&u.total>0&&m("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${r}`,"data-test":"de-section-nav-ratio",title:`${u.filled} of ${u.total} cells filled`,children:r==="done"?"\u2713":`${u.filled}/${u.total}`})]})},a.id)})})]})}function ot({root:n,formVersion:e}){let[c,o]=C({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(R(()=>{let t=()=>{let a=n.current;if(!a)return;let u=Array.from(a.querySelectorAll('input[name$="-val"]')),r=0,d=0,p=0,g=0,f=0;for(let v of u){v.value.trim()!==""&&r++;let h=v.style.outline||"";h.includes("rgb(185, 134, 10)")||h.includes("#b9860a")?d++:h.includes("rgb(206, 123, 0)")||h.includes("#ce7b00")?g++:h.includes("rgb(26, 135, 84)")||h.includes("#1a8754")||h.includes("rgb(183, 220, 199)")||h.includes("#b7dcc7")?p++:(h.includes("rgb(169, 50, 50)")||h.includes("#a93232"))&&f++}o({total:u.length,filled:r,saving:d,saved:p,queued:g,error:f})};t();let i=window.setInterval(t,800);return()=>window.clearInterval(i)},[n,e]),c.total===0)return m("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let l=[];l.push(`${c.filled} of ${c.total} filled`),c.saving>0&&l.push(`${c.saving} saving`),c.queued>0&&l.push(`${c.queued} queued`),c.error>0&&l.push(`${c.error} error`);let s=c.error>0?"error":c.queued>0?"queued":c.saving>0?"saving":c.filled>0?"saved":"muted";return m("span",{className:`der-de-savepill der-de-savepill--${s}`,"data-test":"de-save-state",children:l.join(" \xB7 ")})}function at({details:n,formSync:e}){let c={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on:",queued:"Queued for sync",error:"Rejected"},o={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return m("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:m("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:n?x(Nt,{children:[m("span",{className:"der-de-live-strip__de",children:n.deName}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__coc",children:n.cocName}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:"der-de-live-strip__value",children:n.value||m("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),m("span",{className:"der-de-live-strip__sep",children:"\xB7"}),m("span",{className:`der-de-live-strip__state der-de-live-strip__state--${o[n.saveState]}`,children:c[n.saveState]}),m(nt,{formSync:e,cellState:n.saveState}),n.compulsory&&m("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):m("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function nt({formSync:n,cellState:e}){let c=e==="saved"||e==="queued",o=e==="saved"||e==="queued"?"lit":e==="saving"?"pending":e==="error"?"error":"muted",l=n.central,s=c?l==="CENTRAL_ACCEPTED"?"lit":l==="PENDING"||l==="IN_FLIGHT"||l==="RETRYABLE"||l==="UNKNOWN_OUTCOME"?"pending":l==="CENTRAL_REJECTED"||l==="CONFLICT_REVIEW"||l==="QUARANTINED"||l==="REQUIRES_APPROVAL"?"error":"muted":"muted",t=o==="lit"?"Saved on edge (DER)":o==="pending"?"Saving on edge\u2026":o==="error"?"Rejected by edge":"No value entered yet",i=s==="lit"?"Synced to Central DHIS2":s==="pending"?`Sync in progress (${l})`:s==="error"?`Central reported ${l}`:c?"Awaiting Central sync":"No value entered yet";return x("span",{className:"der-de-sync-logos","data-test":"de-sync-logos","aria-label":"Save + sync status",children:[x("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--der is-"+o,title:t,"data-test":"de-sync-der","data-state":o,children:[m(it,{}),m("span",{className:"der-de-sync-logos__label",children:"DER"})]}),x("span",{className:"der-de-sync-logos__pin der-de-sync-logos__pin--central is-"+s,title:i,"data-test":"de-sync-central","data-state":s,children:[m(st,{}),m("span",{className:"der-de-sync-logos__label",children:"DHIS2"})]})]})}function it(){return m("svg",{viewBox:"0 0 1254 1254",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:x("g",{fill:"currentColor",fillRule:"evenodd",children:[m("path",{d:"M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z"}),m("path",{d:"M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z"}),m("path",{d:"M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z"}),m("path",{d:"M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z"}),m("path",{d:"M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z"}),m("path",{d:"M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z"}),m("path",{d:"M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z"}),m("path",{d:"M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z"}),m("path",{d:"M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z"}),m("path",{d:"M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z"}),m("path",{d:"M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z"}),m("path",{d:"M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z"}),m("path",{d:"M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z"})]})})}function st(){return m("svg",{viewBox:"0 0 200 182",width:"14",height:"14","aria-hidden":"true",className:"der-de-sync-logos__svg",children:x("g",{fill:"currentColor",children:[m("path",{d:"M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z"}),m("path",{d:"M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z"}),m("path",{d:"M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z"})]})})}function dt({open:n,issues:e,totalCells:c,onClose:o,onPick:l}){if(R(()=>{if(!n)return;let t=i=>{i.key==="Escape"&&o()};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[n,o]),!n)return null;let s=e.length===0;return m("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:t=>{t.target===t.currentTarget&&o()},children:x("div",{className:"der-de-validation "+(s?"der-de-validation--ok":"der-de-validation--err"),children:[x("header",{className:"der-de-validation__head",children:[x("div",{className:"der-de-validation__title",children:[m("span",{className:"der-de-validation__badge","aria-hidden":"true",children:s?"\u2713":"!"}),m("h3",{className:"der-de-validation__heading",children:s?`Validation passed \u2014 all ${c} cells OK.`:`Validation found ${e.length} issue${e.length===1?"":"s"} across ${c} cells.`})]}),m("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:o,children:"\xD7"})]}),m("div",{className:"der-de-validation__body",children:s?x("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",m("strong",{children:" Mark complete"})," when you're ready."]}):x("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[m("thead",{children:x("tr",{children:[m("th",{scope:"col",children:"Data element"}),m("th",{scope:"col",children:"Category option combo"}),m("th",{scope:"col",children:"Entered value"}),m("th",{scope:"col",children:"Problem"}),m("th",{scope:"col"})]})}),m("tbody",{children:e.map(t=>x("tr",{"data-test":"de-issues-row",children:[m("td",{children:t.deName}),m("td",{className:"der-de-validation__coc",children:t.cocName}),m("td",{children:m("code",{className:"der-de-validation__value",children:t.value||"\u2014"})}),m("td",{className:"der-de-validation__why",children:t.problem}),m("td",{className:"der-de-validation__jump",children:m("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>l(t),children:"Jump to cell \u2192"})})]},`${t.deId}-${t.cocId}`))})]})})]})})}function lt({open:n,onClose:e}){return R(()=>{if(!n)return;let o=l=>{l.key==="Escape"&&e()};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[n,e]),n?m("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:o=>{o.target===o.currentTarget&&e()},children:x("div",{className:"der-de-shortcuts",children:[x("header",{className:"der-de-shortcuts__head",children:[m("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),m("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:e,children:"\xD7"})]}),m("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([o,l])=>x("div",{className:"der-de-shortcuts__row",children:[m("dt",{children:m("kbd",{children:o})}),m("dd",{children:l})]},o))})]})}):null}function ct(n,e){n.addEventListener("paste",c=>{let o=c.target;if(!o||o.tagName!=="INPUT")return;let l=o.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(l))return;let t=c.clipboardData?.getData("text/plain")??"",i=/\r?\n/.test(t),a=/\t/.test(t);if(!i&&!a)return;let u=t.split(/\r?\n/).filter((_,A,T)=>!(A===T.length-1&&_==="")).map(_=>_.split("	").map(A=>A.trim()));if(u.length===0)return;c.preventDefault();let r=o.closest("[data-section-id]")??n,p=Array.from(r.querySelectorAll("tbody tr")).map(_=>Array.from(_.querySelectorAll('input[name$="-val"]'))),g=-1,f=-1;for(let _=0;_<p.length;_++){let A=p[_].indexOf(o);if(A!==-1){g=_,f=A;break}}if(g===-1)return;let v=0,h=0;for(let _=0;_<u.length;_++){let A=u[_],T=p[g+_];if(!T){h+=A.length;continue}for(let P=0;P<A.length;P++){let M=T[f+P];if(!M){h++;continue}M.value=A[P]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),v++}}let N=u.length===1?`${u[0].length}-cell row`:u[0]?.length===1?`${u.length}-cell column`:`${u.length}\xD7${u[0]?.length??0} block`;e({kind:"ok",message:`Pasted ${v} value${v===1?"":"s"} (${N}${h>0?`, ${h} overflow`:""}).`})},!0)}function ut(n){let e=Array.from(n.querySelectorAll('input[name="total"][dataelementid]'));if(e.length===0)return;let c=[];for(let o of e){let l=o.getAttribute("dataelementid")??"";if(!l)continue;let s=o.closest("div"),i=(()=>{let r=s??o.parentElement;if(!r)return null;let d=r.previousElementSibling;for(;d;){if(/^(H1|H2|H3|H4)$/.test(d.tagName)||d.tagName==="DIV"&&!d.querySelector("table, input")&&(d.textContent??"").trim().length>0)return d;d=d.previousElementSibling}let p=r.closest("[data-section-id]");if(p){let g=p.querySelector("h2, h3, h4");if(g)return g}return null})();if(!i)continue;s?.remove();let a=document.createElement("span");a.className="der-de-matrix-total",a.setAttribute("data-de",l),i.appendChild(a);let u=()=>{let r=0,d=!1,p=Array.from(n.querySelectorAll(`input[dataelementid="${l}"][name$="-val"],input[name^="${l}-"][name$="-val"]`)),g=new Set;for(let f of p){if(g.has(f))continue;g.add(f);let v=parseFloat(f.value);Number.isFinite(v)&&(r+=v,d=!0)}if(d){let f=Number.isInteger(r)?r:Number(r.toFixed(2));a.textContent=` (Total: ${f})`}else a.textContent=""};c.push(u),u()}c.length!==0&&n.addEventListener("input",o=>{let l=o.target;if(!(!l||l.tagName!=="INPUT")&&/-val$/.test(l.getAttribute("name")??""))for(let s of c)s()},!0)}function mt(n,e){let c=e.indicators??[];if(c.length===0)return;let o=c.filter(r=>r.numerator&&r.denominator).map(r=>({id:r.id,factor:r.indicatorType?.factor??1,numExpr:r.numerator,denExpr:r.denominator}));if(o.length===0)return;let l=Array.from(n.querySelectorAll("input[indicatorid]")),s=new Map;for(let r of Array.from(n.querySelectorAll('input[name$="-val"]')))s.set(r.getAttribute("name")??"",r);let t=r=>{let d=0;for(let[p,g]of s){if(!p.startsWith(`${r}-`))continue;let f=parseFloat(g.value);Number.isFinite(f)&&(d+=f)}return d},i=r=>r.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(d,p,g)=>{if(g){let f=s.get(`${p}-${g}-val`),v=parseFloat(f?.value??"");return Number.isFinite(v)?String(v):"0"}return String(t(p))}),a=r=>{if(!/^[\s\d+\-*/().eE]+$/.test(r))return NaN;try{return Function(`"use strict";return (${r})`)()}catch{return NaN}},u=()=>{for(let r of o){let d=a(i(r.numExpr)),p=a(i(r.denExpr)),g=l.find(v=>v.getAttribute("indicatorid")===r.id);if(!g)continue;if(!Number.isFinite(d)||!Number.isFinite(p)||p===0){g.value="";continue}let f=d/p*r.factor;g.value=Number.isInteger(f)?String(f):f.toFixed(2)}};n.addEventListener("input",r=>{let d=r.target;d&&d.tagName==="INPUT"&&d.hasAttribute("name")&&/-val$/.test(d.getAttribute("name")??"")&&u()},!0),u()}function pt(n,e){let c={};for(let o of e.dataSetElements??[])o.dataElement&&(c[o.dataElement.id]=o.dataElement);for(let o of Array.from(n.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(o.getAttribute("name")??"");if(!l)continue;let s=c[l[1]],t=s?.formName??s?.name??l[1],i=s?.categoryCombo?.categoryOptionCombos?.find(u=>u.id===l[2]),a=i?.name??i?.displayName??l[2];o.hasAttribute("aria-label")||o.setAttribute("aria-label",a===l[2]?`${t}`:`${t}, ${a}`),o.getAttribute("data-compulsory")==="1"&&o.setAttribute("aria-required","true")}}function gt(n,e){let c=e.compulsoryDataElementOperands??[],o=new Set;for(let l of c){let s=l.dimensionItem;if(!s)continue;let t=s.split(".");t.length===2&&o.add(`${t[0]}:${t[1]}`)}if(o.size!==0)for(let l of Array.from(n.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(l.getAttribute("name")??"");s&&o.has(`${s[1]}:${s[2]}`)&&l.setAttribute("data-compulsory","1")}}function ft(n,e,c){let o={};for(let s of e.dataSetElements??[])s.dataElement&&(o[s.dataElement.id]=s.dataElement);let l=s=>{let t=s.getAttribute("name")??s.id??"",i=/^(.+)-(.+)-val$/.exec(t);if(!i)return null;let a=i[1],u=i[2],r=o[a],d=r?.categoryCombo,p=d?.categoryOptionCombos?.find(A=>A.id===u),g=[],f=p?.name??p?.displayName??u,v=f.split(/,\s*/).filter(Boolean),h=d?.categories??[];v.forEach((A,T)=>{g.push({category:h[T]?.name??h[T]?.displayName??"",option:A})});let N=s.style.outline||"",_=N.includes("rgb(185, 134, 10)")||N.includes("#b9860a")?"saving":N.includes("rgb(206, 123, 0)")||N.includes("#ce7b00")?"queued":N.includes("rgb(26, 135, 84)")||N.includes("#1a8754")||N.includes("rgb(183, 220, 199)")||N.includes("#b7dcc7")?"saved":N.includes("rgb(169, 50, 50)")||N.includes("#a93232")?"error":s.value.trim()===""?"empty":"saved";return{deId:a,cocId:u,deName:r?.name??a,deFormName:r?.formName,valueType:r?.valueType??"TEXT",optionSetId:r?.optionSet?.id,cocName:f,categoryBreakdown:g,value:s.value,saveState:_,inputName:t,compulsory:s.getAttribute("data-compulsory")==="1"}};n.addEventListener("focusin",s=>{let t=s.target;if(t&&t.tagName==="INPUT"){let i=l(t);i&&c(i)}},!0),n.addEventListener("input",s=>{let t=s.target;if(t&&t.tagName==="INPUT"){let i=l(t);i&&c(i)}},!0)}function bt(n,e,c){if(!n)return;let o=globalThis,l=o.dhis2?.de?.dataElements??{},s=o.dhis2?.de?.categoryOptionCombos??{},t=Array.from(n.querySelectorAll('input[name$="-val"]')),i=[];for(let a of t){a.style.outline="";let u=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");if(!u)continue;let r=u[1],d=u[2],p=l[r],g=p?.valueType??"TEXT",f=a.value.trim();if(f===""){a.getAttribute("data-compulsory")==="1"&&(a.style.outline="2px solid #c0392b",i.push({deId:r,cocId:d,valueType:g,value:"",problem:"compulsory value missing",deName:p?.name??r,cocName:s[d]?.name??d,inputName:a.name}));continue}let v=yt(f,g);v&&(a.style.outline="2px solid #c0392b",i.push({deId:r,cocId:d,valueType:g,value:f,problem:v,deName:p?.name??r,cocName:s[d]?.name??d,inputName:a.name}))}c(i,t.length),e({kind:"idle"})}function yt(n,e){let c=Number(n),o=Number.isInteger(c);switch(e){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(c))return"must be a number";break}switch(e){case"INTEGER":if(!o)return"must be an integer";break;case"INTEGER_POSITIVE":if(!o||c<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!o||c>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!o||c<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(c<0||c>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(c<0||c>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(n.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(n.toLowerCase()))return"must be yes";break;case"URL":try{new URL(n)}catch{return"must be a valid URL"}break;default:break}return null}function de(n,e){let c=e==="saving"?"#b9860a":e==="saved"?"#1a8754":e==="queued"?"#ce7b00":"#a93232";n.style.outline=`2px solid ${c}`,n.style.transition="outline 150ms",e==="queued"?n.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):n.removeAttribute("title"),e==="saved"&&window.setTimeout(()=>{n.style.outline.includes("#1a8754")&&(n.style.outline="1px solid #b7dcc7")},1200)}async function ht(n,e,c,o,l){if(!e||!c||!o)return;let s;try{s=(await l.readAggregateValues(o,c,2e3)).dataValues??[]}catch{return}for(let t of s){let i=t.dataElement,a=t.categoryOptionCombo,u=t.value;if(!i||!a||u==null)continue;let r=n.querySelector(`input[name="${i}-${a}-val"]`);r&&(r.value=u)}}function _e(n){return new Promise((e,c)=>{let o=document.createElement("script");o.src=n,o.async=!1,o.setAttribute("data-der-custom-form",n),o.onload=()=>e(),o.onerror=()=>c(new Error(`failed to load ${n}`)),document.head.appendChild(o)})}function we(n){if(document.querySelector(`link[data-der-custom-form="${n}"]`))return;let e=document.createElement("link");e.rel="stylesheet",e.href=n,e.setAttribute("data-der-custom-form",n),document.head.appendChild(e)}function ye(n){return!n||/^https?:\/\//i.test(n)||n.startsWith("/legacy-custom-forms/")||n.startsWith("/")?n:`/legacy-custom-forms/${n.replace(/^(?:\.{1,2}\/)+/,"")}`}async function vt(n,e,c={}){let o=c.stripStyles??!0;n.classList.toggle("der-de-custom-form--author",!o);let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${e}</body></html>`,"text/html");for(let t of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(t.tagName==="LINK"){let i=t.getAttribute("href")??"";i&&we(ye(i))}else{let i=document.createElement("style");i.textContent=t.textContent??"",i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i)}t.remove()}let s=[];for(let t of Array.from(l.querySelectorAll("script"))){let i=t.getAttribute("src");i?s.push({src:ye(i)}):s.push({code:t.textContent??""}),t.remove()}for(let t of Array.from(l.body.querySelectorAll("*"))){if(o&&t.removeAttribute("style"),t.tagName==="INPUT"){let i=t.getAttribute("id")??"";i.endsWith("-val")&&t.getAttribute("name")!==i&&t.setAttribute("name",i)}if(o&&t.tagName==="TH"){let i=(t.textContent??"").trim();(i==="Reporting item"||i==="Reported count")&&(t.textContent=i==="Reporting item"?"Data elements":"Value")}}for(let t of Array.from(l.body.childNodes))n.appendChild(document.adoptNode(t));for(let t of s)if(t.src)document.querySelector(`script[data-der-custom-form="${t.src}"]`)||await _e(t.src);else if(t.code){let i=document.createElement("script");i.textContent=t.code,i.setAttribute("data-der-custom-form","inline"),document.head.appendChild(i),i.remove()}}var le={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},he={padding:"6px 16px",border:"1px solid #0a5497",background:"#147CD7",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ve={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},xt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},_t={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function wt(n,e,c,o=new Set,l=new Set,s=0){let t=(h,N)=>o.has(h)?`\u2713  ${N}`:l.has(h)?`\u25CF  ${N}`:N,i={...le},a=ke(n,s);if(a.length===0)return m("input",{value:e,onChange:h=>c(h.target.value),placeholder:n?`DHIS2 ${n} period id`:"e.g. 202611",style:i});let u=[...a];if(e&&!u.some(h=>h.id===e)){let h=kt(n,e)??e;u.unshift({id:e,label:h})}let r=a[0]?.id??null,d=u.findIndex(h=>h.id===e),p=d===-1||d<u.length-1||!!n,g=e!==""&&(d>0||e!==r),f=()=>{if(!n)return;let h=d>=0&&d<u.length-1?u[d+1]?.id??"":xe(n,e||r||"",-1);h&&c(h)},v=()=>{if(!n||!e||e===r)return;let h=d>0?u[d-1]?.id??"":xe(n,e,1);h&&c(h)};return x("span",{className:"der-de-period-nav",children:[m("button",{type:"button","aria-label":"Previous period",onClick:f,disabled:!p,className:"der-de-period-btn",children:"\u25C0"}),x("select",{value:e,onChange:h=>c(h.target.value),style:i,children:[m("option",{value:"",children:"Select a period\u2026"}),u.map(h=>m("option",{value:h.id,children:t(h.id,h.label)},h.id))]}),m("button",{type:"button","aria-label":"Next period",onClick:v,disabled:!g,className:"der-de-period-btn",children:"\u25B6"})]})}function xe(n,e,c){let o=l=>String(l).padStart(2,"0");switch(n){case"Daily":{if(!/^\d{8}$/.test(e))return"";let l=Number(e.slice(0,4)),s=Number(e.slice(4,6))-1,t=Number(e.slice(6,8)),i=new Date(l,s,t+c);return`${i.getFullYear()}${o(i.getMonth()+1)}${o(i.getDate())}`}case"Weekly":{let l=/^(\d{4})W(\d{1,2})$/.exec(e);if(!l)return"";let s=Number(l[1]),t=Number(l[2])+c;return t<1?(s-=1,t=W(s)):t>W(s)&&(s+=1,t=1),`${s}W${t}`}case"Monthly":{if(!/^\d{6}$/.test(e))return"";let l=Number(e.slice(0,4)),s=Number(e.slice(4,6))-1,t=l*12+s+c;return`${Math.floor(t/12)}${o((t%12+12)%12+1)}`}case"BiMonthly":{let l=/^(\d{4})(\d{2})B$/.exec(e);if(!l)return"";let s=Number(l[1]),t=Number(l[2])+c;return t<1?(s-=1,t=6):t>6&&(s+=1,t=1),`${s}${o(t)}B`}case"Quarterly":{let l=/^(\d{4})Q(\d)$/.exec(e);if(!l)return"";let s=Number(l[1]),t=Number(l[2])+c;return t<1?(s-=1,t=4):t>4&&(s+=1,t=1),`${s}Q${t}`}case"SixMonthly":{let l=/^(\d{4})S(\d)$/.exec(e);if(!l)return"";let s=Number(l[1]),t=Number(l[2])+c;return t<1?(s-=1,t=2):t>2&&(s+=1,t=1),`${s}S${t}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?String(Number(e)+c):"";default:return""}}function kt(n,e){let c=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(n){case"Daily":return/^\d{8}$/.test(e)?`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`:null;case"Weekly":{let o=/^(\d{4})W(\d{1,2})$/.exec(e);return o?`${o[1]} W${String(o[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(e))return null;let o=Number(e.slice(4,6))-1;return`${c[o]??""} ${e.slice(0,4)}`}case"BiMonthly":{let o=/^(\d{4})(\d{2})B$/.exec(e);if(!o)return null;let l=(Number(o[2])-1)*2;return`${c[l]}\u2013${c[l+1]} ${o[1]}`}case"Quarterly":return e.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let o=/^(\d{4})S(\d)$/.exec(e);return o?`${o[1]} ${o[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(e)?e:null;default:return null}}function ke(n,e=0){let c=new Date,o=c.getFullYear(),l=c.getMonth(),s=a=>String(a).padStart(2,"0"),t=["January","February","March","April","May","June","July","August","September","October","November","December"],i=Math.max(0,1-Math.max(0,e));switch(n){case"Daily":{let a=[];for(let u=i;u<30+i;u++){let r=new Date(c);r.setDate(r.getDate()-u);let d=`${r.getFullYear()}${s(r.getMonth()+1)}${s(r.getDate())}`,p=`${r.getFullYear()}-${s(r.getMonth()+1)}-${s(r.getDate())}`;a.push({id:d,label:p})}return a}case"Weekly":{let a=[],u=Ee(c),r=u.year,d=u.week;for(let p=0;p<i;p++)d-=1,d<1&&(r-=1,d=W(r));for(let p=0;p<12;p++)a.push({id:`${r}W${d}`,label:`${r} W${s(d)}`}),d-=1,d<1&&(r-=1,d=W(r));return a}case"Monthly":{let a=[];for(let u=i;u<24+i;u++){let r=o,d=l,p=r*12+d-u,g=Math.floor(p/12),f=(p%12+12)%12;a.push({id:`${g}${s(f+1)}`,label:`${t[f]} ${g}`})}return a}case"BiMonthly":{let a=[],u=Math.floor(l/2)+1,r=o,d=u;for(let p=0;p<i;p++)d-=1,d<1&&(r-=1,d=6);for(let p=0;p<12;p++){let g=(d-1)*2;a.push({id:`${r}${s(d)}B`,label:`${t[g]}\u2013${t[g+1]} ${r}`}),d-=1,d<1&&(r-=1,d=6)}return a}case"Quarterly":{let a=[],u=Math.floor(l/3)+1,r=o,d=u;for(let p=0;p<i;p++)d-=1,d<1&&(r-=1,d=4);for(let p=0;p<8;p++)a.push({id:`${r}Q${d}`,label:`${r} Q${d}`}),d-=1,d<1&&(r-=1,d=4);return a}case"SixMonthly":{let a=[],u=l<6?1:2,r=o,d=u;for(let p=0;p<i;p++)d-=1,d<1&&(r-=1,d=2);for(let p=0;p<6;p++)a.push({id:`${r}S${d}`,label:`${r} ${d===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),d-=1,d<1&&(r-=1,d=2);return a}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let a=[];for(let u=i;u<10+i;u++){let r=o-u;a.push({id:String(r),label:String(r)})}return a}default:return[]}}function Ee(n){let e=new Date(n.getFullYear(),n.getMonth(),n.getDate()),c=e.getDay()===0?7:e.getDay();e.setDate(e.getDate()+4-c);let o=new Date(e.getFullYear(),0,1),s=Math.round((e.getTime()-o.getTime())/864e5);return{year:e.getFullYear(),week:Math.ceil((s+1)/7)}}function W(n){return Ee(new Date(n,11,28)).week}var Et=`
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
  color: #9097a8;
  background: #f0f2f6;
  border-color: #e5e8ef;
}
.der-de-sync-logos__pin.is-lit {
  color: #1b8243;
  background: #e5f4ea;
  border-color: #b5dec4;
}
.der-de-sync-logos__pin.is-pending {
  color: #c6680a;
  background: #fff1dc;
  border-color: #f0ca8a;
}
.der-de-sync-logos__pin.is-error {
  color: #a3322c;
  background: #fbe9e7;
  border-color: #e9b7b2;
}
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
`;export{Qe as default};
