goog.module('os.time.TimelineActionEventType');
goog.module.declareLegacyNamespace();

/**
 * timeline actions
 * @enum {string}
 */
exports = {
  LOAD: 'timeline.load',
  ADD: 'timeline.add',
  SLICE: 'timeline.slice',
  SELECT: 'timeline.select',
  SELECT_EXCLUSIVE: 'timeline.selectExclusive',
  DESELECT: 'timeline.deselect',
  REMOVE: 'timeline.remove',
  ANIMATE: 'timeline.animate',
  ANIMATE_SKIP: 'timeline.animateSkip',
  ANIMATE_HOLD: 'timeline.animateHold',
  ACTIVE_WINDOW: 'timeline.activeWindow',
  ZOOM: 'timeline.zoom',
  FEATURE_INFO: 'timeline.featureInfo',
  GO_TO: 'timeline.goTo'
};
