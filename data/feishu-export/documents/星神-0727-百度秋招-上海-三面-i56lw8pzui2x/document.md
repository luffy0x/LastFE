# 星神——0727 百度秋招(上海)三面

## 拷打实习，拷打项目

🈚️八股，甚至还带点闲聊性质

## 现在 AI 这么火，那像我们开发以后更需要具备哪一些素质呢？

反问环节又问了面试官，回答：最重要的是需要产品思维

## 算法：给定一个数组，怎么写成平衡二叉树

输入：[1, 2, 3, 4, 5, 6, 7]

无固定输出，自己规定数据结构

```
// 思路：找到数组中间的节点作为当前处理节点，然后使用递归进行左右节点处理
/*
[1, 2, 3, 4, 5, 6, 7]
         ↑

          4
[1, 2, 3]   [5, 6, 7]
   ↑           ↑

    2           6
[1]  [3]    [5]   [7]
*/

class treeNode {
    val: number;
    left: treeNode | null;
    right: treeNode | null;

    constructor(val: number) {
        this.val = val;
        this.left = null;
        this.right = null;
    }
}

function sortedArrayToBST(arr: number[]): treeNode | null {
    if (arr.length === 0) return null;

    const mid = Math.floor(arr.length / 2);
    const root = new treeNode(arr[mid]);
    root.left = sortedArrayToBST(arr.slice(0, mid));
    root.right = sortedArrayToBST(arr.slice(mid + 1));
    return root;
}
```

## 逻辑题：如何不利用第三个变量实现两个变量交换

  1. 直接运算

```
A = A + B
B = A - B
A = A - B
```

  1. 异或

  1. 位运算

[暂不支持的飞书块类型: 34]

一直在问我有没有其他解法，我说完这三个就没问了，可能就是这三种
