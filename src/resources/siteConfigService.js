/**
 * Copyright (c) 2011-2013 David M. Adler
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

/**
 * The Filter Service.
 */
ThumbnailZoomPlus.SiteConfigService = {
  /* Logger for this object. */
  _logger : null,
  _addThisSiteButton : null,
  _chrome : null, // the chrome document
  _windowMediator : Components.classes["@mozilla.org/appshell/window-mediator;1"]
                              .getService(Components.interfaces.nsIWindowMediator),
  _protocolRegex : /^[a-z0-9]+:\/\//i,
  
  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.SiteConfigService");
    this._logger.trace("_init");
  },

  setChromeDoc : function(doc) {
    this._chrome = doc;
    this._addThisSiteButton = this._chrome.getElementById("thumbnailzoomplus-options-add-last-site");
    this.updateSiteInPrefsDialog();
  },
  
  globToRegex : function(glob) {
    // converts a glob expression with ? and * wildcards to a regular expression.
    // http://stackoverflow.com/questions/5575609/javascript-regexp-to-match-strings-using-wildcards-and
    var specialChars = "\\^$*+?.()|{}[]";
    var regexChars = ["^"];
    for (var i = 0; i < glob.length; ++i) {
        var c = glob.charAt(i);
        switch (c) {
            case '?':
                regexChars.push(".");
                break;
            case '*':
                regexChars.push(".*");
                break;
            default:
                if (specialChars.indexOf(c) >= 0) {
                    regexChars.push("\\");
                }
                regexChars.push(c);
        }
    }
    regexChars.push("$");
    return new RegExp(regexChars.join(""));
  },

  isURLMatchedByGlob : function(glob, url) {
    if (glob == "") {
      return false;
    }
    var re = this.globToRegex(glob);
    ThumbnailZoomPlus._logToConsole("  re: " + re.source);

    return re.test(url);
  },
  
  isURLEnabled : function(url) {
    ThumbnailZoomPlus._logToConsole("  isURLEnabled " + url);
    url = url.replace(this._protocolRegex, "");
    var disabledRE = ThumbnailZoomPlus.getPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", "");
    var values = disabledRE.split(" ")
    for (var i in values) {
      var entry = values[i];
      ThumbnailZoomPlus._logToConsole("entry: " + entry);
      if (this.isURLMatchedByGlob(entry, url)) {
        ThumbnailZoomPlus._logToConsole("Disabled by entry: " + entry);
        return false;
      }
    }
    return true;
  },

  _getCurrentTabUrl : function() {
    var recentWindow = this._windowMediator.getMostRecentWindow("navigator:browser");
    return recentWindow && recentWindow.content ? ("" + recentWindow.content.document.location) : null;
  },
  
  _getCurrentTabHost : function() {
    var recentWindow = this._windowMediator.getMostRecentWindow("navigator:browser");
    return recentWindow && recentWindow.content ? ThumbnailZoomPlus.FilterService.getHostOfDoc(recentWindow.content.document, false) : null;
  },

  updateSiteInPrefsDialog : function() {
    if (! this._addThisSiteButton) {
      return;
    }
    var host = this._getCurrentTabHost();
    var url = this._getCurrentTabUrl();
    ThumbnailZoomPlus._logToConsole("updateSiteInPrefsDialog for host " + host);

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
    this._addThisSiteButton.setAttribute("value", host + "/");
  },
  
  _clearList : function(list) {
    for (var i=list.getRowCount() - 1; i >= 0; --i) {
      list.removeItemAt(i);
    }
  },
  
  _createSiteListRow : function(url) {
    var urlCell = this._chrome.createElement('listitem');
    urlCell.setAttribute('label',url);    
    
    return urlCell;
  },
  
  syncSitesListFromPreference : function(chromeDoc) {
    // Sets the list widget based on values in the preference.
    // https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/Preferences_system/New_attributes?redirectlocale=en-US&redirectslug=Preferences_System%2FNew_attributes
    this.setChromeDoc(chromeDoc);
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: onsyncfrompreference");

    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    if (! list || ! list.getRowCount) {
      return;
    }
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: list # elements: " + list.getRowCount());

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

    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
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
  
  /*
   * adds or removes an entry.
   * existingValue (if not null) is the default pattern for the site to be
   *   added.
   * If editing a pre-existing entry, that entry's list item is existingItem (else null).
   */
  _updateSite : function(existingValue, existingItem) {
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: _updateSite for " + 
                                    existingValue);
    
    // Prompt for edited or new value.  Include trailing spaces to make
    // the input field wider.
    var win = this._chrome.defaultView;
    var newValue = win.prompt(existingValue ? "Edit disabled site URL (?=any one character; *=any characters)" : 
                                              "New disabled site URL (?=any one character; *=any characters)", 
                              existingValue);
    if (newValue == null) {
      return; // cancelled
    }    
    
    // Update the widgets since syncSitesListToPreference will pull from them.
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    if (newValue == "") {
      if (existingItem) {
        list.removeChild(existingItem);
      }
      this.syncSitesListToPreference();
      return;
    }
    if (existingItem) {
      // update pattern of existing item
      existingItem.setAttribute("label", newValue);
    } else {
      // add new item
      list.appendChild(this._createSiteListRow(newValue));
    }
    this.syncSitesListToPreference();
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
      var pattern = this._addThisSiteButton.getAttribute("value")+"*";
      this._updateSite(pattern, null);
    }
  },

  addSiteButtonPressed : function() {
    this._updateSite(this._addThisSiteButton.getAttribute(""), null);
  },

  _removeMatchingSites : function(url) {
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("listitem");
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      var entry = item.getAttribute("label");
      if (this.isURLMatchedByGlob(entry, url)) {
        list.removeChild(item);
      } 
    }
    this.syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  },
    
  removeSiteButtonPressed : function() {
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.selectedItems;
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      list.removeChild(item);
    }
    this.syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  }

};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.SiteConfigService);
