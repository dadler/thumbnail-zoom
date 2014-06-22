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
Cu.import("resource://thumbnailzoomplus/siteConfigService.js");

var ThumbnailZoomPlusOptions = {

    _prefWindow : null,
    _logger :  ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusOptions"),
    _consoleService : Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService),
    _clipboardHelper : Components.classes["@mozilla.org/widget/clipboardhelper;1"].  
                           getService(Components.interfaces.nsIClipboardHelper),
    _appInfo : Components.classes["@mozilla.org/xre/app-info;1"].
                  getService(Components.interfaces.nsIXULAppInfo),
    _versionComparator : Components.classes["@mozilla.org/xpcom/version-comparator;1"].
                  getService(Components.interfaces.nsIVersionComparator),
    _runtime : Components.classes["@mozilla.org/xre/app-info;1"].
                  getService(Components.interfaces.nsIXULRuntime),

    init : function() {
        ThumbnailZoomPlus.debugToConsole("ThumbnailZoomPlusOptions.init()");
        ThumbnailZoomPlus.SiteConfigService.setChromeDoc(document);

        this._prefWindow = document.documentElement;
        this._checkPrefsCompatibility();
    },

    /**
     * Returns first element matching the xpath under the context element,
     * otherwise null.
     *
     * Note: the context element takes effect only if the xpath does *not* begin
     *       with "/" or "//". Furthermore I would recommend to start the xpath
     *       with "./" or ".//".
     */
    _xpathSelector : function(context, xpath) {
      return document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    },

    /**
     * Returns array of elements matching the xpath under the context element,
     * otherwise empty array.
     *
     * Note: the context element takes effect only if the xpath does *not* begin
     *       with "/" or "//". Furthermore I would recommend to start the xpath
     *       with "./" or ".//".
     */
    _xpathSelectorAll : function(context, xpath) {
      var result = [];
      var snapshots = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (var i = 0; i < snapshots.snapshotLength; i++) {
        result[i] = snapshots.snapshotItem(i);
      }
      return result;
    },

    /**
     * All elements in prefwindow with compatibility restrictions are checked
     * and disabled if the requirements are not met.
     *
     * Available restrictions:
     *   minVersion.........minimal app version (inclusive)
     *   maxVersion.........maximal app version (inclusive)
     *   targetApplication..space separated whitelist of app GUIDs
     *   targetPlatform.....space separated whitelist of operating systems
     *
     * When option with unmet requirements is disabled but was active (selected),
     * fallback option searched. You can explicitly mark sibling option (e.g.
     * menuitem) as fallback with attribute `fallback="true"`, otherwise first
     * child of parent element is selected. This happens during option window init
     * and the changes are saved automatically.
     *
     * Note: current implementation expects menuitem elements for simplicity,
     * this may change in the future.
     */
    _checkPrefsCompatibility : function() {
      this._logger.trace("_checkPrefsCompatibility");

      var elems = this._xpathSelectorAll(document, ".//*[@minVersion] | .//*[@maxVersion] | .//*[@targetApplication] | .//*[@targetPlatform]");
      this._logger.debug("_checkPrefsCompatibility: number of elements to be checked=" + elems.length);

      for (var i = 0; i < elems.length; i++) {
        var elem = elems[i];
        this._logger.debug("_checkPrefsCompatibility: checking element[" + i + "]="+ elem.tagName);

        if (elem.hasAttribute("minVersion") &&
            this._versionComparator.compare(this._appInfo.version, elem.getAttribute("minVersion")) < 0) {
              this._logger.debug("_checkPrefsCompatibility: minVersion requirement not met. Disabling element.");
              elem.disabled = true;
        } else
        if (elem.hasAttribute("maxVersion") &&
            this._versionComparator.compare(this._appInfo.version, elem.getAttribute("maxVersion")) > 0) {
              this._logger.debug("_checkPrefsCompatibility: maxVersion requirement not met. Disabling element.");
              elem.disabled = true;
        } else
        if (elem.hasAttribute("targetApplication") &&
            elem.getAttribute("targetApplication").indexOf(this._appInfo.ID) < 0) {
              this._logger.debug("_checkPrefsCompatibility: targetApplication requirement not met. Disabling element.");
              elem.disabled = true;
        } else
        if (elem.hasAttribute("targetPlatform") &&
            elem.getAttribute("targetPlatform").indexOf(this._runtime.OS) < 0) {
              this._logger.debug("_checkPrefsCompatibility: targetPlatform requirement not met. Disabling element.");
              elem.disabled = true;
        } else {
          this._logger.debug("_checkPrefsCompatibility: all requirements met. Skipping for next element if any.");
          break;
        }

        // Incompatible option can't be active at the same time.
        if (elem.disabled && elem.selected) {
          var fallback = this._xpathSelector(elem.parentNode, "./*[@fallback]");
          var defaultElem = fallback ? fallback : elem.parentNode.firstChild;
          this._logger.debug("_checkPrefsCompatibility: the examined element is disabled and selected. Found substitute element=" + defaultElem.tagName);

          // Find first parent that is keeping track of selected item.
          // Note: this is probably menulist specific.
          var parent = elem;
          var updatePreferences = false;
          do {
            parent = parent.parentNode;
            if (parent && typeof parent.selectedItem === "object") {
              this._logger.debug("_checkPrefsCompatibility: parent element " + parent.tagName + " is updated with substitute element " + defaultElem.tagName);
              // Change selected item in UI.
              parent.selectedItem = defaultElem;

              // Notify preference element about the change.
              var changeEvent = document.createEvent("Event");
              changeEvent.initEvent("change", true, false);
              parent.dispatchEvent(changeEvent);

              // Write the changes once we finish iterating.
              updatePreferences = true;
              break;
            }
          } while (parent);
        }
      }

      // Save changed preferences for all prefpanes.
      if (updatePreferences) {
        var prefpanes = this._prefWindow.preferencePanes;
        for (var i = 0; i < prefpanes.length; i++){
          prefpanes[i].writePreferences(false);
          this._logger.debug("_checkPrefsCompatibility: preferences saved for prefpane[" + i + "]");
        }
      } else this._logger.debug("_checkPrefsCompatibility: no preferences were changed.");

      this._logger.debug("_checkPrefsCompatibility: done.");
    },

    /**
     * Copy console messages to clipboard.
     */
    copyDebugLog : function() {
      this._logger.trace("copyDebugLog");
      
      let out = {};  // Throwaway references to support 'out' parameters.
      let messages = this._consoleService.getMessageArray(out, {}) || out.value;

      let log = "";
      for (var i in messages) {
        let msg = messages[i];
        if (msg instanceof Ci.nsIScriptError) {
          let timeStamp = new Date(msg.timeStamp).toLocaleTimeString() + 
          String((msg.timeStamp % 1000) / 1000.).replace(/^0\./, ".");
          var severity = "";
          if (msg.flags & msg.warningFlag) {
            severity += "W";
          } else if (msg.flags & msg.exceptionFlag) {
            severity += "X";
          } else if (msg.flags & msg.strictFlag) {
            severity += "S";
          } else {
            severity += "E";
          }
          var text = timeStamp + " " + severity + " " + msg.category.replace(" ", "_") +
          ": " + msg.message
        } else {
          var text = ": " + msg.message;
        }
        log += "=== " + text + "\n";
      }
      this._logger.debug("copyDebugLog: message=" + log);
      
      this._clipboardHelper.copyString(log);  
    }
};

window.addEventListener(
  "load", function() { ThumbnailZoomPlusOptions.init(); }, false);
