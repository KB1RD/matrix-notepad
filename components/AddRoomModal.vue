<template>
  <b-modal
    title="Add a Room"
    ref="modal"
    :ok-title="type === 'n' ? 'Create' : 'Join'"
    :ok-disabled="!can_submit"
    :busy="!can_edit"
    :no-close-on-backdrop="!can_edit"
    :no-close-on-esc="!can_edit"
    @ok="handleOk"
  >
    <AlertSection ref="alerts" />
    <b-form>
      <b-tabs v-model="form.tab" content-class="mt-3">
        <b-tab title="Create a room" active>
          <b-form-group label-for="name-input">
            <b-form-input
              id="name-input"
              v-model="form.name"
              :disabled="!can_edit"
              placeholder="Room Name (optional)"
            />
          </b-form-group>
        </b-tab>
        <b-tab title="Join a room"></b-tab>
      </b-tabs>
      <b-form-group label-for="room-input">
        <b-input-group prepend="#">
          <b-form-input
            id="room-input"
            aria-describedby="room-live-feedback"
            v-model="form.room"
            :disabled="!can_edit"
            :required="type === 'j'"
            :state="room_valid"
            :placeholder="
              type === 'n' ? 'Room Alias (optional)' : 'Room Alias or ID'
            "
          />
          <b-form-invalid-feedback id="room-live-feedback">
            <template v-if="type === 'n'">
              Enter just the localpart of the alias to create.
            </template>
            <template v-if="type === 'j'">
              Enter both the localpart and server name with the # or ! (ex.
              #matrix:matrix.org)
            </template>
          </b-form-invalid-feedback>
        </b-input-group>
      </b-form-group>
    </b-form>
  </b-modal>
</template>

<script>
import { debug } from '@/plugins/debug'
import AlertSection from '@/components/AlertSection'
import { matrix_typed_state, plaintext } from '@/plugins/matrix.js'

export default {
  components: { AlertSection },
  data() {
    return {
      form: {
        room: '',
        name: '',
        tab: 0
      },

      adding_room: false
    }
  },

  computed: {
    type() {
      return this.form.tab === 0 ? 'n' : 'j'
    },
    room_valid() {
      if (this.type === 'n') {
        const res = /^[^!#:]*$/gm.exec(this.form.room)
        return res && res.index === 0 ? undefined : false
      } else if (this.type === 'j') {
        const res = /^[!#][^!#:]+:[a-zA-Z0-9-.]+(:[0-9]+)?$/gm.exec(
          this.form.room
        )
        return res && res.index === 0 ? undefined : false
      }
      return false
    },
    can_submit() {
      // BS has a really weird way of validating forms
      return this.room_valid !== false && !this.adding_room
    },
    can_edit() {
      return !this.adding_room
    }
  },

  methods: {
    show() {
      this.$refs.modal.show()
    },
    hide() {
      this.$refs.modal.hide()
    },

    onFormSubmit(values) {
      if (!this.$matrix.client) {
        return
      }

      const room = values.room.trim()
      const name = values.name
      this.adding_room = true
      if (this.type === 'n') {
        this.$matrix.client
          .createRoom({
            room_alias_name: room !== '' ? room : undefined,
            name: name !== '' ? name : undefined
          })
          .then((data) =>
            this.$matrix.client
              .sendStateEvent(
                data.room_id,
                matrix_typed_state,
                { type: plaintext },
                ''
              )
              .then(() => data)
          )
          .then(
            ({ room_id }) => {
              if (room_id) {
                this.$router.replace('/edit/' + encodeURIComponent(room_id))
              }
              this.hide()
            },
            (e) => {
              debug.error('Failed to create room', e)
              this.$refs.alerts.alert({
                variant: 'danger',
                contents: 'Failed to create room!'
              })
            }
          )
          .then(() => {
            this.adding_room = false
          })
      } else if (this.type === 'j') {
        this.$matrix.client
          .joinRoom(`${values.room}`, { syncRoom: false })
          .then(
            ({ roomId }) => {
              /* if (roomId) {
                this.$router.replace('/edit/' + encodeURIComponent(roomId))
              } */
              this.hide()
            },
            (e) => {
              debug.error('Failed to join room', e)
              this.$refs.alerts.alert({
                variant: 'danger',
                contents: 'Failed to join room!'
              })
            }
          )
          .then(() => {
            this.adding_room = false
          })
      }
    },

    handleOk(e) {
      e.preventDefault()
      if (!this.can_submit) {
        return
      }
      this.onFormSubmit(this.form)
    }
  }
}
</script>
