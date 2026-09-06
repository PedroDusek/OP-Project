import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * As fronteiras entre camadas de docs/architecture.md secao 2 sao impostas
 * aqui. Sem isso elas seriam apenas uma recomendacao que a pressa acabaria
 * furando; com isso, atravessar uma camada quebra o build.
 *
 *   domain         -> nao importa nenhuma outra camada
 *   application    -> pode importar domain e infrastructure
 *   app/components -> nunca importam infrastructure direto
 */
const layerBoundaries = [
  {
    files: ["src/server/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/application/*",
                "@/server/infrastructure/*",
                "@/server/http/*",
                "@/app/*",
                "@/components/*",
                "@prisma/client",
                "next/*",
              ],
              message:
                "A camada domain e pura: sem I/O, sem Prisma, sem HTTP, sem framework. Mova a dependencia para application.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/infrastructure/*", "@prisma/client"],
              message:
                "app/ e components/ nunca falam com a persistencia direto. Passe por um caso de uso em @/server/application.",
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
