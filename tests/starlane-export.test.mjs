import test from 'node:test';
import assert from 'node:assert/strict';
import {availableTasks, taskSlot, exportTimeline,dateRange,filterRange,validDate} from '../vercel-proxy/starlane-data.mjs';

test('task tray excludes completed and internal records without hiding future tasks', () => {
  const tasks = [ {id:1,title:'明天',done:0,dueAt:'2026-10-11'}, {id:2,title:'今天',done:0,dueAt:'2026-10-10'}, {id:3,title:'完成',done:1}, {id:4,title:'▥时轨|2026-10-10'}, {id:5,title:'▥分类|日常'}, {id:6,title:'☾ 月度航向 2026-10'}, {id:7,title:'无日期',done:0} ];
  assert.deepEqual(availableTasks(tasks).map(q=>q.id), [2,1,7]);
});
test('drop snaps to each grid and clips end-of-day', () => {
  for (const step of [10,15,30]) {
    assert.equal(taskSlot(603,step).start,600);
    assert.equal(taskSlot(603,step).end,630);
    assert.deepEqual(taskSlot(1440,step),{start:1440-step,end:1440});
  }
});
const block={id:5,date:'2026-12-31',start:1410,end:1440,title:'=中文,"标题"',type:'主线',category:'学习',color:'gold',note:'第一行\n第二行;备注,内容\\路径'};
test('weekly and monthly ranges handle Sundays, new years, leap days and DST',()=>{
  assert.deepEqual(dateRange('2027-01-03','week'),{start:'2026-12-28',end:'2027-01-03'});
  assert.deepEqual(dateRange('2024-02-10','month'),{start:'2024-02-01',end:'2024-02-29'});
  assert.deepEqual(dateRange('2026-10-25','week'),{start:'2026-10-19',end:'2026-10-25'});
  assert.deepEqual(dateRange('2026-12-31','month'),{start:'2026-12-01',end:'2026-12-31'});
  assert.equal(validDate('2026-02-30'),false);
});
test('custom exports include both endpoints and reject invalid ranges',()=>{
  const blocks=['2026-09-30','2026-10-01','2026-10-15','2026-10-31','2026-11-01'].map((date,i)=>({...block,date,id:i}));
  const rows=filterRange(blocks,'2026-10-01','2026-10-31');
  assert.deepEqual(rows.map(b=>b.id),[1,2,3]);
  assert.equal((exportTimeline(rows,'ics').match(/BEGIN:VEVENT/g)||[]).length,3);
  assert.equal(filterRange(blocks,'2027-01-01','2027-01-02').length,0);
  assert.throws(()=>filterRange(blocks,'2026-10-31','2026-10-01'));
  assert.throws(()=>filterRange(blocks,'','2026-10-01'));
});
test('CSV preserves Chinese and quoting and neutralizes formula input', () => {
  const csv = exportTimeline([block], 'csv');
  assert.equal(csv.charCodeAt(0),0xfeff);
  assert.ok(csv.includes('"24:00"'));
  assert.ok(csv.includes('"\'=中文,""标题"""'));
  assert.ok(csv.includes('第一行\n第二行'));
});
test('ICS rolls midnight into next year, escapes text and folds UTF-8 lines', () => {
  const ics=exportTimeline([{...block,title:'学习'.repeat(80)}],'ics',new Date('2026-10-10T12:00:00Z'));
  assert.ok(ics.includes('DTSTART:20261231T233000'));
  assert.ok(ics.includes('DTEND:20270101T000000'));
  assert.ok(ics.includes('DTSTAMP:20261010T120000Z'));
  assert.ok(ics.includes('第一行\\n第二行\\;备注\\,内容\\\\路径'));
  for(const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
  const unfolded=ics.replace(/\r\n /g,'');
  assert.ok(unfolded.includes('SUMMARY:'+'学习'.repeat(80)));
});
