/**
 * Ok, code quality in here is an absolute mess. I plan to re-write most of this
 * anyway. This file sets up Matrix and provides the interface between Matrix,
 * the algorithm, and the GUI.
 * @author Nathan Pennie <kb1rd@kb1rd.net>
 */

import Vue from 'vue'
import sdk from 'matrix-js-sdk'
import axios from 'axios'
import {
  ListDocumentModel,
  LogootPosition,
  LogootInt,
  EventState
} from 'logootish-js'
import { validate } from 'jsonschema'

import { debug } from '@/plugins/debug'

const namespace = 'net.kb1rd.logootish-0'
const insert_event = namespace + '.ins'
const remove_event = namespace + '.rem'

const namespace_lg1 = 'net.kb1rd.logootish-1'

/**
 * A mapping of MXIDs and custom-branches (NYI) to symbols for the algo
 */
class MatrixSymbolTable {
  mxid_table = {}
  br_mxid_table = {}
  symbol_table = {}

  lookupById(mxid, branch) {
    if (this.branch) {
      if (!this.br_mxid_table[branch]) {
        this.br_mxid_table[branch] = {}
      }
      if (!this.br_mxid_table[branch][mxid]) {
        this.br_mxid_table[branch][mxid] = Symbol(`BRANCH/${branch}/${mxid}`)
        this.symbol_table[this.br_mxid_table[branch][mxid]] = { mxid, branch }
      }
      return this.br_mxid_table[branch][mxid]
    } else {
      if (!this.mxid_table[mxid]) {
        this.mxid_table[mxid] = Symbol(`BRANCH/${mxid}`)
        this.symbol_table[this.mxid_table[mxid]] = { mxid }
      }
      return this.mxid_table[mxid]
    }
  }

  lookupBySymbol(symbol) {
    return this.symbol_table[symbol]
  }
}

class InsertionEvent {
  state = EventState.PENDING
  constructor(body, start, rclk) {
    this.body = body
    this.start = start
    this.rclk = rclk
  }

  get end() {
    return this.start.offsetLowest(this.body.length)
  }

  toJSON() {
    return {
      start: this.start.toJSON(),
      rclk: this.rclk.toJSON(),
      body: this.body
    }
  }
}
InsertionEvent.JSON = {}
InsertionEvent.JSON.Schema = {
  type: 'object',
  properties: {
    body: { type: 'string' },
    start: LogootPosition.JSON.Schema,
    rclk: LogootInt.JSON.Schema
  },
  required: ['body', 'start', 'rclk']
}

class RemovalEvent {
  state = EventState.PENDING
  constructor(removals, rclk) {
    this.removals = removals
    this.rclk = rclk
  }

  toJSON() {
    return {
      removals: this.removals.map(({ start, length }) => ({
        start: start.toJSON(),
        length
      })),
      rclk: this.rclk.toJSON()
    }
  }
}
RemovalEvent.JSON = {}
RemovalEvent.JSON.Schema = {
  type: 'object',
  properties: {
    removals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: LogootPosition.JSON.Schema,
          length: { type: 'number' }
        },
        required: ['start', 'length']
      }
    },
    rclk: LogootInt.JSON.Schema
  },
  required: ['removals', 'rclk']
}

/**
 * Handles all event-defined behavior. This is the MITM that acts as the front
 * end for the algorithm. No other code calls functions on the algo.
 */
class EventAbstractionLayer {
  operation_listeners = []

  event_queue = []

  constructor(ldm, sytbl = new MatrixSymbolTable()) {
    this.sytbl = sytbl
    this.listdoc = ldm
  }
  onOperation(fn) {
    this.operation_listeners.push(fn)
  }

  async sendEvent(event, send, tryMerge) {
    this.event_queue.push(event)

    const preExitCleanup = () => {
      event.state = EventState.COMPLETE
      this.event_queue.splice(this.event_queue.indexOf(event), 1)
    }

    try {
      let delay
      event.state = EventState.SENDING
      while ((delay = await send(event)) > 0) {
        event.state = EventState.PENDING

        for (let i = 0; i < this.event_queue.length; i++) {
          const ev = this.event_queue[i]
          if (tryMerge(event, ev)) {
            return
          }
        }

        await new Promise((resolve) => {
          setTimeout(resolve, delay)
        })
        event.state = EventState.SENDING
      }
    } finally {
      preExitCleanup()
    }
  }

  createInsertionEvent(pos, body, send) {
    const { start, rclk } = this.listdoc.insertLocal(pos, body.length)
    const event = new InsertionEvent(body, start, rclk)

    return this.sendEvent(event, send, (event, into) => {
      if (
        into !== event &&
        into instanceof InsertionEvent &&
        into.state === EventState.PENDING &&
        into.rclk.cmp(event.rclk) === 0
      ) {
        if (event.start.cmp(into.end) === 0) {
          debug.info('Merged insertion event to end of other')
          into.body += event.body
          return true
        } else if (event.end.cmp(into.start) === 0) {
          debug.info('Merged insertion event to start of other')
          into.body = event.body + into.body
          into.start = into.start.inverseOffsetLowest(event.body.length)
          return true
        }
      }
      return false
    })
  }
  createRemovalEvent(pos, len, send) {
    const { removals } = this.listdoc.removeLocal(pos, len)
    // Note: Technically, I shouldn't grab the lamport clock out of the list doc
    // like this, but this retains compatibility with older versions
    const event = new RemovalEvent(removals, this.listdoc.clock)

    return this.sendEvent(event, send, (event, into) => {
      if (
        into !== event &&
        into instanceof RemovalEvent &&
        into.state === EventState.PENDING &&
        into.rclk.cmp(event.rclk) === 0
      ) {
        debug.info('Merged removal events')
        into.removals.push(...event.removals)
        return true
      }
      return false
    })
  }

  processEvent({ id, type, content, sender }) {
    const operations = []
    let body
    if (type === insert_event) {
      if (!validate(content, InsertionEvent.JSON.Schema).valid) {
        debug.warn(`Event ${id} schema is not valid`)
        return
      }

      const { rclk, start } = content
      const br = this.sytbl.lookupById(sender)
      body = content.body

      operations.push(
        ...this.listdoc.insertLogoot(
          br,
          LogootPosition.fromJSON(start),
          body.length,
          LogootInt.fromJSON(rclk)
        )
      )
    } else if (type === remove_event) {
      if (!validate(content, RemovalEvent.JSON.Schema).valid) {
        debug.warn(`Event ${id} schema is not valid`)
        return
      }

      const { removals, rclk } = content
      const br = this.sytbl.lookupById(sender)

      removals.forEach(({ start, length }) => {
        operations.push(
          ...this.listdoc.removeLogoot(
            br,
            LogootPosition.fromJSON(start),
            length,
            LogootInt.fromJSON(rclk)
          )
        )
      })
    } else if (type === namespace_lg1) {
      // Coming soon ;)
      debug.warn('New event type. NYI')
    }

    if (operations.length) {
      // Fill in the text based on the offset and length returned by the algo
      operations.forEach((op) => {
        if (op.type === 'i') {
          if (!body) {
            throw new Error(
              'Algorithm returned insertion operation, but an insertion was not performed.'
            )
          }
          op.body = body.slice(op.offset, op.offset + op.length)
          delete op.offset
          delete op.length
        }
      })
      // Inform listeners of new operations
      this.operation_listeners.forEach((l) => l(operations))
    }
  }
}

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

    // Initial sync is only used to grab the room list. Additional sync requests
    // are made to the document-rooms as necessary
    const isync_filter = await client.createFilter({
      room: {
        timeline: {
          limit: 50,
          types: [
            'm.room.create',
            'm.room.name',
            'm.room.topic',
            'm.room.avatar',
            'm.room.aliases',
            insert_event,
            remove_event,
            namespace_lg1
          ]
        },
        state: {
          types: [
            'm.room.create',
            'm.room.name',
            'm.room.topic',
            'm.room.avatar',
            'm.room.aliases'
          ]
        },
        ephemeral: {
          limit: 0,
          types: []
        },
        account_data: {
          limit: 0,
          types: []
        }
      },
      presence: {
        limit: 0,
        types: []
      },
      account_data: {
        limit: 0,
        types: []
      }
    })

    await client.startClient({ filter: isync_filter }).catch((e) => {
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
    debug.info(`Found user ID of ${mxid.user_id}`)

    client = sdk.createClient({
      baseUrl: hs,
      accessToken: access_token,
      userId: mxid.user_id
    })
    await startClient(client)
  }

  globals.createDocument = async (room_id, onOperation, err) => {
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

    const doc = { _active_listeners: [] }
    // A symbol-mxid-branch mapping for conflict support (coming soon!)
    doc.sytbl = new MatrixSymbolTable()
    // The actual algo (also, look up our current user and store a symbol)
    doc.ldm = new ListDocumentModel(doc.sytbl.lookupById(client.getUserId()))
    // The event processing layer (all calls will be made to this)
    doc.event_layer = new EventAbstractionLayer(doc.ldm, doc.sytbl)

    const sendEvent = async (ev, type) => {
      try {
        await client.sendEvent(room_id, type, ev.toJSON(), '')
      } catch (e) {
        if (e.event) {
          e.event.flagCancelled()
        }
        if (e && e.data && e.data.retry_after_ms) {
          debug.warn(
            `Hitting the rate limit: Will resend in ${e.data.retry_after_ms} ms`
          )
          return e.data.retry_after_ms
        } else {
          throw e
        }
      }
      return 0
    }

    // Define functions for user operations
    doc.insert = (pos, body) => {
      debug.info(`User inserted ${body} @ ${pos}`)
      doc.event_layer.createInsertionEvent(pos, body, (ev) =>
        sendEvent(ev, insert_event)
      )
    }
    doc.remove = (pos, length) => {
      debug.info(`User removed ${length} @ ${pos}`)
      doc.event_layer.createRemovalEvent(pos, length, (ev) =>
        sendEvent(ev, remove_event)
      )
    }
    doc.event_layer.onOperation(onOperation)

    let new_msgs = 0
    const onNewEvent = (event) => {
      new_msgs += 1

      const { content } = event.event
      const sender = event.sender.userId

      try {
        doc.event_layer.processEvent({
          id: event.event.event_id,
          type: event.getType(),
          content,
          sender
        })
      } catch (e) {
        debug.warn('Error processing event', e)
      }
    }

    const onRoomTimeline = (event, room, toStartOfTimeline, removed) => {
      // Filter for events in the current room & with null status (status is
      // assigned only for local echos)
      // TODO: Add a filter to sync requests
      if (room.roomId === room_id && !removed) {
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
            backwards: false,
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
    if (debug.syncback_settings.initial) {
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
