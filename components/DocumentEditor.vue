<template>
  <a-spin :spinning="loading">
    <a-icon slot="indicator" type="loading" style="font-size: 48px" spin />

    <a-card>
      <!-- <template slot="actions" class="ant-card-actions">
        <a-icon type="setting" @click="$emit('settings-clicked')" />
        <a-icon type="share-alt" />
      </template> -->
      <a-card-meta title="Document" />
      <client-only placeholder="Codemirror Loading...">
        <codemirror
          ref="codemirror"
          v-model="text"
          style="text-align: left; margin: -24px -32px; margin-top: 3em; overflow: auto;"
          :options="cmOption"
          @ready="$emit('ready')"
          @beforeChange="onNewChanges"
        />
      </client-only>
    </a-card>
  </a-spin>
</template>

<script>
import { debug } from '@/plugins/debug'

export default {
  props: {
    loading: Boolean
  },

  data() {
    return {
      console,
      text: '',

      cmOption: {
        tabSize: 4,
        foldGutter: true,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        theme: 'mdn-like'
      },

      changes_to_ignore: {}
    }
  },

  methods: {
    insert(pos, text, meta) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`INSERT '${text}' AT ${pos}`)
      const cmpos = cmdoc.posFromIndex(pos)

      if (!this.changes_to_ignore[cmpos.line]) {
        this.changes_to_ignore[cmpos.line] = []
      }
      this.changes_to_ignore[cmpos.line].push(cmpos.ch)

      cmdoc.replaceRange(text, cmpos, cmpos)
    },
    remove(pos, len) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`REMOVE ${len} CHARS AT ${pos}`)
      const startpos = cmdoc.posFromIndex(pos)
      const endpos = cmdoc.posFromIndex(pos + len)

      if (!this.changes_to_ignore[startpos.line]) {
        this.changes_to_ignore[startpos.line] = []
      }
      this.changes_to_ignore[startpos.line].push(startpos.ch)

      cmdoc.replaceRange('', startpos, endpos)
    },
    translate(src, dest, len) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`TRANSLATE ${len} CHARS FROM ${src} -> ${dest}`)
      const startpos = cmdoc.posFromIndex(src)
      const endpos = cmdoc.posFromIndex(src + len)
      const body = cmdoc.getRange(startpos, endpos)
      this.remove(src, len)
      this.insert(dest, body)
    },

    onNewChanges(cm, change) {
      const line_seperator = '\n'
      // TODO: Possible create a custom CM document to fix this BS. That way,
      // text appears as part of the local echo of a Matrix event
      if (
        this.changes_to_ignore[change.from.line] &&
        this.changes_to_ignore[change.from.line].includes(change.from.ch)
      ) {
        this.changes_to_ignore[change.from.line].pop(change.from.ch)
        if (!this.changes_to_ignore[change.from.line].length) {
          delete this.changes_to_ignore[change.from.line]
        }
        return
      }

      // Local echos will replay the change
      change.cancel()

      const from = Object.assign({}, change.from)
      const from_index = cm.indexFromPos(from)
      const to = Object.assign({}, change.to)
      const to_index = cm.indexFromPos(to)

      // Length of removal
      const removal_length = to_index - from_index

      // Raw text of the addition
      const addition_raw = change.text.join(line_seperator)

      if (removal_length) {
        this.$emit('remove', { pos: from_index, length: removal_length })
      }

      if (addition_raw.length) {
        this.$emit('insert', { pos: from_index, body: addition_raw })
      }
    }
  }
}
</script>

<style>
.vue-codemirror .CodeMirror {
  height: 100%;
}
</style>
