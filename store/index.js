export const state = () => ({
  // Examples of blocking promises are user signin. The user cannot do anything
  // while this is completed.
  blocking_promises: [],

  // Enable debug setting from sign in form
  debug: false
})

export const getters = {
  hasBlockingOperation(state) {
    return Boolean(state.blocking_promises.length)
  }
}

export const mutations = {
  startBlockingOperation(state, promise) {
    state.blocking_promises.push(promise)
  },
  endBlockingOperation(state, promise) {
    state.blocking_promises.pop(promise)
    // return state.blocking_promises.pop(promise)
  },

  setDebugEnabled(state, enabled) {
    state.debug = Boolean(enabled)
  }
}

export const actions = {
  watchBlockingOperation({ commit }, promise) {
    commit('startBlockingOperation', promise)

    const remove = () => {
      commit('endBlockingOperation', promise)
      /* if (!commit('endBlockingOperation', promise)) {
        console.warn(
          'Blocking operation was removed from queue before an' +
            ' automatic removal attempt was made. This is a bug.'
        )
      } */
    }

    promise.then(
      (data) => {
        remove()
        return data
      },
      (error) => {
        remove()
        return error
      }
    )
  }
}
