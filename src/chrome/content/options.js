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

    _logger :  ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusOptions"),
    _consoleService : Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService),
    _clipboardHelper : Components.classes["@mozilla.org/widget/clipboardhelper;1"].  
                           getService(Components.interfaces.nsIClipboardHelper),
    _windowMediator : Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator),
    _addThisSiteButton : null,
    
    init : function() {
        ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlusOptions.init()");
        this._addThisSiteButton = document.getElementById("thumbnailzoomplus-options-add-last-site");
        this.updateSiteInPrefsDialog();
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
    },
  
  _getCurrentTabUrl : function() {
    var recentWindow = this._windowMediator.getMostRecentWindow("navigator:browser");
    return recentWindow ? recentWindow.content.document.location : null;
  },
  
  _getCurrentTabHost : function() {
    var recentWindow = this._windowMediator.getMostRecentWindow("navigator:browser");
    return recentWindow ? ThumbnailZoomPlus.FilterService.getHostOfDoc(recentWindow.content.document, false) : null;
  },

  updateSiteInPrefsDialog : function() {
    var url = this._getCurrentTabUrl();
    var host = this._getCurrentTabHost();
    ThumbnailZoomPlus._logToConsole("updateSiteInPrefsDialog for host " + host);
    this._addThisSiteButton.setAttribute("value", url);

    if (host) {
      var ruleExists = ! ThumbnailZoomPlus.SiteConfigService.isURLEnabled(url);
      var operation = ruleExists ? "Remove " : "Add ";
      var label = operation + host;
      this._addThisSiteButton.removeAttribute("disabled");
    } else {
      var label = "Add/remove current site";
      this._addThisSiteButton.setAttribute("disabled", "true");
    }
    this._addThisSiteButton.setAttribute("label", label);
  },
  
  _clearList : function(list) {
    for (var i=list.getRowCount() - 1; i >= 0; --i) {
      list.removeItemAt(i);
    }
  },
  
  _createSiteListRow : function(url) {
    var urlCell = document.createElement('listitem');
    urlCell.setAttribute('label',url);    
    
    return urlCell;
  },
  
  syncSitesListFromPreference : function() {
    // Sets the list widget based on values in the preference.
    // https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/Preferences_system/New_attributes?redirectlocale=en-US&redirectslug=Preferences_System%2FNew_attributes
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: onsyncfrompreference");

    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    
    list.style.visibility = "hidden";
    this._clearList(list);
    var that = this;
    
    var prefValue = ThumbnailZoomPlus.getPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", "");
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: pref value is " +
                                    prefValue);
    prefValue.split(" ").forEach(function(entry) {
      if (entry != "") {
        ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: entry = " + entry);
        list.appendChild(that._createSiteListRow(entry));
      }
    });
    list.style.visibility = "visible";
    
    return "";
  },
  
  syncSitesListToPreference : function() {
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: onsynctopreference");

    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("listitem");
    var prefValue = "";
    for (var idx=0; idx < items.length; ++idx) {
      var cell = items[idx];
      prefValue += cell.getAttribute("label") + " ";
    }
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: new pref value is " +
                                    prefValue);
    ThumbnailZoomPlus.setPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", prefValue);

    return prefValue;
  },
  
  _updateSite : function(existingValue, existingItem) {
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: _updateSite for " + 
                                    existingValue);
    
    // Prompt for edited or new value.  Include trailing spaces to make
    // the input field wider.
    var newValue = window.prompt(existingValue ? "Edit URL of existing entry                           " : 
                                                 "Enter site URL for new entry                         ", 
                                 existingValue);
    if (newValue == null) {
      return; // cancelled
    }    
    
    // Update the widgets since syncSitesListToPreference will pull from them.
    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    if (newValue == "") {
      if (existingItem) {
        list.removeChild(target);
      }
      ThumbnailZoomPlusOptions.syncSitesListToPreference();
      return;
    }
    if (existingItem) {
      existingItem.setAttribute("label", newValue);
    } else {
      list.appendChild(this._createSiteListRow(newValue));
    }
    ThumbnailZoomPlusOptions.syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  },
  
  handleSiteListDoubleClick : function(event) {
    var target = event.target;
    while (target && target.localName != "listitem") {
      target = target.parentNode;
    }
    if (target) {
      var value = target.getAttribute("label")
    } else {
      var value = "";
    }
    this._updateSite(value, target);
  },
  
  addThisSiteButtonPressed : function() {
    var url = this._addThisSiteButton.getAttribute("value");
    var ruleExists = ! ThumbnailZoomPlus.SiteConfigService.isURLEnabled(url);
    if (ruleExists) {
      this._removeMatchingSites(url);
    } else {
      this._updateSite(this._addThisSiteButton.getAttribute("value"), null);
    }
  },

  addSiteButtonPressed : function() {
    this._updateSite(this._addThisSiteButton.getAttribute(""), null);
  },

  _removeMatchingSites : function(url) {
    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("listitem");
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      var entry = item.getAttribute("label");
      if (entry != "") {
        var disabledExpr = new RegExp(entry);
        if (disabledExpr.test(url)) {
          list.removeChild(item);
        }
      } 
    }
    ThumbnailZoomPlusOptions.syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  },
    
  removeSiteButtonPressed : function() {
    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.selectedItems;
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      list.removeChild(item);
    }
    ThumbnailZoomPlusOptions.syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  }
  
};
ThumbnailZoomPlus.Options = ThumbnailZoomPlusOptions;

window.addEventListener(
  "load", function() { ThumbnailZoomPlusOptions.init(); }, false);
