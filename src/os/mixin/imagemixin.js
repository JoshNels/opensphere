goog.provide('os.mixin.Image');

goog.require('ol.Image');
goog.require('ol.ImageState');


/**
 * Get the image element for this source.
 *
 * @inheritDoc
 * @suppress {accessControls}
 */
ol.Image.prototype.getImage = function() {
  if (this.image_ && this.image_.width && this.image_.height && this.olSource
    && this.getState() == ol.ImageState.LOADED) {
    // make sure getImageFilters exists on the source
    var filterFns = this.olSource.getImageFilters ? this.olSource.getImageFilters() : [];
    if (filterFns.length > 0) {
      return os.tile.filterImage(/** @type {HTMLCanvasElement|Image} */ (this.image_), filterFns);
    }
  }
  return this.image_;
};
