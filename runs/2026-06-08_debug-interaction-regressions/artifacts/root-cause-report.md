# Root Cause Report

- Widget click reload: runtime stat widgets are anchors. Existing widget click focus handler did not prevent default, so anchor default navigation changed the renderer URL/hash and could reload newly created href=current-path widgets.
- Orange artifacts: live DOM probe showed Chromium UA focus outline on focused anchor widget (`rgb(229, 151, 0) auto 1px`). The deformed detached stroke was DOM focus painting around the rounded/transformed anchor widget, not WebGL/canvas; the WebGL layer only had its normal background canvas.
- Panel-internal move: viewport row floor used the panel-internal grid as its host. That grid collapses to content height, making the drag boundary content-relative and preventing free movement inside the panel body.
- Panel-contained widget tab switch: page runtime stores raw panel HTML per tab. Panel absorb/extract did not immediately persist the active workspace page, leaving the page store stale until another serializer event.
- Widget recolor: custom-color widgets received the chosen color in data/style variables, but a later edge-stack override reset `background` to clear glass and `background-image: none !important`, so the accent wash could not render.
