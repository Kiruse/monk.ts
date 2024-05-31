# @kiruse/monk
Monk is a very opinionated MongoDB abstraction library designed to leverage MongoDB's innate flexibility.

As a document-based database, thinking exclusively in schemas and tables seems archaic. Certainly, that line of thought has its place in a document database as well, but the coexistence of differently shaped yet related documents within the same collection unlocks new possibilities that are impractical with tabular/relational databases. The mere fact alone that MongoDB only rudimentarily supports transactions requires a paradigm shift for developers venturing from a relational database system.

This library is a WIP that I'm using in my other projects. Sorry.

# Testing
Running Monk's unit tests has two requirements:

1. [bun](https://bun.sh)
2. [docker compose](https://docs.docker.com/compose/)

Then, execute these steps:

1. Run `npm run testenv:up`
2. Run `npm run test`
3. Run `npm run testenv:down`

I will eventually refine & further automate this process but for the time being a semi-manual execution is enough for my needs.
