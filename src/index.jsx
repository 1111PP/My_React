//当前要处理的工作单元（任务）
let nextUnitOfWork = null
//保存纤维树的根,类似链表保存Head节点
let wipRoot = null
//保存旧纤维树，用于新旧纤维树对比 -> 更新
//  💡PS:保存根容器root的fiber,实际就可以通过child、parnet、sibling操作所有fiber
let currRoot = null

// 在 vnode纤维化完成后 执行此操作。这里递归地将所有节点追加到 dom 中。
function commitRoot() {
  console.log('🈯fiber树', wipRoot)
  // 从child开始处理
  commitWork(wipRoot.child)
  currRoot = wipRoot
  wipRoot = null
}

// 💡每个节点的挂载操作需要涉及到: parent > (child + sibling) > child.child ,所以始终应该处于中间的child开始挂载工作,类似链表
function commitWork(fiber) {
  if (!fiber) return
  const parentDOM = fiber.parent.dom
  parentDOM.appendChild(fiber.dom)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

/**
 * 指定下一轮细分的任务，初始任务单元为 #root 根容器
 * @param {vnode} element
 * @param {HTMLElement} container
 */
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currRoot, //保存旧fiber树
  }
  nextUnitOfWork = wipRoot
}

function workLoop(deadline) {
  //是否暂停当前任务单元,让出控制权，以便不会主线程
  let shouldYield = false
  // 🈯1.渲染任务
  // 如果还有要处理的任务  && 存在控制权(💡还存在空闲时间)
  while (nextUnitOfWork && !shouldYield) {
    //  处理当前任务单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    //判断是否存在空闲时间
    shouldYield = deadline.timeRemaining() > 1
  }

  // 🈯2.挂载任务
  //一旦完成了所有工作, 没有下一个工作单元performUnitOfWork返回undefined,于是 nextUnitOfWork = undefined, 就将整个 Fiber 树提交给 DOM。
  if (!nextUnitOfWork && wipRoot) {
    // 此时 wipRoot 是纤维化的根节点,可以通过child,parent,sibling连接到任意节点,于是开始挂载操作
    commitRoot()
  }
  //准备下一轮空闲时间执行任务
  requestIdleCallback(workLoop)
}

// 渲染任务纤维化，拆分为一个个的工作单元
/**
 * TODO add dom node 渲染当前fiber
 * TODO create new fibers 为 childs 纤维化
 * TODO return next unit of work 查找下一个任务 fiber
 * @param {} fiber //当前处理的任务单元
 * @returns 下一次处理的任务单元
 */
function performUnitOfWork(fiber) {
  // 创建一个新节点并将其附加到 DOM, Fiber.dom 属性中跟踪 DOM 节点
  if (!fiber.dom) fiber.dom = createDom(fiber)
  // // 当前fiber容器 挂载至 父fiber容器中
  // 每次我们处理一个元素时，我们都会向 DOM 添加一个新节点。并且，请记住，在我们完成整个树的渲染之前，浏览器可能会中断我们的工作。在这种情况下，用户将看到不完整的 UI。我们不希望这样。因此需要删除👇行改变dom的操作
  // if (fiber.parent) fiber.parent.dom.appendChild(fiber.dom)
  // 为下🟥一层每个children创建一个新的纤维
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null
  while (index < elements.length) {
    const element = elements[index]
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }
    // 将它添加到 Fiber 树中，将其设置为子级或兄弟级，具体取决于它是否是第一个子级
    if (index === 0) {
      // fiber指向到第一个child
      fiber.child = newFiber
    } else {
      // 后续兄弟形成一个链表:
      //   fiber
      //     ↓
      // 第一个child -> sibling 1 -> sibling 2 -> ....
      prevSibling.sibling = newFiber
    }
    // 迭代
    prevSibling = newFiber
    index++
  }
  // 最后我们寻找下一个工作单元。
  // 下一个任务单元查找规则：🟥子  => 兄 => 叔(父的兄) => 父的父的兄 => ....  => 父的父的....父的兄 / root (逐层往上查找祖先的兄，最终查找到 祖先的兄 或 root ，若到达了root表示渲染结束)
  if (fiber.child) {
    //存在child直接返回
    return fiber.child
  }
  //不存在child，则逐层往上查找，最终查找到某一个祖先的兄再返回
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
  //若查找到了root，则不会显示的return，默认return undefined，表示渲染工作完成了
}

/**
 * 创建vnode
 * @param {*} type
 * @param {*} props
 * @param  {...any} children
 * @returns
 */
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : MyReact.createTextElement(child)
      ),
    },
  }
}

/**
 * 对细分的任务单元进行渲染
 * @param {*} fiber
 * @returns
 */
function createDom(fiber) {
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)
  // 为 DOM 节点设置属性
  MyReact.handleAttributes(dom, fiber.props)

  return dom
}

function handleChildren(dom, children) {
  if (Array.isArray(children)) {
    children.forEach((child) => {
      MyReact.render(child, dom)
    })
  }
}
function handleAttributes(dom, props) {
  //文本元素：不存在setArrtibute方法，直接设置nodeValue即可
  if (dom.nodeType === 3) return (dom.nodeValue = props.nodeValue)

  for (const key in props) {
    if (key === 'children') continue
    const value = props[key]
    switch (key) {
      //处理style样式
      case 'style':
        MyReact.handleStyle(dom, value)
        break
      //处理默认属性，但包括组件的props数据传递
      default:
        dom.setAttribute(key, value)
        break
    }
  }
}
function handleStyle(node, styleObj) {
  Object.keys(styleObj).forEach((key) => {
    node.style[key] = styleObj[key]
  })
}
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT', // 修改为 TEXT_ELEMENT
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

let MyReact = {
  createDom,
  createElement,
  render,
  handleChildren,
  createTextElement,
  handleAttributes,
  handleStyle,
}

// babel会使用我们自定义的createElement编译这段jsx代码,转化为Vnode对象
/** @jsx MyReact.createElement */
const element = (
  <div
    className="box"
    style={{ border: '2px solid black' }}
  >
    外层 div 标签
    <div
      className="child1"
      style={{ border: '2px dashed black' }}
    >
      第一层children1
      <div
        className="child1-1"
        style={{ color: 'red', fontWeight: '700', border: '1px solid red' }}
      >
        第二层children1
      </div>
    </div>
    <div className="child2">
      第一层children2
      <div
        className="child2-2"
        style={{ color: 'green', border: '1px solid green' }}
      >
        第二层children2
      </div>
    </div>
  </div>
)

const container = document.getElementById('root')
// 渲染的开始 ,实际上是创建第一个细分任务
MyReact.render(element, container)
// 空闲时开始执行细分任务,渲染 + 挂载
requestIdleCallback(workLoop)

// console.log(nextUnitOfWork)
