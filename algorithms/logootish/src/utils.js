function Enum(...names) {
  const self = this
  names.forEach((n) => {
    self[n] = Symbol(n)
  })
}

// Like the built-in map function, but it replaces the element with an arbitrary
// number of elements, making it a combination of map, push, and filter
function arraymap(array, fn) {
  for (let i = 0; i < array.length; ) {
    const newarray = fn(array[i])
    array.splice(i, 1, ...newarray)
    i += newarray.length ? newarray.length : 1
  }
  return array
}

class PeekableIterator {
  i = 0
  constructor(array) {
    this.array = array
  }

  next() {
    const obj = this.peek()
    this.i++
    return obj
  }
  peek() {
    return {
      value: this.array[this.i],
      done: this.i >= this.array.length
    }
  }
}

// Errors that indicate a corrupt document and require client shutdown
// This class only exists to make code look pretty
class FatalError extends Error {
  fatal = true
}

export { Enum, arraymap, PeekableIterator, FatalError }
