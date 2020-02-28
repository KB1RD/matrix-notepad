<template>
  <b-modal
    title="Add a Room"
    ref="modal"
    :ok-title="type === 'n' ? 'Create' : 'Join'"
    :busy="adding_room"
    :no-close-on-backdrop="adding_room"
    :no-close-on-esc="adding_room"
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
              :disabled="adding_room"
              placeholder="Room Name (optional)"
            />
          </b-form-group>
        </b-tab>
        <b-tab title="Join a room"></b-tab>
      </b-tabs>
      <b-form-group label-for="alias-input">
        <b-input-group prepend="#">
          <b-form-input
            id="alias-input"
            aria-describedby="alias-live-feedback"
            v-model="form.alias"
            :disabled="adding_room"
            :required="type === 'j'"
            :state="alias_valid"
            :placeholder="type === 'n' ? 'Room Alias (optional)' : 'Room Alias'"
          />
          <b-form-invalid-feedback id="alias-live-feedback">
            Enter just the localpart of the alias.
          </b-form-invalid-feedback>
        </b-input-group>
      </b-form-group>
    </b-form>
  </b-modal>
</template>

<script>
import { debug } from '@/plugins/debug'
import AlertSection from '@/components/AlertSection'

export default {
  components: { AlertSection },
  data() {
    return {
      form: {
        alias: '',
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
    alias_valid() {
      const res = /^[^#:]*$/gm.exec(this.form.alias)
      return this.form.alias.length || this.type === 'j'
        ? (res && res.index === 0) || false
        : undefined
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

      const alias = values.alias.trim()
      const name = values.name
      this.adding_room = true
      if (this.type === 'n') {
        this.$matrix.client
          .createRoom({
            room_alias_name: alias !== '' ? alias : undefined,
            name: name !== '' ? name : undefined
          })
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
          .joinRoom(values.room, { syncRoom: false })
          .then(
            ({ roomId }) => {
              if (roomId) {
                this.$router.replace('/edit/' + encodeURIComponent(roomId))
              }
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
      if (
        this.alias_valid === false ||
        (!this.alias_valid && this.type === 'j')
      ) {
        return
      }
      this.onFormSubmit(this.form)
    }
  }
}
</script>
