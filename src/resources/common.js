/**
 * Copyright (c) 2010 Andres Hernandez Monge and 
 * Copyright (c) 2011-2012 David M. Adler
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

var EXPORTED_SYMBOLS = ["ThumbnailZoomPlus"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/log4moz.js");

/**
 * ThumbnailZoomPlus namespace.
 */
if ("undefined" == typeof(ThumbnailZoomPlus)) {
  var ThumbnailZoomPlus = {
    /* The FUEL Application object. */
    _application : null,
    
    /* Reference to the observer service. */
    _observerService : null,
    
    _consoleService : null,
    
    /* Logger for this object (common.js itself). */
    _logger : null,

    // log file path as a string if logging enabled; else null.
    logPath : null,
    
    // Prefs caches preferences for faster retrieval.
    _prefs : {},
    
    /**
     * Initialize this object.
     */
    _init : function() {
      // 
      // ***** OVERALL DEBUG ENABLE IS HERE: *****
      //
      // Set to true to enable debug or trace messages.
      // See also the per-module enables farther below in
      // getLogger()
      //
      // Log messages will be written to ThumbnailZoomPlus/log.txt under
      // your profile dir.
      // On Mac OSX it might be
      // "/Users/$USER/Library/Application Support/Firefox/Profiles/7sep894p.developer/ThumbnailZoomPlus/log.txt"
      // On Windows it might be
      // 
      // To debug, set enableDebug above to true and monitor the log file
      // in a terminal using this command:
      // tail -200 -F "/Users/$USER/Library/Application Support/Firefox/Profiles/"*"/ThumbnailZoomPlus/log.txt"
      //
      // Enabling these increases CPU usage when moving the mouse in Firefox.
      // 
      let enableDebug = true;
      let enableTrace = false; // even more verbose
            
      // The basic formatter will output lines like:
      // DATE/TIME  LoggerName LEVEL  (log message)
      let formatter = new Log4Moz.AdvancedFormatter();
      formatter.dateFormat = "%Y-%m-%d %H:%M:%S%%L";
      let root = Log4Moz.repository.rootLogger;
      let logFile = this.getExtensionDirectory();
      let app;

      logFile.append("log.txt");

      // Loggers are hierarchical, lowering this log level will affect all
      // output.
      root.level = Log4Moz.Level["All"];

      // A console appender outputs to the JS Error Console.
      // app = new Log4Moz.ConsoleAppender(formatter);
      // app.level = Log4Moz.Level["Warn"];
      // root.addAppender(app);

      // A dump appender outputs to standard out.
      //app = new Log4Moz.DumpAppender(formatter);
      //app.level = Log4Moz.Level["Warn"];
      //root.addAppender(app);

      // This appender will log to the file system.
      app = new Log4Moz.RotatingFileAppender(logFile, formatter);
      
      if (enableTrace) {
        app.level = Log4Moz.Level["Trace"];
      } else if (enableDebug) {
        app.level = Log4Moz.Level["Debug"];
      } else {
        app.level = Log4Moz.Level["Warn"];
      }
      
      if (enableDebug || enableTrace) {
        this.logPath = logFile.path;
      } else {
        this.logPath = null;
      }
      
      root.addAppender(app);

      this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.common");

      this._logger.debug("ThumbnailZoomPlus.logPath = " + ThumbnailZoomPlus.logPath);

      // get the observer service.
      this._observerService =
        Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        
      this._consoleService = Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService);
    },

    /**
     * Gets a logger repository from Log4Moz.
     * @param aName the name of the logger to create.
     * @param aLevel (optional) the logger level.
     * @return the generated logger.
     */
    getLogger : function(aName, aLevel) {
      let logger = Log4Moz.repository.getLogger(aName);

      if (! aLevel) {
        // Set each to Warn (disable) or Trace (enable).
        if (aName == "ThumbnailZoomPlus.Overlay") {
          aLevel = "Trace";
        } else if (aName == "ThumbnailZoomPlus.Pages") {
          aLevel = "Trace";
        } else if (aName == "ThumbnailZoomPlus.FilterService") {
          aLevel = "Trace";
        } else if (aName == "ThumbnailZoomPlus.common") {
          aLevel = "Trace";
        }
      }
      logger.level = Log4Moz.Level[(aLevel ? aLevel : "All")];

      return logger;
    },

    /**
     * Gets the FUEL Application object.
     * @return the FUEL Application object.
     */
    get Application() {
      // use lazy initialization because the FUEL object is only available for
      // Firefox and won't work on XUL Runner builds.

      if (null == this._application) {
        try {
          this._application =
            Cc["@mozilla.org/fuel/application;1"].
              getService(Ci.fuelIApplication);
        } catch (e) {
          throw "The FUEL application object is not available.";
        }
      }

      return this._application;
    },

    /**
     * Gets the id of this extension.
     * @return the id of this extension.
     */
    get ExtensionId() { 
      return "thumbnailZoom@dadler.github.com"; 
    },

    /**
     * Gets the observer service.
     * @return the observer service.
     */
    get ObserverService() { return this._observerService; },

    /**
     * Gets a reference to the directory where the extension will keep its
     * files. The directory is created if it doesn't exist.
     * @return reference (nsIFile) to the extension directory.
     */
    getExtensionDirectory : function() {
      // XXX: there's no logging here because the logger initialization depends
      // on this method.

      let directoryService =
        Cc["@mozilla.org/file/directory_service;1"].
          getService(Ci.nsIProperties);
      let profDir = directoryService.get("ProfD", Ci.nsIFile);

      profDir.append("ThumbnailZoomPlus");

      if (!profDir.exists() || !profDir.isDirectory()) {
        // read and write permissions to owner and group, read-only for others.
        profDir.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt('0774', 8));
      }

      return profDir;
    },
    
    /**
     * Gets the preference branch.
     * @return the preference branch.
     */
    get PrefBranch() { return "extensions.thumbnailzoomplus."; },

    /**
     * getPref returns the value of the named key, or defaultValue if
     * the key doesn't exist in the preferences system.  This defult is a
     * fallback of last resort; the preference should already be registered
     * (see thumbnailzoomplus.js) and that registration provides the normal
     * default.
     *
     * Note that the value is returned directly; do not try to do
     * result.value.
     *
     * This function caches preferences in this._prefs, which is an important
     * speed optimization.
     */
    getPref : function(key, defaultValue) {
      if (key in this._prefs) {
        var value = this._prefs[key];
        this._logger.debug("getPref: cache hit: prefs['" + key + "'] = " + value);
      } else {
        var pref = ThumbnailZoomPlus.Application.prefs.get(key);
        if (pref) {
          var value = pref.value;
        } else {
          // pref doesn't exist so use hard-coded default.  This shouldn't
          // normally happen, but would if you specified a preference not defined
          // in thumbnailzoomplus.js.
          this._logger.debug("getPref: WARNING: using hard-coded default for prefs['" + key + "']");
          var value = defaultValue;
        }
        // update cache
        this._prefs[key] = value;
        this._logger.debug("getPref: cache miss: prefs['" + key + "'] = " + value);
      }
      return value;
    },
    
    /// clear the cache of the specified pref key; called when TZP
    /// observes that the pref has changed values.
    clearPrefCacheItem : function(key) {
      this._logger.debug("clearPrefCacheItem: delete cache prefs['" + key + "']");

      delete this._prefs[key];
    },
    
    /// Updates the pref cache (but not the Firefox preference itself).
    setPrefCache : function(key, value) {
      this._logger.debug("setPrefCache: set cache prefs['" + key + "'] = " + value);
      this._prefs[key] = value;
    },
    
    /// Sets the specified preference to the specified value and updates the
    /// cache accordingly.
    setPref : function(key, value) {
      this.Application.prefs.setValue(key, value);
      this.setPrefCache(key, value);
    },
    
    togglePref : function(key) {
      let value = ! this.getPref(key, "false");
      this.setPref(key, value);
      
      return value;
    },
    
    /**
     * Verify if the page is enabled.
     * @param aPage the page key (string).
     * @return true if the page is enabled, false otherwise.
     */
    isNamedPageEnabled : function(key) {
      this._logger.debug("isNamedPageEnabled " + key);

      let pagePrefKey = ThumbnailZoomPlus.PrefBranch + key + ".enable";      
      return ThumbnailZoomPlus.getPref(pagePrefKey, false);
    }

  };

  /**
   * Constructor.
   */
  (function() {
    this._init();
  }).apply(ThumbnailZoomPlus);
}
