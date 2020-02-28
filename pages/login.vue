<template>
  <div>
    <SimpleSVG
      id="logo-svg"
      filepath="/logo/notepad logo.svg"
      fill="#fff"
      stroke="#fff"
    />
    <b-card id="signin-dialog" title="Sign In">
      <b-card-text>
        Software written by Matrix users like you. Check it out on
        <a href="https://github.com/KB1RD/matrix-notepad">GitHub</a> and come
        chat on
        <a
          href="https://matrix.to/#/#matrix-collaboration:kb1rd.net?via=kb1rd.net&via=matrix.org&via=matrix.geklautecloud.de"
        >
          #matrix-collaboration:kb1rd.net.
        </a>
      </b-card-text>
      <AlertSection ref="alerts" />
      <b-form @submit="onFormSubmit">
        <b-form-group label-for="mxid-input">
          <b-form-input
            id="mxid-input"
            v-model="form.id"
            :disabled="is_busy"
            :state="id_valid"
            required
            placeholder="@name:server.org"
            @input="onUserIdChange"
          />
        </b-form-group>
        <b-form-group label-for="pass-input">
          <b-form-input
            id="pass-input"
            v-model="form.pass"
            :disabled="is_busy"
            type="password"
            required
            placeholder="Password"
          />
        </b-form-group>

        <b-form-group>
          <b-form-checkbox v-model="form.checked" :disabled="is_busy">
            Infer homeserver URL
          </b-form-checkbox>
        </b-form-group>
        <b-form-group v-if="!form.checked" label-for="mxid-input">
          <b-form-input
            id="mxid-input"
            v-model="form.url"
            :required="!form.checked"
            :disabled="is_busy"
            :state="url_valid"
            placeholder="https://matrix.server.org"
          />
        </b-form-group>
        <b-alert
          :show="!form.checked && form.url.toLowerCase().startsWith('http:')"
          variant="warning"
        >
          Warning: This server address is using insecure HTTP. You should always
          use HTTPS to connect to your server. HTTP support is for development
          and testing purposes only.
        </b-alert>

        <b-button type="submit" block variant="primary" :disabled="is_busy">
          <b-spinner v-if="is_busy" small />
          {{ is_busy ? 'Signing in...' : 'Sign In' }}
        </b-button>
      </b-form>
    </b-card>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'
import { SimpleSVG } from 'vue-simple-svg'
import { debug } from '@/plugins/debug'
import AlertSection from '@/components/AlertSection'

export default {
  layout: 'gradient-bg-full',
  components: { SimpleSVG, AlertSection },

  data() {
    return {
      form: {
        id: '',
        pass: '',
        checked: true,
        url: ''
      },
      infer_hs: true,
      signing_in: true
    }
  },

  computed: {
    is_busy() {
      return this.$store.getters.hasBlockingOperation
    },

    id_valid() {
      const res = /^[@][^@:]*:[^@:]*(:[0-9]+)?$/gm.exec(this.form.id)
      return this.form.id.length ? (res && res.index === 0) || false : undefined
    }
  },

  mounted() {
    const self = this
    this.$onPersistStoreReady(() => {
      if (
        self.$store.state.matrix.matrix_state &&
        self.$store.state.matrix.matrix_state !== '' &&
        self.$store.state.matrix.matrix_state !== 'STOPPED'
      ) {
        self.redirect()
        return
      }

      const m = self.$store.state.matrix.credentials
      // Ensure that the user is signed in on load
      if (m.hs && m.access_token) {
        self.performSignInOperation(
          self.$matrix.tokenSignIn(m.hs, m.access_token)
        )
      }
    })
  },

  methods: {
    redirect() {
      let path = this.$route.query.redirect_to || '/'
      if (!path.startsWith('/')) {
        path = '/' + path
      }

      this.$router.replace({ path })
    },

    onUserIdChange() {
      if (this.form.id.length) {
        while (this.form.id.lastIndexOf('@') > 0) {
          this.form.id =
            this.form.id.slice(0, this.form.id.lastIndexOf('@')) +
            ':' +
            this.form.id.slice(
              this.form.id.lastIndexOf('@') + 1,
              this.form.id.length
            )
        }
        if (!this.form.id.startsWith('@')) {
          this.form.id = '@' + this.form.id
        }
      }
    },

    performSignInOperation(promise, update_settings = false) {
      this.$matrix.shutdown()

      // Start a blocking signin
      const self = this
      self.$store.dispatch(
        'watchBlockingOperation',
        (async () => {
          try {
            const data = await promise
            if (update_settings) {
              // Update the user settings since they're valid
              self.updateSettings({ ...data, room: '' })
            }
            self.setup_visible = false
            self.redirect()
          } catch (e) {
            debug.error('Failed to sign in', e)
            // TODO: Less vague error messages
            self.$refs.alerts.alert({
              contents: 'Failed to sign in!',
              variant: 'danger'
            })
          }
        })()
      )
    },

    onFormSubmit(e) {
      e.preventDefault()
      if (!this.id_valid) {
        return
      }
      const { id, pass, url, checked } = this.form
      this.performSignInOperation(
        this.$matrix.userPassSignIn(!checked ? url : undefined, id, pass),
        true
      )
    },

    ...mapMutations({
      updateSettings: 'matrix/updateSettings'
    })
  }
}
</script>

<style>
#signin-dialog {
  margin: 10px;

  width: 100%;
  max-width: 300px;

  text-align: center;

  border-radius: 10px;
  box-shadow: 0px 0px 20px #fff7;
}

#logo-svg {
  max-width: 300px;
  margin: 40px 10px;
  filter: drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.5));
}
</style>
