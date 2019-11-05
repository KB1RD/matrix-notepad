import Vue from 'vue'
import sdk from 'matrix-js-sdk'
import axios from 'axios'

import { debug } from '@/plugins/debug'

import { EventType, Document } from '@/algorithms/logootish'

const namespace = 'net.kb1rd.logootish-0'

export default ({ store }) => {
  const globals = {}

  const startClient = async (client) => {
    const prepared = new Promise((resolve, reject) => {
      client.once('sync', function(state, prevState, res) {
        if (state === 'PREPARED') {
          resolve()
        } else {
          reject(state)
        }
      })
    })

    client.on('Session.logged_out', (errorObj) => {
      store.commit('matrix/updateMatrixState', 'STOPPED')
      store.commit('matrix/updateSettings', {})
      globals.shutdown()
    })

    globals.client = client
    window.mx_client = client

    await client.startClient({ initialSyncLimit: 0 }).catch((e) => {
      client.stopClient()
      throw e
    })

    await prepared.catch((e) => {
      client.stopClient()
      throw e
    })

    // Ensure that the Vuex store always knows the state
    store.commit('matrix/updateMatrixState', 'PREPARED')
    client.on('sync', function(state, prevState, res) {
      store.commit('matrix/updateMatrixState', state)
    })

    const updateRooms = () => {
      // Unlike when directly adding data to the Vue data object, when putting
      // data in the Vuex store, it's possible to just pass in the object used
      // by the Matrix JS SDK directly because the Vuex store does state
      // tracking through commits
      store.commit('matrix/updateRooms', client.getRooms())
    }

    client.on('Room', updateRooms)
    client.on('Room.name', updateRooms)
    client.on('deleteRoom', updateRooms)
    updateRooms()
  }

  globals.userPassSignIn = async (hs, mxid, password) => {
    if (globals.client) {
      globals.client.stopClient()
    }

    if (!hs) {
      // Prettier wanted me to put each function call on a new line, which I
      // thought was stupid and unreadable
      // eslint-disable-next-line
      const base_url = 'https://' + mxid.split(':').slice(1).join(':')
      const { data } = await axios.get(base_url + '/.well-known/matrix/client')

      if (!data || !data['m.homeserver'] || !data['m.homeserver'].base_url) {
        throw new Error('Well-known lookup did not contain homeserver URL')
      }
      hs = data['m.homeserver'].base_url
    }

    const client = sdk.createClient({ baseUrl: hs })
    const response = await client.loginWithPassword(mxid, password)
    if (!response || !response.access_token || !response.user_id) {
      throw new Error('Server returned an invalid login response')
    }

    await startClient(client)
    return {
      token: response.access_token,
      mxid: response.user_id,
      hs
    }
  }
  globals.tokenSignIn = async (hs, access_token) => {
    if (globals.client) {
      globals.client.stopClient()
    }

    // TODO: In the future, implement a REAL sign in dialog with a REAL UI/UX
    let client = sdk.createClient({
      baseUrl: hs,
      accessToken: access_token
    })
    const mxid = await client._http.authedRequest(
      undefined,
      'GET',
      '/account/whoami',
      {}
    )
    debug.log(`Found user ID of ${mxid.user_id}`)

    client = sdk.createClient({
      baseUrl: hs,
      accessToken: access_token,
      userId: mxid.user_id
    })
    await startClient(client)
  }

  globals.createDocument = async (room_id, onIns, onRem, err) => {
    if (!globals.client) {
      throw new Error('Matrix client is uninitialized')
    }

    const client = globals.client
    if (room_id.startsWith('#')) {
      await client.getRoomIdForAlias(room_id).then((data) => {
        if (!data || !data.room_id) {
          throw new Error(`Cannot resolve room alias ${room_id}`)
        }
        room_id = data.room_id
      })
    }

    const doc = new Document(
      (data) => {
        switch (data.type) {
          case EventType.INSERTATION:
            if (store.getters['debugstate/shouldBreak']('LI')) {
              // eslint-disable-next-line
              debugger
            }
            return client.sendEvent(room_id, namespace + '.ins', data, '')
          case EventType.REMOVAL:
            if (store.getters['debugstate/shouldBreak']('LR')) {
              // eslint-disable-next-line
              debugger
            }
            return client.sendEvent(room_id, namespace + '.rem', data, '')
          default:
            return new Promise((resolve, reject) =>
              reject(new Error('Invalid event type'))
            )
        }
      },
      onIns,
      onRem
    )

    let new_msgs = 0
    const onNewEvent = (event) => {
      new_msgs += 1
      switch (event.getType()) {
        case namespace + '.ins':
          if (store.getters['debugstate/shouldBreak']('RI')) {
            // eslint-disable-next-line
            debugger
          }
          doc.remoteInsert(event.event.content)
          return
        case namespace + '.rem':
          if (store.getters['debugstate/shouldBreak']('RR')) {
            // eslint-disable-next-line
            debugger
          }
          doc.remoteRemove(event.event.content)
      }
    }

    const onRoomTimeline = (event, room, toStartOfTimeline, removed) => {
      // Filter for events in the current room & with null status (status is
      // assigned only for local echos)
      // TODO: Add a filter to sync requests
      if (room.roomId === room_id && !event.status && !removed) {
        try {
          onNewEvent(event)
        } catch (e) {
          if (e.critical) {
            client.stopClient()
          }
          err(e, doc)
        }
      }
    }
    client.on('Room.timeline', onRoomTimeline)
    doc._active_listeners.push({
      event: 'Room.timeline',
      listener: onRoomTimeline
    })

    const room_obj = client.getRoom(room_id)
    if (!room_obj) {
      client.stopClient()
      throw new Error('Failed to find room ' + room_id)
    }

    let sync_i = 0
    const stored_events = room_obj
      .getLiveTimeline()
      .getEvents()
      .slice()
    doc.fetchEvents = async (n) => {
      new_msgs = 0

      // Get a list of old events that we have floating around
      const replay_events = stored_events.slice(sync_i, sync_i + n)

      if (n - replay_events.length > 0) {
        // If we still need more events to satisfy the requirement for `n`
        // events, fetch some more using back pagination
        await client.paginateEventTimeline(room_obj.getLiveTimeline(), {
          backwards: true,
          limit: n - replay_events.length
        })
        if (n - replay_events.length - new_msgs > 0) {
          // If we need even more, fetch some using forward pagination
          await client.paginateEventTimeline(room_obj.getLiveTimeline(), {
            backwards: true,
            limit: n - replay_events.length - new_msgs
          })
        }
      }
      replay_events.forEach((event) => {
        try {
          onNewEvent(event)
        } catch (e) {
          if (e.critical) {
            client.stopClient()
          }
          err(e, doc)
        }
      })

      sync_i += replay_events.length
    }

    // Sync back until we are not recieving document events
    if (store.state.debugstate.enable_syncback) {
      do {
        await doc.fetchEvents(50)
        // ESLint complains that new_msgs isn't set during this loop. It
        // actually is, just inside the function defined above
        // eslint-disable-next-line
      } while (new_msgs > 0)
    }
    return doc
  }

  globals.signOut = () => {
    if (!globals.client || !globals.client.isLoggedIn()) {
      throw new Error('Not logged in')
    }
    return globals.client.logout()
  }

  globals.shutdown = () => {
    if (globals.client) {
      globals.client.stopClient()
      globals.client = undefined
    }
  }
  globals.shutdownDocument = (doc) => {
    doc._active_listeners.forEach(({ event, listener }) => {
      globals.client.off(event, listener)
    })
  }

  Vue.prototype.$matrix = globals
}
