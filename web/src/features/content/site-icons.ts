/**
 * 分区顶部静态展示的站点推荐（算法手撕 / 简历制作）。
 * 图标取自各站点公开 favicon/logo，存放于 /public/site-icons。
 */
export type RecommendedSite = {
  /** 站点名 */
  site: string;
  /** 推荐语 */
  description: string;
  /** 站内图标路径，以 / 开头 */
  icon: string;
  /** 站点链接 */
  url: string;
  /** 适用场景标签 */
  labels: readonly string[];
};

export const ALGORITHM_SITES: readonly RecommendedSite[] = [
  {
    site: "codetop",
    description: "按大厂面试出现频次排序的题库，先吃透前 30 道高频题。",
    icon: "/site-icons/codetop.png",
    url: "https://codetop.cc",
    labels: ["高频题", "前 30 道"],
  },
  {
    site: "LeetCode 力扣",
    description: "官方 Hot 100 题单，覆盖哈希、滑窗、二叉树与 DP 主线。",
    icon: "/site-icons/leetcode.ico",
    url: "https://leetcode.cn/studyplan/top-100-liked/",
    labels: ["Hot100", "题单"],
  },
  {
    site: "洛谷",
    description: "从 IO 模板到模拟、贪心，练习机考 ACM 输入输出模式。",
    icon: "/site-icons/luogu.ico",
    url: "https://www.luogu.com.cn/",
    labels: ["ACM 模式", "机考"],
  },
  {
    site: "Codefun2000",
    description: "华为、大疆等企业机考 ACM 真题合集，附思路与题解。",
    icon: "/site-icons/codefun2000.jpg",
    url: "https://codefun2000.com/",
    labels: ["ACM 模式", "机考真题"],
  },
] as const;

export const RESUME_SITES: readonly RecommendedSite[] = [
  {
    site: "简历大师",
    description: "类似 Git 的版本管理，附带投递进度记录。",
    icon: "/site-icons/honoz.svg",
    url: "https://honoz.top/",
    labels: ["版本管理", "投递进度"],
  },
  {
    site: "codecv",
    description: "Markdown 编辑，多模板与精细定制。",
    icon: "/site-icons/codecvcv.svg",
    url: "https://www.codecvcv.com/",
    labels: ["Markdown", "多模板"],
  },
  {
    site: "Reactive Resume",
    description: "开源免费的多模板简历工具，支持精细定制。",
    icon: "/site-icons/rxresu.svg",
    url: "https://rxresu.me/",
    labels: ["多模板", "精细定制"],
  },
  {
    site: "可画",
    description: "Canva 中文版，模板设计感强，适合排版自由发挥。",
    icon: "/site-icons/canva.png",
    url: "https://www.canva.com/zh_cn/",
    labels: ["设计模板", "自由排版"],
  },
  {
    site: "小林简历",
    description: "好用省事，可预存 5 份简历随时导出。",
    icon: "/site-icons/xiaolinjianli.webp",
    url: "https://jianli.xiaolinnote.com/",
    labels: ["省事", "预存 5 份"],
  },
  {
    site: "群友甄选",
    description: "求职全环节自研网站，覆盖简历到投递。",
    icon: "/site-icons/longlian.svg",
    url: "https://job.longlian.online/",
    labels: ["全环节", "自研"],
  },
] as const;
