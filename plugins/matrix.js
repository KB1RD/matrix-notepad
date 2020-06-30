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
  BranchOrder,
  LogootPosition,
  LogootInt
} from '@kb1rd/logootish-js'
import { validate } from 'jsonschema'

import { debug } from '@/plugins/debug'

/**
 * https://matrix.to/#/!NasysSDfxKxZBzJJoE:matrix.org/$SkovTFf9be1rTTewjrwAQca4LodrUezBNafCUD4GAWU?via=matrix.org&via=amorgan.xyz&via=pixie.town
 */
const matrix_typed_state = 'org.matrix.msc1840'

const plaintext = 'net.kb1rd.plaintext'

const namespace = 'net.kb1rd.anchorlogoot0'
const insert_event = namespace + '.ins'
const remove_event = namespace + '.rem'

export { matrix_typed_state, plaintext }

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

/**
 * This ensures that the branch order has this particular branch in the correct order.
 */
const onNewBranch = (sytbl, order, mxid, branch) => {
  const symbol = sytbl.lookupById(mxid, branch)
  if (order.order.includes(symbol)) {
    return
  }
  const mxidBranchOrderFunc = (a, b) => {
    if (a.branch === b.branch) {
      if (a.mxid > b.mxid) {
        return -1
      } else if (a.mxid < b.mxid) {
        return 1
      }
      return 0
    }
    if (!a.branch) {
      return 1
    }
    if (!b.branch) {
      return -1
    }
    if (a.branch > b.branch) {
      return 1
    } else {
      return -1
    }
  }
  window.mxidBranchOrderFunc = mxidBranchOrderFunc
  order.insertOrdered(symbol, (a, b) =>
    mxidBranchOrderFunc(sytbl.lookupBySymbol(a), sytbl.lookupBySymbol(b))
  )
}

const EventState = {
  PENDING: 0,
  SENDING: 1,
  COMPLETE: 2
}

class InsertionEvent {
  state = EventState.PENDING
  constructor(sytbl, br, body, left, right, clk) {
    Object.assign(this, { sytbl, br, body, left, right, clk })
  }

  get start() {
    return new LogootPosition(this.br, this.body.length, this.left, this.right)
  }
  get end() {
    return new LogootPosition(
      this.br,
      this.body.length,
      this.left,
      this.right
    ).offsetLowest(this.body.length)
  }

  toJSON() {
    const order = new BranchOrder()
    return {
      a: {
        v: 0,
        l: this.left?.toMappedOrderJSON(order),
        r: this.right?.toMappedOrderJSON(order),
        o: order.toJSON((br) => {
          const { mxid, branch } = this.sytbl.lookupBySymbol(br)
          if (branch) {
            return [mxid, branch]
          } else {
            return [mxid]
          }
        })
      },
      // See the schema for why this is an array
      d: [this.body],
      c: this.clk.toJSON()
    }
  }
}

const OrderLookupArray = {
  type: 'array',
  items: { type: 'array', items: [{ type: 'string' }] }
}
const MappedLogootPosition = {
  type: 'array',
  items: {
    type: 'array',
    items: [LogootInt.JSON.Schema, { type: 'number' }]
  }
}

InsertionEvent.JSON = {}
InsertionEvent.JSON.Schema = {
  type: 'object',
  properties: {
    // Anchors
    a: {
      type: 'object',
      properties: {
        // Version for start resolution. Currently 0
        v: { type: 'number' },
        // Left anchor
        l: MappedLogootPosition,
        // Right anchor
        r: MappedLogootPosition,
        // Order lookup. Entries in the positions are mapped to branches here.
        o: OrderLookupArray
      },
      required: ['v', 'o']
    },
    // Data, in this case an array of strings
    // The strings are `join`ed. This is rich text future proofing.
    d: { type: 'array', items: { type: 'string' } },
    // Lamport clock
    c: LogootInt.JSON.Schema,
    // Branch information (currently not used. May be used in the future for
    // including device ID or user-defined branch information)
    br: { type: 'object' }
  },
  required: ['a', 'd', 'c']
}

class RemovalEvent {
  state = EventState.PENDING
  constructor(sytbl, removals) {
    Object.assign(this, { sytbl, removals })
  }

  toJSON() {
    const order = new BranchOrder()
    return {
      r: this.removals.map(({ start, length, clk }) => ({
        s: start.toMappedOrderJSON(order),
        l: length,
        c: clk.toJSON()
      })),
      o: order.toJSON((br) => {
        const { mxid, branch } = this.sytbl.lookupBySymbol(br)
        if (branch) {
          return [mxid, branch]
        } else {
          return [mxid]
        }
      })
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
          s: MappedLogootPosition,
          l: { type: 'number' },
          c: LogootInt.JSON.Schema
        },
        required: ['s', 'l', 'c']
      }
    },
    o: OrderLookupArray
  },
  required: ['r', 'o']
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
          if (tryMerge(event, this.event_queue[i])) {
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

  createInsertionEvent(br, pos, body, send) {
    const { left, right, clk } = this.listdoc.insertLocal(pos, body.length)
    const event = new InsertionEvent(this.sytbl, br, body, left, right, clk)

    return this.sendEvent(event, send, (event, into) => {
      if (
        into !== event &&
        into instanceof InsertionEvent &&
        into.state === EventState.PENDING &&
        into.clk.eq(event.clk) &&
        into.br === event.br
      ) {
        if (event.left && event.left.eq(into.end)) {
          debug.info('Merged insertion event to end of other')
          into.body += event.body
          into.right = event.right
          return true
        } else if (event.right && event.right.eq(into.start)) {
          debug.info('Merged insertion event to start of other')
          into.body = event.body + into.body
          into.left = event.left
          return true
        }
      }
      return false
    })
  }
  createRemovalEvent(pos, len, send) {
    const removals = this.listdoc.removeLocal(pos, len)
    // Note: Technically, I shouldn't grab the lamport clock out of the list doc
    // like this, but this retains compatibility with older versions
    const event = new RemovalEvent(this.sytbl, removals)

    return this.sendEvent(event, send, (event, into) => {
      if (
        into !== event &&
        into instanceof RemovalEvent &&
        into.state === EventState.PENDING
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

      const { a, d, c } = content
      onNewBranch(this.sytbl, this.listdoc.branch_order, sender)
      const br = this.sytbl.lookupById(sender)
      body = d.join('')

      const order = BranchOrder.fromJSON(a.o, ([mxid, branch]) => {
        onNewBranch(this.sytbl, this.listdoc.branch_order, mxid, branch)
        return this.sytbl.lookupById(mxid, branch)
      })
      const convertPosition = (array = []) => {
        if (!array.length) {
          return undefined
        }
        return LogootPosition.fromIntsBranches(
          this.listdoc.branch_order,
          ...array.map(([int, branchid]) => {
            return [LogootInt.fromJSON(int), order.b(branchid)]
          })
        )
      }

      operations.push(
        ...this.listdoc.insertLogoot(
          br,
          convertPosition(a.l),
          convertPosition(a.r),
          body.length,
          LogootInt.fromJSON(c)
        )
      )
    } else if (type === remove_event) {
      if (!validate(content, RemovalEvent.JSON.Schema).valid) {
        debug.warn(`Event ${id} schema is not valid`)
        return
      }

      const { r, o } = content
      const order = BranchOrder.fromJSON(o, ([mxid, branch]) => {
        onNewBranch(this.sytbl, this.listdoc.branch_order, mxid, branch)
        return this.sytbl.lookupById(mxid, branch)
      })
      const convertPosition = (array = []) => {
        if (!array.length) {
          return undefined
        }
        return LogootPosition.fromIntsBranches(
          this.listdoc.branch_order,
          ...array.map(([int, branchid]) => {
            return [LogootInt.fromJSON(int), order.b(branchid)]
          })
        )
      }

      r.forEach(({ s, l, c }) => {
        operations.push(
          ...this.listdoc.removeLogoot(
            convertPosition(s),
            l,
            LogootInt.fromJSON(c)
          )
        )
      })
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
            matrix_typed_state,
            insert_event,
            remove_event
          ]
        },
        state: {
          types: [
            'm.room.create',
            'm.room.name',
            'm.room.topic',
            'm.room.avatar',
            'm.room.aliases',
            matrix_typed_state
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
      store.commit(
        'matrix/updateRooms',
        client.getRooms().filter((room) => {
          const state = room.getLiveTimeline().getState('f')
          const event = state.getStateEvents(matrix_typed_state, '')
          return (
            event &&
            event.event &&
            event.event.content &&
            event.event.content.type &&
            event.event.content.type === plaintext
          )
        })
      )
    }

    client.on('Room', updateRooms)
    client.on('Room.name', updateRooms)
    client.on('RoomState.events', updateRooms)
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
    doc.br_order = new BranchOrder()
    // The actual algo (also, look up our current user and store a symbol)
    doc.ldm = new ListDocumentModel(doc.br_order)
    doc.ldm.opts.disable_conflicts = true
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
      onNewBranch(doc.sytbl, doc.br_order, globals.client.getUserId())
      doc.event_layer.createInsertionEvent(
        doc.sytbl.lookupById(globals.client.getUserId()),
        pos,
        body,
        (ev) => sendEvent(ev, insert_event)
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
        if (doc.self_test) {
          doc.ldm.selfTest()
        }
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

    doc.setupLogging = (self_test = false) => {
      throw new Error('Logging not yet implemented')
      // doc.ldm.debug_logger = new ListDocumentModel.JsonableLogger()
      // doc.self_test = self_test
    }
    doc.printEventLogJSON = () => {
      // eslint-disable-next-line
      console.log(JSON.stringify(doc.ldm.debug_logger))
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
