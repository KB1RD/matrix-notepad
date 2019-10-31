import Vue from 'vue'
import VuexPersistence from 'vuex-persist'

export default ({ store }) => {
  const callbacks = []
  let storeReady = false
  window.onNuxtReady(() => {
    new VuexPersistence({
      reducer: (state) => ({
        matrix: {
          credentials: {
            hs: state.matrix.credentials.hs,
            access_token: state.matrix.credentials.access_token
          },
          working_room: state.matrix.working_room
        },
        debug: state.debug
      })
    }).plugin(store)
    storeReady = true
    callbacks.forEach((cb) => {
      try {
        cb()
      } catch (e) {
        console.error(e)
      }
    })
  })

  Vue.prototype.$onPersistStoreReady = (func) => {
    if (storeReady) {
      return func()
    }
    callbacks.push(func)
  }
}
