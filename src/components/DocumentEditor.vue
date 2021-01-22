<template>
  <codemirror
    class="cm"
    ref="codemirror"
    :options="opts"
    @ready="$emit('ready')"
    @beforeChange="onNewChanges"
  />
</template>

<script lang="ts">
import Vue from 'vue';
import VueCodemirror from 'vue-codemirror';

// This is just for the types
import CodeMirror from 'codemirror';

import { Component } from 'vue-property-decorator';

import 'codemirror/mode/vue/vue';

import 'codemirror/addon/selection/active-line';

import 'codemirror/addon/search/match-highlighter';

import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/search/search';

Vue.use(VueCodemirror);

@Component
export default class DocumentEditor extends Vue {
  $refs!: {
    codemirror: typeof VueCodemirror;
  }

  opts = {
    tabSize: 4,
    foldGutter: true,
    styleActiveLine: true,
    lineNumbers: true,
    line: true,
    theme: 'solarized dark',
  }

  changes_to_ignore: { [key: number]: number[] } = {}

  insert(pos: number, text: string) {
    const cmdoc = this.$refs.codemirror.codemirror.doc;

    const cmpos = cmdoc.posFromIndex(pos);
    if (!this.changes_to_ignore[cmpos.line]) {
      this.changes_to_ignore[cmpos.line] = [];
    }
    this.changes_to_ignore[cmpos.line].push(cmpos.ch);

    cmdoc.replaceRange(text, cmpos, cmpos);
  }
  remove(pos: number, len: number) {
    const cmdoc = this.$refs.codemirror.codemirror.doc;

    const startpos = cmdoc.posFromIndex(pos);
    const endpos = cmdoc.posFromIndex(pos + len);
    if (!this.changes_to_ignore[startpos.line]) {
      this.changes_to_ignore[startpos.line] = [];
    }
    this.changes_to_ignore[startpos.line].push(startpos.ch);

    cmdoc.replaceRange('', startpos, endpos);
  }

  onNewChanges(cm: CodeMirror.Doc, change: CodeMirror.EditorChangeCancellable) {
    const line_seperator = '\n';
    // TODO: Possible create a custom CM document to fix this BS. That way,
    // text appears as part of the local echo of a Matrix event
    if (
      this.changes_to_ignore[change.from.line]
      && this.changes_to_ignore[change.from.line].includes(change.from.ch)
    ) {
      const array = this.changes_to_ignore[change.from.line];
      array.splice(array.indexOf(change.from.ch), 1);
      if (!this.changes_to_ignore[change.from.line].length) {
        delete this.changes_to_ignore[change.from.line];
      }
      return;
    }

    // Local echos will replay the change
    change.cancel();

    const from = { ...change.from };
    const from_index = cm.indexFromPos(from);
    const to = { ...change.to };
    const to_index = cm.indexFromPos(to);

    // Length of removal
    const removal_length = to_index - from_index;
    // Raw text of the addition
    const addition_raw = change.text.join(line_seperator);

    if (removal_length) {
      this.$emit('remove', { pos: from_index, length: removal_length });
    }
    if (addition_raw.length) {
      this.$emit('insert', { pos: from_index, body: addition_raw });
    }
  }
}
</script>

<style lang="scss">
@import '../../node_modules/codemirror/addon/dialog/dialog.css';
@import '../../node_modules/codemirror/lib/codemirror.css';
@import '../../node_modules/codemirror/theme/solarized.css';

.cm {
  height: 100%;
  overflow: hidden;
}
.cm .CodeMirror {
  height: 100%;
}
</style>
