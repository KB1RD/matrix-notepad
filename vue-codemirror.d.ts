declare module 'vue-codemirror';

import { PluginObject } from 'vue';

import CodeMirror from 'codemirror';

declare const VueCodemirror: PluginObject & { codemirror: CodeMirror.Doc };

export default VueCodemirror;

