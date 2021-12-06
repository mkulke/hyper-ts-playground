import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import axios from "axios";
import * as t from "io-ts";
import { failure } from "io-ts/lib/PathReporter";
import * as C from "fp-ts/Console";

const Todo = t.type({
  title: t.string,
});

type Todo = t.TypeOf<typeof Todo>;

const bodyDecoder = (u: unknown) =>
  pipe(
    Todo.decode(u),
    E.mapLeft(
      (errors) =>
        `Could not parse response body:\n${failure(errors).join("\n")}`
    ),
    TE.fromEither
  );

const getTodo = (requestId: string): TE.TaskEither<string, Todo> =>
  pipe(
    C.info(`calling service {requestId=${requestId}}`),
    TE.fromIO,
    TE.chain(() =>
      TE.tryCatch(
        () => axios("https://jsonplaceholder.typicode.com/todos/1"),
        String
      )
    ),
    TE.map((response) => response.data),
    TE.chain(bodyDecoder)
  );

export { Todo, getTodo };
