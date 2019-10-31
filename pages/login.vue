<template>
  <div>
    <SimpleSVG
      id="logo-svg"
      filepath="/logo/notepad logo.svg"
      fill="#fff"
      stroke="#fff"
    />
    <a-card id="signin-dialog">
      <a-card-meta title="Sign In">
        <template v-slot:description>
          Software written by Matrix users like you. Check it out on
          <a href="https://github.com/KB1RD/matrix-notepad">GitHub</a> and come
          chat on
          <a
            href="https://matrix.to/#/#matrix-collaboration:kb1rd.net?via=kb1rd.net&via=matrix.org&via=matrix.geklautecloud.de"
          >
            #matrix-collaboration:kb1rd.net.
          </a>
        </template>
      </a-card-meta>

      <a-form
        :form="settings"
        layout="vertical"
        hide-required-mark
        style="margin-top: 50px; text-align: left;"
        @submit="onFormSubmit"
      >
        <a-row :gutter="16">
          <a-col>
            <a-form-item>
              <a-input
                v-decorator="[
                  'id',
                  {
                    rules: [
                      {
                        required: true,
                        message: 'Enter your username'
                      },
                      {
                        pattern: /^[@][^\@\:]*:[^\@\:]*(:[0-9]+)?$/gm,
                        message:
                          'Enter your full Matrix ID (ex. @name:server.org)'
                      }
                    ]
                  }
                ]"
                placeholder="@name:server.org"
                :disabled="is_busy"
                @change="onUserIdChange"
              >
                <a-icon
                  slot="prefix"
                  type="user"
                  style="color: rgba(0,0,0,.25)"
                />
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col>
            <a-form-item>
              <a-input-password
                v-decorator="[
                  'pass',
                  {
                    rules: [
                      {
                        required: true,
                        message: 'Enter your password'
                      }
                    ]
                  }
                ]"
                placeholder="Password"
                :disabled="is_busy"
              >
                <a-icon
                  slot="prefix"
                  type="lock"
                  style="color: rgba(0,0,0,.25)"
                />
              </a-input-password>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col>
            <a-form-item>
              <a-checkbox
                v-model="infer_hs"
                v-decorator="['infer_hs']"
                :disabled="is_busy"
              >
                Infer homeserver URL
              </a-checkbox>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="!infer_hs" :gutter="16">
          <a-col>
            <a-form-item label="Homeserver URL">
              <a-input
                v-decorator="[
                  'url',
                  {
                    rules: [
                      {
                        required: !infer_hs,
                        message: 'Enter the your homeserver URL'
                      }
                    ]
                  }
                ]"
                placeholder="https://server.org"
                :disabled="is_busy"
              >
                <a-icon
                  slot="prefix"
                  type="database"
                  style="color: rgba(0,0,0,.25)"
                />
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16" justify="end">
          <a-col style="text-align: right;">
            <a-button type="link">What's this?</a-button>
          </a-col>
        </a-row>
        <a-row :gutter="16" justify="end">
          <a-col style="text-align: right;">
            <a-button type="link">Register</a-button>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col>
            <a-button
              html-type="submit"
              type="primary"
              block
              :loading="is_busy"
            >
              {{ is_busy ? 'Working...' : 'Sign In' }}
            </a-button>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'
import { SimpleSVG } from 'vue-simple-svg'

export default {
  layout: 'gradient-bg-full',
  components: { SimpleSVG },

  data() {
    return {
      settings: this.$form.createForm(this),
      infer_hs: true,
      signing_in: true
    }
  },

  computed: {
    is_busy() {
      return this.$store.getters.hasBlockingOperation
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

    onUserIdChange(e) {
      if (e.target.value.length) {
        if (e.target.value.lastIndexOf('@') > 0) {
          e.target.value = e.target.value.replace(/@/g, '')
        }
        if (!e.target.value.startsWith('@')) {
          e.target.value = '@' + e.target.value
        }
      }
    },

    performSignInOperation(promise, update_settings = false) {
      this.$matrix.shutdown()

      // Start a blocking signin
      const hide = this.$message.loading('Signing in...', 0)
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
            self.$message.success("You're signed in!")
            self.setup_visible = false
            self.redirect()
          } catch (e) {
            console.error('Failed to sign in', e)
            self.$message.error('Failed to sign in!')
          }
          hide()
        })()
      )
    },

    onFormSubmit(e) {
      e.preventDefault()

      const self = this
      this.settings.validateFields((err, values) => {
        if (!err) {
          self.performSignInOperation(
            self.$matrix.userPassSignIn(values.url, values.id, values.pass),
            true
          )
        }
      })
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
