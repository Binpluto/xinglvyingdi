import {systemTaskBaseDetails} from './system-task-base-details.mjs';
// Editorial planning estimates, not measured user performance or health assessments.
export const taskGuidance=[
 ['整理今日航向',[5,5],'low','打开便签，只写下今天最重要的一件事。','减少同时追赶多个目标的负担，先确定一个完成标准。',['all']],
 ['补给营地',[10,10],'low','选桌面或一个文件夹，不同时整理多个区域。','减少下一次开始工作时寻找资料和工具的阻力。',['all']],
 ['晨星签到',[3,5],'low','先选一个词描述当前状态，再写一句行动承诺。','让今天的安排有一个与当前状态相关的起点。',['all']],
 ['微光散步',[10,10],'low','先离开屏幕，选择适合当前环境和身体状态的路线。','给连续用屏幕的过程安排一次活动间隙。',['fitness','work','thesis','exam']],
 ['清理消息岛',[5,10],'low','打开一个消息列表，先处理最明显的一条无效消息。','缩小待处理消息的范围，减少无效信息占据注意力。',['work','job']],
 ['一页计划',[5,10],'low','先写出所有事项，再圈出最重要的一项。','把分散的安排收拢到一张可查看的短清单里。',['all']],
 ['水晶补给',[2,3],'low','拿出自己的水杯，按个人需要准备饮用水。','让接下来的一段时间不必反复中断去准备饮水。',['all']],
 ['呼吸锚点',[3,3],'low','找一个舒适的位置，先留意自然呼吸，不勉强控制。','给自己一个短暂的状态观察时段；不舒服时停止。',['all']],
 ['收纳一角',[10,10],'low','只选一个小抽屉、桌角或置物区。','限定整理范围，让完成结果更容易看见。',['all']],
 ['感恩星笺',[5,10],'low','先记下一件今天实际发生的小事。','留下具体的生活记录，而不是要求自己必须保持积极。',['other']],
 ['数字减负',[3,5],'low','先找出一个经常打断你的通知或标签页。','减少一项可控制的干扰，为下一次行动留出空间。',['all']],
 ['明日装备',[5,10],'low','想好明天最先开始的一件事，拿出它需要的工具。','把开始前的准备提前完成，降低明天的启动成本。',['all']],
 ['财务微记',[3,5],'low','打开账单，只记录一笔已发生的收支。','把一次模糊的花费变成可回看的具体记录。',['other','work']],
 ['晨光伸展',[8,8],'low','先确认环境安全，选择熟悉且适合自己的轻缓动作。','为长时间静坐安排活动间隙；不追求疼痛或强度。',['fitness','work']],
 ['灵感捕捉',[5,10],'low','打开便签，先写下一条还不完整的想法。','把暂时的想法留下来，之后再决定是否值得推进。',['thesis','work','other']],
 ['早睡约定',[5,10],'low','查看今晚的实际安排，选一个可执行的收尾时间。','把睡前安排落到具体时间，而不是只留下一个愿望。',['sleep']],
 ['专注秘境',[25,25],'medium','选定一个任务，关闭一个最明显的干扰源。','给一件事一段相对完整的时间，并留下可回看的成果。',['exam','thesis','work','job']],
 ['推进关键委托',[30,30],'medium','打开当前最重要的任务，写出这半小时要留下的成果。','把时间投入与目标成果连接起来，而不只是计时。',['all']],
 ['知识补给',[30,30],'medium','选一份资料和一个问题，先读与它最相关的一段。','让学习围绕一个问题展开，并留下可以复用的笔记。',['exam','thesis','job']],
 ['关系回响',[15,30],'medium','确定要沟通的人和一个想澄清的问题。','把一次交流的目的和结果说清楚，减少反复猜测。',['work','job','other']],
 ['身体历练',[30,30],'medium','选择自己熟悉、适合当前身体状况的活动。','把活动安排和感受一起记录，便于之后调整节奏。',['fitness']],
 ['输出一页',[20,40],'medium','打开空白页，先写三个小标题或画一个粗略框架。','让想法变成可阅读、可讨论的初稿。',['thesis','work','job']],
 ['难题拆解',[15,25],'medium','用一句话描述问题，再写出第一个可操作步骤。','把复杂问题转成几个能分别推进的动作。',['exam','thesis','work']],
 ['家庭支援',[15,30],'medium','先确认一项对方确实需要帮助的事务。','把帮助落实到具体需求和结果，而不是单方面假设。',['other']],
 ['财务整理',[20,30],'medium','打开最近七天账单，先按类别看一类支出。','为自己的消费决定补充可核对的信息。',['other','work']],
 ['创作冲刺',[35,35],'medium','准备一个粗略主题，把修改意见先放到旁边。','把生成初稿和修改分开，先留下可继续加工的材料。',['thesis','work','other']],
 ['环境升级',[15,25],'medium','写下一个反复妨碍行动的环境问题。','优先处理可控制的环境阻碍，而非只要求自己更自律。',['all']],
 ['社交补给',[10,20],'medium','想到一位愿意联系的人，写一句具体的问候。','把联系变成具体交流，而不只是完成一个社交数量。',['other','job']],
 ['复盘航线',[15,20],'medium','打开最近三项行动记录，先找一件值得保留的做法。','从实际行动中选择保留、停止或调整的事项。',['all']],
 ['技能练习',[30,30],'medium','选定一个小技能点和一种能看见结果的练习。','让练习有明确对象，便于发现下一次改进方向。',['exam','job','work']],
 ['阅读航标',[20,40],'medium','先选一章或一篇文章，写下想弄清的一个问题。','让阅读留下观点、依据和疑问，而不只是翻过页面。',['exam','thesis','other']],
 ['延迟满足',[30,30],'medium','记下想做的娱乐或消费，再选一个先推进的事项。','为当前的重要事项留出一次有意识的选择机会。',['all']],
 ['深度远征',[60,60],'high','先写下一项最小成果，再打开需要的资料。','围绕一个成果组织较完整的工作时段。',['thesis','work','exam']],
 ['攻克拖延巨兽',[30,60],'high','选一件确实重要的积压事项，找出第一处卡点。','把长期悬而未决的事情推进到一个明确结果。',['all']],
 ['勇者交付',[45,90],'high','确认接收人和验收标准，检查还缺哪一部分。','把个人进度变成他人能查看或使用的成果。',['work','thesis','job']],
 ['世界航线复盘',[30,45],'high','打开本周目标，先标出已不再重要的一项。','让下一阶段安排建立在真实进展和变化上。',['all']],
 ['长征交付',[90,90],'high','定义本次交付的边界，先列一张最短检查清单。','用明确的交付范围约束长时段投入。',['work','thesis']],
 ['系统整理',[45,90],'high','选择一个反复混乱的流程，画出它目前的步骤。','把重复发生的问题转成可复用的处理方式。',['work','other']],
 ['关系深谈',[45,45],'high','先确认对方愿意沟通，再写下一个最需要澄清的问题。','给重要沟通留出准备和整理共识的空间。',['other','work']],
 ['健康突破',[30,60],'high','先核对活动是否适合自己，写下安全范围和停止条件。','帮助记录活动与恢复安排，不以强度、疼痛或硬撑作为价值。',['fitness']],
 ['财务决策',[45,60],'high','列出需要决定的问题，以及目前缺少的事实。','让预算或支出决定有可回看的依据和边界。',['work','other']],
 ['创作成章',[60,90],'high','确定这次作品单元的范围，不把整个项目都纳入。','把零散创作推进成一个有边界的完整单元。',['thesis','work','other']],
 ['学习实战',[45,90],'high','选一个真实小问题，写下要验证的结果。','把所学内容放到实际问题里检查，而不只停留在理解。',['exam','thesis','job','work']],
 ['积压清零',[45,60],'high','列出五项有明确结束条件的积压事项。','让积压事务逐项获得结果，避免在整理列表上反复停留。',['all']],
 ['公开表达',[30,60],'high','确认面向谁分享，再写一句最希望对方记住的话。','让表达围绕受众和反馈，而不只追求发布次数。',['job','work','other']],
 ['团队协作',[30,60],'high','先写下共同成果、负责人和下一步分工。','把协作从相互等待转成明确的责任与成果。',['work']],
 ['长期规划',[30,45],'high','先写一个可衡量的结果，再列第一个节点。','让长期目标具备可以定期核对的路径。',['all']],
 ['数字断舍离',[30,60],'high','只选一个数字空间，先建立一个简单的归档规则。','减少以后查找和整理资料的重复成本。',['work','thesis','other']],
];
const catalog=new Map(taskGuidance.map(([title,range,energy,start,benefit,goals])=>[title,{range,energy,start,benefit,goals}]));
export const energyLabels={low:'低精力也可尝试',medium:'适合中等精力',high:'适合精力较充足时'};
const goalNames={exam:'备考',thesis:'论文',job:'求职',fitness:'健身',work:'工作 / 项目',sleep:'早睡计划',other:'其他目标'};
export function taskMetadata(task,context={}){
  if(!/^system-daily-(easy|medium|hard)$/.test(task.source||''))return null;
  const known=catalog.get(task.title),original=systemTaskBaseDetails[task.title];
  const matched=!!known&&!!original&&String(task.detail||'').startsWith(original);
  const sourceText=matched?original:String(task.detail||'');
  // Read time from the task's base requirement, never from an appended "start for 5 minutes" suggestion.
  const explicit=matched?sourceText.match(/(?:不少于\s*)?(\d+)\s*分钟/):sourceText.match(/预计(?:时长|全程)[：:]?\s*(\d+)\s*分钟/);
  const range=explicit?[Number(explicit[1]),Number(explicit[1])]:matched?known.range:null;
  const energy=matched?known.energy:null;
  const duration=range?range[0]===range[1]?`约 ${range[0]} 分钟`:`约 ${range[0]}–${range[1]} 分钟`:'时长待确认';
  const reasons=[matched?known.benefit:'任务内容已变更或未匹配到模板，建议先核对完成标准；这里不推断它与你目标的关系。'];
  if(matched&&goalNames[context.goal])reasons.push(known.goals.includes(context.goal)||known.goals.includes('all')?`这项行动可支持你选择的「${goalNames[context.goal]}」方向。`:`这项更偏向生活维护或其他方向，与「${goalNames[context.goal]}」不直接对应，请自行判断是否适合。`);
  const warnings=[];
  if(range&&Number(context.budget)>0&&range[0]>Number(context.budget))warnings.push(`预计全程超过你设置的每日 ${context.budget} 分钟启动预算；可另选时段，起步不等于整项完成。`);
  if(energy&&context.energy==='low'&&energy!=='low')warnings.push('你在每日启程中选择了低精力，这项任务更适合状态较充足时安排；可另选时间，或主动改选轻装行动，不会自动改写任务。');
  return {duration,range,timeBasis:explicit?'来自任务要求':range?'模板估算 · 以实际为准':'请按修改后的内容自行估时',energy,energyLabel:energy?energyLabels[energy]:'精力要求待确认',start:matched?known.start:'先读一遍完成标准，选出一个现在能开始的具体动作。',startNote:'起步建议，不会自动计时、完成任务或领取奖励。',reason:reasons.join(''),warnings,matched,selectionNote:'系统任务仍按原有三档及两周去重规则分配；此处解释行动用途和适配情况，不代表已经按你的目标重排。'};
}
