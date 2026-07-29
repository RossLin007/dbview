

## 枚举类型

### `task_status`

```text
PENDING
STARTED
RUNNING
COMPLETED
FAILED
WARNING
SKIPPED
```



---

# 表结构

## 1. `analysis`

表注释：

```text
存放数据分析（包含 AI 分析）的结果
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `analysis_id` | `uuid` | 否 | `gen_random_uuid()` |  |
| `task_id` | `uuid` | 是 |  | 关联的任务 id， tasks.task_id |
| `record_id` | `uuid` | 是 |  | 关联的会议 id， records.record_id |
| `analysis_target_type` | `character varying(255)` | 否 |  | 分析的类型：<br><br>ai_analysis_dialogue_from_coach： dialogues 表中会议内容的 教练分析<br>ai_analysis_dialogue_meeting_summary： dialogues 表中会议内容进行概述<br>special_utterance-analysis-summary：对 utterances 表中的 type 为 special_utterance类型的数据 进行 AI 汇总<br>full_utterance-analysis-full_utterance_analysis： 对 utterances 表中 full_utterance 进行 AI 分析 |
| `analysis_target_id` | `uuid` | 是 |  | 被分析对象的 id<br><br>ai_analysis_dialogue_from_coach 类型关联 dialogues 表的dialogue_id<br>ai_analysis_dialogue_meeting_summary 类型关联 dialogues 表的dialogue_id<br>special_utterance-analysis-summary 类型关联 utterances 表的utterance_id<br>full_utterance-analysis-full_utterance_analysis： 类型关联 utterances 表的utterance_id |
| `context_info` | `jsonb` | 是 |  | 做数据分析时的上下文信息 |
| `analysis_input` | `jsonb` | 是 |  | 分析时的输入 jsonb 格式 |
| `analysis_result` | `text` | 否 |  | 分析的结果 text 格式 |
| `remarks` | `text` | 是 |  | 备注信息 |
| `analyzed_at` | `timestamp with time zone` | 是 | `now()` |  |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |

约束：

```text
PRIMARY KEY (analysis_id)
FOREIGN KEY (record_id) REFERENCES records(record_id) ON DELETE SET NULL
FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
UNIQUE INDEX ux_analysis_task_id(record_id, analysis_target_type, analysis_target_id)
```

---

## 2. `dialogues`

表注释：

```text
会议对话内容表
存放着每次会议中，发言人的文本对话记录

数据来源：records.remarks->> dialogue_content
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `dialogue_id` | `uuid` | 否 | `gen_random_uuid()` | 会议对话内容的 id |
| `record_id` | `uuid` | 否 |  | 关联的会议 id， records.record_id |
| `task_id` | `uuid` | 否 |  | 关联的任务 id， tasks.task_id |
| `time` | `jsonb` | 否 |  | 时间 jsonb 格式<br>会议的开始时间start_time，结束时间end_time，持续时间duration<br>`{"duration": 7405000, "end_time": 1697551105000, "start_time": 1697543700000}` |
| `place` | `character varying(255)` | 是 |  | 数据来源地 - Location of the meeting<br>如果是 url， 指向的线上数据源，比如https://meeting.tencent.com/user-center/shared-record-info?id=2059e428-42e2-4809-bd22-d243164411f3&from=0&record_type=4<br>2。 文字， 比如：飞书-莘庄知源 代表线下录音的地址 |
| `speakers` | `text[]` | 是 |  | 发言人，数组格式 |
| `topic` | `jsonb` | 否 |  | 主题 - Topic of the meeting<br>结构如下：<br>`{"title": "莘庄交流-DZ学习瑾洁姐-20231017", "topic": "DZ学习瑾洁姐", "subject": "莘庄交流", "category": "feishu_meeting", "numOfDate": "20231017", "record_type": "realtime_transcription"}` |
| `content` | `text` | 否 |  | 会议对话内容<br>存放着每次会议中，发言人的文本对话记录<br>数据来源：records.remarks->> dialogue_content |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束：

```text
PRIMARY KEY (dialogue_id)
FOREIGN KEY (record_id) REFERENCES records(record_id)
UNIQUE INDEX ux_dialogue_record_task_id(record_id, task_id)
```

---

## 3. `facts`

表注释：

```text
从发言人在会议中的发言内容中提取的实时数据
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `fact_id` | `uuid` | 否 | `gen_random_uuid()` | ai 提取的事实 id |
| `speaker` | `character varying(100)` | 是 |  | 发言人名字，可以关联 speaker_aliases 中找到本名 |
| `record_id` | `uuid` | 否 |  | 事实提取的源会议 id，关联 records.record_id |
| `record_info` | `jsonb` | 是 |  | 源头会议的概要信息<br>内容：<br>`{"time": {"duration": "25903504", "end_time": "1755464839504", "start_time": "1755438936000"}, "place": "https://meeting.tencent.com/user-center/shared-record-info?id=46f34fbb-1ea5-4c80-b8d1-2a44804a1f39&from=0&record_type=4", "topic": {"title": "能量之泉复盘", "topic": "能量之泉复盘", "subject": "能量之泉复盘", "category": "meeting", "numOfDate": "", "record_type": "realtime_transcription"}}` |
| `utterance_id` | `uuid` | 是 |  | 事实数据来源的发言片段 utterances， 关联 utterances.utterance_id |
| `category` | `character varying(100)` | 是 |  | 实时记录的类型<br><br>交流记录：代表事实数据来源会议转录记录 |
| `fact_text` | `text` | 否 |  | AI 从发言人发言片段中 提取的事实数据结果 |
| `entities` | `text[]` | 是 |  | AI 从发言人发言片段中提取的概念实体 |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束/索引：

```text
PRIMARY KEY (fact_id)
INDEX idx_facts_record_id(record_id)
INDEX idx_facts_speaker(speaker)
```

---

## 4. `kv`

表注释：

```text
key value 表
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `id` | `bigint` | 否 | `nextval('kv_id_seq'::regclass)` |  |
| `key` | `character varying(255)` | 否 |  |  |
| `value` | `jsonb` | 否 |  |  |
| `description` | `text` | 是 |  |  |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束：

```text
PRIMARY KEY (id)
UNIQUE (key)
```

---

## 5. `rag_metadata`

表注释：

```text
RAG 系统元数据存储表，用于关联原始会议记录与向量库文件
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `id` | `integer` | 否 | `nextval('rag_metadata_id_seq'::regclass)` | 自增主键 |
| `unique_id` | `character varying(64)` | 是 |  | 唯一 ID md5( utterance_id + speaker + start_time + type) |
| `record_id` | `character varying(64)` | 否 |  | 外部业务系统原始记录 ID |
| `utterance_id` | `character varying(64)` | 否 |  | 单条发言的唯一标识 ID |
| `file_name` | `character varying(100)` | 是 |  | Google File Search Store 返回的文件资源名称 (files/xxx) |
| `file_path` | `character varying(255)` | 是 |  | 文件的存储路径 |
| `store_path` | `character varying(255)` | 是 |  | gemini api file search store id |
| `speaker` | `character varying(50)` | 是 |  | 发言人姓名 |
| `title` | `character varying(255)` | 是 |  | 会议或文档的总标题 |
| `topic` | `character varying(100)` | 是 |  | 会议话题 |
| `subject` | `character varying(100)` | 是 |  | 会议主题 |
| `content` | `text` | 是 |  | 原始转录文本全文 |
| `start_time` | `timestamp with time zone` | 是 |  | 转换后的北京时间 (带时区) |
| `raw_timestamp` | `bigint` | 是 |  | 原始 Unix 毫秒时间戳 |
| `duration_ms` | `integer` | 是 |  | 发言持续时长 (毫秒) |
| `summary` | `text` | 是 |  | AI 自动生成的文本摘要 |
| `mentioned` | `jsonb` | 是 |  | JSONB 格式，存储该段对话中提到的人名列表 |
| `tags` | `jsonb` | 是 |  | JSONB 格式，存储 AI 提取的关键词标签 |
| `status` | `character varying(20)` | 是 | `'pending'::character varying` | 数据处理状态：pending(待处理), uploaded(已上传文件), indexed(向量库已索引), error(出错) |
| `created_at` | `timestamp with time zone` | 是 | `CURRENT_TIMESTAMP` | 记录入库时间 |
| `updated_at` | `timestamp with time zone` | 是 | `CURRENT_TIMESTAMP` | 记录更新时间 |
| `deleted_at` | `timestamp with time zone` | 是 |  | 记录删除时间 |
| `embedding` | `vector(768)` | 是 |  |  |

索引：

```text
PRIMARY KEY (id)
UNIQUE (unique_id)
INDEX idx_rag_speaker(speaker)
INDEX idx_rag_start_time(start_time)
GIN INDEX idx_rag_mentioned_gin(mentioned)
GIN INDEX idx_rag_tags_gin(tags)
GIN TRGM INDEX content_trgm_idx(content)
GIN TRGM INDEX summary_trgm_idx(summary)
GIN TRGM INDEX title_trgm_idx(title)
GIN FTS INDEX fts_idx(to_tsvector('simple', title + content + summary))
```

---

## 6. `records`

表注释：

```text
会议记录表，这个表中存放个的会议的时间，地点，参与人，主题，会议信息，转录内容
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `record_id` | `uuid` | 否 | `gen_random_uuid()` |  |
| `time` | `jsonb` | 否 |  | 时间 jsonb 格式<br>会议的开始时间start_time，结束时间end_time，持续时间duration<br>`{"duration": 7405000, "end_time": 1697551105000, "start_time": 1697543700000}` |
| `place` | `character varying(255)` | 是 |  | 数据来源地 - Location of the meeting<br>如果是 url， 指向的线上数据源，比如https://meeting.tencent.com/user-center/shared-record-info?id=2059e428-42e2-4809-bd22-d243164411f3&from=0&record_type=4<br>2。 文字， 比如：飞书-莘庄知源 代表线下录音的地址 |
| `participants` | `text[]` | 是 |  | 会议参与人，记录一场会议中的每个参与人，数组格式， 可以在 speaker_aliases 中查询到对应的发言人本名 |
| `topic` | `jsonb` | 否 |  | 主题 - Topic of the meeting<br>结构如下：<br>`{"title": "莘庄交流-DZ学习瑾洁姐-20231017", "topic": "DZ学习瑾洁姐", "subject": "莘庄交流", "category": "feishu_meeting", "numOfDate": "20231017", "record_type": "realtime_transcription"}` |
| `record_info` | `jsonb` | 是 |  | 从数据源（腾讯、飞书）中获取的会议信息源数据 |
| `transcript_content` | `jsonb` | 否 |  | 转录内容，jsonb 格式，<br>从腾讯会议、飞书等数据源中获取的转录内容 |
| `remarks` | `jsonb` | 是 |  | 数据格式 jsonb<br>从转录元数据 transcript_content 中，提取的文本对话数据, 保存在 dialogue_content 中<br>比如：<br>`{"dialogue_content": "李阳(00:02:05):xx"}` |
| `task_id` | `uuid` | 是 |  | 对应的任务表 id，说明是根据哪个 task 生成的 |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束/索引：

```text
PRIMARY KEY (record_id)
INDEX idx_records_created_at(created_at DESC)
```

---

## 7. `speaker_aliases`

表注释：

```text
Speaker 别名映射表，用于将多个别名归一化到统一的 speaker_norm
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `alias` | `text` | 否 |  | 别名（归一化后的小写形式），主键 |
| `speaker_norm` | `text` | 否 |  | 归一化后的 speaker 标准名，用于文件分桶 |
| `speaker_display` | `text` | 是 |  | 标准展示名（可选，用于前端显示） |
| `status` | `text` | 是 | `'active'::text` | 状态：active-启用，disabled-禁用 |
| `created_at` | `timestamp with time zone` | 是 | `now()` | 创建时间 |
| `updated_at` | `timestamp with time zone` | 是 | `now()` | 更新时间 |
| `note` | `text` | 是 |  | 备注说明 |

约束/索引：

```text
PRIMARY KEY (alias)
CHECK status IN ('active', 'disabled')
INDEX idx_speaker_aliases_norm(speaker_norm)
INDEX idx_speaker_aliases_status(status)
```

---

## 8. `speaker_profiles`

表注释：

```text
AI 从发言人发言记录中提取的 画像数据
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `extraction_id` | `uuid` | 否 | `gen_random_uuid()` | 每次AI提取的事实记录ID |
| `speaker_name` | `character varying(100)` | 是 |  | 发言人姓名 |
| `record_id` | `uuid` | 否 |  | 会议记录的 id<br><br>关联表：<br>records 表的 record_id<br>dialogues 表的 record_id<br><br>同时 record_id 来源是数据源 腾讯会议的真实会议记录id，通过 record_id 可以构造出数据源地址 比如：https://meeting.tencent.com/user-center/shared-record-info?id=62c1ba2c-2537-498e-b831-72bdd8d5d803&from=0&record_type=4<br>当中 62c1ba2c-2537-498e-b831-72bdd8d5d803 就是 record_id |
| `record_metadata` | `jsonb` | 是 |  | 会议的元信息（时间、地点、主题等）<br>数据结构如下：<br>`{"time": {"duration": "4524217", "end_time": "1750549641640", "start_time": "1750549641640"}, "place": "https://meeting.tencent.com/user-center/shared-record-info?id=29bac2e4-cbda-4fbb-859c-3722b6ccf959&from=0&record_type=4", "topic": {"title": "厉瑞男-了凡四训-第5天楚门的世界", "topic": "了凡四训", "subject": "厉瑞男", "category": "meeting", "numOfDate": "第5天楚门的世界", "record_type": "realtime_transcription"}}` |
| `utterance_id` | `uuid` | 是 |  | 关联发言片段（utterances 表） utterance_id<br><br>utterances 表, 记录了发言人的 <br>1. 原始发言记录（type 为 full_utterance） <br>2. AI 过滤润色过的发言人核心分享片段（type 为 special_utterance） |
| `extracted_facts` | `text` | 否 |  | 核心字段——AI提取的事实数据，"画像/档案" |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束/索引：

```text
PRIMARY KEY (extraction_id)
FOREIGN KEY (record_id) REFERENCES records(record_id)
FOREIGN KEY (utterance_id) REFERENCES utterances(utterance_id)
INDEX idx_speakers_record_id(record_id)
INDEX idx_speakers_speaker(speaker_name)
```

---

## 9. `tasks`

表注释：

```text
这张表是从各种数据源（腾讯会议、飞书会议、录音资料）中提取会议数据的任务控制表。
记录了各种任务类型，状态，错误信息，来源等
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `task_id` | `uuid` | 否 | `gen_random_uuid()` | 任务 id |
| `task_object_id` | `uuid` | 否 |  | 任务对象的 id<br>比如：<br>1. 会议 id， 腾讯会议的会议id ，records.record_id, 飞书会议中的会议 id<br>2. 发言片段 id，utterances.utterance_id<br>其他 |
| `task_name` | `character varying(255)` | 否 |  | 任务名称<br><br>ai_analysis_dialogue_meeting_summary: 对 dialogue.content AI 概述，结果存到 analysis 表<br>factual_analysis： 事实分析，结果存到facts 表<br>ai_cheer：对 Cheer 提交的内容进行 AI 分析<br>ai_rn： 对 瑞男 提交的内容进行 AI 分析<br>split_speech： 从会议记录中 分离发言人数据<br>ai_jinju_jinhua： 提取金句精华<br>full_utterance_analysis： 对原始的发言人发言片段做 AI 分析<br>special_utterance_analysis： 对 AI 过滤润色的发言人核心分享片段做 AI 分析<br>meeting_etl： 从数据源（腾讯会议、飞书会议等）etl 数据<br>generate_dialogue：生成会议对话记录（文本），保存到 dialogues 表<br>summary： 做 AI 概述<br>ai_analysis_dialogue_from_coach： 对 dialogues.content 做 Ai 教练分析<br>extract_speaker_info： 提取发言人事实数据<br>google_drive： 把发言人发言记录保存到 google drive，小凡看见<br>ai_xiaofan： 小凡看见<br>extract_share： 用 ai 润色发言人发言片段 |
| `task_type` | `character varying(100)` | 否 |  | ETL: 会议记录提取转化加载的任务<br>analysis： AI 分析的任务 |
| `parameters` | `jsonb` | 是 |  | 执行任务过程中的上下文数据 |
| `status` | `task_status` | 否 | `'PENDING'::task_status` | 状态<br><br>'PENDING',<br>'STARTED',<br>'RUNNING',<br>'COMPLETED',<br>'FAILED',<br>'WARNING',<br>'SKIPPED' |
| `error_message` | `text` | 是 |  | 错误信息 |
| `source` | `jsonb` | 是 |  | 记录来源的信息，或者 n8n 进行时环境数据 |
| `started_at` | `timestamp with time zone` | 是 |  |  |
| `completed_at` | `timestamp with time zone` | 是 |  |  |
| `created_at` | `timestamp with time zone` | 是 | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `timestamp with time zone` | 是 | `CURRENT_TIMESTAMP` |  |

约束/索引：

```text
PRIMARY KEY (task_id)
UNIQUE INDEX ux_tasks_object_name_type(task_object_id, task_name, task_type)
INDEX idx_tasks_created_at(created_at DESC)
INDEX idx_tasks_status_created(status, created_at DESC)
```

---

## 10. `users`

表注释：无

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `id` | `integer` | 否 | `nextval('users_id_seq'::regclass)` |  |
| `username` | `character varying(50)` | 是 |  |  |
| `email` | `character varying(100)` | 是 |  |  |
| `password_hash` | `character varying(255)` | 是 |  |  |
| `created_at` | `timestamp without time zone` | 是 | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `timestamp without time zone` | 是 | `CURRENT_TIMESTAMP` |  |
| `phone` | `character varying(20)` | 是 |  | 手机号 |
| `union_id` | `text` | 是 |  | 微信平台统一id |
| `openid` | `text` | 是 |  | 微信小程序openid |
| `nickname` | `character varying(20)` | 是 |  | 昵称(花名)用来规避直接用真实姓名带来的数据安全风险. |

约束：

```text
PRIMARY KEY (id)
UNIQUE (username)
UNIQUE (email)
UNIQUE (openid)
```

---

## 11. `utterances`

表注释：

```text
发言人一场会议（record_id）中发言片段汇总（utterances），关联记录(records)与任务(tasks)。

1. 原始发言记录（type 为 full_utterance） 
2. AI 润色过的发言记录 （type 为 special_utterance）
```

字段：

| 字段 | 类型 | 可空 | 默认值 | 字段注释 |
|---|---|---:|---|---|
| `utterance_id` | `uuid` | 否 | `gen_random_uuid()` | 发言人在一场会议中发言片段的汇总id |
| `record_id` | `uuid` | 是 |  | 关联的记录ID（records 表） |
| `task_id` | `uuid` | 是 |  | 关联的任务ID （tasks 表） |
| `type` | `character varying(100)` | 否 |  | 1. 原始发言记录（type 为 full_utterance） <br>2. AI 润色过的发言记录 （type 为 special_utterance） |
| `time` | `jsonb` | 否 |  | 时间 jsonb 格式<br>会议的开始时间start_time，结束时间end_time，持续时间duration<br>`{"duration": 7405000, "end_time": 1697551105000, "start_time": 1697543700000}` |
| `place` | `character varying(255)` | 是 |  | 数据来源地 - Location of the meeting<br>如果是 url， 指向的线上数据源，比如https://meeting.tencent.com/user-center/shared-record-info?id=2059e428-42e2-4809-bd22-d243164411f3&from=0&record_type=4<br>2。 文字， 比如：飞书-莘庄知源 代表线下录音的地址 |
| `speaker` | `character varying` | 否 |  | 发言人 - List of participants in the meeting 会议的参与人 |
| `topic` | `jsonb` | 否 |  | 主题 - Topic of the meeting<br>结构如下：<br>`{"title": "莘庄交流-DZ学习瑾洁姐-20231017", "topic": "DZ学习瑾洁姐", "subject": "莘庄交流", "category": "feishu_meeting", "numOfDate": "20231017", "record_type": "realtime_transcription"}` |
| `content` | `text` | 否 |  | 发言人在一场会议（record_id）中发言片段汇总 |
| `created_at` | `timestamp with time zone` | 是 | `now()` |  |
| `updated_at` | `timestamp with time zone` | 是 | `now()` |  |

约束/索引：

```text
PRIMARY KEY (utterance_id)
UNIQUE (record_id, speaker, type)
FOREIGN KEY (record_id) REFERENCES records(record_id)
FOREIGN KEY (task_id) REFERENCES tasks(task_id)

INDEX idx_utterances_record_id(record_id)
INDEX idx_utterances_created_at(created_at)
INDEX idx_utterances_speaker(speaker)
INDEX idx_utterances_time_start(((time ->> 'start_time')::bigint))
UNIQUE INDEX ux_utterances_record_speaker_type_id(record_id, speaker, type)
```

注意：`utterances` 上存在两个字段相同的唯一索引：

```text
utterances_record_speaker_type_uk(record_id, speaker, type)
ux_utterances_record_speaker_type_id(record_id, speaker, type)
```

写入时按 `(record_id, speaker, type)` 去重。

---

# 主要业务关系

```text
tasks
  -> records.task_id
  -> dialogues.task_id
  -> utterances.task_id
  -> analysis.task_id

records
  -> dialogues.record_id
  -> utterances.record_id
  -> analysis.record_id
  -> speaker_profiles.record_id
  -> facts.record_id，业务关联，未配置物理 FK

utterances
  -> speaker_profiles.utterance_id
  -> facts.utterance_id，业务关联，未配置物理 FK
  -> analysis.analysis_target_id，取决于 analysis_target_type

dialogues
  -> analysis.analysis_target_id，取决于 analysis_target_type

speaker_aliases
  用于标准化：
  records.participants
  dialogues.speakers
  utterances.speaker
  facts.speaker
  speaker_profiles.speaker_name
  rag_metadata.speaker
```

---

# 常用开发规则

## 时间 JSONB

`records.time`、`dialogues.time`、`utterances.time` 通常结构：

```json
{
  "duration": 7405000,
  "end_time": 1697551105000,
  "start_time": 1697543700000
}
```

按开始时间排序：

```sql
ORDER BY (time->>'start_time')::bigint
```

`utterances` 已有表达式索引：

```sql
idx_utterances_time_start(((time ->> 'start_time')::bigint))
```

## 主题 JSONB

`records.topic`、`dialogues.topic`、`utterances.topic` 通常结构：

```json
{
  "title": "莘庄交流-DZ学习瑾洁姐-20231017",
  "topic": "DZ学习瑾洁姐",
  "subject": "莘庄交流",
  "category": "feishu_meeting",
  "numOfDate": "20231017",
  "record_type": "realtime_transcription"
}
```

访问示例：

```sql
topic->>'title'
topic->>'topic'
topic->>'subject'
topic->>'category'
topic->>'numOfDate'
topic->>'record_type'
```

## 发言类型

`utterances.type` 常见业务值：

```text
full_utterance
special_utterance
```

## 分析目标类型

`analysis.analysis_target_type` 常见业务值：

```text
ai_analysis_dialogue_from_coach
ai_analysis_dialogue_meeting_summary
special_utterance-analysis-summary
full_utterance-analysis-full_utterance_analysis
```

对应关系：

```text
ai_analysis_dialogue_from_coach -> dialogues.dialogue_id
ai_analysis_dialogue_meeting_summary -> dialogues.dialogue_id
special_utterance-analysis-summary -> utterances.utterance_id
full_utterance-analysis-full_utterance_analysis -> utterances.utterance_id
```

## 任务状态

`tasks.status` 必须使用 `task_status` 枚举：

```text
PENDING
STARTED
RUNNING
COMPLETED
FAILED
WARNING
SKIPPED
```

## 发言人标准化

查询发言人相关数据时，优先使用：

```sql
LEFT JOIN speaker_aliases sa
  ON sa.alias = lower(raw_speaker_name)
 AND sa.status = 'active'
```

展示名优先级：

```sql
COALESCE(sa.speaker_display, sa.speaker_norm, raw_speaker_name)
```

## RAG 查询

`rag_metadata` 支持：

```text
speaker btree 查询
start_time btree 查询
mentioned/tags JSONB GIN 查询
content/summary/title trigram 模糊搜索
title + content + summary 全文检索
embedding vector(768)
```

常规查询默认加：

```sql
deleted_at IS NULL
```

---

# 典型 SQL 示例

## 查询某会议的发言片段

```sql
SELECT
  u.utterance_id,
  u.record_id,
  u.task_id,
  u.type,
  u.time,
  u.place,
  u.speaker,
  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS speaker_display,
  u.topic,
  u.content,
  u.created_at,
  u.updated_at
FROM utterances u
LEFT JOIN speaker_aliases sa
  ON sa.alias = lower(u.speaker)
 AND sa.status = 'active'
WHERE u.record_id = $1
ORDER BY (u.time->>'start_time')::bigint ASC;
```

## 插入或更新任务

```sql
INSERT INTO tasks (
  task_object_id,
  task_name,
  task_type,
  parameters,
  status,
  source
)
VALUES (
  $1,
  $2,
  $3,
  $4::jsonb,
  'PENDING',
  $5::jsonb
)
ON CONFLICT (task_object_id, task_name, task_type)
DO UPDATE SET
  parameters = EXCLUDED.parameters,
  source = EXCLUDED.source,
  updated_at = CURRENT_TIMESTAMP
RETURNING *;
```

## 插入或更新发言片段

```sql
INSERT INTO utterances (
  record_id,
  task_id,
  type,
  time,
  place,
  speaker,
  topic,
  content
)
VALUES (
  $1,
  $2,
  $3,
  $4::jsonb,
  $5,
  $6,
  $7::jsonb,
  $8
)
ON CONFLICT (record_id, speaker, type)
DO UPDATE SET
  time = EXCLUDED.time,
  place = EXCLUDED.place,
  topic = EXCLUDED.topic,
  content = EXCLUDED.content,
  updated_at = now()
RETURNING *;
```

## 查询某会议 AI 分析

```sql
SELECT
  analysis_id,
  task_id,
  record_id,
  analysis_target_type,
  analysis_target_id,
  context_info,
  analysis_input,
  analysis_result,
  remarks,
  analyzed_at,
  created_at
FROM analysis
WHERE record_id = $1
ORDER BY analyzed_at DESC;
```

## RAG 全文检索

```sql
SELECT
  id,
  unique_id,
  record_id,
  utterance_id,
  speaker,
  title,
  topic,
  subject,
  content,
  summary,
  start_time,
  tags,
  mentioned
FROM rag_metadata
WHERE deleted_at IS NULL
  AND to_tsvector(
    'simple',
    COALESCE(title, '') || ' ' ||
    COALESCE(content, '') || ' ' ||
    COALESCE(summary, '')
  ) @@ plainto_tsquery('simple', $1)
ORDER BY start_time DESC
LIMIT 20;
```

请基于以上数据库结构完成后续编程任务。
```