import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import path from "path";

const production = !process.env.ROLLUP_WATCH;

export default {
    input: "webviews/pages/sidebar.ts",
    output: {
        sourcemap: true,
        format: "iife",
        name: "app",
        file: "out/compiled/sidebar.js",

    },
    plugins: [

        svelte({
            // enable run-time checks when not in production
            dev: !production,
            preprocess: sveltePreprocess(),
        }),


        // If you have external dependencies installed from
        // npm, you'll most likely need these plugins. In
        // some cases you'll need additional configuration -
        // consult the documentation for details:
        // https://github.com/rollup/plugins/tree/master/packages/commonjs
        resolve({
            browser: true,
            dedupe: ["svelte"],
        }),
        commonjs(),
        typescript({
            tsconfig: "webviews/tsconfig.json",
            sourceMap: !production,
            inlineSources: !production,
        }),

        postcss({
            extract: true,
            extract: path.resolve("out/compiled/sidebar.css"),
            plugins: []
        }),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        // !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        // !production && livereload("public"),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser(),

    ],
    watch: {
        clearScreen: false,
    },
};