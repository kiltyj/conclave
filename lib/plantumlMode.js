// Adapted from https://github.com/kkeisuke/plantuml-editor/blob/master/src/lib/codemirror/mode/plantuml/plantuml.js
import CodeMirror from 'codemirror/lib/codemirror.js'
import 'codemirror/addon/mode/simple.js'

CodeMirror.defineSimpleMode('plantuml', {
  start: [
    // Single-line comment
    {
      regex: /\s*'.*/,
      sol: true,
      token: 'comment',
    },
    // string with double quotation marks
    {
      regex: /"(?:[^\\]|\\.)*?(?:"|$)/,
      token: 'string',
    },
    {
      regex: /@end.*|@start.*/,
      token: 'keyword'
    },
    {
      regex: /\b(abstract|actor|agent|class|component|database|enum|interface|node|object|participant|partition|rectangle|state|static|storage|usecase)\b/,
      token: 'keyword',
    },
    {
      regex: /\b(true|false)\b/,
      token: 'keyword',
    },
    {
      regex: /\b(alt|opt|else|end note|end|if|endif|loop|group|par|break|critical|while|endwhile|note)\b/,
      sol: true,
      token: 'keyword',
    },
    {
      regex:
        /\b(activate|again|allow_mixing|also|as|autonumber|bottom|box|caption|center|create|deactivate|destroy|direction|down|endfooter|endheader|endlegend|entity|footbox|footer|fork|group)\b/,
      token: 'atom',
    },
    {
      regex:
        /\b(header|hide|is|left|legend|link|namespace|newpage|of|on|over|package|page|ref|repeat|return|right|rotate|scale|show|skin|skinparam|start|stop|title|then|top|up)\b/,
      token: 'atom',
    },
    {
      regex: /!define/,
      token: 'atom',
    },
    {
      regex:
        /(AliceBlue|AntiqueWhite|Aqua|Aquamarine|Azure|Beige|Bisque|Black|BlanchedAlmond|Blue|BlueViolet|Brown|BurlyWood|CadetBlue|Chartreuse|Chocolate|Coral|CornflowerBlue|Cornsilk|Crimson|Cyan|DarkBlue|DarkCyan|DarkGoldenRod|DarkGray|DarkGreen|DarkGrey|DarkKhaki|DarkMagenta|DarkOliveGreen|DarkOrchid|DarkRed|DarkSalmon|DarkSeaGreen|DarkSlateBlue|DarkSlateGray|DarkSlateGrey|DarkTurquoise|DarkViolet|Darkorange|DeepPink|DeepSkyBlue|DimGray|DimGrey|DodgerBlue|FireBrick|FloralWhite|ForestGreen|Fuchsia|Gainsboro|GhostWhite|Gold|GoldenRod|Gray|Green|GreenYellow|Grey|HoneyDew|HotPink|IndianRed|Indigo|Ivory|Khaki|Lavender|LavenderBlush|LawnGreen|LemonChiffon|LightBlue|LightCoral|LightCyan|LightGoldenRodYellow|LightGray|LightGreen|LightGrey|LightPink|LightSalmon|LightSeaGreen|LightSkyBlue|LightSlateGray|LightSlateGrey|LightSteelBlue|LightYellow|Lime|LimeGreen|Linen|Magenta|Maroon|MediumAquaMarine|MediumBlue|MediumOrchid|MediumPurple|MediumSeaGreen|MediumSlateBlue|MediumSpringGreen|MediumTurquoise|MediumVioletRed|MidnightBlue|MintCream|MistyRose|Moccasin|NavajoWhite|Navy|OldLace|Olive|OliveDrab|Orange|OrangeRed|Orchid|PaleGoldenRod|PaleGreen|PaleTurquoise|PaleVioletRed|PapayaWhip|PeachPuff|Peru|Pink|Plum|PowderBlue|Purple|Red|RosyBrown|RoyalBlue|SaddleBrown|Salmon|SandyBrown|SeaGreen|SeaShell|Sienna|Silver|SkyBlue|SlateBlue|SlateGray|SlateGrey|Snow|SpringGreen|SteelBlue|Tan|Teal|Thistle|Tomato|Turquoise|Violet|Wheat|White|WhiteSmoke|Yellow|YellowGreen)/,
      token: 'variable-3',
    },
    // word
    {
      regex: /[a-zA-Z$][\w$]*/,
      token: 'variable',
    },
    // -->
    // TODO For compatibility with old activity diagrams, \s is not added at the beginning.
    {
      regex: /-+(up|right|down|left)*-*[|]?[>*o]*\s/,
      token: 'operator',
    },
    //  ..>
    {
      regex: /\s\.+(up|right|down|left)*\.*[|]?[>*o]*\s/,
      token: 'operator',
    },
    //  <--
    {
      regex: /\s[<*o]*[|]?-+(up|right|down|left)*-*\s/,
      token: 'operator',
    },
    // <..
    {
      regex: /\s[<*o]*[|]?\.+(up|right|down|left)*\.*\s/,
      token: 'operator',
    },
    // symbol
    {
      regex: /(<<|>>|:|;|\\n)/,
      token: 'variable-2',
    },
    // Public method
    {
      regex: /\+[^(]+\(\)/,
      token: 'variable-2',
    },
    // Private method
    {
      regex: /-[^(]+\(\)/,
      token: 'variable-2',
    },
    // Protected method
    {
      regex: /#[^(]+\(\)/,
      token: 'variable-2',
    },
    // Activity beta title
    // TODO overlaps with Entity-Relationship diagram
    // {
    //   regex: /\|[^|#]+\|/,
    //   token: 'variable-2'
    // },
    // align the indentation inside {}
    {
      regex: /[{[(]/,
      indent: true,
    },
    {
      regex: /[}\])]/,
      dedent: true,
    },
    // multi-line comment
    {
      regex: /\/'/,
      token: 'comment',
      next: 'comment',
    },
  ],
  // multi-line comment
  comment: [
    {
      regex: /.*?'\//,
      token: 'comment',
      next: 'start',
    },
    {
      regex: /.*/,
      token: 'comment',
    },
  ],
  meta: {
    fold: 'indent',
  },
})