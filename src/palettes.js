// Colour palettes, ported from pulsr's themes. A palette is a family of colour schemes, and
// each of its entries is one choice of colours: a background, a text colour and a gradient
// of three stops that colours a line by height. Entries from a variant of the scheme carry
// its name ("latte blue-pink"). Each scheme has a plain entry: `white` on a dark
// background, `black` on a light one. A palette's first entry is the one it starts with, and
// the first palette is the page's.

export const PALETTES = [
  {
    name: 'greyscale',
    gradients: [
      { name: 'white', background: '#000000', text: '#bbbbbb', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'grey-white', background: '#000000', text: '#bbbbbb', stops: ['#808080', '#bbbbbb', '#ffffff'] },
      { name: 'white-grey', background: '#000000', text: '#bbbbbb', stops: ['#ffffff', '#bbbbbb', '#777777'] },
      { name: 'silver', background: '#000000', text: '#bbbbbb', stops: ['#999999', '#aaaaaa', '#cccccc'] },
    ],
  },
  {
    name: 'catppuccin',
    gradients: [
      { name: 'mocha blue-pink', background: '#1e1e2e', text: '#cdd6f4', stops: ['#89b4fa', '#cba6f7', '#f5c2e7'] },
      { name: 'mocha green-sapphire', background: '#1e1e2e', text: '#cdd6f4', stops: ['#a6e3a1', '#94e2d5', '#74c7ec'] },
      { name: 'mocha yellow-red', background: '#1e1e2e', text: '#cdd6f4', stops: ['#f9e2af', '#fab387', '#f38ba8'] },
      { name: 'mocha mauve-peach', background: '#1e1e2e', text: '#cdd6f4', stops: ['#cba6f7', '#f5c2e7', '#fab387'] },
      { name: 'mocha white', background: '#1e1e2e', text: '#cdd6f4', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'latte blue-pink', background: '#eff1f5', text: '#4c4f69', stops: ['#1e66f5', '#8839ef', '#ea76cb'] },
      { name: 'latte green-sapphire', background: '#eff1f5', text: '#4c4f69', stops: ['#40a02b', '#179299', '#209fb5'] },
      { name: 'latte yellow-red', background: '#eff1f5', text: '#4c4f69', stops: ['#df8e1d', '#fe640b', '#d20f39'] },
      { name: 'latte mauve-peach', background: '#eff1f5', text: '#4c4f69', stops: ['#8839ef', '#ea76cb', '#fe640b'] },
      { name: 'latte black', background: '#eff1f5', text: '#4c4f69', stops: ['#000000', '#000000', '#000000'] },
    ],
  },
  {
    name: 'dracula',
    gradients: [
      { name: 'purple-green', background: '#282a36', text: '#f8f8f2', stops: ['#bd93f9', '#8be9fd', '#50fa7b'] },
      { name: 'purple-orange', background: '#282a36', text: '#f8f8f2', stops: ['#bd93f9', '#ff79c6', '#ffb86c'] },
      { name: 'cyan-pink', background: '#282a36', text: '#f8f8f2', stops: ['#8be9fd', '#bd93f9', '#ff79c6'] },
      { name: 'yellow-red', background: '#282a36', text: '#f8f8f2', stops: ['#f1fa8c', '#ffb86c', '#ff5555'] },
      { name: 'white', background: '#282a36', text: '#f8f8f2', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'nord',
    gradients: [
      { name: 'frost', background: '#2e3440', text: '#d8dee9', stops: ['#5e81ac', '#81a1c1', '#88c0d0'] },
      { name: 'aurora', background: '#2e3440', text: '#d8dee9', stops: ['#a3be8c', '#ebcb8b', '#bf616a'] },
      { name: 'frost-aurora', background: '#2e3440', text: '#d8dee9', stops: ['#81a1c1', '#b48ead', '#bf616a'] },
      { name: 'ice-sun', background: '#2e3440', text: '#d8dee9', stops: ['#88c0d0', '#a3be8c', '#ebcb8b'] },
      { name: 'white', background: '#2e3440', text: '#d8dee9', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'nordic aurora', background: '#242933', text: '#bbc3d4', stops: ['#b1c89d', '#efd49f', '#c5727a'] },
      { name: 'nordic frost-aurora', background: '#242933', text: '#bbc3d4', stops: ['#81a1c1', '#be9db8', '#c5727a'] },
      { name: 'nordic ice-sun', background: '#242933', text: '#bbc3d4', stops: ['#9fc6c5', '#b1c89d', '#efd49f'] },
    ],
  },
  {
    name: 'gruvbox',
    gradients: [
      { name: 'green-red', background: '#282828', text: '#ebdbb2', stops: ['#b8bb26', '#fabd2f', '#fb4934'] },
      { name: 'blue-yellow', background: '#282828', text: '#ebdbb2', stops: ['#83a598', '#8ec07c', '#fabd2f'] },
      { name: 'blue-red', background: '#282828', text: '#ebdbb2', stops: ['#83a598', '#d3869b', '#fb4934'] },
      { name: 'yellow-red', background: '#282828', text: '#ebdbb2', stops: ['#fabd2f', '#fe8019', '#fb4934'] },
      { name: 'white', background: '#282828', text: '#ebdbb2', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'solarized',
    gradients: [
      { name: 'dark cyan-yellow', background: '#002b36', text: '#839496', stops: ['#2aa198', '#859900', '#b58900'] },
      { name: 'dark blue-magenta', background: '#002b36', text: '#839496', stops: ['#268bd2', '#6c71c4', '#d33682'] },
      { name: 'dark yellow-red', background: '#002b36', text: '#839496', stops: ['#b58900', '#cb4b16', '#dc322f'] },
      { name: 'dark blue-green', background: '#002b36', text: '#839496', stops: ['#268bd2', '#2aa198', '#859900'] },
      { name: 'dark white', background: '#002b36', text: '#839496', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'light cyan-yellow', background: '#fdf6e3', text: '#657b83', stops: ['#2aa198', '#859900', '#b58900'] },
      { name: 'light blue-magenta', background: '#fdf6e3', text: '#657b83', stops: ['#268bd2', '#6c71c4', '#d33682'] },
      { name: 'light yellow-red', background: '#fdf6e3', text: '#657b83', stops: ['#b58900', '#cb4b16', '#dc322f'] },
      { name: 'light blue-green', background: '#fdf6e3', text: '#657b83', stops: ['#268bd2', '#2aa198', '#859900'] },
      { name: 'light black', background: '#fdf6e3', text: '#657b83', stops: ['#000000', '#000000', '#000000'] },
    ],
  },
  {
    name: 'tokyo-night',
    gradients: [
      { name: 'blue-red', background: '#1a1b26', text: '#a9b1d6', stops: ['#7aa2f7', '#bb9af7', '#f7768e'] },
      { name: 'teal-blue', background: '#1a1b26', text: '#a9b1d6', stops: ['#73daca', '#7dcfff', '#7aa2f7'] },
      { name: 'green-orange', background: '#1a1b26', text: '#a9b1d6', stops: ['#9ece6a', '#e0af68', '#ff9e64'] },
      { name: 'magenta-orange', background: '#1a1b26', text: '#a9b1d6', stops: ['#bb9af7', '#f7768e', '#ff9e64'] },
      { name: 'white', background: '#1a1b26', text: '#a9b1d6', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'gotham',
    gradients: [
      { name: 'cyan-white', background: '#0c1014', text: '#99d1ce', stops: ['#33859e', '#599cab', '#d3ebe9'] },
      { name: 'green-orange', background: '#0c1014', text: '#99d1ce', stops: ['#2aa889', '#edb443', '#d26937'] },
      { name: 'cyan-red', background: '#0c1014', text: '#99d1ce', stops: ['#33859e', '#edb443', '#c23127'] },
      { name: 'blue-green', background: '#0c1014', text: '#99d1ce', stops: ['#599cab', '#2aa889', '#edb443'] },
      { name: 'white', background: '#0c1014', text: '#99d1ce', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'rose-pine',
    gradients: [
      { name: 'foam-iris', background: '#191724', text: '#e0def4', stops: ['#9ccfd8', '#c4a7e7', '#ebbcba'] },
      { name: 'pine-gold', background: '#191724', text: '#e0def4', stops: ['#31748f', '#9ccfd8', '#f6c177'] },
      { name: 'iris-love', background: '#191724', text: '#e0def4', stops: ['#c4a7e7', '#ebbcba', '#eb6f92'] },
      { name: 'gold-love', background: '#191724', text: '#e0def4', stops: ['#f6c177', '#ebbcba', '#eb6f92'] },
      { name: 'white', background: '#191724', text: '#e0def4', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'moon foam-iris', background: '#232136', text: '#e0def4', stops: ['#9ccfd8', '#c4a7e7', '#ea9a97'] },
      { name: 'moon pine-gold', background: '#232136', text: '#e0def4', stops: ['#3e8fb0', '#9ccfd8', '#f6c177'] },
      { name: 'moon iris-love', background: '#232136', text: '#e0def4', stops: ['#c4a7e7', '#ea9a97', '#eb6f92'] },
      { name: 'moon gold-love', background: '#232136', text: '#e0def4', stops: ['#f6c177', '#ea9a97', '#eb6f92'] },
      { name: 'dawn foam-iris', background: '#faf4ed', text: '#464261', stops: ['#56949f', '#907aa9', '#d7827e'] },
      { name: 'dawn pine-gold', background: '#faf4ed', text: '#464261', stops: ['#286983', '#56949f', '#ea9d34'] },
      { name: 'dawn iris-love', background: '#faf4ed', text: '#464261', stops: ['#907aa9', '#d7827e', '#b4637a'] },
      { name: 'dawn gold-love', background: '#faf4ed', text: '#464261', stops: ['#ea9d34', '#d7827e', '#b4637a'] },
      { name: 'dawn black', background: '#faf4ed', text: '#464261', stops: ['#000000', '#000000', '#000000'] },
    ],
  },
  {
    name: 'everforest',
    gradients: [
      { name: 'green-red', background: '#2d353b', text: '#d3c6aa', stops: ['#a7c080', '#dbbc7f', '#e67e80'] },
      { name: 'aqua-yellow', background: '#2d353b', text: '#d3c6aa', stops: ['#83c092', '#a7c080', '#dbbc7f'] },
      { name: 'blue-purple', background: '#2d353b', text: '#d3c6aa', stops: ['#7fbbb3', '#d699b6', '#e67e80'] },
      { name: 'yellow-red', background: '#2d353b', text: '#d3c6aa', stops: ['#dbbc7f', '#e69875', '#e67e80'] },
      { name: 'white', background: '#2d353b', text: '#d3c6aa', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'kanagawa',
    gradients: [
      { name: 'blue-yellow', background: '#1f1f28', text: '#dcd7ba', stops: ['#7e9cd8', '#98bb6c', '#e6c384'] },
      { name: 'violet-pink', background: '#1f1f28', text: '#dcd7ba', stops: ['#957fb8', '#d27e99', '#ffa066'] },
      { name: 'aqua-red', background: '#1f1f28', text: '#dcd7ba', stops: ['#7aa89f', '#e6c384', '#e46876'] },
      { name: 'yellow-red', background: '#1f1f28', text: '#dcd7ba', stops: ['#e6c384', '#ffa066', '#ff5d62'] },
      { name: 'white', background: '#1f1f28', text: '#dcd7ba', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'dragon blue-yellow', background: '#181616', text: '#c5c9c5', stops: ['#8ba4b0', '#87a987', '#c4b28a'] },
      { name: 'dragon violet-pink', background: '#181616', text: '#c5c9c5', stops: ['#8992a7', '#a292a3', '#b6927b'] },
      { name: 'dragon aqua-red', background: '#181616', text: '#c5c9c5', stops: ['#8ea4a2', '#c4b28a', '#c4746e'] },
      { name: 'dragon yellow-red', background: '#181616', text: '#c5c9c5', stops: ['#c4b28a', '#b6927b', '#c4746e'] },
    ],
  },
  {
    name: 'one-dark',
    gradients: [
      { name: 'blue-purple', background: '#282c34', text: '#abb2bf', stops: ['#61afef', '#c678dd', '#e06c75'] },
      { name: 'cyan-green', background: '#282c34', text: '#abb2bf', stops: ['#56b6c2', '#98c379', '#e5c07b'] },
      { name: 'green-red', background: '#282c34', text: '#abb2bf', stops: ['#98c379', '#e5c07b', '#e06c75'] },
      { name: 'blue-yellow', background: '#282c34', text: '#abb2bf', stops: ['#61afef', '#56b6c2', '#e5c07b'] },
      { name: 'white', background: '#282c34', text: '#abb2bf', stops: ['#ffffff', '#ffffff', '#ffffff'] },
    ],
  },
  {
    name: 'ayu',
    gradients: [
      { name: 'blue-purple', background: '#10141c', text: '#bfbdb6', stops: ['#39bae6', '#59c2ff', '#d2a6ff'] },
      { name: 'green-orange', background: '#10141c', text: '#bfbdb6', stops: ['#aad94c', '#ffb454', '#ff8f40'] },
      { name: 'teal-yellow', background: '#10141c', text: '#bfbdb6', stops: ['#95e6cb', '#aad94c', '#ffb454'] },
      { name: 'yellow-red', background: '#10141c', text: '#bfbdb6', stops: ['#ffb454', '#ff8f40', '#f07178'] },
      { name: 'white', background: '#10141c', text: '#bfbdb6', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'mirage blue-purple', background: '#242936', text: '#cccac2', stops: ['#5ccfe6', '#73d0ff', '#dfbfff'] },
      { name: 'mirage green-orange', background: '#242936', text: '#cccac2', stops: ['#d5ff80', '#ffcd66', '#ffa659'] },
      { name: 'mirage teal-yellow', background: '#242936', text: '#cccac2', stops: ['#95e6cb', '#d5ff80', '#ffcd66'] },
      { name: 'mirage yellow-red', background: '#242936', text: '#cccac2', stops: ['#ffcd66', '#ffa659', '#f28779'] },
    ],
  },
];

export function findPalette(name) {
  return PALETTES.find((p) => p.name === name) ?? PALETTES.find((p) => p.name === 'tokyo-night');
}

export function findGradient(palette, name) {
  return palette.gradients.find((g) => g.name === name) ?? palette.gradients[0];
}
