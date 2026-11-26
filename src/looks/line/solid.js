// A plain line in the tint's colour, over a curtain that hides the rows behind.
export default {
  name: 'solid',
  build: (c) => ({ colour: c.faded(c.tint) }),
};
