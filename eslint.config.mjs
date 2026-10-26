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

/**
 * O prefixo `_` num argumento significa "a assinatura exige, o corpo nao usa".
 *
 * E o caso das Server Actions: `useActionState` sempre chama com
 * `(estadoAnterior, formData)`, e nem toda acao precisa dos dois. O codigo ja
 * usava a convencao; sem esta regra ela valia so quando o argumento nao usado
 * vinha antes de um usado, o que e uma sutileza do `after-used` que ninguem
 * deveria precisar ter na cabeca.
 */
const argumentosIntencionalmenteIgnorados = [
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerBoundaries,
  ...argumentosIntencionalmenteIgnorados,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Os worktrees que o Claude Code cria para suas sessoes.
     *
     * Cada um e uma **copia inteira do repositorio**, com `src/`, `tests/` e
     * `scripts/` dentro. Sem esta linha o `npm run lint` entra neles e reporta o
     * codigo de la como se fosse o daqui: em 26/10 um worktree esquecido de
     * 1,2 GB rendia 21.939 problemas, 1.223 deles erros, nenhum deste projeto.
     * O lint passava a mentir nas duas direcoes — ninguem le 1.223 erros, e um
     * erro de verdade se perderia no meio.
     *
     * O `.gitignore` ja ignora `.claude/`, mas o eslint tem a lista dele.
     */
    ".claude/**",
  ]),
]);

export default eslintConfig;
