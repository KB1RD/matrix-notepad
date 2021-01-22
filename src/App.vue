<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<style lang="scss">
@import './scss/glow';
@import '../node_modules/bootstrap-vue/dist/bootstrap-vue.css';

html, body {
  height: 100%;
}
#app {
  height: 100%;
}

:focus { outline:none; }
::-moz-focus-inner { border:0; }
</style>
