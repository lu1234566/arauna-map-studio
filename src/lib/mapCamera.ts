export const MAP_CAMERA_FIT_EVENT = "arauna:map-camera-fit";

export function requestMapCameraFit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MAP_CAMERA_FIT_EVENT));
}
