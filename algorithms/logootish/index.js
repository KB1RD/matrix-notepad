import { Enum, arraymap, FatalError } from './utils'
import { Int32 } from './ints'
import { Bst } from './bst'

import { debug } from '@/plugins/debug'

// What a C++ typedef would do
// This makes it possible to completely swap out the type of the int used in the
// algorithm w/o actually replacing each instance (which would be a real pain)
const LogootInt = Int32

class LogootPosition {
  array = [new LogootInt(0)]

  constructor(len, start, end) {
    if (!start && end && end.array[0]) {
      Object.assign(this, end.inverseOffsetLowest(len))
    } else if (!end && start && start.array[0]) {
      // Sleazy array copy
      this.array = start.array.slice(0)
    } else if (start && end) {
      let done = false
      const newarray = []
      const itstart = start.array.values()
      const itend = end.array.values()
      let nstart
      let nend

      while (!done) {
        if (!nstart || !nstart.done) {
          nstart = itstart.next()
        }
        if (!nend || !nend.done) {
          nend = itend.next()
        }

        if (!nstart.done && !nend.done) {
          // See if we have enough space to insert 'len' between the nodes
          if (nend.value.gteq(new LogootInt(nstart.value).add(len))) {
            // There's space. We're done now: At the shallowest possible level
            done = true
          }
          // Regardless, the start ID is the new ID for this level of our node
          newarray.push(new LogootInt(nstart.value))
        } else if (!nstart.done) {
          // So there's no end restriction, that means we can just add right on
          // top of the old end (the start of the new node)
          newarray.push(new LogootInt(nstart.value))
          done = true
        } else if (!nend.done) {
          // We have an end restriction, but no start restriction, so we just
          // put the new node's start behind the old end
          newarray.push(new LogootInt(nend.value).sub(len))
          done = true
        } else {
          // So both other IDs have nothing else. It must be time to make a new
          // level and be done
          newarray.push(new LogootInt(0))
          done = true
        }
      }

      this.array = newarray
    }
  }

  get levels() {
    // A zero-length position is NOT valid
    // Through some sneakyness, you COULD directly assign the array to make it
    // have a length of zero. Don't do it.
    return this.array.length - 1
  }
  level(n) {
    return this.array[n]
  }

  fromEvent(eventnode) {
    this.array = []
    const self = this
    eventnode.forEach((n) => {
      self.array.push(new LogootInt(n))
    })
    return this
  }

  offsetLowest(offset) {
    return Object.assign(new LogootPosition(0, undefined, undefined), {
      array: this.array.map((current, i, array) => {
        return i < array.length - 1
          ? current
          : new LogootInt(current).add(offset)
      })
    })
  }
  inverseOffsetLowest(offset) {
    return Object.assign(new LogootPosition(0, undefined, undefined), {
      array: this.array.map((current, i, array) => {
        return i < array.length - 1
          ? current
          : new LogootInt(current).sub(offset)
      })
    })
  }

  equivalentPositionAtLevel(level) {
    return Object.assign(new LogootPosition(0, undefined, undefined), {
      array: new Array(level + 1).fill(0, 0, level + 1).map((el, i) => {
        return new LogootInt(this.array[i])
      })
    })
  }

  cmp(pos, level = 0) {
    if (level >= this.array.length) {
      if (this.array.length === pos.array.length) {
        return 0
      }
      return 1
    }
    if (level >= pos.array.length) {
      return -1
    }
    switch (this.array[level].cmp(pos.array[level])) {
      case 1:
        return 1
      case -1:
        return -1
      case 0:
        return this.cmp(pos, level + 1)
      default:
        return 0
    }
  }

  clamp(min, max) {
    return this.cmp(min) < 0 ? min : this.cmp(max) > 0 ? max : this
  }

  toJSON() {
    return this.array
  }

  toString() {
    let str = '['
    this.array.forEach((el, i, a) => {
      str += el.toString() + (i >= a.length - 1 ? '' : ',')
    })
    str += ']'
    return str
  }
}

class LogootNode {
  known_position = 0
  length = 0
  start = new LogootPosition()
  rclk = new LogootInt(0)

  constructor(node) {
    if (node) {
      Object.assign(this, {
        known_position: node.known_position,
        length: node.length,
        start: node.start.offsetLowest(new LogootInt(0)),
        rclk: new LogootInt(node.rclk)
      })
    }
  }

  get end() {
    return this.start.offsetLowest(this.length)
  }

  toString() {
    return (
      this.start.toString() +
      (typeof this.known_position === 'number'
        ? '(' + this.known_position + ')'
        : '') +
      ` + ${this.length} @ ${this.rclk}`
    )
  }
}

const EventState = new Enum('PENDING', 'SENDING', 'COMPLETE')
const EventType = new Enum('INSERTATION', 'REMOVAL')

class InsertationEvent {
  type = EventType.INSERTATION
  body = ''
  start = undefined
  known_position = undefined
  rclk = 0

  // Previous & next insertation event
  last = undefined
  next = undefined

  state = EventState.PENDING

  constructor(body, left, right, rclk = 0, known_position = undefined) {
    Object.assign(this, {
      body,
      known_position,
      state: EventState.PENDING,
      start: new LogootPosition(body.length, left, right),
      rclk
    })
  }

  get length() {
    return this.body.length
  }
  get end() {
    return this.start.offsetLowest(this.length)
  }
  get node() {
    const node = new LogootNode()
    Object.assign(node, {
      start: this.start,
      length: this.length,
      known_position: this.known_position,
      rclk: this.rclk
    })
    return node
  }

  toJSON() {
    return { body: this.body, start: this.start, rclk: this.rclk }
  }
}

class RemovalEvent {
  type = EventType.REMOVAL
  removals = []

  state = EventState.PENDING

  constructor(removals, rclk) {
    this.removals = removals
    this.rclk = rclk
  }

  toJSON() {
    return { removals: this.removals, rclk: this.rclk }
  }
}

class Document {
  // The BST maps out where all insertation nodes are in the local document's
  // memory. It is used to go from position -> node
  ldoc_bst = new Bst((a, b) => a.known_position - b.known_position)
  // This BST maps Logoot position identifiers to their text node to allow
  // lookup of text position from Logoot ID
  logoot_bst = new Bst((a, b) => a.start.cmp(b.start))
  // A map of removals that do not yet have text to remove
  removal_bst = new Bst((a, b) => a.start.cmp(b.start))
  // Events that need to get sent over Matrix
  pending_events = []
  // See the Logoot paper for why. Unlike the Logoot implementation, this is
  // incremented with each deletion only.
  vector_clock = new LogootInt(0)

  last_insertation_event = undefined

  constructor(send, insertLocal, removeLocal) {
    this.send = send
    this.insertLocal = insertLocal
    this.removeLocal = removeLocal
  }

  start() {
    return new Promise((resolve) => resolve())
  }

  _removePendingEvent(event) {
    const index = this.pending_events.indexOf(event)
    if (index >= 0) {
      this.pending_events.splice(index, 1)
      return true
    }
    return false
  }
  _tryMergeEvents(event) {
    if (event.state !== EventState.PENDING) {
      return false
    }
    // TODO: Maybe do a tree lookup instead. But this is complicated since then
    // each node has to store its associated event
    if (event.last && event.last.state === EventState.PENDING) {
      let oldevent = event
      while (oldevent.last && oldevent.last.state === EventState.PENDING) {
        oldevent.last.body += oldevent.body

        oldevent.last.next = oldevent.next
        if (oldevent.next) {
          oldevent.next.last = oldevent.last
        }

        this._removePendingEvent(oldevent)

        if (this.last_insertation_event === oldevent) {
          this.last_insertation_event = oldevent.last
        }
        oldevent = oldevent.last
      }
      // Now try the other direction...
      this._tryMergeEvents(oldevent)
      return true
    } else if (event.next && event.next.state === EventState.PENDING) {
      let oldevent = event
      while (oldevent.next && oldevent.next.state === EventState.PENDING) {
        oldevent.next.body = oldevent.body + oldevent.next.body
        oldevent.next.start = oldevent.start

        oldevent.next.last = oldevent.last
        if (oldevent.last) {
          oldevent.last.next = oldevent.next
        }

        this._removePendingEvent(oldevent)

        if (this.last_insertation_event === oldevent) {
          this.last_insertation_event = oldevent.next
        }
        oldevent = oldevent.next
      }
      return true
    }
    return false
  }

  _pushEvent(event) {
    this.pending_events.push(event)

    const self = this
    const queue_send = () => {
      event.state = EventState.SENDING
      this.send(event)
        .then(() => {
          this._removePendingEvent(event)
          event.state = EventState.COMPLETE
        })
        .catch((e) => {
          event.state = EventState.PENDING
          // TODO: Nothing is here *should* be Matrix specific
          if (e && e.data && e.data.retry_after_ms) {
            if (
              event.type === EventType.INSERTATION &&
              self._tryMergeEvents(event)
            ) {
              console.warn(
                `Hitting the rate limit: Will resend in ${e.data.retry_after_ms} ms with multiple messages merged together`
              )
              return {}
            }
            console.warn(
              `Hitting the rate limit: Will resend in ${e.data.retry_after_ms} ms`
            )
            setTimeout(queue_send, e.data.retry_after_ms)
          } else {
            console.error('Error sending event', e)
            return e
          }
        })
    }
    queue_send()
  }

  insert(position, text) {
    debug.log('INSERT', position, text)

    // The position must be -1 for lesser because it can't count the text node
    // currently in the insertation position (we're between two nodes)
    let lesser = this.ldoc_bst.getLteq({ known_position: position - 1 })
    let greater = this.ldoc_bst.getGteq({ known_position: position })

    // Nodes are not allowed to have the same position
    if (lesser.length > 1 || greater.length > 1) {
      throw new FatalError(
        'Corrupt BST. There are multiple nodes at a position.'
      )
    } else {
      lesser = lesser[0]
      greater = greater[0]
    }

    // TODO: Locate neighboring nodes that are still in the PENDING state and
    // add the text to them instead of sending a whole new event

    // Finally, we can create positions...
    let left_position
    let right_position

    if (lesser) {
      left_position = lesser.data.end
    }
    if (greater) {
      right_position = greater.data.start
    }

    if (lesser && lesser.data.length + lesser.data.known_position > position) {
      // This means that we're right inside another node, so the next position
      // will be inside the first node
      left_position = lesser.data.start.offsetLowest(
        position - lesser.data.known_position
      )
      right_position = left_position

      // Now, we must split the node in half (nodes can't overlap)
      const node = new LogootNode()
      node.length = lesser.data.known_position + lesser.data.length - position
      node.known_position = position + length
      node.start = right_position.offsetLowest(length)
      node.rclk = lesser.data.rclk
      this.ldoc_bst.add(node)
      this.logoot_bst.add(node)
    }

    const event = new InsertationEvent(
      text,
      left_position,
      right_position,
      this.vector_clock,
      position
    )

    // Now, make a space between the nodes
    this.ldoc_bst.operateOnAllGteq({ known_position: position }, (n) => {
      n.data.known_position += event.length
    })

    const node = event.node
    this.ldoc_bst.add(node)
    this.logoot_bst.add(node)

    // Logic to help merge events together. It is VERY rough and will really
    // only work when events are consecutive, but its better than spamming the
    // HS and having text go letter by letter when we hit the rate limit
    if (
      this.last_insertation_event &&
      event.start.cmp(this.last_insertation_event.end) === 0
    ) {
      event.last = this.last_insertation_event
      this.last_insertation_event.next = event
    }
    if (this._tryMergeEvents(event)) {
      return
    }
    this._pushEvent(event)
    this.last_insertation_event = event
  }

  remove(position, length) {
    debug.log('REMOVE', position, length)

    // First, find any nodes that MAY have content removed from them
    const nodes = this.ldoc_bst
      .getRange(
        { known_position: position },
        { known_position: position + length - 1 }
      )
      .concat(this.ldoc_bst.getLteq({ known_position: position - 1 }))

    const removals = []
    let last_end
    nodes.forEach(({ data }) => {
      let newlen = data.length
      let newstart = data.start
      if (data.known_position < position) {
        newlen -= position - data.known_position
        newstart = newstart.offsetLowest(position - data.known_position)
      }
      if (data.known_position + data.length > position + length) {
        newlen -= data.known_position + data.length - (position + length)
      }

      if (last_end && last_end.cmp(data.start) === 0) {
        removals[removals.length - 1].length += newlen
      } else if (newlen > 0) {
        removals.push({
          start: newstart,
          length: newlen
        })
      }

      last_end = data.end
      data.length -= newlen
      if (data.length <= 0) {
        this.logoot_bst.remove(data)
        this.ldoc_bst.remove(data)
      }
    })

    this.ldoc_bst.operateOnAllGteq({ known_position: position }, (n) => {
      n.data.known_position -= length
    })

    const event = new RemovalEvent(removals, new LogootInt(this.vector_clock))
    this.vector_clock.add(1)

    this._pushEvent(event)
  }

  _constructSkipRanges(bst, start, end, lesser, copy = false) {
    // These ranges are areas of the document that are already populated in the
    // region where the insert is happening. If there are conflicts, they will
    // be skipped. The end of this new insert must be added to the end as a fake
    // zero-length node so that the for each loop triggers for the end.
    const skip_ranges = bst
      .getRange({ start }, { start: end })
      // Make sure we COPY all nodes
      .map((n) => (copy ? new LogootNode(n.data) : n.data))
      .sort((a, b) => a.start.cmp(b.start))

    if (!lesser) {
      lesser = bst.getLteq({ start })
      if (lesser.length > 1) {
        throw new FatalError(
          'Corrupt BST. There are multiple nodes at a position.'
        )
      } else {
        lesser = lesser[0]
      }
    }
    if (lesser && !skip_ranges.includes(lesser)) {
      skip_ranges.unshift(lesser)
    }
    // It's fine that position is undefined because that would only impact nodes
    // AFTER this one
    skip_ranges.push({ start: end, end, length: 0 })
    return skip_ranges
  }

  _mergeNode(bst, nstart, length, resolveConflict, addNode, informRemoval) {
    const level = nstart.levels
    const nend = nstart.offsetLowest(length)

    // Find a node BEFORE this Logoot position as a real text position marker
    let lesser = bst.getLteq({ start: nstart })
    if (lesser.length > 1) {
      throw new FatalError(
        'Corrupt BST. There are multiple nodes at a position.'
      )
    } else {
      lesser = lesser[0] ? lesser[0].data : undefined
    }

    // These ranges are areas of the document that are already populated in the
    // region where the insert is happening. If there are conflicts, they will
    // be skipped. The end of this new insert must be added to the end as a fake
    // zero-length node so that the for each loop triggers for the end.
    let skip_ranges = this._constructSkipRanges(bst, nstart, nend, lesser)

    skip_ranges = skip_ranges.filter((n) => {
      if (n.length && n.start.levels === level) {
        const clip_nstart = nstart.cmp(n.start) > 0
        const clip_nend = nend.cmp(n.end) < 0
        const start = clip_nstart ? nstart : n.start
        const end = clip_nend ? nend : n.end
        if (start.cmp(end) === 0) {
          return true
        }
        const conflict = {
          start,
          end,
          clip_nstart,
          clip_nend,
          whole_node: !(clip_nstart || clip_nend),
          level
        }

        // Get the externally defined result for this conflict
        const result = resolveConflict(n, conflict, lesser, bst)

        // Actually remove the node or part of it if it looses
        if (result < 1) {
          if (result < 0) {
            // Shortcut to remove the whole node
            if (conflict.whole_node) {
              informRemoval(n, n.known_position, n.length, true)
              n.length = 0
            } else {
              // Ok, now we have to find out how much of the node is hanging out
              // on either side of the removal
              if (clip_nstart) {
                const l = new LogootInt(n.start.level(level)).sub(
                  end.level(level)
                ).js_int
                n.length -= l

                informRemoval(n, n.known_position + (n.length - l), l, false)
              }
              if (clip_nend) {
                n.start = end
                const l = new LogootInt(n.end.level(level)).sub(
                  start.level(level)
                ).js_int
                n.length -= l

                informRemoval(n, n.known_position, l, false)
                n.known_position += l
              }
            }
          }
          return false
        }
      }
      return true
    })

    let known_start = 0
    if (lesser) {
      const positions = [lesser.length]
      // Find where we are inside lesser. If we're outside of lesser, this will
      // be greater than lesser's length and will be ignored
      if (lesser.start.levels < nstart.levels) {
        positions.push(
          new LogootInt(nstart.level(lesser.start.levels)).sub(
            lesser.start.level(lesser.start.levels)
          ).js_int
        )
      }

      // Figure out which endpoint to use, the end of lesser or where our
      // position is if its inside lesser
      const lesser_pos = Math.min(...positions)
      known_start = lesser.known_position + lesser_pos

      // Split lesser in two if necessary
      if (lesser.length - lesser_pos) {
        const node = new LogootNode(lesser)
        node.start = node.start.offsetLowest(lesser_pos)
        node.length -= lesser_pos
        node.known_position += lesser_pos
        addNode(node)

        lesser.length = lesser_pos
      }
    }

    const newnodes = []
    // We fake the last node end to be the start of the new node because the
    // inserted text always needs to 'snap' to the end of the last node,
    // regardless of discontinuities in Logoot positions
    let last_end = nstart
    let last_known_position = known_start
    skip_ranges.forEach((skip_range) => {
      const { start, end } = skip_range
      // Clamped regions to consider. Anything outside of the node to be
      // inserted doesn't matter, so we clamp it out
      // Of course, that means we have to recalculate EVERYTHING *sigh*
      const cstart = start.clamp(
        nstart.equivalentPositionAtLevel(start.levels),
        nend.equivalentPositionAtLevel(start.levels)
      )
      const cend = end.clamp(
        nstart.equivalentPositionAtLevel(end.levels),
        nend.equivalentPositionAtLevel(end.levels)
      )
      const clevel = cstart.levels
      const clength = new LogootInt(cend.level(clevel)).sub(
        cstart.level(clevel)
      ).js_int

      const node = new LogootNode()
      // Find the new node length by finding the distance between the last end
      // and the next one
      const _length = new LogootInt(cstart.level(level)).sub(
        last_end.level(level)
      )
      node.length = _length.js_int

      if (node.length <= 0) {
        last_end = cend
        if (skip_range !== lesser) {
          last_known_position += clength
        }
        return
      }

      // Now, find the offset in our body string
      const offset = new LogootInt(last_end.level(level)).sub(
        nstart.level(level)
      ).js_int
      node.start = nstart.offsetLowest(offset)
      node.known_position = last_known_position
      node._offset = offset

      newnodes.push(node)

      last_end = cend
      last_known_position += node.length
      if (skip_range !== lesser) {
        last_known_position += clength
      }
    })
    return newnodes
  }

  remoteInsert(event_contents) {
    // TODO: Evaluate using `jsonschema` package
    const body = event_contents.body
    if (typeof body !== 'string') {
      throw new TypeError('Corrupt insertation event')
    }
    const nstart = new LogootPosition(0).fromEvent(event_contents.start)
    const this_rclk = new LogootInt(event_contents.rclk)
    debug.log('REMOTE INSERT', body, JSON.stringify(nstart))

    if (this_rclk.cmp(this.vector_clock) > 0) {
      this.vector_clock = this_rclk
      debug.log('Fast-forward vector clock to', JSON.stringify(this_rclk))
    }

    const nodes = this._mergeNode(
      this.logoot_bst,
      nstart,
      body.length,
      (node, conflict, lesser) => {
        if (node === lesser && lesser.start.levels < conflict.level) {
          return 0
        }
        if (node.rclk.cmp(this_rclk) < 0) {
          return -1
        }
        if (node.rclk.cmp(this_rclk) === 0) {
          // TODO: Do something about conflicts that cause dropped data here
          // This is HUGE and the editor WILL NOT FUNCTION WITHOUT IT!!!
          // I really don't like the idea of pushing this until after initial
          // release, but oh well.
          // Also, does this even work?
          debug.warn('Dropped conflicting node')
        }
        return 1
      },
      (node) => {
        this.ldoc_bst.add(node)
        this.logoot_bst.add(node)
      },
      (node, pos, length, whole) => {
        if (whole) {
          this.ldoc_bst.remove(node)
          this.logoot_bst.remove(node)
        }
        this.removeLocal(pos, length)
        this.ldoc_bst.operateOnAllGteq({ known_position: pos }, (n) => {
          if (n === node) {
            return
          }
          n.data.known_position -= length
        })
      }
    )

    arraymap(nodes, (node) => {
      let last_known_position = node.known_position
      return this._mergeNode(
        this.removal_bst,
        node.start,
        node.length,
        (node, { start, end, whole_node, clip_nstart, clip_nend, level }) => {
          if (node.rclk.cmp(this_rclk) < 0) {
            return 0
          }
          return 1
        },
        (node) => {},
        (node, pos, length, whole) => {}
      ).map((newnode) => {
        // known_positions in the removal tree are BS, so set them correctly
        // here. TODO: Remove known_position from removals
        newnode.known_position = last_known_position
        newnode._offset += node._offset
        last_known_position += newnode.length
        return newnode
      })
    })

    nodes.forEach((node) => {
      node.rclk = this_rclk
      // Now, make a space between the nodes
      this.ldoc_bst.operateOnAllGteq(node, (n) => {
        if (n === node) {
          return
        }
        n.data.known_position += node.length
      })

      const node_body = body.substr(node._offset, node.length)
      delete node._offset
      this.insertLocal(node.known_position, node_body, {
        position: node.start
      })

      this.ldoc_bst.add(node)
      this.logoot_bst.add(node)
    })
  }

  remoteRemove(event_contents) {
    const rclk = new LogootInt(event_contents.rclk)
    if (rclk.cmp(this.vector_clock) > 0) {
      this.vector_clock = rclk
      debug.log('Fast-forward vector clock to', JSON.stringify(rclk))
    }

    event_contents.removals.forEach((r) => {
      const start = new LogootPosition(0).fromEvent(r.start)
      const end = start.offsetLowest(r.length)
      // The level where our removal is happening (always the lowest)
      const level = start.levels
      debug.log('REMOTE REMOVE', JSON.stringify(start), r.length)

      let nodes = this.logoot_bst
        .getRange({ start }, { start: end })
        .map((n) => n.data)

      let lesser = this.logoot_bst.getLteq({ start })
      if (lesser.length > 1) {
        throw new FatalError(
          'Corrupt BST. There are multiple nodes at a position.'
        )
      } else {
        lesser = lesser[0] ? lesser[0].data : undefined
        if (lesser && lesser.end.cmp(start) > 0) {
          nodes.push(lesser)
        }
      }
      nodes = nodes
        .sort((a, b) => a.start.cmp(b.start))
        .filter((n) => rclk.cmp(n.rclk) > 0)

      // Remove what we can just by clipping out nodes
      nodes.forEach((n) => {
        // The removal is only happening on `level` and others are left alone
        if (n.start.levels !== level) {
          return
        }

        const localstart = n.start.cmp(start) > 0 ? n.start : start
        const localend = n.end.cmp(end) > 0 ? end : n.end
        const length = new LogootInt(localend.level(level)).sub(
          localstart.level(level)
        ).js_int
        const offset = new LogootInt(localstart.level(level)).sub(
          n.start.level(level)
        ).js_int

        if (length <= 0) {
          return
        }

        n.length -= length
        this.removeLocal(n.known_position + offset, length)
        this.ldoc_bst.operateOnAllGteq(
          { known_position: n.known_position + offset },
          (n) => {
            n.data.known_position -= length
          }
        )

        if (n.length <= 0) {
          this.logoot_bst.remove(n)
          this.ldoc_bst.remove(n)
        }
      })

      // This works like skip_ranges in the remoteInsert function above.
      // We must also fill in the gaps of stuff that MIGHT one day be removed so
      // that the addition process will skip that region should an event with
      // a lower vector (removal) clock show up
      // This is probably the mechanism that will be used to remove text most of
      // the time anyway
      nodes.push({ start: end, end })

      // I've gotten lazier and lazier with variable names as this file has
      // gotten longer. I've regressed to single letter variable names
      let last_end = start
      nodes.forEach((n) => {
        const length = new LogootInt(n.end.level(level)).sub(
          last_end.level(level)
        ).js_int
        const nodes = this._mergeNode(
          this.removal_bst,
          last_end,
          length,
          (node, conflict) => {
            if (node.rclk.cmp(rclk) < 0) {
              return -1
            }
            return 1
          },
          (node) => {
            this.removal_bst.add(node)
          },
          (node, pos, length, whole) => {
            if (whole) {
              this.removal_bst.remove(node)
            }
          }
        )

        nodes.forEach((node) => {
          node.rclk = rclk
          delete node._offset

          this.removal_bst.add(node)
        })
        last_end = n.end
      })
    })
  }
}

export { EventType, Document }
