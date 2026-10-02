// Lets plain `node` run the app's TypeScript modules from scripts: Node strips
// the types itself; this hook only resolves extensionless relative imports.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== "ERR_MODULE_NOT_FOUND" || !/^\.{1,2}\//.test(specifier)) throw err;
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next candidate
        }
      }
      throw err;
    }
  },
});
