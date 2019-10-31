export const state = () => ({
  breakpoints: [],
  enable_syncback: true
})

export const getters = {
  breakpoints(state) {
    return state.breakpoints || []
  },
  shouldBreak(state) {
    return (bp) => state.breakpoints.includes(bp)
  },
  syncback(state) {
    return state.enable_syncback
  }
}

export const mutations = {
  setBreakpoints(state, bps) {
    if (!Array.isArray(bps)) {
      throw new TypeError('Breakpoint array must be an array')
    }
    state.breakpoints = bps
  },
  setSyncbackEnabled(state, enabled) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Syncback enabled state must be a boolean')
    }
    state.enable_syncback = enabled
  }
}
