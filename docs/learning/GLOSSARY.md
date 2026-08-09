# Technical glossary

The vocabulary this project's backend and infrastructure work runs on. Product terms (book, list, series, trash) do not belong here, they belong in the root domain glossary.

A term earns a place here once it is being used correctly, not when it is first met.

## Postgres

**Partial index**:
An index built over only the rows matching a `WHERE` predicate, so rows outside the predicate are absent from it entirely.
_Avoid_: filtered index, conditional index

**Partial unique index**:
A partial index that is also unique, which makes uniqueness apply only inside the predicate. This is how a rule like "one open goal per list" is enforced, because archiving a row moves it out of the predicate and frees the slot.
_Avoid_: soft unique, conditional constraint

**Constraint versus index**:
A `UNIQUE` constraint is declared on the table and always covers every row. A unique index can carry a predicate. Postgres implements a constraint with an index underneath, but the reverse does not hold, and that asymmetry is why every partial unique rule in this repo is written as an index.

**Trigram index (`gin_trgm_ops`)**:
A GIN index over three-character substrings, which lets `LIKE '%foo%'` and similarity search use an index instead of scanning the table.

**Advisory lock**:
An application-defined lock held on an arbitrary number rather than on a row, used to serialise a check-then-write window that no single constraint can cover.
_Avoid_: mutex, app lock

## Prisma

**Engineless client**:
Prisma 7 running through a plain driver adapter instead of a native query engine binary, which is why this repo has no native addon to compile in CI.

**The schema is not the database**:
`schema.prisma` is Prisma's model of the world and the migration SQL is the truth. Anything Prisma cannot express, a partial predicate among them, exists only in the SQL, and Prisma will emit a `DROP INDEX` for it on the next migration because it cannot see it.

**RESTRICT default**:
A required relation with no `onDelete` gets `ON DELETE RESTRICT`. The absence of an attribute is the decision, which means grepping for `onDelete` cannot find it.
