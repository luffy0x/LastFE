/**
 * 「算法手撕」分区顶部静态展示的刷题站点推荐。
 * 图标取自各站点公开 favicon/logo，存放于 /public/site-icons。
 */
export type AlgorithmSite = {
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

export const ALGORITHM_SITES: readonly AlgorithmSite[] = [
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
