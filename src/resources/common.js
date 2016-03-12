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

Cu.import("resource://gre/modules/Log.jsm");

try {
  Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
} catch (e) {
  // old Firefox versions (e.g. 3.6) didn't have PrivateBrowsingUtils.
}


/**
 * ThumbnailZoomPlus namespace.
 */
if ("undefined" == typeof(ThumbnailZoomPlus)) {
  var ThumbnailZoomPlus = {
    _preferencesService : null,
    
    /* Reference to the observer service. */
    _observerService : null,
    
    _consoleService : null,
    
    /* Logger for this object (common.js itself). */
    _logger : null,

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
      // Log messages will be written to the Console.
      // To debug, set enableDebug above to true and monitor the console.
      // Enabling these increases CPU usage when moving the mouse in Firefox.
      // 
      let enableDebug = false;
      let enableTrace = false; // even more verbose
            
      // The basic formatter will output lines like:
      // DATE/TIME  LoggerName LEVEL  (log message)
      let formatter = new Log.BasicFormatter();
      let root = Log.repository.rootLogger;
      let logFile = this.getExtensionDirectory();
      let app;

      logFile.append("log.txt");

      // Loggers are hierarchical, lowering this log level will affect all
      // output.
      root.level = Log.Level["All"];

      // A console appender outputs to the JS Error Console.
      // app = new Log.ConsoleAppender(formatter);
      // app.level = Log.Level["Warn"];
      // root.addAppender(app);

      // A dump appender outputs to standard out.
      //app = new Log.DumpAppender(formatter);
      //app.level = Log.Level["Warn"];
      //root.addAppender(app);

      // This appender will log to the file system.
      app = new Log.ConsoleAppender(formatter);
      
      if (enableTrace) {
        app.level = Log.Level["Trace"];
      } else if (enableDebug) {
        app.level = Log.Level["Debug"];
      } else {
        app.level = Log.Level["Warn"];
      }
      
      root.addAppender(app);

      this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.common");

      // get the observer service.
      this._observerService =
        Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        
      this._consoleService = Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService);
    
      this._preferencesService =
        Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

    },

    /**
     * Gets a logger repository from Log.
     * @param aName the name of the logger to create.
     * @param aLevel (optional) the logger level.
     * @return the generated logger.
     */
    getLogger : function(aName, aLevel) {
      let logger = Log.repository.getLogger(aName);

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
      logger.level = Log.Level[(aLevel ? aLevel : "All")];

      return logger;
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
     * getGenericPref returns the value of the named key, or defaultValue if
     * the key doesn't exist in the preferences system, using the
     * specified getPrefFunc accessor unction of the preferences service.  This defult is a
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
    getGenericPref : function(getPrefFunc, key, defaultValue) {
      // TODO: change API; needs getIntPref, getCharPref, getBoolPref, etc.
      // https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Preferences
      if (key in this._prefs) {
        var value = this._prefs[key];
        this._logger.debug("getPref: cache hit: prefs['" + key + "'] = " + value);
      } else {
        var pref = getPrefFunc(key);
        if (undefined != pref) {
          var value = pref;
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
    
    getCharPref: function(key, defaultValue) {
        var getPrefFunc = this._preferencesService.getCharPref.bind(this._preferencesService);
        return this.getGenericPref(getPrefFunc, key, defaultValue);
    },
    
    getIntPref: function(key, defaultValue) {
        var getPrefFunc = this._preferencesService.getIntPref.bind(this._preferencesService);
        return this.getGenericPref(getPrefFunc, key, defaultValue);
    },
    
    getBoolPref: function(key, defaultValue) {
        var getPrefFunc = this._preferencesService.getBoolPref.bind(this._preferencesService);
        return this.getGenericPref(getPrefFunc, key, defaultValue);
    },
    
    getFloatPref: function(key, defaultValue) {
        return 0.0 + this.getCharPref(key, "" + defaultValue);
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
    setBoolPref : function(key, value) {
      // Set cache before setting app pref since setting app pref may trigger
      // an event which could call getPref, and use the cache.
      this.setPrefCache(key, value);
      this._preferencesService.setBoolPref(key, value);
    },

    setIntPref : function(key, value) {
      // Set cache before setting app pref since setting app pref may trigger
      // an event which could call getPref, and use the cache.
      this.setPrefCache(key, value);
      this._preferencesService.setIntPref(key, value);
    },

    setCharPref : function(key, value) {
      // Set cache before setting app pref since setting app pref may trigger
      // an event which could call getPref, and use the cache.
      this.setPrefCache(key, value);
      this._preferencesService.setCharPref(key, value);
    },
    
    togglePref : function(key) {
      let value = ! this.getBoolPref(key, "false");
      this.setBoolPref(key, value);
      
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
      return ThumbnailZoomPlus.getBoolPref(pagePrefKey, true);
    },

    _logToConsole : function(msg) {
      let date = new Date();
      let timeStamp = date.toLocaleTimeString() + 
                          String((date.getMilliseconds() % 1000) / 1000.).replace(/^0\./, ".");
      this._consoleService.logStringMessage(timeStamp + ": " + msg);
    },

    /**
     * _logExceptionToConsole logs an exception.  Example:
     *   try {
     *     ...
     *   } catch (e) {
     *     ThumbnailZoomPlus._logExceptionToConsole("_getImage", e);
     *   }
     */
    _logExceptionToConsole : function(preamble, exception) {
      this._logToConsole(preamble + ": ***** EXCEPTION *****: " + exception + 
                         " at " + exception.fileName + ":" + exception.lineNumber);
    },
      
    debugToConsole : function(msg) {
      this._logger.debug("### CONSOLE: " + msg);
      if (this.getBoolPref(this.PrefBranch + "panel.debug", false)) {
        this._logToConsole(msg);
      }
    },
      
    isPrivateBrowsing : function(win) {
      this._logger.trace("isPrivateBrowsing");
      
      if (win && "undefined" != typeof(PrivateBrowsingUtils) &&
          PrivateBrowsingUtils.privacyContextFromWindow) {
        var privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(win);
        var isPrivate = privacyContext.usePrivateBrowsing;
      } else {
        // older than Firefox 19 or couldn't get window.
          var isPrivate = Components.classes["@mozilla.org/privatebrowsing;1"].
            getService(Components.interfaces.nsIPrivateBrowsingService).
            privateBrowsingEnabled;
      }
      return isPrivate;
    }
    

  };

  /**
   * Constructor.
   */
  (function() {
    this._init();
  }).apply(ThumbnailZoomPlus);
}
