// Shared by the hosted entry and the React client. Times are local wall-clock times.
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date+'T12:00:00Z').toISOString().slice(0,10) === date;
}
export function shiftCalendarDate(date, days) {
  const value = new Date(date+'T12:00:00Z');
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
export function dateRange(date, unit = 'day') {
  if (!validDate(date)) throw new Error('请选择有效日期');
  if (unit === 'week') {
    const offset = (new Date(date+'T12:00:00Z').getUTCDay()+6)%7;
    const start = shiftCalendarDate(date, -offset);
    return {start, end:shiftCalendarDate(start,6)};
  }
  if (unit === 'month') {
    const start = date.slice(0,7)+'-01';
    const next = new Date(start+'T12:00:00Z'); next.setUTCMonth(next.getUTCMonth()+1);
    return {start,end:shiftCalendarDate(next.toISOString().slice(0,10),-1)};
  }
  return {start:date,end:date};
}
export function filterRange(blocks, start, end) {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('请选择有效范围，结束日期不能早于开始日期');
  return blocks.filter(b=>b.date>=start && b.date<=end);
}

export function availableTasks(quests) {
  return quests.filter(q => !q.done && !/^(▥时轨\||▥分类\||☾ 月度航向 )/.test(q.title))
    .sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || a.id - b.id);
}

export function taskSlot(minute, step) {
  const start = Math.max(0, Math.min(1440 - step, Math.round(minute / step) * step));
  return { start, end: Math.min(1440, start + Math.ceil(30 / step) * step) };
}

function clock(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function escapeICS(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
}
function localStamp(date, minute) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Math.floor(minute / 1440));
  return value.toISOString().slice(0, 10).replaceAll('-', '') + 'T' + clock(minute % 1440).replace(':', '') + '00';
}
function fold(line) {
  const parts = []; let part = '', length = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (length + size > 75) { parts.push(part); part = ' '; length = 1; }
    part += char; length += size;
  }
  parts.push(part); return parts.join('\r\n');
}
export function exportTimeline(blocks, format, now = new Date()) {
  const rows = [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  if (format === 'csv') {
    return '\uFEFF' + [ ['日期','开始时间','结束时间','时长（分钟）','任务','模块','细分分类','颜色','备注'],
      ...rows.map(b => [b.date, clock(b.start), clock(b.end), b.end-b.start, b.title, b.type, b.category, b.color, b.note])
    ].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Starcamp//Time Journal//ZH','CALSCALE:GREGORIAN', 'X-WR-CALNAME:时序'];
  for (const b of rows) lines.push('BEGIN:VEVENT', `UID:starcamp-${b.id}-${b.date}@starcamp.lifeadventure`, `DTSTAMP:${stamp}`,
    `DTSTART:${localStamp(b.date,b.start)}`, `DTEND:${localStamp(b.date,b.end)}`, `SUMMARY:${escapeICS(b.title)}`,
    `CATEGORIES:${escapeICS(b.type)},${escapeICS(b.category)}`, `DESCRIPTION:${escapeICS(b.note)}`, 'END:VEVENT');
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
export function downloadTimeline(blocks, format, date) {
  const blob = new Blob([exportTimeline(blocks, format)], {type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `时序-${date}.${format}`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function downloadAuthorizedTimeline(start,end,format) {
  const response=await fetch(`/api/starlane-export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&format=${format}`,{credentials:'same-origin',cache:'no-store'});
  if(!response.ok){const error=await response.json();throw new Error(error.error||'导出失败');}
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`时序-${start}_${end}.${format}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
