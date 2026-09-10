# 🌟🌟—0907 字节秋招 Capcut 前端一面

- 面试时长：约 1 小时 

  - 岗位：CapCut（剪映海外）前端 — 简历池捞起，与「即梦全栈」为不同方向 

  - Base：广深（北京也有） 

  - 结构：自我介绍与经历深挖（约 40%）→ 前端基础（约 25%）→ 手撕题 → 算法题 → 反问

[暂不支持的飞书块类型: 22]

## 一、自我介绍与经历深挖

[暂不支持的飞书块类型: 30]

### 深挖链路复盘

面试官的提问路径非常典型：

```
自我介绍 → 要难点 → 嫌不够技术 → 要更技术的难点 → 要一句话总结（提炼能力）
        → 从你的答案里抽出一个技术点（接口缓存）→ 顺着往下深挖基础
```

**关键反馈**：面试官最后明确指出「讲得可以更重点一些，沟通还可以，但讲的东西重点比较少」。第 4 问「用一句话总结」实际上就是在测试**表达提炼能力**，是个信号题。

[暂不支持的飞书块类型: 22]

## 二、前端基础题（由项目自然延伸）

### 2.1 接口缓存有哪些方案？

考察分层意识，答题应按「链路从远到近」分层：

  1. **HTTP / 浏览器缓存层**：请求携带 / 响应下发 Cache-Control（max-age）、Expires、ETag、Last-Modified，浏览器直接命中本地缓存，不实际发出请求（或只发协商请求）。

  1. **服务端缓存层**：Redis 等中间件缓存，避免每次穿透到数据库；BFF（如 Modern.js）层也可挂 KV 缓存。

  1. **前端应用层**：自行设计缓存 + 请求合并（去重），如按业务维度设计缓存键、in-flight 请求复用（pending 态挂起，复用同一 Promise）；持久化可选内存 / localStorage / sessionStorage / IndexedDB。

    - 本质是 **请求去重（dedupe）+ 缓存（cache）** 的结合，等价于 SWR / React Query 的核心能力。

### 2.2 localStorage 与 IndexedDB 的区别？

[暂不支持的飞书块类型: 30]

### 2.3 什么业务场景用 localStorage，什么场景用 IndexedDB？

  - **localStorage**：小体积、扁平、读写频率低的状态 —— 主题偏好（亮/暗）、语言设置、JWT / 登录态、引导弹窗是否已读、简单表单草稿。

  - **IndexedDB**：结构化、体量大、需要查询能力的数据 ——

    - 在线画图 / 白板的**操作历史与撤销栈**；

    - 棋类对局的**棋谱记录与悔棋栈**；

    - 视频/图片编辑器的**本地素材、缩略图、Blob 资源**（与 CapCut 业务高度相关）；

    - 离线优先应用的本地数据副本、大列表缓存分页。

[暂不支持的飞书块类型: 34]

补充可加分点：sessionStorage（标签页级）、Cache Storage（配合 Service Worker 缓存请求响应）、Cookie（会随请求自动携带、有 4KB 限制）也应纳入选型矩阵。

### 2.4 展开讲讲浏览器缓存

**强缓存（不发请求）**

  - Cache-Control: max-age=3600 —— 相对时间，优先级高于 Expires。

  - Expires: <绝对时间> —— HTTP/1.0 产物，依赖客户端时钟，已基本被取代。

  - 常用指令：no-cache（跳过强缓存，仍走协商）、no-store（完全不缓存）、private / public、immutable、must-revalidate。

  - 命中时 Chrome 显示 from memory cache / from disk cache。

**协商缓存（发请求，可能返回 304）**

  - ETag（响应）↔ If-None-Match（请求）：资源内容指纹，精度高，可精确到字节变化。

  - Last-Modified（响应）↔ If-Modified-Since（请求）：最后修改时间，精度仅到秒，且时间戳变但内容未变也会失效。

  - 优先级：ETag > Last-Modified。命中返回 304 Not Modified，无响应体。

**完整决策流程**

```
发起请求
  → 强缓存未过期？ → 是：直接用本地缓存（200 from cache），不发请求
           → 否：带上 If-None-Match / If-Modified-Since 发请求
     → 服务端比对未变化 → 304，用本地缓存
    → 变化 → 200 + 新资源 + 新缓存头
```

[暂不支持的飞书块类型: 34]

⚠️ **本场答题失误提醒**：把「协商缓存」和 **CORS 预检请求（****OPTIONS**** preflight）** 混淆了。

    - 协商缓存 = 带 If-None-Match / If-Modified-Since 的**正式请求**，服务端返回 304 或 200，**没有额外预检**。

    - 预检请求 = **CORS 跨域**机制，非简单请求先发 OPTIONS，与缓存**完全无关**。

    - 「简单请求 / 非简单请求」也是 CORS 概念（由 method + 请求头 + Content-Type 决定），不是缓存概念。 另外 GET 请求默认可缓存是因为它是**幂等安全方法**，与「简单请求」无关；破缓存正确做法是响应头设 Cache-Control: no-store，或前端加时间戳 / 随机 query 参数。

[暂不支持的飞书块类型: 22]

## 三、手撕题：带最大并发上限的并发调度器

### 题目

设计一个带最大并发上限的调度器：

```
const addRequest = scheduler(2);

addRequest(req1).then(res => console.log(res));
addRequest(req2).then(res => console.log(res));
addRequest(req3).then(res => console.log(res));
addRequest(req4).then(res => console.log(res));
```

要求：

  1. scheduler(max) 接收最大并发数，**返回一个函数** addRequest；

  1. addRequest(req) 入参是一个**返回 Promise 的异步函数**，其自身**返回 Promise**，支持 .then 打印结果；

  1. 同一时刻**最多只有 ****max**** 个任务在执行**，有任务执行完才放行队列中的下一个；

  1. 任务可以在运行途中**动态追加**；

  1. 用 4 个**不同时长的定时器**模拟异步任务。

### 面试官提示（关键引导）

[暂不支持的飞书块类型: 34]

「任务是可以动态添加的，用 Promise 现有的 API（all / race）可能不太好做，你再想想其他的办法。」

即引导使用 **队列 + 运行计数器 + finally 出队** 的手动调度模型，而非依赖 Promise.all/race。

### 现场表现

思路方向正确（用数组作等待队列、size 计数、finally 中 size-- 并 shift 出队），但卡在 **「如何把外层返回的 Promise 与延后执行的任务结果桥接」** 这一关键点上（需要把 resolve/reject 存进队列，延后调用），未在时间内写完，被喊停。

### 标准实现

```
function scheduler(max) {
  let running = 0;
  const queue = [];

  const runNext = () => {
    *// 有空位且队列非空时，取出一个任务执行*if (running >= max || queue.length === 0) return;

    const { req, resolve, reject } = queue.shift();
    running++;

    *// Promise.resolve 包一层，兼容 req 抛同步异常或返回非 Promise*Promise.resolve()
      .then(() => req())
      .then(resolve, reject)
      .finally(() => {
      running--;
   runNext();
      });
  };

  return function addRequest(req) {
    return new Promise((resolve, reject) => {
    *// 关键：把 resolve/reject 一起入队，实现「延后执行、结果回传」*
      queue.push({ req, resolve, reject });
      runNext();
    });
  };
}
```

### 测试用例

```
const sleep = (ms, val) =>
  () => new Promise(resolve => setTimeout(() => resolve(val), ms));

const addRequest = scheduler(2);

addRequest(sleep(1000, 'A-1s')).then(console.log);
addRequest(sleep(500,  'B-0.5s')).then(console.log);
addRequest(sleep(300,  'C-0.3s')).then(console.log);
addRequest(sleep(400,  'D-0.4s')).then(console.log);

*// 预期输出顺序：// 0.5s → B-0.5s   (A、B 先并发，B 先完成，C 入场)// 0.8s → C-0.3s   (C 完成，D 入场)// 1.0s → A-1s// 1.2s → D-0.4s*
```

### 核心考点与易错点

[暂不支持的飞书块类型: 30]

### 常见变体（可提前准备）

  1. **返回结果按入参顺序聚合**：limitAll(tasks, max) → 返回 Promise<结果数组>，需按索引写回。

  1. **失败重试**：任务失败后重试 N 次再 reject。

  1. **超时控制**：单任务超时用 Promise.race([req(), timeout(ms)])（这才是 race 的正确用法）。

  1. **优先级队列**：addRequest(req, priority)，用小顶堆或有序插入替代 shift。

  1. **取消能力**：返回 { promise, cancel }，未启动的任务可从队列移除。

[暂不支持的飞书块类型: 22]

## 四、算法题：最大子数组和（LeetCode 53）

### 题目

输入一个整数数组，求**最大连续子数组**各元素之和。 示例：[1, 2, 5, -7, 8, 10] → 19（子数组 [8, 10] 为 18，[1,2,5] 为 8… 实际最大为 1+2+5-7+8+10 = 19）

### 现场表现

  - 我选了**前缀和 + 记录左侧最小前缀和**的解法（等价于 max(preSum[i] - min(preSum[j]), j < i)）；

  - 中途提到过 DP（Kadane）但没走下去，最终仍走了前缀和；

  - 面试官给出反例 **[2, -2, 3]** 打边界：我把 min 初始化为 -Infinity，且在未更新时强行置 0，导致 preSum = [2, 0, 3] 时把 min 错当成 0，答案偏大；

  - 现场修了一版（改为取 Math.min(0, min) 并与 arr[0] 比较），面试官说「还有一点点问题」，因时间原因中止。

### 解法一：Kadane 算法 / DP（推荐，面试首选）

```
function maxSubArray(nums) {
  let cur = nums[0];   *// 以 i 结尾的最大子数组和*let best = nums[0];  *// 全局最优*for (let i = 1; i < nums.length; i++) {
    *// 状态转移：要么接在前面后面，要么从自己重新开始*
 cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}
```

  - 时间 O(n)、空间 O(1)；

  - 状态定义：dp[i] = max(nums[i], dp[i-1] + nums[i])，答案 max(dp[i])；

  - **一句话讲清**：如果前面累积的和是负担（小于 0），就丢掉它从当前元素重新开始。

### 解法二：前缀和 + 维护最小前缀和（我现场的思路，正确写法）

```
function maxSubArray(nums) {
  let preSum = 0;      *// 当前前缀和*let minPre = 0;      *// 前面（含空前缀）的最小前缀和*let best = -Infinity;
  for (const n of nums) {
    preSum += n;
    *// 关键：先用「之前的」minPre 计算答案，再更新 minPre*
    best = Math.max(best, preSum - minPre);
    minPre = Math.min(minPre, preSum);
  }
  return best;
}
```

**我现场错在哪（重点复盘）**

  1. **顺序错**：必须**先算 ****best****、后更新 ****minPre**。若先更新，minPre 可能取到当前位置本身的前缀和，等价于允许空子数组，导致结果偏小/错误。

  1. **初始值错**：minPre 应初始化为 **0**（代表空前缀，含义是「子数组从头开始」），而不是 -Infinity；-Infinity 会让 preSum - minPre 变成 +Infinity。

  1. **不需要打补丁**：只要 minPre 初始为 0 且顺序正确，[2, -2, 3] 自然得到正确答案 3，无需任何 -Infinity 特判。

[2, -2, 3] 手动验证：

[暂不支持的飞书块类型: 30]

### 解法三：分治（O(n log n)，进阶加分）

把数组分成左右两半，答案为三者最大：左半最优、右半最优、跨越中点的最优（从中点向两侧扩展求最大后缀和 + 最大前缀和）。线段树维护「区间和 / 最大前缀和 / 最大后缀和 / 区间最大子段和」四元组，可支持**带修改的区间查询**，是这题的最强变体。

### 延伸变体（建议一并准备）

  1. **返回子数组的起止下标**（不只返回和）：Kadane 中记录 start，当 cur 从自己重开时重置 start。

  1. **环形子数组最大和**（LC 918）：答案 = max(普通最大子数组和, 总和 - 最小子数组和)，需特判全负。

  1. **最大子数组乘积**（LC 152）：需同时维护最大值和最小值（负负得正）。

  1. **长度不超过 k 的最大子数组和**：前缀和 + 单调队列。

  1. **最大子矩阵和**：枚举上下边界 + 对列压缩后套 Kadane。

[暂不支持的飞书块类型: 22]

## 五、反问环节

[暂不支持的飞书块类型: 30]

[暂不支持的飞书块类型: 22]

## 六、完整录音

[暂不支持的飞书块类型: 33]

[暂不支持的飞书块类型: 23]
