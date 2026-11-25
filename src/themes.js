// Colour themes ported from pulsr. A gradient is three stops that colour a line by height.

export const THEMES = [
  {
    name: 'greyscale',
    background: '#000000',
    text: '#bbbbbb',
    gradients: [
      { name: 'grey-white', stops: ['#808080', '#bbbbbb', '#ffffff'] },
      { name: 'white', stops: ['#ffffff', '#ffffff', '#ffffff'] },
      { name: 'white-grey', stops: ['#ffffff', '#bbbbbb', '#777777'] },
      { name: 'silver', stops: ['#999999', '#aaaaaa', '#cccccc'] },
      { name: 'text', stops: ['#bbbbbb', '#bbbbbb', '#bbbbbb'] },
    ],
  },
  {
    name: 'catppuccin-macchiato',
    background: '#24273a',
    text: '#cad3f5',
    gradients: [
      { name: 'blue-pink', stops: ['#8aadf4', '#c6a0f6', '#f5bde6'] },
      { name: 'green-sapphire', stops: ['#a6da95', '#8bd5ca', '#7dc4e4'] },
      { name: 'yellow-red', stops: ['#eed49f', '#f5a97f', '#ed8796'] },
      { name: 'mauve-peach', stops: ['#c6a0f6', '#f5bde6', '#f5a97f'] },
      { name: 'text', stops: ['#cad3f5', '#cad3f5', '#cad3f5'] },
    ],
  },
  {
    name: 'catppuccin-mocha',
    background: '#1e1e2e',
    text: '#cdd6f4',
    gradients: [
      { name: 'blue-pink', stops: ['#89b4fa', '#cba6f7', '#f5c2e7'] },
      { name: 'green-sapphire', stops: ['#a6e3a1', '#94e2d5', '#74c7ec'] },
      { name: 'yellow-red', stops: ['#f9e2af', '#fab387', '#f38ba8'] },
      { name: 'mauve-peach', stops: ['#cba6f7', '#f5c2e7', '#fab387'] },
      { name: 'text', stops: ['#cdd6f4', '#cdd6f4', '#cdd6f4'] },
    ],
  },
  {
    name: 'catppuccin-frappe',
    background: '#303446',
    text: '#c6d0f5',
    gradients: [
      { name: 'blue-pink', stops: ['#8caaee', '#ca9ee6', '#f4b8e4'] },
      { name: 'green-sapphire', stops: ['#a6d189', '#81c8be', '#85c1dc'] },
      { name: 'yellow-red', stops: ['#e5c890', '#ef9f76', '#e78284'] },
      { name: 'mauve-peach', stops: ['#ca9ee6', '#f4b8e4', '#ef9f76'] },
      { name: 'text', stops: ['#c6d0f5', '#c6d0f5', '#c6d0f5'] },
    ],
  },
  {
    name: 'catppuccin-latte',
    background: '#eff1f5',
    text: '#4c4f69',
    gradients: [
      { name: 'blue-pink', stops: ['#1e66f5', '#8839ef', '#ea76cb'] },
      { name: 'green-sapphire', stops: ['#40a02b', '#179299', '#209fb5'] },
      { name: 'yellow-red', stops: ['#df8e1d', '#fe640b', '#d20f39'] },
      { name: 'mauve-peach', stops: ['#8839ef', '#ea76cb', '#fe640b'] },
      { name: 'text', stops: ['#4c4f69', '#4c4f69', '#4c4f69'] },
    ],
  },
  {
    name: 'dracula',
    background: '#282a36',
    text: '#f8f8f2',
    gradients: [
      { name: 'purple-green', stops: ['#bd93f9', '#8be9fd', '#50fa7b'] },
      { name: 'purple-orange', stops: ['#bd93f9', '#ff79c6', '#ffb86c'] },
      { name: 'cyan-pink', stops: ['#8be9fd', '#bd93f9', '#ff79c6'] },
      { name: 'yellow-red', stops: ['#f1fa8c', '#ffb86c', '#ff5555'] },
      { name: 'text', stops: ['#f8f8f2', '#f8f8f2', '#f8f8f2'] },
    ],
  },
  {
    name: 'nord',
    background: '#2e3440',
    text: '#d8dee9',
    gradients: [
      { name: 'frost', stops: ['#5e81ac', '#81a1c1', '#88c0d0'] },
      { name: 'aurora', stops: ['#a3be8c', '#ebcb8b', '#bf616a'] },
      { name: 'frost-aurora', stops: ['#81a1c1', '#b48ead', '#bf616a'] },
      { name: 'ice-sun', stops: ['#88c0d0', '#a3be8c', '#ebcb8b'] },
      { name: 'text', stops: ['#d8dee9', '#d8dee9', '#d8dee9'] },
    ],
  },
  {
    name: 'nordic',
    background: '#242933',
    text: '#bbc3d4',
    gradients: [
      { name: 'frost', stops: ['#5e81ac', '#81a1c1', '#88c0d0'] },
      { name: 'aurora', stops: ['#b1c89d', '#efd49f', '#c5727a'] },
      { name: 'frost-aurora', stops: ['#81a1c1', '#be9db8', '#c5727a'] },
      { name: 'ice-sun', stops: ['#9fc6c5', '#b1c89d', '#efd49f'] },
      { name: 'text', stops: ['#bbc3d4', '#bbc3d4', '#bbc3d4'] },
    ],
  },
  {
    name: 'gruvbox',
    background: '#282828',
    text: '#ebdbb2',
    gradients: [
      { name: 'green-red', stops: ['#b8bb26', '#fabd2f', '#fb4934'] },
      { name: 'blue-yellow', stops: ['#83a598', '#8ec07c', '#fabd2f'] },
      { name: 'blue-red', stops: ['#83a598', '#d3869b', '#fb4934'] },
      { name: 'yellow-red', stops: ['#fabd2f', '#fe8019', '#fb4934'] },
      { name: 'text', stops: ['#ebdbb2', '#ebdbb2', '#ebdbb2'] },
    ],
  },
  {
    name: 'gruvbox-hard',
    background: '#1d2021',
    text: '#ebdbb2',
    gradients: [
      { name: 'green-red', stops: ['#b8bb26', '#fabd2f', '#fb4934'] },
      { name: 'blue-yellow', stops: ['#83a598', '#8ec07c', '#fabd2f'] },
      { name: 'blue-red', stops: ['#83a598', '#d3869b', '#fb4934'] },
      { name: 'yellow-red', stops: ['#fabd2f', '#fe8019', '#fb4934'] },
      { name: 'text', stops: ['#ebdbb2', '#ebdbb2', '#ebdbb2'] },
    ],
  },
  {
    name: 'solarized-dark',
    background: '#002b36',
    text: '#839496',
    gradients: [
      { name: 'cyan-yellow', stops: ['#2aa198', '#859900', '#b58900'] },
      { name: 'blue-magenta', stops: ['#268bd2', '#6c71c4', '#d33682'] },
      { name: 'yellow-red', stops: ['#b58900', '#cb4b16', '#dc322f'] },
      { name: 'blue-green', stops: ['#268bd2', '#2aa198', '#859900'] },
      { name: 'text', stops: ['#839496', '#839496', '#839496'] },
    ],
  },
  {
    name: 'solarized-light',
    background: '#fdf6e3',
    text: '#657b83',
    gradients: [
      { name: 'cyan-yellow', stops: ['#2aa198', '#859900', '#b58900'] },
      { name: 'blue-magenta', stops: ['#268bd2', '#6c71c4', '#d33682'] },
      { name: 'yellow-red', stops: ['#b58900', '#cb4b16', '#dc322f'] },
      { name: 'blue-green', stops: ['#268bd2', '#2aa198', '#859900'] },
      { name: 'text', stops: ['#657b83', '#657b83', '#657b83'] },
    ],
  },
  {
    name: 'tokyo-night',
    background: '#1a1b26',
    text: '#a9b1d6',
    gradients: [
      { name: 'blue-red', stops: ['#7aa2f7', '#bb9af7', '#f7768e'] },
      { name: 'teal-blue', stops: ['#73daca', '#7dcfff', '#7aa2f7'] },
      { name: 'green-orange', stops: ['#9ece6a', '#e0af68', '#ff9e64'] },
      { name: 'magenta-orange', stops: ['#bb9af7', '#f7768e', '#ff9e64'] },
      { name: 'text', stops: ['#a9b1d6', '#a9b1d6', '#a9b1d6'] },
    ],
  },
  {
    name: 'tokyo-storm',
    background: '#24283b',
    text: '#a9b1d6',
    gradients: [
      { name: 'blue-red', stops: ['#7aa2f7', '#bb9af7', '#f7768e'] },
      { name: 'teal-blue', stops: ['#73daca', '#7dcfff', '#7aa2f7'] },
      { name: 'green-orange', stops: ['#9ece6a', '#e0af68', '#ff9e64'] },
      { name: 'magenta-orange', stops: ['#bb9af7', '#f7768e', '#ff9e64'] },
      { name: 'text', stops: ['#a9b1d6', '#a9b1d6', '#a9b1d6'] },
    ],
  },
  {
    name: 'gotham',
    background: '#0c1014',
    text: '#99d1ce',
    gradients: [
      { name: 'cyan-white', stops: ['#33859e', '#599cab', '#d3ebe9'] },
      { name: 'green-orange', stops: ['#2aa889', '#edb443', '#d26937'] },
      { name: 'cyan-red', stops: ['#33859e', '#edb443', '#c23127'] },
      { name: 'blue-green', stops: ['#599cab', '#2aa889', '#edb443'] },
      { name: 'text', stops: ['#99d1ce', '#99d1ce', '#99d1ce'] },
    ],
  },
  {
    name: 'rose-pine',
    background: '#191724',
    text: '#e0def4',
    gradients: [
      { name: 'foam-iris', stops: ['#9ccfd8', '#c4a7e7', '#ebbcba'] },
      { name: 'pine-gold', stops: ['#31748f', '#9ccfd8', '#f6c177'] },
      { name: 'iris-love', stops: ['#c4a7e7', '#ebbcba', '#eb6f92'] },
      { name: 'gold-love', stops: ['#f6c177', '#ebbcba', '#eb6f92'] },
      { name: 'text', stops: ['#e0def4', '#e0def4', '#e0def4'] },
    ],
  },
  {
    name: 'rose-pine-moon',
    background: '#232136',
    text: '#e0def4',
    gradients: [
      { name: 'foam-iris', stops: ['#9ccfd8', '#c4a7e7', '#ea9a97'] },
      { name: 'pine-gold', stops: ['#3e8fb0', '#9ccfd8', '#f6c177'] },
      { name: 'iris-love', stops: ['#c4a7e7', '#ea9a97', '#eb6f92'] },
      { name: 'gold-love', stops: ['#f6c177', '#ea9a97', '#eb6f92'] },
      { name: 'text', stops: ['#e0def4', '#e0def4', '#e0def4'] },
    ],
  },
  {
    name: 'rose-pine-dawn',
    background: '#faf4ed',
    text: '#464261',
    gradients: [
      { name: 'foam-iris', stops: ['#56949f', '#907aa9', '#d7827e'] },
      { name: 'pine-gold', stops: ['#286983', '#56949f', '#ea9d34'] },
      { name: 'iris-love', stops: ['#907aa9', '#d7827e', '#b4637a'] },
      { name: 'gold-love', stops: ['#ea9d34', '#d7827e', '#b4637a'] },
      { name: 'text', stops: ['#464261', '#464261', '#464261'] },
    ],
  },
  {
    name: 'everforest',
    background: '#2d353b',
    text: '#d3c6aa',
    gradients: [
      { name: 'green-red', stops: ['#a7c080', '#dbbc7f', '#e67e80'] },
      { name: 'aqua-yellow', stops: ['#83c092', '#a7c080', '#dbbc7f'] },
      { name: 'blue-purple', stops: ['#7fbbb3', '#d699b6', '#e67e80'] },
      { name: 'yellow-red', stops: ['#dbbc7f', '#e69875', '#e67e80'] },
      { name: 'text', stops: ['#d3c6aa', '#d3c6aa', '#d3c6aa'] },
    ],
  },
  {
    name: 'kanagawa',
    background: '#1f1f28',
    text: '#dcd7ba',
    gradients: [
      { name: 'blue-yellow', stops: ['#7e9cd8', '#98bb6c', '#e6c384'] },
      { name: 'violet-pink', stops: ['#957fb8', '#d27e99', '#ffa066'] },
      { name: 'aqua-red', stops: ['#7aa89f', '#e6c384', '#e46876'] },
      { name: 'yellow-red', stops: ['#e6c384', '#ffa066', '#ff5d62'] },
      { name: 'text', stops: ['#dcd7ba', '#dcd7ba', '#dcd7ba'] },
    ],
  },
  {
    name: 'kanagawa-dragon',
    background: '#181616',
    text: '#c5c9c5',
    gradients: [
      { name: 'blue-yellow', stops: ['#8ba4b0', '#87a987', '#c4b28a'] },
      { name: 'violet-pink', stops: ['#8992a7', '#a292a3', '#b6927b'] },
      { name: 'aqua-red', stops: ['#8ea4a2', '#c4b28a', '#c4746e'] },
      { name: 'yellow-red', stops: ['#c4b28a', '#b6927b', '#c4746e'] },
      { name: 'text', stops: ['#c5c9c5', '#c5c9c5', '#c5c9c5'] },
    ],
  },
  {
    name: 'one-dark',
    background: '#282c34',
    text: '#abb2bf',
    gradients: [
      { name: 'blue-purple', stops: ['#61afef', '#c678dd', '#e06c75'] },
      { name: 'cyan-green', stops: ['#56b6c2', '#98c379', '#e5c07b'] },
      { name: 'green-red', stops: ['#98c379', '#e5c07b', '#e06c75'] },
      { name: 'blue-yellow', stops: ['#61afef', '#56b6c2', '#e5c07b'] },
      { name: 'text', stops: ['#abb2bf', '#abb2bf', '#abb2bf'] },
    ],
  },
  {
    name: 'ayu',
    background: '#10141c',
    text: '#bfbdb6',
    gradients: [
      { name: 'blue-purple', stops: ['#39bae6', '#59c2ff', '#d2a6ff'] },
      { name: 'green-orange', stops: ['#aad94c', '#ffb454', '#ff8f40'] },
      { name: 'teal-yellow', stops: ['#95e6cb', '#aad94c', '#ffb454'] },
      { name: 'yellow-red', stops: ['#ffb454', '#ff8f40', '#f07178'] },
      { name: 'text', stops: ['#bfbdb6', '#bfbdb6', '#bfbdb6'] },
    ],
  },
  {
    name: 'ayu-mirage',
    background: '#242936',
    text: '#cccac2',
    gradients: [
      { name: 'blue-purple', stops: ['#5ccfe6', '#73d0ff', '#dfbfff'] },
      { name: 'green-orange', stops: ['#d5ff80', '#ffcd66', '#ffa659'] },
      { name: 'teal-yellow', stops: ['#95e6cb', '#d5ff80', '#ffcd66'] },
      { name: 'yellow-red', stops: ['#ffcd66', '#ffa659', '#f28779'] },
      { name: 'text', stops: ['#cccac2', '#cccac2', '#cccac2'] },
    ],
  },
];

export function findTheme(name) {
  return THEMES.find((t) => t.name === name) ?? THEMES.find((t) => t.name === 'tokyo-night');
}

export function findGradient(theme, name) {
  return theme.gradients.find((g) => g.name === name) ?? theme.gradients[0];
}
