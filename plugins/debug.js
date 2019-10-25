import Vue from 'vue'

/*
 * This is a really sketchy thing I threw together last minute to enable and
 * disable debug
 */

/* eslint-disable no-console */

const debug = {
  store: undefined,
  checkStore() {
    return this.store && this.store.state.debug
  },

  log(...args) {
    if (!this.checkStore()) {
      return
    }
    console.log(...args)
  },
  warn(...args) {
    if (!this.checkStore()) {
      return
    }
    console.warn(...args)
  },
  error(...args) {
    if (!this.checkStore()) {
      return
    }
    console.error(...args)
  }
}

export default ({ store }) => {
  debug.store = store

  Vue.prototype.$debug = debug
}

export { debug }
