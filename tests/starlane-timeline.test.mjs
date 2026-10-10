import test from 'node:test';
import assert from 'node:assert/strict';
import {minuteAtRatio,fittedTimelineHeight} from '../vercel-proxy/starlane-timeline.mjs';
test('compressed timeline preserves time coordinates for all three scales',()=>{
  for(const step of [10,15,30]){
    assert.equal(minuteAtRatio(0,step),0);
    assert.equal(minuteAtRatio(.5,step),720);
    assert.equal(minuteAtRatio(1,step),1440-step);
    assert.equal(minuteAtRatio(-1,step),0);
    assert.equal(minuteAtRatio(2,step),1440-step);
  }
});
test('desktop height doubles while mobile keeps its adaptive height',()=>{
  assert.equal(fittedTimelineHeight(768,312,false),852);
  assert.equal(fittedTimelineHeight(844,350,true),404);
  assert.equal(fittedTimelineHeight(780,350,true),340);
});
