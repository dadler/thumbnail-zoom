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

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

// The extension manager action requested observer topic
const TOPIC_ACTION_REQUESTED = "em-action-requested";
// The quit application observer topic
const TOPIC_QUIT_APPLICATION = "quit-application";

/**
 * The Uninstall Service.
 */
ThumbnailZoomPlus.UninstallService = {
  /* Logger for this object. */
  _logger : null,

  /* Flag indicates whether the uninstall should be executed on exit. */
  _shouldUninstall : false,

  _disabling : false,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.UninstallService");
    this._logger.trace("_init");

    ThumbnailZoomPlus.ObserverService.addObserver(this, TOPIC_QUIT_APPLICATION, false);
    ThumbnailZoomPlus.ObserverService.addObserver(this, TOPIC_ACTION_REQUESTED, false);

    // Firefox 4 requires an special listener to catch add-on related activity
    // (uninstall event mostly). If we try importing the module and there's an
    // exception, then we are not on Firefox 4.
    try {
      Cu.import("resource://gre/modules/AddonManager.jsm");
      AddonManager.addAddonListener(this);
    } catch (ex) {}
  },

  /**
   * Called when the add-on is being disabled.  We clear the
   * button.installed pref because Firefox will forget about the
   * toolbar button when we disable, so we need it to re-add the
   * default toolbar button when the user re-enables.
   */
  _clearInstalledPref : function() {
      this._logger.trace("_clearInstalledPref");

      // When we later re-enable the add-on, it'll re-add the toolbutton
      // if button.installed is false. 
      let pref = ThumbnailZoomPlus.PrefBranch + "button.installed";
      ThumbnailZoomPlus.setPref(pref, false);
      this._logger.trace("_clearInstalledPref: done");
  },
  
  /**
   * Cleans up code to remove the extension directory and related preferences.
   */
  _cleanUp : function() {
    this._logger.trace("_cleanUp");

    let prefBranch =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

    // remove the preferences.
    prefBranch.deleteBranch(ThumbnailZoomPlus.PrefBranch);
    // remove the extension directory if possible.
    this._removeExtensionFolder();
  },

  /**
   * Removes the extension folder.
   */
  _removeExtensionFolder : function() {
    this._logger.trace("_removeExtensionFolder");

    let installFolder = ThumbnailZoomPlus.getExtensionDirectory();

    try {
      if (installFolder.exists() && installFolder.isDirectory()) {
        installFolder.remove(true);
      }
    } catch (e) {
      // XXX: failed to remove directory, so lets remove contents recursively.
      this._logger.error("_removeExtensionFolder. Error:\n" + e);

      if (installFolder.exists()) {
        let directoryEntries = installFolder.directoryEntries;
        let entry = null;

        while (directoryEntries.hasMoreElements()) {
          entry = directoryEntries.getNext();
          entry.QueryInterface(Ci.nsIFile);

          try {
            entry.remove(true);
          } catch (e) {
            this._logger.error("_removeExtensionFolder. Error:\n" + e);
          }
        }

        // try one last time to remove the extension folder.
        try {
          installFolder.remove(true);
        } catch (e) {
          this._logger.error("_removeExtensionFolder. Error:\n" + e);
        }
      }
    }
  },

  /**
   * Handles the on uninstalling observer in FF4.
   * @param aItem the item to be uninstalled.
   */
  onUninstalling : function(aItem) {
    this._logger.debug("onUninstalling");

    if (ThumbnailZoomPlus.ExtensionId == aItem.id) {
      this._shouldUninstall = true;
    }
  },

  /**
   * Handles the on uninstalling observer in FF4.
   * @param aItem the item to be uninstalled.
   */
  onDisabling : function(aItem, needsRestart) {
    this._logger.debug("onDisabling");

    if (ThumbnailZoomPlus.ExtensionId == aItem.id) {
      this._logger.debug("onDisabling: disabling TZP.");
      this._disabling = true;
      
      // For debugging, temporarily enable calling this here
      // so we can view any javascript errors.
      if (0) { // normally if (0)
        this._clearInstalledPref();
      }
    }
  },
  
  /**
   * Handles the on operation cancelled observer in FF4.
   * @param aItem the item cancelled.
   */
  onOperationCancelled : function(aItem) {
    this._logger.debug("onOperationCancelled");

    if (ThumbnailZoomPlus.ExtensionId == aItem.id) {
      this._shouldUninstall = false;
      this._shouldUninstall = false;
    }
  },

  /**
   * Observes global topic changes.
   * @param aSubject the object that experienced the change.
   * @param aTopic the topic being observed.
   * @param aData the data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe " + aTopic + " " + aData);

    switch(aTopic) {
      case TOPIC_QUIT_APPLICATION:
        if (this._disabling) {
          this._clearInstalledPref();
        }
        if (this._shouldUninstall) {
          this._cleanUp();
        }
        break;
      case TOPIC_ACTION_REQUESTED:
        aSubject.QueryInterface(Ci.nsIUpdateItem);

        if (ThumbnailZoomPlus.ExtensionId == aSubject.id) {
          switch(aData) {
            case "item-cancel-action":
              if (this._shouldUninstall) {
                this._shouldUninstall = false;
              }
              break;
            case "item-uninstalled":
              this._shouldUninstall = true;
              break;
            case "item-disabled":
              this._disabling = true;
              break;
          }
        }
        break;
    }
    this._logger.debug("observe: done");
  }

};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.UninstallService);
