<template>
  <div :class="'widget-' + (isDarkTheme ? 'dark' : 'light')">
    <slot v-if="loaded" />
    <div v-else class="widget-fulltext">
      <p>Waiting for widget host...</p>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Component, Emit, Prop, Vue,
} from 'vue-property-decorator';
import { WidgetApi, ISendEventToWidgetActionRequest } from 'matrix-widget-api';

@Component
export default class MatrixWidget extends Vue {
  loaded = false;
  api?: WidgetApi;

  isDarkTheme = false;

  @Prop(Array) readonly capabilities: string[] | undefined;
  @Prop(String) readonly widgetid: string | undefined;

  beforeMount() {
    this.api = new WidgetApi(this.widgetid);

    // TODO: Await MSC2873
    this.themeChange({ type: 'dark' });

    this.api.requestCapabilities(this.capabilities || []);
    this.api.on('ready', this.ready.bind(this));

    this.api.on('action:send_event', ({ detail }) => {
      this.$emit('event', detail as ISendEventToWidgetActionRequest);
    });

    this.api.start();
    // this.api.sendContentLoaded();
  }

  @Emit('ready')
  ready() {
    this.loaded = true;
  }

  @Emit('themeChange')
  themeChange({ type }: { type: 'light' | 'dark' }) {
    this.isDarkTheme = type === 'dark';
  }
}
</script>

<style scoped>
.widget-fulltext {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.widget-light {
  background-color: white;
  color: black;
}
.widget-dark {
  background-color: black;
  color: white;
}
</style>
