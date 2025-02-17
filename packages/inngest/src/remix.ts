import {
  InngestCommHandler,
  type ActionResponse,
  type ServeHandler,
} from "./components/InngestCommHandler";
import { headerKeys, queryKeys } from "./helpers/consts";
import { type SupportedFrameworkName } from "./types";

export const name: SupportedFrameworkName = "remix";

const createNewResponse = ({
  body,
  status,
  headers,
}: ActionResponse<string | ReadableStream>): Response => {
  /**
   * If `Response` isn't included in this environment, it's probably a Node
   * env that isn't already polyfilling. In this case, we can polyfill it
   * here to be safe.
   */
  let Res: typeof Response;

  if (typeof Response === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires
    Res = require("cross-fetch").Response;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    Res = Response;
  }

  return new Res(body, {
    status,
    headers,
  });
};

/**
 * In Remix, serve and register any declared functions with Inngest, making them
 * available to be triggered by events.
 *
 * Remix requires that you export both a "loader" for serving `GET` requests,
 * and an "action" for serving other requests, therefore exporting both is
 * required.
 *
 * See {@link https://remix.run/docs/en/v1/guides/resource-routes}
 *
 * @example
 * ```ts
 * import { serve } from "inngest/remix";
 * import fns from "~/inngest";
 *
 * const handler = serve("My Remix App", fns);
 *
 * export { handler as loader, handler as action };
 * ```
 *
 * @public
 */
export const serve: ServeHandler = (nameOrInngest, fns, opts): unknown => {
  const handler = new InngestCommHandler(
    name,
    nameOrInngest,
    fns,
    opts,
    ({ request: req }: { request: Request }) => {
      const url = new URL(req.url, `https://${req.headers.get("host") || ""}`);

      return {
        url,
        register: () => {
          if (req.method === "PUT") {
            return {
              deployId: url.searchParams.get(queryKeys.DeployId),
            };
          }
        },
        run: async () => {
          if (req.method === "POST") {
            return {
              data: (await req.json()) as Record<string, unknown>,
              fnId: url.searchParams.get(queryKeys.FnId) as string,
              stepId: url.searchParams.get(queryKeys.StepId) as string,
              signature: req.headers.get(headerKeys.Signature) || undefined,
            };
          }
        },
        view: () => {
          if (req.method === "GET") {
            return {
              isIntrospection: url.searchParams.has(queryKeys.Introspect),
            };
          }
        },
      };
    },
    createNewResponse,
    createNewResponse
  );

  return handler.createHandler();
};
