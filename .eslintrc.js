module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
	],
	env: {
		es2020: true,
		node: true
	},
	rules: {
		'no-unused-vars': 2,
		'@typescript-eslint/no-unused-vars': 2,
		'@typescript-eslint/no-var-requires': 2,
	}
};
