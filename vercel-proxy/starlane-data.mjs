// Shared by the hosted entry and the React client. Times are local wall-clock times.
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
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Starcamp//Time Journal//ZH','CALSCALE:GREGORIAN', 'X-WR-CALNAME:星轨时序'];
  for (const b of rows) lines.push('BEGIN:VEVENT', `UID:starcamp-${b.id}-${b.date}@starcamp.lifeadventure`, `DTSTAMP:${stamp}`,
    `DTSTART:${localStamp(b.date,b.start)}`, `DTEND:${localStamp(b.date,b.end)}`, `SUMMARY:${escapeICS(b.title)}`,
    `CATEGORIES:${escapeICS(b.type)},${escapeICS(b.category)}`, `DESCRIPTION:${escapeICS(b.note)}`, 'END:VEVENT');
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
export function downloadTimeline(blocks, format, date) {
  const blob = new Blob([exportTimeline(blocks, format)], {type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `星轨时序-${date}.${format}`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
