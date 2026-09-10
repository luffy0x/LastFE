# lhy-deepseek前端一面-0824

- 项目拷打...

  - 遍历一个树调用栈超过限制怎么办

  - 为什么object要存在堆上，全部存在栈上可以吗

```
// 组件预期功能：每次点击后 count + 1，并上报最新的 count，上报操作有 debounce 防抖
// 哪里有问题？
const [count, setCount] = useState(0)
const reportCount = useMemo(
  () => debounce((c) => {
        report(c)
    }, 1000),
  [count]
)

return (
  <button
    onClick={() => {
      setCount(count + 1)
      reportCount()
    }}
  >
    {count}
  </button>
)
```

```
const BUTTON_TYPES = ['primary', 'secondary', 'error'] as const

type ButtonType = never; // 'primary' | 'secondary' | 'error'

function isValidButtonType(s: string): s is ButtonType {
  return BUTTON_TYPES.includes(s)
  // 报错 Argument of type 'string' is not assignable to parameter of type '"primary" | "secondary" | "error"'.(2345)
  // 怎么改？
}
```

```
/* 定义：
对每个 words[i]，返回它在数组中的最短前缀，使得没有其他单词也以这个前缀开头。
如果不存在这样的前缀（例如有重复词），返回完整单词本身。
输出顺序与输入一致。*/
function shortestUniquePrefixes(words: string[]): string[] {
}

console.log(
  JSON.stringify(shortestUniquePrefixes(["dog", "dove", "duck"])) ===
  JSON.stringify(["dog", "dov", "du"])
)

console.log(
  JSON.stringify(shortestUniquePrefixes(["zebra", "dog", "duck", "dove"])) ===
  JSON.stringify(["z", "dog", "du", "dov"])
)

// 重复词：唯一前缀不存在，返回原词
console.log(
  JSON.stringify(shortestUniquePrefixes(["app", "apple", "app"])) ===
  JSON.stringify(["app", "appl", "app"])
)
```
