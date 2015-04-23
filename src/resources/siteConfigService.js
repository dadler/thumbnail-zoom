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
 * The SiteConfigService manages the Disabled Sites preference dialog
 * and applying it to URLs.
 */
ThumbnailZoomPlus.SiteConfigService = {
  /* Logger for this object. */
  _logger : null,
  _addThisSiteButton : null,
  _addOrRemoveLabelText : "",
  _addLabelText : "",
  _removeLabelText : "",
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

  /**
   * setChromeDoc informs the service of the 'chrome' document from which it can get
   * preference dialog widgets.  This is called from options.js.
   */
  setChromeDoc : function(doc) {
    this._chrome = doc;
    this._addThisSiteButton = this._chrome.getElementById("thumbnailzoomplus-options-add-last-site");
    // grab label text from widgets so we can access localized versions of them.
    this._addOrRemoveLabelText = this._addThisSiteButton.getAttribute("label");
    this._addLabelText = this._chrome.getElementById("thumbnailzoomplus-options-add-site").getAttribute("label");
    this._removeLabelText = this._chrome.getElementById("thumbnailzoomplus-options-remove-site").getAttribute("label");
    this.updateSiteInPrefsDialog();
  },
  
  _globToRegex : function(glob, ignoreProtocol) {
    // converts a glob expression with ? and * wildcards to a regular expression.
    // http://stackoverflow.com/questions/5575609/javascript-regexp-to-match-strings-using-wildcards-and
    var specialChars = "\\^$*+?.()|{}[]";
    var regexChars = ["^"];
    var ignoreLeadingSlashes = false;
    for (var i = 0; i < glob.length; ++i) {
        var c = glob.charAt(i);
        switch (c) {
            case '?':
                regexChars.push(".");
                break;
            case '*':
                regexChars.push(".*");
                break;
            case ':':
                if (ignoreProtocol) {
                    regexChars = ["^"];
                    ignoreProtocol = false;
                    ignoreLeadingSlashes = true;
                } else {
                    regexChars.push(c);
                }
                break;
            case '/':
                ignoreProtocol = false;
                if (ignoreLeadingSlashes) {
                    break;
                }
                // fall through to default case.
                
            default:
                if (specialChars.indexOf(c) >= 0) {
                    regexChars.push("\\");
                }
                regexChars.push(c);
                ignoreLeadingSlashes = false;
        }
    }
    regexChars.push("$");
    return new RegExp(regexChars.join(""));
  },

  _isURLMatchedByGlob : function(glob, url1, url2, ignoreProtocol) {
    if (glob == "") {
      return false;
    }
    var re = this._globToRegex(glob, ignoreProtocol);

    var matched = re.test(url1) || re.test(url2);

    // ThumbnailZoomPlus.debugToConsole("_isURLMatchedByGlob: " + glob + " " + re + " " + url1 + " " + url2 + " " + ignoreProtocol + ": " + matched);
    
    return matched;
  },
  
  /**
   * Returns true iff the specified url is allowed by the site configurations.
   */
  isURLEnabled : function(url, ignoreProtocol) {
    ThumbnailZoomPlus.debugToConsole("isURLEnabled " + url + " ...");
    var urlWithoutProtocol = url.replace(this._protocolRegex, "");
    var disabledRE = ThumbnailZoomPlus.getPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", "");
    var values = disabledRE.split(" ")
    for (var i in values) {
      var entry = values[i];
      // ThumbnailZoomPlus.debugToConsole("entry: " + entry);
      if (this._isURLMatchedByGlob(entry, url, urlWithoutProtocol, ignoreProtocol)) {
        ThumbnailZoomPlus.debugToConsole("  disabled by entry: " + entry);
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

  /**
   * updateSiteInPrefsDialog updates the _addThisSiteButton's label text
   * to be Add or Remove and the current tab's site's name.  It also 
   * enables/disables the button as appropriate.
   */
  updateSiteInPrefsDialog : function() {
    if (! this._addThisSiteButton) {
      return;
    }
    var host = this._getCurrentTabHost();
    var url = this._getCurrentTabUrl();
    var pattern;
    if (host) {
      var label = host;
      pattern = host + "/";
    } else {
      var label = url;
      var maxChars = 30;
      if (label.length > maxChars) {
        label = label.substring(0, maxChars-3) + "...";
      }
      pattern = url;
    }
    ThumbnailZoomPlus.debugToConsole("updateSiteInPrefsDialog for host " + host);

    if (pattern) {
      var ruleExists = ! ThumbnailZoomPlus.SiteConfigService.isURLEnabled(url, true);
      var operation = ruleExists ? this._removeLabelText : this._addLabelText;
      label = operation + " " + label;
      this._addThisSiteButton.removeAttribute("disabled");
    } else {
      label = this._addOrRemoveLabelText;
      this._addThisSiteButton.setAttribute("disabled", "true");
    }
    this._addThisSiteButton.setAttribute("label", label);
    this._addThisSiteButton.setAttribute("value", pattern);
  },
  
  /// Clears the specified list widget.
  _clearList : function(list) {
    for (var i=list.getRowCount() - 1; i >= 0; --i) {
      list.removeItemAt(i);
    }
  },
  
  /// Creates and returns a listitem whose label is the specified url.
  _createSiteListRow : function(url) {
    var urlCell = this._chrome.createElement('listitem');
    urlCell.setAttribute('label',url);    
    
    return urlCell;
  },
  
  /// Inserts an item in sorted order in the specified list, if it isn't
  /// already in the list.
  _insertListItemSorted : function(list, label) {
    var low = 0, high = list.getRowCount() - 1;

    while (low <= high) {
        var i = Math.floor((low + high) / 2);
        var probeItem = list.getItemAtIndex(i);
        var probeValue = probeItem.getAttribute("label");
        if (probeValue < label) { low = i + 1; continue; };
        if (probeValue > label) { high = i - 1; continue; };
        
        // found it.
        probeItem.setAttribute("label", label);
        return;
    }
    // Item not found.
    if (probeValue < label) {
        i = i + 1;
    }
    list.insertItemAt(i, label);
  },
  
  /// Sets the disabled sites list widget based on values in the preference.
  syncSitesListFromPreference : function(chromeDoc) {
    // background on preferences XUL:
    // https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/Preferences_system/New_attributes?redirectlocale=en-US&redirectslug=Preferences_System%2FNew_attributes
    this.setChromeDoc(chromeDoc);
    ThumbnailZoomPlus.debugToConsole("thumbnailZoomPlus: onsyncfrompreference");

    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    if (! list || ! list.getRowCount) {
      return;
    }

    list.style.visibility = "hidden";
    this._clearList(list);
    var that = this;
    
    var prefValue = ThumbnailZoomPlus.getPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", "");
    ThumbnailZoomPlus.debugToConsole("ThumbnailZoomPlus: pref value is " +
                                    prefValue);
    var prefValues = prefValue.split(" ");
    prefValues.sort();
    prefValues.forEach(function(entry) {
      if (entry != "") {
        list.appendChild(that._createSiteListRow(entry));
      }
    });
    list.style.visibility = "visible";
    
    return "";
  },
  
  /**
   * Sets the preference to match items in the list widget.
   */
  _syncSitesListToPreference : function() {
    ThumbnailZoomPlus.debugToConsole("thumbnailZoomPlus: onsynctopreference");

    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("listitem");
    var prefValue = "";
    for (var idx=0; idx < items.length; ++idx) {
      var cell = items[idx];
      prefValue += cell.getAttribute("label") + " ";
    }
    ThumbnailZoomPlus.debugToConsole("ThumbnailZoomPlus: new pref value is " +
                                    prefValue);
    ThumbnailZoomPlus.setPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", prefValue);

    return prefValue;
  },
  
  /*
   * _updateSite adds or removes a disabled-site entry.
   *
   * existingValue is the default pattern for the site to be
   *   added (if non-existent) or removed (if already existing); specify null to add a new
   *   site without default pattern.
   * When editing a pre-existing entry, that entry's list item is existingItem (else null).
   */
  _updateSite : function(existingValue, existingItem) {
    ThumbnailZoomPlus.debugToConsole("ThumbnailZoomPlus: _updateSite for " + 
                                      existingValue);
    
    // Prompt for edited or new value.  Include trailing spaces to make
    // the input field wider.
    var win = this._chrome.defaultView;
    var newValue = win.prompt(existingValue ? "Edit disabled site URL (?=any one character; *=any characters), eg www.bozo.com/*" :
                                              "New disabled site URL (?=any one character; *=any characters), eg www.bozo.com/*",
                              existingValue);
    if (newValue == null) {
      return; // cancelled
    }    
    if (newValue != "" && ! /\*/.test(newValue)) {
        var proposed = newValue.replace(/([^?]+)/, "$1*");
        if (proposed != newValue) {
          var ok = win.confirm("Would you like to match all web pages under that page by using URL " + proposed + " ? ",
                                 existingValue);
          if (ok) {
            newValue = proposed;
          }
        }
    }
    
    // Update the widgets since _syncSitesListToPreference will pull from them.
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    if (newValue == "") {
      // Empty input field; remove site.
      if (existingItem) {
        list.removeChild(existingItem);
      }
      this._syncSitesListToPreference();
      return;
    }
    if (existingItem) {
      // update pattern of existing item
      list.removeChild(existingItem);
      this._insertListItemSorted(list, newValue);
    } else {
      // add new item
      this._insertListItemSorted(list, newValue);
    }
    this._syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  },
  
  /**
   * handleSiteListDoubleClick is called when the user double-clicks on an
   * item in the disabled sites list.  It calls _updateSite to let the user
   * edit the item's pattern.
   */
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
    var ruleExists = ! ThumbnailZoomPlus.SiteConfigService.isURLEnabled(url, true);
    if (ruleExists) {
      this._removeMatchingSites(url);
    } else {
      var pattern = this._addThisSiteButton.getAttribute("value");
      if (pattern.endsWith("/")) {
        pattern += "*";
      }
      this._updateSite(pattern, null);
    }
  },

  addSiteButtonPressed : function() {
    this._updateSite(this._addThisSiteButton.getAttribute(""), null);
  },

  _removeMatchingSites : function(url) {
    var urlWithoutProtocol = url.replace(this._protocolRegex, "");
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("listitem");
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      var entry = item.getAttribute("label");
      if (this._isURLMatchedByGlob(entry, url, url, true)) {
        list.removeChild(item);
      } 
    }
    this._syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  },
    
  removeSiteButtonPressed : function() {
    var list = this._chrome.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.selectedItems;
    for (var idx = items.length-1; idx >= 0; idx--) {
      var item = items[idx];
      list.removeChild(item);
    }
    this._syncSitesListToPreference();
    this.updateSiteInPrefsDialog();
  }

};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.SiteConfigService);
