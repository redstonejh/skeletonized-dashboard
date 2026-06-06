# Increment 5B-1 Refactor Plan

Move remaining primitive panel tool-session state into createPanelToolSession while leaving all panel lifecycle DOM behavior in pp.js.

Changed state: suppress tool open until, ignore hover-close until pointer activity, tools opened by approach. Existing session-owned state remains close timer, moved pointer, header toggle suppression, and tool pointer capture.