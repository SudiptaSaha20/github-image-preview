window.GHIP = window.GHIP || {};

(function (NS) {
  "use strict";
  if (NS.clampPan) return;

  function clampPan(tx, ty, scale, containerRect, imgNaturalRect) {
    const scaledW = imgNaturalRect.width * scale;
    const scaledH = imgNaturalRect.height * scale;
    const maxX = Math.max(0, (scaledW - containerRect.width) / 2);
    const maxY = Math.max(0, (scaledH - containerRect.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(maxY, Math.max(-maxY, ty)),
    };
  }

  function touchDist(t0, t1) {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }

  function touchMidpoint(t0, t1) {
    return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
  }

  NS.clampPan = clampPan;
  NS.touchDist = touchDist;
  NS.touchMidpoint = touchMidpoint;
})(window.GHIP);
