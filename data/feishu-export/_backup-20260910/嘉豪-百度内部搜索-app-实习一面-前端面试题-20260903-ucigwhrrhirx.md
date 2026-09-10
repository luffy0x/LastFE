# 嘉豪-百度内部搜索 APP 实习一面-前端面试题-20260903

## **JavaScript**

  1. 什么是闭包？

  1. Promise 相关问题。

  1. 箭头函数和普通函数有什么区别？

  1. 深拷贝和浅拷贝有什么区别？

  1. 前端跨域有哪些解决方案？

  1. 除了 CORS、JSONP 和代理，还有哪些跨域解决方案？

  1. 不同 Web 项目 / 页面之间有哪些通信方式？

  1. 除了 postMessage，还有哪些页面通信方式？

  1. 什么是浏览器的前进/后退缓存（bfcache）？

  1. 浏览器有哪些数据存储方式？

  1. IndexedDB、Cookie、LocalStorage、SessionStorage 有什么区别？

  1. 什么是事件委托？

  1. 事件委托有哪些优缺点？

  1. 哪些场景不适合使用事件委托？

  1. 事件的捕获、目标和冒泡机制是什么？

  1. 如何阻止事件冒泡？

  1. JavaScript 中 this 的指向有哪些情况？

  1. 箭头函数的 this 有什么特殊之处？

## **React**

  1. React 中有哪些状态管理相关的 Hooks？

  1. useState 有哪些状态更新方式？

  1. 什么是 React 的批处理（Batching）？

  1. 一次批更新中同时存在函数式更新和替换式更新时，状态如何更新？

  1. 状态更新过程中出现异常或更新结果不符合预期时，可能是什么原因？

  1. useEffect 不传依赖参数、传空数组 []、传依赖数组 [dep] 有什么区别？

  1. 有没有封装过自定义 Hooks？

  1. 如何实现 useRequest 和 useDebounce？

  1. React Diff 算法的过程是什么？

  1. Diff 过程中 key 的作用是什么？

  1. Fiber 是什么？Fiber 的数据结构是什么？

  1. React 16 为什么引入 Fiber？

  1. React Diff 和 Vue 双端 Diff 有什么区别？

  1. Vue 双端 Diff 的过程是什么？

  1. useLayoutEffect 和 useEffect 有什么区别？

  1. React 18 有哪些新特性和新增 API？

## **TypeScript**

  1. interface 和 type 有什么区别？

  1. 如何理解泛型？泛型有什么作用？

  1. 交叉类型和联合类型有什么区别？

  1. any、unknown 和 never 有什么区别？

## **前端工程化**

  1. Webpack 和 Vite 有什么区别？

  1. Vite 的工作原理是什么？

  1. Vite Plugin 的底层原理是什么？

  1. 除了 Webpack 和 Vite，还使用或了解过哪些构建工具？

  1. 是否了解 Bun？

## **实习 & 项目经历**

## **算法**

### **Event Loop 事件循环输出题**

```
console.log(1);

setTimeout(() => {
  console.log(8);
  Promise.resolve().then(() => {
    console.log(9);
  });
}, 0);

Promise.resolve()
  .then(() => {
    console.log(2);
    return Promise.resolve();
  })
  .then(() => {
    console.log(3);
    setTimeout(() => {
      console.log(10);
    }, 0);
  })
  .then(() => {
    console.log(4);
  });

new Promise((resolve) => {
  console.log(5);
  resolve();
}).then(() => {
  console.log(6);
  Promise.resolve().then(() => {
    console.log(7);
  });
});

console.log(11);

*// 输出：// 1// 5// 11// 2// 6// 7// 3// 4// 8// 9// 10*
```

### **最长无重复子串**
