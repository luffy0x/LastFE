# 曦鹤-字节秋招电商一面

### 八股

  1. v-show 和v-if 的区别

  1. 怎么实现v-show

  1. vue 怎么实现一个元素慢慢从隐藏到显示

  1. React 性能优化方法

  1. usecallback 不使用依赖数组怎么拿到最新的缓存函数

  1. 操控 dom 的 API 有哪些？

  1. 怎么通过 js 去执行脚本，已拿到 url

### 代码输出

```
var a=10;
var obj={
    a:20;
    mycall:function (){
       console.log(this.a);
    }
}
obj.mycall();
obj.mycall.call();
new obj.mycall();

```

## 算法题

实现一个 函数，遍历二维数组，输入：

arr=[[1,2,3],

[4,5,6],

[7,8,9]

]

输出：[1,2,4,3,5,7,6,8,9]

大概是斜四五度遍历
