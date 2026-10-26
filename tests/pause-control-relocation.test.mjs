import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../chiikawa-pets/integration.js',import.meta.url),'utf8');
const line=needle=>source.split('\n').find(value=>value.includes(needle));

function fixture({paused=true,momonga=true,reduced=false}={}){
  const document={activeElement:null};
  class Node extends EventTarget{
    constructor(name){super();this.name=name;this.children=[];this.parentNode=null;this.hidden=false;this.inert=false;this.scrollTop=0;this.scrollLeft=0;this.attrs={};this.checked=false;this.classList={values:new Set(),add(x){this.values.add(x);},remove(x){this.values.delete(x);},contains(x){return this.values.has(x);}};}
    get isConnected(){return this.name==='body'||!!this.parentNode?.isConnected;}
    get firstChild(){return this.children[0]??null;}
    get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]??null;}
    appendChild(node){node.remove();this.children.push(node);node.parentNode=this;return node;}
    insertBefore(node,before){node.remove();const index=before===null?this.children.length:this.children.indexOf(before);assert.ok(index>=0);this.children.splice(index,0,node);node.parentNode=this;return node;}
    remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
    contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
    setAttribute(key,value){this.attrs[key]=value;}
    focus(){document.activeElement=this;}
    closest(){return null;}
  }
  const body=new Node('body'),owner=body.appendChild(new Node('owner'));
  const header=owner.appendChild(new Node('header')),petTools=header.appendChild(new Node('petTools'));
  petTools.appendChild(new Node('hint'));const toggle=petTools.appendChild(new Node('pauseButton'));petTools.appendChild(new Node('picker'));
  const originalOrder=[...petTools.children];
  const characterViewStage=body.appendChild(new Node('characterViewStage')),characterViewButton=body.appendChild(new Node('characterViewButton'));
  const flightTools=body.appendChild(new Node('flightTools')),flyOnce=flightTools.appendChild(new Node('flyOnce'));
  const flyAuto=flightTools.appendChild(new Node('flyAuto')),greetingTools=body.appendChild(new Node('greetingTools')),greetingAuto=greetingTools.appendChild(new Node('greetingAuto'));
  const window=new EventTarget();Object.assign(window,{scrollX:0,scrollY:0,scrollTo(x,y){this.scrollX=x;this.scrollY=y;}});
  document.body=body;document.createElement=name=>new Node(name);document.createComment=()=>new Node('marker');document.activeElement=toggle;
  const mobileDock=body.appendChild(new Node('dock')),directStage=owner.appendChild(new Node('direct')),betaStage=owner.appendChild(new Node('beta')),extraPanel=owner.appendChild(new Node('extra')),pajamaPanel=owner.appendChild(new Node('pajama'));
  const storage=new Map([['study-sentinel','unchanged']]);let writes=0,enginePaused=paused,cancelCalls=0,pauseCalls=0,resumeCalls=0;
  const preferences={schemaVersion:1,visible:{chiikawa:true,hachiware:true,usagi:true,shisa:true,momonga,rakko:true},paused};
  const context=vm.createContext({document,window,Event,toggle,flightTools,greetingTools,flyAuto,greetingAuto,characterViewStage,characterViewButton,contentViewport:owner,mobileDock,directStage,betaStage,extraPanel,pajamaPanel,ownedContentPanels:[],kaniRailRevalidators:[],characterOnlyMode:false,userPaused:paused,preferences,visibilityKey:'jlpt-pet-visibility-v1',motionQuery:{matches:reduced},syncVisibilityUI(){},
    pets:{isPaused:()=>enginePaused||reduced,pause(){enginePaused=true;pauseCalls++;},resume(){enginePaused=false;resumeCalls++;}},
    previewCoordinator:{cancelAll(){cancelCalls++;}},extraController:{revalidate(){}},pajamaController:{revalidate(){}},
    localStorage:{setItem(k,v){writes++;storage.set(k,v);}},
    refreshFlightUI(){flightTools.hidden=!context.characterOnlyMode;},refreshGreeting(){greetingTools.hidden=!context.characterOnlyMode;},
    refreshCharacterFlight(){if(!context.characterOnlyMode)flyAuto.checked=false;},refreshCharacterGreeting(){if(!context.characterOnlyMode)greetingAuto.checked=false;}
  });
  vm.runInContext(source.slice(source.indexOf('function createCharacterOnlyMode('),source.indexOf(';return{createCharacterOnlyMode};'))+';this.CharacterOnlyView={createCharacterOnlyMode};',context);
  vm.runInContext(source.slice(source.indexOf('  const characterView=CharacterOnlyView'),source.indexOf('  // bfcache preserves')),context);
  vm.runInContext(source.slice(source.indexOf('  function saveVisibility()'),source.indexOf('  function syncVisibilityUI()')),context);
  vm.runInContext(source.slice(source.indexOf('  function syncToggle()'),source.indexOf('  function applyVisibility()')),context);
  vm.runInContext(line("toggle.addEventListener('click',()=>{previewCoordinator.cancelAll('pause-change')"),context);
  vm.runInContext(source.slice(source.indexOf('  // Move only existing controls;'),source.indexOf("  window.addEventListener('resize',syncMobileMotionToolbar);")+"  window.addEventListener('resize',syncMobileMotionToolbar);".length)+';syncMobileMotionToolbar();syncToggle();this.mode=characterView;',context);
  const descendants=node=>[node,...node.children.flatMap(descendants)];
  const accessible=node=>{for(let n=node;n;n=n.parentNode)if(n.hidden||n.inert)return false;return node.isConnected;};
  return{body,owner,petTools,originalOrder,toggle,flightTools,flyOnce,flyAuto,greetingAuto,characterViewStage,characterViewButton,document,window,storage,preferences,context,
    accessible,mode:context.mode,writes:()=>writes,pauseCalls:()=>pauseCalls,resumeCalls:()=>resumeCalls,cancelCalls:()=>cancelCalls,
    countPause:()=>descendants(body).filter(node=>node===toggle).length,
    clickPause:()=>toggle.dispatchEvent(new Event('click')),
  };
}

test('one existing pause control participates in character-only relocation and returns home',()=>{
  assert.match(line('const mobileControlHomes='),/\[toggle,flightTools,greetingTools\]/);
  assert.match(line('if(needed&&!controlsMoved)'),/if\(node===toggle\)flightTools\.insertBefore\(node,flightTools\.firstChild\)/);
  assert.match(line('else if(!needed&&controlsMoved)'),/anchor\.parentNode\.insertBefore\(node,anchor\.nextSibling\)/);
});

for(const momonga of [true,false])test(`saved pause ON → character-only resume → normal; Momonga ${momonga?'ON':'OFF'}`,()=>{
  const f=fixture({momonga});
  assert.equal(f.toggle.attrs['aria-pressed'],'true');assert.equal(f.toggle.textContent,'자동 동작 재개');
  f.mode.setActive(true);
  assert.equal(f.owner.hidden,true);assert.equal(f.owner.inert,true);
  assert.equal(f.toggle.parentNode,f.flightTools);assert.equal(f.flightTools.firstChild,f.toggle);assert.equal(f.toggle.nextSibling,f.flyOnce);
  assert.equal(f.accessible(f.toggle),true);assert.equal(f.countPause(),1);assert.equal(f.writes(),0);assert.equal(f.context.pets.isPaused(),true);
  f.toggle.focus();f.clickPause();
  assert.equal(f.context.pets.isPaused(),false);assert.equal(f.resumeCalls(),1);assert.equal(f.pauseCalls(),0);
  assert.equal(f.toggle.textContent,'자동 동작 일시정지');assert.equal(f.toggle.attrs['aria-pressed'],'false');
  assert.equal(f.writes(),1);assert.equal(f.preferences.paused,false);assert.equal(f.preferences.visible.momonga,momonga);
  assert.equal(f.storage.get('study-sentinel'),'unchanged');assert.equal(f.storage.size,2);
  assert.equal(f.flyAuto.checked,false);assert.equal(f.greetingAuto.checked,false);
  f.mode.setActive(false);
  assert.equal(f.owner.hidden,false);assert.equal(f.owner.inert,false);assert.equal(f.toggle.parentNode,f.petTools);assert.equal(f.accessible(f.toggle),true);assert.equal(f.countPause(),1);
  assert.deepEqual(f.petTools.children.filter(n=>n.name!=='marker'),f.originalOrder);
  assert.equal(f.writes(),1);assert.equal(f.context.pets.isPaused(),false);
});

test('repeated entry/exit, resize and pause/resume do not clone controls, listeners, or preference writes',()=>{
  const f=fixture({paused:false});
  for(let i=0;i<10;i++){
    const before=f.writes();f.mode.setActive(true);f.mode.setActive(true);f.window.dispatchEvent(new Event('resize'));
    assert.equal(f.countPause(),1);assert.equal(f.accessible(f.toggle),true);assert.equal(f.writes(),before);
    f.clickPause();assert.equal(f.context.pets.isPaused(),true);f.clickPause();assert.equal(f.context.pets.isPaused(),false);assert.equal(f.writes(),before+2);
    f.mode.setActive(false);f.mode.setActive(false);f.window.dispatchEvent(new Event('resize'));
    assert.equal(f.countPause(),1);assert.equal(f.toggle.parentNode,f.petTools);assert.equal(f.writes(),before+2);
  }
  assert.equal(f.pauseCalls(),10);assert.equal(f.resumeCalls(),10);
});

test('reduced motion remains authoritative; relocation does not bypass it or enable opt-ins',()=>{
  const f=fixture({paused:false,reduced:true});f.mode.setActive(true);f.clickPause();
  assert.equal(f.context.pets.isPaused(),true);assert.equal(f.toggle.attrs['aria-pressed'],'true');
  assert.match(f.toggle.title,/시스템 동작 줄이기/);assert.equal(f.preferences.paused,false);
  assert.equal(f.flyAuto.checked,false);assert.equal(f.greetingAuto.checked,false);f.mode.setActive(false);
});

test('destroy from character-only restores same pause control and focus with no storage writes',()=>{
  const f=fixture();f.mode.setActive(true);f.toggle.focus();f.mode.destroy();
  assert.equal(f.toggle.parentNode,f.petTools);assert.equal(f.accessible(f.toggle),true);assert.equal(f.countPause(),1);assert.equal(f.writes(),0);
  assert.equal(f.document.activeElement,f.toggle);
});
