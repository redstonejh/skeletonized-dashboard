# Critic Notes

Reviewed the change for two failure modes:

- `ceil` row counting can permit partial rows and create a few pixels of scroll growth.
- the new free-space canary must be isolated from the later widget absorption flow.

Both were addressed before acceptance.

