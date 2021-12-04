# hyper-ts playground

A typescript express app with monadic middlewares and typestates. Query parameters are parsed/validated and a request-id is attached to the responses.

## Build

```bash
npm i
$(npm bin)/tsc -p .
```

## Run

```bash
node dist/index.js
```

```bash
curl -D - "localhost:3000/hello?name=mgns&age=42" -H "x-request-id: abc"
HTTP/1.1 400 Bad Request
X-Powered-By: Express
X-Request-Id: abc
Content-Type: text/html; charset=utf-8
Content-Length: 8
ETag: W/"8-yqzevzlRHR4rmJG8R1oMx5rj2k8"
Date: Sat, 04 Dec 2021 23:26:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

too old!
```
