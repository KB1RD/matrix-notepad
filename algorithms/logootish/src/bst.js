class BstNode {
  left = undefined
  right = undefined
  data = {}

  constructor(data) {
    // When I see this, I miss C++. A lot.
    this.data = data
  }
}

class Bst {
  bst_root = undefined

  constructor(cmp) {
    this.cmp = cmp
  }

  gteqcmp(a, b) {
    return this.cmp(a, b) >= 0
  }
  gtcmp(a, b) {
    return this.cmp(a, b) > 0
  }
  eqcmp(a, b) {
    return this.cmp(a, b) === 0
  }

  add(object, container = this, key = 'bst_root') {
    if (!container[key]) {
      container[key] = new BstNode(object)
    } else if (this.gteqcmp(container[key].data, object)) {
      this.add(object, container[key], 'left')
    } else {
      this.add(object, container[key], 'right')
    }
  }

  _getInorderSuccessor(object, container = this, key = 'bst_root') {
    let successor
    const setSuccessor = (s) => {
      if (!successor || (s && this.gtcmp(s.data, successor.data))) {
        successor = s
      }
    }
    if (container[key]) {
      if (this.gteqcmp(container[key].data, object)) {
        setSuccessor({ container, key, data: container[key].data })
        setSuccessor(this._getInorderSuccessor(object, container[key], 'left'))
      }
      setSuccessor(this._getInorderSuccessor(object, container[key], 'right'))
    }
    return successor
  }
  remove(object, container = this, key = 'bst_root') {
    if (container[key]) {
      const result = this.cmp(container[key].data, object)
      if (result > 0) {
        this.remove(object, container[key], 'left')
      } else if (result < 0) {
        this.remove(object, container[key], 'right')
      } else if (container[key].left && container[key].right) {
        const successor = this._getInorderSuccessor(
          container[key].data,
          container,
          key
        )

        this.remove(successor.data, successor.container, successor.key)
        container[key].data = successor.data
      } else {
        container[key] = container[key].left || container[key].right
      }
    }
  }

  operateOnAllRange(
    start,
    endm1,
    operation,
    node = this.bst_root,
    undef = false
  ) {
    if (node && !undef) {
      if (this.gteqcmp(node.data, start)) {
        if (this.gteqcmp(endm1, node.data)) {
          this.operateOnAllRange(start, endm1, operation, node.left, !node.left)
          this.operateOnAllRange(
            start,
            endm1,
            operation,
            node.right,
            !node.right
          )
          operation(node)
        } else {
          this.operateOnAllRange(start, endm1, operation, node.left, !node.left)
        }
      } else {
        this.operateOnAllRange(start, endm1, operation, node.right, !node.right)
      }
    }
  }
  operateOnAllGteq(value, operation, node = this.bst_root, undef = false) {
    if (node && !undef) {
      if (this.gteqcmp(node.data, value)) {
        operation(node)
        this.operateOnAllGteq(value, operation, node.left, !node.left)
      }
      this.operateOnAllGteq(value, operation, node.right, !node.right)
    }
  }
  operateOnAllLteq(value, operation, node = this.bst_root, undef = false) {
    if (node && !undef) {
      if (this.gteqcmp(value, node.data)) {
        operation(node)
        this.operateOnAllLteq(value, operation, node.right, !node.right)
      }
      this.operateOnAllLteq(value, operation, node.left, !node.left)
    }
  }

  operateOnAll(operation, node = this.bst_root, undef = false) {
    if (node && !undef) {
      this.operateOnAll(operation, node.left, !node.left)
      operation(node)
      this.operateOnAll(operation, node.right, !node.right)
    }
  }

  getRange(start, endm1) {
    const nodes = []
    this.operateOnAllRange(start, endm1, (n) => nodes.push(n))

    return nodes
  }
  getGteq(value) {
    let nodes = []
    this.operateOnAllGteq(value, (n) => {
      if (!nodes[0] || this.gtcmp(nodes[0].data, n.data)) {
        nodes = [n]
      } else if (this.eqcmp(nodes[0].data, n.data)) {
        nodes.push(n)
      }
    })

    return nodes
  }
  getLteq(value) {
    let nodes = []
    this.operateOnAllLteq(value, (n) => {
      if (!nodes[0] || this.gtcmp(n.data, nodes[0].data)) {
        nodes = [n]
      } else if (this.eqcmp(nodes[0].data, n.data)) {
        nodes.push(n)
      }
    })

    return nodes
  }

  toString() {
    let str = 'BST [\n'
    this.operateOnAll(({ data }) => {
      str += '  ' + data.toString() + '\n'
    })
    str += ']'
    return str
  }
}

export { Bst, BstNode }
