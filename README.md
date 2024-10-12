原文地址: https://pomb.us/build-your-own-react/

## 注意点
  node -v      =>    16.20.2

## git log
```
  部分提交节点，可通过reset --hard <hash>回退版本
```
commit 74d79c14996ba4c36a5cd057216787bac2e3c07d (HEAD -> master, origin/master)
Date:   Sat Oct 12 16:22:07 2024 +0800

    No.end : 实现useState

commit 6c19d4fb3da6279599eaaab4ae4de3f881ac504b
Date:   Fri Oct 11 18:30:40 2024 +0800

    No.7：处理函数组件：挂载+更新

commit b3ba9a95dd5b58da86353c30cb5998b7e677e66a
Date:   Fri Oct 11 17:11:40 2024 +0800

    No.6 重构：创建Fiber   新增：更新Fiber

commit 3c0ac31687c45c265b7af7f8faba90cc509f4eb7
Date:   Fri Oct 11 11:51:35 2024 +0800

    No.5:渲染与提交1

    
## 搭建Babel环境

  Babel 可以通过编译将 JSX 转化为 JavaScript 对象的形式，以描述虚拟 DOM 结构。Babel 自带的 JSX 转换插件会将 JSX 语法转化为 `React.createElement` 调用，可供查看自定义与Babel实现的createElement之间的区别

### Babel JSX 转换原理：

当你编写如下 JSX：

```jsx
const element = <div className="box">Hello, World!</div>;
```

Babel 会将其编译为类似如下的 JavaScript 代码：

```js
const element = React.createElement(
  "div",
  { className: "box" },
  "Hello, World!"
);
```

这里，`React.createElement` 的返回值是一个描述该元素的 JavaScript 对象，即虚拟 DOM 节点。

### 如何创建 Babel 环境以支持 JSX 转换？

要使用 Babel 将 JSX 转换为 JavaScript，你可以创建一个简单的开发环境。下面是具体步骤：

#### 1. 初始化项目

首先创建一个项目目录并初始化 `package.json`：

```bash
mkdir jsx-to-js-env
cd jsx-to-js-env
npm init -y
```

#### 2. 安装 Babel 和相关插件

安装 Babel 和用于 JSX 转换的插件：

```bash
npm install @babel/core @babel/cli @babel/preset-react --save-dev
```

- `@babel/core`：Babel 的核心库。
- `@babel/cli`：允许你在命令行中使用 Babel。
- `@babel/preset-react`：专门用于编译 React 和 JSX 的预设插件。

#### 3. 配置 Babel

在项目根目录下创建一个 `.babelrc` 配置文件，配置 Babel 使用 `@babel/preset-react`：

```json
{
  "presets": ["@babel/preset-react"]
}
```

#### 4. 编写 JSX 代码

创建一个 `src` 文件夹，并在其中编写你的 JSX 文件，如 `index.jsx`：

```jsx
// src/index.jsx
const element = <div className="box">Hello, World!</div>;

console.log(element);
```

#### 5. 使用 Babel 转译 JSX

你可以通过 Babel CLI 将 `index.jsx` 转换为 JavaScript 文件。运行以下命令：

```bash
npx babel src --out-dir dist
```

这个命令会将 `src` 目录下的所有文件编译到 `dist` 目录。编译后的 `dist/index.js` 文件会将 JSX 转换为 `React.createElement` 语法。

编译后的 JavaScript 文件会像这样：

```js
// dist/index.js
const element = React.createElement("div", { className: "box" }, "Hello, World!");
console.log(element);
```

#### 6. 执行编译后的文件

你可以通过 Node.js 运行编译后的文件，验证是否正常工作：

```bash
node dist/index.js
```

### 
