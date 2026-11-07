/* @der-app {"appKey":"data-entry","displayName":"Data entry (Aggregate)","module":"Data","version":"0.1.0-alpha.2","requiresDerApi":"1.0.0"} */
import{useEffect as I,useRef as Z,useState as S}from"react";import{useAuth as De,useOrgUnitBinding as je,useOnlineStatus as Me,useDerApi as Re,ScreenCard as Oe}from"@der/app-sdk";import{Fragment as pt,jsx as u,jsxs as _}from"react/jsx-runtime";function Le(){let o=De(),t=je(),d=Me(),n=Re(),[l,s]=S("custom"),[e,r]=S([]),[a,c]=S(""),[i,m]=S(""),[g,f]=S(""),[p,h]=S(""),[w,k]=S({kind:"idle"}),[v,C]=S(null),T=Z(null),[R,M]=S({}),F=Z({}),[xe,J]=S([]),[O,U]=S(null),[W,ie]=S(!1),[_e,G]=S(new Set),[Y,we]=S(0),[B,ke]=S([]),[se,V]=S(!1),de=Z(0),[Ee,Ne]=S(null),[Se,K]=S(!1);I(()=>{let b=y=>{if(y.key!=="?")return;let E=y.target;E&&(E.tagName==="INPUT"||E.tagName==="TEXTAREA")||(y.preventDefault(),K(x=>!x))};return window.addEventListener("keydown",b),()=>window.removeEventListener("keydown",b)},[]);let[L,Ce]=S(()=>{try{return window.localStorage.getItem("der-de-custom-form-mode")==="author"?"author":"der"}catch{return"der"}});I(()=>{try{window.localStorage.setItem("der-de-custom-form-mode",L)}catch{}},[L]);let[q,Te]=S(()=>{try{return window.localStorage.getItem("der-de-density")??"compact"}catch{return"compact"}});I(()=>{try{window.localStorage.setItem("der-de-density",q)}catch{}},[q]),I(()=>{let b=!1;return(async()=>{try{let y=await n.listDataSets();if(b)return;let E=(y.dataSets??[]).map(x=>({id:x.id,label:x.displayName??x.name??x.id,periodType:x.periodType,formType:x.formType})).sort((x,D)=>x.label.localeCompare(D.label));r(E)}catch{}})(),()=>{b=!0}},[]),I(()=>{if(a.trim()===""){C(null),J([]),M({}),F.current={};return}let b=!1;return(async()=>{try{let y=await n.getDataSetMeta(a.trim());if(b)return;let E=!!y.dataEntryForm&&y.formType==="CUSTOM"||y.formType==="SECTION";C({hasCustomForm:E,formId:y.dataEntryForm?.id,displayName:y.displayName??y.name,formType:y.formType,periodType:y.periodType}),s(E?"custom":"structured");try{let x=await n.getDataSetFormMetadata(a.trim());if(b)return;let D=await ce(x,n);if(b)return;let Q=(D.categoryCombo?.categories??[]).filter(A=>(A.categoryOptions?.length??0)>1).map(A=>({id:A.id,name:A.name??A.id,options:(A.categoryOptions??[]).map($=>({id:$.id,name:$.name??$.id}))}));J(Q);let P={};for(let A of Q)A.options[0]&&(P[A.id]=A.options[0].id);M(P),F.current=P}catch{}}catch{b||C(null)}})(),()=>{b=!0}},[a]),I(()=>{if(l!=="custom"||!v?.hasCustomForm||v.formType==="CUSTOM"&&!v.formId)return;let b=T.current;if(!b)return;let y=!1;return(async()=>{k({kind:"submitting"});try{let E=await n.getDataSetFormMetadata(a.trim());if(y)return;let x=await ce(E,n);if(y)return;let D="";if(v.formType==="CUSTOM"&&v.formId){try{D=(await n.getDataEntryFormHtml(v.formId)).htmlCode??""}catch(N){D="",console.warn("[data-entry] custom htmlCode fetch failed; falling back to SECTION render",N)}D.trim()||(D=me(x))}else v.formType==="SECTION"&&(D=me(x));if(y)return;let Q=await n.listValidationRules(a.trim()).catch(()=>({validationRules:[]}));if(y)return;let P=(x.categoryCombo?.categories??[]).filter(N=>(N.categoryOptions?.length??0)>1).map(N=>({id:N.id,name:N.name??N.id,options:(N.categoryOptions??[]).map(H=>({id:H.id,name:H.name??H.id}))}));J(P);let A={};for(let N of P)N.options[0]&&(A[N.id]=N.options[0].id);M(A),F.current=A,b.replaceChildren();for(let[N,H]of[["selectedDataSetId",a.trim()],["selectedPeriodId",i.trim()],["selectedOrganisationUnitId",t.orgUnitUid??""]]){let j=document.createElement("input");j.type="hidden",j.id=N,j.value=H,b.appendChild(j)}for(let[N,H]of Object.entries(A)){let j=document.createElement("input");j.type="hidden",j.id=`category-${N}`,j.value=H,j.setAttribute("data-der-category",N),b.appendChild(j)}let $=document.createElement("div");$.id="contentDiv",b.appendChild($),Pe({dataSetId:a.trim(),periodId:i.trim(),orgUnitId:t.orgUnitUid??"",meta:x,aocSelections:A,validationRules:Q.validationRules??[]});for(let N of qe)ye(N);for(let N of He)document.querySelector(`script[data-der-custom-form="${N}"]`)||await be(N);Fe(),await st($,D,{stripStyles:L==="der"}),await it($,a.trim(),i.trim(),t.orgUnitUid??"",n),Be($,()=>a.trim(),()=>i.trim(),()=>t.orgUnitUid??"",()=>({...F.current}),n),Ve($),Xe($,k),Ze($),at($,x,Ne),rt($,x),tt($,x),et($,x),we(N=>N+1),k({kind:"idle"})}catch(E){k({kind:"error",message:`custom form failed to render: ${E.message}`})}})(),()=>{y=!0}},[l,v,a,i,t.orgUnitUid,L]);let Ae=t.bound&&a.trim()!==""&&i.trim()!==""&&g.trim()!==""&&p.trim()!==""&&w.kind!=="submitting";async function $e(b){b.preventDefault(),k({kind:"submitting"});try{await n.submitAggregate({dataSet:a,period:i,orgUnit:t.orgUnitUid,dataValues:[{dataElement:g,value:p}]}),k({kind:"ok",message:`Submitted ${g}=${p} for ${i}.`}),f(""),h("")}catch(y){k({kind:"error",message:y.message??"Submission failed"})}}let le=i.trim()!=="",X=a.trim()!=="",z=X&&le&&t.bound;I(()=>{if(!a.trim()||!t.bound||!v?.periodType){G(new Set);return}let b=!1;return(async()=>{let y=he(v.periodType).map(x=>x.id),E=await Promise.all(y.map(async x=>{try{return(await n.getCompletion(a.trim(),t.orgUnitUid??"",x)).completed?x:null}catch{return null}}));b||G(new Set(E.filter(x=>x!==null)))})(),()=>{b=!0}},[a,t.orgUnitUid,v?.periodType]),I(()=>{if(!z){U(null);return}let b=!1;return(async()=>{try{let y=await n.getCompletion(a.trim(),t.orgUnitUid??"",i.trim());if(b)return;U({completed:!!y.completed,completedAt:y.completedAt})}catch{b||U({completed:!1})}})(),()=>{b=!0}},[a,i,t.orgUnitUid,z]);async function Ie(){if(!z||W)return;let b=!O?.completed;if(b){let y=T.current;if(y){let E=[];for(let x of Array.from(y.querySelectorAll('input[data-compulsory="1"]')))x.value.trim()===""&&E.push(x);if(E.length>0){k({kind:"error",message:`Can't mark complete \u2014 ${E.length} compulsory value${E.length===1?"":"s"} still missing. Run Validate to jump to them.`}),E[0]?.scrollIntoView({behavior:"smooth",block:"center"});return}}}ie(!0);try{let y=await n.markCompletion({dataSet:a.trim(),orgUnit:t.orgUnitUid??"",period:i.trim(),completed:b});U({completed:!!y.completed,completedAt:y.completedAt}),G(E=>{let x=new Set(E);return y.completed?x.add(i.trim()):x.delete(i.trim()),x}),k({kind:"ok",message:y.completed?"Dataset marked complete.":"Dataset reopened."})}catch(y){k({kind:"error",message:`Completion failed: ${y.message}`})}finally{ie(!1)}}return _(Oe,{dataTest:"der-aggregate-entry",children:[u("style",{children:ut}),_("div",{className:"der-de-toolbar","data-test":"der-de-toolbar",children:[_("div",{className:"der-de-toolbar__head",children:[u("span",{className:"der-de-toolbar__brand","aria-hidden":"true",children:_("svg",{viewBox:"0 0 128 128",width:"26",height:"26",children:[u("rect",{x:"18",y:"22",width:"92",height:"84",rx:"6",fill:"#eef1ff",stroke:"#4a55ce","stroke-width":"5"}),u("line",{x1:"18",y1:"44",x2:"110",y2:"44",stroke:"#4a55ce","stroke-width":"5"}),u("line",{x1:"30",y1:"60",x2:"80",y2:"60",stroke:"#4a55ce","stroke-width":"3"}),u("line",{x1:"30",y1:"76",x2:"90",y2:"76",stroke:"#4a55ce","stroke-width":"3"}),u("line",{x1:"30",y1:"92",x2:"70",y2:"92",stroke:"#4a55ce","stroke-width":"3"})]})}),u("h1",{className:"der-de-toolbar__title",children:"Aggregate data entry"}),u("span",{className:"der-de-toolbar__status "+(d.isOnline?"der-de-toolbar__status--on":"der-de-toolbar__status--off"),"aria-label":d.isOnline?"Online":"Offline",children:d.isOnline?"online":`offline \xB7 ${d.queuedCount} queued`}),_("span",{className:"der-de-toolbar__ou-wrap",children:[u("span",{className:"der-de-toolbar__ou-label",children:"Bound OU"}),u("span",{className:"der-de-toolbar__ou",title:t.orgUnitPath||t.orgUnitUid||"","data-test":"de-toolbar-ou",children:t.orgUnitDisplayName||t.orgUnitUid||"Not bound to an OU"})]})]}),_("div",{className:"der-de-toolbar__picks",children:[_("label",{className:"der-de-toolbar__field",children:[u("span",{className:"der-de-toolbar__field-label",children:"Data set"}),_("select",{className:"der-de-toolbar__select",value:a,onChange:b=>{c(b.target.value),m("")},"data-test":"der-de-dataset-picker",children:[u("option",{value:"",children:"Select a data set\u2026"}),e.map(b=>u("option",{value:b.id,children:b.label},b.id))]})]}),xe.map(b=>_("label",{className:"der-de-toolbar__field","data-test":"de-aoc-chip",children:[u("span",{className:"der-de-toolbar__field-label",children:b.name}),_("select",{className:"der-de-toolbar__select",value:R[b.id]??"",onChange:y=>{let E={...R,[b.id]:y.target.value};M(E),F.current=E,Ue(T.current,E)},"data-test":"de-aoc-select",children:[u("option",{value:"",children:"Select\u2026"}),b.options.map(y=>u("option",{value:y.id,children:y.name},y.id))]})]},b.id)),_("label",{className:"der-de-toolbar__field der-de-toolbar__field--period",children:[_("span",{className:"der-de-toolbar__field-label",children:["Period",v?.periodType?` \xB7 ${v.periodType}`:""]}),u("span",{className:"der-de-period-wrap",children:ct(v?.periodType,i,m,_e)})]}),u("div",{className:"der-de-toolbar__cell-info",children:u(Ge,{root:T,details:Ee,formVersion:Y})})]})]}),w.kind==="ok"&&u("div",{style:dt,"data-test":"de-ok",children:w.message}),w.kind==="error"&&u("div",{style:lt,"data-test":"de-err",children:w.message}),!t.bound&&u("div",{style:{padding:16,color:"#8a2525"},children:"Device is not bound to an organisation unit \u2014 ask an admin to complete provisioning before capturing data."}),t.bound&&!X&&u("div",{className:"der-de-placeholder",children:"Pick a data set to begin."}),t.bound&&X&&!le&&_("div",{className:"der-de-placeholder",children:["Pick a period to load the ",v?.formType==="SECTION"?"section":"data entry"," form."]}),z&&l==="structured"&&_("form",{onSubmit:$e,style:{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},children:[_("label",{children:["Data element UID",u("input",{value:g,onChange:b=>f(b.target.value),style:oe})]}),_("label",{children:["Value",u("input",{value:p,onChange:b=>h(b.target.value),inputMode:"decimal",style:oe})]}),u("div",{style:{gridColumn:"1 / -1"},children:u("button",{type:"submit",disabled:!Ae,style:pe,children:w.kind==="submitting"?"Submitting\u2026":"Submit value"})})]}),z&&l==="custom"&&u("div",{className:`der-de-form-card der-de-density-${q}`,children:_("div",{className:"der-de-form-split",children:[u(Je,{targetRef:T,formVersion:Y}),u("div",{ref:T,"data-test":"der-de-custom-form",className:"der-de-custom-form"})]})}),z&&l==="custom"&&_("div",{className:"der-de-actionbar","data-test":"de-actionbar",children:[u(We,{root:T,formVersion:Y}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-density-toggle","aria-label":`Switch to ${q==="compact"?"comfortable":"compact"} density`,title:`Density: ${q}. Click to switch.`,onClick:()=>Te(b=>b==="compact"?"comfortable":"compact"),children:q==="compact"?"\u21D5 Compact":"\u21D4 Comfortable"}),u("button",{type:"button",className:"der-de-density-btn","data-test":"de-formmode-toggle","aria-label":`Switch to ${L==="der"?"faithful author":"DER"} layout`,title:`Custom-form layout: ${L==="der"?"DER (stripped + restyled)":"Author (faithful to DHIS2 central design)"}. Click to switch; reload the form for changes to take effect.`,onClick:()=>Ce(b=>b==="der"?"author":"der"),children:L==="der"?"\u2699 DER layout":"\u2699 Author layout"}),O&&u("span",{className:"der-de-completion-pill","data-test":"de-completion-status",children:O.completed?`Complete${O.completedAt?" \xB7 "+new Date(O.completedAt).toLocaleString():""}`:"Open for edits"}),u("button",{type:"button",onClick:()=>{ot(T.current,k,(b,y)=>{ke(b),de.current=y,V(!0)})},style:ge,"data-test":"de-validate-btn",children:"Validate"}),B.length>0&&!se&&_("button",{type:"button",onClick:()=>V(!0),className:"der-de-issues-chip","data-test":"de-issues-chip",children:[B.length," issue",B.length===1?"":"s"]}),u("button",{type:"button",onClick:()=>K(b=>!b),className:"der-de-density-btn","data-test":"de-shortcuts-toggle",title:"Show keyboard shortcuts (?)","aria-label":"Show keyboard shortcuts",children:"\u2328 Shortcuts"}),u("button",{type:"button",onClick:Ie,disabled:W,style:O?.completed?ge:pe,"data-test":"de-complete-btn",children:W?"Saving\u2026":O?.completed?"Reopen":"Mark complete"})]}),u(Ke,{open:Se,onClose:()=>K(!1)}),u(Ye,{open:se,issues:B,totalCells:de.current,onClose:()=>V(!1),onPick:b=>{let y=T.current?.querySelector(`input[name="${b.inputName}"]`);y&&(y.scrollIntoView({behavior:"smooth",block:"center"}),y.focus(),y.select()),V(!1)}})]})}var He=["/legacy-custom-forms/javascripts/jQuery/jquery.min.js","/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.utils.js","/legacy-custom-forms/javascripts/jQuery/jquery.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js","/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js","/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js","/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.js","/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js","/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js","/legacy-custom-forms/javascripts/jQuery/jquery.glob.js","/legacy-custom-forms/javascripts/jQuery/jquery.date.js","/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js","/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js","/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js","/legacy-custom-forms/javascripts/bootstrap.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.util.js","/legacy-custom-forms/javascripts/dhis2/dhis2.array.js","/legacy-custom-forms/javascripts/dhis2/dhis2.select.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js","/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js","/legacy-custom-forms/javascripts/select2.min.js","/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js","/legacy-custom-forms/javascripts/dhis2/dhis2.period.js","/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js","/legacy-custom-forms/javascripts/data-entry/form.js","/legacy-custom-forms/javascripts/data-entry/entry.js"],qe=["/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css","/legacy-custom-forms/css/light_blue.css","/legacy-custom-forms/css/widgets.css","/legacy-custom-forms/css/select2/select2.css","/legacy-custom-forms/css/dhis-web-dataentry.css","/legacy-custom-forms/css/bootstrap/bootstrap.min.css","/legacy-custom-forms/css/plugin-styles.css"],ee=null,te=null,re=null;async function ce(o,t){ee||(ee=t.listAllDataElements().then(r=>new Map(r.map(a=>[a.id,a])))),te||(te=t.listAllCategoryCombos().then(r=>new Map(r.map(a=>[a.id,a])))),re||(re=t.listAllCategoryOptionCombos().then(r=>{let a=new Map;for(let c of r){let i=c.categoryCombo?.id;if(!i)continue;let m=a.get(i);m?m.push(c):a.set(i,[c])}return a}));let[d,n,l]=await Promise.all([ee,te,re]),s=r=>{if(!r?.id)return;let a=n.get(r.id),c=l.get(r.id)??[];return a?{id:a.id,name:a.name??a.displayName,categoryOptionCombos:c.map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:i.categoryOptions??[]})),categories:(a.categories??[]).map(i=>({id:i.id,name:i.name??i.displayName,categoryOptions:(i.categoryOptions??[]).map(m=>({id:m.id,name:m.name??m.displayName}))}))}:r},e=r=>{let a=d.get(r.id);return a?{id:a.id,name:a.name??a.displayName,formName:a.formName,valueType:a.valueType,categoryCombo:s(a.categoryCombo)}:r};return{...o,categoryCombo:s(o.categoryCombo)??o.categoryCombo,dataSetElements:(o.dataSetElements??[]).map(r=>({...r,dataElement:r.dataElement?e(r.dataElement):void 0})),sections:(o.sections??[]).map(r=>({...r,dataElements:(r.dataElements??[]).map(a=>e(a))}))}}function me(o){let t={};for(let r of o.dataSetElements??[])r.dataElement&&(t[r.dataElement.id]=r.dataElement);let d={};for(let r of o.indicators??[])d[r.id]=r;let n=(o.sections??[]).slice().sort((r,a)=>(r.sortOrder??0)-(a.sortOrder??0));if(!n.some(r=>(r.dataElements?.length??0)>0)){let r=(o.dataSetElements??[]).map(a=>a.dataElement).filter(a=>!!a);n=[{id:o.id,name:o.displayName??o.name??"Data entry",sortOrder:0,dataElements:r,indicators:[],greyedFields:[]}]}let s=r=>r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),e=[];for(let r of n){let a=new Set;for(let i of r.greyedFields??[])i.dataElement?.id&&i.categoryOptionCombo?.id&&a.add(`${i.dataElement.id}:${i.categoryOptionCombo.id}`);e.push(`<h3 class="formSection">${s(r.name??"")}</h3>`);let c=new Map;for(let i of r.dataElements??[]){let m=t[i.id];if(!m?.categoryCombo)continue;let g=m.categoryCombo.id,f=c.get(g);f||(f={cc:m.categoryCombo,des:[]},c.set(g,f)),f.des.push(m)}for(let i of c.values()){let m=i.cc.categoryOptionCombos??[],g=i.cc.categories??[];e.push('<div class="der-de-table-scroll">'),e.push('<table class="sectionTable" cellspacing="0">');let f=ze(g,m);if(e.push("<thead>"),f.length>0)for(let p=0;p<f.length;p++){e.push("<tr>"),p===0&&e.push(`<th class="dataElementCell" rowspan="${f.length}">Data elements</th>`);for(let h of f[p]??[])e.push(`<th colspan="${h.span}">${s(h.label)}</th>`);e.push("</tr>")}else{e.push("<tr>"),e.push('<th class="dataElementCell">Data elements</th>');for(let p of m)e.push(`<th>${s(p.name??"")}</th>`);e.push("</tr>")}e.push("</thead><tbody>");for(let p of i.des){e.push("<tr>"),e.push(`<td class="dataElementCell" id="${s(p.id)}-cell">`+s(p.formName??p.name??p.id)+"</td>");for(let h of m){let w=`${p.id}-${h.id}-val`;a.has(`${p.id}:${h.id}`)?e.push('<td class="greyed">\u2014</td>'):e.push(`<td><input type="text" id="${s(w)}" name="${s(w)}" dataelementid="${s(p.id)}" optioncomboid="${s(h.id)}"></td>`)}e.push("</tr>")}for(let p of r.indicators??[]){let h=d[p.id];h&&(e.push('<tr class="indicatorRow">'),e.push(`<td class="dataElementCell">${s(h.name??h.id)}</td>`),e.push(`<td colspan="${m.length}"><input type="text" name="indicator" indicatorid="${s(h.id)}" readonly></td>`),e.push("</tr>"))}e.push("</tbody></table></div>")}}return e.join(`
`)}function ze(o,t){if(o.length===0||t.length===0)return[];let d=new Map;for(let e of o)for(let r of e.categoryOptions??[])d.set(r.id,{catId:e.id,name:r.name??r.id});let n=o.length,l=t.map(e=>{let r=new Array(n).fill("");for(let a of e.categoryOptions??[]){let c=d.get(a.id);if(!c)continue;let i=o.findIndex(m=>m.id===c.catId);i>=0&&(r[i]=c.name)}return r});for(let e of l)if(e.some(r=>r===""))return[];let s=[];for(let e=0;e<n;e++){let r=[];for(let a=0;a<l.length;){let c=l[a],i=a+1;for(;i<l.length;){let m=l[i],g=!0;for(let f=0;f<=e;f++)if(c[f]!==m[f]){g=!1;break}if(!g)break;i++}r.push({label:c[e]??"",span:i-a}),a=i}s.push(r)}return s}function Pe(o){let t=globalThis;t.dhis2=t.dhis2??{};let d=t.dhis2;d.de=d.de??{};let n=d.de;n.currentDataSetId=o.dataSetId,n.currentOrganisationUnitId=o.orgUnitId,n.currentPeriodId=o.periodId,n.currentCategorySelections={...o.aocSelections??{}};let l=o.meta??{},s={},e={};if(l.categoryCombo){e[l.categoryCombo.id]=l.categoryCombo;for(let m of l.categoryCombo.categories??[])s[m.id]=m}n.categories=s,n.categoryCombos=e;let r={},a={};for(let m of l.dataSetElements??[]){let g=m.dataElement;g&&(r[g.id]=g,g.optionSet&&(a[g.optionSet.id]=g.optionSet),g.categoryCombo&&(e[g.categoryCombo.id]=g.categoryCombo))}n.dataElements=r,n.optionSets=a;let c={};for(let m of l.indicators??[])c[m.id]={explodedNumerator:m.numerator,denominator:m.denominator,factor:m.indicatorType?.factor??1};n.indicatorFormulas=c;let i={};for(let m of o.validationRules??[])i[m.id]=m;n.validationRules=i,n.lockExceptions=[],n.emptyOrganisationUnits=[],n.significantZeros=[],n.dataSets={[l.id]:{id:l.id,name:l.name??l.displayName??"",periodType:l.periodType,categoryCombo:l.categoryCombo?.id,periodId:o.periodId}},t.DHIS2_BASE_URL=`${window.location.origin}/`,d.shim=d.shim??{},d.shim.i18n_translations={i18n_loading_file_info_failed:"Loading file info failed",i18n_file_upload_failed:"File upload failed",i18n_confirm_deletion:"Confirm deletion",i18n_dataset_is_concluded:"Dataset is concluded",i18n_dataset_is_closed:"Dataset is closed",i18n_dataset_is_approved:"Dataset is approved",i18n_dataset_is_locked:"Dataset is locked",i18n_orgunit_is_closed:"Org unit is closed",i18n_select_option:"Choose an option",i18n_show_all_items:"Show all items",i18n_value_of_data_element_greater:"The value of the following data element is less than the specified minimum value.",i18n_value_of_data_element_less:"The value of the following data element is greater than the specified maximum value.",i18n_value_too_long:"Value is too long",i18n_value_must_number:"Value must be a number",i18n_value_must_integer:"Value must be an integer",i18n_value_must_positive_integer:"Value must be a positive integer",i18n_value_must_negative_integer:"Value must be a negative integer",i18n_value_must_zero_or_positive_integer:"Value must be zero or a positive integer",i18n_value_must_coordinate:"Value must be a coordinate (longitude, latitude)",i18n_value_must_unit_interval:"Value must be a unit interval (between 0 and 1)",i18n_value_must_percentage:"Value must be a percentage (between 0 and 100)",i18n_value_must_valid_url:"Value must be a valid url"}}function Fe(){let o=globalThis;if(o.$&&typeof o.$.ajaxSetup=="function"&&o.$.ajaxSetup({beforeSend:(t,d)=>{d.xhrFields={...d.xhrFields??{},withCredentials:!0}}}),o.dhis2?.period&&o.$?.calendars?.instance){let t=o.dhis2.period;t.format="yyyy-mm-dd",t.calendar=o.$.calendars.instance("gregorian"),t.PeriodGenerator&&(t.generator=new t.PeriodGenerator(t.calendar,t.format)),t.DatePicker&&(t.picker=new t.DatePicker(t.calendar,t.format))}}function Ue(o,t){if(!o)return;for(let[n,l]of Object.entries(t)){let s=o.querySelector(`input[data-der-category="${n}"]`);s||(s=document.createElement("input"),s.type="hidden",s.id=`category-${n}`,s.setAttribute("data-der-category",n),o.appendChild(s)),s.value=l}let d=globalThis;d.dhis2?.de&&(d.dhis2.de.currentCategorySelections={...t})}function Be(o,t,d,n,l,s){let e=i=>{let m=/^(.+)-(.+)-val$/.exec(i);return m?{de:m[1],coc:m[2]}:null},r=new WeakMap,a=o.querySelectorAll('input[name$="-val"]');for(let i of Array.from(a))r.set(i,i.value);let c=async i=>{let m=i.target;if(!m||m.tagName!=="INPUT")return;let g=m.getAttribute("name")??"",f=e(g);if(!f)return;let p=t(),h=d(),w=n();if(!p||!h||!w)return;let k=m.value;if(r.get(m)!==k){ae(m,"saving");try{let v=await s.submitAggregate({dataSet:p,period:h,orgUnit:w,attributeOptionComboSelections:l(),dataValues:[{dataElement:f.de,categoryOptionCombo:f.coc,value:k}]});r.set(m,k),ae(m,v?.status==="OFFLINE_QUEUED"?"queued":"saved")}catch{ae(m,"error")}}};o.addEventListener("blur",i=>{c(i)},!0)}function Ve(o){o.addEventListener("keydown",t=>{let d=t;if(d.key!=="Enter")return;let n=d.target;if(!(n instanceof HTMLInputElement))return;let l=n.getAttribute("name")??"",s=/^(.+)-(.+)-val$/.exec(l);if(!s)return;d.preventDefault();let e=s[2],r=Array.from(o.querySelectorAll(`input[name$="-${e}-val"]`)),a=r.indexOf(n);if(a===-1)return;let c=r[a+(d.shiftKey?-1:1)];c?.focus(),c instanceof HTMLInputElement&&c.select()})}function Qe(o){let t=Array.from(o.querySelectorAll("h2, h3, h4")).filter(s=>(s.textContent??"").trim().length>0);if(t.length<2)return[];let d=new Set(t),n=[],l=(s,e)=>{for(let r of d)if(r!==e&&s.contains(r))return!0;return!1};return t.forEach((s,e)=>{let r=s.id||`der-de-section-${e}`;s.id=r;let a=null,c=s.parentElement,i=null;for(;c&&c!==o&&!l(c,s);)i=c,c=c.parentElement;if(i&&i.children.length>1&&i!==o)a=i,a.classList.add("der-de-section-slot"),a.dataset.sectionId=r;else{a=document.createElement("div"),a.className="der-de-section-slot",a.dataset.sectionId=r;let m=t[e+1]??null,g=[],f=s;for(;f&&f!==m;){let p=f.nextSibling;g.push(f),f=p}s.parentNode?.insertBefore(a,s);for(let p of g)a.appendChild(p)}n.push({id:r,label:(s.textContent??"").trim(),slot:a})}),n}function Je({targetRef:o,formVersion:t}){let[d,n]=S([]),[l,s]=S(""),[e,r]=S({});return I(()=>{let a=o.current;if(!a)return;let c=Qe(a);n(c),s(c[0]?.id??"")},[o,t]),I(()=>{if(d.length===0)return;let a=()=>{let m={};for(let g of d){let f=Array.from(g.slot.querySelectorAll('input[name$="-val"]')),p=f.filter(h=>h.value.trim()!=="").length;m[g.id]={filled:p,total:f.length}}r(m)};a();let c=o.current;if(!c)return;let i=m=>{let g=m.target;g&&g.tagName==="INPUT"&&/-val$/.test(g.getAttribute("name")??"")&&a()};return c.addEventListener("input",i,!0),()=>{c.removeEventListener("input",i,!0)}},[o,d]),I(()=>{if(!o.current||d.length===0)return;for(let i of d)i.slot.style.display=i.id===l?"":"none";let c=d.find(i=>i.id===l);c&&c.slot.scrollIntoView({behavior:"smooth",block:"start"})},[o,d,l]),d.length<2?null:_("nav",{className:"der-de-section-nav","aria-label":"Form sections","data-test":"de-section-nav",children:[u("div",{className:"der-de-section-nav__title",children:"Sections"}),u("ul",{className:"der-de-section-nav__list",children:d.map(a=>{let c=e[a.id],i=!c||c.total===0||c.filled===0?"muted":c.filled===c.total?"done":"partial";return u("li",{children:_("button",{type:"button",className:"der-de-section-nav__item"+(l===a.id?" der-de-section-nav__item--active":""),"data-test":"de-section-nav-item",onClick:()=>s(a.id),children:[u("span",{className:"der-de-section-nav__label",children:a.label}),c&&c.total>0&&u("span",{className:`der-de-section-nav__ratio der-de-section-nav__ratio--${i}`,"data-test":"de-section-nav-ratio",title:`${c.filled} of ${c.total} cells filled`,children:i==="done"?"\u2713":`${c.filled}/${c.total}`})]})},a.id)})})]})}function We({root:o,formVersion:t}){let[d,n]=S({total:0,filled:0,saving:0,saved:0,queued:0,error:0});if(I(()=>{let e=()=>{let a=o.current;if(!a)return;let c=Array.from(a.querySelectorAll('input[name$="-val"]')),i=0,m=0,g=0,f=0,p=0;for(let h of c){h.value.trim()!==""&&i++;let w=h.style.outline||"";w.includes("rgb(185, 134, 10)")||w.includes("#b9860a")?m++:w.includes("rgb(206, 123, 0)")||w.includes("#ce7b00")?f++:w.includes("rgb(26, 135, 84)")||w.includes("#1a8754")||w.includes("rgb(183, 220, 199)")||w.includes("#b7dcc7")?g++:(w.includes("rgb(169, 50, 50)")||w.includes("#a93232"))&&p++}n({total:c.length,filled:i,saving:m,saved:g,queued:f,error:p})};e();let r=window.setInterval(e,800);return()=>window.clearInterval(r)},[o,t]),d.total===0)return u("span",{className:"der-de-savepill der-de-savepill--muted","data-test":"de-save-state",children:"No cells yet"});let l=[];l.push(`${d.filled} of ${d.total} filled`),d.saving>0&&l.push(`${d.saving} saving`),d.queued>0&&l.push(`${d.queued} queued`),d.error>0&&l.push(`${d.error} error`);let s=d.error>0?"error":d.queued>0?"queued":d.saving>0?"saving":d.filled>0?"saved":"muted";return u("span",{className:`der-de-savepill der-de-savepill--${s}`,"data-test":"de-save-state",children:l.join(" \xB7 ")})}function Ge({details:o}){let t={empty:"No value yet",saving:"Saving\u2026",saved:"Saved on edge",queued:"Queued for sync",error:"Rejected"},d={empty:"muted",saving:"saving",saved:"saved",queued:"queued",error:"error"};return u("div",{className:"der-de-live-strip","data-test":"de-live-strip",children:u("div",{className:"der-de-live-strip__cell","data-test":"de-live-cell",children:o?_(pt,{children:[u("span",{className:"der-de-live-strip__de",children:o.deName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__coc",children:o.cocName}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:"der-de-live-strip__value",children:o.value||u("em",{className:"der-de-live-strip__empty",children:"\u2014"})}),u("span",{className:"der-de-live-strip__sep",children:"\xB7"}),u("span",{className:`der-de-live-strip__state der-de-live-strip__state--${d[o.saveState]}`,children:t[o.saveState]}),o.compulsory&&u("span",{className:"der-de-live-strip__required",title:"Compulsory \u2014 a value is required.",children:"Required"})]}):u("span",{className:"der-de-live-strip__hint",children:"Click a cell to see its data element, category option combo + value."})})})}function Ye({open:o,issues:t,totalCells:d,onClose:n,onPick:l}){if(I(()=>{if(!o)return;let e=r=>{r.key==="Escape"&&n()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[o,n]),!o)return null;let s=t.length===0;return u("div",{className:"der-de-validation-backdrop",role:"dialog","aria-modal":"true","aria-label":"Validation result","data-test":"de-validation-modal",onClick:e=>{e.target===e.currentTarget&&n()},children:_("div",{className:"der-de-validation "+(s?"der-de-validation--ok":"der-de-validation--err"),children:[_("header",{className:"der-de-validation__head",children:[_("div",{className:"der-de-validation__title",children:[u("span",{className:"der-de-validation__badge","aria-hidden":"true",children:s?"\u2713":"!"}),u("h3",{className:"der-de-validation__heading",children:s?`Validation passed \u2014 all ${d} cells OK.`:`Validation found ${t.length} issue${t.length===1?"":"s"} across ${d} cells.`})]}),u("button",{type:"button",className:"der-de-validation__close","aria-label":"Close validation modal","data-test":"de-validation-close",onClick:n,children:"\xD7"})]}),u("div",{className:"der-de-validation__body",children:s?_("p",{className:"der-de-validation__ok-prose",children:["Every value on this form matches its data-element valueType. Nothing is blocking a save; proceed to",u("strong",{children:" Mark complete"})," when you're ready."]}):_("table",{className:"der-de-validation__table","aria-label":"Validation issues list",children:[u("thead",{children:_("tr",{children:[u("th",{scope:"col",children:"Data element"}),u("th",{scope:"col",children:"Category option combo"}),u("th",{scope:"col",children:"Entered value"}),u("th",{scope:"col",children:"Problem"}),u("th",{scope:"col"})]})}),u("tbody",{children:t.map(e=>_("tr",{"data-test":"de-issues-row",children:[u("td",{children:e.deName}),u("td",{className:"der-de-validation__coc",children:e.cocName}),u("td",{children:u("code",{className:"der-de-validation__value",children:e.value||"\u2014"})}),u("td",{className:"der-de-validation__why",children:e.problem}),u("td",{className:"der-de-validation__jump",children:u("button",{type:"button",className:"der-de-validation__jump-btn","data-test":"de-issues-item",onClick:()=>l(e),children:"Jump to cell \u2192"})})]},`${e.deId}-${e.cocId}`))})]})})]})})}function Ke({open:o,onClose:t}){return I(()=>{if(!o)return;let n=l=>{l.key==="Escape"&&t()};return window.addEventListener("keydown",n),()=>window.removeEventListener("keydown",n)},[o,t]),o?u("div",{className:"der-de-shortcuts-backdrop",role:"dialog","aria-modal":"true","aria-label":"Keyboard shortcuts","data-test":"de-shortcuts-popover",onClick:n=>{n.target===n.currentTarget&&t()},children:_("div",{className:"der-de-shortcuts",children:[_("header",{className:"der-de-shortcuts__head",children:[u("h3",{className:"der-de-shortcuts__title",children:"Keyboard shortcuts"}),u("button",{type:"button",className:"der-de-shortcuts__close","aria-label":"Close keyboard shortcuts",onClick:t,children:"\xD7"})]}),u("dl",{className:"der-de-shortcuts__list",children:[["Enter","Next row (same COC column)"],["Shift + Enter","Previous row"],["Tab / Shift + Tab","Next / previous cell"],["Paste multi-line","Distributes down the COC column"],["Esc","Close an open drawer"],["?","Show / hide this cheatsheet"]].map(([n,l])=>_("div",{className:"der-de-shortcuts__row",children:[u("dt",{children:u("kbd",{children:n})}),u("dd",{children:l})]},n))})]})}):null}function Xe(o,t){o.addEventListener("paste",d=>{let n=d.target;if(!n||n.tagName!=="INPUT")return;let l=n.getAttribute("name")??"";if(!/^(.+)-(.+)-val$/.exec(l))return;let e=d.clipboardData?.getData("text/plain")??"",r=/\r?\n/.test(e),a=/\t/.test(e);if(!r&&!a)return;let c=e.split(/\r?\n/).filter((v,C,T)=>!(C===T.length-1&&v==="")).map(v=>v.split("	").map(C=>C.trim()));if(c.length===0)return;d.preventDefault();let i=n.closest("[data-section-id]")??o,g=Array.from(i.querySelectorAll("tbody tr")).map(v=>Array.from(v.querySelectorAll('input[name$="-val"]'))),f=-1,p=-1;for(let v=0;v<g.length;v++){let C=g[v].indexOf(n);if(C!==-1){f=v,p=C;break}}if(f===-1)return;let h=0,w=0;for(let v=0;v<c.length;v++){let C=c[v],T=g[f+v];if(!T){w+=C.length;continue}for(let R=0;R<C.length;R++){let M=T[p+R];if(!M){w++;continue}M.value=C[R]??"",M.dispatchEvent(new Event("input",{bubbles:!0})),M.dispatchEvent(new Event("blur",{bubbles:!0})),h++}}let k=c.length===1?`${c[0].length}-cell row`:c[0]?.length===1?`${c.length}-cell column`:`${c.length}\xD7${c[0]?.length??0} block`;t({kind:"ok",message:`Pasted ${h} value${h===1?"":"s"} (${k}${w>0?`, ${w} overflow`:""}).`})},!0)}function Ze(o){let t=Array.from(o.querySelectorAll('input[name="total"][dataelementid]'));if(t.length===0)return;let d=[];for(let n of t){let l=n.getAttribute("dataelementid")??"";if(!l)continue;let s=n.closest("div"),r=(()=>{let i=s??n.parentElement;if(!i)return null;let m=i.previousElementSibling;for(;m;){if(/^(H1|H2|H3|H4)$/.test(m.tagName)||m.tagName==="DIV"&&!m.querySelector("table, input")&&(m.textContent??"").trim().length>0)return m;m=m.previousElementSibling}let g=i.closest("[data-section-id]");if(g){let f=g.querySelector("h2, h3, h4");if(f)return f}return null})();if(!r)continue;s?.remove();let a=document.createElement("span");a.className="der-de-matrix-total",a.setAttribute("data-de",l),r.appendChild(a);let c=()=>{let i=0,m=!1,g=Array.from(o.querySelectorAll(`input[dataelementid="${l}"][name$="-val"],input[name^="${l}-"][name$="-val"]`)),f=new Set;for(let p of g){if(f.has(p))continue;f.add(p);let h=parseFloat(p.value);Number.isFinite(h)&&(i+=h,m=!0)}if(m){let p=Number.isInteger(i)?i:Number(i.toFixed(2));a.textContent=` (Total: ${p})`}else a.textContent=""};d.push(c),c()}d.length!==0&&o.addEventListener("input",n=>{let l=n.target;if(!(!l||l.tagName!=="INPUT")&&/-val$/.test(l.getAttribute("name")??""))for(let s of d)s()},!0)}function et(o,t){let d=t.indicators??[];if(d.length===0)return;let n=d.filter(i=>i.numerator&&i.denominator).map(i=>({id:i.id,factor:i.indicatorType?.factor??1,numExpr:i.numerator,denExpr:i.denominator}));if(n.length===0)return;let l=Array.from(o.querySelectorAll("input[indicatorid]")),s=new Map;for(let i of Array.from(o.querySelectorAll('input[name$="-val"]')))s.set(i.getAttribute("name")??"",i);let e=i=>{let m=0;for(let[g,f]of s){if(!g.startsWith(`${i}-`))continue;let p=parseFloat(f.value);Number.isFinite(p)&&(m+=p)}return m},r=i=>i.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,(m,g,f)=>{if(f){let p=s.get(`${g}-${f}-val`),h=parseFloat(p?.value??"");return Number.isFinite(h)?String(h):"0"}return String(e(g))}),a=i=>{if(!/^[\s\d+\-*/().eE]+$/.test(i))return NaN;try{return Function(`"use strict";return (${i})`)()}catch{return NaN}},c=()=>{for(let i of n){let m=a(r(i.numExpr)),g=a(r(i.denExpr)),f=l.find(h=>h.getAttribute("indicatorid")===i.id);if(!f)continue;if(!Number.isFinite(m)||!Number.isFinite(g)||g===0){f.value="";continue}let p=m/g*i.factor;f.value=Number.isInteger(p)?String(p):p.toFixed(2)}};o.addEventListener("input",i=>{let m=i.target;m&&m.tagName==="INPUT"&&m.hasAttribute("name")&&/-val$/.test(m.getAttribute("name")??"")&&c()},!0),c()}function tt(o,t){let d={};for(let n of t.dataSetElements??[])n.dataElement&&(d[n.dataElement.id]=n.dataElement);for(let n of Array.from(o.querySelectorAll('input[name$="-val"]'))){let l=/^(.+)-(.+)-val$/.exec(n.getAttribute("name")??"");if(!l)continue;let s=d[l[1]],e=s?.formName??s?.name??l[1],r=s?.categoryCombo?.categoryOptionCombos?.find(c=>c.id===l[2]),a=r?.name??r?.displayName??l[2];n.hasAttribute("aria-label")||n.setAttribute("aria-label",a===l[2]?`${e}`:`${e}, ${a}`),n.getAttribute("data-compulsory")==="1"&&n.setAttribute("aria-required","true")}}function rt(o,t){let d=t.compulsoryDataElementOperands??[],n=new Set;for(let l of d){let s=l.dimensionItem;if(!s)continue;let e=s.split(".");e.length===2&&n.add(`${e[0]}:${e[1]}`)}if(n.size!==0)for(let l of Array.from(o.querySelectorAll('input[name$="-val"]'))){let s=/^(.+)-(.+)-val$/.exec(l.getAttribute("name")??"");s&&n.has(`${s[1]}:${s[2]}`)&&l.setAttribute("data-compulsory","1")}}function at(o,t,d){let n={};for(let s of t.dataSetElements??[])s.dataElement&&(n[s.dataElement.id]=s.dataElement);let l=s=>{let e=s.getAttribute("name")??s.id??"",r=/^(.+)-(.+)-val$/.exec(e);if(!r)return null;let a=r[1],c=r[2],i=n[a],m=i?.categoryCombo,g=m?.categoryOptionCombos?.find(C=>C.id===c),f=[],p=g?.name??g?.displayName??c,h=p.split(/,\s*/).filter(Boolean),w=m?.categories??[];h.forEach((C,T)=>{f.push({category:w[T]?.name??w[T]?.displayName??"",option:C})});let k=s.style.outline||"",v=k.includes("rgb(185, 134, 10)")||k.includes("#b9860a")?"saving":k.includes("rgb(206, 123, 0)")||k.includes("#ce7b00")?"queued":k.includes("rgb(26, 135, 84)")||k.includes("#1a8754")||k.includes("rgb(183, 220, 199)")||k.includes("#b7dcc7")?"saved":k.includes("rgb(169, 50, 50)")||k.includes("#a93232")?"error":s.value.trim()===""?"empty":"saved";return{deId:a,cocId:c,deName:i?.name??a,deFormName:i?.formName,valueType:i?.valueType??"TEXT",optionSetId:i?.optionSet?.id,cocName:p,categoryBreakdown:f,value:s.value,saveState:v,inputName:e,compulsory:s.getAttribute("data-compulsory")==="1"}};o.addEventListener("focusin",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let r=l(e);r&&d(r)}},!0),o.addEventListener("input",s=>{let e=s.target;if(e&&e.tagName==="INPUT"){let r=l(e);r&&d(r)}},!0)}function ot(o,t,d){if(!o)return;let n=globalThis,l=n.dhis2?.de?.dataElements??{},s=n.dhis2?.de?.categoryOptionCombos??{},e=Array.from(o.querySelectorAll('input[name$="-val"]')),r=[];for(let a of e){a.style.outline="";let c=/^(.+)-(.+)-val$/.exec(a.getAttribute("name")??"");if(!c)continue;let i=c[1],m=c[2],g=l[i],f=g?.valueType??"TEXT",p=a.value.trim();if(p===""){a.getAttribute("data-compulsory")==="1"&&(a.style.outline="2px solid #c0392b",r.push({deId:i,cocId:m,valueType:f,value:"",problem:"compulsory value missing",deName:g?.name??i,cocName:s[m]?.name??m,inputName:a.name}));continue}let h=nt(p,f);h&&(a.style.outline="2px solid #c0392b",r.push({deId:i,cocId:m,valueType:f,value:p,problem:h,deName:g?.name??i,cocName:s[m]?.name??m,inputName:a.name}))}d(r,e.length),t({kind:"idle"})}function nt(o,t){let d=Number(o),n=Number.isInteger(d);switch(t){case"NUMBER":case"INTEGER":case"INTEGER_POSITIVE":case"INTEGER_NEGATIVE":case"INTEGER_ZERO_OR_POSITIVE":case"UNIT_INTERVAL":case"PERCENTAGE":if(!Number.isFinite(d))return"must be a number";break}switch(t){case"INTEGER":if(!n)return"must be an integer";break;case"INTEGER_POSITIVE":if(!n||d<=0)return"must be a positive integer";break;case"INTEGER_NEGATIVE":if(!n||d>=0)return"must be a negative integer";break;case"INTEGER_ZERO_OR_POSITIVE":if(!n||d<0)return"must be zero or positive";break;case"UNIT_INTERVAL":if(d<0||d>1)return"must be between 0 and 1";break;case"PERCENTAGE":if(d<0||d>100)return"must be between 0 and 100";break;case"BOOLEAN":if(!["true","false","1","0","yes","no"].includes(o.toLowerCase()))return"must be a yes/no value";break;case"TRUE_ONLY":if(!["true","1","yes"].includes(o.toLowerCase()))return"must be yes";break;case"URL":try{new URL(o)}catch{return"must be a valid URL"}break;default:break}return null}function ae(o,t){let d=t==="saving"?"#b9860a":t==="saved"?"#1a8754":t==="queued"?"#ce7b00":"#a93232";o.style.outline=`2px solid ${d}`,o.style.transition="outline 150ms",t==="queued"?o.setAttribute("title","Queued \u2014 will sync when the edge is reachable again."):o.removeAttribute("title"),t==="saved"&&window.setTimeout(()=>{o.style.outline.includes("#1a8754")&&(o.style.outline="1px solid #b7dcc7")},1200)}async function it(o,t,d,n,l){if(!t||!d||!n)return;let s;try{s=(await l.readAggregateValues(n,d,2e3)).dataValues??[]}catch{return}for(let e of s){let r=e.dataElement,a=e.categoryOptionCombo,c=e.value;if(!r||!a||c==null)continue;let i=o.querySelector(`input[name="${r}-${a}-val"]`);i&&(i.value=c)}}function be(o){return new Promise((t,d)=>{let n=document.createElement("script");n.src=o,n.async=!1,n.setAttribute("data-der-custom-form",o),n.onload=()=>t(),n.onerror=()=>d(new Error(`failed to load ${o}`)),document.head.appendChild(n)})}function ye(o){if(document.querySelector(`link[data-der-custom-form="${o}"]`))return;let t=document.createElement("link");t.rel="stylesheet",t.href=o,t.setAttribute("data-der-custom-form",o),document.head.appendChild(t)}function ue(o){return!o||/^https?:\/\//i.test(o)||o.startsWith("/legacy-custom-forms/")||o.startsWith("/")?o:`/legacy-custom-forms/${o.replace(/^(?:\.{1,2}\/)+/,"")}`}async function st(o,t,d={}){let n=d.stripStyles??!0;o.classList.toggle("der-de-custom-form--author",!n);let l=new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${t}</body></html>`,"text/html");for(let e of Array.from(l.querySelectorAll('link[rel="stylesheet"],style'))){if(e.tagName==="LINK"){let r=e.getAttribute("href")??"";r&&ye(ue(r))}else{let r=document.createElement("style");r.textContent=e.textContent??"",r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r)}e.remove()}let s=[];for(let e of Array.from(l.querySelectorAll("script"))){let r=e.getAttribute("src");r?s.push({src:ue(r)}):s.push({code:e.textContent??""}),e.remove()}for(let e of Array.from(l.body.querySelectorAll("*"))){if(n&&e.removeAttribute("style"),e.tagName==="INPUT"){let r=e.getAttribute("id")??"";r.endsWith("-val")&&e.getAttribute("name")!==r&&e.setAttribute("name",r)}if(n&&e.tagName==="TH"){let r=(e.textContent??"").trim();(r==="Reporting item"||r==="Reported count")&&(e.textContent=r==="Reporting item"?"Data elements":"Value")}}for(let e of Array.from(l.body.childNodes))o.appendChild(document.adoptNode(e));for(let e of s)if(e.src)document.querySelector(`script[data-der-custom-form="${e.src}"]`)||await be(e.src);else if(e.code){let r=document.createElement("script");r.textContent=e.code,r.setAttribute("data-der-custom-form","inline"),document.head.appendChild(r),r.remove()}}var oe={display:"block",width:"100%",marginTop:4,padding:"6px 8px",border:"1px solid #d7dde5",borderRadius:0,fontSize:13,fontFamily:"inherit"},pe={padding:"6px 16px",border:"1px solid #1f4d70",background:"#2c6693",color:"#fff",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},ge={padding:"6px 16px",border:"1px solid #c0c7cf",background:"#fff",color:"#2c3e4c",borderRadius:0,fontSize:13,fontWeight:500,cursor:"pointer"},dt={marginTop:12,padding:"8px 12px",background:"#e8f4ee",color:"#136436",border:"1px solid #b7dcc7",borderRadius:0},lt={marginTop:12,padding:"8px 12px",background:"#fbeaea",color:"#8a2525",border:"1px solid #e0bcbc",borderRadius:0};function ct(o,t,d,n=new Set){let l=(p,h)=>n.has(p)?`\u2713  ${h}`:h,s={...oe},e=he(o);if(e.length===0)return u("input",{value:t,onChange:p=>d(p.target.value),placeholder:o?`DHIS2 ${o} period id`:"e.g. 202611",style:s});let r=[...e];if(t&&!r.some(p=>p.id===t)){let p=mt(o,t)??t;r.unshift({id:t,label:p})}let a=e[0]?.id??null,c=r.findIndex(p=>p.id===t),i=c===-1||c<r.length-1||!!o,m=t!==""&&(c>0||t!==a),g=()=>{if(!o)return;let p=c>=0&&c<r.length-1?r[c+1]?.id??"":fe(o,t||a||"",-1);p&&d(p)},f=()=>{if(!o||!t||t===a)return;let p=c>0?r[c-1]?.id??"":fe(o,t,1);p&&d(p)};return _("span",{className:"der-de-period-nav",children:[u("button",{type:"button","aria-label":"Previous period",onClick:g,disabled:!i,className:"der-de-period-btn",children:"\u25C0"}),_("select",{value:t,onChange:p=>d(p.target.value),style:s,children:[u("option",{value:"",children:"Select a period\u2026"}),r.map(p=>u("option",{value:p.id,children:l(p.id,p.label)},p.id))]}),u("button",{type:"button","aria-label":"Next period",onClick:f,disabled:!m,className:"der-de-period-btn",children:"\u25B6"})]})}function fe(o,t,d){let n=l=>String(l).padStart(2,"0");switch(o){case"Daily":{if(!/^\d{8}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=Number(t.slice(6,8)),r=new Date(l,s,e+d);return`${r.getFullYear()}${n(r.getMonth()+1)}${n(r.getDate())}`}case"Weekly":{let l=/^(\d{4})W(\d{1,2})$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=ne(s)):e>ne(s)&&(s+=1,e=1),`${s}W${e}`}case"Monthly":{if(!/^\d{6}$/.test(t))return"";let l=Number(t.slice(0,4)),s=Number(t.slice(4,6))-1,e=l*12+s+d;return`${Math.floor(e/12)}${n((e%12+12)%12+1)}`}case"BiMonthly":{let l=/^(\d{4})(\d{2})B$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=6):e>6&&(s+=1,e=1),`${s}${n(e)}B`}case"Quarterly":{let l=/^(\d{4})Q(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=4):e>4&&(s+=1,e=1),`${s}Q${e}`}case"SixMonthly":{let l=/^(\d{4})S(\d)$/.exec(t);if(!l)return"";let s=Number(l[1]),e=Number(l[2])+d;return e<1?(s-=1,e=2):e>2&&(s+=1,e=1),`${s}S${e}`}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?String(Number(t)+d):"";default:return""}}function mt(o,t){let d=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":return/^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:null;case"Weekly":{let n=/^(\d{4})W(\d{1,2})$/.exec(t);return n?`${n[1]} W${String(n[2]).padStart(2,"0")}`:null}case"Monthly":{if(!/^\d{6}$/.test(t))return null;let n=Number(t.slice(4,6))-1;return`${d[n]??""} ${t.slice(0,4)}`}case"BiMonthly":{let n=/^(\d{4})(\d{2})B$/.exec(t);if(!n)return null;let l=(Number(n[2])-1)*2;return`${d[l]}\u2013${d[l+1]} ${n[1]}`}case"Quarterly":return t.replace(/^(\d{4})Q(\d)$/,"$1 Q$2");case"SixMonthly":{let n=/^(\d{4})S(\d)$/.exec(t);return n?`${n[1]} ${n[2]==="1"?"Jan\u2013Jun":"Jul\u2013Dec"}`:null}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":return/^\d{4}$/.test(t)?t:null;default:return null}}function he(o){let t=new Date,d=t.getFullYear(),n=t.getMonth(),l=e=>String(e).padStart(2,"0"),s=["January","February","March","April","May","June","July","August","September","October","November","December"];switch(o){case"Daily":{let e=[];for(let r=0;r<30;r++){let a=new Date(t);a.setDate(a.getDate()-r);let c=`${a.getFullYear()}${l(a.getMonth()+1)}${l(a.getDate())}`,i=`${a.getFullYear()}-${l(a.getMonth()+1)}-${l(a.getDate())}`;e.push({id:c,label:i})}return e}case"Weekly":{let e=[],r=ve(t),a=r.year,c=r.week;for(let i=0;i<12;i++)e.push({id:`${a}W${c}`,label:`${a} W${l(c)}`}),c-=1,c<1&&(a-=1,c=ne(a));return e}case"Monthly":{let e=[];for(let r=0;r<24;r++){let a=d,c=n,i=a*12+c-r,m=Math.floor(i/12),g=(i%12+12)%12;e.push({id:`${m}${l(g+1)}`,label:`${s[g]} ${m}`})}return e}case"BiMonthly":{let e=[],r=Math.floor(n/2)+1,a=d,c=r;for(let i=0;i<12;i++){let m=(c-1)*2;e.push({id:`${a}${l(c)}B`,label:`${s[m]}\u2013${s[m+1]} ${a}`}),c-=1,c<1&&(a-=1,c=6)}return e}case"Quarterly":{let e=[],r=Math.floor(n/3)+1,a=d,c=r;for(let i=0;i<8;i++)e.push({id:`${a}Q${c}`,label:`${a} Q${c}`}),c-=1,c<1&&(a-=1,c=4);return e}case"SixMonthly":{let e=[],r=n<6?1:2,a=d,c=r;for(let i=0;i<6;i++)e.push({id:`${a}S${c}`,label:`${a} ${c===1?"Jan\u2013Jun":"Jul\u2013Dec"}`}),c-=1,c<1&&(a-=1,c=2);return e}case"Yearly":case"FinancialApril":case"FinancialJuly":case"FinancialOct":{let e=[];for(let r=0;r<10;r++){let a=d-r;e.push({id:String(a),label:String(a)})}return e}default:return[]}}function ve(o){let t=new Date(o.getFullYear(),o.getMonth(),o.getDate()),d=t.getDay()===0?7:t.getDay();t.setDate(t.getDate()+4-d);let n=new Date(t.getFullYear(),0,1),s=Math.round((t.getTime()-n.getTime())/864e5);return{year:t.getFullYear(),week:Math.ceil((s+1)/7)}}function ne(o){return ve(new Date(o,11,28)).week}var ut=`
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
  font-size: 13px;
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
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-border, #d8dee8) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #fafbfd !important;
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
  line-height: 1.35;
  font-size: 13px;
}
/* Blocked / not-applicable cells \u2014 DHIS2 greyedFields. Soft
 * neutral background + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f5,
    #eef0f5 6px,
    #e5e9ef 6px,
    #e5e9ef 7px
  ) !important;
  color: #9097a8 !important;
  text-align: center;
}
/* Indicator rows \u2014 computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f4f6fa !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid var(--der-border, #d8dee8) !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 13px;
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
  font-size: 12px;
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
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid #d8dee8 !important;
  color: #5b6478 !important;
  font-weight: 500;
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
`;export{Le as default};
