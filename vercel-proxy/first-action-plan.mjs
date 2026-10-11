import {validDate} from './starlane-data.mjs';
export const goals=[
  {id:'exam',name:'备考',icon:'▤',note:'让复习有一个起点',title:'选一个知识点，写下三条记忆',done:'选定一个知识点，不看资料写出三条记忆，再核对一次。',first:'打开一份正在用的复习资料',template:'备考'},
  {id:'thesis',name:'论文',icon:'✎',note:'从空白页迈出一步',title:'为论文的一节写下三个小标题',done:'打开论文文档，为其中一节写出三个小标题，不要求写正文。',first:'打开论文文档',template:'论文'},
  {id:'job',name:'求职',icon:'◇',note:'让下一次投递更清晰',title:'选一个目标岗位，圈出三项要求',done:'找到一个真实岗位，记下三项要求和自己已有的一项匹配经历。',first:'打开一个目标岗位的招聘说明',template:'求职'},
  {id:'fitness',name:'健身',icon:'↟',note:'先准备适合自己的节奏',title:'选一种适合自己的活动，留出时间',done:'选一种自己熟悉且适合当前状态的活动，写下下一次准备开始的时间。',first:'想一想自己愿意再次进行的活动',template:'健身'},
  {id:'work',name:'工作 / 项目',icon:'⌁',note:'先推进一个明确交付',title:'把一个工作目标拆成三个小步骤',done:'写下一项近期要交付的成果，列三个步骤，并圈出今天能开始的一步。',first:'打开当前项目的文档或任务单',template:'自由职业'},
  {id:'sleep',name:'早睡计划',icon:'☾',note:'从睡前准备开始',title:'为今晚选一个睡前收尾动作',done:'选一个睡前可做的小动作，写下准备做它的时间，并准备好需要的物品。',first:'选一个自己愿意尝试的睡前小动作',template:'早睡计划'},
  {id:'other',name:'其他目标',icon:'✧',note:'从你在意的事情出发',title:'把一个目标写成今天能做的小步骤',done:'写下一个近期目标，以及今天能开始的一个具体动作。',first:'打开便签或拿出纸笔',template:null},
];
export const budgets=[10,20,30,60];
export const barriers=[
  {id:'start',name:'不知道从哪开始',note:'目标很大，第一步不清楚'},
  {id:'focus',name:'容易分心',note:'开始了，也容易被打断'},
  {id:'overload',name:'计划太多',note:'每件都想做，不知道先选谁'},
  {id:'delay',name:'经常延期',note:'想做，却总等到下一次'},
];
export function makeFirstAction(answers){
  const goal=goals.find(g=>g.id===answers.goal),barrier=barriers.find(b=>b.id===answers.barrier);
  if(!goal||!barrier||!budgets.includes(Number(answers.budget)))throw new Error('请先完成三个选择');
  const minutes=Math.min(Number(answers.budget),answers.barrier==='start'||answers.barrier==='delay'?10:15);
  const reasons={start:'先把目标变成看得见的一小步，不要求一次做完。',focus:'先留一小段只做一件事的时间，减少切换。',overload:'先选一个方向，今天不额外铺开新的任务清单。',delay:'把第一步缩小到今天就能开始，而不是等待状态完美。'};
  return {goal:goal.id,goalName:goal.name,budget:Number(answers.budget),barrier:barrier.id,barrierName:barrier.name,minutes,title:goal.title,done:goal.done,first:goal.first,reason:reasons[barrier.id],template:goal.template};
}
export const firstActionMarker='启程首行动 v1';
export function firstActionDetail(plan){return `${firstActionMarker} · ${plan.goalName} · 每日${plan.budget}分钟 · ${plan.barrierName}\n完成标准：${plan.done}\n本次${plan.minutes}分钟；${plan.first}。`.slice(0,180);}
export async function persistFirstAction(gateway,{answers,title,done,date}){
  const plan=makeFirstAction(answers);
  title=String(title||plan.title).trim();done=String(done||plan.done).trim();
  if(title.length<2||title.length>36||done.length<2||done.length>80)throw new Error('请检查任务名称（2–36字）和完成标准（2–80字）');
  if(!validDate(date))throw new Error('日期无效，请刷新后重试');
  const mainGoal=`启程 · ${title}`;
  let data=await gateway.get(date);
  // The existing daily-departure API upserts by user/date: retries cannot create a second task.
  const completedSetup=data.quests?.find(q=>String(q.detail||'').startsWith(firstActionMarker));
  if(completedSetup)return {data,quest:completedSetup,existing:true};
  let task=data.quests?.find(q=>q.source==='daily-departure'&&q.dueAt===date&&q.title===mainGoal);
  if(data.dailyDeparture&&!task)throw new Error('你已经设置了今天的主线，本向导不会覆盖它。请到任务页继续，或先跳过。');
  if(!task){
    data=await gateway.act({action:'startDailyDeparture',clientDate:date,mainGoal,focusGoalMinutes:plan.minutes,energyLevel:'medium'});
    task=data.quests?.find(q=>q.source==='daily-departure'&&q.dueAt===date&&q.title===mainGoal);
  }
  if(!task)throw new Error('暂时未能确认创建结果，请重试；系统会核对已有任务');
  data=await gateway.act({action:'editQuest',questId:task.id,title:mainGoal,type:'主线',detail:firstActionDetail({...plan,done}),clientDate:date});
  return {data,quest:data.quests.find(q=>q.id===task.id),existing:false};
}
