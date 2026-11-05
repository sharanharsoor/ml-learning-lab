import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import {fileURLToPath} from 'node:url';

// Run the actual rendering scripts without browser layout or new dependencies.
// This small DOM harness covers IDs, text, attributes, descendants, and clicks.
const LAB_ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const defaultHtmlCandidates = [
  nodePath.resolve(LAB_ROOT, '..', '..', 'docs', 'classification-regression-metrics', 'index.html'),
  nodePath.join(LAB_ROOT, 'docs', 'index.html'),
];
const path = process.argv[2]
  ? nodePath.resolve(process.cwd(), process.argv[2])
  : defaultHtmlCandidates.find(candidate => fs.existsSync(candidate)) || defaultHtmlCandidates[0];
const source = fs.readFileSync(path, 'utf8');
const ids = new Map();
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|times|minus);/gi, (_, entity) => {
  if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1)));
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',times:'×',minus:'−'}[entity.toLowerCase()];
});

class Element {
  constructor(tag='div', attributes={}) {
    this.tagName=tag.toUpperCase(); this.attributes={...attributes}; this.children=[];
    this.parentNode=null; this.style={setProperty(){}}; this.listeners={};
    this.value=attributes.value || ''; this.hidden=Object.hasOwn(attributes,'hidden');
    this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));
    this.classes=new Set((attributes.class || '').split(/\s+/).filter(Boolean));
    this.classList={contains:name=>this.classes.has(name),add:(...names)=>names.forEach(name=>this.classes.add(name)),remove:(...names)=>names.forEach(name=>this.classes.delete(name)),toggle:(name,force)=>{const next=force===undefined?!this.classes.has(name):force; if(next)this.classes.add(name);else this.classes.delete(name);return next;}};
    if(attributes.id)ids.set(attributes.id,this);
  }
  get textContent(){return this.children.map(child=>typeof child==='string'?decode(child):child.textContent).join('');}
  set textContent(value){this.children=[String(value)];}
  set innerHTML(value){this.children=[];parseFragment(String(value),this);}
  get innerHTML(){return this.textContent;}
  setAttribute(name,value){this.attributes[name]=String(value);if(name==='value')this.value=String(value);}
  getAttribute(name){return this.attributes[name] ?? null;}
  addEventListener(name,callback){(this.listeners[name] ||= []).push(callback);}
  dispatchEvent(event){const full={target:this,currentTarget:this,preventDefault(){},...event};for(const callback of this.listeners[event.type] || [])callback(full);return true;}
  click(){this.dispatchEvent({type:'click'});}
  focus(){}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);}
  querySelectorAll(selector){const output=[];const match=selector.trim().split(/\s+/).at(-1);const visit=node=>{for(const child of node.children){if(typeof child==='string')continue;if(matches(child,match))output.push(child);visit(child);}};visit(this);return output;}
  querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
  getBoundingClientRect(){return {width:900,height:550,left:0,top:0};}
  getContext(){return new Proxy({measureText:text=>({width:text.length*8})},{get:(target,key)=>target[key] || (()=>{})});}
  setPointerCapture(){}
  toDataURL(){return 'data:image/png;base64,';}
}

function matches(element,selector){
  const id=selector.match(/#([\w-]+)/);if(id && element.attributes.id!==id[1])return false;
  for(const match of selector.matchAll(/\.([\w-]+)/g))if(!element.classes.has(match[1]))return false;
  for(const match of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/g)){
    if(!Object.hasOwn(element.attributes,match[1]))return false;
    if(match[2]!==undefined && element.attributes[match[1]]!==match[2])return false;
  }
  const tag=selector.match(/^[a-z][\w-]*/i);return !tag || element.tagName===tag[0].toUpperCase();
}

function parseFragment(html,parent){
  const stack=[parent];
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []){
    if(token.startsWith('<!--') || /^<!/i.test(token))continue;
    if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
    if(token.startsWith('<')){
      const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;
      const attributes={};
      for(const match of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attributes[match[1]]=decode(match[2] ?? match[3] ?? match[4] ?? '');
      const node=new Element(tag,attributes);stack.at(-1).appendChild(node);
      if(!voidTags.has(tag.toLowerCase()) && !token.endsWith('/>'))stack.push(node);
    }else stack.at(-1).children.push(token);
  }
}

function makeDocument(){
  const root=new Element('root');
  parseFragment(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,''),root);
  return {body:root.querySelector('body'),documentElement:root.querySelector('html'),
    getElementById:id=>ids.get(id) || null,querySelectorAll:selector=>root.querySelectorAll(selector),
    querySelector:selector=>root.querySelector(selector),createElement:tag=>new Element(tag),
    addEventListener(){},fullscreenElement:null};
}
function makeContext(document){
  const context={document,console,history:{replaceState(){}},location:{hash:'#handbook'},
    setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:callback=>{callback();return 0;},
    Blob,URL,scrollTo(){},addEventListener(){},devicePixelRatio:1,innerWidth:1440};
  context.window=context;vm.createContext(context);return context;
}
function loadScripts(context,beforeUI=()=>{}){
  for(const id of ['metrics-core','metrics-ui']){
    const script=source.match(new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
    assert.ok(script,`${id} script exists`);
    if(id==='metrics-ui')beforeUI(context);
    vm.runInContext(script[1],context,{filename:`${path}:${id}`});
  }
}
const document=makeDocument();
const context=makeContext(document);loadScripts(context);

const get=id=>{const element=document.getElementById(id);assert.ok(element,`Missing #${id}`);return element;};
const text=id=>get(id).textContent;
const compact=value=>value.replaceAll(',','').replaceAll('−','-').replaceAll('×','*').replaceAll('·','*').replace(/\s+/g,'');
const includes=(id,fragment)=>assert.ok(compact(text(id)).includes(compact(fragment)),`#${id}: ${JSON.stringify(text(id))} must include ${JSON.stringify(fragment)}`);
const equals=(id,expected)=>assert.equal(compact(text(id)),compact(expected),`#${id}`);
const api=context.MetricsLab;
assert.ok(api?.setThreshold && api?.setPredictions,'Public UI controls are available');

const cases=[
  {cutoff:.25,tp:15,fp:1,fn:1,tn:3,p:'93.75%',r:'93.75%',f:'93.75%',a:'90%',fpr:'25%'},
  {cutoff:.10,tp:16,fp:3,fn:0,tn:1,p:'84.21%',r:'100%',f:'91.43%',a:'85%',fpr:'75%'},
  {cutoff:.50,tp:13,fp:0,fn:3,tn:4,p:'100%',r:'81.25%',f:'89.66%',a:'85%',fpr:'0%'},
  {cutoff:0,tp:16,fp:4,fn:0,tn:0,p:'80%',r:'100%',f:'88.89%',a:'80%',fpr:'100%'},
  {cutoff:1.01,tp:0,fp:0,fn:16,tn:4,p:'Undefined',r:'0%',f:'0%',a:'20%',fpr:'0%'},
];

function assertDisplayedThreshold(expected){
  api.setThreshold(expected.cutoff);
  const {tp,fp,fn,tn}=expected;
  const cells=get('confusion-matrix').querySelectorAll('.cm-cell');
  assert.deepEqual(cells.map(cell=>cell.dataset.outcome),['tp','fn','fp','tn'],'Actual/P-N by predicted/P-N matrix order');
  assert.deepEqual(cells.map(cell=>Number(cell.querySelector('strong').textContent)),[tp,fn,fp,tn],`Rendered counts at ${expected.cutoff}`);
  for(const [name,symbolic,value] of [
    ['precision','TP / (TP + FP)',expected.p],['recall','TP / (TP + FN)',expected.r],
    ['f1','2TP / (2TP + FP + FN)',expected.f],['accuracy','(TP + TN) / total',expected.a],
  ]){if(name==='f1')includes(`metric-${name}-symbolic`,symbolic);else equals(`metric-${name}-symbolic`,symbolic);equals(`metric-${name}-value`,value);}
  includes('metric-f1-symbolic','2PR / (P + R)');
  if(tp+fp===0){
    includes('metric-precision-live','0 / (0 + 0)');
    includes('metric-precision-live','undefined');
  }else includes('metric-precision-live',`${tp} / (${tp} + ${fp}) = ${tp} / ${tp+fp}`);
  includes('metric-recall-live',`${tp} / (${tp} + ${fn}) = ${tp} / ${tp+fn}`);
  includes('metric-f1-live',`${2*tp} / (${2*tp} + ${fp} + ${fn}) = ${2*tp} / ${2*tp+fp+fn}`);
  includes('metric-accuracy-live',`(${tp} + ${tn}) / 20 = ${tp+tn} / 20`);
  includes('roc-tpr-symbolic','TP / (TP + FN)');includes('roc-fpr-symbolic','FP / (FP + TN)');
  includes('roc-tpr-live',`${tp} / 16`);includes('roc-fpr-live',`${fp} / 4`);
  includes('roc-tpr-live',expected.r);includes('roc-fpr-live',expected.fpr);
  includes('auc-exact','59 / 64');includes('auc-exact','0.921875');
}
for(const expected of cases)assertDisplayedThreshold(expected);

// Independently group the canonical data, rather than using the app's counts
// to calculate the expected labels and fractions rendered by that same app.
const canonical=JSON.parse(fs.readFileSync(nodePath.join(LAB_ROOT,'data','delivery_metrics.json'),'utf8')).classification.rows;
assert.equal(canonical.length,20);
assert.deepEqual(Array.from(context.MetricsCore.scores),canonical.map(row=>row.on_time_score));
assert.deepEqual(Array.from(context.MetricsCore.actual),canonical.map(row=>row.arrived_on_time));
const actualPositive=canonical.filter(row=>row.arrived_on_time===1);
const actualNegative=canonical.filter(row=>row.arrived_on_time===0);
assert.equal(actualPositive.length,16);assert.equal(actualNegative.length,4);
const percentage=value=>value===null?'Undefined':String(Math.round(value*10000)/100)+'%';
function independentCounts(cutoff){
  const tp=actualPositive.filter(row=>row.on_time_score>=cutoff).length;
  const fp=actualNegative.filter(row=>row.on_time_score>=cutoff).length;
  const fn=actualPositive.length-tp,tn=actualNegative.length-fp;
  return {cutoff,tp,fp,fn,tn,p:percentage(tp+fp?tp/(tp+fp):null),
    r:percentage(tp/16),f:percentage(2*tp/(2*tp+fp+fn)),a:percentage((tp+tn)/20),fpr:percentage(fp/4)};
}
const reference=JSON.parse(fs.readFileSync(nodePath.join(LAB_ROOT,'tests','fixtures','classification_reference.json'),'utf8'));
assert.equal(reference.thresholds.length,106);
for(const snapshot of reference.thresholds){
  const expected=independentCounts(snapshot.threshold);
  assertDisplayedThreshold(expected);
  const core=context.MetricsCore.classify(snapshot.threshold);
  for(const name of ['tp','fp','fn','tn']){
    assert.equal(core[name],expected[name],`Core ${name} at ${snapshot.threshold}`);
    assert.equal(snapshot[name],expected[name],`Independent reference ${name} at ${snapshot.threshold}`);
  }
  for(const name of ['precision','recall','f1','accuracy','fpr']){
    if(snapshot[name]===null)assert.equal(core[name],null);
    else assert.ok(Math.abs(core[name]-snapshot[name])<1e-12,`Reference ${name} at ${snapshot.threshold}`);
  }
  const predictedPositiveRate=.8*(expected.tp/16)+.2*(expected.fp/4);
  if(predictedPositiveRate===0)assert.equal(core.precision,null,'No predicted positives leaves conditional precision undefined');
  else assert.ok(Math.abs((.8*(expected.tp/16))/predictedPositiveRate-core.precision)<1e-12,'Prevalence/ROC rates reproduce precision');
  // A matrix cell is highlighted because it contributes to the chosen group,
  // including zero-count cells. Cards represent individual cases instead.
  for(const metricName of ['precision','recall','f1','accuracy']){
    const button=document.querySelector(`[data-metric="${metricName}"]`);
    assert.ok(button);button.click();
    const matrix=get('confusion-matrix').querySelectorAll('.cm-cell');
    const outcomesFor=className=>matrix.filter(cell=>cell.classList.contains(className)).map(cell=>cell.dataset.outcome).sort();
    const expectedGroups={precision:['tp','fp'],recall:['tp','fn'],f1:['tp','fp','fn']};
    if(metricName==='accuracy'){
      assert.deepEqual(outcomesFor('numerator-cell'),['tn','tp'],'Accuracy emphasizes TP and TN as correct-forecast numerator');
      assert.deepEqual(outcomesFor('outside-focus'),['fn','fp'],'Accuracy excludes errors from highlighted numerator');
      assert.deepEqual(outcomesFor('denominator-cell'),[],'Accuracy does not highlight all four denominator cells');
    }else assert.deepEqual(outcomesFor('denominator-cell'),expectedGroups[metricName].sort(),`${metricName} matrix group`);
    const cards=get('case-grid').querySelectorAll('.case-card');
    assert.equal(cards.length,20);
    const countClass=className=>cards.filter(card=>card.classList.contains(className)).length;
    const {tp,fp,fn,tn}=expected;
    if(metricName==='accuracy'){
      assert.equal(countClass('is-accuracy-correct'),tp+tn,'Accuracy outlines only correctly predicted cases');
      assert.equal(countClass('is-dimmed'),fp+fn,'Accuracy dims only incorrectly predicted cases');
    }else{
      const dimmed={precision:fn+tn,recall:fp+tn,f1:tn}[metricName];
      assert.equal(countClass('is-dimmed'),dimmed,`${metricName} card denominator at ${snapshot.threshold}`);
    }
  }
}

const independentRoc=[Infinity,...new Set(canonical.map(row=>row.on_time_score))]
  .map(cutoff=>independentCounts(cutoff));
assert.equal(Math.max(...independentRoc.filter(point=>point.fp/4<=.25).map(point=>point.tp/16)),15/16,'Best recall under FPR<=.25');
assert.equal(Math.min(...independentRoc.filter(point=>point.tp===16).map(point=>point.fp/4)),.75,'Minimum FPR at full recall');

const pairBreakdown=actualNegative.map(negative=>({
  caseId:negative.case_id,score:negative.on_time_score,
  wins:actualPositive.filter(positive=>positive.on_time_score>negative.on_time_score).length,
  ties:actualPositive.filter(positive=>positive.on_time_score===negative.on_time_score).length,
  losses:actualPositive.filter(positive=>positive.on_time_score<negative.on_time_score).length,
}));
assert.deepEqual(pairBreakdown.map(row=>[row.caseId,row.wins,row.ties,row.losses]),[
  ['D14',13,0,3],['D17',15,0,1],['D18',15,0,1],['D20',16,0,0],
]);
assert.equal(pairBreakdown.reduce((sum,row)=>sum+row.wins,0),59);
assert.equal(pairBreakdown.reduce((sum,row)=>sum+row.losses,0),5);
assert.equal(actualPositive.length*actualNegative.length,64);
assert.equal((59+.5*0)/64,context.MetricsCore.roc().auc);
includes('auc-pair-formula','(wins + 0.5 × ties) / (actual P × actual N)');
includes('auc-pair-substitution','(59 + 0.5 × 0) / (16 × 4) = 59 / 64 = 0.921875');
includes('auc-pair-counts','16 actual P × 4 actual N = 64 comparisons: 59 wins, 0 ties, 5 losses');
includes('auc-area-connection','(1/4) × (13/16 + 15/16 + 15/16 + 16/16) = 59/64');
includes('auc-fixed-ranking-note','ranking unchanged');
const comparisonRows=get('auc-pair-breakdown').querySelectorAll('[data-negative-case]');
assert.equal(comparisonRows.length,4,'AUC explains all four negative cases');
for(const expected of pairBreakdown){
  const row=comparisonRows.find(row=>row.dataset.negativeCase===expected.caseId);
  assert.ok(row,`AUC comparison row for ${expected.caseId}`);
  const value=compact(row.textContent);
  assert.ok(value.includes(compact(`${expected.caseId} · actual N · score ${expected.score.toFixed(2)}`)));
  assert.ok(value.includes(compact(`${expected.wins} / 16 positive-case wins · ${expected.ties} ties · ${expected.losses} ${expected.losses===1?'loss':'losses'}`)));
}
const positiveHeaders=get('auc-pair-grid').querySelectorAll('.auc-positive-header');
const negativeHeaders=get('auc-pair-grid').querySelectorAll('.auc-negative-header');
assert.equal(positiveHeaders.length,16);assert.equal(negativeHeaders.length,4);
for(const [headers,rows,key] of [[positiveHeaders,actualPositive,'positiveCase'],[negativeHeaders,actualNegative,'negativeCase']]){
  headers.forEach((header,index)=>{
    const expected=rows[index];
    assert.equal(header.dataset[key],expected.case_id);
    assert.equal(Number(header.dataset.score),expected.on_time_score);
    assert.ok(header.textContent.includes(expected.case_id));
    assert.ok(header.textContent.includes(expected.on_time_score.toFixed(2)));
  });
}
const gridRows=get('auc-pair-grid').querySelectorAll('tr').filter(row=>row.querySelector('.auc-negative-header'));
assert.equal(gridRows.length,4);
for(let negativeIndex=0;negativeIndex<actualNegative.length;negativeIndex++){
  const negative=actualNegative[negativeIndex];
  const pairCells=gridRows[negativeIndex].querySelectorAll('.auc-pair-cell');
  assert.equal(pairCells.length,16,'Each actual late case has 16 on-time comparisons');
  actualPositive.forEach((positive,positiveIndex)=>{
    const expectedResult=positive.on_time_score>negative.on_time_score?'win':positive.on_time_score===negative.on_time_score?'tie':'loss';
    const credit=expectedResult==='win'?1:expectedResult==='tie'?.5:0;
    const cell=pairCells[positiveIndex];
    assert.ok(cell.classList.contains(expectedResult),`${positive.case_id} versus ${negative.case_id}`);
    assert.equal(cell.dataset.positiveCase,positive.case_id);assert.equal(cell.dataset.negativeCase,negative.case_id);
    assert.equal(Number(cell.dataset.positiveScore),positive.on_time_score);assert.equal(Number(cell.dataset.negativeScore),negative.on_time_score);
    assert.equal(cell.dataset.result,expectedResult);assert.equal(Number(cell.dataset.credit),credit);
    assert.equal(Number(cell.textContent),credit);
    assert.ok(cell.getAttribute('aria-label').includes(`Actual P ${positive.case_id} score ${positive.on_time_score.toFixed(2)}`));
    assert.ok(cell.getAttribute('aria-label').includes(`actual N ${negative.case_id} score ${negative.on_time_score.toFixed(2)}`));
  });
}
function selectAndCheckPair(positive,negative,doc=document){
  const cell=doc.querySelector(`.auc-pair-cell[data-positive-case="${positive.case_id}"][data-negative-case="${negative.case_id}"]`);
  assert.ok(cell,`${positive.case_id}/${negative.case_id} selection exists`);cell.click();
  const relation=positive.on_time_score>negative.on_time_score?'>':positive.on_time_score<negative.on_time_score?'<':'=';
  const credit=relation==='>'?1:relation==='='?.5:0;
  equals('auc-selected-positive',`Actual P: ${positive.case_id} · score ${positive.on_time_score.toFixed(2)}`);
  equals('auc-selected-negative',`Actual N: ${negative.case_id} · score ${negative.on_time_score.toFixed(2)}`);
  equals('auc-selected-relation',`${positive.on_time_score.toFixed(2)} ${relation} ${negative.on_time_score.toFixed(2)}`);
  equals('auc-selected-credit',String(credit));
  includes('auc-selected-result',relation==='>'?'Positive-case ranking win':relation==='<'?'Positive-case ranking loss':'Tied scores: half credit');
  const selected=doc.querySelectorAll('.auc-pair-cell').filter(button=>button.getAttribute('aria-pressed')==='true');
  assert.equal(selected.length,1,'Exactly one pair is selected');
  assert.equal(selected[0].dataset.positiveCase,positive.case_id);assert.equal(selected[0].dataset.negativeCase,negative.case_id);
}
for(const negative of actualNegative)for(const positive of actualPositive)selectAndCheckPair(positive,negative);
const selectedPositive=actualPositive.find(row=>row.case_id==='D19');
const selectedNegative=actualNegative.find(row=>row.case_id==='D14');
selectAndCheckPair(selectedPositive,selectedNegative);
includes('auc-pair-perspective','actual-P case');
includes('auc-score-note','not calibrated probabilities');
includes('auc-ranking-interpretation','does not measure probability calibration or classification accuracy');
includes('auc-d20-interpretation','D20 is an actual-N case with score 0.05');
includes('auc-d20-interpretation','16 positive-case ranking wins, 0 ties, 0 reversed pairs');
const details=get('auc-pair-details');details.open=true;
for(const cutoff of [.25,.10,.50,0,1.01]){
  api.setThreshold(cutoff);
  assert.equal(get('auc-pair-details'),details,'Moving the cutoff retains the AUC disclosure element');
  assert.equal(details.open,true,'Moving the cutoff preserves an open AUC explanation');
  includes('auc-pair-substitution','= 59 / 64 = 0.921875');
  equals('auc-selected-relation','0.10 < 0.45');equals('auc-selected-credit','0');
  assert.equal(api.state.selectedPair.positive,'D19');assert.equal(api.state.selectedPair.negative,'D14');
}
api.setThreshold(0);
equals('metric-precision-value','80%');equals('metric-recall-value','100%');
includes('roc-axis-note','Recall (TPR), not precision');
includes('roc-axis-note','False-positive rate (FPR)');
includes('roc-rate-context','all 16 P captured → TPR 100%');
includes('roc-rate-context','all 4 N incorrectly On track → FPR 100%');
includes('roc-rate-context','Precision is 16/20 = 80%');

const regressionCases=[
  {predictions:[25,35,45,55,65],sse:125,r2:.875,terms:[25,25,25,25,25],absoluteTotal:25,mae:5,mse:25,rmse:5,meanResidual:-5},
  {predictions:[40,40,40,40,40],sse:1000,r2:0,terms:[400,100,0,100,400],absoluteTotal:60,mae:12,mse:200,rmse:Math.sqrt(200),meanResidual:0},
  {predictions:[60,60,60,60,60],sse:3000,r2:-2,terms:[1600,900,400,100,0],absoluteTotal:100,mae:20,mse:600,rmse:Math.sqrt(600),meanResidual:-20},
  {predictions:[20,30,40,50,60],sse:0,r2:1,terms:[0,0,0,0,0],absoluteTotal:0,mae:0,mse:0,rmse:0,meanResidual:0},
  {predictions:[20,30,40,50,85],sse:625,r2:.375,terms:[0,0,0,0,625],absoluteTotal:25,mae:5,mse:125,rmse:Math.sqrt(125),meanResidual:-5},
];
function assertRegressionErrorMetrics(expected){
  const result=context.MetricsCore.regression(expected.predictions);
  equals('regression-mae-symbolic','Σ|y − ŷ| / n');
  equals('regression-mse-symbolic','SSE / n = Σ(y − ŷ)² / n');
  equals('regression-rmse-symbolic','√MSE = √(SSE / n)');
  for(const key of ['mae','mse','rmse','meanResidual']){
    assert.ok(Math.abs(result[key]-expected[key])<1e-12,`${key}: ${JSON.stringify(expected.predictions)}`);
  }
  const residuals=[20,30,40,50,60].map((actual,index)=>actual-expected.predictions[index]);
  assert.deepEqual(Array.from(result.residuals),residuals,'Signed residuals use actual minus prediction');
  assert.deepEqual(Array.from(result.absoluteErrors),residuals.map(Math.abs),'MAE uses magnitudes');
  for(const [name,fullName] of [['mae','Mean Absolute Error'],['mse','Mean Squared Error'],['rmse','Root Mean Squared Error']]){
    includes(`regression-${name}-name`,fullName);
    assert.equal(Number(compact(text(`regression-${name}-value`))),Number(expected[name].toFixed(2)),`${name} displayed value`);
  }
  includes('regression-mae-live',`${expected.absoluteTotal} / 5`);
  includes('regression-mae-live',`${expected.mae} min`);
  includes('regression-mse-live',`${expected.sse} / 5`);
  includes('regression-mse-live',`${expected.mse} min²`);
  includes('regression-rmse-live',`√(${expected.sse} / 5)`);
  includes('regression-rmse-live',`√${expected.mse}`);
}
function assertFirstOrderWorkedExample(firstPrediction){
  equals('r2-sse-name','SSE · Sum of Squared Errors');
  equals('r2-sst-name','SST · Total Sum of Squares');
  const residual=20-firstPrediction;
  includes('r2-model-residual',`20 − ${firstPrediction} = ${residual} min`);
  includes('r2-model-square',`(${residual})² = ${residual**2} min²`);
  includes('r2-baseline-residual','20 − 40 = −20 min');
  includes('r2-baseline-square','(−20)² = 400 min²');
}
for(const expected of regressionCases){
  api.setPredictions(expected.predictions);
  assertRegressionErrorMetrics(expected);
  assertFirstOrderWorkedExample(expected.predictions[0]);
  assert.equal(Number(text('r2-value')),expected.r2);
  includes('r2-live-formula',`1 - ${expected.sse} / 1000`);
  includes('r2-live-formula',`= ${expected.r2.toFixed(3)}`);
  includes('r2-sse-live',`${expected.terms.join(' + ')} = ${expected.sse}`);
  includes('r2-sst-live','400 + 100 + 0 + 100 + 400 = 1000');
  includes('r2-sse-symbolic','Σ(y − ŷ)²');
  includes('r2-sst-symbolic','Σ(y − ȳ)²');
}
const uniformError=context.MetricsCore.regression(regressionCases[0].predictions);
const concentratedError=context.MetricsCore.regression(regressionCases[4].predictions);
assert.equal(uniformError.mae,concentratedError.mae,'Uniform and concentrated misses have equal MAE');
assert.ok(concentratedError.rmse>2*uniformError.rmse,'RMSE reflects the single large miss');
const outlierPreset=document.querySelector('[data-regression="outlier"]');
assert.ok(outlierPreset,'One large miss preset is available');
outlierPreset.click();
assert.deepEqual(Array.from(api.state.predictions),regressionCases[4].predictions);
assertRegressionErrorMetrics(regressionCases[4]);

// Typing outside the supported range must immediately agree with the state
// and displayed formula, before any blur/change event can normalize the input.
for(const [typed,clamped,sse,r2] of [[150,100,6500,-5.5],[-10,0,500,.5]]){
  api.setPredictions([25,35,45,55,65]);
  const input=get('prediction-0');input.value=String(typed);input.dispatchEvent({type:'input'});
  assert.equal(Number(input.value),clamped,'Input displays its clamp immediately');
  assert.equal(api.state.predictions[0],clamped,'Calculation uses displayed clamped prediction');
  assertFirstOrderWorkedExample(clamped);
  assert.equal(Number(compact(text('sse-value'))),sse);
  assert.equal(Number(text('r2-value')),r2);
  includes('r2-live-formula',`1 - ${sse} / 1000 = ${r2.toFixed(3)}`);
  assertRegressionErrorMetrics(typed===150
    ? {predictions:[100,35,45,55,65],sse:6500,absoluteTotal:100,mae:20,mse:1300,rmse:Math.sqrt(1300),meanResidual:-20}
    : {predictions:[0,35,45,55,65],sse:500,absoluteTotal:40,mae:8,mse:100,rmse:10,meanResidual:0});
}

const clickRail=step=>{
  const button=document.querySelector(`[data-teach="${step}"]`);
  assert.ok(button,`Teaching rail contains ${step}`);button.click();
};
api.setThreshold(.50);
clickRail('trap');assert.equal(api.state.threshold,0,'Accuracy trap selects all P');
assert.ok(document.querySelector('[data-teach="trap"]').textContent.includes('Accuracy baseline'),'Reference label names the baseline without a teacher cue');
equals('metric-accuracy-value','80%');
clickRail('register');assert.equal(api.state.threshold,.25,'Register selects .25');
assert.ok(document.querySelector('[data-teach="register"]').textContent.includes('Confusion matrix'),'Reference label names the concept');
assert.ok(!get('classification-lab').textContent.includes('Teach here'),'Learner reference does not show the old teacher label');
equals('metric-precision-value','93.75%');
for(const cutoff of [.50,1.01]){
  for(const step of ['precision','recall','f1','roc']){
    api.setThreshold(cutoff);clickRail(step);
    assert.equal(api.state.threshold,cutoff,`${step} preserves selected cutoff ${cutoff}`);
    if(cutoff===1.01 && step==='f1'){
      const explanation=compact(text('teaching-context')).toLowerCase();
      assert.ok(explanation.includes('precisionisundefined'),'F1 reference explains undefined precision');
      assert.match(explanation,/f1(?:is|=)0/,'F1 reference still explains a zero count-based result');
    }
  }
}
api.setThreshold(.50);
for(const name of ['precision','recall','f1','accuracy']){
  const button=document.querySelector(`[data-metric="${name}"]`);
  assert.ok(button,`Metric ${name} is clickable`);button.click();
  assert.equal(api.state.threshold,.50,`${name} metric click preserves cutoff`);
  assert.equal(api.state.focus,name,`${name} metric click selects explanation`);
}
api.setThreshold(.25);
equals('metric-precision-value','93.75%');equals('metric-f1-value','93.75%');

for(const [metric,conditional] of [['precision','P(Y = 1 | Ŷ = 1)'],['recall','P(Ŷ = 1 | Y = 1)'],['accuracy','P(Ŷ = Y)']]){
  document.querySelector(`[data-metric="${metric}"]`).click();
  includes('metric-technical-content',conditional);
}
clickRail('roc');
includes('metric-technical-content','best attainable TPR in this score set is 93.75%');
includes('metric-technical-content','Full recall requires 75% FPR');
includes('metric-technical-content','not 92.1875% classification accuracy');
const technical=text('metric-technical-content').replace(/\s+/g,'').toLowerCase();
assert.ok(technical.includes('(0,0)') && technical.includes('precisionisundefined'),'ROC precision identity explains its zero-denominator boundary');

// The real 20 cases have no ties. A separate in-memory app instance exercises
// the half-credit branch without changing any source file or canonical case.
const originalIds=new Map(ids);ids.clear();
const tieDocument=makeDocument(),tieContext=makeContext(tieDocument);
loadScripts(tieContext,app=>{app.MetricsCore.scores[14]=.45;});
const tiedPositive={...canonical[14],on_time_score:.45},tiedNegative=canonical[13];
selectAndCheckPair(tiedPositive,tiedNegative,tieDocument);
const tieCell=tieDocument.querySelector('.auc-pair-cell[data-positive-case="D15"][data-negative-case="D14"]');
assert.equal(tieCell.dataset.result,'tie');assert.equal(Number(tieCell.dataset.credit),.5);
assert.equal(tieCell.textContent,'½');
assert.equal(Number(tieDocument.querySelector('.auc-positive-header[data-positive-case="D15"]').dataset.score),.45);
assert.equal(tieContext.MetricsCore.roc().auc,59.5/64);
includes('auc-pair-counts','59 wins, 1 tie, 4 losses');
includes('auc-pair-substitution','(59 + 0.5 × 1) / (16 × 4) = 59.5 / 64');
ids.clear();for(const [id,element] of originalIds)ids.set(id,element);
assert.deepEqual(Array.from(context.MetricsCore.scores),canonical.map(row=>row.on_time_score),'The canonical app scores stay unchanged');

console.log(`PASS: ${path}; ${reference.thresholds.length} independently checked cutoffs, 64 labeled/selectable pairs, persistent pair details, isolated half-credit tie, ROC constraints, ${regressionCases.length} MAE/MSE/RMSE/R2 presets and input clamps, and metric highlights. DOM text only; browser layout is separate.`);
