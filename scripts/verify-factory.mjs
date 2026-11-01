import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const manifest=JSON.parse(await fs.readFile(new URL('../wwwroot/assets/factory/manifest.json',import.meta.url)));
for (const [name,asset] of Object.entries(manifest.assets)) {
  const png=await fs.readFile(new URL(`../wwwroot${asset.file}`,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG',name);
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],asset.dimensions,name);
  assert.deepEqual(asset.size,asset.dimensions.map(n=>n/2),`${name} is a 2x export`);
  assert(asset.pivot.every(Number.isFinite),`${name} has a stable pivot`);
  for(const source of asset.sourceModels)await fs.access(new URL(`../assets/kenney-factory-kit/models/${source}.glb`,import.meta.url));
}
assert.deepEqual(manifest.assets['intake-scanner'].connections.in,manifest.anchors.apiIn);
assert.deepEqual(manifest.assets['storage-online'].connections.in,manifest.anchors.dbIn);
assert.deepEqual(manifest.assets['storage-offline'].connections.in,manifest.anchors.dbIn);
assert.deepEqual(manifest.assets['robot-working'].connections.work,manifest.anchors.worker);
assert(manifest.assets.parcel.size[0] < Math.abs(manifest.queueSlots[1][0]-manifest.queueSlots[0][0]), 'Queued parcel hit areas must not overlap');
console.log('PASS: PNG sizes, 2x resolution, pivots, original models, and station connections.');

// Execute the actual motion function with a deterministic clock; no server or DOM mutation.
const source=await fs.readFile(new URL('../wwwroot/app.js',import.meta.url),'utf8');
const motion=source.slice(source.indexOf('function move('),source.indexOf('async function dispatchAnimation'));
let frames=new Map(),nextFrame=0;
const context={generation:1,reduceMotion:{matches:true},cancellations:new Set(),performance:{now:()=>0},
 requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)};
vm.createContext(context);vm.runInContext(motion+';this.move=move;',context);
const parcel={style:{}};
await context.move(parcel,[[0,0],[1040,620]],500,1);
assert.equal(parcel.style.left,'100%');assert.equal(parcel.style.top,'100%');assert.equal(frames.size,0);
context.reduceMotion.matches=false;
const travel=context.move(parcel,[[0,0],[1040,620]],500,1);
assert.equal(context.cancellations.size,1);
context.generation=2;
for(const callback of frames.values()){callback(100);break;}
await travel;
assert.equal(context.cancellations.size,0);assert.equal(frames.size,0);
const changedPreference=context.move(parcel,[[0,0],[1040,620]],500,2);
context.reduceMotion.matches=true;
for(const callback of frames.values()){callback(100);break;}
await changedPreference;
assert.equal(parcel.style.top,'100%');assert.equal(frames.size,0);
console.log('PASS: reduced motion skips travel, a preference change ends active travel, and restarting cancels it.');
