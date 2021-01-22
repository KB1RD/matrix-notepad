<template>
  <MatrixWidget id="widget" ref="widget" :widgetid="widgetid" :capabilities="caps" @event="onEvent">
    <DocumentEditor ref="doc" @insert="sendInsert" @remove="sendRemove" />
  </MatrixWidget>
</template>

<script lang="ts">
import { Component, Vue, Ref } from 'vue-property-decorator';

import {
  EventDirection,
  WidgetEventCapability,
  ISendEventToWidgetActionRequest,
  IRoomEvent,
} from 'matrix-widget-api';

import * as mproto from '../ldm-proto-matrix';

import DocumentEditor from '../components/DocumentEditor.vue';
import MatrixWidget from '../components/MatrixWidget.vue';

function calculateSearchParams(): { [key: string]: string } {
  let { search } = window.location;
  if (search.startsWith('?')) {
    search = search.slice(1);
  }
  const kv_maps = search.split('&').map((s) => s.split('=')).map(([k, v]) => [k, decodeURIComponent(v)]);

  const result: { [key: string]: string } = {};
  kv_maps.forEach(([k, v]) => (result[k] = v));
  return result;
}

const eal_map = new WeakMap<{}, mproto.EventAbstractionLayer>();

@Component({ components: { MatrixWidget, DocumentEditor } })
export default class DefaultWidgetView extends Vue {
  @Ref() readonly widget!: MatrixWidget
  @Ref() readonly doc!: DocumentEditor
  readonly eal_addr = {}

  readonly events_to_ignore: string[] = []

  searchparams?: { [key: string]: string }

  readonly caps = [
    WidgetEventCapability.forRoomEvent(EventDirection.Send, mproto.ANCHORLOGOOT_INS).raw,
    WidgetEventCapability.forRoomEvent(EventDirection.Receive, mproto.ANCHORLOGOOT_INS).raw,
    WidgetEventCapability.forRoomEvent(EventDirection.Send, mproto.ANCHORLOGOOT_REM).raw,
    WidgetEventCapability.forRoomEvent(EventDirection.Receive, mproto.ANCHORLOGOOT_REM).raw,
  ]
  isDarkTheme = false

  created() {
    const eal = new mproto.EventAbstractionLayer(async (event) => {
      if (!this.widget || !this.widget.api) {
        throw new Error('Widget uninitialized');
      }
      try {
        const evdata = event.toJSON();
        this.tryProcessEvent({
          event_id: 'fake_id',
          type: event.type,
          sender: this.mxid as string,
          content: evdata,
          unsigned: {},
          origin_server_ts: 0,
        });
        const { event_id } = await this.widget.api.sendRoomEvent(event.type, evdata);
        this.events_to_ignore.push(event_id);
      } catch (e) {
        // TODO: This doesn't work. What to do?
        if (e && e.data && e.data.retry_after_ms) {
          console.warn(
            `Hitting the rate limit: Will resend in ${e.data.retry_after_ms} ms`,
          );
          return e.data.retry_after_ms;
        }
        console.error('Error sending', e);
      }
      return 0;
    });
    eal.listdoc.opts.disable_conflicts = true;
    eal_map.set(this.eal_addr, eal);

    this.searchparams = { ...calculateSearchParams() };
    Object.keys(this.$route.query).forEach((key) => {
      if (typeof this.$route.query[key] === 'string') {
        (this.searchparams as { [key: string]: string })[key] = this.$route.query[key] as string;
      } else {
        const possible_values = (this.$route.query[key] as (string | null)[]).filter((v) => v);
        if (possible_values.length) {
          (this.searchparams as { [key: string]: string })[key] = possible_values[0] as string;
        }
      }
    });
  }

  get widgetid(): string | undefined {
    return this.searchparams?.widgetId;
  }
  get mxid(): string | undefined {
    return this.searchparams?.mxid;
  }

  get eal(): mproto.EventAbstractionLayer {
    return eal_map.get(this.eal_addr) as mproto.EventAbstractionLayer;
  }

  sendInsert({ pos, body }: { pos: number; body: string }) {
    this.eal.createInsertionEvent({ mxid: this.mxid as string }, pos, body);
  }
  sendRemove({ pos, len }: { pos: number; len: number }) {
    this.eal.createRemovalEvent(pos, len);
  }

  tryProcessEvent(event: IRoomEvent) {
    try {
      const operations = this.eal.processEvent(event);
      operations.forEach((op) => {
        if (op.type === 'i') {
          this.doc.insert(op.start, op.body);
        } else if (op.type === 'r') {
          this.doc.remove(op.start, op.length);
        }
      });
    } catch (e) {
      console.warn(`Failed to process event ${event.event_id}`, e);
    }
  }
  onEvent({ data }: ISendEventToWidgetActionRequest) {
    if (this.events_to_ignore.includes(data.event_id)) {
      this.events_to_ignore.splice(this.events_to_ignore.indexOf(data.event_id as string), 1);
      return;
    }
    this.tryProcessEvent(data);
  }
}
</script>

<style lang="scss">
@import '../../node_modules/codemirror/addon/dialog/dialog.css';
@import '../../node_modules/codemirror/lib/codemirror.css';
@import '../../node_modules/codemirror/theme/solarized.css';

#widget {
  height: 100%;
  overflow: hidden;
}
</style>
