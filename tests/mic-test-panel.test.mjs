import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicTestPanel} from '../public/mic-test-panel.js';

test('Test mic switches off room capture before opening local capture, including a pending live request',t=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){}};
 t.after(()=>{globalThis.window=previousWindow;globalThis.document=previousDocument;});
 const elements=new Map(),events=[];
 const node=()=>({hidden:false,setAttribute(){},pause(){},hasAttribute(){return false;},load(){}});
 const root={hidden:true,querySelector(selector){if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);}},toggle=node();
 let live=true,pending=false;
 const panel=createMicTestPanel({root,toggle,canTest:()=>!live&&!pending,
  beforeTest(){events.push('stop-live');live=pending=false;},createTester:()=>({start(){assert.equal(live||pending,false);events.push('start-local');},stop(){events.push('stop-local');},record(){}})});
 toggle.onclick();assert.equal(root.hidden,false);assert.deepEqual(events,['stop-live','start-local']);
 toggle.onclick();assert.equal(root.hidden,true);assert.equal(events.at(-1),'stop-local');
 pending=true;toggle.onclick();assert.equal(pending,false);assert.equal(events.at(-1),'start-local');
 elements.get('[data-mic-start]').onclick();assert.equal(events.at(-1),'start-local');
 panel.close();assert.equal(root.hidden,true);
});
