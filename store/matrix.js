export const state = () => ({
  matrix_state: 'STOPPED',

  credentials: {
    hs: '',
    access_token: ''
  },

  working_room: '',

  rooms: []
})

export const getters = {
  save(state) {
    const { hs, access_token } = state.credentials
    const { working_room } = state
    return { hs, access_token, working_room }
  },

  signedIn(state) {
    return (
      state.matrix_state &&
      state.matrix_state !== '' &&
      state.matrix_state.toLowerCase() !== 'stopped'
    )
  },

  rooms(state) {
    return state.rooms
  }
}

export const mutations = {
  updateMatrixState(state, matrix_state) {
    state.matrix_state = matrix_state || 'STOPPED'
  },

  updateSettings(state, { hs, token, room }) {
    state.credentials.hs = hs
    state.credentials.access_token = token
    state.working_room = room
  },

  updateRooms(state, rooms) {
    if (!Array.isArray(rooms)) {
      throw new TypeError('Rooms object is not an array')
    }

    // Matrix mutates rooms directly, so we must duplicate them
    state.rooms = rooms.map(({ roomId, name }) => {
      return { roomId, name }
    })
  },

  // Signin information is pushed in seperately because it is confirmed before
  // it is saved -- It's only updated when the user presses the button AND the
  // used is signed in successfully
  load(state, fromObject) {
    if (!fromObject) {
      return
    }

    const { hs, access_token, working_room } = fromObject

    state.credentials = {
      hs: hs || state.credentials.hs,
      access_token: access_token || state.credentials.access_token
    }

    state.working_room = working_room || state.working_room
  }
}
