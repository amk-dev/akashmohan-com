/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				gruvbox: {
					bg0: '#282828',
					bg1: '#1d2021',
					bg2: '#3c3836',
					bg3: '#504945',
					fg0: '#ebdbb2',
					fg1: '#d5c4a1',
					fg2: '#928374',
					yellow: '#fabd2f',
					orange: '#fe8019',
					red: '#fb4934',
					green: '#b8bb26',
					gold: '#d79921',
					purple: '#d3869b',
				},
			},
			fontFamily: {
				mono: ['Menlo', 'Monaco', 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', 'monospace'],
			},
		},
	},
	plugins: [require('@tailwindcss/typography')],
}
