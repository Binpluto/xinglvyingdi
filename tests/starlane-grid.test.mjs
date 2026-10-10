import test from 'node:test';
import assert from 'node:assert/strict';
import {dayCells} from '../vercel-proxy/starlane-grid.mjs';
test('each scale covers a complete 24h day with contiguous cells',()=>{
  for(const step of [10,15,30]){
    const cells=dayCells([],step);assert.equal(cells.length,1440/step);
    assert.equal(cells[0].start,0);assert.equal(cells.at(-1).end,1440);
    for(let i=1;i<cells.length;i++)assert.equal(cells[i].start,cells[i-1].end);
  }
});
test('grid retains partial and multiple records when changing to a coarser scale',()=>{
  const blocks=[{id:1,start:5,end:15},{id:2,start:15,end:30},{id:3,start:1430,end:1440}];
  const cells=dayCells(blocks,30);
  assert.deepEqual(cells[0].blocks.map(b=>b.id),[1,2]);assert.equal(cells[1].blocks.length,0);
  assert.deepEqual(cells.at(-1).blocks.map(b=>b.id),[3]);
});
