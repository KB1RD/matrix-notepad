<template>
  <div class="gradient-container">
    <SimpleSVG
      id="logo-svg"
      filepath="/logo/notepad logo.svg"
      fill="#fff"
      stroke="#fff"
    />
    <b-card id="signin-dialog" title="Set Up">
      <b-card-text>
        Collaborate easily in your Matrix room. Simply add this widget to your room to get started.
      </b-card-text>
    </b-card>
    <p class="version-text">v{{ version }}</p>
  </div>
</template>

<script>
import { SimpleSVG } from 'vue-simple-svg';

import { version } from '../../package.json';

export default {
  components: { SimpleSVG },
  data() {
    return {
      version,
    };
  },
};
</script>

<style>
.gradient-container {
  position: relative;
  width: 100%;
  min-height: 100vh;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding-bottom: 20px;
}
.gradient-container::before {
  content: "";
  z-index: -1;
  position: fixed;
  top: 0px;
  bottom: 0px;
  left: 0px;
  right: 0px;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(
    170deg,
    #2c4be8 0%,
    #352ce8 60%,
    #d52ce8 150%
  );
}
.gradient-container .version-text {
  position: absolute;
  bottom: 0px;
  margin: auto;
  color: white;
}
#signin-dialog {
  z-index: 20;
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
