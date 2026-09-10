# lhy-滴滴泛前端技术-0827

## 一面

  - 项目拷打

  - 手撕快排

  - 事件循环输出判断

```
const async1 = async () => {
  console.log('async1');
  setTimeout(() => {
    console.log('timer1')
  }, 2000)

  await new Promise(resolve => {
    console.log('promise1')
  })

  console.log('async1 end')
  return 'async1 success'
}

console.log('script start');

async1().then(res => console.log(res));

console.log('script end');

Promise.resolve(1)
  .then(2)
  .then(Promise.resolve(3))
  .catch(4)
  .then(res => console.log(res))

setTimeout(() => {
  console.log('timer2')
}, 1000)
```

  - react16前后diff算法的差异

  - 引入fiber后为什么render过程可以被中断

  - fiber节点的结构

  - flex: 1 有什么效果，如何实现给一个元素设置为可压缩且存在最小宽度

## 二面

  - 聊项目

  - 类似下面的this输出判断

```
class Person {
  name = 'Tom';

  arrowFn = () => {
    console.log(this.name);
  };

  normalFn() {
    console.log(this.name);
  }
}

const person = new Person();

const fn1 = person.arrowFn;
const fn2 = person.normalFn;

fn1(); // Person 实例、'Tom'
fn2(); // undefined，随后读取 this.name 报错
```

  - 最长连续字符统计 'abbcc' => { 'b': 2, 'c': 2 };

## 三面

  - 聊项目

  - 聊ai提效

  - 手撕EventBus，实现on订阅、off取消订阅、emit发布事件、once仅执行一次对应时间的回调

  - 用的什么构建工具，rspack有什么优势

  - css的postion属性有哪些值，分别有什么效果
