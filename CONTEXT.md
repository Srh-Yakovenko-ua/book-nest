# book-nest

A self-hosted library for one reader's books: what they own, read, lend, order and plan to buy.

## Language

### Filtering a list

**Quick filter**:
A preset shown as a row of single-choice chips above a list, switching one common view with one click. Exactly one is selected, and "All" is one of them.
_Avoid_: tab, preset tab, filter chip

**Active filter chip**:
A removable chip that shows a filter already applied from search or the advanced filter sheet, with a control to clear it.
_Avoid_: quick filter, tag

**Quick filter count**:
The number on a quick filter chip: how many results that chip would show under the current search and advanced filters, ignoring which quick filter is selected. See `docs/adr/0001-quick-filter-counts-follow-the-query.md`.
_Avoid_: total, summary count

**Summary**:
Library-wide figures for a section (sidebar blocks, stat cards) that ignore search and filters.
_Avoid_: counts, facets
