<template>
  <a-modal
    title="Add a Room"
    :visible="visible"
    :confirm-loading="adding_room"
    :closable="!adding_room"
    :mask-closable="!adding_room"
    :ok-text="type === 'n' ? 'Create' : 'Join'"
    :cancel-button-props="{ props: { disabled: adding_room } }"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form :form="form" layout="vertical" hide-required-mark>
      <a-row :gutter="16">
        <a-form-item>
          <a-select
            v-decorator="[
              'type',
              {
                initialValue: 'n'
              }
            ]"
            style="width: 240px"
            @change="(v) => (type = v)"
          >
            <a-select-option value="n">Create a new room</a-select-option>
            <a-select-option value="j">Join an existing room</a-select-option>
          </a-select>
        </a-form-item>
      </a-row>

      <a-row v-if="type === 'n'" :gutter="16">
        <a-form-item>
          <a-checkbox
            v-decorator="['add_alias']"
            @change="(e) => (add_alias = e.target.checked)"
          >
            Add an alias
          </a-checkbox>
        </a-form-item>
      </a-row>
      <a-row v-if="type === 'n' && add_alias" :gutter="16">
        <a-form-item>
          <a-input
            v-decorator="[
              'alias',
              {
                rules: [
                  {
                    required: true,
                    message: 'An alias is required'
                  },
                  {
                    pattern: /^[^#:]*$/gm,
                    message: 'Enter only the localpart of the alias'
                  }
                ]
              }
            ]"
            placeholder="Alias"
          />
        </a-form-item>
      </a-row>

      <a-row v-if="type === 'n'" :gutter="16">
        <a-form-item>
          <a-checkbox
            v-decorator="['add_name']"
            @change="(e) => (add_name = e.target.checked)"
          >
            Add a name
          </a-checkbox>
        </a-form-item>
      </a-row>
      <a-row v-if="type === 'n' && add_name" :gutter="16">
        <a-form-item>
          <a-input
            v-decorator="[
              'name',
              {
                rules: [
                  {
                    required: true,
                    message: 'A name is required'
                  }
                ]
              }
            ]"
            placeholder="Name"
          />
        </a-form-item>
      </a-row>

      <a-row v-if="type === 'j'" :gutter="16">
        <a-form-item>
          <a-input
            v-decorator="[
              'room',
              {
                rules: [
                  {
                    required: true,
                    message: 'A room to join is required'
                  },
                  {
                    pattern: /^[!#][^!#:]*:[^!#:]*(:[0-9]+)?$/gm,
                    message: 'This is not a valid Matrix room ID or alias'
                  }
                ]
              }
            ]"
            placeholder="!roomid:matrix.org"
          />
        </a-form-item>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script>
import { debug } from '@/plugins/debug'

export default {
  data() {
    return {
      form: this.$form.createForm(this),

      type: 'n',
      add_alias: false,
      add_name: false,

      visible: false,
      adding_room: false
    }
  },

  methods: {
    show() {
      this.visible = true
    },
    hide() {
      this.visible = false
    },

    onFormSubmit(values) {
      if (!this.$matrix.client) {
        return
      }

      if (this.type === 'n') {
        this.adding_room = true
        const hide = this.$message.loading('Creating room...', 0)
        this.$matrix.client
          .createRoom({
            room_alias_name: values.add_alias ? values.alias : undefined,
            name: values.add_name ? values.name : undefined
          })
          .then(
            ({ room_id }) => {
              this.$message.success('Room created')
              if (room_id) {
                this.$router.replace('/edit/' + encodeURIComponent(room_id))
              }
            },
            (e) => {
              debug.error('Failed to create room', e)
              this.$message.error('Failed to create room!')
            }
          )
          .then(() => {
            this.adding_room = false
            hide()
          })
      } else if (this.type === 'j') {
        this.adding_room = true
        const hide = this.$message.loading('Joining room...', 0)
        this.$matrix.client
          .joinRoom(values.room, { syncRoom: false })
          .then(
            ({ roomId }) => {
              this.$message.success('Room joined')
              if (roomId) {
                this.$router.replace('/edit/' + encodeURIComponent(roomId))
              }
            },
            (e) => {
              debug.error('Failed to join room', e)
              this.$message.error('Failed to join room!')
            }
          )
          .then(() => {
            this.adding_room = false
            hide()
          })
      }
    },

    handleOk(e) {
      const self = this
      this.form.validateFields((err, values) => {
        if (!err) {
          self.onFormSubmit(values)
        }
      })
    },
    handleCancel(e) {
      this.visible = false
    }
  }
}
</script>
