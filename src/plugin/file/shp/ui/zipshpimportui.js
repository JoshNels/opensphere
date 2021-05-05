goog.provide('plugin.file.shp.ui.ZipSHPImportUI');

goog.require('os.data.DataManager');
goog.require('os.file');
goog.require('os.file.File');
goog.require('os.ui.im.FileImportUI');
goog.require('os.ui.window');
goog.require('os.ui.wiz.OptionsStep');
goog.require('os.ui.wiz.step.TimeStep');
goog.require('plugin.file.shp.SHPDescriptor');
goog.require('plugin.file.shp.SHPParserConfig');
goog.require('plugin.file.shp.SHPProvider');
goog.require('plugin.file.shp.mime');
goog.require('plugin.file.shp.ui.shpImportDirective');



/**
 * @extends {os.ui.im.FileImportUI.<plugin.file.shp.SHPParserConfig>}
 * @constructor
 */
plugin.file.shp.ui.ZipSHPImportUI = function() {
  /**
   * @type {os.file.File}
   * @private
   */
  this.shpFile_ = null;

  /**
   * @type {os.file.File}
   * @private
   */
  this.dbfFile_ = null;

  /**
   * @type {os.file.File}
   * @private
   */
  this.zipFile_ = null;

  /**
   * @type {plugin.file.shp.SHPParserConfig}
   * @private
   */
  this.config_ = null;

  /**
   * @type {!Array<!zip.Reader>}
   * @protected
   */
  this.zipReaders = [];
};
goog.inherits(plugin.file.shp.ui.ZipSHPImportUI, os.ui.im.FileImportUI);


/**
 * @inheritDoc
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.launchUI = function(file, opt_config) {
  plugin.file.shp.ui.ZipSHPImportUI.base(this, 'launchUI', file, opt_config);

  this.shpFile_ = null;
  this.dbfFile_ = null;
  this.zipFile_ = file;

  if (opt_config !== undefined) {
    this.config_ = opt_config;
  }

  const content = /** @type {ArrayBuffer|Blob} */ (file.getContent());

  if (content instanceof ArrayBuffer) {
    zip.createReader(new zip.ArrayBufferReader(content),
        this.handleZipReader.bind(this), this.handleZipReaderError.bind(this));
  } else if (content instanceof Blob) {
    // convert the blob to an ArrayBuffer and proceed down the normal path
    content.arrayBuffer().then((arrayBuffer) => {
      this.zipFile_.setContent(arrayBuffer);
      zip.createReader(new zip.ArrayBufferReader(arrayBuffer),
          this.handleZipReader.bind(this), this.handleZipReaderError.bind(this));
    }, (reason) => {
      this.handleZipReaderError(reason);
    });
  }
};


/**
 * @param {!zip.Reader} reader
 * @protected
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.handleZipReader = function(reader) {
  this.zipReaders.push(reader);
  reader.getEntries(this.processEntries_.bind(this));
};


/**
 * Handles ZIP reader errors.
 * @param {*} opt_error Optional error message/exception.
 * @protected
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.handleZipReaderError = function(opt_error) {
  // failed reading the zip file
  var msg = 'Error reading zip file!"';

  if (typeof opt_error == 'string') {
    msg += ` Details: ${opt_error}`;
  } else if (opt_error instanceof Error) {
    msg += ` Details: ${opt_error.message}.`;
  }

  os.alert.AlertManager.getInstance().sendAlert(msg, os.alert.AlertEventSeverity.ERROR);
};


/**
 * @param {Array.<!zip.Entry>} entries
 * @private
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.processEntries_ = function(entries) {
  for (var i = 0, n = entries.length; i < n; i++) {
    var entry = entries[i];
    if (plugin.file.shp.mime.SHP_EXT_REGEXP.test(entry.filename) ||
        plugin.file.shp.mime.DBF_EXT_REGEXP.test(entry.filename)) {
      // if the entry is a shp or dbf, load the content and process it
      entry.getData(new zip.ArrayBufferWriter(), this.processEntry_.bind(this, entry));
    }
  }
};


/**
 * @param {zip.Entry} entry
 * @param {*} content
 * @private
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.processEntry_ = function(entry, content) {
  if (content instanceof ArrayBuffer) {
    // only use the first file encountered, which means archives with multiple shapefiles will only load the first
    content = /** @type {!ArrayBuffer} */ (content);
    if (!this.shpFile_ && plugin.file.shp.mime.SHP_EXT_REGEXP.test(entry.filename)) {
      this.shpFile_ =
          os.file.createFromContent(entry.filename, os.file.getLocalUrl(entry.filename), undefined, content);
    } else if (!this.dbfFile_ && plugin.file.shp.mime.DBF_EXT_REGEXP.test(entry.filename)) {
      this.dbfFile_ =
          os.file.createFromContent(entry.filename, os.file.getLocalUrl(entry.filename), undefined, content);
    }
  }

  if (this.shpFile_ && this.dbfFile_) {
    this.launchUIInternal_();
  }
};


/**
 * @private
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.launchUIInternal_ = function() {
  if (this.shpFile_ && this.dbfFile_) {
    var config = new plugin.file.shp.SHPParserConfig();
    let defaultImport = false;

    // if a configuration was provided, merge it in
    if (this.config_) {
      defaultImport = this.config_['defaultImport'] || false;
      this.mergeConfig(this.config_, config);
      this.config_ = null;
    }

    config['file'] = this.shpFile_;
    config['file2'] = this.dbfFile_;
    config['zipFile'] = this.zipFile_;
    config['title'] = this.zipFile_.getFileName();

    // generate preview data from the config and try to auto detect mappings
    config.updatePreview();
    var features = config['preview'];
    if ((!config['mappings'] || config['mappings'].length <= 0) && features && features.length > 0) {
      // no mappings have been set yet, so try to auto detect them
      var mm = os.im.mapping.MappingManager.getInstance();
      var mappings = mm.autoDetect(features);
      if (mappings && mappings.length > 0) {
        config['mappings'] = mappings;
      }
    }

    if (defaultImport) {
      this.handleDefaultImport(this.shpFile_, config);
      return;
    }

    var steps = [
      new os.ui.wiz.step.TimeStep(),
      new os.ui.wiz.OptionsStep()
    ];

    var scopeOptions = {
      'config': config,
      'steps': steps
    };
    var windowOptions = {
      'label': 'SHP Import',
      'icon': 'fa fa-sign-in',
      'x': 'center',
      'y': 'center',
      'width': '850',
      'min-width': '500',
      'max-width': '1200',
      'height': '650',
      'min-height': '300',
      'max-height': '1000',
      'modal': 'true',
      'show-close': 'true'
    };
    var template = '<shpimport resize-with="' + os.ui.windowSelector.WINDOW + '"></shpimport>';
    os.ui.window.create(windowOptions, template, undefined, undefined, undefined, scopeOptions);
  } else {
    var msg = 'Zip file does not contain both SHP and DBF files!';
    os.alert.AlertManager.getInstance().sendAlert(msg, os.alert.AlertEventSeverity.ERROR);
  }

  // drop file references once the UI is launched
  this.zipReaders.forEach(function(reader) {
    reader.close();
  });
  this.zipReaders.length = 0;
  this.shpFile_ = null;
  this.dbfFile_ = null;
  this.zipFile_ = null;
};


/**
 * @inheritDoc
 */
plugin.file.shp.ui.ZipSHPImportUI.prototype.handleDefaultImport = function(file, config) {
  config = this.getDefaultConfig(file, config);

  // create the descriptor and add it
  if (config) {
    const descriptor = plugin.file.shp.SHPDescriptor.createFromConfig(config);
    os.data.DataManager.getInstance().addDescriptor(descriptor);
    plugin.file.shp.SHPProvider.getInstance().addDescriptor(descriptor);
    descriptor.setActive(true);
  }
};
