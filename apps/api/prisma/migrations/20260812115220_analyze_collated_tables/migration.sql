-- ALTER COLUMN ... TYPE drops the column's pg_statistic rows unconditionally, including on
-- the no-rewrite path the collation change takes. Without stats the planner falls back to
-- default selectivity, and on a low-churn table autovacuum may never re-analyze it, so a
-- bad plan can persist. This runs as its own migration so the previous one's locks are
-- already released and ANALYZE cannot extend them.

ANALYZE "books";
ANALYZE "authors";
ANALYZE "publishers";
ANALYZE "publisher_names";
ANALYZE "series";
ANALYZE "book_lists";
ANALYZE "characters";
ANALYZE "character_groups";
ANALYZE "tags";
ANALYZE "genres";
ANALYZE "delivery_services";
ANALYZE "book_loans";
ANALYZE "book_deliveries";
ANALYZE "book_purchase_info";
ANALYZE "book_store_links";
