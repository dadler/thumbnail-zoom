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

var ThumbnailZoomPlusOptions = {

    _logger :  ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusOptions"),
    _consoleService : Cc["@mozilla.org/consoleservice;1"].
                                   getService(Ci.nsIConsoleService),
    _clipboardHelper : Components.classes["@mozilla.org/widget/clipboardhelper;1"].  
                           getService(Components.interfaces.nsIClipboardHelper),

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
  
  _clearRichList : function(list) {
    var items = list.getElementsByTagName("richlistitem");
    for (var i=items.length - 1; i >= 0; --i) {
      list.removeChild(items[i]);
    }
  },
  
  _createSiteListRow : function(enable, url) {
    var checkboxCell = document.createElement('listcell');    
    var checkbox = document.createElement('checkbox');
    checkbox.checked = enable;
    checkboxCell.appendChild(checkbox);
    
    var urlCell = document.createElement('listcell');
    urlCell.setAttribute('label',url);    

    var item = document.createElement('richlistitem');
    item.appendChild(checkboxCell);
    item.appendChild(urlCell);
    
    return item;
  },
  
  syncSitesListFromPreference : function() {
    // Sets the list widget based on values in the preference.
    // https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/Preferences_system/New_attributes?redirectlocale=en-US&redirectslug=Preferences_System%2FNew_attributes
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: onsyncfrompreference");

    // for testing, only do this first time.
    if (this.didit != undefined) {
      return;
    } else {
      this.didit = 1;
    }
    
    /*
       Each item has xul like this:
          <richlistitem>
            <listcell><checkbox checked="true"/></listcell>
            <listcell label="lowes.com"/>
          </richlistitem>
       Delete pre-existing items and append new items.
    */
    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    
    list.style.visibility = "hidden";
    this._clearRichList(list);
    var that = this;
    
    var prefValue = ThumbnailZoomPlus.getPref(ThumbnailZoomPlus.PrefBranch + "disabledSitesRE", "");
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: pref value is " +
                                    prefValue);
    prefValue.split(" ").forEach(function(entry) {
      if (entry != "") {
        var enable = (entry[0] == "1");
        var url = entry.substr(2);
        ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: entry[0] = " + entry[0] + " for entry=" + entry + " enable=" + enable);
        list.appendChild(that._createSiteListRow(enable, url));
      }
    });
    list.style.visibility = "visible";

    return "";
  },
  
  syncSitesListToPreference : function() {
    ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: onsynctopreference");

    var list = document.getElementById("thumbnailzoomplus-options-disabled-sites-list");
    var items = list.getElementsByTagName("richlistitem");
    var prefValue = "";
    for (var idx=0; idx < items.length; ++idx) {
      var cells = items[idx].children;
      var enable = 0 + cells[0].firstChild.checked;
      prefValue += enable + ":" + cells[1].getAttribute("label") + " ";
    }
    ThumbnailZoomPlus._logToConsole("ThumbnailZoomPlus: pref value is " +
                                    prefValue);
    return prefValue;
  }
  
};
