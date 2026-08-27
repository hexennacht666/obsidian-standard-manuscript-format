import { readFile } from "fs/promises";

// JSZip — which this plugin uses directly, and which `docx` bundles its own copy
// of — ships two scheduling polyfills written for browsers that predate anything
// Obsidian runs on. Neither can execute here. `immediate` reaches its <script>
// branch only where MutationObserver, setImmediate and MessageChannel are all
// absent, and `setimmediate` reaches its `new Function` line only when handed a
// string instead of a function, which JSZip never does.
//
// Dead or not, both ship inside main.js, where anything reading the file sees an
// injected <script> element and a `new Function` call with no way to tell they
// are unreachable. The community directory's automated review reads them exactly
// that way, and it is right to: a bundle that handles unpublished fiction has no
// business carrying code that executes strings.
//
// Both dependencies publish these already bundled, so there is no module left to
// swap out — the code arrives inside a single flattened file. Each rewrite below
// turns a branch condition into `false`, so the bundler drops the branch, or
// replaces a fallback with the error it was papering over.
//
// Every pattern must match exactly once in every file it is applied to. A
// dependency update that moves one fails the build rather than quietly restoring
// the code.

const REWRITES = [
  {
    name: "immediate: schedule a drain by injecting a <script>",
    find: /"document"\s*in\s*([A-Za-z_$][\w$]*)\s*&&\s*"onreadystatechange"\s*in\s*\1\.document\.createElement\("script"\)/g,
    replace: "false",
  },
  {
    name: "setimmediate: schedule a task by injecting a <script>",
    find: /([A-Za-z_$][\w$]*)\s*&&\s*"onreadystatechange"\s*in\s*\1\.createElement\("script"\)/g,
    replace: "false",
  },
  {
    name: "setimmediate: compile a string callback with new Function",
    find: /"function"\s*!=\s*typeof\s*([A-Za-z_$][\w$]*)\s*&&\s*\(\1\s*=\s*new Function\(""\s*\+\s*\1\)\)/g,
    replace: 'if (typeof $1 !== "function") throw new TypeError("setImmediate expects a function")',
  },
];

// Broad on purpose: both packages publish several builds of the same bundle, and
// which one the bundler picks depends on options that are easy to change later.
// Any of them that is loaded gets checked.
const VENDORED_SCHEDULERS =
  /[\\/]node_modules[\\/](docx[\\/]dist[\\/]index\.[a-z]+|jszip[\\/]dist[\\/]jszip(\.min)?\.js)$/;

export const stripDeadSchedulers = {
  name: "strip-dead-schedulers",
  setup(build) {
    build.onLoad({ filter: VENDORED_SCHEDULERS }, async (args) => {
      let contents = await readFile(args.path, "utf8");

      for (const rewrite of REWRITES) {
        const found = contents.match(rewrite.find);
        if (found?.length !== 1) {
          throw new Error(
            `strip-dead-schedulers: expected one "${rewrite.name}" in ${args.path}, found ${found?.length ?? 0}. ` +
              "A dependency has changed. Re-read the polyfill and update the rewrite before shipping.",
          );
        }
        contents = contents.replace(rewrite.find, rewrite.replace);
      }

      return { contents, loader: "js" };
    });
  },
};
