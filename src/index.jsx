//当前要处理的工作单元（任务）
let nextUnitOfWork = null
//保存新纤维树的根,类似链表保存Head节点
let wipRoot = null
//保存旧纤维树的根，用于新旧纤维树对比 -> 更新
//  💡PS:保存根容器root的fiber,实际就可以通过child、parnet、sibling操作所有fiber
let currRoot = null
let deletions = null

// 排除的属性
//    1.children属性，他们为子元素，单独处理
//    2.event 事件处理，以on开头的属性
const exceptProperty = (key) => key !== 'children' && !isEvent(key)
// 是否为 新/更改 的属性
const isNew = (prev, next) => (key) => prev[key] !== next[key]
// ❗属性 key 同时存在与 prev 和 next 时 返回 false
const isDiff = (prev, next) => (key) => !(key in next)
const isEvent = (key) => key.startWith('on')

/**
 * 更新当前节点的属性，包含arrtiubte、children
 * @param {HTMLElement} dom
 * @param {*} oldProps
 * @param {*} newProps
 */
function updateDom(dom, oldProps, newProps) {
  // -------------------------------事件属性-------------------------------

  // 为dom删除事件
  // 如果事件处理程序发生更改，我们会将其从节点中删除。
  Object.keys(oldProps)
    .filter(isEvent)
    .filter((key) => !(key in newProps) || isNew(oldProps, newProps)(key)) // 🟥拿到新旧Props中 事件名不同 || 事件名相同但处理回调函数不同的事件
    .forEach((name) => {
      // 移除这些废弃的事件
      const eventName = name.toLowerCase().substring(2)
      dom.removeEventListener(eventName, oldProps[name])
    })
  // 为dom新增事件
  Object.keys(newProps)
    .filter(isEvent)
    .filter(isNew(oldProps, newProps)) //筛选出：newProps的 事件数组 中存在但oldProps中没有的事件名   💡例： newProps EventArr:['onA','onB'] oldProps EventArr:['onA','onC']  => ['onB']
    .forEach((name) => {
      // 新增的事件
      const eventName = name.toLowerCase().substring(2)
      dom.addEventListener(eventName, oldProps[name])
    })
  // -------------------------------普通属性-------------------------------
  // 为 Dom 删除（置空） oldProps 与 newProps 中的不同属性
  Object.keys(oldProps)
    .filter(exceptProperty)
    .filter(isDiff(oldProps, newProps)) //过滤：newProps与oldProps中同时存在的属性，保留其差异的key   💡例：newProps:{a:1,b:2}  oldProps:{a:1}  => ['b']
    .forEach((key) => (dom[key] = ''))

  // 为 Dom 设置 新的 / 更改 的属性
  Object.keys(newProps)
    .filter(exceptProperty)
    .filter(isNew(oldProps, newProps)) // 过滤 新增 / 修改 过的属性
    .forEach((key) => (dom[key] = newProps[key]))
}
// 在 vnode纤维化完成后 执行此操作。这里递归地将所有节点追加到 dom 中。
function commitRoot() {
  console.log('🈯fiber树', wipRoot)

  // 批量删除节点
  deletions.forEach(commitWork)
  // 从Fiber树中根容器#root的child开始处理
  commitWork(wipRoot.child)
  currRoot = wipRoot
  wipRoot = null
}

// 💡每个节点的挂载操作需要涉及到: parent > (child + sibling) > child.child ,所以始终应该处于中间的child开始挂载工作,类似链表
function commitWork(fiber) {
  if (!fiber) return

  // 获取当前纤维节点的parent
  let parentDomFiber = fiber.parent
  // 沿着fiber树向上寻找，直到找到具有 DOM 节点的 fiber
  while (!parentDomFiber.dom) {
    parentDomFiber = parentDomFiber.parent
  }
  // 将具有DOM节点的fiber 赋值给 负责被挂载的parentDOM容器上
  const parentDOM = parentDomFiber.dom
  const { effectTag, dom, props, alternate } = fiber
  // 1.初次挂载 / 新增
  if (effectTag === 'PLACEMENT' && dom !== null) {
    parentDOM.appendChild(fiber.dom)
  }
  // 2.删除
  else if (effectTag === 'DELETION') {
    commitDeletion(fiber.dom, parentDOM)
  }
  // 3.复用，只需更新props
  else if (effectTag === 'UPDATE' && dom !== null) {
    // 更新
    updateDom(dom, alternate.props, props)
  }
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
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
  deletions = []
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
/**
 * 将旧纤维与新元素相协调,同时迭代旧光纤 (wipFiber.alternate) 的子级和我们想要协调的元素数组。
 * 节点纤维化，节点间建立联系，用于 初始纤维化 + 更新
 * 建立连接的节点：Fiber节点、Fiber节点的所有childrens
 * @param {*} wipFiber Fiber节点
 * @param {*} elements Fiber节点的childrens
 */
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
  // 新旧vnode对比：同时迭代旧光纤 (wipFiber.alternate) 的子级和我们想要协调的元素数组。
  //  ❓|| oldFiber !== null 此次更新需要删除节点的情况
  while (index < elements.length || oldFiber !== null) {
    // 新vnode  ->  element
    // 旧vnode  ->  fiber     💡旧vnode的dom已经被渲染，而新vnode的dom还未渲染
    const element = elements[index]
    let newFiber = null
    // 新旧vnode元素类型对比
    const sameType = oldFiber && element && element.type === oldFiber.type
    // 相同元素类型：复用元素并更新props
    if (sameType) {
      // TODO update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }
    // 不同元素类型：创建新元素
    if (element && !sameType) {
      // TODO add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null, //还未被渲染，等轮到该节点的单元任务执行时，才会被徐娜然
        parent: wipFiber,
        alternate: null, //此节点无法被复用，也就是说新旧vnode在此节点以后完全不同，因此与之匹配的旧Fiber为null
        effectTag: 'PLACEMENT',
      }
    }
    // 不同元素类型：删除旧元素
    if (oldFiber && !sameType) {
      // TODO delete the oldFiber's node
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
    // 将它添加到 Fiber 树中，将其设置为子级或兄弟级，具体取决于它是否是第一个子级
    if (index === 0) {
      // fiber指向到第一个child
      wipFiber.child = newFiber
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
}

/**
 * 渲染任务纤维化，将Vnode拆分为一个个的工作单元，即当前节点（对应一个fiber）会创建真实Dom，并建立联系
 * TODO add dom node 渲染当前fiber
 * TODO create new fibers 为 childs 纤维化
 * TODO return next unit of work 查找下一个任务 fiber
 * @param {} fiber //当前处理的任务单元
 * @returns 下一次处理的任务单元
 */
function performUnitOfWork(fiber) {
  // 函数组件： 渲染 + 纤维化
  const updateFunctionComponent = (fiber) => {
    // 运行函数组件，获取当前函数组件 return 的 children
    const children = [fiber.type(fiber.props)]

    // 单独处理纤维化的工作
    reconcileChildren(fiber, children)
  }

  // 普通元素： 渲染 + 纤维化
  const updateHostComponent = (fiber) => {
    // 创建一个新节点并将其附加到 DOM, Fiber.dom 属性中跟踪 DOM 节点
    if (!fiber.dom) fiber.dom = createDom(fiber)

    // 单独处理纤维化的工作
    reconcileChildren(fiber, fiber.props.children)
  }

  // 对当前 fiber 渲染+纤维化 操作
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    // TODO add dom node 渲染当前fiber
    updateHostComponent(fiber)
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
/**@jsx MyReact.createElement */
function App(props) {
  return <h1>Hi {props.name}</h1>
}
const element = <App name="foo" />

const container = document.getElementById('root')
// 渲染的开始 ,实际上是创建第一个细分任务
MyReact.render(element, container)
// 空闲时开始执行细分任务,渲染 + 挂载
requestIdleCallback(workLoop)

// console.log(nextUnitOfWork)

// babel会使用我们自定义的createElement编译这段jsx代码,转化为Vnode对象
/** @jsx MyReact.createElement */
// const element = (
//   <div
//     className="box"
//     style={{ border: '2px solid black' }}
//   >
//     外层 div 标签
//     <div
//       className="child1"
//       style={{ border: '2px dashed black' }}
//     >
//       第一层children1
//       <div
//         className="child1-1"
//         style={{ color: 'red', fontWeight: '700', border: '1px solid red' }}
//       >
//         第二层children1
//       </div>
//     </div>
//     <div className="child2">
//       第一层children2
//       <div
//         className="child2-2"
//         style={{ color: 'green', border: '1px solid green' }}
//       >
//         第二层children2
//       </div>
//     </div>
//   </div>
// )
