<template>
  <a-spin :spinning="loading">
    <a-icon slot="indicator" type="loading" style="font-size: 48px" spin />

    <a-card>
      <template slot="actions" class="ant-card-actions">
        <a-icon type="setting" @click="$emit('settings-clicked')" />
        <!-- <a-icon type="share-alt" /> -->
      </template>
      <a-card-meta title="Document" />
      <client-only placeholder="Codemirror Loading...">
        <codemirror
          ref="codemirror"
          v-model="text"
          style="text-align: left; margin: -24px -32px; margin-top: 3em; overflow: auto;"
          :options="cmOption"
          @changes="onNewChanges"
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

    onNewChanges(cm, changes) {
      const line_seperator = '\n'
      const modifyCmLinePositionBasedOnText = (to, text) => {
        // Add the extra lines in to the line count
        to.line += text.length - 1
        // If there's a new line, go back to the start of the line
        if (text.length > 1) {
          to.ch = 0
        }
        // Add the final line position
        to.ch += text[text.length - 1].length

        return to
      }

      changes.forEach((change) => {
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

        const from = Object.assign({}, change.from)
        const from_index = cm.indexFromPos(from)

        // Addition is in the post-removal coordinate system
        const addition_to = Object.assign({}, change.from)

        // Update based on actual values (in my experience, CM reports incorrect
        // lengths in *some* cases, so this just starts from scratch)
        modifyCmLinePositionBasedOnText(addition_to, change.text)

        // Length of removal. Start w/ the newline chars:
        let removal_length = change.removed.length - 1
        change.removed.forEach((str) => {
          removal_length += str.length
        })

        // Raw text of the addition
        const addition_raw = change.text.join(line_seperator)

        if (removal_length) {
          this.$emit('remove', { pos: from_index, length: removal_length })
        }

        if (addition_raw.length) {
          this.$emit('insert', { pos: from_index, body: addition_raw })
        }
      })
    }
  }
}
</script>

<style>
.vue-codemirror .CodeMirror {
  height: 100%;
}
</style>
