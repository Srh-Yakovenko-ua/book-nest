# The series character graph is frozen

Character relationships are drawn by two separate graph stacks. The book page uses the graph workspace (`features/character-relationships/components/workspace/` and the scene model in `model/workspace/`). The series characters tab uses the older `RelationshipGraph`, exported from `features/character-relationships/index.ts`, and nothing else uses it.

The two stacks each have their own:

- canvas;
- edge drawing;
- layout save and reset;
- path controls.

So every fix to graph behaviour had to be made twice, and the two drifted apart.

Moving the series tab onto the workspace scene model would remove the duplication. It is a large change with a high risk of regressions, and no current feature needs it. So the older stack is frozen:

- it keeps working for the series tab;
- it receives bug fixes only when the series tab itself is broken;
- it gets no new graph features.

New graph features go into the workspace only.

When the series tab next needs a graph feature the workspace already has, that is the point to move it onto the workspace and delete `RelationshipGraph`, rather than to add the feature to both.
