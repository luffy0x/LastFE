# 豪神——百度-app开发

# 0724一面

### this指向的算法输出题

```
const obj = {
  name: "dodo",
  fn: function() {
    const arrowFn = () => {
      console.log(this.name);
    };
    
    function normalFn() {
      console.log(this.name);
    }
    
    arrowFn();
    normalFn();
  }
};

obj.fn();
// dodo,undefined
// 追问fn改为箭头函数呢
//undefined，undefined
```

### 项目开发过程中如何避免CSS的class的命名重复

### webpack 和 Vite 的区别，如何根据项目选型

### ai 怎么给前端开提效

### ai 怎么知道他需要进行Rag的

### Rag的整体流程，为什么需要Rag

### 如何验证你的 harness 和 loop enginnering 是有效的

### 介绍一下自己开发的skill

# 0728二面

**全程AI和实习经历！实习就不谈了**

### tool，mcp，skill的渐进式披露

### Rag的整体流程？

### 有什么向量数据库库？哪个库可以通过GPU加速？

### 计算相似度的算法「欧氏距离和余弦近似度，还有别的没答出来」？

### 如何提高Rag的召回率？

### 如何保证llm的结构化输出「答了prompt+ReAct+降级+schema校验」？

### 写HTTP接口用了什么库？mcp有什么封装好的库？ fastapi，fastmcp 

### 讲一讲提示词的发展？

prompt->context enginnering->harness enginnering->loop enginnering->graph enginnering

###
