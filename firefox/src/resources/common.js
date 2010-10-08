/**
 * Copyright (c) 2010 Andres Hernandez Monge
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

var EXPORTED_SYMBOLS = ["ImageZoom"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagezoom/log4moz.js");

/**
 * ImageZoom namespace.
 */
if ("undefined" == typeof(ImageZoom)) {
  ImageZoom = {
    /* The FUEL Application object. */
    _application : null,
    /* Reference to the observer service. */
    _observerService : null,

    /**
     * Initialize this object.
     */
    _init : function() {
      // The basic formatter will output lines like:
      // DATE/TIME  LoggerName LEVEL  (log message)
      let formatter = new Log4Moz.AdvancedFormatter();
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
      app.level = Log4Moz.Level["Warn"];
      root.addAppender(app);

      // get the observer service.
      this._observerService =
        Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    },

    /**
     * Gets a logger repository from Log4Moz.
     * @param aName the name of the logger to create.
     * @param aLevel (optional) the logger level.
     * @return the generated logger.
     */
    getLogger : function(aName, aLevel) {
      let logger = Log4Moz.repository.getLogger(aName);

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
     * Gets the preference branch.
     * @return the preference branch.
     */
    get PrefBranch() { return "extensions.imagezoom."; },

    /**
     * Gets the id of this extension.
     * @return the id of this extension.
     */
    get ExtensionId() { return "{E10A6337-382E-4FE6-96DE-936ADC34DD04}"; },

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

      profDir.append("ImageZoom");

      if (!profDir.exists() || !profDir.isDirectory()) {
        // read and write permissions to owner and group, read-only for others.
        profDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0774);
      }

      return profDir;
    }
  };

  /**
   * Constructor.
   */
  (function() {
    this._init();
  }).apply(ImageZoom);
}
