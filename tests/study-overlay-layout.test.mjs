import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=process.env.CV_SEPARATE_TEST_SITE||path.join(root,'dist/separate-pages');
const source=fs.readFileSync(path.join(site,'pet-runtime.js'),'utf8');
// Only the main engine, not the preserved nested reviewed-step payload.
const engine=source.split('  const ReviewedStep=')[0];
const definitions=[...engine.matchAll(/function nearestScalePlacement\([\s\S]*?\n\}/g)];
assert.equal(definitions.length,1,'one exact shipped nearest-placement helper');
const helper={};vm.runInNewContext(definitions[0][0]+';this.place=nearestScalePlacement',helper);
const nearestScalePlacement=helper.place;
const context={nearestScalePlacement};vm.runInNewContext(fs.readFileSync(new URL('../page-adapters/study-overlay.js',import.meta.url),'utf8')+';this.place=nearestViewportOverlayPlacement',context);
const overlap=(a,b)=>a.left<b.right+4&&a.right>b.left-4&&a.top<b.bottom+4&&a.bottom>b.top-4;
for(const [w,h] of [[360,740],[412,800],[500,757],[1280,900]])test(`overlay ${w}x${h}: six selected bodies fit around text/control paint, no dock or probability changes`,()=>{
 const viewport={left:0,top:0,right:w,bottom:h};
 const controls=[{left:14,top:h-120,right:w-14,bottom:h-70},{left:14,top:12,right:w-14,bottom:56}];
 const text=[{left:w*.27,top:140,right:w*.73,bottom:200},{left:w*.25,top:240,right:w*.75,bottom:270},{left:w*.12,top:340,right:w*.88,bottom:370},{left:w*.15,top:410,right:w*.85,bottom:440}];
 const occupied=[...controls,...text],sizes=[126,130,126,122,150,120];
 for(let i=0;i<6;i++){const width=sizes[i]*(w<640?.4:w<=900?.8:1),height=width*4/3;const fit=context.place({x:w*(i+.5)/6-width/2,y:h-height-8,width,height,padding:{left:0,right:0,top:0,bottom:0},viewport,obstacles:occupied});assert.ok(fit,'selected actor '+i+' has a visible safe placement');const box={left:fit.x,top:fit.y,right:fit.x+width,bottom:fit.y+height};assert.ok(box.left>=0&&box.right<=w&&box.top>=0&&box.bottom<=h);assert.ok(!occupied.some(r=>overlap(box,r)));occupied.push(box);}
});
test('overlay preserves a safe dragged location instead of snapping every frame',()=>{
 const options={x:102,y:78,width:50,height:70,padding:{left:0,right:0,top:0,bottom:0},viewport:{left:0,top:0,right:360,bottom:740},obstacles:[{left:0,top:600,right:360,bottom:720}]};
 const fit=context.place(options);assert.equal(fit.x,102);assert.equal(fit.y,78);
});
test('true no-space has no unsafe fallback, and visual viewport offsets constrain all paint',()=>{
 const options={x:0,y:0,width:50,height:70,padding:{left:5,right:5,top:0,bottom:4},viewport:{left:20,top:50,right:340,bottom:600},obstacles:[]};
 const fit=context.place(options);assert.ok(fit.x>=25&&fit.y>=50);assert.equal(context.place({...options,obstacles:[{left:20,top:50,right:340,bottom:600}]}),null);
});
