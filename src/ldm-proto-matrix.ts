import * as ldm from '@anchor-logoot/listdocumentmodel';

import * as widget from 'matrix-widget-api';

import { validate } from 'jsonschema';

const ANCHORLOGOOT_BASE = 'net.kb1rd.anchorlogoot0';
const ANCHORLOGOOT_EVENT = `${ANCHORLOGOOT_BASE}.*`;
const ANCHORLOGOOT_INS = `${ANCHORLOGOOT_BASE}.ins`;
const ANCHORLOGOOT_REM = `${ANCHORLOGOOT_BASE}.rem`;

type BranchType = { mxid: string; branch?: string };

/**
 * A mapping of MXIDs and custom-branches (NYI) to symbols for the algo
 */
class MatrixSymbolTable {
  mxid_table: { [key: string]: symbol } = {};
  br_mxid_table: { [key: string]: { [key: string]: symbol } } = {};
  // The keys should be a symbol, but that isn't supported yet
  symbol_table: { [key: string]: BranchType } = {};

  lookupById(mxid: string, branch?: string): symbol {
    if (branch) {
      if (!this.br_mxid_table[branch]) {
        this.br_mxid_table[branch] = {};
      }
      if (!this.br_mxid_table[branch][mxid]) {
        this.br_mxid_table[branch][mxid] = Symbol(`BRANCH/${branch}/${mxid}`);
        this.symbol_table[
          this.br_mxid_table[branch][mxid] as unknown as string
        ] = { mxid, branch };
      }
      return this.br_mxid_table[branch][mxid];
    }
    if (!this.mxid_table[mxid]) {
      this.mxid_table[mxid] = Symbol(`BRANCH/${mxid}`);
      this.symbol_table[
        this.mxid_table[mxid] as unknown as string
      ] = { mxid };
    }
    return this.mxid_table[mxid];
  }

  lookupBySymbol(symbol: symbol): BranchType {
    return this.symbol_table[symbol as unknown as string];
  }
}

/**
 * This ensures that the branch order has this particular branch in the correct
 * order on all copies of the document.
 */
const onNewBranch = (
  sytbl: MatrixSymbolTable,
  order: ldm.BranchOrder<symbol>,
  mxid: string,
  branch?: string,
): symbol => {
  const symbol = sytbl.lookupById(mxid, branch);
  if (order.order.includes(symbol)) {
    return symbol;
  }

  const mxidBranchOrderFunc = (a: BranchType, b: BranchType) => {
    if (a.branch === b.branch) {
      if (a.mxid > b.mxid) {
        return -1;
      }
      if (a.mxid < b.mxid) {
        return 1;
      }
      return 0;
    }
    if (!a.branch) {
      return 1;
    }
    if (!b.branch) {
      return -1;
    }
    if (a.branch > b.branch) {
      return 1;
    }
    return -1;
  };

  order.insertOrdered(symbol, (a, b) => mxidBranchOrderFunc(
    sytbl.lookupBySymbol(a),
    sytbl.lookupBySymbol(b),
  ));
  return symbol;
};

enum EventState {
  PENDING,
  SENDING,
  COMPLETE,
  CANCELLED,
}

type OrderLookupArray = ([string] | [string, string])[];
namespace OrderLookupArray {
  export const Schema = {
    type: 'array',
    items: {
      type: 'array',
      // Future space for user-defined conflict branches
      items: [{ type: 'string' }],
    },
  };
}
type MappedLogootPosition = ([ldm.LogootInt.JSON, number])[];
namespace MappedLogootPosition {
  export const Schema = {
    type: 'array',
    minLength: 1,
    items: {
      type: 'array',
      items: [ldm.LogootInt.JSON.Schema, { type: 'number' }],
    },
  };
}

interface MatrixEvent {
  readonly type: string;
  state: EventState;
  toJSON(): {};
}

class InsertionEvent implements MatrixEvent {
  public readonly type = ANCHORLOGOOT_INS;
  public state = EventState.PENDING
  public readonly start: ldm.LogootPosition;
  public readonly end: ldm.LogootPosition;
  constructor(
    public sytbl: MatrixSymbolTable,
    public br: symbol,
    public body: string,
    public clk: ldm.LogootInt,
    public left?: ldm.LogootPosition,
    public right?: ldm.LogootPosition,
  ) {
    this.start = new ldm.LogootPosition(br, body.length, left, right);
    this.end = this.start.offsetLowest(body.length);
  }

  get length() {
    return this.body.length;
  }

  toJSON() {
    const order = new ldm.BranchOrder<symbol>();
    return {
      a: {
        v: 0,
        l: this.left?.toMappedOrderJSON(order),
        r: this.right?.toMappedOrderJSON(order),
        o: order.toJSON((br: ldm.BranchKey) => {
          const { mxid, branch } = this.sytbl.lookupBySymbol(br as symbol);
          return branch ? [mxid, branch] : [mxid];
        }),
      },
      // See the schema for why this is an array
      d: [this.body],
      c: this.clk.toJSON(),
    };
  }
}
namespace InsertionEvent {
  export interface JSON {
    a: {
      v: number;
      l?: MappedLogootPosition;
      r?: MappedLogootPosition;
      o: OrderLookupArray;
    };
    d: string[];
    c: ldm.LogootInt.JSON;
  }
  export namespace JSON {
    export const Schema = {
      type: 'object',
      properties: {
        // Anchors
        a: {
          type: 'object',
          properties: {
            // Version for start resolution. Currently 0
            v: { type: 'number' },
            // Left anchor
            l: MappedLogootPosition.Schema,
            // Right anchor
            r: MappedLogootPosition.Schema,
            // Order lookup. Entries in the positions are mapped to branches here.
            o: OrderLookupArray.Schema,
          },
          required: ['v', 'o'],
        },
        // Data, in this case an array of strings
        // The strings are `join`ed. This is rich text future proofing.
        d: { type: 'array', items: { type: 'string' } },
        // Lamport clock
        c: ldm.LogootInt.JSON.Schema,
      },
      required: ['a', 'd', 'c'],
    };
  }
}

class RemovalEvent implements MatrixEvent {
  public readonly type = ANCHORLOGOOT_REM
  state = EventState.PENDING

  constructor(
    public sytbl: MatrixSymbolTable,
    public removals: ldm.Removal[],
  ) {}

  toJSON() {
    const order = new ldm.BranchOrder<symbol>();
    return {
      r: this.removals.map(({ start, length, clk }) => ({
        s: start.toMappedOrderJSON(order),
        l: length,
        c: clk.toJSON(),
      })),
      o: order.toJSON((br: ldm.BranchKey) => {
        const { mxid, branch } = this.sytbl.lookupBySymbol(br as symbol);
        if (branch) {
          return [mxid, branch];
        }
        return [mxid];
      }),
    };
  }
}
namespace RemovalEvent {
  export interface JSON {
    r: { s: MappedLogootPosition; l: number; c: ldm.LogootInt.JSON }[];
    o: OrderLookupArray;
  }
  export namespace JSON {
    export const Schema = {
      type: 'object',
      properties: {
        r: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              s: MappedLogootPosition.Schema,
              l: { type: 'number' },
              c: ldm.LogootInt.JSON.Schema,
            },
            required: ['s', 'l', 'c'],
          },
        },
        o: OrderLookupArray.Schema,
      },
      required: ['r', 'o'],
    };
  }
}

type SendFunc = (e: MatrixEvent) => Promise<number>;
type MergeFunc = (event: MatrixEvent, into: MatrixEvent) => boolean;

const removalMergeFunc: MergeFunc = (event, into) => {
  if (
    into !== event
    && into instanceof RemovalEvent
    && event instanceof RemovalEvent
    && into.state === EventState.PENDING
  ) {
    // debug.info('Merged removal events')
    (into as RemovalEvent).removals.push(...(event as RemovalEvent).removals);
    return true;
  }
  return false;
};

const insertionMergeFunc: MergeFunc = (event, into) => {
  if (
    into !== event
    && into instanceof InsertionEvent
    && event instanceof InsertionEvent
    && into.state === EventState.PENDING
    && into.clk.eq(event.clk)
    && into.br === event.br
  ) {
    if (event.left && event.left.eq(into.end)) {
      // debug.info('Merged insertion event to end of other');
      into.body += event.body;
      into.right = event.right;
      return true;
    }
    if (event.right && event.right.eq(into.start)) {
      // debug.info('Merged insertion event to start of other');
      into.body = event.body + into.body;
      into.left = event.left;
      return true;
    }
  }
  return false;
};

type RemovalOperation = {
  type: 'r';
  start: number;
  length: number;
}
type InsertionOperation = {
  type: 'i';
  start: number;
  body: string;
}
type MarkOperation = {
  type: 'm';
  start: number;
  length: number;
  conflicting: boolean;
}
/**
 * This just changes the InsertionOperation to have a string body parameter
 */
type AnnotatedOperation = RemovalOperation | InsertionOperation | MarkOperation

/**
 * Handles all event-defined behavior. This is the MITM that acts as the front
 * end for the algorithm. No other code calls functions on the algo.
 */
class EventAbstractionLayer {
  event_queue: MatrixEvent[] = []

  constructor(
    public send: SendFunc,
    public listdoc: ldm.ListDocumentModel = new ldm.ListDocumentModel(),
    public sytbl = new MatrixSymbolTable(),
  ) {}

  async sendEvent(event: MatrixEvent, tryMerge: MergeFunc): Promise<void> {
    this.event_queue.push(event);

    const preExitCleanup = () => {
      event.state = EventState.COMPLETE;
      this.event_queue.splice(this.event_queue.indexOf(event), 1);
    };

    try {
      let delay = 0;
      event.state = EventState.SENDING;

      // Wait to send event
      // eslint-disable-next-line no-await-in-loop
      while ((delay = await this.send(event)) !== 0) {
        event.state = EventState.PENDING;

        for (let i = 0; i < this.event_queue.length; i += 1) {
          if (tryMerge(event, this.event_queue[i])) {
            return;
          }
        }

        // If there's a timeout to send, wait for that to elapse
        // eslint-disable-next-line no-await-in-loop, no-loop-func
        await new Promise((resolve) => setTimeout(resolve, delay));
        event.state = EventState.SENDING;
      }
    } finally {
      preExitCleanup();
    }
  }

  createInsertionEvent(br: BranchType, pos: number, body: string): Promise<void> {
    const { left, right, clk } = this.listdoc.insertLocal(pos, body.length);
    // TODO: Remove typecasts
    return this.sendEvent(
      new InsertionEvent(
        this.sytbl,
        onNewBranch(
          this.sytbl,
          this.listdoc.branch_order as ldm.BranchOrder<symbol>,
          br.mxid,
          br.branch,
        ),
        body,
        clk,
        left,
        right,
      ),
      insertionMergeFunc,
    );
  }
  createRemovalEvent(pos: number, len: number): Promise<void> {
    return this.sendEvent(
      new RemovalEvent(this.sytbl, this.listdoc.removeLocal(pos, len)),
      removalMergeFunc,
    );
  }

  processEvent({ type, content, sender }: widget.IRoomEvent): AnnotatedOperation[] {
    const operations: (ldm.Operation)[] = [];
    let body: string | undefined;
    if (type === ANCHORLOGOOT_INS) {
      if (!validate(content, InsertionEvent.JSON.Schema).valid) {
        // debug.warn(`Event ${id} schema is not valid`)
        throw new Error('Event schema invalid');
      }

      const { a, d, c } = content as InsertionEvent.JSON;
      // TODO: Remove typecasts
      onNewBranch(this.sytbl, this.listdoc.branch_order as ldm.BranchOrder<symbol>, sender);
      const br = this.sytbl.lookupById(sender);
      // We're only working with strings right now
      body = d.join('');

      // TODO: Remove typecasts
      const order = ldm.BranchOrder.fromJSON(a.o, ([mxid, branch]) => {
        // TODO: Remove typecasts
        onNewBranch(this.sytbl, this.listdoc.branch_order as ldm.BranchOrder<symbol>, mxid, branch);
        return this.sytbl.lookupById(mxid, branch);
      }) as ldm.BranchOrder<symbol>;
      const convertPosition = (array: number[][] = []): ldm.LogootPosition | undefined => {
        if (!array.length) {
          return undefined;
        }
        return ldm.LogootPosition.fromIntsBranches(
          this.listdoc.branch_order,
          ...array.map(([int, branchid]): [number, symbol] => [int, order.b(branchid)]),
        );
      };

      operations.push(
        ...this.listdoc.insertLogoot(
          br,
          // TODO: Remove typecasts
          (a.l && convertPosition(a.l)) as ldm.LogootPosition,
          (a.r && convertPosition(a.r)) as ldm.LogootPosition,
          body.length,
          ldm.LogootInt.fromJSON(c),
        ),
      );
    } else if (type === ANCHORLOGOOT_REM) {
      if (!validate(content, RemovalEvent.JSON.Schema).valid) {
        // debug.warn(`Event ${id} schema is not valid`);
        throw new Error('Event schema invalid');
      }

      const { r, o } = content as RemovalEvent.JSON;
      const order = ldm.BranchOrder.fromJSON(o, ([mxid, branch]) => {
        // TODO: Remove typecasts
        onNewBranch(this.sytbl, this.listdoc.branch_order as ldm.BranchOrder<symbol>, mxid, branch);
        return this.sytbl.lookupById(mxid, branch);
      });
      const convertPosition = (array: number[][] = []): ldm.LogootPosition | undefined => {
        if (!array.length) {
          return undefined;
        }
        return ldm.LogootPosition.fromIntsBranches(
          this.listdoc.branch_order,
          ...array.map(([int, branchid]): [number, symbol] => [int, order.b(branchid) as symbol]),
        );
      };

      r.forEach(({ s, l, c }) => operations.push(
        ...this.listdoc.removeLogoot(
          // The schema validation ensures this will always be true
          convertPosition(s) as ldm.LogootPosition,
          l,
          ldm.LogootInt.fromJSON(c),
        ),
      ));
    }

    if (operations.length) {
      // Fill in the text based on the offset and length returned by the algo
      operations.forEach((op) => {
        if (op.type === 'i') {
          if (!body) {
            throw new Error(
              'Algorithm returned insertion operation, but an insertion was not performed.',
            );
          }
          // TODO: Fix type weirdness
          (op as unknown as { body: string }).body = body.slice(op.offset, op.offset + op.length);
          delete op.offset;
          delete op.length;
        }
      });
    }
    return operations as AnnotatedOperation[];
  }
}

export {
  EventAbstractionLayer, MatrixSymbolTable, onNewBranch, ANCHORLOGOOT_BASE,
  ANCHORLOGOOT_EVENT, ANCHORLOGOOT_INS, ANCHORLOGOOT_REM,
};
