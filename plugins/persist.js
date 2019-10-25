import VuexPersistence from 'vuex-persist'

export default ({ store }) => {
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
  })
}
