<template>
  <a-form
    :form="settings"
    layout="vertical"
    hide-required-mark
    @submit="submit"
  >
    <a-row :gutter="16">
      <a-col>
        Note that this software is <b>highly</b> experimental. Do <b>not</b> use
        this to store confidential or important information. Also, this adds a
        ton of events to whichever room is chosen, so... be careful. Also, most
        upgrades will introduce breaking changes at the moment with no real
        upgrade path. Sorry.
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col>
        <a-form-item label="Homeserver Name">
          <a-input
            v-decorator="[
              'hs',
              { initialValue: $store.state.matrix.credentials.hs }
            ]"
            placeholder="https://matrix.org"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="16">
      <a-col>
        <a-form-item label="Access Token">
          <a-input
            v-decorator="[
              'token',
              {
                initialValue: $store.state.matrix.credentials.access_token,
                rules: [
                  {
                    required: true,
                    message: 'An access token is required'
                  }
                ]
              }
            ]"
            placeholder="ABCDEF1234"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="16">
      <a-col>
        <a-form-item label="Room">
          <a-input
            v-decorator="[
              'room',
              {
                initialValue: $store.state.matrix.working_room,
                rules: [
                  {
                    required: true,
                    message: 'A room to join is required'
                  },
                  {
                    pattern: /^[!#][^\!\:]*:[^\!\:]*(:[0-9]+)?$/gm,
                    message: 'This is not a valid Matrix room ID or alias'
                  }
                ]
              }
            ]"
            placeholder="!roomid:matrix.org"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="16">
      <a-col>
        <a-form-item>
          <a-checkbox
            v-decorator="['debug', { initialValue: $store.state.debug }]"
          >
            Enable verbose debug
          </a-checkbox>
        </a-form-item>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col>
        <a-button type="primary" :loading="working" html-type="submit">
          {{ working ? 'Working...' : signedIn ? 'Update' : 'Sign In' }}
        </a-button>
      </a-col>
    </a-row>
  </a-form>
</template>

<script>
export default {
  // It is necessary to put props in camelCase so that Vue.JS will convert them
  // to proper HTML property names (ex. signed-in)
  props: { working: Boolean, signedIn: Boolean },
  data() {
    return {
      settings: this.$form.createForm(this)
    }
  },
  methods: {
    submit(e) {
      e.preventDefault()

      const self = this
      this.settings.validateFields((err, values) => {
        if (!err) {
          self.$emit('submit', values)
        }
      })
    }
  }
}
</script>
