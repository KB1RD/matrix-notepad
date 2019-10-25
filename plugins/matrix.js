import Vue from 'vue'
import sdk from 'matrix-js-sdk'

import { debug } from '@/plugins/debug'

import { EventType, Document } from '@/algorithms/logootish'

const namespace = 'net.kb1rd.logootish-0'

export default ({ store }) => {
  const globals = {}
  globals.attemptSignIn = async (hs, access_token, room, err, onIns, onRem) => {
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

    if (room.startsWith('#')) {
      await client.getRoomIdForAlias(room).then((data) => {
        if (!data || !data.room_id) {
          throw new Error(`Cannot resolve room alias ${room}`)
        }
        room = data.room_id
      })
    }

    const prepared = new Promise((resolve, reject) => {
      client.once('sync', function(state, prevState, res) {
        if (state === 'PREPARED') {
          resolve()
        } else {
          reject(state)
        }
      })
    })

    const doc = new Document(
      (data) => {
        switch (data.type) {
          case EventType.INSERTATION:
            return client.sendEvent(room, namespace + '.ins', data, '')
          case EventType.REMOVAL:
            return client.sendEvent(room, namespace + '.rem', data, '')
          default:
            return new Promise((resolve, reject) =>
              reject(new Error('Invalid event type'))
            )
        }
      },
      onIns,
      onRem
    )

    let has_rxed_new_msg = false
    const room_id = room
    client.on('Room.timeline', function(event, room, toStartOfTimeline) {
      try {
        // Filter for events in the current room & with null status (status is
        // assigned only for local echos)
        // TODO: Add a filter to sync requests
        if (room.roomId === room_id && !event.status) {
          switch (event.getType()) {
            case namespace + '.ins':
              has_rxed_new_msg = true
              doc.remoteInsert(event.event.content)
              return
            case namespace + '.rem':
              has_rxed_new_msg = true
              doc.remoteRemove(event.event.content)
              return
          }
        }
      } catch (e) {
        if (e.critical) {
          client.stopClient()
        }
        err(e)
      }
    })

    globals.client = client
    globals.doc = doc

    await client.startClient({ initialSyncLimit: 0 }).catch((e) => {
      client.stopClient()
      throw e
    })

    await prepared.catch((e) => {
      client.stopClient()
      throw e
    })

    const room_obj = client.getRoom(room)
    if (!room_obj) {
      client.stopClient()
      throw new Error('Failed to find room ' + room)
    }

    // Ensure that the Vuex store always knows the state
    store.commit('matrix/updateMatrixState', 'PREPARED')
    client.on('sync', function(state, prevState, res) {
      store.commit('matrix/updateMatrixState', state)
    })

    await doc.start().catch((e) => {
      client.stopClient()
      throw e
    })

    // Sync back until we are not recieving document events
    do {
      has_rxed_new_msg = false
      await client.scrollback(room_obj, 50)
    } while (has_rxed_new_msg)
  }

  globals.shutdown = () => {
    globals.doc = undefined
    if (globals.client) {
      globals.client.stopClient()
      globals.client = undefined
    }
  }

  Vue.prototype.$matrix = globals
}
