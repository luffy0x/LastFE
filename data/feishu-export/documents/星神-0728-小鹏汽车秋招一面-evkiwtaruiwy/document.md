# 星神——0728  小鹏汽车秋招一面

# 面经

## 拷打实习与项目

就是在这里问到了我的缓存逻辑，我讲了用了 React Hook 做的（为后面手撕没写出来埋下伏笔了）

## 手撕实现 useDebounceSearch Hook

题目：搜索框防抖，比如用户先输入 apple ，在防抖时间内又继续输入为 AppleWatch，只会处理一次。另外，需处理搜索 AppleWatch 先返回但 apple 后返回的情况——旧请求不能覆盖新请求结果。

```
import React from 'react';

function SearchProduct() {
  const [keyword, setKeyword] = useState('');

  // 入参：keyword（搜索关键词），searchProduct（异步搜索函数），300（防抖时间）
  const { data, loading, error } = useDebounceSearch(keyword, searchProduct, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  return (
    <div>
      <input
        type="text"
        value={keyword}
        onChange={handleInputChange}
        placeholder="搜索商品..."
      />
      {loading && <div>加载中...</div>}
      {error && <div>出错了：{error.message}</div>}
      {data && <div>搜索结果：{JSON.stringify(data)}</div>}
    </div>
  );
}

// 模拟的异步搜索函数
async function searchProduct(keyword: string) {
  const response = await fetch(`/api/products?q=${keyword}`);
  return response.json();
}
```

```
function useDebounceSearch() {
  
}
```

```
import { useState, useEffect, useRef } from 'react';

interface UseDebounceSearchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * 带防抖和竞态处理的搜索 Hook
 *
 * @param keyword   搜索关键词
 * @param searchFunc  异步搜索函数 (keyword: string) => Promise<T>
 * @param delay    防抖延迟时间（毫秒），默认 300ms
 */
function useDebounceSearch<T>(
  keyword: string,
  searchFunc: (keyword: string) => Promise<T>,
  delay: number = 300
): UseDebounceSearchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 存储最新的 keyword，用于竞态处理：旧请求返回时与当前实际 keyword 对比
  const latestKeywordRef = useRef(keyword);
  // 存储定时器 id
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 更新最新的 keyword
    latestKeywordRef.current = keyword;

    // 清除上一次的定时器 —— 防抖核心逻辑
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // keyword 为空时直接清空结果，不发起请求
    if (!keyword.trim()) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    // 设置新的防抖定时器
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await searchFunc(keyword);
        // 竞态处理：只有当前返回的 keyword 仍然是最新的 keyword 时才更新数据
        // 如果用户已经输入了新的关键词，旧请求的结果直接丢弃
        if (latestKeywordRef.current === keyword) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (latestKeywordRef.current === keyword) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setData(null);
        }
      } finally {
        if (latestKeywordRef.current === keyword) {
          setLoading(false);
        }
      }
    }, delay);

    // 清理函数：组件卸载或 keyword 变化时清除定时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [keyword, searchFunc, delay]);

  return { data, loading, error };
}

export default useDebounceSearch;

```

## 拷打项目——单点登录流程

  1. 子前端无 AT → 调 SDK 向 Supabase OAuth 请求，检查 refresh token

  1. 302 重定向到 IDP 系统

  1. IDP 检查登录状态，无 AT 则跳转到统一登录页

  1. 登录完成后，用户确认授权 → IDP 向服务端请求颁发 AT 和 RT

  1. 重定向回子前端 callback 页面，子前端再与服务端对齐，拿到 AT

  1. 恢复用户原始访问路径

## 浏览器事件循环题

要求写出 console.log 输出顺序（涉及 async/await、Promise、setTimeout、requestAnimationFrame）

相对比较基础，不过 requestAnimationFrame 这个 API 当时不知道是宏任务还是微任务。其他比较常规

## 反问

  - 部门工作内容 → 仿真部，做 3D 可视化（Three.js/WebGL），仿真任务可视化展示

  - 分工情况 → 不严格区分，前端同学也会写后端

  - 技术栈 → React + Three.js，后端 Python/C++

  - AI coding 使用情况 → 已在大量使用，会越来越多

  - 对校招生期望 → 面试官建议后续问总监

  - 面试反馈 → 实习做了很多 hook 封装，但比较依赖 AI 写代码，基础需要注意

# 录音源文件（文本）

[暂不支持的飞书块类型: 33]

[暂不支持的飞书块类型: 23]
