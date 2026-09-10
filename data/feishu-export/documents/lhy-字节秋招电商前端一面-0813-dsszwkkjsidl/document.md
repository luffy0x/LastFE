# lhy-字节秋招电商前端一面-0813

- 怎么学前端的

  - 能否独立完成一个全栈需求

  - 说一下http常用方法、header

  - 介绍一下css位置属性

  - JavaScript 原型链和继承机制

  - sse和websocket

  - 项目拷打

    - sse的断连和中止怎么做的

    - sse跨会话污染如何解决

    - 实习时做的项目介绍一下

    - 遇到哪些难点

    - 还有哪些落地的项目，介绍一下

    - 这些项目后续有哪些改进方向

  - 一个需求前后端存在分歧时怎么做

  - js 作用域输出判断

```
var a = 5;

(function() {
    console.log(a);
    a = 10;
    console.log(window.a);
    console.log(a);
    var a = 20;
    console.log(a);
})()
```

  - this输出判断

```
window.name = 'bytedance';

function A() {
    this.name = 125;
}

A.prototype.getA = function() {
    console.log(this);
    return this.name + 1;
}

const a = new A();
let funcA = a.getA;
funcA();
```

  - Leetcode: 二叉树的右视图

  - Leetcode改编：不含重复字符的最长子串，需要输出对应的子串（可能含多个子串）
