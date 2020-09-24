/* eslint-env browser, jquery */
/* global CodeMirror, Cookies, moment, serverurl,
   key, Dropbox, ot, hex2rgb, Visibility, inlineAttachment */

import TurndownService from 'turndown'

import { saveAs } from 'file-saver'
import randomColor from 'randomcolor'
import store from 'store'

import isURL from 'validator/lib/isURL'

import _ from 'lodash'

import wurl from 'wurl'

import List from 'list.js'

import Idle from '@hackmd/idle-js'

import { Spinner } from 'spin.js'

import {
  checkLoginStateChanged,
  setloginStateChangeEvent
} from './lib/common/login'

import {
  debug,
  DROPBOX_APP_KEY,
  noteid,
  noteurl,
  urlpath,
  version
} from './lib/config'

import {
  autoLinkify,
  deduplicatedHeaderId,
  exportToHTML,
  exportToRawHTML,
  removeDOMEvents,
  finishView,
  generateToc,
  md,
  parseMeta,
  postProcess,
  //renderFilename,
  renderTOC,
  renderTags,
  renderTitle,
  updateLastChange,
  updateLastChangeUser,
  updateOwner
} from './extra'


import {
  writeHistory,
  deleteServerHistory,
  getHistory,
  saveHistory,
  removeHistory
} from './history'

import { preventXSS } from './render'

import Editor from './lib/editor'

import getUIElements from './lib/editor/ui-elements'
import { emojifyImageDir } from './lib/editor/constants'
import modeType from './lib/modeType'
import appState from './lib/appState'

require('../vendor/showup/showup')

require('../css/index.css')
require('../css/extra.css')
require('../css/slide-preview.css')
require('../css/site.css')
require('spin.js/spin.css')

require('highlight.js/styles/github-gist.css')

var defaultTextHeight = 20
var viewportMargin = 20
var defaultEditorMode = 'gfm'

var idleTime = 300000 // 5 mins
var updateViewDebounce = 500
var cursorMenuThrottle = 50
var cursorActivityDebounce = 50
var cursorAnimatePeriod = 100
var supportContainers = ['success', 'info', 'warning', 'danger', 'spoiler']
var supportCodeModes = ['javascript', 'typescript', 'jsx', 'htmlmixed', 'htmlembedded', 'css', 'xml', 'clike', 'clojure', 'ruby', 'python', 'shell', 'php', 'sql', 'haskell', 'coffeescript', 'yaml', 'pug', 'lua', 'cmake', 'nginx', 'perl', 'sass', 'r', 'dockerfile', 'tiddlywiki', 'mediawiki', 'go', 'gherkin']
var supportCharts = []
var supportHeaders = [
  {
    text: '# h1',
    search: '#'
  },
  {
    text: '## h2',
    search: '##'
  },
  {
    text: '### h3',
    search: '###'
  },
  {
    text: '#### h4',
    search: '####'
  },
  {
    text: '##### h5',
    search: '#####'
  },
  {
    text: '###### h6',
    search: '######'
  },
  {
    text: '###### tags: `example`',
    search: '###### tags:'
  }
]
const supportReferrals = [
  {
    text: '[reference link]',
    search: '[]'
  },
  {
    text: '[reference]: https:// "title"',
    search: '[]:'
  },
  {
    text: '[^footnote link]',
    search: '[^]'
  },
  {
    text: '[^footnote reference]: https:// "title"',
    search: '[^]:'
  },
  {
    text: '^[inline footnote]',
    search: '^[]'
  },
  {
    text: '[link text][reference]',
    search: '[][]'
  },
  {
    text: '[link text](https:// "title")',
    search: '[]()'
  },
  {
    text: '![image alt][reference]',
    search: '![][]'
  },
  {
    text: '![image alt](https:// "title")',
    search: '![]()'
  },
  {
    text: '![image alt](https:// "title" =WidthxHeight)',
    search: '![]()'
  },
  {
    text: '[TOC]',
    search: '[]'
  }
]
const supportExternals = [
  {
    text: '{%slideshare slideshareid %}',
    search: 'slideshare'
  },
  {
    text: '{%speakerdeck speakerdeckid %}',
    search: 'speakerdeck'
  },
  {
    text: '{%pdf pdfurl %}',
    search: 'pdf'
  }
]
const supportExtraTags = [
  {
    text: '[name tag]',
    search: '[]',
    command: function () {
      return '[name=' + personalInfo.name + ']'
    }
  },
  {
    text: '[time tag]',
    search: '[]',
    command: function () {
      return '[time=' + moment().format('llll') + ']'
    }
  },
  {
    text: '[my color tag]',
    search: '[]',
    command: function () {
      return '[color=' + personalInfo.color + ']'
    }
  },
  {
    text: '[random color tag]',
    search: '[]',
    command: function () {
      var color = randomColor()
      return '[color=' + color + ']'
    }
  }
]
const statusType = {
  connected: {
    msg: 'CONNECTED',
    label: 'label-warning',
    fa: 'fa-wifi'
  },
  online: {
    msg: 'ONLINE',
    label: 'label-primary',
    fa: 'fa-users'
  },
  offline: {
    msg: 'OFFLINE',
    label: 'label-danger',
    fa: 'fa-plug'
  }
}

const liaSnippets = [
    {
        key: "````` /--=... `````",
        search: "lia-ascii-example",
        replace: "``````````````````````````````````````````````````\n                             .--->  F\n    A       B     C   D     /\n    *-------*-----*---*----*----->  E\n                         ^ v          /   '--->  G\n               B --> C -'\n`````````````````````````````````````````````````",
        icon: "<span style=\"color:#ff0\">\u2328</span>",
        url: "https://github.com/ivanceras/svgbob",
        helpMsg: "Add ASCII art drawings, sketches, or what ever you want, simply by enclosing it with at least four back tics (````).\n\nExamples:\n\n  `````````````````````````````````\n                           .---&gt;  F\n  A       B     C   D     /\n  *-------*-----*---*----*-----&gt;  E\n                       ^ v          /   &#x27;---&gt;  G\n             B --&gt; C -&#x27;\n  `````````````````````````````````"
    },
    {
        key: "&lt;!-- style ... --&gt; ```` /--=... `````",
        search: "lia-ascii-example-css",
        replace: "<!-- style=\"display: block; margin-left: auto; margin-right: auto; max-width: 315px;\" -->\n``````````````````````````````````````````````````\n                             .--->  F\n    A       B     C   D     /\n    *-------*-----*---*----*----->  E\n                         ^ v          /   '--->  G\n               B --> C -'\n`````````````````````````````````````````````````",
        icon: "<span style=\"color:#ff0\">\u2328</span>",
        url: "https://github.com/ivanceras/svgbob",
        helpMsg: "Add styling to your ASCII art drawings, sketches. Set the maximum size or center it.\n\nExamples:\n\n  &lt;!-- style=&quot;display: block; margin-left: auto; margin-right: auto; max-width: 315px;&quot; --&gt;\n  ``````````````````````````````````````````````````\n  ${1:                             .---&gt;  F\n      A       B     C   D     /\n      *-------*-----*---*----*-----&gt;  E\n                           ^ v          /   &#x27;---&gt;  G\n                 B --&gt; C -&#x27;}\n  ``````````````````````````````````````````````````"
    },
    {
        key: "`code`",
        search: "lia-code-inline",
        replace: "`code",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "http://www.google.de",
        helpMsg: "Inline `code` has `back-ticks around` it."
    },
    {
        key: "```lang ... ```",
        search: "lia-code-block",
        replace: "```javascript\nvar s = \"JavaScript syntax highlighting\";\nalert(s);\n``",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://highlightjs.org",
        helpMsg: "To insert a code block with syntax highlight, enclose your code snippet with three back-ticks (```) that is followed by a language code. To search all language codes, visit the link below, but in most cases you can simply add either the name of the language or the typical file-ending.\n\nExamples:\n\n  ```javascript\n  var s = &quot;JavaScript syntax highlighting&quot;;\n  alert(s);\n  s;\n  ```\n\n  ```python\n  s = &quot;Python syntax highlighting&quot;\n  print s\n  ```\n\n  ```\n  No language indicated, so no syntax highlighting.\n  But let&#x27;s throw in a &lt;b&gt;tag&lt;/b&gt;.\n  ```"
    },
    {
        key: "```lang ... ``` &lt;script&gt;@input&lt;/script&gt;",
        search: "lia-code-block-js",
        replace: "```javascript\nvar s = \"JavaScript syntax highlighting\";\nalert(s);\ns;\n```\n<script>@input</script",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "To insert an executable and editable code block with syntax highlight, insert a common Markdown code block with a succeeding &lt;script&gt; tag. The macro @input is replaced with the current user input and gets evaluated in a try and catch block. Using JavaScript you can also insert interpreters to other languages or access them. In these cases you will have to change the content of the script tag. To get an impression about the possibilities, click on the link below.\nThe result of the script or the error are passed to a command-line like output beneath the code-block.\n\nExample:\n\n  ```javascript\n  var s = &quot;JavaScript syntax highlighting&quot;;\n  alert(s);\n  ```\n  &lt;script&gt;@input&lt;/script&gt;"
    },
    {
        key: "```lang +name ...```",
        search: "lia-code-block-name",
        replace: "```javascript title.js\nvar s = \"Named JavaScript syntax highlighting\";\nalert(s);\n``",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://highlightjs.org",
        helpMsg: "You can name your snippets by adding just after the language code. At default, it will be visible, but by adding a plus (+) in front of your filename you can make this more expressible, whereby a minus (-) will hide it at first. In this way you can also group multiple files into a (executable) project.\n\nExamples:\n\n  ```javascript    Visible.js\n  alert(&quot;Visble JavaScript file&quot;;);\n  ```\n\n  ```javascript   +Visible.js\n  alert(&quot;Also visible JavaScript file&quot;);\n  ```\n\n  ```javascript   -Hidden.js\n  alert(&quot;Hidden JavaScript file on init&quot;);\n  ```"
    },
    {
        key: "```lang +name ...``` &lt;script&gt;@input&lt;/script&gt;",
        search: "lia-code-block-name-js",
        replace: "```javascript   Filename.js\nvar s = \"Named JavaScript syntax highlighting\";\nalert(s);\ns;\n```\n<script>@input</script",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "To insert a named and executable and code snippet. The macro @input is replaced with the current user input and gets evaluated in a try and catch block. Using JavaScript you can also insert interpreters to other languages or access them. In these cases you will have to change the content of the &lt;script&gt; tag. To get an impression about the possibilities, click on the link below.\nThe result of the script or the error are passed to a command-line like output beneath the code-block.\n\nExample:\n\n  ```javascript   +Tile.js\n  var s = &quot;Visible JavaScript syntax highlighting&quot;;\n  ```\n  &lt;script&gt;@input&lt;/script&gt;\n\n  ```javascript   +Title.js\n  var s = &quot;Hidden JavaScript syntax highlighting&quot;;\n  ```\n  &lt;script&gt;@input&lt;/script&gt;"
    },
    {
        key: "```lang ... ``` &lt;script&gt; ... ",
        search: "lia-code-block-jsx",
        replace: "```javascript\nvar s = \"JavaScript syntax highlighting\";\nalert(s);\n```\n<script>\n  try{\n    eval(`@input`);\n  } catch (e) {\n    var log = e.stack.match(/((.*?):(.*))\\\\n.*?(:(\\\\d+):(\\\\d+)\\\\)\\\\n)/);\n    var err_msg = new LiaError(log[1] + \" =>  (\" + log[4], 1);\n    err_msg.add_detail(0, log[3], \"error\", log[5]-1, log[6]);\n    throw err_msg;\n  }\n</script",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "This is an extended executable version of a code block, it shows how errors can be extracted and fed back by using LiaError to show inline errors, warnings, or information.\nIf you are using a project and want to integrate more than one file into your execution, you will have to use the parameterized @input(int) macro, the integer is defined by the file order (@input defaults to 0).\n\nExample:\n\n  ```javascript\n  var s = &quot;JavaScript syntax highlighting&quot;;\n  alert(s);\n  ```\n  &lt;script&gt;\n    try{\n      eval(`@input`);  // &lt;== code to evaluate\n    } catch (e) {\n      var log = e.stack.match(/((.*?):(.*))\\n.*?(:(\\d+):(\\d+)\\)\\n)/);\n      var err_msg = new LiaError(log[1] + &quot; =&gt;  (&quot; + log[4], 1);\n      err_msg.add_detail(0, log[3], &quot;error&quot;, log[5]-1, log[6]);\n      throw err_msg;\n    }\n  &lt;/script&gt;"
    },
    {
        key: "&lt;script&gt;...@input...&lt;/script&gt;",
        search: "lia-code-js",
        replace: "<script>\n  try{\n    eval(`@input`);\n  } catch (e) {\n    var log = e.stack.match(/((.*?):(.*))\\\\n.*?(:(\\\\d+):(\\\\d+)\\\\)\\\\n)/);\n    var err_msg = new LiaError(log[1] + \" =>  (\" + log[4], 1);\n    err_msg.add_detail(0, log[3], \"error\", log[5]-1, log[6]);\n    throw err_msg;\n  }\n</script",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "This is an extended executable version of a code block, it shows how errors can be extracted and fed back by using LiaError to show inline errors, warnings, or information.\nIf you are using a project and want to integrate more than one file into your execution, you will have to use the parameterized @input(int) macro, the integer is defined by the file order (@input defaults to 0).\n\nExample:\n\n  &lt;script&gt;\n    try{\n      eval(`@input`); // code to be evaluated\n    } catch (e) {\n      // do some pattern matching to get the error string, the line number and column\n      var log = e.stack.match(/((.*?):(.*))\\n.*?(:(\\d+):(\\d+)\\)\\n)/);\n\n      // create a new LiaError object with\n      // param1: an error message string\n      // param2: add the number of files involved as int\n      var err_msg = new LiaError(log[1] + &quot; =&gt;  (&quot; + log[4], 1);\n\n      // add as many information to your error message\n      // param1: file id\n      // param2: additional information string\n      // param3: type, either &quot;error&quot;, &quot;info&quot;, or &quot;warning&quot;\n      // param4: line number\n      // param5: column number\n      err_msg.add_detail(0, log[3], &quot;error&quot;, log[5]-1, log[6]);\n\n      throw err_msg;   // finally just throw it away\n    }\n  &lt;/script&gt;"
    },
    {
        key: "```lang @ouput ...```",
        search: "lia-code-output",
        replace: "``` text     +@output\nEnter your default output\n``",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "In contrast to the @input macro, there is also an @output macro, which can be used to define the initial output of and executable code-block. This block has to be the last and you can use a plus (+) or a minus (-) in front to indicate, whether this output is interpreted as normal stdout or stderr.\n\nExample:\n\n  ``` js     -EvalScript.js\n  let str = &quot;hello world&quot;;\n\n  consolelog(str)\n  ```\n  ``` json    -@ouput\n  There is a error in line 3...\n  ```\n  &lt;script&gt;@input&lt;/script&gt;"
    },
    {
        key: "``` ... ``` ``` ... ``` ...",
        search: "lia-code-project",
        replace: "``` js     -EvalScript.js\nlet who = data.first_name + \" \" + data.last_name;\n\nif(data.online) {\n  who + \" is online\"; \\\nelse {\n  who + \" is NOT online\"; \\}}\n```\n``` json    +Data.json\n{\n  \"first_name\" :  \"Sammy\",\n  \"last_name\"  :  \"Shark\",\n  \"online\"     :  true\n\\}\n```\n<script>\n  // insert the JSON dataset into the local variable data\n  let data = @input(1);\n\n  // eval the script that uses this dataset\n  eval(`@input(0)`);\n</script",
        icon: "<span style=\"color:#ff0\">\ud83d\udcbb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If you want to create a project and thus separate data and code into multiple files, simply write multiple code blocks in a sequence. To make them executable as a whole, simply add a script tag to the end and use the parameterized @input(id) macro to compose your project properly. The file id is defined by the order of code blocks.\nSee the link below to see more examples.\n\nExample:\n\n  ``` js     -EvalScript.js\n  let who = data.first_name + &quot; &quot; + data.last_name;\n\n  if(data.online) { who + &quot; is online&quot;; }\n  else            { who + &quot; is NOT online&quot;; }\n  ```\n  ``` json    +Data.json\n  { &quot;first_name&quot; :  &quot;Sammy&quot;,\n    &quot;last_name&quot;  :  &quot;Shark&quot;,\n    &quot;online&quot;     :  true   }\n  ```\n  &lt;script&gt;\n    // insert the JSON dataset into the local variable data\n    let data = @input(1);\n\n    // eval the script that uses this dataset\n    eval(`@input(0)`);\n  &lt;/script&gt;"
    },
    {
        key: "--{{number}}--",
        search: "lia-comment",
        replace: "              --{{number}}--\nEnter some **text** that gets read out aloud.\nOnly paragraphs are allowed!",
        icon: "<span style=\"color:#ff0\">\ud83d\uddef</span>",
        url: "https://responsivevoice.org",
        helpMsg: "Comments are those elements that get read out aloud in slide and presentation mode and a printed out at the placed position in textbook mode. Only paragraphs are allowed as comments and Markdown can be applied for styling different elements.\nThe default voice is defined within the main header, if not english will be used. This main voice can be changed per section by adding a section comment.\n\nExample:\n  &lt;!--\n  author:   ...\n  email:    ...\n  ...\n  narrator: UK English Female\n  --&gt;\n\n  # Title\n\n               --{{0}}--\n  I will speak with a female *UK* accent.\n\n  ## Section\n  &lt;!-- narrator: US English Male --&gt;\n\n               --{{0}}--\n  This entire section will be spoken aloud american man.\n\n               --{{1}}--\n  But only this section...\n\nTo simplify the voice-search, simply start typing &quot;voice&quot; and fuzzy search all responsive voice or click on the link below."
    },
    {
        key: "--{{number voice}}--",
        search: "lia-comment-voice",
        replace: "              --{{number voice}}--\nEnter some **text** that gets read out aloud with another voice.\nOnly paragraphs are allowed!",
        icon: "<span style=\"color:#ff0\">\ud83d\uddef</span>",
        url: "https://responsivevoice.org",
        helpMsg: "You can change the voice also per comment by adding it directly after the number of appearance.\nType &quot;voice&quot; for fuzzy searching all responsive voices or click on the link below.\n\nExample:\n        --{{0 Australian Female}}--\n  I will speak with a female Australian accent,\n  no matter what the default language is.\n\n        --{{0 Deutsch Male}}--\n  Und hier \u00e4u\u00dfert sich gerade ein deutscher Mann."
    },
    {
        key: "&lt;!-- --{{number}}-- ... --&gt;",
        search: "lia-comment-hidden",
        replace: "<!-- --{{number}}-- Enter some **text** that gets read out aloud! --",
        icon: "\ud83d\uddef",
        url: "https://responsivevoice.org",
        helpMsg: "If you want to speak out some additional text that shall not appear in the textbook mode, then simply put your comment into a HTML comment tag.\n\nExample:\n  &lt;!-- --{{2}}--\n  I will speak with the default voice, but not appear\n  elsewhere within the document.\n  --&gt;"
    },
    {
        key: "&lt;!-- --{{number voice}}-- ... --&gt;",
        search: "lia-comment-voice-hidden",
        replace: "<!-- --{{number voice}}-- Enter some **text** that gets read out aloud! --",
        icon: "\ud83d\uddef",
        url: "https://responsivevoice.org",
        helpMsg: "If you want to speak out some additional text that shall not appear in the textbook mode and speak with another voice, then simply put your comment with a voice definition into a HTML comment tag.\n\nExample:\n  &lt;!-- --{{2 Deutsch Female}}--\n  I will speak with a German voice, but not appear\n  elsewhere within the document.\n  --&gt;\n\nType &quot;voice&quot; for fuzzy searching or click on the link below for more information."
    },
    {
        key: "color dot diagram",
        search: "lia-diagram-dots",
        replace: "               Title - dots\n6 | A a B b C c\n  | D d E e F f G g H h I i\n  | J j K k L l M m N n o O\n  | P p Q q R r S s T t U u\n  | V v W w X x Y y Z Z   *\n1 +------------------------\n  0                      2",
        icon: "<span style=\"color:#ff0\">\ud83d\udcc8</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "The character is used as a color code, such as r stands for red, w for white, etc. Uppercase and lowercase characters define the size of the plotted dots. And if there is only one character, then it is plotted as a single dot only.\n\nExample:\n                  Colored - Dots\n     6 | A a B b C c\n       | D d E e F f G g H h I i\ny-axis | J j K k L l M m N n o O\n       | P p Q q R r S s T t U u\n       | V v W w X x Y y Z Z   *\n     1 +------------------------\n       0        x-axis        24\n\nThe definition of the title, x and y labels and their limits is optional, but the number of used pipes (|) and hyphens (-) define the resolution of the diagram."
    },
    {
        key: "multiline diagram",
        search: "lia-diagram-multiline",
        replace: "                                Multiline\n1.9 |\n    |                 ***\n  y |               *     *\n  - | r r r r r r r*r r r r*r r r r r r r\n  a |             *         *\n  x |            *           *\n  i | B B B B B * B B B B B B * B B B B B\n  s |         *                 *\n    | *  * *                       * *  *\n -1 +------------------------------------\n    0              x-axis               ",
        icon: "<span style=\"color:#ff0\">\ud83d\udcc8</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "The character is used as a color code, such as r stands for red, B for blue, etc. Uppercase and lowercase characters define the size of the plotted dots. A sequence of equal characters gets interpreted as a poly-line, there are more than two characters and if there are no two characters at the same x position.\n\nExample:\n                                  Multiline\n  1.9 |\n      |                 ***\n    y |               *     *\n    - | r r r r r r r*r r r r*r r r r r r r\n    a |             *         *\n    x |            *           *\n    i | B B B B B * B B B B B B * B B B B B\n    s |         *                 *\n      | *  * *                       * *  *\n   -1 +------------------------------------\n      0            x-axis                 1\n\nThe definition of the title, x and y labels and their limits is optional, but the number of used pipes (|) and hyphens (-) define the resolution of the diagram."
    },
    {
        key: "simple diagram",
        search: "lia-diagram-simple",
        replace: "             Combining dots and polylines\n1.9 |\n    |     DOTS\n  y |                                *\n  - |\n  a |                         *\n  x |                  *\n  i |         *\n  s |\n    | *\n -1 +------------------------------------\n    0            x-axis                 ",
        icon: "<span style=\"color:#ff0\">\ud83d\udcc8</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Simple dots and poly-line representations can be applied together in one diagram, if they use different characters.\n\nExample:\n              Combining dots and poly-lines\n  1.9 |\n      |     DOTS\n    y |                                *\n    - |\n    a |                         *\n    x |                  *\n    i |         *\n    s |\n      | *\n   -1 +------------------------------------\n      0            x-axis                 1\n\nThe definition of the title, x and y labels and their limits is optional, but the number of used pipes (|) and hyphens (-) define the resolution of the diagram."
    },
    {
        key: "{number}{element}",
        search: "lia-effect-inline",
        replace: "{number}{__element__",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use simple inline effects to highlight specific elements within a Markdown block. Simply enclose your elements within two subsequent braces ({}{}), whereby the first one is used to hold the number of appearance, while the will contain your text, image, video, what so ever ...\nYou can tweak your effects with additional animations and styling. Animate.css is included at default.\n\nExamples:\n  This block contains some {1}{inline __effects__} that will appear {2}{subsequently}.\n\n  Inline effects can also contain more effects {1}{I will appear first {2}{and I as a second}}.\n\n  With styling ++ {3}{bouncing red and delayed}&lt;!--\n        class = &quot;animated infinite bounce&quot;\n        style = &quot;animation-delay: 3s; color: red;&quot;\n      --&gt;"
    },
    {
        key: "{from-to}{element}",
        search: "lia-effect-inline2",
        replace: "{from-to}{__element__",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use simple inline effects to highlight specific elements within a Markdown block. Simply enclose your elements within two subsequent braces ({}{}), whereby the first one contains two numbers separated by (-) the first number defines the time of appearance and the second one the time of disappearance. The element contains the Markdown elements for highlighting (text, videos, images, etc.)\nYou can tweak your effects with additional animations and styling. Animate.css is included at default.\n\nExamples:\n  This block contains some {1-2}{I appear at fragment 1 and disapper at 2}.\n\n  Nesting is allowed but has to make sense {1-3}{I will rest from 1 to 3 {4}{I will not be visible}}.\n\n  With styling ++ {1-3}{bouncing red and delayed}&lt;!--\n        class = &quot;animated infinite bounce&quot;\n        style = &quot;animation-delay: 3s; color: red;&quot;\n      --&gt;"
    },
    {
        key: "{{number}}",
        search: "lia-effect-block",
        replace: "    {number}\n",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use block effects to let entire Markdown blocks appear or disappear. It works exactly as simple inline effects. But the number of appearance has to be put in double braces.\nThe entire block can also be styled and the animation tweaked, but the required comment tag has to be defined before the Markdown block. Animate.css is included at default.\n\nExamples:\n                    {{1}}\n  This entire block will appear with the first\n  fragment. And remain till the end of this slide.\n\n                    {{2}}\n  ```js\n  // this works with any markdown block\n  ```\n\n  &lt;!-- class = &quot;animated rollIn&quot; --&gt;\n       {{3}}\n  | Also | with  |\n  |------|-------|\n  | any  | table |"
    },
    {
        key: "{{from-to}}",
        search: "lia-effect-block",
        replace: "    {from-to}\n",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use block effects to let entire Markdown blocks appear or disappear. It works exactly as simple inline effects. But the number of appearance has to be put in double braces, followed by a hyphen (-) and the number of disappearance.\nThe entire block can also be styled and the animation tweaked, but the required comment tag has to be defined before the Markdown block. Animate.css is included at default.\n\nExamples:\n                   {{1-4}}\n  This entire block will appear with the first fragment.\n  And remain untill the fourth fragment of this slide.\n\n                   {{0-1}}\n  ```js\n  // I will be present emeadiately and disapper on the\n  // 1st fragment.\n  ```\n\n  &lt;!-- class = &quot;animated rollIn&quot; --&gt;\n       {{3-4}}\n  | Also | with  |\n  |------|-------|\n  | any  | table |"
    },
    {
        key: "{{number}} *** ... ***",
        search: "lia-effect-multiblock",
        replace: "                 {{number}}\n************************************************\n\nInsert your Markdown blocks in here ...\n\n***********************************************",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can bundle multiple blocks to one effect block by enclosing them into two lines of stars (*). The rest works exactly as block effects...\nThe entire block can also be styled and the animation tweaked, but the required comment tag has to be defined before the Markdown block. Animate.css is included at default.\n\nExamples:\n                    {{1}}\n  *************************************************\n\n  Both blocks will appear at once. Nesting of other\n  {2}{inline} and block effects is also allowed.\n\n\n  | Also | with  |\n  |------|-------|\n  | any  | table |\n\n  **************************************************"
    },
    {
        key: "{{from-to}} *** ... ***",
        search: "lia-effect-multiblock2",
        replace: "                 {{from-to}}\n************************************************\n\nInsert your Markdown blocks in here ...\n\n***********************************************",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can bundle multiple blocks to one effect block by enclosing them into two lines of stars (*). The rest works exactly as block effects...\nThe entire block can also be styled and the animation tweaked, but the required comment tag has to be defined before the Markdown block. Animate.css is included at default.\n\nExamples:\n                    {{1-3}}\n  *************************************************\n\n  Both blocks will appear at once and disappear at\n  the third fragment. Nesting of other {2}{inline}\n  and block effects is also allowed.\n\n\n  | Also | with  |\n  |------|-------|\n  | any  | table |\n\n  **************************************************"
    },
    {
        key: "&lt;!-- class=&quot;animated rollIn&quot; ... --&gt;",
        search: "lia-effect-animate-example",
        replace: "<!-- class=\"animated rollIn\" style=\"animation-delay: 3s;\" --",
        icon: "<span style=\"color:#ff0\">\ud83d\udcab</span>",
        url: "https://github.com/daneden/animate.css/",
        helpMsg: "This is only an example of how Animate.css can be used to tweak your effects. Additional CSS magic can be applied onto single elements or blocks by adding a comment tag either in front of the block or directly after the element.\n\nExample:\n\n  &lt;!-- class = &quot;animated rollIn&quot; style = &quot;animation-delay: 3s; color: purple&quot; --&gt;\n  The whole text-block should appear in purple color and with a wobbling effect.\n  Which is a **bad** example, please use it with caution ...\n  ~~ Jumping red ~~ &lt;!-- class = &quot;animated infinite bounce&quot; style = &quot;color: red;&quot; --&gt;\n\nFor more information how to change the animation styles, click on the link below."
    },
    {
        key: "[name](url)",
        search: "lia-link",
        replace: "[name](url",
        icon: "<span style=\"color:#ff0\">\ud83d\udd17</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Links can be added in many ways to a document (relative or absolute), either in common Markdown style by enclosed brackets ([]) and parentheses (()), or directly if it starts with http or www and matches the common url pattern.\nIf you want to navigate within the current document, use hash tag and the number of the slide.\nAnd you can add additional html and css options by adding a trailing comment.\n\nExamples:\n  [LiaScript](https://liascript.github.io)\n\n  Also an accepted link: https://liascript.github.io\n\n  Local navigation by slide number: [top](#1)\n\n  Local navigation by slide title: [top](#some-title)\n\n  With styling [LiaScript](https://liascript.github.io)&lt;!--\n    title = &quot;click me&quot;\n    style = &quot;color: red;&quot;\n  --&gt;"
    },
    {
        key: "[name](url &quot;info&quot;)",
        search: "lia-link-info",
        replace: "[name](url \"info\"",
        icon: "<span style=\"color:#ff0\">\ud83d\udd17</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "An optional information can be attached to every link by adding double quotes after the link in the parentheses.\n\nExamples:\n  [LiaScript](https://liascript.github.io &quot;click Me&quot;)\n\n  Local navigation:\n    [top](#1 &quot;by slide number&quot;)\n    [top](#and-the-title-is &quot;by slide title&quot;)"
    },
    {
        key: "![alt-text](image-url)",
        search: "lia-image",
        replace: "![alt-text](image-url",
        icon: "<span style=\"color:#ff0\">\ud83d\uddbc</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Include images via the common Markdown notation as depicted below, by using absolute or relative paths. In contrast to common Markdown you can add also styles, classes, or any other allowed image tag to it simply by appending a comment tag.\n\nExample:\n\n  ![image of a puppy](https://upload.wikimedia.org/wikipedia/commons/c/c7/Puppy_on_Halong_Bay.jpg)\n\n  ![relative](./img/puppy.jpg)\n\n  ![with styling](./img/puppy.jpg)&lt;!--\n      title = &quot;a gray puppy&quot;\n      width = &quot;300px&quot;\n      style = &quot;border: 10px solid; filter: grayscale(100%);&quot;\n    --&gt;"
    },
    {
        key: "![alt-text](image-url &quot;info&quot;)",
        search: "lia-image-info",
        replace: "![alt-text](image-url \"info\"",
        icon: "<span style=\"color:#ff0\">\ud83d\uddbc</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "An optional information can be attached to every image by adding double quotes after the link in the parentheses.\n\nExample:\n\n  ![image of a puppy](https://upload.wikimedia.org/wikipedia/commons/c/c7/Puppy_on_Halong_Bay.jpg &quot;looks cute&quot;)\n\n  ![relative](./img/puppy.jpg &quot;optional info&quot;)"
    },
    {
        key: "?[alt-text](audio-url)",
        search: "lia-audio",
        replace: "?[alt-text](audio-url",
        icon: "<span style=\"color:#ff0\">\ud83c\udfb5</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Including audio is done with a starting question mark (?) that is followed a common Markdown link. If you want to include soundcloud, then you only have to refer to the link and the player gets embedded into your course.\n\nExample:\n\n  ?[singing birds](https://bigsoundbank.com/UPLOAD/mp3/1068.mp3)\n\n  ?[soundcloud](https://soundcloud.com/glennmorrison/beethoven-moonlight-sonata)"
    },
    {
        key: "?[alt-text](audio-url &quot;info&quot;)",
        search: "lia-audio-info",
        replace: "?[alt-text](audio-url \"info\"",
        icon: "<span style=\"color:#ff0\">\ud83c\udfb5</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "An optional information can be attached to every audio file by adding double quotes after the link in the parentheses.\n\nExample:\n\n  ?[singing birds](https://bigsoundbank.com/UPLOAD/mp3/1068.mp3 &quot;optional infos&quot;)"
    },
    {
        key: "!?[alt-text](movie-url)",
        search: "lia-movie",
        replace: "!?[alt-text](movie-url",
        icon: "<span style=\"color:#ff0\">\ud83c\udf9e</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Include movies is like combining images and sound by a starting exclamation mark followed by a question mark (!?) as depicted below. Paths can either be absolute or relative. You can add also styles, classes, or any other allowed options to it simply by appending a comment tag.\n\nTo simplify the usage, you can directly use the YouTube link, or Vimeo, or TeacherTube. Those resources are atomatically parsed and included appropriately into the document, without searching for an embed-code.\n\nExample:\n\n  !?[eLab](https://www.youtube.com/watch?v=bICfKRyKTwE)\n\n  !?[relative](./mov/video.mp4)\n\n  !?[eLab](https://www.youtube.com/watch?v=bICfKRyKTwE)&lt;!--\n      title = &quot;the elab in gray&quot;\n      width = &quot;90%&quot;\n      style = &quot;border: 10px solid; filter: grayscale(100%);&quot;\n    --&gt;\n\nBut it is still possible to use HTML to include Videos and other stuff ...\n\n  &lt;iframe width=&quot;560&quot; height=&quot;315&quot; src=&quot;https://www.youtube.com/embed/bICfKRyKTwE&quot; frameborder=&quot;0&quot; allow=&quot;autoplay; encrypted-media&quot; allowfullscreen&gt;&lt;/iframe&gt;"
    },
    {
        key: "[^ref](text)",
        search: "lia-footnote-inline",
        replace: "[^ref](explanation",
        icon: "<span style=\"color:#ff0\">\ud83d\udc3e</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Inline Footnotes are composed of a reference in brackets with a starting caret. The following text has to be put into parentheses, only one line is allowed.\n\n   Example with [^1](inline _footnote_) and some more text."
    },
    {
        key: "[^ref]",
        search: "lia-footnote-reference",
        replace: "[^ref",
        icon: "<span style=\"color:#ff0\">\ud83d\udc3e</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Multiline footnotes have to be split into a reference and into a comment. Footnote references are defined by brackets with a starting caret and can appear everywhere within the text. Footnote texts have to be put into the end of each section.\n\nExample:\n\nHere is a footnote reference, [^1] and another.[^longnote]\n\n...\n\n[^1]: Here is the footnote text.\n\n[^longnote]: Here&#x27;s one with multiple blocks.\n\n               Subsequent paragraphs are indented to show that they\n               belong to the previous footnote."
    },
    {
        key: "[^ref]: some comments ...",
        search: "lia-footnote-text",
        replace: "[^ref]: some comments",
        icon: "<span style=\"color:#ff0\">\ud83d\udc3e</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Multiline footnotes have to be split into a reference and into a comment. Footnote texts start with a reference &quot;tag&quot;, which is followed by a colon. They have to be put into the end of each section otherwise they are not interpreted as footnote texts and multi-block footnotes have to follow the previous indentation.\nExample:\n...\n\n[^1]: Here is the footnote text.\n\n[^longnote]: Here&#x27;s one with multiple blocks.\n\n               Subsequent paragraphs are indented to show that they\n               belong to the previous footnote."
    },
    {
        key: "$ f(x) = (x^2+5)^3 $",
        search: "lia-formula-inline",
        replace: "$ ${1:f(a,b,c) = (a^2+b^2+c^2)^3} $",
        icon: "<span style=\"color:#ff0\">\ud835\udf45\u00b2</span>",
        url: "https://khan.github.io/KaTeX/docs/supported.html",
        helpMsg: "Insert a mathematical formula (inline) within your text. It has to be enclosed with two single dollar signs, as shown in the example.\n\nExample: $ f(a,b,c) = (a^2+b^2+c^2)^3 $\n\nFormulas are rendered with KaTex, so click on the link below to get more information and examples on the applied notation."
    },
    {
        key: "$$ \\sum_\\{i=1\\}^\\\\infty\\ ... $$",
        search: "lia-formula-block",
        replace: "$$\n   ${1:\\\\sum_\\{i=1\\}^\\\\infty\\\\frac\\{1\\}\\{n^2\\}\n        =\\\\frac\\{\\\\pi^2\\}\\{6\\}}\n$$",
        icon: "<span style=\"color:#ff0\">\ud835\udf45\u00b2</span>",
        url: "https://khan.github.io/KaTeX/docs/supported.html",
        helpMsg: "Insert a more multiline mathematical formula as a block, which is automatically centered within your document. It has to be enclosed with two dollar signs, as shown in the example.\n\nExample:\n\n$$\n   \\sum_{i=1}^\\infty\\frac{1}{n^2}\n        =\\frac{\\pi^2}{6}\n$$\n\nFormulas are rendered with KaTex, so click on the link below to get more information and examples on the applied notation."
    },
    {
        key: "&lt;!-- name: ...",
        search: "lia-header-main",
        replace: "<!--\nauthor:   Your Name\nemail:    your@email.com\nversion:  0.1.0\nlanguage: en\nnarrator: US English Female\n\ncomment:  This simple description of your course.\n          Multiline is also okay.\n\nlink:     https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css\n\nscript:   https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js\n\ntranslation: Fran\u00e7ais translations/French.md\n--",
        icon: "<span style=\"color:#ff0\">\ud83d\udcc4</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "  The main header is a comment of the following format. You can use it to define defaults, such as authors, emails, where to find translations, what JavaScript and styles should be loaded additionally, as well as the language of your course.\n  You can change some of these settings within a sub-header for each section individually.\n\n  Default:\n      language: (en) | de | ua | fa | hy | bg\n      narrator: US English Male\n\n  Example:\n\n      &lt;!--\n      author:   Your Name\n      email:    your@email.com\n      version:  0.1.0\n      language: en\n      narrator: US English Female\n\n      comment:  This simple description of your course.\n                Multiline is also okay.\n\n      link:     https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css\n                https://...\n\n      script:   https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js\n                https://...\n\n      translation: Fran\u00e7ais translations/French.md\n      translation: \u65e5\u672c\u8a9e    translations/Japanese.md\n      --&gt;\n\n      # Course ...\n\nAnd you can refer to these values via the system macros:\n\n    @author\n    @email\n    @version"
    },
    {
        key: "&lt;!-- name: ... --&gt;",
        search: "lia-header-section",
        replace: "<!--\nauthor:   Section Author\nemail:    section.author@email.com\nversion:  0.1.0\nnarrator: UK English Female\n\nlink:     https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css\n\nscript:   https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js\n--",
        icon: "<span style=\"color:#ff0\">\ud83d\udcc4</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can overwrite some main header settings as it is listed below. Just attach a comment to the section title and overwrite only those settings, that are relevant to you.\n\nExample:\n\n    ...\n    # Course\n    ...\n    ## Section\n    &lt;!--\n    narrator: Australian Female\n    --&gt;\n    ...\n    ### Sub Section\n    &lt;!--\n    author:   Section Author\n    email:    section.author@email.com\n    version:  0.1.0\n    narrator: Australian Female\n\n    link:     https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css\n    script:   https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js\n    --&gt;"
    },
    {
        key: "&lt; ... # ... [",
        search: "lia-init",
        replace: "<!--\nauthor:   Your Name\n\nemail:    your@mail.org\n\nversion:  0.0.1\n\nlanguage: en\n\nnarrator: US English Female\n\ncomment:  Try to write a short comment about\n          your course, multiline is also okay.\n\nlink:     https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css\n\nscript:   https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js\n\ntranslation: Deutsch  translations/German.md\n\ntranslation: Fran\u00e7ais translations/French.md\n-->\n\n# Course Main Title\n\nThis is your **course** initialization stub.\n\nPlease see the [Docs](https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md)\nto find out what is possible in [LiaScript](https://liascript.github.io).\n\nIf you want to use instant help in your Atom IDE, please type **lia** to see all available shortcuts.\n\n## Markdown\n\nYou can use common [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) syntax to create your course, such as:\n\n1. Lists\n2. ordered or\n\n   * unordered\n   * ones ...\n\n\n| Header 1   | Header 2   |\n| :--------- | :--------- |\n| Item 1     | Item 2     |\n\n\nImages:\n\n![images](https://farm2.static.flickr.com/1618/26701766821_7bea494826.jpg)\n\n\n### Extensions\n\n     --{{0}}--\nBut you can also include other features such as spoken text.\n\n      --{{1}}--\nInsert any kind of audio file:\n\n       {{1}}\n?[audio](https://bigsoundbank.com/UPLOAD/mp3/1068.mp3)\n\n\n     --{{2}}--\nEven videos or change the language completely.\n\n       {{2-3}}\n!?[video](https://www.youtube.com/watch?v=bICfKRyKTwE)\n\n\n      --{{3 Russian Female}}--\n\u041f\u0435\u0440\u0432\u043e\u043d\u0430\u0447\u0430\u043b\u044c\u043d\u043e \u0441\u043e\u0437\u0434\u0430\u043d \u0432 2004 \u0433\u043e\u0434\u0443 \u0414\u0436\u043e\u043d\u043e\u043c \u0413\u0440\u0443\u0431\u0435\u0440\u043e\u043c (\u0430\u043d\u0433\u043b. John Gruber) \u0438 \u0410\u0430\u0440\u043e\u043d\u043e\u043c\n\u0428\u0432\u0430\u0440\u0446\u0435\u043c. \u041c\u043d\u043e\u0433\u0438\u0435 \u0438\u0434\u0435\u0438 \u044f\u0437\u044b\u043a\u0430 \u0431\u044b\u043b\u0438 \u043f\u043e\u0437\u0430\u0438\u043c\u0441\u0442\u0432\u043e\u0432\u0430\u043d\u044b \u0438\u0437 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0445 \u0441\u043e\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0439 \u043f\u043e\n\u0440\u0430\u0437\u043c\u0435\u0442\u043a\u0435 \u0442\u0435\u043a\u0441\u0442\u0430 \u0432 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u044b\u0445 \u043f\u0438\u0441\u044c\u043c\u0430\u0445...\n\n\n    {{3}}\nType \"voice\" to see a list of all available languages.\n\n\n### Styling\n\n<!-- class = \"animated rollIn\" style = \"animation-delay: 2s; color: purple\" -->\nThe whole text-block should appear in purple color and with a wobbling effect.\nWhich is a **bad** example, please use it with caution ...\n~~ only this is red ;-) ~~ <!-- class = \"animated infinite bounce\" style = \"color: red;\" -->\n\n## Charts\n\nUse ASCII-Art to draw diagrams:\n\n                                    Multiline\n    1.9 |    DOTS\n        |                 ***\n      y |               *     *\n      - | r r r r r r r*r r r r*r r r r r r r\n      a |             *         *\n      x |            *           *\n      i | B B B B B * B B B B B B * B B B B B\n      s |         *                 *\n        | *  * *                       * *  *\n     -1 +------------------------------------\n        0              x-axis               1\n\n## Quizzes\n\n### A Textquiz\n\nWhat did the **fish** say when he hit a **concrete wall**?\n\n    [[dam]]\n\n### Multiple Choice\n\nJust add as many points as you wish:\n\n    [[X]] Only the **X** marks the correct point.\n    [[ ]] Empty ones are wrong.\n    [[X]] ...\n\n### Single Choice\n\nJust add as many points as you wish:\n\n    [( )] ...\n    [(X)] <-- Only the **X** is allowed.\n    [( )] ...\n\n## Executable Code\n\nA drawing example, for demonstrating that any JavaScript library can be used, also for drawing.\n\n```javascript\n// Initialize a Line chart in the container with the ID chart1\nnew Chartist.Line('#chart1', {\n  labels: [1, 2, 3, 4],\n  series: [[100, 120, 180, 200]]\n});\n\n// Initialize a Line chart in the container with the ID chart2\nnew Chartist.Bar('#chart2', {\n  labels: [1, 2, 3, 4],\n  series: [[5, 2, 8, 3]]\n});\n```\n<script>@input</script>\n\n<div class=\"ct-chart ct-golden-section\" id=\"chart1\"></div>\n<div class=\"ct-chart ct-golden-section\" id=\"chart2\"></div>\n\n\n### Projects\n\nYou can make your code executable and define projects:\n\n``` js     -EvalScript.js\nlet who = data.first_name + \" \" + data.last_name;\n\nif(data.online) {\n  who + \" is online\"; }\nelse {\n  who + \" is NOT online\"; }\n```\n``` json    +Data.json\n{\n  \"first_name\" :  \"Sammy\",\n  \"last_name\"  :  \"Shark\",\n  \"online\"     :  true\n}\n```\n<script>\n  // insert the JSON dataset into the local variable data\n  let data = @input(1);\n\n  // eval the script that uses this dataset\n  eval(`@input(0)`);\n</script>\n\n## More\n\nFind out what you can even do more with quizzes:\n\nhttps://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.m",
        icon: "<span style=\"color:#ff0\">\ud83d\ude80</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Initialize your file with a complete dummy course with a header and body, which can be used as a bootstrap for your course.\n\nExample:\n\n    &lt;!--\n    author:   Your Name\n\n    email:    your@mail.org\n\n    version:  0.0.1\n\n    language: en\n\n    narrator: US English Female\n\n    ...\n    --&gt;\n\n    # Course Main Title\n\n    This is your **course** initialization stub..."
    },
    {
        key: "1. ... 2. ... 3. ...",
        search: "lia-list-ordered",
        replace: "1. block\n2. block\n3. block",
        icon: "<span style=\"color:#ff0\">\ud834\udf06</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Insert a Markdown ordered list, as depicted below. Indentation is important in this case.\n\nExample:\n  1. first point\n  2. second point\n  3. some text\n\n     and some image ![image](img/point.jpg)"
    },
    {
        key: "* ... + ... - ...",
        search: "lia-list-unordered",
        replace: "+ block\n+ block\n+ block",
        icon: "<span style=\"color:#ff0\">\ud834\udf06</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Insert a Markdown unordered list, as depicted below. You can use (*+-) to begin every point. Indentation is important in this case.\n\nExample:\n  * first point\n  + second point\n  - some text\n\n    and some image ![image](img/point.jpg)"
    },
    {
        key: "@author",
        search: "lia-macro-author",
        replace: "@autho",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Gets replaced by the author defined in the header."
    },
    {
        key: "@date",
        search: "lia-macro-date",
        replace: "@dat",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Gets replaced by the date defined in the header."
    },
    {
        key: "@email",
        search: "lia-macro-email",
        replace: "@emai",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Gets replaced by the email defined in the header."
    },
    {
        key: "@input",
        search: "lia-macro-input",
        replace: "@inpu",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use this only in conjunction with executable code and projects or with quizzes. This macro can only be used in a script tag and gets replaced by the current user input.\nTo refer to the inputs in a project, use the parameterized macro:\n\n  @input(0)   &lt;== equal to @input\n  @input(1)"
    },
    {
        key: "@section",
        search: "lia-macro-section",
        replace: "@sectio",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Gets replaced by the current section number."
    },
    {
        key: "@uid",
        search: "lia-macro-uid",
        replace: "@ui",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Generates a UID that can be used to name tags uniquely."
    },
    {
        key: "@version",
        search: "lia-macro-version",
        replace: "@versio",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Gets replaced by the version defined in the header."
    },
    {
        key: "import",
        search: "lia-macro-import",
        replace: "import: url",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/templates/master/README.md",
        helpMsg: "You can import the main macros of other courses, simply by using the import command, which is followed by the raw url of the foreign course.\n\nExample:\n\n  ## section\n  &lt;!--\n  import: https://raw.githubusercontent.com/liaTemplates/rextester_template/master/README.md\n  --&gt;\n\n  ``` python\n  print(&quot;Hello World&quot;)\n  ```\n  @Rextester.eval(@Python)"
    },
    {
        key: "attribute",
        search: "lia-macro-attribute",
        replace: "attribute: thx",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/templates/master/README.md",
        helpMsg: "Attribution is an important issue. With the attribute command, you can define the attribution that is showed within the info field within the navigation pannel. These elements get also imported if you import the functionality from another course.\n\nA good attribution might look like the follwing ones...\n\nExample:\n  &lt;!--\n  attribute: [AlaSQL](https://alasql.org)\n             by [Andrey Gershun](agershun@gmail.com)\n             &amp; [Mathias Rangel Wulff](m@rawu.dk)\n             is licensed under [MIT](https://opensource.org/licenses/MIT)\n\n  attribute: [PapaParse](https://www.papaparse.com)\n             by [Matthew Holt](https://twitter.com/mholt6)\n             is licensed under [MIT](https://opensource.org/licenses/MIT)\n  --&gt;\n"
    },
    {
        key: "dark",
        search: "lia-macro-dark",
        replace: "dark: true",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/templates/master/README.md",
        helpMsg: "You can change the default appearance of your document, either if you prefer dark mode or light mode. This will not change the user preferences. The default mode is defined by the user settings.\n\nExample:\n  &lt;!--\n  dark: true\n\n  dark: false\n  --&gt;\n"
    },
    {
        key: "mode",
        search: "lia-macro-mode",
        replace: "mode: Presentation",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/templates/master/README.md",
        helpMsg: "You can change the default style of your document, either if you do not have any effects you can set mode to Textbook or start with and interactive Presentation. The three modes a the same as defined within the document at the upper right button. The default mode is defined by the user settings.\n\nExample:\n  &lt;!--\n  mode: Presentation\n\n  mode: Slides\n\n  mode: Textbook\n  --&gt;\n"
    },
    {
        key: "@name: one line",
        search: "lia-macro-definition-line",
        replace: "@name: line",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use macros to deal with repetitive task and to make the document more readable. You can define your own macros within the main and section headers. Start your macro with an (@) sign and give it a name. Separate the name from the body with a colon (:). If you want to parameterize your macro, use @0, @1, ... for the parameter id. It is a simple string substitution mechanism, and the parameters are separated by a comma (,). If you have commas in your parameters, then use back-tics (`) to enclose this parameter. And triple back-tics (```) to enclose multi-line parameters.\n\nExample:\n\n  ## section\n  &lt;!--\n  @red: &lt;!-- style=&quot;color: red;&quot; --&gt;\n\n  @bold_italic: __@0__ _@1_\n  --&gt;\n\n  @red\n  This whole paragraph will be read and this will be:\n  @bold_italic(I am Bold,`I am Italic,, I am too`)."
    },
    {
        key: "@name ... body ... @end",
        search: "lia-macro-definition-block",
        replace: "@name\nparam1 -> __@0__\n@en",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Use macros to deal with repetitive task and to make the document more readable. Multi-line macros start with an (@your_name) and end with (@end). Parameters can also be passed as to single line macros.\n\nExample:\n\n  ## section\n  &lt;!--\n  @evalJS\n  &lt;script&gt;\n    try{\n      eval(`@input`);\n    } catch (e) {\n      var log = e.stack.match(/((.*?):(.*))\n.*?(:(d+):(d+))\n)/);\n      var err_msg = new LiaError(log[1] + &quot; =&gt;  (&quot; + log[4], 1);\n      err_msg.add_detail(0, log[3], &quot;error&quot;, log[5]-1, log[6]);\n      throw err_msg;\n    }\n  &lt;/script&gt;\n  @end\n  --&gt;\n\n  eval this code with erros:\n\n  ```js\n  let x = 12;\n  x * c;\n  ```\n  @evalJS"
    },
    {
        key: "``` @macro ```",
        search: "lia-macro-call-block",
        replace: "```lang @macro\na multiline\nparameter\n``",
        icon: "<span style=\"color:#ff0\">\ud83d\udee0</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/mermaid_template/master/README.md",
        helpMsg: "If you have a more complex multi-line macro definition, you can also use the following style so that it gets rendered at least in a readable manner by Github for example. Thus, you can place your macro call into into the code-block header, the first (optional) language parameter gets ignored and, whereby the following elements within the block are passed as the last multi-line parameter to that call.\n\nExample:\n\n    ## Macro\n    &lt;!--\n    link:   https://pannellum.org/css/style.css\n            https://cdn.pannellum.org/2.4/pannellum.css\n\n    script: https://cdn.pannellum.org/2.4/pannellum.js\n\n    @panorama\n    &lt;div id=&quot;panorama_@0&quot; style=&quot;width: 100%; height: 400px;&quot;&gt;&lt;/div&gt;\n    &lt;script&gt;\n    pannellum.viewer(&#x27;panorama_@0&#x27;, {\n        &quot;type&quot;: &quot;equirectangular&quot;,\n        &quot;panorama&quot;: &quot;@1&quot;,\n        &quot;autoLoad&quot;: false,\n        &quot;hotSpots&quot;: [@2]\n    });\n    &lt;/script&gt;\n    @end\n    --&gt;\n\n    ```json @panorama(&quot;0&quot;,https://pannellum.org/images/cerro-toco-0.jpg)\n    {\n        &quot;pitch&quot;: 14.1,\n        &quot;yaw&quot;: 1.5,\n        &quot;type&quot;: &quot;info&quot;,\n        &quot;text&quot;: &quot;Baltimore Museum of Art&quot;,\n        &quot;URL&quot;: &quot;https://artbma.org/&quot;\n    },\n    {\n        &quot;pitch&quot;: -0.9,\n        &quot;yaw&quot;: 144.4,\n        &quot;type&quot;: &quot;info&quot;,\n        &quot;text&quot;: &quot;North Charles Street&quot;\n    }\n    ```"
    },
    {
        key: "---",
        search: "lia-horizontal-line",
        replace: "----------------------",
        icon: "<span style=\"color:#ff0\">\ud83d\udccf</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "Horizontal lines are realized by adding at least 3 hyphens in a row (---), but more hyphens look a little bit nicer ;)\n\nExample:\n  This is a horizontal line:\n\n    ---\n\n  And this also:\n\n  ---------------------------------------------"
    },
    {
        key: "&gt; ...",
        search: "lia-quote",
        replace: "> your quote",
        icon: "<span style=\"color:#ff0\">\ud83d\udccc</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "Insert single line quotes or quote blocks just with the help of a starting (&gt;).\n\nExample:\n  &gt; Block-quotes are very handy in email to emulate reply text.\n  &gt; This line is part of the same quote.\n\n  Quote break.\n\n  &gt; This is a very long line that will still be quoted properly when it wraps. Oh boy let&#x27;s keep writing to make sure this is long enough to actually wrap for everyone. Oh, you can *put* **Markdown** into a block-quote."
    },
    {
        key: "# Main Title",
        search: "lia-title-1",
        replace: "# Main Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "## Chapter Title",
        search: "lia-title-2",
        replace: "## Chapter Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "### Section Title",
        search: "lia-title-3",
        replace: "### Section Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "#### SubSection Title",
        search: "lia-title-4",
        replace: "#### SubSection Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "##### Paragraph Title",
        search: "lia-title-5",
        replace: "##### Paragraph Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "###### SubParagraph Title",
        search: "lia-title-6",
        replace: "##### SubParagraph Title",
        icon: "<span style=\"color:#ff0\">\ud83d\uddc2</span>",
        url: "https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet",
        helpMsg: "As in common Markdown, a document is segregated into different parts by its titles. A title starts with hash-tag (#) that is followed by an head-line. The number of subsequent hash-tags defines the order. It is furthermore possible to overwrite some of the definitions from the main header, see more information on this by typing &quot;liaheadersection&quot; ...\n\nExample:\n  # Main Title\n\n  ...\n\n  ## Chapter Title\n  &lt;!--\n  comment: This comment is only for demonstrating purposes\n           and will be overwritten within the next slide...\n\n  author:  New Author\n  email:   notmain@email.com\n  --&gt;\n\n  ...\n\n  ### Section __Title__\n\n  ...\n\nIt is possible to add styling elements to the titles, but this should be used only in some rare cases."
    },
    {
        key: "[[___ ___]]",
        search: "lia-survey-text",
        replace: "[[___ ___]",
        icon: "<span style=\"color:#ff0\">\ud83d\udccb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Surveys are defined similarly to quizzes by using brackets ([]). A text survey is defined by a multiple number three subsequent underscores (___) that are enclosed by double brackets. The number of underscores defines the number of lines a user has to fill out.\n\nExample:\n\n  A single line text survey:\n\n    [[___]]\n\n  A two line text survey:\n\n    [[___ ___]]\n\n  And a six liner:\n\n    [[___ ___ ___ ___ ___ ___ ]]"
    },
    {
        key: "[(1)]...[(:...)]...",
        search: "lia-survey-single-choice",
        replace: "[(1)] option 1\n[(2)] option 2\n[(3)] option 3",
        icon: "<span style=\"color:#ff0\">\ud83d\udccb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "The definition is similar to a single choice quiz, but instead of an X, either numbers have to be put into parentheses or variable names. They do not have to be ordered and the number is also variable.\n\nExample:\n\n  Choose between different options:\n\n    [(1)] option 1\n    [(2)] option 2\n    [(0)] option 3\n\n  What is your favorite color:\n\n    [(red)]   red?\n    [(blue)]  blue?\n    [(green)] green?"
    },
    {
        key: "[[1]]...[[:...]]...",
        search: "lia-survey-multiple-choice",
        replace: "[[1]] option 1\n[[2]] option 2\n[[3]] option 3",
        icon: "<span style=\"color:#ff0\">\ud83d\udccb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "The definition is similar to a multiple choice quiz, but instead of an X, either numbers have to be put into parentheses or variable names. They do not have to be ordered and the number is also variable.\n\nExample:\n\n  Choose as many options as your want:\n\n    [[1]] option 1\n    [[2]] option 2\n    [[0]] option 0\n\n  Mark all colors you like:\n\n    [[red]]   red?\n    [[blue]]  blue?\n    [[green]] green?\n    [[none]]  None of these ..."
    },
    {
        key: "[(1)(2)(0)]",
        search: "lia-survey-single-choice-matrix",
        replace: "[(0)(1)(2)]\n[         ] text\n[         ] text\n[         ] text",
        icon: "<span style=\"color:#ff0\">\ud83d\udccb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "A list of single choice surveys can be defined as depicted below. Either numbers have to be put into parentheses or variable. They do not have to be ordered and the number is also variable.\n\nExample:\n\n  Give marks:\n\n      [(-1)(0)(1)]\n      [          ] LiaScript is great?\n      [          ] I would use it to make online **courses**?\n      [          ] I would use it for online **surveys**?\n\n  What is your opinion:\n\n      [(agree)(unsure)(maybe not so)]\n      [                             ] LiaScript is great?\n      [                             ] I would use it to make online **courses**?\n      [                             ] I would use it for online **surveys**?"
    },
    {
        key: "[[1][2][0]]",
        search: "lia-survey-multiple-choice-matrix",
        replace: "[[0][1][2]]\n[         ] text\n[         ] text\n[         ] text",
        icon: "<span style=\"color:#ff0\">\ud83d\udccb</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "A list of multiple choice surveys can be defined as depicted below. Either numbers have to be put into parentheses or variable names. They do not have to be ordered and the number is also variable.\n\nExample:\n\n  Give marks:\n\n      [[-1][0][1]]\n      [          ] LiaScript is great?\n      [          ] I would use it to make online **courses**?\n      [          ] I would use it for online **surveys**?\n\n  What is your opinion:\n\n      [[agree][unsure][maybe not so]]\n      [                             ] LiaScript is great?\n      [                             ] I would use it to make online **courses**?\n      [                             ] I would use it for online **surveys**?"
    },
    {
        key: "1 colum table",
        search: "lia-table-1",
        replace: "| Header     |\n| :--------- |\n| Item       ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "2 colum table",
        search: "lia-table-2",
        replace: "| Header 1   | Header 2   |\n| :--------- | :--------- |\n| Item 1     | Item 2     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "3 colum table",
        search: "lia-table-3",
        replace: "| Header 1   | Header 2   | Header 3   |\n| :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "4 colum table",
        search: "lia-table-4",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   |\n| :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "5 colum table",
        search: "lia-table-5",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   | Header 5   |\n| :--------- | :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     | Item 5     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "6 colum table",
        search: "lia-table-6",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   | Header 5   | Header 6   |\n| :--------- | :--------- | :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     | Item 5     | Item 6     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "7 colum table",
        search: "lia-table-7",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   | Header 5   | Header 6   | Header 7   |\n| :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     | Item 5     | Item 6     | Item 7     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "8 colum table",
        search: "lia-table-8",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   | Header 5   | Header 6   | Header 7   | Header 8   |\n| :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     | Item 5     | Item 6     | Item 7     | Item 8     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "9 colum table",
        search: "lia-table-9",
        replace: "| Header 1   | Header 2   | Header 3   | Header 4   | Header 5   | Header 6   | Header 7   | Header 8   | Header 9   |\n| :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- | :--------- |\n| Item 1     | Item 2     | Item 3     | Item 4     | Item 5     | Item 6     | Item 7     | Item 8     | Item 9     ",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "There must be at least 3 dashes separating each header cell. Cells are separated by pipes (|), and you don&#x27;t need to make the raw Markdown line up prettily. Hyphens (-) are used to separate the table header from the body, whereby the colons are used to align the columns.\n\nExample:\n\n| Tables        | Are           | Cool  |\n| ------------- |:-------------:| -----:|\n| col 3 is      | right-aligned | $1600 |\n| col 2 is      | centered      |   $12 |\n| zebra stripes | are neat      |    $1 |"
    },
    {
        key: "&lt;!-- data-title=&quot;...&quot; --&gt;",
        search: "lia-table-diagram-title",
        replace: "<!-- data-title=\"title\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can set the diagram title for your plotted document via the data-title parameter, this is only visible if you switch to the diagram mode.\n\nExample:\n  &lt;!--\n  data-title=&quot;Government expenditure on education&quot;\n  data-xlabel=&quot;year&quot;\n  data-ylabel=&quot;% of GDP&quot;\n  --&gt;\n  | Year | Finland | USA | Germany |   China |\n  | ---- | -------:| ---:| -------:| -------:|\n  | 1995 | 6.80942 |     | 4.42079 | 1.84192 |\n  | 1996 | 6.86052 |     | 4.48319 | 1.85338 |\n  | ...  |     ... | ... |     ... |     ... |"
    },
    {
        key: "&lt;!-- data-xlabel=&quot;...&quot; --&gt;",
        search: "lia-table-diagram-xlabel",
        replace: "<!-- data-xlabel=\"title\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can overwrite the diagram x-label for your plotted document via the data-xlabel parameter, this is only visible if you switch to the diagram mode.\n\nExample:\n  &lt;!--\n  data-title=&quot;Government expenditure on education&quot;\n  data-xlabel=&quot;year&quot;\n  data-ylabel=&quot;% of GDP&quot;\n  --&gt;\n  | Year | Finland | USA | Germany |   China |\n  | ---- | -------:| ---:| -------:| -------:|\n  | 1995 | 6.80942 |     | 4.42079 | 1.84192 |\n  | 1996 | 6.86052 |     | 4.48319 | 1.85338 |\n  | ...  |     ... | ... |     ... |     ... |"
    },
    {
        key: "&lt;!-- data-ylabel=&quot;...&quot; --&gt;",
        search: "lia-table-diagram-ylabel",
        replace: "<!-- data-ylabel=\"title\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can overwrite the diagram y-label for your plotted document via the data-ylabel parameter, this is only visible if you switch to the diagram mode.\n\nExample:\n  &lt;!--\n  data-title=&quot;Government expenditure on education&quot;\n  data-xlabel=&quot;year&quot;\n  data-ylabel=&quot;% of GDP&quot;\n  --&gt;\n  | Year | Finland | USA | Germany |   China |\n  | ---- | -------:| ---:| -------:| -------:|\n  | 1995 | 6.80942 |     | 4.42079 | 1.84192 |\n  | 1996 | 6.86052 |     | 4.48319 | 1.85338 |\n  | ...  |     ... | ... |     ... |     ... |"
    },
    {
        key: "&lt;!-- data-type=&quot;...&quot; --&gt;",
        search: "lia-table-diagram-type",
        replace: "<!-- data-type=\"type\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "You can enforce the visualization of a certain type, even if the sturcture of your table might look different.\nCurrently available data-types are: lineplot, scatterplot, boxplot, barchart, radar, piechart, map, heatmap, parallel, graph, sankey, and none\nIf you do not want to show tables as diagrams, you can also use data-type=&quot;None&quot; and only the table will be visible.\n\nExample:\n  &lt;!-- data-type=&quot;pie&quot; --&gt;\n  | Year | Finland | USA | Germany |   China |\n  | ---- | -------:| ---:| -------:| -------:|\n  | 1995 | 6.80942 |     | 4.42079 | 1.84192 |\n  | 1996 | 6.86052 |     | 4.48319 | 1.85338 |\n  | ...  |     ... | ... |     ... |     ... |"
    },
    {
        key: "&lt;!-- data-type=&quot;lineplot&quot; --&gt;",
        search: "lia-table-diagram-lineplot",
        replace: "<!-- data-type=\"lineplot\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If the first column contains (not repeating) numbers as well as the other columns, lineplots are used as the default representation, a special tag is not required. If this isn&#x27;t the case, then you can apply this tag to enforce the visualization as a scatterplot.\n\nExample:\n  &lt;!-- data-type=&quot;lineplot&quot; --&gt;\n  | x&#x27;s |  some y&#x27;s  |    dist |\n  | --- |:----------:| -------:|\n  | 1   |    1 $    | 16 $km$ |\n  | 2.2 |    2 $    | 12 $km$ |\n  | 3.3 |    5 $    |  1 $km$ |\n  | 4   | -12.333 $ |         |"
    },
    {
        key: "&lt;!-- data-type=&quot;scatterplot&quot; --&gt;",
        search: "lia-table-diagram-scatterplot",
        replace: "<!-- data-type=\"scatterplot\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If the first column contains repetitive numbers, scatterplots are used as the default representation if further numbers are determine, a special tag is not required.\n\nExample:\n  &lt;!-- data-type=&quot;scatterplot&quot; --&gt;\n  | x&#x27;s |  some y&#x27;s  |                              dist |\n  | --- |:----------:| ---------------------------------:|\n  | 1   |    1 $    |                           16 $km$ |\n  | 2.2 |    2 $    |                           12 $km$ |\n  | 3.3 |    5 $    |                            1 $km$ |\n  | 4   | -12.333 $ | -555$km$ &lt;-- this will be ignored |\n  | 4   |            |                                 1 |"
    },
    {
        key: "&lt;!-- data-type=&quot;barchart&quot; --&gt;",
        search: "lia-table-diagram-barchart",
        replace: "<!-- data-type=\"barchart\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "In contrast to a line or a scatter plot, if the first colum contains at least one entry thant cannot be parsed as a number, this might be represented also as BarChart. Which works perfectly with the following example. If the maximum values of the columns do not differ to much, then this dataset it represented as a BarChart, otherwise you might end up seeing only one huge bar, while the other bars are indistiguishable from each other. In this case other visualization are chosen.\n\nExample:\n  &lt;!-- data-type=&quot;barchart&quot; --&gt;\n  | Animal          | weight in kg | Lifespan years | Mitogen |\n  | --------------- | ------------:| --------------:| -------:|\n  | Mouse           |        0.028 |              2 |      95 |\n  | Flying squirrel |        0.085 |             15 |      50 |\n  | Brown bat       |        0.020 |             30 |      10 |\n  | Sheep           |           90 |             12 |      95 |\n  | Human           |           68 |             70 |      10 |"
    },
    {
        key: "&lt;!-- data-type=&quot;boxplot&quot; --&gt;",
        search: "lia-table-diagram-boxplot",
        replace: "<!-- data-type=\"boxplot\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If you have a ScatterPlot like representation, but actually want to use this data as primary data for your BoxPlot, you can manually change the type of visualization to BoxPlot, simply by adding the follwing attribute to the head of your table, as it is shown in the snippet below. Columns are then treated as datasets and get visualized accordingly.\n\nExample:\n  &lt;!-- data-type=&quot;boxplot&quot; --&gt;\n  | Random |    I |  II |\n  | ------:| ----:| ---:|\n  |    5.0 |  1.0 |   5 |\n  |    6.0 |  1.0 |   4 |\n  |    7.0 |  1.0 |   5 |\n  |    8.0 |  1.0 |   5 |\n  |    9.0 |  1.0 |   4 |\n  |   10.0 |  1.0 |   5 |\n  |    5.0 | 10.0 |   7 |\n  |    6.0 | 10.0 |   8 |\n  |    7.0 | 10.0 |   7 |\n  |    8.0 | 10.0 |   7 |\n  |    9.0 | 10.0 |   8 |"
    },
    {
        key: "&lt;!-- data-type=&quot;radar&quot; --&gt;",
        search: "lia-table-diagram-radar",
        replace: "<!-- data-type=\"radar\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If for example humans and sheeps are removed from the dataset, then wheight in kg would not be visible in a BarChart at all. In this case a Radar is selected, that allows to analyze data visually with different &quot;y&quot;-axis.\n\nExample:\n  &lt;!-- data-type=&quot;radar&quot; --&gt;\n  | Animal          | weight in kg | Lifespan years | Mitogen |\n  | --------------- | ------------:| --------------:| -------:|\n  | Mouse           |        0.028 |             02 |      95 |\n  | Flying squirrel |        0.085 |             15 |      50 |\n  | Brown bat       |        0.020 |             30 |      10 |"
    },
    {
        key: "&lt;!-- data-type=&quot;piechart&quot; --&gt;",
        search: "lia-table-diagram-piechart",
        replace: "<!-- data-type=\"piechart\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If you have a table with only one row full of numbers, this will be automatically presented as an pie chart. The head represents the categories and the body the quatities.\n\nExample:\n  | Classic | Country | Reggae | Hip-Hop | Hard-Rock | Samba |\n  | -------:| -------:| ------:| -------:| ---------:| -----:|\n  |      50 |      50 |    100 |     200 |       350 |   250 |\n\n  &lt;!-- data-type=&quot;PieChart&quot; --&gt;\n  | Music-Style | Classic | Country | Reggae | Hip-Hop | Hard-Rock | Samba |\n  |:----------- | -------:| -------:| ------:| -------:| ---------:| -----:|\n  | 1994        |      50 |      50 |    100 |     200 |       350 |   250 |\n  | 2014        |      20 |      30 |    100 |     220 |       400 |   230 |\n  | demo 2034   |       5 |      12 |     98 |     293 |       345 |    32 |"
    },
    {
        key: "&lt;!-- data-type=&quot;map&quot; --&gt;",
        search: "lia-table-diagram-map",
        replace: "<!-- data-type=\"map\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "A map is similar to a BarChart from the table structure, but if you want to depict your data on a real map, you will have to add a geojson-file, that contains all relevant data about the form of your countries, states, cities, etc. The first column has to match the names of your objects in your geojson data, that is attached to your table in the following way:\n\nExample:\n  &lt;!-- data-type=&quot;map&quot; data-src=&quot;https://code.highcharts.com/mapdata/custom/europe.geo.json&quot; --&gt;\n  | Country                | percent |\n  | ---------------------- | ------- |\n  | Albania                | 73.5    |\n  | Andorra                | 98.9    |\n  | Armenia                | 72.4    |\n  | ...                    |         |"
    },
    {
        key: "&lt;!-- data-type=&quot;heatmap&quot; --&gt;",
        search: "lia-table-diagram-heatmap",
        replace: "<!-- data-type=\"heatmap\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Another type of visualization is a HeatMap, which is used, if the table head and the first column do only contain numbers, in other words coordinates. If you want to use categories instead of coordinate numbers, you can enforce the usage of a heatmap, with the comment shown below:\n\nExample:\n  &lt;!--\n  data-type=&quot;heatmap&quot;\n  data-title=&quot;Seattle mean temperature in Fahrenheit&quot;\n  data-show\n  --&gt;\n    | Seattle |  Jan |  Feb |  Mar |  Apr |  May |  ... |\n    | -------:| ----:| ----:| ----:| ----:| ----:| ----:|\n    |       0 | 40.7 | 41.5 | 43.6 | 46.6 | 51.4 |  ... |\n    |       2 |  ... |  ... |  ... |  ... |  ... |  ... |"
    },
    {
        key: "&lt;!-- data-type=&quot;parallel&quot; --&gt;",
        search: "lia-table-diagram-parallel",
        replace: "<!-- data-type=\"parallel\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "A Parallel representation jumps in, if there are simply too many categories, so that your BarChart would contain only thin lines.\n\nExample:\n  &lt;!-- data-type=&quot;parallel&quot; --&gt;\n  | Country                | GDP growth (%) | Births per woman | Life expectancy ...\n  | ---------------------- | --------------:| ----------------:| -------------------\n  | Albania                |            7.5 |            1.858 |               76.63\n  | Andorra                |          3.570 |            1.260 |                 NaN\n  | Austria                |          2.178 |            1.414 |               80.44\n  | ...                    |            ... |              ... |                 ..."
    },
    {
        key: "&lt;!-- data-type=&quot;graph&quot; --&gt;",
        search: "lia-table-diagram-graph",
        replace: "<!-- data-type=\"graph\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If the first column and the head of the table are equal, then the interpreter tries to interpret the content of the table as an adjacency matrix, which defines a graph. If those values are symetrical according to the diagonal, then the matrix defines an &quot;undirected graph&quot;.\nIn contrast to this, if those values differ, then the result is simply an an &quot;directed graph&quot;, whereby the values define the strength of the line.\n\nExample:\n  &lt;!-- data-title=&quot;Undirected Graph&quot; --&gt;\n  | Graph |  A  |  B  |  C  |  D  |  E  |\n  |:----- |:---:|:---:|:---:|:---:|:---:|\n  | A     |  0  |  1  |  0  |  1  |  0  |\n  | B     |  1  |  0  |  0  |  1  |  0  |\n  | C     |  0  |  0  |  0  |  0  |  0  |\n  | D     |  1  |  1  |  0  |  0  |  1  |\n  | E     |  0  |  0  |  0  |  1  |  0  |\n\n  &lt;!-- data-title=&quot;Directed Graph&quot; --&gt;\n  | Graph |  A  |  B  |  C  |  D  |  E  |\n  |:----- |:---:|:---:|:---:|:---:|:---:|\n  | A     |  0  | 12  |  0  |  1  |  0  |\n  | B     | -22 |  0  |  0  | 0.4 |  0  |\n  | C     |  0  |  0  |  0  |  0  |  0  |\n  | D     |  2  | 12  |  0  |  0  |  1  |\n  | E     |  0  |  0  |  0  |  2  |  0  |"
    },
    {
        key: "&lt;!-- data-type=&quot;sankey&quot; --&gt;",
        search: "lia-table-diagram-sankey",
        replace: "<!-- data-type=\"sankey\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "A Sankey diagram is a special type of directed graph that can be used to streams or the flow of something, such as engergy, money, etc.\n\nExample:\n  &lt;!-- data-type=&quot;sankey&quot; --&gt;\n  | Sankey |  A  |  B  |  C  |  D  |  E  |\n  |:------ |:---:|:---:|:---:|:---:|:---:|\n  | A      |     |  2  |     |     |     |\n  | B      |  3  |     |     |     |     |\n  | C      |  1  |  1  |     |     |     |\n  | D      |     |  1  |  1  |     |     |\n  | E      |  2  |  1  |  1  |  1  |     |"
    },
    {
        key: "&lt;!-- data-type=&quot;none&quot; --&gt;",
        search: "lia-table-diagram-none",
        replace: "<!-- data-type=\"none\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Simply data-type=&quot;none&quot; to prevent any kind of visualization.\n\nExample:\n  &lt;!-- data-type=&quot;none&quot; --&gt;\n  | Sankey |  A  |  B  |  C  |  D  |  E  |\n  |:------ |:---:|:---:|:---:|:---:|:---:|\n  | A      |     |  2  |     |     |     |\n  | B      |  3  |     |     |     |     |\n  | C      |  1  |  1  |     |     |     |\n  | D      |     |  1  |  1  |     |     |\n  | E      |  2  |  1  |  1  |  1  |     |"
    },
    {
        key: "&lt;!-- data-show --&gt;",
        search: "lia-table-diagram-show",
        replace: "<!-- data-show --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Simply add this attribute or set it to true (data-show=&quot;true&quot;), if you want to visualize your data immediately, without the need to click in the switch-button. It is still possible for your users to switch to the table representation.\n\nExample:\n  &lt;!-- data-show --&gt;\n  | Sankey |  A  |  B  |  C  |  D  |  E  |\n  |:------ |:---:|:---:|:---:|:---:|:---:|\n  | A      |     |  2  |     |     |     |\n  | B      |  3  |     |     |     |     |\n  | C      |  1  |  1  |     |     |     |\n  | D      |     |  1  |  1  |     |     |\n  | E      |  2  |  1  |  1  |  1  |     |"
    },
    {
        key: "&lt;!-- data-transpose --&gt;",
        search: "lia-table-diagram-transpose",
        replace: "<!-- data-transpose --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Like in the mathematical sense, set this attribute or set it to true (data-transpose=&quot;true&quot;), if you want to switch rows and columns. One benefit is, that you can for example use PieChart and let your table grow vertically instead of using a horizontal monster.\n\nExample:\n  &lt;!-- data-transpose --&gt;\n  | Music-Style {0-1}{1994} {1}{2014} |      Student rating |\n  |:--------------------------------- | -------------------:|\n  | Classic                           |   {0-1}{50} {1}{20} |\n  | Country                           |   {0-1}{50} {1}{30} |\n  | Reggae                            |                 100 |\n  | Hip-Hop                           | {0-1}{200} {1}{220} |\n  | Hard-Rock                         | {0-1}{350} {1}{400} |\n  | Samba                             | {0-1}{250} {1}{230} |"
    },
    {
        key: "&lt;!-- data-src=&quot;..&quot; --&gt;",
        search: "lia-table-diagram-source",
        replace: "<!-- data-src=\"url\" --",
        icon: "<span style=\"color:#ff0\">\ud834\udf20</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Currently this attribute is used to refere to your geojson data, if you use the `data-type=&quot;Map&quot;` representation, but this might change in the future to load and visualize data directly, such as csv.\nIf you are using geojson files from external websites such as: https://code.highcharts.com/mapdata/\nIt can be usefull to use anycors, if the data cannot be visualized due to CORS restrictions:\n\ndata-src=&quot;https://cors-anywhere.herokuapp.com/https://code.highcharts.com/mapdata/custom/europe.geo.json&quot;\n\nExample:\n  &lt;!-- data-type=&quot;map&quot; data-src=&quot;https://code.highcharts.com/mapdata/custom/europe.geo.json&quot; --&gt;\n  | Country                | percent |\n  | ---------------------- | ------- |\n  | Albania                | 73.5    |\n  | Andorra                | 98.9    |\n  | Armenia                | 72.4    |\n  | ...                    |         |"
    },
    {
        key: "_text_",
        search: "lia-text-italic",
        replace: "_italic",
        icon: "<span style=\"color:#ff0\"><i>Az</i></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "*text*",
        search: "lia-text-italic2",
        replace: "*italic",
        icon: "<span style=\"color:#ff0\"><i>Az</i></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "__text__",
        search: "lia-text-bold",
        replace: "__bold_",
        icon: "<span style=\"color:#ff0\"><b>Az</b></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "**text**",
        search: "lia-text-bold2",
        replace: "**bold*",
        icon: "<span style=\"color:#ff0\"><b>Az</b></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "___text___",
        search: "lia-text-italic-bold",
        replace: "___italic bold__",
        icon: "<span style=\"color:#ff0\"><b><i>Az</i></b></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "***text***",
        search: "lia-text-italic-bold2",
        replace: "***italic bold**",
        icon: "<span style=\"color:#ff0\"><b><i>Az</i></b></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "~text~",
        search: "lia-text-strike",
        replace: "~strike",
        icon: "<span style=\"color:#ff0\"><s>Az</s></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "~~text~~",
        search: "lia-text-underline",
        replace: "~~underline~",
        icon: "<span style=\"color:#ff0\"><u>Az</u></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "~~~text~~~",
        search: "lia-text-strike-underline",
        replace: "~~~strike underline~~",
        icon: "<span style=\"color:#ff0\"><s><u>Az</u></s></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "^text^",
        search: "lia-text-superscript",
        replace: "^superscript",
        icon: "<span style=\"color:#ff0\"><sup>Az</sup></span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
    },
    {
        key: "[[solution]]",
        search: "lia-quiz-text",
        replace: "[[solution]",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Simply encompass your solution word into double brackets and you will get a nicely rendered text quiz.\n\nExample:\n  What is the color of the sky?\n\n  [[blue]]"
    },
    {
        key: "[[solution]]&lt;script&gt; ... &lt;/script&gt;",
        search: "lia-quiz-text-js",
        replace: "[[solution]]\n<script>\n  // @input will be replace by the user input\n  let input_string = \"@input\";\n  \"solution\" == input_string.trim().toLowerCase();\n</script",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If different inputs are possible, you can add a script tag to your quiz-field. The reference @input will be replaced by the current user input string, and the result of the script has to be true or false.\n\nExample:\n  What is the color of the sky?\n\n  [[blue]]\n  &lt;script&gt;\n    let input_string = &quot;@input&quot;;\n    &quot;BLUE&quot; == input_string.trim().toUpperCase();\n  &lt;/script&gt;"
    },
    {
        key: "[[select|_wrong_|(right)]]",
        search: "lia-quiz-select",
        replace: "[[option|option]",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Create a selection field, that contains various different solutions, separated by `|`. Images, formulas everything is allowed, only the correct solution has to be put into parentheses and there can be multiple correct solutions.\n\nExample:\n  What is the color of the sky?\n\n  [[ red | (__blue__) | green | (black at night)]]"
    },
    {
        key: "[( |X)] text",
        search: "lia-quiz-single-choice",
        replace: "[( )] enter your text",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Compose your single choice quizzes out of many lines in the following format:\n\nExample:\n  This is a single choice quiz with three options:\n\n    [( )] Add as many lines as you want?\n    [(X)] The X marks the only correct answer!\n    [( )] ... And only one X is allowed.\n\n(If you want, you can also have multiple correct options.)"
    },
    {
        key: "[[ |X]] text",
        search: "lia-quiz-multiple-choice",
        replace: "[[ ]] enter your text",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Compose your multiple choice quizzes out of many lines in the following format:\n\nExample:\n  This is a multiple choice quiz with four options:\n\n    [[ ]] Add as many lines as you want?\n    [[X]] The X marks the correct lines that have to be selected!\n    [[X]] This can offer multiple options that have to be clicked.\n    [[ ]] But it can also consist of empty brackets either."
    },
    {
        key: "[[ |X][ |X]...] text",
        search: "lia-quiz-matrix-choice",
        replace: "[[ ] [ ] [ ]]\n[[ ] [ ] [ ]]  add a line\n[( ) ( ) (: )] : add a line",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Compose a matrix of quizzes with multiple SingleChoice and MultipleChoice quizzes per row. The column headers have to be put into brackets or parentheses, depending on your passed Markdown content. It is allowed to have different numbers of options per row.\n\nExample:\n  This is a multiple choice quiz with four options:\n    [[:-)] (:-]) (_bold_)]\n    [ [ ]   [ ]     [X]  ] Only the X marks the correct solution!\n    [ [X]   [ ]     [ ]  ] Multiple- and SingleChoice quizzes in a matrix,\n    [ ( )   ( )     (X)  ] but you have to be consitent per row.\n    [ ( )   ( )     ( )   ( ) ] More or less options than defined in the header are also allowed."
    },
    {
        key: "[[?]] hint",
        search: "lia-quiz-hint",
        replace: "[[?]] enter your hint",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If a quiz might be a bit tricky, you can add hints directly after any type of quiz and as many hints as you want. The user can decide whether he or she wants to use it, simply by clicking on the additional question mark, that appears after the check button.\n\nExample:\n  This is a text quiz with two hints:\n\n    [[solution]]\n    [[?]] This is the first hint\n    [[?]] This is a second hint\n\n  And a multiple choice quiz with one hint:\n\n    [[X]] This is correct!\n    [[ ]] This is wrong!\n    [[?]] Click on the first option!"
    },
    {
        key: "*** ... ***",
        search: "lia-quiz-solution",
        replace: "****************************************\n\nAdd a solution explanation __Markdown__!\n\n***************************************",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "If the user solved a quiz or clicked onto resolve, the correct answer gets automatically revealed, but you can add additional information to your solution by adding two lines to the end of your quiz that can contain multiple Markdown blocks as explanation.\n\nExample:\n  What is the color of the sky?\n\n    [[blue]]\n    [[?]] Enter blue!\n    *************************************\n\n    During the day the color is blue, if\n    it is not cloudy. See the following\n    picture ...\n\n    ![blue sky](./img/sunny.jpg)\n\n    *************************************"
    },
    {
        key: "&lt;script&gt; /*single choice*/ &lt;/script&gt;",
        search: "lia-quiz-single-js",
        replace: "<script>\n  // @input gets replaced by a single number\n  // -1 if no selection otherwise it starts\n  // with 0.\n  let input_number = @input;\n\n  if(input_number == 1)\n    true;\n  else\n    false;\n</script",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "In some rare cases you might want to change the correct solution, or add a counter, that reveals the correct answer after some predefined number of trials. Then simply add a script tag to the quiz. The @input string gets replaced by an integer representing the current user input:\n\n-1 -&gt; no selection\n0  -&gt; the first\n1  -&gt; the second\n\nExample:\n\n    [( )] Check this ...\n    [(X)] ... and not this\n    &lt;script&gt;\n      // @input gets replaced by a single number\n      // -1 if no selection otherwise it starts\n      // with 0.\n      let input_number = @input;\n\n      ${7:if(input_number == 0)\n        true;\n      else\n        false;}\n    &lt;/script&gt;"
    },
    {
        key: "&lt;script&gt; /*single multiple*/ &lt;/script&gt;",
        search: "lia-quiz-multiple-js",
        replace: "<script>\n  // @input gets replaced by an array in the\n  // form of [0,0,0,1], whereby 0 and 1\n  // define whether a checkbox is checked\n  // or not...\n  let input_array = @input;\n  input_array = JSON.stringify(input_array);\n\n  if      (input_array == \"[0,1,0,1]\")  true;\n  else if (input_array == \"[0,1,0,0]\")  true;\n  else if (input_array == \"[0,0,0,1]\")  true;\n  else                                 false;\n</script",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "In some rare cases you might want to change the correct solution, add a counter, or let some correct answers pass. Then simply add a script tag to the quiz. The @input string here gets replaced by an by an array of integers ([0,1,1,0]) that represent the current user input:\n\n0 -&gt; stands for checked\n1 -&gt; represents an unchecked field\n\nExample:\n\n  Get at least one right ...\n\n  [[ ]] Wrong.\n  [[X]] Right.\n  [[ ]] Wrong.\n  [[X]] Right.\n  &lt;script&gt;\n    // @input gets replaced by an array in the\n    // form of [0,0,0,1], whereby 0 and 1\n    // define whether a checkbox is checked\n    // or not...\n    let input_array = @input;\n    input_array = JSON.stringify(input_array);\n\n    if      (input_array == &quot;[0,1,0,1]&quot;)  true;\n    else if (input_array == &quot;[0,1,0,0]&quot;)  true;\n    else if (input_array == &quot;[0,0,0,1]&quot;)  true;\n    else                                 false;\n  &lt;/script&gt;"
    },
    {
        key: "&lt;script&gt; /* quiz */ &lt;/script&gt;",
        search: "lia-quiz-js",
        replace: "<script>\n  // @input gets replaced by the current quiz input.\n  // In case of a:\n  // * text input -> string, that has to be encapsulated with (\")\n  // * single choice -> int (-1, if nothing is selected)\n  // * multiple choice -> array int (0 unchecked, 1 checked)\n  let input = @input;\n\n  true; // if solved otherwise return false\n</script",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "This will insert a generic script tag in the following form, the @input will be replaced according the current context:\n\n&lt;script&gt;\n  // @input gets replaced by the current quiz input.\n  // In case of a:\n  // * text input -&gt; string, that has to be encapsulated with (&quot;)\n  // * single choice -&gt; int (-1, if nothing is selected)\n  // * multiple choice -&gt; array int (0 unchecked, 1 checked)\n  let input = @input;\n\n  true; // if solved otherwise return false\n&lt;/script&gt;"
    },
    {
        key: "single choice quiz with 3 options",
        search: "lia-quiz-single-choice-3",
        replace: "[( )] This is wrong.\n[(X)] The only correct option.\n[( )] Still not right.",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Insert a the following quiz dummy:\n\n  [( )] This is wrong.\n  [(X)] The only correct option.\n  [( )] Still not right."
    },
    {
        key: "multiple choice quiz with 4 options",
        search: "lia-quiz-multiple-choice-4",
        replace: "[[ ]] Add as many elements as you want?\n[[X]] The X marks the correct answer!\n[[ ]] ... this is wrong ...\n[[X]] ... this has to be selected too ...",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "Insert a the following quiz dummy:\n\n[[ ]] Add as many elements as you want?\n[[X]] The X marks the correct answer!\n[[ ]] ... this is wrong ...\n[[X]] ... this has to be selected too ..."
    },
    {
        key: "[[!]] &lt;script&gt; ... &lt;/script&gt;",
        search: "lia-quiz-generic-js",
        replace: "[[!]]\n<script>\n  // you are free to check anything you want\n  true;\n</script",
        icon: "<span style=\"color:#ff0\">\ud83c\udf93</span>",
        url: "https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md",
        helpMsg: "In some rarely rarely rare cases, you might want to have something completely different and analyze some other HTML or code inputs (unit testing). In this case you can apply this generic tag and do in JavaScript whatever you want. The this quiz is solved if the script gets evaluated to true, not solved by resulting in false (everything else is ignored).\n\n*Click Me!*&lt;!-- onclick=&quot;window[&#x27;rand&#x27;] = Math.random();&quot; --&gt;\n\n[[!]]\n&lt;script&gt;\n  alert(&quot;your value random value is:&quot;, window[&#x27;rand&#x27;]);\n  if(window[&#x27;rand&#x27;] &gt; 0.8)\n    true;\n  else\n    false\n&lt;/script&gt;"
    }
]





// global vars
window.loaded = false
let needRefresh = false
let isDirty = false
let editShown = false
let visibleXS = false
let visibleSM = false
let visibleMD = false
let visibleLG = false
const isTouchDevice = 'ontouchstart' in document.documentElement
let currentStatus = statusType.offline
const lastInfo = {
  needRestore: false,
  cursor: null,
  scroll: null,
  edit: {
    scroll: {
      left: null,
      top: null
    },
    cursor: {
      line: null,
      ch: null
    },
    selections: null
  },
  view: {
    scroll: {
      left: null,
      top: null
    }
  },
  history: null
}
let personalInfo = {}
let onlineUsers = []
const fileTypes = {
  pl: 'perl',
  cgi: 'perl',
  js: 'javascript',
  php: 'php',
  sh: 'bash',
  rb: 'ruby',
  html: 'html',
  py: 'python'
}

// editor settings
const textit = document.getElementById('textit')
if (!textit) {
  throw new Error('There was no textit area!')
}

const editorInstance = new Editor()
var editor = editorInstance.init(textit)

// FIXME: global referncing in jquery-textcomplete patch
window.editor = editor

window.lia = document.getElementById("lia");

window.liaReady = function() {
  console.warn("liaReady");
}

window.liaGoto = function(line) {
  editor.setCursor({line: line, ch: 0})
}

window.liaDefinitions = function (json) {
  window.definitions = json;
}

window.editor.on('dblclick', function(e) {
   window.lia.contentWindow.gotoLia(e.getCursor().line + 1)
})

var inlineAttach = inlineAttachment.editors.codemirror4.attach(editor)
defaultTextHeight = parseInt($('.CodeMirror').css('line-height'))

//  initalize ui reference
const ui = getUIElements()

// page actions
var opts = {
  lines: 11, // The number of lines to draw
  length: 20, // The length of each line
  width: 2, // The line thickness
  radius: 30, // The radius of the inner circle
  corners: 0, // Corner roundness (0..1)
  rotate: 0, // The rotation offset
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: '#000', // #rgb or #rrggbb or array of colors
  speed: 1.1, // Rounds per second
  trail: 60, // Afterglow percentage
  shadow: false, // Whether to render a shadow
  hwaccel: true, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: '50%', // Top position relative to parent
  left: '50%' // Left position relative to parent
}

new Spinner(opts).spin(ui.spinner[0])

// idle
var idle = new Idle({
  onAway: function () {
    idle.isAway = true
    emitUserStatus()
    updateOnlineStatus()
  },
  onAwayBack: function () {
    idle.isAway = false
    emitUserStatus()
    updateOnlineStatus()
    setHaveUnreadChanges(false)
    updateTitleReminder()
  },
  awayTimeout: idleTime
})
ui.area.codemirror.on('touchstart', function () {
  idle.onActive()
})

var haveUnreadChanges = false

function renderFilename() {
  try {
    return window.lia.contentDocument.title
  } catch (e) {
    return "Untitled"
  }
}

function setHaveUnreadChanges (bool) {
  if (!window.loaded) return
  if (bool && (idle.isAway || Visibility.hidden())) {
    haveUnreadChanges = true
  } else if (!bool && !idle.isAway && !Visibility.hidden()) {
    haveUnreadChanges = false
  }
}

function updateTitleReminder () {
  if (!window.loaded) return
  if (haveUnreadChanges) {
    document.title = '• ' + renderFilename() //renderTitle(ui.area.markdown)
  } else {
    document.title = renderFilename() //renderTitle(ui.area.markdown)
  }
}

function setRefreshModal (status) {
  $('#refreshModal').modal('show')
  $('#refreshModal').find('.modal-body > div').hide()
  $('#refreshModal').find('.' + status).show()
}

function setNeedRefresh () {
  needRefresh = true
  editor.setOption('readOnly', true)
  socket.disconnect()
  showStatus(statusType.offline)
}

setloginStateChangeEvent(function () {
  setRefreshModal('user-state-changed')
  setNeedRefresh()
})

// visibility
var wasFocus = false
Visibility.change(function (e, state) {
  var hidden = Visibility.hidden()
  if (hidden) {
    if (editorHasFocus()) {
      wasFocus = true
      editor.getInputField().blur()
    }
  } else {
    if (wasFocus) {
      if (!visibleXS) {
        editor.focus()
        editor.refresh()
      }
      wasFocus = false
    }
    setHaveUnreadChanges(false)
  }
  updateTitleReminder()
})

// when page ready
$(document).ready(function () {
  idle.checkAway()
  checkResponsive()
  // if in smaller screen, we don't need advanced scrollbar
  var scrollbarStyle
  if (visibleXS) {
    scrollbarStyle = 'native'
  } else {
    scrollbarStyle = 'overlay'
  }
  if (scrollbarStyle !== editor.getOption('scrollbarStyle')) {
    editor.setOption('scrollbarStyle', scrollbarStyle)
  }
  checkEditorStyle()

  /* cache dom references */
  var $body = $('body')

  /* we need this only on touch devices */
  if (isTouchDevice) {
    /* bind events */
    $(document)
      .on('focus', 'textarea, input', function () {
        $body.addClass('fixfixed')
      })
      .on('blur', 'textarea, input', function () {
        $body.removeClass('fixfixed')
      })
  }

  // Re-enable nightmode
  if (store.get('nightMode') || Cookies.get('nightMode')) {
    $body.addClass('night')
    ui.toolbar.night.addClass('active')
  }

  // showup
  $().showUp('.navbar', {
    upClass: 'navbar-hide',
    downClass: 'navbar-show'
  })
  // tooltip
  $('[data-toggle="tooltip"]').tooltip()
  // shortcuts
  // allow on all tags
  key.filter = function (e) { return true }
  key('ctrl+alt+e', function (e) {
    changeMode(modeType.edit)
  })
  key('ctrl+alt+v', function (e) {
    changeMode(modeType.view)
  })
  key('ctrl+alt+b', function (e) {
    changeMode(modeType.both)
  })
  // toggle-dropdown
  $(document).on('click', '.toggle-dropdown .dropdown-menu', function (e) {
    e.stopPropagation()
  })
})
// when page resize
$(window).resize(function () {
  checkLayout()
  checkEditorStyle()
  //checkTocStyle()
  checkCursorMenu()
  windowResize()
})
// when page unload
$(window).on('unload', function () {
  updateHistoryInner();
})
$(window).on('error', function () {
  setNeedRefresh();
})

var windowResizeDebounce = 200
var windowResize = _.debounce(windowResizeInner, windowResizeDebounce)

function windowResizeInner (callback) {
  checkLayout()
  checkResponsive()
  checkEditorStyle()
  //checkTocStyle()
  checkCursorMenu()
  // refresh editor
  if (window.loaded) {
    if (editor.getOption('scrollbarStyle') === 'native') {
      setTimeout(function () {
        if (callback && typeof callback === 'function') { callback() }
      }, 1)
    } else {
      // force it load all docs at once to prevent scroll knob blink
      editor.setOption('viewportMargin', Infinity)
      setTimeout(function () {
        editor.setOption('viewportMargin', viewportMargin)
        // add or update user cursors
        for (var i = 0; i < onlineUsers.length; i++) {
          if (onlineUsers[i].id !== personalInfo.id) { buildCursor(onlineUsers[i]) }
        }
        if (callback && typeof callback === 'function') { callback() }
      }, 1)
    }
  }
}

function checkLayout () {
  var navbarHieght = $('.navbar').outerHeight()
  $('body').css('padding-top', navbarHieght + 'px')
}

function editorHasFocus () {
  return $(editor.getInputField()).is(':focus')
}

// 768-792px have a gap
function checkResponsive () {
  visibleXS = $('.visible-xs').is(':visible')
  visibleSM = $('.visible-sm').is(':visible')
  visibleMD = $('.visible-md').is(':visible')
  visibleLG = $('.visible-lg').is(':visible')

  if (visibleXS && appState.currentMode === modeType.both) {
    if (editorHasFocus()) { changeMode(modeType.edit) } else { changeMode(modeType.view) }
  }

  emitUserStatus()
}

var lastEditorWidth = 0
var previousFocusOnEditor = null

function checkEditorStyle () {
  var desireHeight = editorInstance.statusBar ? (ui.area.edit.height() - editorInstance.statusBar.outerHeight()) : ui.area.edit.height()
  if (editorInstance.toolBar) {
    desireHeight = desireHeight - editorInstance.toolBar.outerHeight()
  }
  // set editor height and min height based on scrollbar style and mode
  var scrollbarStyle = editor.getOption('scrollbarStyle')
  if (scrollbarStyle === 'overlay' || appState.currentMode === modeType.both) {
    ui.area.codemirrorScroll.css('height', desireHeight + 'px')
    ui.area.codemirrorScroll.css('min-height', '')
    checkEditorScrollbar()
  } else if (scrollbarStyle === 'native') {
    ui.area.codemirrorScroll.css('height', '')
    ui.area.codemirrorScroll.css('min-height', desireHeight + 'px')
  }
  // workaround editor will have wrong doc height when editor height changed
  editor.setSize(null, ui.area.edit.height())
  //checkEditorScrollOverLines()
  // make editor resizable
  if (!ui.area.resize.handle.length) {
    ui.area.edit.resizable({
      handles: 'e',
      maxWidth: $(window).width() * 0.7,
      minWidth: $(window).width() * 0.2,
      create: function (e, ui) {
        $(this).parent().on('resize', function (e) {
          e.stopPropagation()
        })
      },
      start: function (e) {
        editor.setOption('viewportMargin', Infinity)
      },
      resize: function (e) {
        ui.area.resize.syncToggle.stop(true, true).show()
        //checkTocStyle()
      },
      stop: function (e) {
        lastEditorWidth = ui.area.edit.width()
        // workaround that scroll event bindings
        window.preventSyncScrollToView = 2
        window.preventSyncScrollToEdit = true
        editor.setOption('viewportMargin', viewportMargin)
        if (editorHasFocus()) {
          windowResizeInner(function () {
            ui.area.codemirrorScroll.scroll()
          })
        } else {
          windowResizeInner(function () {
            ui.area.view.scroll()
          })
        }
        checkEditorScrollbar()
      }
    })
    ui.area.resize.handle = $('.ui-resizable-handle')
  }
  if (!ui.area.resize.syncToggle.length) {
    ui.area.resize.syncToggle = $('<button class="btn btn-lg btn-default ui-sync-toggle" title="Toggle sync scrolling"><i class="fa fa-link fa-fw"></i></button>')
    ui.area.resize.syncToggle.hover(function () {
      previousFocusOnEditor = editorHasFocus()
    }, function () {
      previousFocusOnEditor = null
    })
    ui.area.resize.syncToggle.click(function () {
      appState.syncscroll = !appState.syncscroll
    })
    ui.area.resize.handle.append(ui.area.resize.syncToggle)
    ui.area.resize.syncToggle.hide()
    ui.area.resize.handle.hover(function () {
      ui.area.resize.syncToggle.stop(true, true).delay(200).fadeIn(100)
    }, function () {
      ui.area.resize.syncToggle.stop(true, true).delay(300).fadeOut(300)
    })
  }
}

var checkEditorScrollbar = _.debounce(function () {
  editor.operation(checkEditorScrollbarInner)
}, 50)

function checkEditorScrollbarInner () {
  // workaround simple scroll bar knob
  // will get wrong position when editor height changed
  var scrollInfo = editor.getScrollInfo()
  editor.scrollTo(null, scrollInfo.top - 1)
  editor.scrollTo(null, scrollInfo.top)
}

/*
function checkTocStyle () {
  // toc right
  var paddingRight = parseFloat(ui.area.markdown.css('padding-right'))
  var right = ($(window).width() - (lia.offsetLeft + ui.area.markdown.outerWidth() - paddingRight))
  ui.toc.toc.css('right', right + 'px')
  // affix toc left
  var newbool
  var rightMargin = (ui.area.markdown.parent().outerWidth() - ui.area.markdown.outerWidth()) / 2
  // for ipad or wider device
  if (rightMargin >= 133) {
    newbool = true
    var affixLeftMargin = (ui.toc.affix.outerWidth() - ui.toc.affix.width()) / 2
    var left = ui.area.markdown.offset().left + ui.area.markdown.outerWidth() - affixLeftMargin
    ui.toc.affix.css('left', left + 'px')
    ui.toc.affix.css('width', rightMargin + 'px')
  } else {
    newbool = false
  }
  // toc scrollspy
  ui.toc.toc.removeClass('scrollspy-body, scrollspy-view')
  ui.toc.affix.removeClass('scrollspy-body, scrollspy-view')
  if (appState.currentMode === modeType.both) {
    ui.toc.toc.addClass('scrollspy-view')
    ui.toc.affix.addClass('scrollspy-view')
  } else if (appState.currentMode !== modeType.both && !newbool) {
    ui.toc.toc.addClass('scrollspy-body')
    ui.toc.affix.addClass('scrollspy-body')
  } else {
    ui.toc.toc.addClass('scrollspy-view')
    ui.toc.affix.addClass('scrollspy-body')
  }
  if (newbool !== enoughForAffixToc) {
    enoughForAffixToc = newbool
    generateScrollspy()
  }
}
*/

function showStatus (type, num) {
  currentStatus = type
  var shortStatus = ui.toolbar.shortStatus
  var status = ui.toolbar.status
  var label = $('<span class="label"></span>')
  var fa = $('<i class="fa"></i>')
  var msg = ''
  var shortMsg = ''

  shortStatus.html('')
  status.html('')

  switch (currentStatus) {
    case statusType.connected:
      label.addClass(statusType.connected.label)
      fa.addClass(statusType.connected.fa)
      msg = statusType.connected.msg
      break
    case statusType.online:
      label.addClass(statusType.online.label)
      fa.addClass(statusType.online.fa)
      shortMsg = num
      msg = num + ' ' + statusType.online.msg
      break
    case statusType.offline:
      label.addClass(statusType.offline.label)
      fa.addClass(statusType.offline.fa)
      msg = statusType.offline.msg
      break
  }

  label.append(fa)
  var shortLabel = label.clone()

  shortLabel.append(' ' + shortMsg)
  shortStatus.append(shortLabel)

  label.append(' ' + msg)
  status.append(label)
}

function toggleMode () {
  switch (appState.currentMode) {
    case modeType.edit:
      changeMode(modeType.view)
      break
    case modeType.view:
      changeMode(modeType.edit)
      break
    case modeType.both:
      changeMode(modeType.view)
      break
  }
}

var lastMode = null

function changeMode (type) {
  // lock navbar to prevent it hide after changeMode

  lockNavbar()
  saveInfo()
  if (type) {
    lastMode = appState.currentMode
    appState.currentMode = type
  }
  var responsiveClass = 'col-lg-6 col-md-6 col-sm-6'
  var scrollClass = 'ui-scrollable'
  ui.area.codemirror.removeClass(scrollClass)
  ui.area.edit.removeClass(responsiveClass)
  ui.area.view.removeClass(scrollClass)
  ui.area.view.removeClass(responsiveClass)
  switch (appState.currentMode) {
    case modeType.edit:
      ui.area.edit.show()
      ui.area.view.hide()
      if (!editShown) {
        editor.refresh()
        editShown = true
      }
      break
    case modeType.view:
      ui.area.edit.hide()
      ui.area.view.show()
      break
    case modeType.both:
      ui.area.codemirror.addClass(scrollClass)
      ui.area.edit.addClass(responsiveClass).show()
      ui.area.view.addClass(scrollClass)
      ui.area.view.show()
      break
  }
  // save mode to url
  if (history.replaceState && window.loaded) history.replaceState(null, '', serverurl + '/' + noteid + '?' + appState.currentMode.name)
  if (appState.currentMode === modeType.view) {
    editor.getInputField().blur()
  }
  if (appState.currentMode === modeType.edit || appState.currentMode === modeType.both) {
    ui.toolbar.uploadImage.fadeIn()
    // add and update status bar
    if (!editorInstance.statusBar) {
      editorInstance.addStatusBar()
      editorInstance.updateStatusBar()
    }
    // add and update tool bar
    if (!editorInstance.toolBar) {
      editorInstance.addToolBar()
    }
    // work around foldGutter might not init properly
    editor.setOption('foldGutter', false)
    editor.setOption('foldGutter', true)
  } else {
    ui.toolbar.uploadImage.fadeOut()
  }
  if (appState.currentMode !== modeType.edit) {
    $(document.body).css('background-color', 'white')
    updateView()
  } else {
    $(document.body).css('background-color', ui.area.codemirror.css('background-color'))
  }
  // check resizable editor style
  if (appState.currentMode === modeType.both) {
    if (lastEditorWidth > 0) {
      ui.area.edit.css('width', lastEditorWidth + 'px')
    } else {
      ui.area.edit.css('width', '')
    }
    ui.area.resize.handle.show()
  } else {
    ui.area.edit.css('width', '')
    ui.area.resize.handle.hide()
  }

  windowResizeInner()

  restoreInfo()

  if (lastMode === modeType.view && appState.currentMode === modeType.both) {
    window.preventSyncScrollToView = 2
  }

  if (lastMode === modeType.edit && appState.currentMode === modeType.both) {
    window.preventSyncScrollToEdit = 2
  }

  if (lastMode === modeType.both && appState.currentMode !== modeType.both) {
    window.preventSyncScrollToView = false
    window.preventSyncScrollToEdit = false
  }

  if (lastMode !== modeType.edit && appState.currentMode === modeType.edit) {
    editor.refresh()
  }

  $(document.body).scrollspy('refresh')
  ui.area.view.scrollspy('refresh')

  ui.toolbar.both.removeClass('active')
  ui.toolbar.edit.removeClass('active')
  ui.toolbar.view.removeClass('active')
  var modeIcon = ui.toolbar.mode.find('i')
  modeIcon.removeClass('fa-pencil').removeClass('fa-eye')
  if (ui.area.edit.is(':visible') && ui.area.view.is(':visible')) { // both
    ui.toolbar.both.addClass('active')
    modeIcon.addClass('fa-eye')
  } else if (ui.area.edit.is(':visible')) { // edit
    ui.toolbar.edit.addClass('active')
    modeIcon.addClass('fa-eye')
  } else if (ui.area.view.is(':visible')) { // view
    ui.toolbar.view.addClass('active')
    modeIcon.addClass('fa-pencil')
  }
  unlockNavbar()
}

function lockNavbar () {
  $('.navbar').addClass('locked')
}

var unlockNavbar = _.debounce(function () {
  $('.navbar').removeClass('locked')
}, 200)

function showMessageModal (title, header, href, text, success) {
  var modal = $('.message-modal')
  modal.find('.modal-title').html(title)
  modal.find('.modal-body h5').html(header)
  if (href) { modal.find('.modal-body a').attr('href', href).text(text) } else { modal.find('.modal-body a').removeAttr('href').text(text) }
  modal.find('.modal-footer button').removeClass('btn-default btn-success btn-danger')
  if (success) { modal.find('.modal-footer button').addClass('btn-success') } else { modal.find('.modal-footer button').addClass('btn-danger') }
  modal.modal('show')
}

// check if dropbox app key is set and load scripts
if (DROPBOX_APP_KEY) {
  $('<script>')
    .attr('type', 'text/javascript')
    .attr('src', 'https://www.dropbox.com/static/api/2/dropins.js')
    .attr('id', 'dropboxjs')
    .attr('data-app-key', DROPBOX_APP_KEY)
    .prop('async', true)
    .prop('defer', true)
    .appendTo('body')
} else {
  ui.toolbar.import.dropbox.hide()
  ui.toolbar.export.dropbox.hide()
}

// button actions
// share
ui.toolbar.publish.attr('href', noteurl + '/publish')
// extra
// slide
ui.toolbar.extra.slide.attr('href', noteurl + '/slide')
// download
// markdown
ui.toolbar.download.markdown.click(function (e) {
  e.preventDefault()
  e.stopPropagation()
  var filename = renderFilename() + '.md'
  var markdown = editor.getValue()
  var blob = new Blob([markdown], {
    type: 'text/markdown;charset=utf-8'
  })
  saveAs(blob, filename, true)
})
// html
/*ui.toolbar.download.html.click(function (e) {
  e.preventDefault()
  e.stopPropagation()
  exportToHTML(ui.area.markdown)
})
*/
// raw html
/*ui.toolbar.download.rawhtml.click(function (e) {
  e.preventDefault()
  e.stopPropagation()
  exportToRawHTML(ui.area.markdown)
})
*/
// pdf
ui.toolbar.download.pdf.attr('download', '').attr('href', noteurl + '/pdf')

ui.modal.pandocExport.find('#pandoc-export-download').click(function (e) {
  e.preventDefault()

  const exportType = ui.modal.pandocExport.find('select[name="output"]').val()

  window.open(`${noteurl}/pandoc?exportType=${exportType}`, '_blank')
})

// export to dropbox
ui.toolbar.export.dropbox.click(function () {
  var filename = renderFilename() + '.md'
  var options = {
    files: [
      {
        url: noteurl + '/download',
        filename: filename
      }
    ],
    error: function (errorMessage) {
      console.error(errorMessage)
    }
  }
  Dropbox.save(options)
})
// export to gist
ui.toolbar.export.gist.attr('href', noteurl + '/gist')
// export to snippet
ui.toolbar.export.snippet.click(function () {
  ui.spinner.show()
  $.get(serverurl + '/auth/gitlab/callback/' + noteid + '/projects')
    .done(function (data) {
      $('#snippetExportModalAccessToken').val(data.accesstoken)
      $('#snippetExportModalBaseURL').val(data.baseURL)
      $('#snippetExportModalVersion').val(data.version)
      $('#snippetExportModalLoading').hide()
      $('#snippetExportModal').modal('toggle')
      $('#snippetExportModalProjects').find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Projects</option>')
      if (data.projects) {
        data.projects.sort(function (a, b) {
          return (a.path_with_namespace < b.path_with_namespace) ? -1 : ((a.path_with_namespace > b.path_with_namespace) ? 1 : 0)
        })
        data.projects.forEach(function (project) {
          if (!project.snippets_enabled ||
                        (project.permissions.project_access === null && project.permissions.group_access === null) ||
                        (project.permissions.project_access !== null && project.permissions.project_access.access_level < 20)) {
            return
          }
          $('<option>').val(project.id).text(project.path_with_namespace).appendTo('#snippetExportModalProjects')
        })
        $('#snippetExportModalProjects').prop('disabled', false)
      }
      $('#snippetExportModalLoading').hide()
    })
    .fail(function (data) {
      showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Unable to fetch gitlab parameters :(', '', '', false)
    })
    .always(function () {
      ui.spinner.hide()
    })
})
// import from dropbox
ui.toolbar.import.dropbox.click(function () {
  var options = {
    success: function (files) {
      ui.spinner.show()
      var url = files[0].link
      importFromUrl(url)
    },
    linkType: 'direct',
    multiselect: false,
    extensions: ['.md', '.html']
  }
  Dropbox.choose(options)
})
// import from gist
ui.toolbar.import.gist.click(function () {
  // na
})
// import from snippet
ui.toolbar.import.snippet.click(function () {
  ui.spinner.show()
  $.get(serverurl + '/auth/gitlab/callback/' + noteid + '/projects')
    .done(function (data) {
      $('#snippetImportModalAccessToken').val(data.accesstoken)
      $('#snippetImportModalBaseURL').val(data.baseURL)
      $('#snippetImportModalVersion').val(data.version)
      $('#snippetImportModalContent').prop('disabled', false)
      $('#snippetImportModalConfirm').prop('disabled', false)
      $('#snippetImportModalLoading').hide()
      $('#snippetImportModal').modal('toggle')
      $('#snippetImportModalProjects').find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Projects</option>')
      if (data.projects) {
        data.projects.sort(function (a, b) {
          return (a.path_with_namespace < b.path_with_namespace) ? -1 : ((a.path_with_namespace > b.path_with_namespace) ? 1 : 0)
        })
        data.projects.forEach(function (project) {
          if (!project.snippets_enabled ||
                        (project.permissions.project_access === null && project.permissions.group_access === null) ||
                        (project.permissions.project_access !== null && project.permissions.project_access.access_level < 20)) {
            return
          }
          $('<option>').val(project.id).text(project.path_with_namespace).appendTo('#snippetImportModalProjects')
        })
        $('#snippetImportModalProjects').prop('disabled', false)
      }
      $('#snippetImportModalLoading').hide()
    })
    .fail(function (data) {
      showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Unable to fetch gitlab parameters :(', '', '', false)
    })
    .always(function () {
      ui.spinner.hide()
    })
})
// import from clipboard
ui.toolbar.import.clipboard.click(function () {
  // na
})
// upload image
ui.toolbar.uploadImage.bind('change', function (e) {
  var files = e.target.files || e.dataTransfer.files
  e.dataTransfer = {}
  e.dataTransfer.files = files

  inlineAttach.onDrop(e)
})
// toc
ui.toc.dropdown.click(function (e) {
  e.stopPropagation()
})
// prevent empty link change hash
$('a[href="#"]').click(function (e) {
  e.preventDefault()
})

// modal actions
var revisions = []
var revisionViewer = null
var revisionInsert = []
var revisionDelete = []
var revisionInsertAnnotation = null
var revisionDeleteAnnotation = null
var revisionList = ui.modal.revision.find('.ui-revision-list')
var revision = null
var revisionTime = null
ui.modal.revision.on('show.bs.modal', function (e) {
  $.get(noteurl + '/revision')
    .done(function (data) {
      parseRevisions(data.revision)
      initRevisionViewer()
    })
    .fail(function (err) {
      if (debug) {
        console.warn(err)
      }
    })
    .always(function () {
      // na
    })
})
function checkRevisionViewer () {
  if (revisionViewer) {
    var container = $(revisionViewer.display.wrapper).parent()
    $(revisionViewer.display.scroller).css('height', container.height() + 'px')
    revisionViewer.refresh()
  }
}
ui.modal.revision.on('shown.bs.modal', checkRevisionViewer)
$(window).resize(checkRevisionViewer)
function parseRevisions (_revisions) {
  if (_revisions.length !== revisions) {
    revisions = _revisions
    var lastRevision = null
    if (revisionList.children().length > 0) {
      lastRevision = revisionList.find('.active').attr('data-revision-time')
    }
    revisionList.html('')
    for (var i = 0; i < revisions.length; i++) {
      var revision = revisions[i]
      var item = $('<a href="#" class="list-group-item"></a>')
      item.attr('data-revision-time', revision.time)
      if (lastRevision === revision.time) item.addClass('active')
      var itemHeading = $('<h5 class="list-group-item-heading"></h5>')
      itemHeading.html('<i class="fa fa-clock-o"></i> ' + moment(revision.time).format('llll'))
      var itemText = $('<p class="list-group-item-text"></p>')
      itemText.html('<i class="fa fa-file-text"></i> Length: ' + revision.length)
      item.append(itemHeading).append(itemText)
      item.click(function (e) {
        var time = $(this).attr('data-revision-time')
        selectRevision(time)
      })
      revisionList.append(item)
    }
    if (!lastRevision) {
      selectRevision(revisions[0].time)
    }
  }
}
function selectRevision (time) {
  if (time === revisionTime) return
  $.get(noteurl + '/revision/' + time)
    .done(function (data) {
      revision = data
      revisionTime = time
      var lastScrollInfo = revisionViewer.getScrollInfo()
      revisionList.children().removeClass('active')
      revisionList.find('[data-revision-time="' + time + '"]').addClass('active')
      var content = revision.content
      revisionViewer.setValue(content)
      revisionViewer.scrollTo(null, lastScrollInfo.top)
      revisionInsert = []
      revisionDelete = []
      // mark the text which have been insert or delete
      if (revision.patch.length > 0) {
        var bias = 0
        for (var j = 0; j < revision.patch.length; j++) {
          var patch = revision.patch[j]
          var currIndex = patch.start1 + bias
          for (var i = 0; i < patch.diffs.length; i++) {
            var diff = patch.diffs[i]
            // ignore if diff only contains line breaks
            if ((diff[1].match(/\n/g) || []).length === diff[1].length) continue
            var prePos
            var postPos
            switch (diff[0]) {
              case 0: // retain
                currIndex += diff[1].length
                break
              case 1: // insert
                prePos = revisionViewer.posFromIndex(currIndex)
                postPos = revisionViewer.posFromIndex(currIndex + diff[1].length)
                revisionInsert.push({
                  from: prePos,
                  to: postPos
                })
                revisionViewer.markText(prePos, postPos, {
                  css: 'background-color: rgba(230,255,230,0.7); text-decoration: underline;'
                })
                currIndex += diff[1].length
                break
              case -1: // delete
                prePos = revisionViewer.posFromIndex(currIndex)
                revisionViewer.replaceRange(diff[1], prePos)
                postPos = revisionViewer.posFromIndex(currIndex + diff[1].length)
                revisionDelete.push({
                  from: prePos,
                  to: postPos
                })
                revisionViewer.markText(prePos, postPos, {
                  css: 'background-color: rgba(255,230,230,0.7); text-decoration: line-through;'
                })
                bias += diff[1].length
                currIndex += diff[1].length
                break
            }
          }
        }
      }
      revisionInsertAnnotation.update(revisionInsert)
      revisionDeleteAnnotation.update(revisionDelete)
    })
    .fail(function (err) {
      if (debug) {
        console.warn(err)
      }
    })
    .always(function () {
      // na
    })
}
function initRevisionViewer () {
  if (revisionViewer) return
  var revisionViewerTextArea = document.getElementById('revisionViewer')
  revisionViewer = CodeMirror.fromTextArea(revisionViewerTextArea, {
    mode: defaultEditorMode,
    viewportMargin: viewportMargin,
    lineNumbers: true,
    lineWrapping: true,
    showCursorWhenSelecting: true,
    inputStyle: 'textarea',
    gutters: ['CodeMirror-linenumbers'],
    flattenSpans: true,
    addModeClass: true,
    readOnly: true,
    autoRefresh: true,
    scrollbarStyle: 'overlay'
  })
  revisionInsertAnnotation = revisionViewer.annotateScrollbar({ className: 'CodeMirror-insert-match' })
  revisionDeleteAnnotation = revisionViewer.annotateScrollbar({ className: 'CodeMirror-delete-match' })
  checkRevisionViewer()
}
$('#revisionModalDownload').click(function () {
  if (!revision) return
  var filename = renderFilename() + '_' + revisionTime + '.md'
  var blob = new Blob([revision.content], {
    type: 'text/markdown;charset=utf-8'
  })
  saveAs(blob, filename, true)
})
$('#revisionModalRevert').click(function () {
  if (!revision) return
  editor.setValue(revision.content)
  ui.modal.revision.modal('hide')
})
// snippet projects
ui.modal.snippetImportProjects.change(function () {
  var accesstoken = $('#snippetImportModalAccessToken').val()
  var baseURL = $('#snippetImportModalBaseURL').val()
  var project = $('#snippetImportModalProjects').val()
  var version = $('#snippetImportModalVersion').val()
  $('#snippetImportModalLoading').show()
  $('#snippetImportModalContent').val('/projects/' + project)
  $.get(baseURL + '/api/' + version + '/projects/' + project + '/snippets?access_token=' + accesstoken)
    .done(function (data) {
      $('#snippetImportModalSnippets').find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Snippets</option>')
      data.forEach(function (snippet) {
        $('<option>').val(snippet.id).text(snippet.title).appendTo($('#snippetImportModalSnippets'))
      })
      $('#snippetImportModalLoading').hide()
      $('#snippetImportModalSnippets').prop('disabled', false)
    })
    .fail(function (err) {
      if (debug) {
        console.warn(err)
      }
    })
    .always(function () {
      // na
    })
})
// snippet snippets
ui.modal.snippetImportSnippets.change(function () {
  var snippet = $('#snippetImportModalSnippets').val()
  $('#snippetImportModalContent').val($('#snippetImportModalContent').val() + '/snippets/' + snippet)
})

function scrollToTop () {
  if (appState.currentMode === modeType.both) {
    if (editor.getScrollInfo().top !== 0) { editor.scrollTo(0, 0) } else {
      ui.area.view.animate({
        scrollTop: 0
      }, 100, 'linear')
    }
  } else {
    $('body, html').stop(true, true).animate({
      scrollTop: 0
    }, 100, 'linear')
  }
}

function scrollToBottom () {
  if (appState.currentMode === modeType.both) {
    var scrollInfo = editor.getScrollInfo()
    var scrollHeight = scrollInfo.height
    if (scrollInfo.top !== scrollHeight) { editor.scrollTo(0, scrollHeight * 2) } else {
      ui.area.view.animate({
        scrollTop: ui.area.view[0].scrollHeight
      }, 100, 'linear')
    }
  } else {
    $('body, html').stop(true, true).animate({
      scrollTop: $(document.body)[0].scrollHeight
    }, 100, 'linear')
  }
}

window.scrollToTop = scrollToTop
window.scrollToBottom = scrollToBottom

var enoughForAffixToc = true

function applyScrollspyActive (top, headerMap, headers, target, offset) {
  var index = 0
  for (var i = headerMap.length - 1; i >= 0; i--) {
    if (top >= (headerMap[i] + offset) && headerMap[i + 1] && top < (headerMap[i + 1] + offset)) {
      index = i
      break
    }
  }
  var header = $(headers[index])
  var active = target.find('a[href="#' + header.attr('id') + '"]')
  active.closest('li').addClass('active').parent().closest('li').addClass('active').parent().closest('li').addClass('active')
}

// clipboard modal
// fix for wrong autofocus
$('#clipboardModal').on('shown.bs.modal', function () {
  $('#clipboardModal').blur()
})
$('#clipboardModalClear').click(function () {
  $('#clipboardModalContent').html('')
})
$('#clipboardModalConfirm').click(function () {
  var data = $('#clipboardModalContent').html()
  if (data) {
    parseToEditor(data)
    $('#clipboardModal').modal('hide')
    $('#clipboardModalContent').html('')
  }
})

// refresh modal
$('#refreshModalRefresh').click(function () {
  location.reload(true)
})

// gist import modal
$('#gistImportModalClear').click(function () {
  $('#gistImportModalContent').val('')
})
$('#gistImportModalConfirm').click(function () {
  var gisturl = $('#gistImportModalContent').val()
  if (!gisturl) return
  $('#gistImportModal').modal('hide')
  $('#gistImportModalContent').val('')
  if (!isURL(gisturl)) {
    showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid URL :(', '', '', false)
  } else {
    var hostname = wurl('hostname', gisturl)
    if (hostname !== 'gist.github.com') {
      showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid Gist URL :(', '', '', false)
    } else {
      ui.spinner.show()
      $.get('https://api.github.com/gists/' + wurl('-1', gisturl))
        .done(function (data) {
          if (data.files) {
            var contents = ''
            Object.keys(data.files).forEach(function (key) {
              contents += key
              contents += '\n---\n'
              contents += data.files[key].content
              contents += '\n\n'
            })
            replaceAll(contents)
          } else {
            showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Unable to fetch gist files :(', '', '', false)
          }
        })
        .fail(function (data) {
          showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid Gist URL :(', '', JSON.stringify(data), false)
        })
        .always(function () {
          ui.spinner.hide()
        })
    }
  }
})

// snippet import modal
$('#snippetImportModalClear').click(function () {
  $('#snippetImportModalContent').val('')
  $('#snippetImportModalProjects').val('init')
  $('#snippetImportModalSnippets').val('init')
  $('#snippetImportModalSnippets').prop('disabled', true)
})
$('#snippetImportModalConfirm').click(function () {
  var snippeturl = $('#snippetImportModalContent').val()
  if (!snippeturl) return
  $('#snippetImportModal').modal('hide')
  $('#snippetImportModalContent').val('')
  if (!/^.+\/snippets\/.+$/.test(snippeturl)) {
    showMessageModal('<i class="fa fa-github"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', '', false)
  } else {
    ui.spinner.show()
    var accessToken = '?access_token=' + $('#snippetImportModalAccessToken').val()
    var fullURL = $('#snippetImportModalBaseURL').val() + '/api/' + $('#snippetImportModalVersion').val() + snippeturl
    $.get(fullURL + accessToken)
      .done(function (data) {
        var content = '# ' + (data.title || 'Snippet Import')
        var fileInfo = data.file_name.split('.')
        fileInfo[1] = (fileInfo[1]) ? fileInfo[1] : 'md'
        $.get(fullURL + '/raw' + accessToken)
          .done(function (raw) {
            if (raw) {
              content += '\n\n'
              if (fileInfo[1] !== 'md') {
                content += '```' + fileTypes[fileInfo[1]] + '\n'
              }
              content += raw
              if (fileInfo[1] !== 'md') {
                content += '\n```'
              }
              replaceAll(content)
            }
          })
          .fail(function (data) {
            showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', JSON.stringify(data), false)
          })
          .always(function () {
            ui.spinner.hide()
          })
      })
      .fail(function (data) {
        showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', JSON.stringify(data), false)
      })
  }
})

// snippet export modal
$('#snippetExportModalConfirm').click(function () {
  var accesstoken = $('#snippetExportModalAccessToken').val()
  var baseURL = $('#snippetExportModalBaseURL').val()
  var version = $('#snippetExportModalVersion').val()

  var data = {
    title: $('#snippetExportModalTitle').val(),
    file_name: $('#snippetExportModalFileName').val(),
    code: editor.getValue(),
    visibility_level: $('#snippetExportModalVisibility').val(),
    visibility: $('#snippetExportModalVisibility').val() === '0' ? 'private' : ($('#snippetExportModalVisibility').val() === '10' ? 'internal' : 'private')
  }

  if (!data.title || !data.file_name || !data.code || !data.visibility_level || !$('#snippetExportModalProjects').val()) return
  $('#snippetExportModalLoading').show()
  var fullURL = baseURL + '/api/' + version + '/projects/' + $('#snippetExportModalProjects').val() + '/snippets?access_token=' + accesstoken
  $.post(fullURL
    , data
    , function (ret) {
      $('#snippetExportModalLoading').hide()
      $('#snippetExportModal').modal('hide')
      var redirect = baseURL + '/' + $("#snippetExportModalProjects option[value='" + $('#snippetExportModalProjects').val() + "']").text() + '/snippets/' + ret.id
      showMessageModal('<i class="fa fa-gitlab"></i> Export to Snippet', 'Export Successful!', redirect, 'View Snippet Here', true)
    }
  )
})

function parseToEditor (data) {
  var turndownService = new TurndownService({
    defaultReplacement: function (innerHTML, node) {
      return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML
    }
  })
  var parsed = turndownService.turndown(data)
  if (parsed) { replaceAll(parsed) }
}

function replaceAll (data) {
  editor.replaceRange(data, {
    line: 0,
    ch: 0
  }, {
    line: editor.lastLine(),
    ch: editor.lastLine().length
  }, '+input')
}

function importFromUrl (url) {
  if (!url) return
  if (!isURL(url)) {
    showMessageModal('<i class="fa fa-cloud-download"></i> Import from URL', 'Not a valid URL :(', '', '', false)
    return
  }
  $.ajax({
    method: 'GET',
    url: url,
    success: function (data) {
      var extension = url.split('.').pop()
      if (extension === 'html') { parseToEditor(data) } else { replaceAll(data) }
    },
    error: function (data) {
      showMessageModal('<i class="fa fa-cloud-download"></i> Import from URL', 'Import failed :(', '', JSON.stringify(data), false)
    },
    complete: function () {
      ui.spinner.hide()
    }
  })
}

// mode
ui.toolbar.mode.click(function () {
  toggleMode()
})
// edit
ui.toolbar.edit.click(function () {
  changeMode(modeType.edit)
})
// view
ui.toolbar.view.click(function () {
  changeMode(modeType.view)
})
// both
ui.toolbar.both.click(function () {
  changeMode(modeType.both)
})

ui.toolbar.night.click(function () {
  toggleNightMode()
})
// permission
// freely
ui.infobar.permission.freely.click(function () {
  emitPermission('freely')
})
// editable
ui.infobar.permission.editable.click(function () {
  emitPermission('editable')
})
// locked
ui.infobar.permission.locked.click(function () {
  emitPermission('locked')
})
// private
ui.infobar.permission.private.click(function () {
  emitPermission('private')
})
// limited
ui.infobar.permission.limited.click(function () {
  emitPermission('limited')
})
// protected
ui.infobar.permission.protected.click(function () {
  emitPermission('protected')
})
// delete note
ui.infobar.delete.click(function () {
  $('.delete-modal').modal('show')
})
$('.ui-delete-modal-confirm').click(function () {
  socket.emit('delete')
})

function toggleNightMode () {
  var $body = $('body')
  var isActive = ui.toolbar.night.hasClass('active')
  if (isActive) {
    $body.removeClass('night')
    appState.nightMode = false
  } else {
    $body.addClass('night')
    appState.nightMode = true
  }
  if (store.enabled) {
    store.set('nightMode', !isActive)
  } else {
    Cookies.set('nightMode', !isActive, {
      expires: 365
    })
  }
}
function emitPermission (_permission) {
  if (_permission !== permission) {
    socket.emit('permission', _permission)
  }
}

function updatePermission (newPermission) {
  if (permission !== newPermission) {
    permission = newPermission
    if (window.loaded) refreshView()
  }
  var label = null
  var title = null
  switch (permission) {
    case 'freely':
      label = '<i class="fa fa-leaf"></i> Freely'
      title = 'Anyone can edit'
      break
    case 'editable':
      label = '<i class="fa fa-shield"></i> Editable'
      title = 'Signed people can edit'
      break
    case 'limited':
      label = '<i class="fa fa-id-card"></i> Limited'
      title = 'Signed people can edit (forbid guest)'
      break
    case 'locked':
      label = '<i class="fa fa-lock"></i> Locked'
      title = 'Only owner can edit'
      break
    case 'protected':
      label = '<i class="fa fa-umbrella"></i> Protected'
      title = 'Only owner can edit (forbid guest)'
      break
    case 'private':
      label = '<i class="fa fa-hand-stop-o"></i> Private'
      title = 'Only owner can view & edit'
      break
  }
  if (personalInfo.userid && window.owner && personalInfo.userid === window.owner) {
    label += ' <i class="fa fa-caret-down"></i>'
    ui.infobar.permission.label.removeClass('disabled')
  } else {
    ui.infobar.permission.label.addClass('disabled')
  }
  ui.infobar.permission.label.html(label).attr('title', title)
}

function havePermission () {
  var bool = false
  switch (permission) {
    case 'freely':
      bool = true
      break
    case 'editable':
    case 'limited':
      if (!personalInfo.login) {
        bool = false
      } else {
        bool = true
      }
      break
    case 'locked':
    case 'private':
    case 'protected':
      if (!window.owner || personalInfo.userid !== window.owner) {
        bool = false
      } else {
        bool = true
      }
      break
  }
  return bool
}
// global module workaround
window.havePermission = havePermission

// socket.io actions
var io = require('socket.io-client')
var socket = io.connect({
  path: urlpath ? '/' + urlpath + '/socket.io/' : '',
  query: {
    noteId: noteid
  },
  timeout: 5000, // 5 secs to timeout,
  reconnectionAttempts: 20 // retry 20 times on connect failed
})
// overwrite original event for checking login state
var on = socket.on
socket.on = function () {
  if (!checkLoginStateChanged() && !needRefresh) { return on.apply(socket, arguments) }
}
var emit = socket.emit
socket.emit = function () {
  if (!checkLoginStateChanged() && !needRefresh) { emit.apply(socket, arguments) }
}
socket.on('info', function (data) {
  console.error(data)
  switch (data.code) {
    case 403:
      location.href = serverurl + '/403'
      break
    case 404:
      location.href = serverurl + '/404'
      break
    case 500:
      location.href = serverurl + '/500'
      break
  }
})
socket.on('error', function (data) {
  console.error(data)
  if (data.message && data.message.indexOf('AUTH failed') === 0) { location.href = serverurl + '/403' }
})
socket.on('delete', function () {
  if (personalInfo.login) {
    deleteServerHistory(noteid, function (err, data) {
      if (!err) location.href = serverurl
    })
  } else {
    getHistory(function (notehistory) {
      var newnotehistory = removeHistory(noteid, notehistory)
      saveHistory(newnotehistory)
      location.href = serverurl
    })
  }
})
var retryTimer = null
socket.on('maintenance', function () {
  cmClient.revision = -1
})
socket.on('disconnect', function (data) {
  showStatus(statusType.offline)
  if (window.loaded) {
    saveInfo()
    lastInfo.history = editor.getHistory()
  }
  if (!editor.getOption('readOnly')) { editor.setOption('readOnly', true) }
  if (!retryTimer) {
    retryTimer = setInterval(function () {
      if (!needRefresh) socket.connect()
    }, 1000)
  }
})
socket.on('reconnect', function (data) {
  // sync back any change in offline
  emitUserStatus(true)
  cursorActivity(editor)
  socket.emit('online users')
})
socket.on('connect', function (data) {
  clearInterval(retryTimer)
  retryTimer = null
  personalInfo['id'] = socket.id
  showStatus(statusType.connected)
  socket.emit('version')
})
socket.on('version', function (data) {
  if (version !== data.version) {
    if (version < data.minimumCompatibleVersion) {
      setRefreshModal('incompatible-version')
      setNeedRefresh()
    } else {
      setRefreshModal('new-version')
    }
  }
})
var authors = []
var authorship = []
var authorMarks = {} // temp variable
var addTextMarkers = [] // temp variable
function updateInfo (data) {
  if (Object.hasOwnProperty.call(data, 'createtime') && window.createtime !== data.createtime) {
    window.createtime = data.createtime
    updateLastChange()
  }
  if (Object.hasOwnProperty.call(data, 'updatetime') && window.lastchangetime !== data.updatetime) {
    window.lastchangetime = data.updatetime
    updateLastChange()
  }
  if (Object.hasOwnProperty.call(data, 'owner') && window.owner !== data.owner) {
    window.owner = data.owner
    window.ownerprofile = data.ownerprofile
    updateOwner()
  }
  if (Object.hasOwnProperty.call(data, 'lastchangeuser') && window.lastchangeuser !== data.lastchangeuser) {
    window.lastchangeuser = data.lastchangeuser
    window.lastchangeuserprofile = data.lastchangeuserprofile
    updateLastChangeUser()
    updateOwner()
  }
  if (Object.hasOwnProperty.call(data, 'authors') && authors !== data.authors) {
    authors = data.authors
  }
  if (Object.hasOwnProperty.call(data, 'authorship') && authorship !== data.authorship) {
    authorship = data.authorship
    updateAuthorship()
  }
}
var updateAuthorship = _.debounce(function () {
  editor.operation(updateAuthorshipInner)
}, 50)
function initMark () {
  return {
    gutter: {
      userid: null,
      timestamp: null
    },
    textmarkers: []
  }
}
function initMarkAndCheckGutter (mark, author, timestamp) {
  if (!mark) mark = initMark()
  if (!mark.gutter.userid || mark.gutter.timestamp > timestamp) {
    mark.gutter.userid = author.userid
    mark.gutter.timestamp = timestamp
  }
  return mark
}
var addStyleRule = (function () {
  var added = {}
  var styleElement = document.createElement('style')
  document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement)
  var styleSheet = styleElement.sheet

  return function (css) {
    if (added[css]) {
      return
    }
    added[css] = true
    styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length)
  }
}())
function updateAuthorshipInner () {
  // ignore when ot not synced yet
  if (havePendingOperation()) return
  authorMarks = {}
  for (let i = 0; i < authorship.length; i++) {
    var atom = authorship[i]
    const author = authors[atom[0]]
    if (author) {
      var prePos = editor.posFromIndex(atom[1])
      var preLine = editor.getLine(prePos.line)
      var postPos = editor.posFromIndex(atom[2])
      var postLine = editor.getLine(postPos.line)
      if (prePos.ch === 0 && postPos.ch === postLine.length) {
        for (let j = prePos.line; j <= postPos.line; j++) {
          if (editor.getLine(j)) {
            authorMarks[j] = initMarkAndCheckGutter(authorMarks[j], author, atom[3])
          }
        }
      } else if (postPos.line - prePos.line >= 1) {
        var startLine = prePos.line
        var endLine = postPos.line
        if (prePos.ch === preLine.length) {
          startLine++
        } else if (prePos.ch !== 0) {
          const mark = initMarkAndCheckGutter(authorMarks[prePos.line], author, atom[3])
          var _postPos = {
            line: prePos.line,
            ch: preLine.length
          }
          if (JSON.stringify(prePos) !== JSON.stringify(_postPos)) {
            mark.textmarkers.push({
              userid: author.userid,
              pos: [prePos, _postPos]
            })
            startLine++
          }
          authorMarks[prePos.line] = mark
        }
        if (postPos.ch === 0) {
          endLine--
        } else if (postPos.ch !== postLine.length) {
          const mark = initMarkAndCheckGutter(authorMarks[postPos.line], author, atom[3])
          var _prePos = {
            line: postPos.line,
            ch: 0
          }
          if (JSON.stringify(_prePos) !== JSON.stringify(postPos)) {
            mark.textmarkers.push({
              userid: author.userid,
              pos: [_prePos, postPos]
            })
            endLine--
          }
          authorMarks[postPos.line] = mark
        }
        for (let j = startLine; j <= endLine; j++) {
          if (editor.getLine(j)) {
            authorMarks[j] = initMarkAndCheckGutter(authorMarks[j], author, atom[3])
          }
        }
      } else {
        const mark = initMarkAndCheckGutter(authorMarks[prePos.line], author, atom[3])
        if (JSON.stringify(prePos) !== JSON.stringify(postPos)) {
          mark.textmarkers.push({
            userid: author.userid,
            pos: [prePos, postPos]
          })
        }
        authorMarks[prePos.line] = mark
      }
    }
  }
  addTextMarkers = []
  editor.eachLine(iterateLine)
  const allTextMarks = editor.getAllMarks()
  for (let i = 0; i < allTextMarks.length; i++) {
    const _textMarker = allTextMarks[i]
    const pos = _textMarker.find()
    let found = false
    for (let j = 0; j < addTextMarkers.length; j++) {
      const textMarker = addTextMarkers[j]
      const author = authors[textMarker.userid]
      const className = 'authorship-inline-' + author.color.substr(1)
      var obj = {
        from: textMarker.pos[0],
        to: textMarker.pos[1]
      }
      if (JSON.stringify(pos) === JSON.stringify(obj) && _textMarker.className &&
                _textMarker.className.indexOf(className) > -1) {
        addTextMarkers.splice(j, 1)
        j--
        found = true
        break
      }
    }
    if (!found && _textMarker.className && _textMarker.className.indexOf('authorship-inline') > -1) {
      _textMarker.clear()
    }
  }
  for (let i = 0; i < addTextMarkers.length; i++) {
    const textMarker = addTextMarkers[i]
    const author = authors[textMarker.userid]
    const rgbcolor = hex2rgb(author.color)
    const colorString = `rgba(${rgbcolor.red},${rgbcolor.green},${rgbcolor.blue},0.7)`
    const styleString = `background-image: linear-gradient(to top, ${colorString} 1px, transparent 1px);`
    const className = `authorship-inline-${author.color.substr(1)}`
    const rule = `.${className} { ${styleString} }`
    addStyleRule(rule)
    editor.markText(textMarker.pos[0], textMarker.pos[1], {
      className: 'authorship-inline ' + className,
      title: author.name
    })
  }
}
function iterateLine (line) {
  const lineNumber = line.lineNo()
  const currMark = authorMarks[lineNumber]
  const author = currMark ? authors[currMark.gutter.userid] : null
  if (currMark && author) {
    const className = 'authorship-gutter-' + author.color.substr(1)
    const gutters = line.gutterMarkers
    if (!gutters || !gutters['authorship-gutters'] ||
        !gutters['authorship-gutters'].className ||
        !gutters['authorship-gutters'].className.indexOf(className) < 0) {
      const styleString = `border-left: 3px solid ${author.color}; height: ${defaultTextHeight}px; margin-left: 3px;`
      const rule = `.${className} { ${styleString} }`
      addStyleRule(rule)
      const gutter = $('<div>', {
        class: 'authorship-gutter ' + className,
        title: author.name
      })
      editor.setGutterMarker(line, 'authorship-gutters', gutter[0])
    }
  } else {
    editor.setGutterMarker(line, 'authorship-gutters', null)
  }
  if (currMark && currMark.textmarkers.length > 0) {
    for (let i = 0; i < currMark.textmarkers.length; i++) {
      const textMarker = currMark.textmarkers[i]
      if (textMarker.userid !== currMark.gutter.userid) {
        addTextMarkers.push(textMarker)
      }
    }
  }
}
editorInstance.on('update', function () {
  $('.authorship-gutter:not([data-original-title])').tooltip({
    container: '.CodeMirror-lines',
    placement: 'right',
    delay: { show: 500, hide: 100 }
  })
  $('.authorship-inline:not([data-original-title])').tooltip({
    container: '.CodeMirror-lines',
    placement: 'bottom',
    delay: { show: 500, hide: 100 }
  })
  // clear tooltip which described element has been removed
  $('[id^="tooltip"]').each(function (index, element) {
    var $ele = $(element)
    if ($('[aria-describedby="' + $ele.attr('id') + '"]').length <= 0) $ele.remove()
  })
})
socket.on('check', function (data) {
  updateInfo(data)
})
socket.on('permission', function (data) {
  updatePermission(data.permission)
})

var permission = null
socket.on('refresh', function (data) {
  editorInstance.config.docmaxlength = data.docmaxlength
  editor.setOption('maxLength', editorInstance.config.docmaxlength)
  updateInfo(data)
  updatePermission(data.permission)
  if (!window.loaded) {
    // auto change mode if no content detected
    var nocontent = editor.getValue().length <= 0
    if (nocontent) {
      if (visibleXS) { appState.currentMode = modeType.edit } else { appState.currentMode = modeType.both }
    }
    // parse mode from url
    if (window.location.search.length > 0) {
      var urlMode = modeType[window.location.search.substr(1)]
      if (urlMode) appState.currentMode = urlMode
    }
    changeMode(appState.currentMode)
    if (nocontent && !visibleXS) {
      editor.focus()
      editor.refresh()
    }
    updateViewInner() // bring up view rendering earlier
    updateHistory() // update history whether have content or not
    window.loaded = true
    emitUserStatus() // send first user status
    updateOnlineStatus() // update first online status
    setTimeout(function () {
      // work around editor not refresh or doc not fully loaded
      windowResizeInner()
      // work around might not scroll to hash
    }, 1)
  }
  if (editor.getOption('readOnly')) { editor.setOption('readOnly', false) }
})

var EditorClient = ot.EditorClient
var SocketIOAdapter = ot.SocketIOAdapter
var CodeMirrorAdapter = ot.CodeMirrorAdapter
var cmClient = null
var synchronized_ = null

function havePendingOperation () {
  return !!((cmClient && cmClient.state && Object.hasOwnProperty.call(cmClient.state, 'outstanding')))
}

socket.on('doc', function (obj) {
  var body = obj.str
  var bodyMismatch = editor.getValue() !== body
  var setDoc = !cmClient || (cmClient && (cmClient.revision === -1 || (cmClient.revision !== obj.revision && !havePendingOperation()))) || obj.force

  saveInfo()
  if (setDoc && bodyMismatch) {
    if (cmClient) cmClient.editorAdapter.ignoreNextChange = true
    if (body) editor.setValue(body)
    else editor.setValue('')
  }

  if (!window.loaded) {
    editor.clearHistory()
    ui.spinner.hide()
    ui.content.fadeIn()
  } else {
    // if current doc is equal to the doc before disconnect
    if (setDoc && bodyMismatch) editor.clearHistory()
    else if (lastInfo.history) editor.setHistory(lastInfo.history)
    lastInfo.history = null
  }

  if (!cmClient) {
    cmClient = window.cmClient = new EditorClient(
      obj.revision, obj.clients,
      new SocketIOAdapter(socket), new CodeMirrorAdapter(editor)
    )
    synchronized_ = cmClient.state
  } else if (setDoc) {
    if (bodyMismatch) {
      cmClient.undoManager.undoStack.length = 0
      cmClient.undoManager.redoStack.length = 0
    }
    cmClient.revision = obj.revision
    cmClient.setState(synchronized_)
    cmClient.initializeClientList()
    cmClient.initializeClients(obj.clients)
  } else if (havePendingOperation()) {
    cmClient.serverReconnect()
  }

  if (setDoc && bodyMismatch) {
    isDirty = true
    updateView()
  }

  restoreInfo()
})

socket.on('ack', function () {
  isDirty = true
  updateView()
})

socket.on('operation', function () {
  isDirty = true
  updateView()
})

socket.on('online users', function (data) {
  if (debug) { console.debug(data) }
  onlineUsers = data.users
  updateOnlineStatus()
  $('.CodeMirror-other-cursors').children().each(function (key, value) {
    var found = false
    for (var i = 0; i < data.users.length; i++) {
      var user = data.users[i]
      if ($(this).attr('id') === user.id) { found = true }
    }
    if (!found) {
      $(this).stop(true).fadeOut('normal', function () {
        $(this).remove()
      })
    }
  })
  for (var i = 0; i < data.users.length; i++) {
    var user = data.users[i]
    if (user.id !== socket.id) { buildCursor(user) } else { personalInfo = user }
  }
})
socket.on('user status', function (data) {
  if (debug) { console.debug(data) }
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === data.id) {
      onlineUsers[i] = data
    }
  }
  updateOnlineStatus()
  if (data.id !== socket.id) { buildCursor(data) }
})
socket.on('cursor focus', function (data) {
  if (debug) { console.debug(data) }
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === data.id) {
      onlineUsers[i].cursor = data.cursor
    }
  }
  if (data.id !== socket.id) { buildCursor(data) }
  // force show
  var cursor = $('div[data-clientid="' + data.id + '"]')
  if (cursor.length > 0) {
    cursor.stop(true).fadeIn()
  }
})
socket.on('cursor activity', function (data) {
  if (debug) { console.debug(data) }
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === data.id) {
      onlineUsers[i].cursor = data.cursor
    }
  }
  if (data.id !== socket.id) { buildCursor(data) }
})
socket.on('cursor blur', function (data) {
  if (debug) { console.debug(data) }
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === data.id) {
      onlineUsers[i].cursor = null
    }
  }
  if (data.id !== socket.id) { buildCursor(data) }
  // force hide
  var cursor = $('div[data-clientid="' + data.id + '"]')
  if (cursor.length > 0) {
    cursor.stop(true).fadeOut()
  }
})

var options = {
  valueNames: ['id', 'name'],
  item: '<li class="ui-user-item">' +
        '<span class="id" style="display:none;"></span>' +
        '<a href="#">' +
            '<span class="pull-left"><i class="ui-user-icon"></i></span><span class="ui-user-name name"></span><span class="pull-right"><i class="fa fa-circle ui-user-status"></i></span>' +
        '</a>' +
        '</li>'
}
var onlineUserList = new List('online-user-list', options)
var shortOnlineUserList = new List('short-online-user-list', options)

function updateOnlineStatus () {
  if (!window.loaded || !socket.connected) return
  var _onlineUsers = deduplicateOnlineUsers(onlineUsers)
  showStatus(statusType.online, _onlineUsers.length)
  var items = onlineUserList.items
  // update or remove current list items
  for (let i = 0; i < items.length; i++) {
    let found = false
    let foundindex = null
    for (let j = 0; j < _onlineUsers.length; j++) {
      if (items[i].values().id === _onlineUsers[j].id) {
        foundindex = j
        found = true
        break
      }
    }
    const id = items[i].values().id
    if (found) {
      onlineUserList.get('id', id)[0].values(_onlineUsers[foundindex])
      shortOnlineUserList.get('id', id)[0].values(_onlineUsers[foundindex])
    } else {
      onlineUserList.remove('id', id)
      shortOnlineUserList.remove('id', id)
    }
  }
  // add not in list items
  for (let i = 0; i < _onlineUsers.length; i++) {
    let found = false
    for (let j = 0; j < items.length; j++) {
      if (items[j].values().id === _onlineUsers[i].id) {
        found = true
        break
      }
    }
    if (!found) {
      onlineUserList.add(_onlineUsers[i])
      shortOnlineUserList.add(_onlineUsers[i])
    }
  }
  // sorting
  sortOnlineUserList(onlineUserList)
  sortOnlineUserList(shortOnlineUserList)
  // render list items
  renderUserStatusList(onlineUserList)
  renderUserStatusList(shortOnlineUserList)
}

function sortOnlineUserList (list) {
  // sort order by isSelf, login state, idle state, alphabet name, color brightness
  list.sort('', {
    sortFunction: function (a, b) {
      var usera = a.values()
      var userb = b.values()
      var useraIsSelf = (usera.id === personalInfo.id || (usera.login && usera.userid === personalInfo.userid))
      var userbIsSelf = (userb.id === personalInfo.id || (userb.login && userb.userid === personalInfo.userid))
      if (useraIsSelf && !userbIsSelf) {
        return -1
      } else if (!useraIsSelf && userbIsSelf) {
        return 1
      } else {
        if (usera.login && !userb.login) { return -1 } else if (!usera.login && userb.login) { return 1 } else {
          if (!usera.idle && userb.idle) { return -1 } else if (usera.idle && !userb.idle) { return 1 } else {
            if (usera.name && userb.name && usera.name.toLowerCase() < userb.name.toLowerCase()) {
              return -1
            } else if (usera.name && userb.name && usera.name.toLowerCase() > userb.name.toLowerCase()) {
              return 1
            } else {
              if (usera.color && userb.color && usera.color.toLowerCase() < userb.color.toLowerCase()) { return -1 } else if (usera.color && userb.color && usera.color.toLowerCase() > userb.color.toLowerCase()) { return 1 } else { return 0 }
            }
          }
        }
      }
    }
  })
}

function renderUserStatusList (list) {
  var items = list.items
  for (var j = 0; j < items.length; j++) {
    var item = items[j]
    var userstatus = $(item.elm).find('.ui-user-status')
    var usericon = $(item.elm).find('.ui-user-icon')
    if (item.values().login && item.values().photo) {
      usericon.css('background-image', 'url(' + item.values().photo + ')')
      // add 1px more to right, make it feel aligned
      usericon.css('margin-right', '6px')
      $(item.elm).css('border-left', '4px solid ' + item.values().color)
      usericon.css('margin-left', '-4px')
    } else {
      usericon.css('background-color', item.values().color)
    }
    userstatus.removeClass('ui-user-status-offline ui-user-status-online ui-user-status-idle')
    if (item.values().idle) { userstatus.addClass('ui-user-status-idle') } else { userstatus.addClass('ui-user-status-online') }
  }
}

function deduplicateOnlineUsers (list) {
  var _onlineUsers = []
  for (var i = 0; i < list.length; i++) {
    var user = $.extend({}, list[i])
    if (!user.userid) { _onlineUsers.push(user) } else {
      var found = false
      for (var j = 0; j < _onlineUsers.length; j++) {
        if (_onlineUsers[j].userid === user.userid) {
          // keep self color when login
          if (user.id === personalInfo.id) {
            _onlineUsers[j].color = user.color
          }
          // keep idle state if any of self client not idle
          if (!user.idle) {
            _onlineUsers[j].idle = user.idle
            _onlineUsers[j].color = user.color
          }
          found = true
          break
        }
      }
      if (!found) { _onlineUsers.push(user) }
    }
  }
  return _onlineUsers
}

var userStatusCache = null

function emitUserStatus (force) {
  if (!window.loaded) return
  var type = null
  if (visibleXS) { type = 'xs' } else if (visibleSM) { type = 'sm' } else if (visibleMD) { type = 'md' } else if (visibleLG) { type = 'lg' }

  personalInfo['idle'] = idle.isAway
  personalInfo['type'] = type

  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === personalInfo.id) {
      onlineUsers[i] = personalInfo
    }
  }

  var userStatus = {
    idle: idle.isAway,
    type: type
  }

  if (force || JSON.stringify(userStatus) !== JSON.stringify(userStatusCache)) {
    socket.emit('user status', userStatus)
    userStatusCache = userStatus
  }
}

function checkCursorTag (coord, ele) {
  if (!ele) return // return if element not exists
  // set margin
  var tagRightMargin = 0
  var tagBottomMargin = 2
  // use sizer to get the real doc size (won't count status bar and gutters)
  var docWidth = ui.area.codemirrorSizer.width()
  // get editor size (status bar not count in)
  var editorHeight = ui.area.codemirror.height()
  // get element size
  var width = ele.outerWidth()
  var height = ele.outerHeight()
  var padding = (ele.outerWidth() - ele.width()) / 2
  // get coord position
  var left = coord.left
  var top = coord.top
  // get doc top offset (to workaround with viewport)
  var docTopOffset = ui.area.codemirrorSizerInner.position().top
  // set offset
  var offsetLeft = -3
  var offsetTop = defaultTextHeight
  // only do when have width and height
  if (width > 0 && height > 0) {
    // flip x when element right bound larger than doc width
    if (left + width + offsetLeft + tagRightMargin > docWidth) {
      offsetLeft = -(width + tagRightMargin) + padding + offsetLeft
    }
    // flip y when element bottom bound larger than doc height
    // and element top position is larger than element height
    if (top + docTopOffset + height + offsetTop + tagBottomMargin > Math.max(editor.doc.height, editorHeight) && top + docTopOffset > height + tagBottomMargin) {
      offsetTop = -(height)
    }
  }
  // set position
  ele[0].style.left = offsetLeft + 'px'
  ele[0].style.top = offsetTop + 'px'
}

function buildCursor (user) {
  if (appState.currentMode === modeType.view) return
  if (!user.cursor) return
  var coord = editor.charCoords(user.cursor, 'windows')
  coord.left = coord.left < 4 ? 4 : coord.left
  coord.top = coord.top < 0 ? 0 : coord.top
  var iconClass = 'fa-user'
  switch (user.type) {
    case 'xs':
      iconClass = 'fa-mobile'
      break
    case 'sm':
      iconClass = 'fa-tablet'
      break
    case 'md':
      iconClass = 'fa-desktop'
      break
    case 'lg':
      iconClass = 'fa-desktop'
      break
  }
  if ($('div[data-clientid="' + user.id + '"]').length <= 0) {
    const cursor = $('<div data-clientid="' + user.id + '" class="CodeMirror-other-cursor" style="display:none;"></div>')
    cursor.attr('data-line', user.cursor.line)
    cursor.attr('data-ch', user.cursor.ch)
    cursor.attr('data-offset-left', 0)
    cursor.attr('data-offset-top', 0)

    const cursorbar = $('<div class="cursorbar">&nbsp;</div>')
    cursorbar[0].style.height = defaultTextHeight + 'px'
    cursorbar[0].style.borderLeft = '2px solid ' + user.color

    var icon = '<i class="fa ' + iconClass + '"></i>'

    const cursortag = $('<div class="cursortag">' + icon + '&nbsp;<span class="name">' + user.name + '</span></div>')
    // cursortag[0].style.background = color;
    cursortag[0].style.color = user.color

    cursor.attr('data-mode', 'hover')
    cursortag.delay(2000).fadeOut('fast')
    cursor.hover(
      function () {
        if (cursor.attr('data-mode') === 'hover') { cursortag.stop(true).fadeIn('fast') }
      },
      function () {
        if (cursor.attr('data-mode') === 'hover') { cursortag.stop(true).fadeOut('fast') }
      })

    var hideCursorTagDelay = 2000
    var hideCursorTagTimer = null

    var switchMode = function (ele) {
      if (ele.attr('data-mode') === 'state') { ele.attr('data-mode', 'hover') } else if (ele.attr('data-mode') === 'hover') { ele.attr('data-mode', 'state') }
    }

    var switchTag = function (ele) {
      if (ele.css('display') === 'none') { ele.stop(true).fadeIn('fast') } else { ele.stop(true).fadeOut('fast') }
    }

    var hideCursorTag = function () {
      if (cursor.attr('data-mode') === 'hover') { cursortag.fadeOut('fast') }
    }
    cursor.on('touchstart', function (e) {
      var display = cursortag.css('display')
      cursortag.stop(true).fadeIn('fast')
      clearTimeout(hideCursorTagTimer)
      hideCursorTagTimer = setTimeout(hideCursorTag, hideCursorTagDelay)
      if (display === 'none') {
        e.preventDefault()
        e.stopPropagation()
      }
    })
    cursortag.on('mousedown touchstart', function (e) {
      if (cursor.attr('data-mode') === 'state') { switchTag(cursortag) }
      switchMode(cursor)
      e.preventDefault()
      e.stopPropagation()
    })

    cursor.append(cursorbar)
    cursor.append(cursortag)

    cursor[0].style.left = coord.left + 'px'
    cursor[0].style.top = coord.top + 'px'
    $('.CodeMirror-other-cursors').append(cursor)

    if (!user.idle) { cursor.stop(true).fadeIn() }

    checkCursorTag(coord, cursortag)
  } else {
    const cursor = $('div[data-clientid="' + user.id + '"]')
    cursor.attr('data-line', user.cursor.line)
    cursor.attr('data-ch', user.cursor.ch)

    const cursorbar = cursor.find('.cursorbar')
    cursorbar[0].style.height = defaultTextHeight + 'px'
    cursorbar[0].style.borderLeft = '2px solid ' + user.color

    const cursortag = cursor.find('.cursortag')
    cursortag.find('i').removeClass().addClass('fa').addClass(iconClass)
    cursortag.find('.name').text(user.name)

    if (cursor.css('display') === 'none') {
      cursor[0].style.left = coord.left + 'px'
      cursor[0].style.top = coord.top + 'px'
    } else {
      cursor.animate({
        left: coord.left,
        top: coord.top
      }, {
        duration: cursorAnimatePeriod,
        queue: false
      })
    }

    if (user.idle && cursor.css('display') !== 'none') { cursor.stop(true).fadeOut() } else if (!user.idle && cursor.css('display') === 'none') { cursor.stop(true).fadeIn() }

    checkCursorTag(coord, cursortag)
  }
}

// editor actions
function removeNullByte (cm, change) {
  var str = change.text.join('\n')
  // eslint-disable-next-line no-control-regex
  if (/\u0000/g.test(str) && change.update) {
    // eslint-disable-next-line no-control-regex
    change.update(change.from, change.to, str.replace(/\u0000/g, '').split('\n'))
  }
}
function enforceMaxLength (cm, change) {
  var maxLength = cm.getOption('maxLength')
  if (maxLength && change.update) {
    var str = change.text.join('\n')
    var delta = str.length - (cm.indexFromPos(change.to) - cm.indexFromPos(change.from))
    if (delta <= 0) {
      return false
    }
    delta = cm.getValue().length + delta - maxLength
    if (delta > 0) {
      str = str.substr(0, str.length - delta)
      change.update(change.from, change.to, str.split('\n'))
      return true
    }
  }
  return false
}
let lastDocHeight
var ignoreEmitEvents = ['setValue', 'ignoreHistory']
editorInstance.on('beforeChange', function (cm, change) {
  lastDocHeight = editor.doc.height
  removeNullByte(cm, change)
  if (enforceMaxLength(cm, change)) {
    $('.limit-modal').modal('show')
  }
  var isIgnoreEmitEvent = (ignoreEmitEvents.indexOf(change.origin) !== -1)
  if (!isIgnoreEmitEvent) {
    if (!havePermission()) {
      change.canceled = true
      switch (permission) {
        case 'editable':
          $('.signin-modal').modal('show')
          break
        case 'locked':
        case 'private':
          $('.locked-modal').modal('show')
          break
      }
    }
  } else {
    if (change.origin === 'ignoreHistory') {
      setHaveUnreadChanges(true)
      updateTitleReminder()
    }
  }
  if (cmClient && !socket.connected) { cmClient.editorAdapter.ignoreNextChange = true }
})
editorInstance.on('cut', function () {
  // na
})
editorInstance.on('paste', function () {
  // na
})
editorInstance.on('changes', function (editor, changes) {
  const docHeightChanged = editor.doc.height !== lastDocHeight
  updateHistory()
  var docLength = editor.getValue().length
  // workaround for big documents
  var newViewportMargin = 20
  if (docLength > 20000) {
    newViewportMargin = 1
  } else if (docLength > 10000) {
    newViewportMargin = 10
  } else if (docLength > 5000) {
    newViewportMargin = 15
  }
  if (newViewportMargin !== viewportMargin) {
    viewportMargin = newViewportMargin
    windowResize()
  }
  if (docHeightChanged) {
    checkEditorScrollbar()
    //checkEditorScrollOverLines()
    // always sync edit scrolling to view if user is editing
    if (ui.area.codemirrorScroll[0].scrollHeight > ui.area.view[0].scrollHeight && editorHasFocus()) {
      postUpdateEvent = function () {
        postUpdateEvent = null
      }
    }
  }
  lastDocHeight = editor.doc.height
})
editorInstance.on('focus', function (editor) {
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === personalInfo.id) {
      onlineUsers[i].cursor = editor.getCursor()
    }
  }
  personalInfo['cursor'] = editor.getCursor()
  socket.emit('cursor focus', editor.getCursor())
})

const cursorActivity = _.debounce(cursorActivityInner, cursorActivityDebounce)

function cursorActivityInner (editor) {
  if (editorHasFocus() && !Visibility.hidden()) {
    for (var i = 0; i < onlineUsers.length; i++) {
      if (onlineUsers[i].id === personalInfo.id) {
        onlineUsers[i].cursor = editor.getCursor()
      }
    }
    personalInfo['cursor'] = editor.getCursor()
    socket.emit('cursor activity', editor.getCursor())
  }
}

editorInstance.on('cursorActivity', editorInstance.updateStatusBar)
editorInstance.on('cursorActivity', cursorActivity)

editorInstance.on('beforeSelectionChange', editorInstance.updateStatusBar)
editorInstance.on('beforeSelectionChange', function (doc, selections) {
  // check selection and whether the statusbar has added
  if (selections && editorInstance.statusSelection) {
    const selection = selections.ranges[0]

    const anchor = selection.anchor
    const head = selection.head
    const start = head.line <= anchor.line ? head : anchor
    const end = head.line >= anchor.line ? head : anchor
    const selectionCharCount = Math.abs(head.ch - anchor.ch)

    let selectionText = ' — Selected '

    // borrow from brackets EditorStatusBar.js
    if (start.line !== end.line) {
      var lines = end.line - start.line + 1
      if (end.ch === 0) {
        lines--
      }
      selectionText += lines + ' lines'
    } else if (selectionCharCount > 0) {
      selectionText += selectionCharCount + ' columns'
    }

    if (start.line !== end.line || selectionCharCount > 0) {
      editorInstance.statusSelection.text(selectionText)
    } else {
      editorInstance.statusSelection.text('')
    }
  }
})

editorInstance.on('blur', function (cm) {
  for (var i = 0; i < onlineUsers.length; i++) {
    if (onlineUsers[i].id === personalInfo.id) {
      onlineUsers[i].cursor = null
    }
  }
  personalInfo['cursor'] = null
  socket.emit('cursor blur')
})

function saveInfo () {
  var scrollbarStyle = editor.getOption('scrollbarStyle')
  var left = $(window).scrollLeft()
  var top = $(window).scrollTop()
  switch (appState.currentMode) {
    case modeType.edit:
      if (scrollbarStyle === 'native') {
        lastInfo.edit.scroll.left = left
        lastInfo.edit.scroll.top = top
      } else {
        lastInfo.edit.scroll = editor.getScrollInfo()
      }
      break
    case modeType.view:
      lastInfo.view.scroll.left = left
      lastInfo.view.scroll.top = top
      break
    case modeType.both:
      lastInfo.edit.scroll = editor.getScrollInfo()
      lastInfo.view.scroll.left = ui.area.view.scrollLeft()
      lastInfo.view.scroll.top = ui.area.view.scrollTop()
      break
  }
  lastInfo.edit.cursor = editor.getCursor()
  lastInfo.edit.selections = editor.listSelections()
  lastInfo.needRestore = true
}

function restoreInfo () {
  var scrollbarStyle = editor.getOption('scrollbarStyle')
  if (lastInfo.needRestore) {
    var line = lastInfo.edit.cursor.line
    var ch = lastInfo.edit.cursor.ch
    editor.setCursor(line, ch)
    editor.setSelections(lastInfo.edit.selections)
    switch (appState.currentMode) {
      case modeType.edit:
        if (scrollbarStyle === 'native') {
          $(window).scrollLeft(lastInfo.edit.scroll.left)
          $(window).scrollTop(lastInfo.edit.scroll.top)
        } else {
          const left = lastInfo.edit.scroll.left
          const top = lastInfo.edit.scroll.top
          editor.scrollIntoView()
          editor.scrollTo(left, top)
        }
        break
      case modeType.view:
        $(window).scrollLeft(lastInfo.view.scroll.left)
        $(window).scrollTop(lastInfo.view.scroll.top)
        break
      case modeType.both:
        const left = lastInfo.edit.scroll.left
        const top = lastInfo.edit.scroll.top
        editor.scrollIntoView()
        editor.scrollTo(left, top)
        ui.area.view.scrollLeft(lastInfo.view.scroll.left)
        ui.area.view.scrollTop(lastInfo.view.scroll.top)
        break
    }

    lastInfo.needRestore = false
  }
}

// view actions
function refreshView () {
  //ui.area.markdown.html('')
  isDirty = true
  updateViewInner()
}

var updateView = _.debounce(function () {
  editor.operation(updateViewInner)
}, updateViewDebounce)

var lastResult = null
var postUpdateEvent = null



var initView = function(value) {
  try {
    window.lia.contentWindow.jitLia(value)
  } catch(e) {
    setTimeout( function() { initView(value) }, 500 )
  }
}

function updateViewInner () {
  if (appState.currentMode === modeType.edit || !isDirty) return
  var value = editor.getValue()
  //var lastMeta = md.meta
  //md.meta = {}
  //delete md.metaError

  try {
    window.lia.contentWindow.jitLia(value)
  } catch(e) {
    initView(value)
  }

  isDirty = false
  // buildMap();
  updateTitleReminder()
  if (postUpdateEvent && typeof postUpdateEvent === 'function') { postUpdateEvent() }
}

var updateHistoryDebounce = 600

var updateHistory = _.debounce(updateHistoryInner, updateHistoryDebounce)

function updateHistoryInner () {
  let tags = null
  try {
    tags = window.definitions.macro.tags
      .split(",")
      .map( e => e.trim())
  } catch (e) {
    tags = []
  }

  writeHistory(renderFilename(), tags, window.definitions) //renderTags(ui.area.markdown))
}

function updateDataAttrs (src, des) {
  // sync data attr startline and endline
  for (var i = 0; i < src.length; i++) {
    copyAttribute(src[i], des[i], 'data-startline')
    copyAttribute(src[i], des[i], 'data-endline')
  }
}

function partialUpdate (src, tar, des) {
  if (!src || src.length === 0 || !tar || tar.length === 0 || !des || des.length === 0) {
    ui.area.markdown.html(src)
    return
  }
  if (src.length === tar.length) { // same length
    for (let i = 0; i < src.length; i++) {
      copyAttribute(src[i], des[i], 'data-startline')
      copyAttribute(src[i], des[i], 'data-endline')
      var rawSrc = cloneAndRemoveDataAttr(src[i])
      var rawTar = cloneAndRemoveDataAttr(tar[i])
      if (rawSrc.outerHTML !== rawTar.outerHTML) {
        $(des[i]).replaceWith(src[i])
      }
    }
  } else { // diff length
    var start = 0
    // find diff start position
    for (let i = 0; i < tar.length; i++) {
      // copyAttribute(src[i], des[i], 'data-startline');
      // copyAttribute(src[i], des[i], 'data-endline');
      const rawSrc = cloneAndRemoveDataAttr(src[i])
      const rawTar = cloneAndRemoveDataAttr(tar[i])
      if (!rawSrc || !rawTar || rawSrc.outerHTML !== rawTar.outerHTML) {
        start = i
        break
      }
    }
    // find diff end position
    var srcEnd = 0
    var tarEnd = 0
    for (let i = 0; i < src.length; i++) {
      // copyAttribute(src[i], des[i], 'data-startline');
      // copyAttribute(src[i], des[i], 'data-endline');
      const rawSrc = cloneAndRemoveDataAttr(src[i])
      const rawTar = cloneAndRemoveDataAttr(tar[i])
      if (!rawSrc || !rawTar || rawSrc.outerHTML !== rawTar.outerHTML) {
        start = i
        break
      }
    }
    // tar end
    for (let i = 1; i <= tar.length + 1; i++) {
      const srcLength = src.length
      const tarLength = tar.length
      // copyAttribute(src[srcLength - i], des[srcLength - i], 'data-startline');
      // copyAttribute(src[srcLength - i], des[srcLength - i], 'data-endline');
      const rawSrc = cloneAndRemoveDataAttr(src[srcLength - i])
      const rawTar = cloneAndRemoveDataAttr(tar[tarLength - i])
      if (!rawSrc || !rawTar || rawSrc.outerHTML !== rawTar.outerHTML) {
        tarEnd = tar.length - i
        break
      }
    }
    // src end
    for (let i = 1; i <= src.length + 1; i++) {
      const srcLength = src.length
      const tarLength = tar.length
      // copyAttribute(src[srcLength - i], des[srcLength - i], 'data-startline');
      // copyAttribute(src[srcLength - i], des[srcLength - i], 'data-endline');
      const rawSrc = cloneAndRemoveDataAttr(src[srcLength - i])
      const rawTar = cloneAndRemoveDataAttr(tar[tarLength - i])
      if (!rawSrc || !rawTar || rawSrc.outerHTML !== rawTar.outerHTML) {
        srcEnd = src.length - i
        break
      }
    }
    // check if tar end overlap tar start
    var overlap = 0
    for (var i = start; i >= 0; i--) {
      var rawTarStart = cloneAndRemoveDataAttr(tar[i - 1])
      var rawTarEnd = cloneAndRemoveDataAttr(tar[tarEnd + 1 + start - i])
      if (rawTarStart && rawTarEnd && rawTarStart.outerHTML === rawTarEnd.outerHTML) { overlap++ } else { break }
    }
    if (debug) { console.log('overlap:' + overlap) }
    // show diff content
    if (debug) {
      console.log('start:' + start)
      console.log('tarEnd:' + tarEnd)
      console.log('srcEnd:' + srcEnd)
    }
    tarEnd += overlap
    srcEnd += overlap
    var repeatAdd = (start - srcEnd) < (start - tarEnd)
    var repeatDiff = Math.abs(srcEnd - tarEnd) - 1
    // push new elements
    var newElements = []
    if (srcEnd >= start) {
      for (let j = start; j <= srcEnd; j++) {
        if (!src[j]) continue
        newElements.push(src[j].outerHTML)
      }
    } else if (repeatAdd) {
      for (let j = srcEnd - repeatDiff; j <= srcEnd; j++) {
        if (!des[j]) continue
        newElements.push(des[j].outerHTML)
      }
    }
    // push remove elements
    var removeElements = []
    if (tarEnd >= start) {
      for (let j = start; j <= tarEnd; j++) {
        if (!des[j]) continue
        removeElements.push(des[j])
      }
    } else if (!repeatAdd) {
      for (let j = start; j <= start + repeatDiff; j++) {
        if (!des[j]) continue
        removeElements.push(des[j])
      }
    }
    // add elements
    if (debug) {
      console.log('ADD ELEMENTS')
      console.log(newElements.join('\n'))
    }
    if (des[start]) { $(newElements.join('')).insertBefore(des[start]) } else { $(newElements.join('')).insertAfter(des[start - 1]) }
    // remove elements
    if (debug) { console.log('REMOVE ELEMENTS') }
    for (let j = 0; j < removeElements.length; j++) {
      if (debug) {
        console.warn(removeElements[j].outerHTML)
      }
      if (removeElements[j]) { $(removeElements[j]).remove() }
    }
  }
}

function cloneAndRemoveDataAttr (el) {
  if (!el) return
  var rawEl = $(el).clone()
  rawEl.removeAttr('data-startline data-endline')
  rawEl.find('[data-startline]').removeAttr('data-startline data-endline')
  return rawEl[0]
}

function copyAttribute (src, des, attr) {
  if (src && src.getAttribute(attr) && des) { des.setAttribute(attr, src.getAttribute(attr)) }
}

if ($('.cursor-menu').length <= 0) {
  $("<div class='cursor-menu'>").insertAfter('.CodeMirror-cursors')
}

function reverseSortCursorMenu (dropdown) {
  var items = dropdown.find('.textcomplete-item')
  items.sort(function (a, b) {
    return $(b).attr('data-index') - $(a).attr('data-index')
  })
  return items
}

var checkCursorMenu = _.throttle(checkCursorMenuInner, cursorMenuThrottle)

function checkCursorMenuInner () {
  // get element
  var dropdown = $('.cursor-menu > .dropdown-menu')
  // return if not exists
  if (dropdown.length <= 0) return
  // set margin
  var menuRightMargin = 10
  var menuBottomMargin = 4
  // use sizer to get the real doc size (won't count status bar and gutters)
  var docWidth = ui.area.codemirrorSizer.width()
  // get editor size (status bar not count in)
  var editorHeight = ui.area.codemirror.height()
  // get element size
  var width = dropdown.outerWidth()
  var height = dropdown.outerHeight()
  // get cursor
  var cursor = editor.getCursor()
  // set element cursor data
  if (!dropdown.hasClass('CodeMirror-other-cursor')) { dropdown.addClass('CodeMirror-other-cursor') }
  dropdown.attr('data-line', cursor.line)
  dropdown.attr('data-ch', cursor.ch)
  // get coord position
  var coord = editor.charCoords({
    line: cursor.line,
    ch: cursor.ch
  }, 'windows')
  var left = coord.left
  var top = coord.top
  // get doc top offset (to workaround with viewport)
  var docTopOffset = ui.area.codemirrorSizerInner.position().top
  // set offset
  var offsetLeft = 0
  var offsetTop = defaultTextHeight
  // set up side down
  window.upSideDown = false
  var lastUpSideDown = window.upSideDown = false
  // only do when have width and height
  if (width > 0 && height > 0) {
    // make element right bound not larger than doc width
    if (left + width + offsetLeft + menuRightMargin > docWidth) { offsetLeft = -(left + width - docWidth + menuRightMargin) }
    // flip y when element bottom bound larger than doc height
    // and element top position is larger than element height
    if (top + docTopOffset + height + offsetTop + menuBottomMargin > Math.max(editor.doc.height, editorHeight) && top + docTopOffset > height + menuBottomMargin) {
      offsetTop = -(height + menuBottomMargin)
      // reverse sort menu because upSideDown
      dropdown.html(reverseSortCursorMenu(dropdown))
      window.upSideDown = true
    }
    var textCompleteDropdown = $(editor.getInputField()).data('textComplete').dropdown
    lastUpSideDown = textCompleteDropdown.upSideDown
    textCompleteDropdown.upSideDown = window.upSideDown
  }
  // make menu scroll top only if upSideDown changed
  if (window.upSideDown !== lastUpSideDown) { dropdown.scrollTop(dropdown[0].scrollHeight) }
  // set element offset data
  dropdown.attr('data-offset-left', offsetLeft)
  dropdown.attr('data-offset-top', offsetTop)
  // set position
  dropdown[0].style.left = left + offsetLeft + 'px'
  dropdown[0].style.top = top + offsetTop + 'px'
}

function checkInIndentCode () {
  // if line starts with tab or four spaces is a code block
  var line = editor.getLine(editor.getCursor().line)
  var isIndentCode = ((line.substr(0, 4) === '    ') || (line.substr(0, 1) === '\t'))
  return isIndentCode
}

var isInCode = false

function checkInCode () {
  isInCode = checkAbove(matchInCode) || checkInIndentCode()
}

function checkAbove (method) {
  var cursor = editor.getCursor()
  var text = []
  for (var i = 0; i < cursor.line; i++) { // contain current line
    text.push(editor.getLine(i))
  }
  text = text.join('\n') + '\n' + editor.getLine(cursor.line).slice(0, cursor.ch)
  return method(text)
}

function checkBelow (method) {
  var cursor = editor.getCursor()
  var count = editor.lineCount()
  var text = []
  for (var i = cursor.line + 1; i < count; i++) { // contain current line
    text.push(editor.getLine(i))
  }
  text = editor.getLine(cursor.line).slice(cursor.ch) + '\n' + text.join('\n')
  return method(text)
}

function matchInCode (text) {
  var match
  match = text.match(/`{3,}/g)
  if (match && match.length % 2) {
    return true
  } else {
    match = text.match(/`/g)
    if (match && match.length % 2) {
      return true
    } else {
      return false
    }
  }
}

var isInContainer = false
var isInContainerSyntax = false

function checkInContainer () {
  isInContainer = checkAbove(matchInContainer) && !checkInIndentCode()
}

function checkInContainerSyntax () {
  // if line starts with :::, it's in container syntax
  var line = editor.getLine(editor.getCursor().line)
  isInContainerSyntax = (line.substr(0, 3) === ':::')
}

function matchInContainer (text) {
  var match
  match = text.match(/:{3,}/g)
  if (match && match.length % 2) {
    return true
  } else {
    return false
  }
}

const textCompleteKeyMap = {
  Up: function () {
    return false
  },
  Right: function () {
    editor.doc.cm.execCommand('goCharRight')
  },
  Down: function () {
    return false
  },
  Left: function () {
    editor.doc.cm.execCommand('goCharLeft')
  },
  Enter: function () {
    return false
  },
  Backspace: function () {
    editor.doc.cm.execCommand('delCharBefore')
  }
}

$(editor.getInputField())
  .textcomplete([
    { // emoji strategy
      match: /(^|\n|\s)\B:([-+\w]*)$/,
      search: function (term, callback) {
        var line = editor.getLine(editor.getCursor().line)
        term = line.match(this.match)[2]
        var list = []
        $.map(window.emojify.emojiNames, function (emoji) {
          if (emoji.indexOf(term) === 0) { // match at first character
            list.push(emoji)
          }
        })
        $.map(window.emojify.emojiNames, function (emoji) {
          if (emoji.indexOf(term) !== -1) { // match inside the word
            list.push(emoji)
          }
        })
        callback(list)
      },
      template: function (value) {
        return `<img class="emoji" src="${emojifyImageDir}/${value}.png"></img> ${value}`
      },
      replace: function (value) {
        return '$1:' + value + ': '
      },
      index: 1,
      context: function (text) {
        checkInCode()
        checkInContainer()
        checkInContainerSyntax()
        return !isInCode && !isInContainerSyntax
      }
    },
    { // Code block language strategy
      langs: supportCodeModes,
      charts: supportCharts,
      match: /(^|\n)```(\w+)$/,
      search: function (term, callback) {
        var line = editor.getLine(editor.getCursor().line)
        term = line.match(this.match)[2]
        var list = []
        $.map(this.langs, function (lang) {
          if (lang.indexOf(term) === 0 && lang !== term) { list.push(lang) }
        })
        $.map(this.charts, function (chart) {
          if (chart.indexOf(term) === 0 && chart !== term) { list.push(chart) }
        })
        callback(list)
      },
      replace: function (lang) {
        var ending = ''
        if (!checkBelow(matchInCode)) {
          ending = '\n\n```'
        }
        if (this.langs.indexOf(lang) !== -1) { return '$1```' + lang + '=' + ending } else if (this.charts.indexOf(lang) !== -1) { return '$1```' + lang + ending }
      },
      done: function () {
        var cursor = editor.getCursor()
        var text = []
        text.push(editor.getLine(cursor.line - 1))
        text.push(editor.getLine(cursor.line))
        text = text.join('\n')
        if (text === '\n```') { editor.doc.cm.execCommand('goLineUp') }
      },
      context: function (text) {
        return isInCode
      }
    },
    { // Container strategy
      containers: supportContainers,
      match: /(^|\n):::(\s*)(\w*)$/,
      search: function (term, callback) {
        var line = editor.getLine(editor.getCursor().line)
        term = line.match(this.match)[3].trim()
        var list = []
        $.map(this.containers, function (container) {
          if (container.indexOf(term) === 0 && container !== term) { list.push(container) }
        })
        callback(list)
      },
      replace: function (lang) {
        var ending = ''
        if (!checkBelow(matchInContainer)) {
          ending = '\n\n:::'
        }
        if (this.containers.indexOf(lang) !== -1) { return '$1:::$2' + lang + ending }
      },
      done: function () {
        var cursor = editor.getCursor()
        var text = []
        text.push(editor.getLine(cursor.line - 1))
        text.push(editor.getLine(cursor.line))
        text = text.join('\n')
        if (text === '\n:::') { editor.doc.cm.execCommand('goLineUp') }
      },
      context: function (text) {
        return !isInCode && isInContainer
      }
    },
    { // header
      match: /(?:^|\n)(\s{0,3})(#{1,6}\w*)$/,
      search: function (term, callback) {
        callback($.map(supportHeaders, function (header) {
          return header.search.indexOf(term) === 0 ? header.text : null
        }))
      },
      replace: function (value) {
        return '$1' + value
      },
      context: function (text) {
        return !isInCode
      }
    },
    { // extra tags for list
      match: /(^[>\s]*[-+*]\s(?:\[[x ]\]|.*))(\[\])(\w*)$/,
      search: function (term, callback) {
        var list = []
        $.map(supportExtraTags, function (extratag) {
          if (extratag.search.indexOf(term) === 0) { list.push(extratag.command()) }
        })
        $.map(supportReferrals, function (referral) {
          if (referral.search.indexOf(term) === 0) { list.push(referral.text) }
        })
        callback(list)
      },
      replace: function (value) {
        return '$1' + value
      },
      context: function (text) {
        return !isInCode
      }
    },
    { // extra tags for blockquote
      match: /(?:^|\n|\s)(>.*|\s|)((\^|)\[(\^|)\](\[\]|\(\)|:|)\s*\w*)$/,
      search: function (term, callback) {
        var line = editor.getLine(editor.getCursor().line)
        var quote = line.match(this.match)[1].trim()
        var list = []
        if (quote.indexOf('>') === 0) {
          $.map(supportExtraTags, function (extratag) {
            if (extratag.search.indexOf(term) === 0) { list.push(extratag.command()) }
          })
        }
        $.map(supportReferrals, function (referral) {
          if (referral.search.indexOf(term) === 0) { list.push(referral.text) }
        })
        callback(list)
      },
      replace: function (value) {
        return '$1' + value
      },
      context: function (text) {
        return !isInCode
      }
    },
    { // referral
      match: /(^\s*|\n|\s{2})((\[\]|\[\]\[\]|\[\]\(\)|!|!\[\]|!\[\]\[\]|!\[\]\(\))\s*\w*)$/,
      search: function (term, callback) {
        callback($.map(supportReferrals, function (referral) {
          return referral.search.indexOf(term) === 0 ? referral.text : null
        }))
      },
      replace: function (value) {
        return '$1' + value
      },
      context: function (text) {
        return !isInCode
      }
    },
    { // externals
      match: /(^|\n|\s)\{\}(\w*)$/,
      search: function (term, callback) {
        callback($.map(supportExternals, function (external) {
          return external.search.indexOf(term) === 0 ? external.text : null
        }))
      },
      replace: function (value) {
        return '$1' + value
      },
      context: function (text) {
        return !isInCode
      }
    },
    { // lia snippets
      containers: liaSnippets,
      match: /(^|\n|\s)lia(.*)$/i,
      search: function(term, callback) {
        const helpStrings = []
        $.map(this.containers, function(container) {
          if(container.search.includes(term)) helpStrings.push(container)
        })
        callback(helpStrings)
      },
      template: function (value) {
        // style='width:500px; display: block; white-space: pre-wrap;'
        return '<div>' +
          value.icon + " " +
          value.search +
          '<span style="color: grey; display: block; float: right;">' + value.key + '</span>' +
          '</div>'
      },
      replace: function (value) {
        return '$1' + value.replace
      },
      context: function (text) {
        return !isInCode && !isInContainerSyntax
      }
    }
  ], {
    appendTo: $('.cursor-menu')
  })
  .on({
    'textComplete:beforeSearch': function (e) {
      // NA
    },
    'textComplete:afterSearch': function (e) {
      checkCursorMenu()
    },
    'textComplete:activate': function (e, value) {
      try {
        let dropdown = $('.cursor-menu > .dropdown-menu')
        let help = document.getElementById("lia-help")

        help.style = `display: block;
        white-space: pre-wrap;
        width: ${dropdown.width()}px;
        position: absolute;
        z-index: 2000;
        top: ${dropdown.height() + 18 + dropdown.position().top}px;
        left: ${dropdown.position().left}px;`
        help.innerHTML = value.value.helpMsg
      } catch (e) { }

    },
    'textComplete:select': function (e, value, strategy) {
      // NA
    },
    'textComplete:show': function (e) {
      $(this).data('autocompleting', true)
      editor.addKeyMap(textCompleteKeyMap)
    },
    'textComplete:hide': function (e) {
      $(this).data('autocompleting', false)
      editor.removeKeyMap(textCompleteKeyMap)
    }
  })
