export const state = () => ({
  breakpoints: [],
  enable_syncback: true,
  assign_window_vars: false
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
  },
  shouldAssignWindowVars(state) {
    return state.assign_window_vars
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
  },
  setAssignWindowVars(state, enabled) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Syncback enabled state must be a boolean')
    }
    state.assign_window_vars = enabled
  }
}
