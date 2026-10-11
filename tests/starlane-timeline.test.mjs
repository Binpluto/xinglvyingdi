import test from 'node:test';
import assert from 'node:assert/strict';
import {minuteAtRatio,fittedTimelineHeight,clippedInterval} from '../vercel-proxy/starlane-timeline.mjs';
test('compressed timeline preserves time coordinates for all three scales',()=>{
  for(const step of [10,15,30]){
    assert.equal(minuteAtRatio(0,step),0);
    assert.equal(minuteAtRatio(.5,step),720);
    assert.equal(minuteAtRatio(1,step),1440-step);
    assert.equal(minuteAtRatio(-1,step),0);
    assert.equal(minuteAtRatio(2,step),1440-step);
  }
});
test('each half-day maps pointer coordinates to its own 12-hour range',()=>{
  for(const step of [10,15,30]){
    assert.equal(minuteAtRatio(0,step,0,720),0);
    assert.equal(minuteAtRatio(.5,step,0,720),360);
    assert.equal(minuteAtRatio(1,step,0,720),720-step);
    assert.equal(minuteAtRatio(0,step,720,720),720);
    assert.equal(minuteAtRatio(.5,step,720,720),1080);
    assert.equal(minuteAtRatio(1,step,720,720),1440-step);
  }
});
test('noon boundaries split only the display without duplicating duration',()=>{
  assert.equal(clippedInterval(720,780,0,720),null);
  assert.equal(clippedInterval(660,720,720,1440),null);
  const a=clippedInterval(690,750,0,720),b=clippedInterval(690,750,720,1440);
  assert.equal(a.top,690/720*100);assert.equal(b.top,0);
  assert.ok(Math.abs((a.height+b.height)/100*720-60)<0.001);
  assert.deepEqual(clippedInterval(0,1440,720,1440),{top:0,height:100});
});
test('desktop height doubles while mobile keeps its adaptive height',()=>{
  assert.equal(fittedTimelineHeight(768,312,false),852);
  assert.equal(fittedTimelineHeight(844,350,true),404);
  assert.equal(fittedTimelineHeight(780,350,true),340);
});
