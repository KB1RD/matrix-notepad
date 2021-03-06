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
    return Object.values(state.rooms)
  },
  room_map(state) {
    return state.rooms
  },
  room: (state) => (id) => {
    return state.rooms[id] || { roomId: id }
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

    // Matrix mutates rooms directly, so we must duplicate them to avoid later
    // store corruption
    state.rooms = {}
    rooms.forEach(({ roomId, name }) => {
      state.rooms[roomId] = { roomId, name }
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
