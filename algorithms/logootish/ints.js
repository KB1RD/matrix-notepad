class Int32 {
  // Size limit the int, enforce signing, and remove decimals
  int32 = new Int32Array([0])

  constructor(n) {
    this.add(n)
  }

  toJSON() {
    return this.int32[0]
  }

  add(n) {
    if (typeof n === 'number') {
      this.int32[0] += n
    } else if (n && n.int32) {
      this.int32[0] += n.int32[0]
    } else {
      throw new TypeError('Invalid argument to add(n). Not a number.')
    }
    return this
  }
  sub(n) {
    if (typeof n === 'number') {
      this.int32[0] -= n
    } else if (n && n.int32) {
      this.int32[0] -= n.int32[0]
    } else {
      throw new TypeError('Invalid argument to sub(n). Not a number.')
    }
    return this
  }

  cmp(n) {
    if (typeof n === 'number') {
      return 1 * (this.int32[0] >= n) + -1 * (this.int32[0] <= n)
    } else if (n && n.int32) {
      return (
        1 * (this.int32[0] >= n.int32[0]) + -1 * (this.int32[0] <= n.int32[0])
      )
    } else {
      throw new TypeError('Invalid argument. Not a number.')
    }
  }
  gt(n) {
    return this.cmp(n) === 1
  }
  gteq(n) {
    return this.cmp(n) >= 0
  }
  eq(n) {
    return this.cmp(n) === 0
  }

  get js_int() {
    return this.int32[0]
  }
}

export { Int32 }
