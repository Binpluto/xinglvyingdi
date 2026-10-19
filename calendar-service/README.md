# 星旅营地：Google 日历隔离接入测试

## 当前状态

- 独立 Neon 项目 `lucky-salad-95439949` / 数据库 `starcamp_calendar_test` / AWS Frankfurt。
- 已通过 Neon SQL Editor 成功执行 `migrations/001_calendar_bridge_test.sql` 和账号限定关联迁移 `migrations/002_owner_pilot.sql`。
- 初始化时复核为 9 张表、0 条用户/日程/连接；之后用户主动授权并同步了选定日历。当前新增 `pilot_links` 关联表，范围和上线边界见 `OWNER-PILOT.md`，不要把初始化快照当作当前数据量。
- 本目录已部署到独立 Vercel 项目 `starcamp-calendar-test`：https://starcamp-calendar-test.vercel.app 。项目 ID `prj_gY04WhguJmbDZnnYRKuyhZucUJOf`。没有改动旧 Sites、现有 Vercel 生产项目或生产 Git 分支。
- 已创建独立 Google OAuth 客户端 `Starcamp Calendar Test`（ID `1021862776749-qvbjte2tondvc7toib5ont8ulasjcuhd.apps.googleusercontent.com`），已核对回调为 `https://starcamp-calendar-test.vercel.app/api/google-calendar/callback`。
- 六项环境变量均已由后台安全保存并部署生效；没有读取密钥值到聊天或源码。数据库连接、Google 授权回调、令牌刷新和多日历读取已通过真实验证。另有服务端 `OWNER_PILOT_BRIDGE_KEY` 支持仅所有者账号的签名桥接，不包含在源码中。
- Vercel 的 Production 环境标签仅指**这个新测试项目**的稳定主域名，不是原星旅营地正式项目。部署保护保持启用；CLI 检查通过 Vercel 自带授权机制进行，不向浏览器公开绕过令牌。

## 安全边界

仅指定 Google 测试账号可登录；Google 日历只读。当前支持多选日历、范围内手动全量核对、将日程写入独立 Neon 测试库。不创建或改动 Google 日程，不写入正式任务、积分，不启动后台同步。
配置未齐全时关闭授权入口。拒绝原星旅营地生产 URL、`.chatgpt.site` URL 和名称不为 `starcamp_calendar_test` 的数据库。
使用服务端随机 state、PKCE、绑定浏览器的 HttpOnly Cookie、10 分钟状态有效期和一次性数据库消费。会话只存令牌哈希，有效期 1 天。
刷新令牌使用 AES-256-GCM 加密，并绑定用户及 Google subject。无令牌、Cookie、授权码或数据库 URL 日志输出。
这些是测试基础设施，不代表生产安全审计已完成。禁止复用数据库所有者连接给浏览器，正式服务仍需最小权限运行角色。

## 后续配置顺序

1. 用户完成 `npx vercel@latest login`，核对所属团队后，从本目录部署到**新的** `starcamp-calendar-test` Vercel 项目。不要连接旧项目或使用旧 `.vercel` 元数据。
2. 取得稳定测试域名后设置 `APP_ORIGIN`。首次部署可以缺少密钥，页面仅显示待配置项；这不意味着连接测试成功。
3. 在现有 Google Cloud 项目 `prime-principle-487018-n0` 中创建独立 Web OAuth 客户端 `Starcamp Calendar Test`。不要删除、更改或重置原 `Starcamp Web` 的凭据。
4. 回调是最终 `APP_ORIGIN` 加 `/api/google-calendar/callback`，逐字符填写，不使用通配符或临时凭据。
5. 用户将以下秘密直接填写在**新测试项目**的 Vercel Environment Variables：
   - `DATABASE_URL`：Neon 测试库的连接串。不得复制到聊天或提交仓库。
   - `GOOGLE_CLIENT_SECRET`：新的测试 OAuth 客户端密钥，不使用聊天历史中出现的旧密钥。
   - `TOKEN_ENCRYPTION_KEY`：独立随机 32 字节密钥的 Base64 表示，不可使用示例常量。
6. 非秘密配置：`GOOGLE_CLIENT_ID`（测试客户端）、`APP_ORIGIN`（独立测试域名）、`TEST_ALLOWED_EMAILS=pluto.hanna@gmail.com`。
7. 重新部署后访问 `/api/status`，仅检查配置存在性。真正数据库连通性和 Google 授权还需用户主动完成连接。
8. 用户自行授权 Google；验证能够看到多个日历且没有任务/奖励写入，才开始下一阶段的事件同步。

## 测试

`npm ci && npm test`。当前自动化覆盖缺少配置、拒绝生产环境、密文绑定、state/PKCE 生成及测试账号白名单。
已部署版本：`dpl_gLQzXBMMH2zdacRK7oXFS6uta4XC`。22 项自动化测试通过。
真实浏览器检测到旧页面 `no-referrer` 导致导航式 POST 的 Origin 为 null，后端正确拒绝。已仅把首页 meta referrer 改为 `same-origin`，保留所有后端来源校验和回调的 `no-referrer`；回归确认空/外部 Origin 仍被拒绝。
当前已验证：六项配置存在、数据库连接及 OAuth 状态写入成功、授权入口返回 303，跳转至 Google 账号选择页。
用户已主动完成 Google 授权；回调、刷新后会话、刷新令牌和真实日历列表验证通过，共 12 个日历（1 主日历、11 子日历）。没有向正式任务或积分写入。

## 多日历测试阶段（2026-10-19）

- 界面：多选、搜索、全选可读日历、取消全选、日期范围及时区、逐日历回执、搜索测试库日程和分页查看。
- 真实验证只勾选“教练学习安排”，没有自动导入其他日历。
- 范围：2026-10-19 至 2027-04-17（Europe/Berlin），含起止两天，按日程开始的当地日期过滤。原先 10 月 11 日的示例不在范围内，未补导历史。
- Google 响应 182 项：33 项有效、145 条取消状态、4 条扩展查询边界外日程；本次 1 页全部读完。
- 测试库写入 33 项；在事务内核对日程 ID 集合的 SHA-256 摘要，不仅比较数量。
- 第二次真实同步新增 0、更新 0、未变 33；测试库事件 ID 稳定，无重复项。页面完整显示 33 项。
- 完成账本没有被写入、重置或清除；取消/移出范围归档事件而非删除。
- 本阶段每次执行选定日期窗口的完整快照，不使用 Google syncToken；因此不混用 timeMin/timeMax 与增量 token。不是后台自动同步实现。
- 来源分页全部成功后才写入；事务内批量写、原子核对；有按日历租约避免并发覆盖。超时/过大/分页失败明确失败，不静默截取。
- 同步失败保留旧记录和上次成功时间；一个日历失败不停止界面继续处理其他所选日历。
- 自动化覆盖空的中间分页、第二页失败、重复页、跨时区/夏令时日期、重复实例、同数不同 ID 的错误集合、权限不足、多于三个日历和移动布局。
- 尚未验证生产任务/时序/积分集成。后续不得用本测试成功替代生产集成验收。

Neon 默认分支名 `production` 只属于这个隔离测试项目，不是星旅营地生产后端。
