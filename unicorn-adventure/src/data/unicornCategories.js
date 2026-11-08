export const UNICORN_CATEGORIES = Object.freeze([
  {
    id: 'original',
    label: 'Hvide',
    matches: (item) => !['unicorn-rainbow-', 'unicorn-dark-', 'unicorn-volcano-']
      .some((prefix) => item.texture.startsWith(prefix)),
  },
  { id: 'rainbow', label: 'Regnbue', matches: (item) => item.texture.startsWith('unicorn-rainbow-') },
  { id: 'dark', label: 'Mørke', matches: (item) => item.texture.startsWith('unicorn-dark-') },
  { id: 'volcano', label: 'Vulkan', matches: (item) => item.texture.startsWith('unicorn-volcano-') },
]);
